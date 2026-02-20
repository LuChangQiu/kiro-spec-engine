#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const {
  DEFAULT_PHASE_HIGH_PARALLEL,
  DEFAULT_PHASE_HIGH_AGENT_BUDGET,
  DEFAULT_PHASE_MEDIUM_PARALLEL,
  DEFAULT_PHASE_MEDIUM_AGENT_BUDGET,
  DEFAULT_PHASE_COOLDOWN_SECONDS
} = require('./moqui-matrix-remediation-queue');

const DEFAULT_HIGH_GOALS = '.kiro/auto/matrix-remediation.goals.high.json';
const DEFAULT_MEDIUM_GOALS = '.kiro/auto/matrix-remediation.goals.medium.json';
const DEFAULT_HIGH_LINES = '.kiro/auto/matrix-remediation.high.lines';
const DEFAULT_MEDIUM_LINES = '.kiro/auto/matrix-remediation.medium.lines';
const DEFAULT_HIGH_RETRY_MAX_ROUNDS = 3;
const DEFAULT_MEDIUM_RETRY_MAX_ROUNDS = 2;

function parseArgs(argv) {
  const options = {
    highGoals: DEFAULT_HIGH_GOALS,
    mediumGoals: DEFAULT_MEDIUM_GOALS,
    highLines: DEFAULT_HIGH_LINES,
    mediumLines: DEFAULT_MEDIUM_LINES,
    phaseHighParallel: DEFAULT_PHASE_HIGH_PARALLEL,
    phaseHighAgentBudget: DEFAULT_PHASE_HIGH_AGENT_BUDGET,
    phaseMediumParallel: DEFAULT_PHASE_MEDIUM_PARALLEL,
    phaseMediumAgentBudget: DEFAULT_PHASE_MEDIUM_AGENT_BUDGET,
    phaseCooldownSeconds: DEFAULT_PHASE_COOLDOWN_SECONDS,
    highRetryMaxRounds: DEFAULT_HIGH_RETRY_MAX_ROUNDS,
    mediumRetryMaxRounds: DEFAULT_MEDIUM_RETRY_MAX_ROUNDS,
    noFallbackLines: false,
    continueOnError: false,
    dryRun: false,
    json: false,
    sceBin: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--high-goals' && next) {
      options.highGoals = next;
      index += 1;
    } else if (token === '--medium-goals' && next) {
      options.mediumGoals = next;
      index += 1;
    } else if (token === '--high-lines' && next) {
      options.highLines = next;
      index += 1;
    } else if (token === '--medium-lines' && next) {
      options.mediumLines = next;
      index += 1;
    } else if (token === '--phase-high-parallel' && next) {
      options.phaseHighParallel = Number(next);
      index += 1;
    } else if (token === '--phase-high-agent-budget' && next) {
      options.phaseHighAgentBudget = Number(next);
      index += 1;
    } else if (token === '--phase-medium-parallel' && next) {
      options.phaseMediumParallel = Number(next);
      index += 1;
    } else if (token === '--phase-medium-agent-budget' && next) {
      options.phaseMediumAgentBudget = Number(next);
      index += 1;
    } else if (token === '--phase-cooldown-seconds' && next) {
      options.phaseCooldownSeconds = Number(next);
      index += 1;
    } else if (token === '--high-retry-max-rounds' && next) {
      options.highRetryMaxRounds = Number(next);
      index += 1;
    } else if (token === '--medium-retry-max-rounds' && next) {
      options.mediumRetryMaxRounds = Number(next);
      index += 1;
    } else if (token === '--sce-bin' && next) {
      options.sceBin = next;
      index += 1;
    } else if (token === '--no-fallback-lines') {
      options.noFallbackLines = true;
    } else if (token === '--continue-on-error') {
      options.continueOnError = true;
    } else if (token === '--dry-run') {
      options.dryRun = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '-h' || token === '--help') {
      printHelpAndExit(0);
    }
  }

  validatePositiveInt(options.phaseHighParallel, '--phase-high-parallel');
  validatePositiveInt(options.phaseHighAgentBudget, '--phase-high-agent-budget');
  validatePositiveInt(options.phaseMediumParallel, '--phase-medium-parallel');
  validatePositiveInt(options.phaseMediumAgentBudget, '--phase-medium-agent-budget');
  validateNonNegativeInt(options.phaseCooldownSeconds, '--phase-cooldown-seconds');
  validatePositiveInt(options.highRetryMaxRounds, '--high-retry-max-rounds');
  validatePositiveInt(options.mediumRetryMaxRounds, '--medium-retry-max-rounds');

  return options;
}

function validatePositiveInt(value, name) {
  if (!Number.isFinite(value) || value < 1 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

function validateNonNegativeInt(value, name) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-matrix-remediation-phased-runner.js [options]',
    '',
    'Options:',
    `  --high-goals <path>            High-phase goals JSON input (default: ${DEFAULT_HIGH_GOALS})`,
    `  --medium-goals <path>          Medium-phase goals JSON input (default: ${DEFAULT_MEDIUM_GOALS})`,
    `  --high-lines <path>            High-phase lines fallback input (default: ${DEFAULT_HIGH_LINES})`,
    `  --medium-lines <path>          Medium-phase lines fallback input (default: ${DEFAULT_MEDIUM_LINES})`,
    `  --phase-high-parallel <n>      close-loop-batch parallel for high phase (default: ${DEFAULT_PHASE_HIGH_PARALLEL})`,
    `  --phase-high-agent-budget <n>  close-loop-batch agent budget for high phase (default: ${DEFAULT_PHASE_HIGH_AGENT_BUDGET})`,
    `  --phase-medium-parallel <n>    close-loop-batch parallel for medium phase (default: ${DEFAULT_PHASE_MEDIUM_PARALLEL})`,
    `  --phase-medium-agent-budget <n> close-loop-batch agent budget for medium phase (default: ${DEFAULT_PHASE_MEDIUM_AGENT_BUDGET})`,
    `  --phase-cooldown-seconds <n>   Cooldown between phases (default: ${DEFAULT_PHASE_COOLDOWN_SECONDS})`,
    `  --high-retry-max-rounds <n>    Retry max rounds for high phase (default: ${DEFAULT_HIGH_RETRY_MAX_ROUNDS})`,
    `  --medium-retry-max-rounds <n>  Retry max rounds for medium phase (default: ${DEFAULT_MEDIUM_RETRY_MAX_ROUNDS})`,
    '  --no-fallback-lines            Disable fallback to .lines files when goals JSON is empty/missing',
    '  --continue-on-error            Continue medium phase even if high phase fails',
    '  --sce-bin <path>               Override executable (default: current Node + local bin/sce.js)',
    '  --dry-run                      Print planned phased commands without executing',
    '  --json                         Print summary JSON',
    '  -h, --help                     Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function readGoalsPayload(filePath) {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return { exists: false, goals: [] };
  }
  const payload = await fs.readJson(filePath);
  const goals = Array.isArray(payload && payload.goals)
    ? payload.goals.map(item => `${item || ''}`.trim()).filter(Boolean)
    : [];
  return { exists: true, goals };
}

async function readLinesPayload(filePath) {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return { exists: false, lines: [] };
  }
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
  return { exists: true, lines };
}

async function selectPhaseInput(phaseName, goalsPath, linesPath, allowLinesFallback) {
  const goals = await readGoalsPayload(goalsPath);
  if (goals.exists && goals.goals.length > 0) {
    return {
      phase: phaseName,
      source: 'goals-json',
      format: 'json',
      path: goalsPath,
      count: goals.goals.length
    };
  }
  if (allowLinesFallback) {
    const lines = await readLinesPayload(linesPath);
    if (lines.exists && lines.lines.length > 0) {
      return {
        phase: phaseName,
        source: 'lines-fallback',
        format: 'lines',
        path: linesPath,
        count: lines.lines.length
      };
    }
  }
  return null;
}

function buildCloseLoopArgs(input, phaseOptions) {
  return [
    'auto',
    'close-loop-batch',
    input.path,
    '--format',
    input.format,
    '--batch-parallel',
    `${phaseOptions.parallel}`,
    '--batch-agent-budget',
    `${phaseOptions.agentBudget}`,
    '--batch-retry-until-complete',
    '--batch-retry-max-rounds',
    `${phaseOptions.retryMaxRounds}`,
    '--json'
  ];
}

function quoteCliArg(value = '') {
  const text = `${value || ''}`;
  if (!text) {
    return '""';
  }
  if (/^[\w./\\:-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function toCommandPreview(bin, args) {
  return `${quoteCliArg(bin)} ${args.map(arg => quoteCliArg(arg)).join(' ')}`.trim();
}

function executeCommand(bin, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('close', (code) => {
      resolve({ code: Number.isFinite(code) ? code : 1 });
    });
    child.on('error', (error) => {
      resolve({ code: 1, error: error ? error.message : 'spawn failed' });
    });
  });
}

async function sleep(seconds) {
  if (seconds <= 0) {
    return;
  }
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function runPhases(options, runtime) {
  const phases = [];
  let failed = false;
  const phaseEntries = [
    {
      name: 'high',
      input: runtime.highInput,
      parallel: options.phaseHighParallel,
      agentBudget: options.phaseHighAgentBudget,
      retryMaxRounds: options.highRetryMaxRounds
    },
    {
      name: 'medium',
      input: runtime.mediumInput,
      parallel: options.phaseMediumParallel,
      agentBudget: options.phaseMediumAgentBudget,
      retryMaxRounds: options.mediumRetryMaxRounds
    }
  ];
  const runnerBin = options.sceBin || process.execPath;
  const runnerPrefixArgs = options.sceBin ? [] : [path.resolve(__dirname, '..', 'bin', 'sce.js')];

  for (let index = 0; index < phaseEntries.length; index += 1) {
    const entry = phaseEntries[index];
    const record = {
      phase: entry.name,
      status: 'skipped',
      reason: null,
      selected_input: entry.input
        ? {
          source: entry.input.source,
          format: entry.input.format,
          path: runtime.toRelative(entry.input.path),
          item_count: entry.input.count
        }
        : null,
      command: null,
      exit_code: null
    };

    if (!entry.input) {
      record.reason = 'no-available-goals';
      phases.push(record);
      continue;
    }
    if (failed && !options.continueOnError) {
      record.reason = 'skipped-after-prior-failure';
      phases.push(record);
      continue;
    }

    const args = [...runnerPrefixArgs, ...buildCloseLoopArgs(entry.input, entry)];
    record.command = toCommandPreview(runnerBin, args);

    if (options.dryRun) {
      record.status = 'planned';
      phases.push(record);
      continue;
    }

    const execution = await executeCommand(runnerBin, args, runtime.cwd);
    record.exit_code = execution.code;
    if (execution.code === 0) {
      record.status = 'completed';
    } else {
      record.status = 'failed';
      record.reason = execution.error || `exit code ${execution.code}`;
      failed = true;
    }
    phases.push(record);

    const isHighPhase = entry.name === 'high';
    const mediumPlanned = Boolean(phaseEntries[1] && phaseEntries[1].input);
    if (
      isHighPhase &&
      entry.input &&
      mediumPlanned &&
      !options.dryRun &&
      options.phaseCooldownSeconds > 0 &&
      (execution.code === 0 || options.continueOnError)
    ) {
      await sleep(options.phaseCooldownSeconds);
    }
  }

  return phases;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const highGoalsPath = resolvePath(cwd, options.highGoals);
  const mediumGoalsPath = resolvePath(cwd, options.mediumGoals);
  const highLinesPath = resolvePath(cwd, options.highLines);
  const mediumLinesPath = resolvePath(cwd, options.mediumLines);
  const allowLinesFallback = options.noFallbackLines !== true;

  const highInput = await selectPhaseInput('high', highGoalsPath, highLinesPath, allowLinesFallback);
  const mediumInput = await selectPhaseInput('medium', mediumGoalsPath, mediumLinesPath, allowLinesFallback);
  const shouldCooldown = Boolean(highInput && mediumInput && options.phaseCooldownSeconds > 0);
  const runtime = {
    cwd,
    highInput,
    mediumInput,
    toRelative: (filePath) => path.relative(cwd, filePath) || '.'
  };
  const phases = await runPhases(options, runtime);
  const completedCount = phases.filter(item => item.status === 'completed').length;
  const plannedCount = phases.filter(item => item.status === 'planned').length;
  const failedCount = phases.filter(item => item.status === 'failed').length;
  const runnableCount = phases.filter(item => item.selected_input).length;

  let status = 'no-op';
  if (failedCount > 0) {
    status = 'failed';
  } else if (options.dryRun && runnableCount > 0) {
    status = 'dry-run';
  } else if (!options.dryRun && completedCount > 0) {
    status = 'completed';
  }

  const summary = {
    mode: 'moqui-matrix-remediation-phased-runner',
    generated_at: new Date().toISOString(),
    status,
    policy: {
      continue_on_error: options.continueOnError === true,
      fallback_lines_enabled: allowLinesFallback,
      dry_run: options.dryRun === true
    },
    execution_policy: {
      phase_high_parallel: options.phaseHighParallel,
      phase_high_agent_budget: options.phaseHighAgentBudget,
      phase_high_retry_max_rounds: options.highRetryMaxRounds,
      phase_medium_parallel: options.phaseMediumParallel,
      phase_medium_agent_budget: options.phaseMediumAgentBudget,
      phase_medium_retry_max_rounds: options.mediumRetryMaxRounds,
      phase_cooldown_seconds: options.phaseCooldownSeconds
    },
    inputs: {
      high_goals: runtime.toRelative(highGoalsPath),
      medium_goals: runtime.toRelative(mediumGoalsPath),
      high_lines: runtime.toRelative(highLinesPath),
      medium_lines: runtime.toRelative(mediumLinesPath)
    },
    cooldown: {
      seconds: options.phaseCooldownSeconds,
      planned: shouldCooldown,
      applied: shouldCooldown && !options.dryRun && failedCount === 0
    },
    summary: {
      runnable_phases: runnableCount,
      completed_phases: completedCount,
      planned_phases: plannedCount,
      failed_phases: failedCount
    },
    phases
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write('Moqui matrix remediation phased runner completed.\n');
    process.stdout.write(`- Status: ${summary.status}\n`);
    process.stdout.write(`- Runnable phases: ${summary.summary.runnable_phases}\n`);
    process.stdout.write(`- Failed phases: ${summary.summary.failed_phases}\n`);
  }

  if (summary.status === 'failed') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Moqui matrix remediation phased runner failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_HIGH_GOALS,
  DEFAULT_MEDIUM_GOALS,
  DEFAULT_HIGH_LINES,
  DEFAULT_MEDIUM_LINES,
  DEFAULT_HIGH_RETRY_MAX_ROUNDS,
  DEFAULT_MEDIUM_RETRY_MAX_ROUNDS,
  parseArgs,
  resolvePath,
  readGoalsPayload,
  readLinesPayload,
  selectPhaseInput,
  buildCloseLoopArgs,
  quoteCliArg,
  toCommandPreview,
  runPhases,
  main
};
