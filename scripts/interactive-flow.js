#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DEFAULT_PROVIDER = 'moqui';
const DEFAULT_OUT_DIR = '.kiro/reports/interactive-flow';
const DEFAULT_USER_ID = 'anonymous-user';
const DEFAULT_FEEDBACK_CHANNEL = 'ui';
const FEEDBACK_CHANNELS = new Set(['ui', 'cli', 'api', 'other']);

const SCRIPT_CONTEXT_BRIDGE = path.resolve(__dirname, 'interactive-context-bridge.js');
const SCRIPT_INTERACTIVE_LOOP = path.resolve(__dirname, 'interactive-customization-loop.js');

function parseArgs(argv) {
  const options = {
    input: null,
    provider: DEFAULT_PROVIDER,
    goal: null,
    goalFile: null,
    userId: DEFAULT_USER_ID,
    sessionId: null,
    executionMode: 'suggestion',
    policy: null,
    catalog: null,
    contextContract: null,
    strictContract: true,
    moquiConfig: null,
    outDir: DEFAULT_OUT_DIR,
    out: null,
    loopOut: null,
    bridgeOutContext: null,
    bridgeOutReport: null,
    approvalActor: null,
    approverActor: null,
    skipSubmit: false,
    autoApproveLowRisk: false,
    autoExecuteLowRisk: false,
    allowSuggestionApply: false,
    liveApply: false,
    dryRun: true,
    feedbackScore: null,
    feedbackComment: null,
    feedbackTags: [],
    feedbackChannel: DEFAULT_FEEDBACK_CHANNEL,
    failOnGateDeny: false,
    failOnGateNonAllow: false,
    failOnExecuteBlocked: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--input' && next) {
      options.input = next;
      index += 1;
    } else if (token === '--provider' && next) {
      options.provider = next;
      index += 1;
    } else if (token === '--goal' && next) {
      options.goal = next;
      index += 1;
    } else if (token === '--goal-file' && next) {
      options.goalFile = next;
      index += 1;
    } else if (token === '--user-id' && next) {
      options.userId = next;
      index += 1;
    } else if (token === '--session-id' && next) {
      options.sessionId = next;
      index += 1;
    } else if (token === '--execution-mode' && next) {
      options.executionMode = next;
      index += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--catalog' && next) {
      options.catalog = next;
      index += 1;
    } else if (token === '--context-contract' && next) {
      options.contextContract = next;
      index += 1;
    } else if (token === '--no-strict-contract') {
      options.strictContract = false;
    } else if (token === '--moqui-config' && next) {
      options.moquiConfig = next;
      index += 1;
    } else if (token === '--out-dir' && next) {
      options.outDir = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--loop-out' && next) {
      options.loopOut = next;
      index += 1;
    } else if (token === '--bridge-out-context' && next) {
      options.bridgeOutContext = next;
      index += 1;
    } else if (token === '--bridge-out-report' && next) {
      options.bridgeOutReport = next;
      index += 1;
    } else if (token === '--approval-actor' && next) {
      options.approvalActor = next;
      index += 1;
    } else if (token === '--approver-actor' && next) {
      options.approverActor = next;
      index += 1;
    } else if (token === '--skip-submit') {
      options.skipSubmit = true;
    } else if (token === '--auto-approve-low-risk') {
      options.autoApproveLowRisk = true;
    } else if (token === '--auto-execute-low-risk') {
      options.autoExecuteLowRisk = true;
    } else if (token === '--allow-suggestion-apply') {
      options.allowSuggestionApply = true;
    } else if (token === '--live-apply') {
      options.liveApply = true;
    } else if (token === '--no-dry-run') {
      options.dryRun = false;
    } else if (token === '--feedback-score' && next) {
      options.feedbackScore = Number(next);
      index += 1;
    } else if (token === '--feedback-comment' && next) {
      options.feedbackComment = next;
      index += 1;
    } else if (token === '--feedback-tags' && next) {
      options.feedbackTags = next.split(',').map(item => item.trim()).filter(Boolean);
      index += 1;
    } else if (token === '--feedback-channel' && next) {
      options.feedbackChannel = next;
      index += 1;
    } else if (token === '--fail-on-gate-deny') {
      options.failOnGateDeny = true;
    } else if (token === '--fail-on-gate-non-allow') {
      options.failOnGateNonAllow = true;
    } else if (token === '--fail-on-execute-blocked') {
      options.failOnExecuteBlocked = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  options.input = `${options.input || ''}`.trim();
  options.provider = `${options.provider || ''}`.trim().toLowerCase() || DEFAULT_PROVIDER;
  options.goal = `${options.goal || ''}`.trim();
  options.goalFile = `${options.goalFile || ''}`.trim();
  options.userId = `${options.userId || ''}`.trim() || DEFAULT_USER_ID;
  options.sessionId = `${options.sessionId || ''}`.trim() || null;
  options.executionMode = `${options.executionMode || ''}`.trim() || 'suggestion';
  options.policy = `${options.policy || ''}`.trim() || null;
  options.catalog = `${options.catalog || ''}`.trim() || null;
  options.contextContract = `${options.contextContract || ''}`.trim() || null;
  options.moquiConfig = `${options.moquiConfig || ''}`.trim() || null;
  options.outDir = `${options.outDir || ''}`.trim() || DEFAULT_OUT_DIR;
  options.out = `${options.out || ''}`.trim() || null;
  options.loopOut = `${options.loopOut || ''}`.trim() || null;
  options.bridgeOutContext = `${options.bridgeOutContext || ''}`.trim() || null;
  options.bridgeOutReport = `${options.bridgeOutReport || ''}`.trim() || null;
  options.approvalActor = `${options.approvalActor || ''}`.trim() || null;
  options.approverActor = `${options.approverActor || ''}`.trim() || null;
  options.feedbackComment = `${options.feedbackComment || ''}`.trim() || null;
  options.feedbackChannel = `${options.feedbackChannel || ''}`.trim().toLowerCase() || DEFAULT_FEEDBACK_CHANNEL;
  options.feedbackTags = Array.from(new Set(options.feedbackTags.map(item => `${item || ''}`.trim().toLowerCase()).filter(Boolean)));

  if (!options.input) {
    throw new Error('--input is required.');
  }
  if (!options.goal && !options.goalFile) {
    throw new Error('either --goal or --goal-file is required.');
  }
  if (!['moqui', 'generic'].includes(options.provider)) {
    throw new Error('--provider must be one of: moqui, generic');
  }
  if (!['suggestion', 'apply'].includes(options.executionMode)) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }
  if (options.feedbackScore != null) {
    if (!Number.isFinite(options.feedbackScore) || options.feedbackScore < 0 || options.feedbackScore > 5) {
      throw new Error('--feedback-score must be between 0 and 5.');
    }
  }
  if (!FEEDBACK_CHANNELS.has(options.feedbackChannel)) {
    throw new Error(`--feedback-channel must be one of: ${Array.from(FEEDBACK_CHANNELS).join(', ')}`);
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-flow.js --input <path> (--goal <text> | --goal-file <path>) [options]',
    '',
    'Pipeline:',
    '  context-bridge -> interactive-loop',
    '',
    'Options:',
    '  --input <path>                  Raw provider payload JSON path (required)',
    `  --provider <name>               Provider dialect (moqui|generic, default: ${DEFAULT_PROVIDER})`,
    '  --goal <text>                   Business goal text',
    '  --goal-file <path>              File containing business goal text',
    `  --user-id <id>                  User identifier (default: ${DEFAULT_USER_ID})`,
    '  --session-id <id>               Session id (default: auto-generated)',
    '  --execution-mode <mode>         suggestion|apply (default: suggestion)',
    '  --policy <path>                 Guardrail policy override',
    '  --catalog <path>                High-risk catalog override',
    '  --context-contract <path>       Context contract override',
    '  --no-strict-contract            Do not fail when context contract validation has issues',
    '  --moqui-config <path>           Moqui adapter runtime config',
    `  --out-dir <path>                Flow artifact root (default: ${DEFAULT_OUT_DIR})`,
    '  --bridge-out-context <path>     Bridge normalized context output path',
    '  --bridge-out-report <path>      Bridge report output path',
    '  --loop-out <path>               Interactive-loop summary output path',
    '  --out <path>                    Flow summary output path',
    '  --approval-actor <id>           Approval workflow actor',
    '  --approver-actor <id>           Auto-approve actor',
    '  --skip-submit                   Skip approval submit step',
    '  --auto-approve-low-risk         Auto-approve low-risk allow plans',
    '  --auto-execute-low-risk         Auto-run low-risk apply for allow+low plans',
    '  --allow-suggestion-apply        Allow applying plans generated in suggestion mode',
    '  --live-apply                    Enable live apply mode',
    '  --no-dry-run                    Disable dry-run simulation',
    '  --feedback-score <0..5>         Optional feedback score',
    '  --feedback-comment <text>       Optional feedback comment',
    '  --feedback-tags <csv>           Optional feedback tags',
    `  --feedback-channel <name>       ui|cli|api|other (default: ${DEFAULT_FEEDBACK_CHANNEL})`,
    '  --fail-on-gate-deny             Exit code 2 if gate decision is deny',
    '  --fail-on-gate-non-allow        Exit code 2 if gate decision is deny/review-required',
    '  --fail-on-execute-blocked       Exit code 2 if auto execute is blocked/non-success',
    '  --json                          Print flow payload as JSON',
    '  -h, --help                      Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function normalizeSessionId(value) {
  const raw = `${value || ''}`.trim();
  if (raw.length > 0) {
    return raw.replace(/[^\w.-]/g, '-');
  }
  return `session-${crypto.randomUUID()}`;
}

function toRelative(cwd, absolutePath) {
  return path.relative(cwd, absolutePath) || '.';
}

function parseJsonOutput(text, label) {
  const raw = `${text || ''}`.trim();
  if (!raw) {
    throw new Error(`${label} produced empty stdout`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function runScript(label, scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8'
  });
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    stdout: `${result.stdout || ''}`,
    stderr: `${result.stderr || ''}`,
    error: result.error || null,
    command: [process.execPath, scriptPath, ...args].join(' ')
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const sessionId = normalizeSessionId(options.sessionId);
  const outRoot = resolvePath(cwd, options.outDir);
  const sessionDir = path.join(outRoot, sessionId);

  const bridgeOutContextPath = options.bridgeOutContext
    ? resolvePath(cwd, options.bridgeOutContext)
    : path.join(sessionDir, 'interactive-page-context.normalized.json');
  const bridgeOutReportPath = options.bridgeOutReport
    ? resolvePath(cwd, options.bridgeOutReport)
    : path.join(sessionDir, 'interactive-context-bridge.json');
  const loopOutPath = options.loopOut
    ? resolvePath(cwd, options.loopOut)
    : path.join(sessionDir, 'interactive-customization-loop.summary.json');
  const flowOutPath = options.out
    ? resolvePath(cwd, options.out)
    : path.join(sessionDir, 'interactive-flow.summary.json');

  await fs.ensureDir(sessionDir);

  const inputPath = resolvePath(cwd, options.input);
  const bridgeArgs = [
    '--input', inputPath,
    '--provider', options.provider,
    '--out-context', bridgeOutContextPath,
    '--out-report', bridgeOutReportPath,
    '--json'
  ];
  if (options.contextContract) {
    bridgeArgs.push('--context-contract', resolvePath(cwd, options.contextContract));
  }
  if (!options.strictContract) {
    bridgeArgs.push('--no-strict-contract');
  }

  const bridgeResult = runScript('interactive-context-bridge', SCRIPT_CONTEXT_BRIDGE, bridgeArgs, cwd);
  if (bridgeResult.error) {
    throw new Error(`interactive-context-bridge failed: ${bridgeResult.error.message}`);
  }
  if (bridgeResult.exitCode !== 0) {
    const stderr = bridgeResult.stderr.trim();
    throw new Error(
      `interactive-context-bridge failed with exit code ${bridgeResult.exitCode}${stderr ? `: ${stderr}` : ''}`
    );
  }
  const bridgePayload = parseJsonOutput(bridgeResult.stdout, 'interactive-context-bridge');

  const loopArgs = [
    '--context', bridgeOutContextPath,
    '--execution-mode', options.executionMode,
    '--user-id', options.userId,
    '--session-id', sessionId,
    '--out', loopOutPath,
    '--json'
  ];
  if (options.goal) {
    loopArgs.push('--goal', options.goal);
  } else {
    loopArgs.push('--goal-file', resolvePath(cwd, options.goalFile));
  }
  if (options.policy) {
    loopArgs.push('--policy', resolvePath(cwd, options.policy));
  }
  if (options.catalog) {
    loopArgs.push('--catalog', resolvePath(cwd, options.catalog));
  }
  if (options.contextContract) {
    loopArgs.push('--context-contract', resolvePath(cwd, options.contextContract));
  }
  if (!options.strictContract) {
    loopArgs.push('--no-strict-contract');
  }
  if (options.moquiConfig) {
    loopArgs.push('--moqui-config', resolvePath(cwd, options.moquiConfig));
  }
  if (options.approvalActor) {
    loopArgs.push('--approval-actor', options.approvalActor);
  }
  if (options.approverActor) {
    loopArgs.push('--approver-actor', options.approverActor);
  }
  if (options.skipSubmit) {
    loopArgs.push('--skip-submit');
  }
  if (options.autoApproveLowRisk) {
    loopArgs.push('--auto-approve-low-risk');
  }
  if (options.autoExecuteLowRisk) {
    loopArgs.push('--auto-execute-low-risk');
  }
  if (options.allowSuggestionApply) {
    loopArgs.push('--allow-suggestion-apply');
  }
  if (options.liveApply) {
    loopArgs.push('--live-apply');
  }
  if (!options.dryRun) {
    loopArgs.push('--no-dry-run');
  }
  if (options.feedbackScore != null) {
    loopArgs.push('--feedback-score', String(options.feedbackScore));
  }
  if (options.feedbackComment) {
    loopArgs.push('--feedback-comment', options.feedbackComment);
  }
  if (options.feedbackTags.length > 0) {
    loopArgs.push('--feedback-tags', options.feedbackTags.join(','));
  }
  if (options.feedbackChannel) {
    loopArgs.push('--feedback-channel', options.feedbackChannel);
  }
  if (options.failOnGateDeny) {
    loopArgs.push('--fail-on-gate-deny');
  }
  if (options.failOnGateNonAllow) {
    loopArgs.push('--fail-on-gate-non-allow');
  }
  if (options.failOnExecuteBlocked) {
    loopArgs.push('--fail-on-execute-blocked');
  }

  const loopResult = runScript('interactive-customization-loop', SCRIPT_INTERACTIVE_LOOP, loopArgs, cwd);
  if (loopResult.error) {
    throw new Error(`interactive-customization-loop failed: ${loopResult.error.message}`);
  }
  const loopPayload = parseJsonOutput(loopResult.stdout, 'interactive-customization-loop');

  const flowPayload = {
    mode: 'interactive-flow',
    generated_at: new Date().toISOString(),
    session_id: sessionId,
    provider: options.provider,
    pipeline: {
      bridge: {
        exit_code: bridgeResult.exitCode,
        command: bridgeResult.command,
        payload: bridgePayload
      },
      loop: {
        exit_code: loopResult.exitCode,
        command: loopResult.command,
        payload: loopPayload
      }
    },
    summary: {
      status: loopPayload && loopPayload.summary ? loopPayload.summary.status : null,
      gate_decision: loopPayload && loopPayload.gate ? loopPayload.gate.decision : null,
      execution_result: loopPayload && loopPayload.execution ? loopPayload.execution.result : null
    },
    artifacts: {
      input: toRelative(cwd, inputPath),
      bridge_context_json: toRelative(cwd, bridgeOutContextPath),
      bridge_report_json: toRelative(cwd, bridgeOutReportPath),
      loop_summary_json: toRelative(cwd, loopOutPath),
      flow_summary_json: toRelative(cwd, flowOutPath)
    }
  };

  await fs.ensureDir(path.dirname(flowOutPath));
  await fs.writeJson(flowOutPath, flowPayload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(flowPayload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive flow completed.\n');
    process.stdout.write(`- Session: ${flowPayload.session_id}\n`);
    process.stdout.write(`- Status: ${flowPayload.summary.status || 'unknown'}\n`);
    process.stdout.write(`- Gate decision: ${flowPayload.summary.gate_decision || 'n/a'}\n`);
    process.stdout.write(`- Bridge context: ${flowPayload.artifacts.bridge_context_json}\n`);
    process.stdout.write(`- Flow summary: ${flowPayload.artifacts.flow_summary_json}\n`);
  }

  if (loopResult.exitCode !== 0) {
    process.exitCode = loopResult.exitCode;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive flow failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_PROVIDER,
  DEFAULT_OUT_DIR,
  DEFAULT_USER_ID,
  parseArgs,
  resolvePath,
  normalizeSessionId,
  parseJsonOutput,
  runScript,
  main
};
