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
const DEFAULT_MATRIX_SIGNALS = '.kiro/reports/interactive-matrix-signals.jsonl';
const DEFAULT_MATRIX_MIN_SCORE = 70;
const DEFAULT_MATRIX_MIN_VALID_RATE = 100;
const DEFAULT_AUTH_PASSWORD_HASH_ENV = 'SCE_INTERACTIVE_AUTH_PASSWORD_SHA256';
const FEEDBACK_CHANNELS = new Set(['ui', 'cli', 'api', 'other']);
const DEFAULT_RUNTIME_MODE = 'ops-fix';
const DEFAULT_RUNTIME_ENVIRONMENT = 'staging';
const RUNTIME_MODES = new Set(['user-assist', 'ops-fix', 'feature-dev']);
const RUNTIME_ENVIRONMENTS = new Set(['dev', 'staging', 'prod']);

const SCRIPT_CONTEXT_BRIDGE = path.resolve(__dirname, 'interactive-context-bridge.js');
const SCRIPT_INTERACTIVE_LOOP = path.resolve(__dirname, 'interactive-customization-loop.js');
const SCRIPT_MOQUI_BASELINE = path.resolve(__dirname, 'moqui-template-baseline-report.js');

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
    dialoguePolicy: null,
    dialogueOut: null,
    runtimeMode: DEFAULT_RUNTIME_MODE,
    runtimeEnvironment: DEFAULT_RUNTIME_ENVIRONMENT,
    runtimePolicy: null,
    runtimeOut: null,
    contextContract: null,
    strictContract: true,
    moquiConfig: null,
    outDir: DEFAULT_OUT_DIR,
    out: null,
    loopOut: null,
    workOrderOut: null,
    workOrderMarkdownOut: null,
    bridgeOutContext: null,
    bridgeOutReport: null,
    approvalActor: null,
    approvalActorRole: null,
    approverActor: null,
    approverActorRole: null,
    approvalRolePolicy: null,
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
    authPassword: null,
    authPasswordHash: null,
    authPasswordEnv: null,
    failOnDialogueDeny: false,
    failOnGateDeny: false,
    failOnGateNonAllow: false,
    failOnRuntimeNonAllow: false,
    failOnExecuteBlocked: false,
    matrix: true,
    matrixTemplateDir: null,
    matrixMatch: null,
    matrixIncludeAll: false,
    matrixMinScore: DEFAULT_MATRIX_MIN_SCORE,
    matrixMinValidRate: DEFAULT_MATRIX_MIN_VALID_RATE,
    matrixCompareWith: null,
    matrixOut: null,
    matrixMarkdownOut: null,
    matrixSignals: DEFAULT_MATRIX_SIGNALS,
    matrixFailOnPortfolioFail: false,
    matrixFailOnRegression: false,
    matrixFailOnError: false,
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
    } else if (token === '--dialogue-policy' && next) {
      options.dialoguePolicy = next;
      index += 1;
    } else if (token === '--dialogue-out' && next) {
      options.dialogueOut = next;
      index += 1;
    } else if (token === '--runtime-mode' && next) {
      options.runtimeMode = next;
      index += 1;
    } else if (token === '--runtime-environment' && next) {
      options.runtimeEnvironment = next;
      index += 1;
    } else if (token === '--runtime-policy' && next) {
      options.runtimePolicy = next;
      index += 1;
    } else if (token === '--runtime-out' && next) {
      options.runtimeOut = next;
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
    } else if (token === '--work-order-out' && next) {
      options.workOrderOut = next;
      index += 1;
    } else if (token === '--work-order-markdown-out' && next) {
      options.workOrderMarkdownOut = next;
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
    } else if (token === '--approval-actor-role' && next) {
      options.approvalActorRole = next;
      index += 1;
    } else if (token === '--approver-actor' && next) {
      options.approverActor = next;
      index += 1;
    } else if (token === '--approver-actor-role' && next) {
      options.approverActorRole = next;
      index += 1;
    } else if (token === '--approval-role-policy' && next) {
      options.approvalRolePolicy = next;
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
    } else if (token === '--auth-password' && next) {
      options.authPassword = next;
      index += 1;
    } else if (token === '--auth-password-hash' && next) {
      options.authPasswordHash = next;
      index += 1;
    } else if (token === '--auth-password-env' && next) {
      options.authPasswordEnv = next;
      index += 1;
    } else if (token === '--fail-on-dialogue-deny') {
      options.failOnDialogueDeny = true;
    } else if (token === '--fail-on-gate-deny') {
      options.failOnGateDeny = true;
    } else if (token === '--fail-on-gate-non-allow') {
      options.failOnGateNonAllow = true;
    } else if (token === '--fail-on-runtime-non-allow') {
      options.failOnRuntimeNonAllow = true;
    } else if (token === '--fail-on-execute-blocked') {
      options.failOnExecuteBlocked = true;
    } else if (token === '--no-matrix') {
      options.matrix = false;
    } else if (token === '--matrix-template-dir' && next) {
      options.matrixTemplateDir = next;
      index += 1;
    } else if (token === '--matrix-match' && next) {
      options.matrixMatch = next;
      index += 1;
    } else if (token === '--matrix-include-all') {
      options.matrixIncludeAll = true;
    } else if (token === '--matrix-min-score' && next) {
      options.matrixMinScore = Number(next);
      index += 1;
    } else if (token === '--matrix-min-valid-rate' && next) {
      options.matrixMinValidRate = Number(next);
      index += 1;
    } else if (token === '--matrix-compare-with' && next) {
      options.matrixCompareWith = next;
      index += 1;
    } else if (token === '--matrix-out' && next) {
      options.matrixOut = next;
      index += 1;
    } else if (token === '--matrix-markdown-out' && next) {
      options.matrixMarkdownOut = next;
      index += 1;
    } else if (token === '--matrix-signals' && next) {
      options.matrixSignals = next;
      index += 1;
    } else if (token === '--matrix-fail-on-portfolio-fail') {
      options.matrixFailOnPortfolioFail = true;
    } else if (token === '--matrix-fail-on-regression') {
      options.matrixFailOnRegression = true;
    } else if (token === '--matrix-fail-on-error') {
      options.matrixFailOnError = true;
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
  options.dialoguePolicy = `${options.dialoguePolicy || ''}`.trim() || null;
  options.dialogueOut = `${options.dialogueOut || ''}`.trim() || null;
  options.runtimeMode = `${options.runtimeMode || ''}`.trim().toLowerCase() || DEFAULT_RUNTIME_MODE;
  options.runtimeEnvironment = `${options.runtimeEnvironment || ''}`.trim().toLowerCase() || DEFAULT_RUNTIME_ENVIRONMENT;
  options.runtimePolicy = `${options.runtimePolicy || ''}`.trim() || null;
  options.runtimeOut = `${options.runtimeOut || ''}`.trim() || null;
  options.contextContract = `${options.contextContract || ''}`.trim() || null;
  options.moquiConfig = `${options.moquiConfig || ''}`.trim() || null;
  options.outDir = `${options.outDir || ''}`.trim() || DEFAULT_OUT_DIR;
  options.out = `${options.out || ''}`.trim() || null;
  options.loopOut = `${options.loopOut || ''}`.trim() || null;
  options.workOrderOut = `${options.workOrderOut || ''}`.trim() || null;
  options.workOrderMarkdownOut = `${options.workOrderMarkdownOut || ''}`.trim() || null;
  options.bridgeOutContext = `${options.bridgeOutContext || ''}`.trim() || null;
  options.bridgeOutReport = `${options.bridgeOutReport || ''}`.trim() || null;
  options.approvalActor = `${options.approvalActor || ''}`.trim() || null;
  options.approvalActorRole = `${options.approvalActorRole || ''}`.trim().toLowerCase() || null;
  options.approverActor = `${options.approverActor || ''}`.trim() || null;
  options.approverActorRole = `${options.approverActorRole || ''}`.trim().toLowerCase() || null;
  options.approvalRolePolicy = `${options.approvalRolePolicy || ''}`.trim() || null;
  options.feedbackComment = `${options.feedbackComment || ''}`.trim() || null;
  options.feedbackChannel = `${options.feedbackChannel || ''}`.trim().toLowerCase() || DEFAULT_FEEDBACK_CHANNEL;
  options.feedbackTags = Array.from(new Set(options.feedbackTags.map(item => `${item || ''}`.trim().toLowerCase()).filter(Boolean)));
  options.authPassword = options.authPassword == null ? null : `${options.authPassword}`;
  options.authPasswordHash = options.authPasswordHash == null
    ? null
    : `${options.authPasswordHash}`.trim().toLowerCase();
  options.authPasswordEnv = `${options.authPasswordEnv || ''}`.trim() || null;
  options.matrix = options.matrix !== false;
  options.matrixTemplateDir = `${options.matrixTemplateDir || ''}`.trim() || null;
  options.matrixMatch = `${options.matrixMatch || ''}`.trim() || null;
  options.matrixCompareWith = `${options.matrixCompareWith || ''}`.trim() || null;
  options.matrixOut = `${options.matrixOut || ''}`.trim() || null;
  options.matrixMarkdownOut = `${options.matrixMarkdownOut || ''}`.trim() || null;
  options.matrixSignals = `${options.matrixSignals || ''}`.trim() || DEFAULT_MATRIX_SIGNALS;

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
  if (!RUNTIME_MODES.has(options.runtimeMode)) {
    throw new Error(`--runtime-mode must be one of: ${Array.from(RUNTIME_MODES).join(', ')}`);
  }
  if (!RUNTIME_ENVIRONMENTS.has(options.runtimeEnvironment)) {
    throw new Error(`--runtime-environment must be one of: ${Array.from(RUNTIME_ENVIRONMENTS).join(', ')}`);
  }
  if (options.feedbackScore != null) {
    if (!Number.isFinite(options.feedbackScore) || options.feedbackScore < 0 || options.feedbackScore > 5) {
      throw new Error('--feedback-score must be between 0 and 5.');
    }
  }
  if (!FEEDBACK_CHANNELS.has(options.feedbackChannel)) {
    throw new Error(`--feedback-channel must be one of: ${Array.from(FEEDBACK_CHANNELS).join(', ')}`);
  }
  if (options.authPasswordHash != null && !/^[a-fA-F0-9]{64}$/.test(options.authPasswordHash)) {
    throw new Error('--auth-password-hash must be a sha256 hex string (64 chars).');
  }
  if (options.authPasswordEnv != null && `${options.authPasswordEnv || ''}`.trim().length === 0) {
    throw new Error('--auth-password-env cannot be empty.');
  }
  if (!Number.isFinite(options.matrixMinScore) || options.matrixMinScore < 0 || options.matrixMinScore > 100) {
    throw new Error('--matrix-min-score must be between 0 and 100.');
  }
  if (!Number.isFinite(options.matrixMinValidRate) || options.matrixMinValidRate < 0 || options.matrixMinValidRate > 100) {
    throw new Error('--matrix-min-valid-rate must be between 0 and 100.');
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
    '  --dialogue-policy <path>        Dialogue governance policy override',
    '  --dialogue-out <path>           Dialogue governance report output path',
    `  --runtime-mode <name>           user-assist|ops-fix|feature-dev (default: ${DEFAULT_RUNTIME_MODE})`,
    `  --runtime-environment <name>    dev|staging|prod (default: ${DEFAULT_RUNTIME_ENVIRONMENT})`,
    '  --runtime-policy <path>         Runtime mode/environment policy override',
    '  --runtime-out <path>            Runtime policy evaluation output path',
    '  --context-contract <path>       Context contract override',
    '  --no-strict-contract            Do not fail when context contract validation has issues',
    '  --moqui-config <path>           Moqui adapter runtime config',
    `  --out-dir <path>                Flow artifact root (default: ${DEFAULT_OUT_DIR})`,
    '  --bridge-out-context <path>     Bridge normalized context output path',
    '  --bridge-out-report <path>      Bridge report output path',
    '  --loop-out <path>               Interactive-loop summary output path',
    '  --work-order-out <path>         Work-order JSON output path',
    '  --work-order-markdown-out <path> Work-order markdown output path',
    '  --out <path>                    Flow summary output path',
    '  --approval-actor <id>           Approval workflow actor',
    '  --approval-actor-role <name>    Approval workflow actor role',
    '  --approver-actor <id>           Auto-approve actor',
    '  --approver-actor-role <name>    Auto-approve actor role',
    '  --approval-role-policy <path>   Approval role policy JSON path',
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
    '  --auth-password <text>          One-time password for protected execute action',
    '  --auth-password-hash <sha256>   Password verifier hash override',
    `  --auth-password-env <name>      Password hash env name (default: ${DEFAULT_AUTH_PASSWORD_HASH_ENV})`,
    '  --fail-on-dialogue-deny         Exit code 2 if dialogue decision is deny',
    '  --fail-on-gate-deny             Exit code 2 if gate decision is deny',
    '  --fail-on-gate-non-allow        Exit code 2 if gate decision is deny/review-required',
    '  --fail-on-runtime-non-allow     Exit code 2 if runtime decision is deny/review-required',
    '  --fail-on-execute-blocked       Exit code 2 if auto execute is blocked/non-success',
    '  --no-matrix                     Disable matrix baseline snapshot stage',
    '  --matrix-template-dir <path>    Template library path for matrix stage',
    '  --matrix-match <regex>          Matrix selector regex',
    '  --matrix-include-all            Score all templates in matrix stage',
    `  --matrix-min-score <0..100>     Matrix min semantic score (default: ${DEFAULT_MATRIX_MIN_SCORE})`,
    `  --matrix-min-valid-rate <0..100> Matrix min valid-rate (default: ${DEFAULT_MATRIX_MIN_VALID_RATE})`,
    '  --matrix-compare-with <path>    Previous matrix baseline report for regression comparison',
    '  --matrix-out <path>             Matrix JSON report output path',
    '  --matrix-markdown-out <path>    Matrix markdown report output path',
    `  --matrix-signals <path>         Matrix signal stream JSONL (default: ${DEFAULT_MATRIX_SIGNALS})`,
    '  --matrix-fail-on-portfolio-fail Exit non-zero when matrix portfolio gate fails',
    '  --matrix-fail-on-regression     Exit code 2 when matrix regressions are detected',
    '  --matrix-fail-on-error          Exit non-zero when matrix stage fails unexpectedly',
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

function tryParseJsonOutput(text) {
  const raw = `${text || ''}`.trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function buildCommandString(scriptPath, args, redactFlags = []) {
  const redacted = new Set(redactFlags);
  const maskedArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    maskedArgs.push(token);
    if (redacted.has(token)) {
      if (index + 1 < args.length) {
        maskedArgs.push('***');
        index += 1;
      }
    }
  }
  return [process.execPath, scriptPath, ...maskedArgs].join(' ');
}

function runScript(label, scriptPath, args, cwd, redactFlags = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8'
  });
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    stdout: `${result.stdout || ''}`,
    stderr: `${result.stderr || ''}`,
    error: result.error || null,
    command: buildCommandString(scriptPath, args, redactFlags)
  };
}

async function appendJsonLine(filePath, payload) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
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
  const matrixOutPath = options.matrixOut
    ? resolvePath(cwd, options.matrixOut)
    : path.join(sessionDir, 'moqui-template-baseline.json');
  const matrixMarkdownOutPath = options.matrixMarkdownOut
    ? resolvePath(cwd, options.matrixMarkdownOut)
    : path.join(sessionDir, 'moqui-template-baseline.md');
  const matrixSignalsPath = resolvePath(cwd, options.matrixSignals);
  const matrixSignalPath = path.join(sessionDir, 'interactive-matrix-signal.json');

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
  if (options.dialoguePolicy) {
    loopArgs.push('--dialogue-policy', resolvePath(cwd, options.dialoguePolicy));
  }
  if (options.dialogueOut) {
    loopArgs.push('--dialogue-out', resolvePath(cwd, options.dialogueOut));
  }
  if (options.runtimeMode) {
    loopArgs.push('--runtime-mode', options.runtimeMode);
  }
  if (options.runtimeEnvironment) {
    loopArgs.push('--runtime-environment', options.runtimeEnvironment);
  }
  if (options.runtimePolicy) {
    loopArgs.push('--runtime-policy', resolvePath(cwd, options.runtimePolicy));
  }
  if (options.runtimeOut) {
    loopArgs.push('--runtime-out', resolvePath(cwd, options.runtimeOut));
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
  if (options.workOrderOut) {
    loopArgs.push('--work-order-out', resolvePath(cwd, options.workOrderOut));
  }
  if (options.workOrderMarkdownOut) {
    loopArgs.push('--work-order-markdown-out', resolvePath(cwd, options.workOrderMarkdownOut));
  }
  if (options.approvalActor) {
    loopArgs.push('--approval-actor', options.approvalActor);
  }
  if (options.approvalActorRole) {
    loopArgs.push('--approval-actor-role', options.approvalActorRole);
  }
  if (options.approverActor) {
    loopArgs.push('--approver-actor', options.approverActor);
  }
  if (options.approverActorRole) {
    loopArgs.push('--approver-actor-role', options.approverActorRole);
  }
  if (options.approvalRolePolicy) {
    loopArgs.push('--approval-role-policy', resolvePath(cwd, options.approvalRolePolicy));
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
  if (options.authPassword) {
    loopArgs.push('--auth-password', options.authPassword);
  }
  if (options.authPasswordHash) {
    loopArgs.push('--auth-password-hash', options.authPasswordHash);
  }
  if (options.authPasswordEnv) {
    loopArgs.push('--auth-password-env', options.authPasswordEnv);
  }
  if (options.failOnDialogueDeny) {
    loopArgs.push('--fail-on-dialogue-deny');
  }
  if (options.failOnGateDeny) {
    loopArgs.push('--fail-on-gate-deny');
  }
  if (options.failOnGateNonAllow) {
    loopArgs.push('--fail-on-gate-non-allow');
  }
  if (options.failOnRuntimeNonAllow) {
    loopArgs.push('--fail-on-runtime-non-allow');
  }
  if (options.failOnExecuteBlocked) {
    loopArgs.push('--fail-on-execute-blocked');
  }

  const loopResult = runScript(
    'interactive-customization-loop',
    SCRIPT_INTERACTIVE_LOOP,
    loopArgs,
    cwd,
    ['--auth-password', '--auth-password-hash']
  );
  if (loopResult.error) {
    throw new Error(`interactive-customization-loop failed: ${loopResult.error.message}`);
  }
  const loopPayload = parseJsonOutput(loopResult.stdout, 'interactive-customization-loop');

  let matrixResult = null;
  let matrixPayload = null;
  let matrixSignal = null;
  let matrixStageStatus = 'skipped';
  if (options.matrix) {
    const matrixArgs = [
      '--out', matrixOutPath,
      '--markdown-out', matrixMarkdownOutPath,
      '--min-score', String(options.matrixMinScore),
      '--min-valid-rate', String(options.matrixMinValidRate),
      '--json'
    ];
    if (options.matrixTemplateDir) {
      matrixArgs.push('--template-dir', resolvePath(cwd, options.matrixTemplateDir));
    }
    if (options.matrixMatch) {
      matrixArgs.push('--match', options.matrixMatch);
    }
    if (options.matrixIncludeAll) {
      matrixArgs.push('--include-all');
    }
    if (options.matrixCompareWith) {
      matrixArgs.push('--compare-with', resolvePath(cwd, options.matrixCompareWith));
    }
    if (options.matrixFailOnPortfolioFail) {
      matrixArgs.push('--fail-on-portfolio-fail');
    }

    matrixResult = runScript('moqui-template-baseline', SCRIPT_MOQUI_BASELINE, matrixArgs, cwd);
    if (matrixResult.error) {
      matrixStageStatus = 'error';
      if (options.matrixFailOnError) {
        throw new Error(`moqui-template-baseline failed: ${matrixResult.error.message}`);
      }
    } else {
      matrixPayload = tryParseJsonOutput(matrixResult.stdout);
      matrixStageStatus = matrixResult.exitCode === 0 ? 'completed' : 'non-zero-exit';
      if (!matrixPayload && options.matrixFailOnError) {
        throw new Error('moqui-template-baseline returned invalid JSON payload.');
      }
      if (matrixPayload) {
        const summary = matrixPayload && matrixPayload.summary ? matrixPayload.summary : {};
        const compare = matrixPayload && matrixPayload.compare ? matrixPayload.compare : {};
        const regressions = Array.isArray(compare.coverage_matrix_regressions)
          ? compare.coverage_matrix_regressions
          : [];

        matrixSignal = {
          mode: 'interactive-matrix-signal',
          generated_at: new Date().toISOString(),
          session_id: sessionId,
          provider: options.provider,
          matrix: {
            stage_status: matrixStageStatus,
            exit_code: matrixResult.exitCode,
            scoped_templates: Number.isFinite(Number(summary.scoped_templates))
              ? Number(summary.scoped_templates)
              : null,
            portfolio_passed: summary.portfolio_passed === true,
            avg_score: Number.isFinite(Number(summary.avg_score))
              ? Number(summary.avg_score)
              : null,
            valid_rate_percent: Number.isFinite(Number(summary.valid_rate_percent))
              ? Number(summary.valid_rate_percent)
              : null,
            baseline_failed: Number.isFinite(Number(summary.baseline_failed))
              ? Number(summary.baseline_failed)
              : null,
            regression_count: regressions.length,
            regressions: regressions.map((item) => ({
              metric: item && item.metric ? String(item.metric) : null,
              delta_rate_percent: Number.isFinite(Number(item && item.delta_rate_percent))
                ? Number(item.delta_rate_percent)
                : null
            })),
            thresholds: {
              min_score: options.matrixMinScore,
              min_valid_rate_percent: options.matrixMinValidRate
            },
            compare_with: options.matrixCompareWith
              ? toRelative(cwd, resolvePath(cwd, options.matrixCompareWith))
              : null,
            output_json: toRelative(cwd, matrixOutPath),
            output_markdown: toRelative(cwd, matrixMarkdownOutPath)
          }
        };

        await fs.ensureDir(path.dirname(matrixSignalPath));
        await fs.writeJson(matrixSignalPath, matrixSignal, { spaces: 2 });
        await appendJsonLine(matrixSignalsPath, matrixSignal);
      }
    }
  }

  const matrixRegressionCount = matrixSignal && matrixSignal.matrix
    ? Number(matrixSignal.matrix.regression_count || 0)
    : null;
  const matrixPortfolioPassed = matrixSignal && matrixSignal.matrix
    ? matrixSignal.matrix.portfolio_passed === true
    : null;

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
      },
      matrix: {
        enabled: options.matrix,
        status: matrixStageStatus,
        exit_code: matrixResult ? matrixResult.exitCode : null,
        command: matrixResult ? matrixResult.command : null,
        payload: matrixPayload
      }
    },
    summary: {
      status: loopPayload && loopPayload.summary ? loopPayload.summary.status : null,
      dialogue_decision: loopPayload && loopPayload.dialogue ? loopPayload.dialogue.decision : null,
      gate_decision: loopPayload && loopPayload.gate ? loopPayload.gate.decision : null,
      runtime_decision: loopPayload && loopPayload.runtime ? loopPayload.runtime.decision : null,
      runtime_mode: loopPayload && loopPayload.runtime ? loopPayload.runtime.mode : null,
      runtime_environment: loopPayload && loopPayload.runtime ? loopPayload.runtime.environment : null,
      execution_result: loopPayload && loopPayload.execution ? loopPayload.execution.result : null,
      execution_reason: loopPayload && loopPayload.execution ? loopPayload.execution.reason || null : null,
      work_order_id: loopPayload && loopPayload.work_order ? loopPayload.work_order.work_order_id || null : null,
      work_order_status: loopPayload && loopPayload.work_order ? loopPayload.work_order.status || null : null,
      authorization_password_required: loopPayload && loopPayload.approval && loopPayload.approval.authorization
        ? loopPayload.approval.authorization.password_required === true
        : null,
      authorization_password_verified: loopPayload && loopPayload.approval && loopPayload.approval.authorization
        ? loopPayload.approval.authorization.password_verified === true
        : null,
      matrix_status: matrixStageStatus,
      matrix_portfolio_passed: matrixPortfolioPassed,
      matrix_regression_count: matrixRegressionCount
    },
    artifacts: {
      input: toRelative(cwd, inputPath),
      bridge_context_json: toRelative(cwd, bridgeOutContextPath),
      bridge_report_json: toRelative(cwd, bridgeOutReportPath),
      dialogue_json: loopPayload && loopPayload.artifacts ? loopPayload.artifacts.dialogue_json || null : null,
      runtime_json: loopPayload && loopPayload.artifacts ? loopPayload.artifacts.runtime_json || null : null,
      work_order_json: loopPayload && loopPayload.artifacts ? loopPayload.artifacts.work_order_json || null : null,
      work_order_markdown: loopPayload && loopPayload.artifacts ? loopPayload.artifacts.work_order_md || null : null,
      loop_summary_json: toRelative(cwd, loopOutPath),
      flow_summary_json: toRelative(cwd, flowOutPath),
      matrix_summary_json: options.matrix ? toRelative(cwd, matrixOutPath) : null,
      matrix_summary_markdown: options.matrix ? toRelative(cwd, matrixMarkdownOutPath) : null,
      matrix_signal_json: options.matrix && matrixSignal ? toRelative(cwd, matrixSignalPath) : null,
      matrix_signals_jsonl: options.matrix && matrixSignal ? toRelative(cwd, matrixSignalsPath) : null
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
    process.stdout.write(`- Dialogue decision: ${flowPayload.summary.dialogue_decision || 'n/a'}\n`);
    process.stdout.write(`- Gate decision: ${flowPayload.summary.gate_decision || 'n/a'}\n`);
    process.stdout.write(`- Runtime decision: ${flowPayload.summary.runtime_decision || 'n/a'}\n`);
    process.stdout.write(`- Work-order: ${flowPayload.summary.work_order_status || 'n/a'} (${flowPayload.summary.work_order_id || 'n/a'})\n`);
    if (options.matrix) {
      process.stdout.write(`- Matrix status: ${flowPayload.summary.matrix_status || 'unknown'}\n`);
      process.stdout.write(`- Matrix portfolio pass: ${flowPayload.summary.matrix_portfolio_passed === true ? 'yes' : 'no'}\n`);
      process.stdout.write(`- Matrix regressions: ${flowPayload.summary.matrix_regression_count == null ? 'n/a' : flowPayload.summary.matrix_regression_count}\n`);
    }
    process.stdout.write(`- Bridge context: ${flowPayload.artifacts.bridge_context_json}\n`);
    process.stdout.write(`- Flow summary: ${flowPayload.artifacts.flow_summary_json}\n`);
  }

  let finalExitCode = 0;
  if (loopResult.exitCode !== 0) {
    finalExitCode = loopResult.exitCode;
  }

  if (options.matrix) {
    if (matrixResult && matrixResult.error && options.matrixFailOnError && finalExitCode === 0) {
      finalExitCode = 2;
    }
    if (matrixResult && !matrixResult.error && finalExitCode === 0) {
      if (options.matrixFailOnError && matrixResult.exitCode !== 0) {
        finalExitCode = matrixResult.exitCode;
      } else if (options.matrixFailOnPortfolioFail && matrixResult.exitCode !== 0) {
        finalExitCode = matrixResult.exitCode;
      }
      if (options.matrixFailOnRegression && Number(matrixRegressionCount) > 0 && finalExitCode === 0) {
        finalExitCode = 2;
      }
    }
  }

  if (finalExitCode !== 0) {
    process.exitCode = finalExitCode;
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
  DEFAULT_RUNTIME_MODE,
  DEFAULT_RUNTIME_ENVIRONMENT,
  RUNTIME_MODES,
  RUNTIME_ENVIRONMENTS,
  parseArgs,
  resolvePath,
  normalizeSessionId,
  parseJsonOutput,
  tryParseJsonOutput,
  buildCommandString,
  runScript,
  appendJsonLine,
  main
};
