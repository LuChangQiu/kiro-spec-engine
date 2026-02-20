#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const { spawn, spawnSync } = require('child_process');
const {
  DEFAULT_BASELINE,
  DEFAULT_OUT,
  DEFAULT_LINES_OUT,
  DEFAULT_MARKDOWN_OUT,
  DEFAULT_BATCH_JSON_OUT,
  DEFAULT_COMMANDS_OUT,
  DEFAULT_TOP_TEMPLATES,
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
const DEFAULT_CLUSTER_GOALS = '.kiro/auto/matrix-remediation.capability-clusters.json';
const DEFAULT_HIGH_RETRY_MAX_ROUNDS = 3;
const DEFAULT_MEDIUM_RETRY_MAX_ROUNDS = 2;
const DEFAULT_PHASE_RECOVERY_ATTEMPTS = 2;
const DEFAULT_PHASE_RECOVERY_COOLDOWN_SECONDS = 30;

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
    phaseRecoveryAttempts: DEFAULT_PHASE_RECOVERY_ATTEMPTS,
    phaseRecoveryCooldownSeconds: DEFAULT_PHASE_RECOVERY_COOLDOWN_SECONDS,
    baseline: null,
    queueOut: DEFAULT_OUT,
    queueLinesOut: DEFAULT_LINES_OUT,
    queueMarkdownOut: DEFAULT_MARKDOWN_OUT,
    queueBatchJsonOut: DEFAULT_BATCH_JSON_OUT,
    queueCommandsOut: DEFAULT_COMMANDS_OUT,
    clusterGoals: null,
    clusterHighGoalsOut: null,
    clusterMediumGoalsOut: null,
    minDeltaAbs: 0,
    topTemplates: DEFAULT_TOP_TEMPLATES,
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
    } else if (token === '--phase-recovery-attempts' && next) {
      options.phaseRecoveryAttempts = Number(next);
      index += 1;
    } else if (token === '--phase-recovery-cooldown-seconds' && next) {
      options.phaseRecoveryCooldownSeconds = Number(next);
      index += 1;
    } else if (token === '--baseline' && next) {
      options.baseline = next;
      index += 1;
    } else if (token === '--queue-out' && next) {
      options.queueOut = next;
      index += 1;
    } else if (token === '--queue-lines-out' && next) {
      options.queueLinesOut = next;
      index += 1;
    } else if (token === '--queue-markdown-out' && next) {
      options.queueMarkdownOut = next;
      index += 1;
    } else if (token === '--queue-batch-json-out' && next) {
      options.queueBatchJsonOut = next;
      index += 1;
    } else if (token === '--queue-commands-out' && next) {
      options.queueCommandsOut = next;
      index += 1;
    } else if (token === '--cluster-goals' && next) {
      options.clusterGoals = next;
      index += 1;
    } else if (token === '--cluster-high-goals-out' && next) {
      options.clusterHighGoalsOut = next;
      index += 1;
    } else if (token === '--cluster-medium-goals-out' && next) {
      options.clusterMediumGoalsOut = next;
      index += 1;
    } else if (token === '--min-delta-abs' && next) {
      options.minDeltaAbs = Number(next);
      index += 1;
    } else if (token === '--top-templates' && next) {
      options.topTemplates = Number(next);
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
  validatePositiveInt(options.phaseRecoveryAttempts, '--phase-recovery-attempts');
  validateNonNegativeInt(options.phaseRecoveryCooldownSeconds, '--phase-recovery-cooldown-seconds');
  if (!Number.isFinite(options.minDeltaAbs) || options.minDeltaAbs < 0) {
    throw new Error('--min-delta-abs must be a non-negative number.');
  }
  validatePositiveInt(options.topTemplates, '--top-templates');

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
    `  --phase-recovery-attempts <n>  Max process-level attempts per phase on failure (default: ${DEFAULT_PHASE_RECOVERY_ATTEMPTS})`,
    `  --phase-recovery-cooldown-seconds <n> Cooldown between retry attempts of the same phase (default: ${DEFAULT_PHASE_RECOVERY_COOLDOWN_SECONDS})`,
    `  --baseline <path>              Optional: generate queue package from baseline first (default baseline path: ${DEFAULT_BASELINE})`,
    `  --queue-out <path>             Queue plan JSON output when --baseline is used (default: ${DEFAULT_OUT})`,
    `  --queue-lines-out <path>       Queue lines output when --baseline is used (default: ${DEFAULT_LINES_OUT})`,
    `  --queue-markdown-out <path>    Queue markdown output when --baseline is used (default: ${DEFAULT_MARKDOWN_OUT})`,
    `  --queue-batch-json-out <path>  Queue aggregate goals JSON output when --baseline is used (default: ${DEFAULT_BATCH_JSON_OUT})`,
    `  --queue-commands-out <path>    Queue commands markdown output when --baseline is used (default: ${DEFAULT_COMMANDS_OUT})`,
    `  --cluster-goals <path>         Optional: capability-cluster goals JSON input (for example: ${DEFAULT_CLUSTER_GOALS})`,
    '  --cluster-high-goals-out <path> Derived high-phase goals JSON output from capability clusters',
    '  --cluster-medium-goals-out <path> Derived medium-phase goals JSON output from capability clusters',
    '  --min-delta-abs <n>            Pass-through to queue generation when --baseline is used',
    `  --top-templates <n>            Pass-through top template candidates (default: ${DEFAULT_TOP_TEMPLATES})`,
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

function derivePhasePath(basePath, phaseName) {
  const parsed = path.parse(basePath);
  return path.join(parsed.dir, `${parsed.name}.${phaseName}${parsed.ext}`);
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

function dedupeGoals(values = []) {
  const output = [];
  const seen = new Set();
  for (const item of values) {
    const goal = `${item || ''}`.trim();
    if (!goal || seen.has(goal)) {
      continue;
    }
    seen.add(goal);
    output.push(goal);
  }
  return output;
}

async function readClusterGoalsPayload(filePath) {
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return {
      exists: false,
      cluster_count: 0,
      goal_count: 0,
      high_goals: [],
      medium_goals: []
    };
  }
  const payload = await fs.readJson(filePath);
  const clusters = Array.isArray(payload && payload.clusters)
    ? payload.clusters
    : [];
  const highGoals = [];
  const mediumGoals = [];
  for (const cluster of clusters) {
    const goals = Array.isArray(cluster && cluster.goals)
      ? cluster.goals.map(item => `${item || ''}`.trim()).filter(Boolean)
      : [];
    const phase = `${cluster && cluster.recommended_phase ? cluster.recommended_phase : ''}`
      .trim()
      .toLowerCase();
    if (phase === 'high') {
      highGoals.push(...goals);
    } else {
      mediumGoals.push(...goals);
    }
  }

  const fallbackGoals = Array.isArray(payload && payload.goals)
    ? payload.goals.map(item => `${item || ''}`.trim()).filter(Boolean)
    : [];
  const dedupHigh = dedupeGoals(highGoals);
  const dedupMedium = dedupeGoals([...mediumGoals, ...fallbackGoals]);
  return {
    exists: true,
    cluster_count: clusters.length,
    goal_count: dedupHigh.length + dedupMedium.length,
    high_goals: dedupHigh,
    medium_goals: dedupMedium
  };
}

async function writeGoalsPayload(filePath, goals = []) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, { goals: dedupeGoals(goals) }, { spaces: 2 });
}

async function prepareClusterGoals(options, runtime, paths) {
  if (!paths.clusterGoalsPath) {
    return {
      status: 'skipped',
      source: null,
      high_goals_path: null,
      medium_goals_path: null,
      cluster_count: 0,
      goal_count: 0,
      high_goal_count: 0,
      medium_goal_count: 0
    };
  }
  const parsed = await readClusterGoalsPayload(paths.clusterGoalsPath);
  if (!parsed.exists) {
    throw new Error(`cluster goals file not found: ${runtime.toRelative(paths.clusterGoalsPath)}`);
  }
  await writeGoalsPayload(paths.clusterHighGoalsPath, parsed.high_goals);
  await writeGoalsPayload(paths.clusterMediumGoalsPath, parsed.medium_goals);
  return {
    status: 'completed',
    source: runtime.toRelative(paths.clusterGoalsPath),
    high_goals_path: runtime.toRelative(paths.clusterHighGoalsPath),
    medium_goals_path: runtime.toRelative(paths.clusterMediumGoalsPath),
    cluster_count: parsed.cluster_count,
    goal_count: parsed.goal_count,
    high_goal_count: parsed.high_goals.length,
    medium_goal_count: parsed.medium_goals.length
  };
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

function buildQueueGenerationArgs(options, paths) {
  return [
    path.resolve(__dirname, 'moqui-matrix-remediation-queue.js'),
    '--baseline',
    paths.baselinePath,
    '--out',
    paths.queueOutPath,
    '--lines-out',
    paths.queueLinesOutPath,
    '--markdown-out',
    paths.queueMarkdownOutPath,
    '--batch-json-out',
    paths.queueBatchJsonOutPath,
    '--commands-out',
    paths.queueCommandsOutPath,
    '--phase-high-lines-out',
    paths.highLinesPath,
    '--phase-medium-lines-out',
    paths.mediumLinesPath,
    '--phase-high-goals-out',
    paths.highGoalsPath,
    '--phase-medium-goals-out',
    paths.mediumGoalsPath,
    '--phase-high-parallel',
    `${options.phaseHighParallel}`,
    '--phase-high-agent-budget',
    `${options.phaseHighAgentBudget}`,
    '--phase-medium-parallel',
    `${options.phaseMediumParallel}`,
    '--phase-medium-agent-budget',
    `${options.phaseMediumAgentBudget}`,
    '--phase-cooldown-seconds',
    `${options.phaseCooldownSeconds}`,
    '--min-delta-abs',
    `${options.minDeltaAbs}`,
    '--top-templates',
    `${options.topTemplates}`,
    '--json'
  ];
}

function runQueueGeneration(options, runtime, paths) {
  if (!paths.baselinePath) {
    return {
      status: 'skipped',
      exit_code: null,
      command: null,
      queue_summary: null,
      stderr: null
    };
  }

  const commandArgs = buildQueueGenerationArgs(options, paths);
  const command = toCommandPreview(process.execPath, commandArgs);
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: runtime.cwd,
    encoding: 'utf8'
  });
  const code = Number.isFinite(result.status) ? result.status : 1;
  let queueSummary = null;
  if (code === 0) {
    const stdoutText = `${result.stdout || ''}`.trim();
    if (stdoutText) {
      try {
        const parsed = JSON.parse(stdoutText);
        if (parsed && typeof parsed === 'object') {
          queueSummary = {
            selected_regressions: parsed.summary && Number.isFinite(Number(parsed.summary.selected_regressions))
              ? Number(parsed.summary.selected_regressions)
              : null,
            phase_high_count: parsed.summary && Number.isFinite(Number(parsed.summary.phase_high_count))
              ? Number(parsed.summary.phase_high_count)
              : null,
            phase_medium_count: parsed.summary && Number.isFinite(Number(parsed.summary.phase_medium_count))
              ? Number(parsed.summary.phase_medium_count)
              : null
          };
        }
      } catch (_error) {
        queueSummary = null;
      }
    }
  }

  return {
    status: code === 0 ? 'completed' : 'failed',
    exit_code: code,
    command,
    queue_summary: queueSummary,
    stderr: `${result.stderr || ''}`.trim() || null
  };
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

function halveWithFloor(value) {
  return Math.max(1, Math.floor(Number(value) / 2));
}

async function runPhases(options, runtime, hooks = {}) {
  const phases = [];
  let failed = false;
  const executeFn = typeof hooks.executeCommand === 'function'
    ? hooks.executeCommand
    : executeCommand;
  const sleepFn = typeof hooks.sleep === 'function'
    ? hooks.sleep
    : sleep;
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
      exit_code: null,
      attempts: []
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

    if (options.dryRun) {
      const args = [...runnerPrefixArgs, ...buildCloseLoopArgs(entry.input, entry)];
      record.command = toCommandPreview(runnerBin, args);
      record.attempts.push({
        attempt: 1,
        status: 'planned',
        command: record.command,
        parallel: entry.parallel,
        agent_budget: entry.agentBudget,
        exit_code: null,
        reason: null
      });
      record.status = 'planned';
      phases.push(record);
      continue;
    }

    let attemptParallel = entry.parallel;
    let attemptAgentBudget = entry.agentBudget;
    for (let attempt = 1; attempt <= options.phaseRecoveryAttempts; attempt += 1) {
      const phaseOptions = {
        parallel: attemptParallel,
        agentBudget: attemptAgentBudget,
        retryMaxRounds: entry.retryMaxRounds
      };
      const args = [...runnerPrefixArgs, ...buildCloseLoopArgs(entry.input, phaseOptions)];
      const command = toCommandPreview(runnerBin, args);
      if (!record.command) {
        record.command = command;
      }
      const execution = await executeFn(runnerBin, args, runtime.cwd);
      const attemptReason = execution.code === 0 ? null : (execution.error || `exit code ${execution.code}`);
      record.attempts.push({
        attempt,
        status: execution.code === 0 ? 'completed' : 'failed',
        command,
        parallel: attemptParallel,
        agent_budget: attemptAgentBudget,
        exit_code: execution.code,
        reason: attemptReason
      });
      record.exit_code = execution.code;

      if (execution.code === 0) {
        record.status = 'completed';
        record.reason = null;
        break;
      }

      if (attempt >= options.phaseRecoveryAttempts) {
        record.status = 'failed';
        record.reason = attemptReason;
        failed = true;
        break;
      }

      if (options.phaseRecoveryCooldownSeconds > 0) {
        await sleepFn(options.phaseRecoveryCooldownSeconds);
      }
      attemptParallel = halveWithFloor(attemptParallel);
      attemptAgentBudget = halveWithFloor(attemptAgentBudget);
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
      (record.status === 'completed' || options.continueOnError)
    ) {
      await sleepFn(options.phaseCooldownSeconds);
    }
  }

  return phases;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const baselinePath = options.baseline
    ? resolvePath(cwd, options.baseline)
    : null;
  const highGoalsPath = resolvePath(cwd, options.highGoals);
  const mediumGoalsPath = resolvePath(cwd, options.mediumGoals);
  const highLinesPath = resolvePath(cwd, options.highLines);
  const mediumLinesPath = resolvePath(cwd, options.mediumLines);
  const queueOutPath = resolvePath(cwd, options.queueOut);
  const queueLinesOutPath = resolvePath(cwd, options.queueLinesOut);
  const queueMarkdownOutPath = resolvePath(cwd, options.queueMarkdownOut);
  const queueBatchJsonOutPath = resolvePath(cwd, options.queueBatchJsonOut);
  const queueCommandsOutPath = resolvePath(cwd, options.queueCommandsOut);
  const clusterGoalsPath = options.clusterGoals
    ? resolvePath(cwd, options.clusterGoals)
    : null;
  const clusterHighGoalsPath = clusterGoalsPath
    ? (
      options.clusterHighGoalsOut
        ? resolvePath(cwd, options.clusterHighGoalsOut)
        : derivePhasePath(clusterGoalsPath, 'high')
    )
    : null;
  const clusterMediumGoalsPath = clusterGoalsPath
    ? (
      options.clusterMediumGoalsOut
        ? resolvePath(cwd, options.clusterMediumGoalsOut)
        : derivePhasePath(clusterGoalsPath, 'medium')
    )
    : null;
  const allowLinesFallback = options.noFallbackLines !== true;
  const runtime = {
    cwd,
    toRelative: (filePath) => path.relative(cwd, filePath) || '.'
  };
  const paths = {
    baselinePath,
    highGoalsPath,
    mediumGoalsPath,
    highLinesPath,
    mediumLinesPath,
    queueOutPath,
    queueLinesOutPath,
    queueMarkdownOutPath,
    queueBatchJsonOutPath,
    queueCommandsOutPath,
    clusterGoalsPath,
    clusterHighGoalsPath,
    clusterMediumGoalsPath
  };

  const prepare = runQueueGeneration(options, runtime, paths);
  if (prepare.status === 'failed') {
    throw new Error(`queue generation failed before phased execution${prepare.stderr ? `: ${prepare.stderr}` : '.'}`);
  }

  const clusterPrepare = await prepareClusterGoals(options, runtime, paths);
  const effectiveHighGoalsPath = clusterPrepare.status === 'completed'
    ? clusterHighGoalsPath
    : highGoalsPath;
  const effectiveMediumGoalsPath = clusterPrepare.status === 'completed'
    ? clusterMediumGoalsPath
    : mediumGoalsPath;

  const highInput = await selectPhaseInput('high', effectiveHighGoalsPath, highLinesPath, allowLinesFallback);
  const mediumInput = await selectPhaseInput('medium', effectiveMediumGoalsPath, mediumLinesPath, allowLinesFallback);
  const shouldCooldown = Boolean(highInput && mediumInput && options.phaseCooldownSeconds > 0);
  runtime.highInput = highInput;
  runtime.mediumInput = mediumInput;
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
      dry_run: options.dryRun === true,
      auto_phase_recovery_enabled: options.phaseRecoveryAttempts > 1,
      cluster_mode_enabled: clusterPrepare.status === 'completed'
    },
    execution_policy: {
      phase_high_parallel: options.phaseHighParallel,
      phase_high_agent_budget: options.phaseHighAgentBudget,
      phase_high_retry_max_rounds: options.highRetryMaxRounds,
      phase_medium_parallel: options.phaseMediumParallel,
      phase_medium_agent_budget: options.phaseMediumAgentBudget,
      phase_medium_retry_max_rounds: options.mediumRetryMaxRounds,
      phase_cooldown_seconds: options.phaseCooldownSeconds,
      phase_recovery_attempts: options.phaseRecoveryAttempts,
      phase_recovery_cooldown_seconds: options.phaseRecoveryCooldownSeconds
    },
    inputs: {
      baseline: baselinePath ? runtime.toRelative(baselinePath) : null,
      high_goals: runtime.toRelative(effectiveHighGoalsPath),
      medium_goals: runtime.toRelative(effectiveMediumGoalsPath),
      high_lines: runtime.toRelative(highLinesPath),
      medium_lines: runtime.toRelative(mediumLinesPath),
      queue_out: runtime.toRelative(queueOutPath),
      queue_lines_out: runtime.toRelative(queueLinesOutPath),
      queue_markdown_out: runtime.toRelative(queueMarkdownOutPath),
      queue_batch_json_out: runtime.toRelative(queueBatchJsonOutPath),
      queue_commands_out: runtime.toRelative(queueCommandsOutPath),
      cluster_goals: clusterGoalsPath ? runtime.toRelative(clusterGoalsPath) : null,
      cluster_high_goals_out: clusterHighGoalsPath ? runtime.toRelative(clusterHighGoalsPath) : null,
      cluster_medium_goals_out: clusterMediumGoalsPath ? runtime.toRelative(clusterMediumGoalsPath) : null
    },
    prepare: {
      status: prepare.status,
      command: prepare.command,
      exit_code: prepare.exit_code,
      queue_summary: prepare.queue_summary
    },
    cluster_prepare: clusterPrepare,
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
  DEFAULT_CLUSTER_GOALS,
  DEFAULT_HIGH_RETRY_MAX_ROUNDS,
  DEFAULT_MEDIUM_RETRY_MAX_ROUNDS,
  DEFAULT_PHASE_RECOVERY_ATTEMPTS,
  DEFAULT_PHASE_RECOVERY_COOLDOWN_SECONDS,
  parseArgs,
  resolvePath,
  derivePhasePath,
  readGoalsPayload,
  readLinesPayload,
  readClusterGoalsPayload,
  writeGoalsPayload,
  prepareClusterGoals,
  buildQueueGenerationArgs,
  runQueueGeneration,
  selectPhaseInput,
  buildCloseLoopArgs,
  quoteCliArg,
  toCommandPreview,
  runPhases,
  halveWithFloor,
  main
};
