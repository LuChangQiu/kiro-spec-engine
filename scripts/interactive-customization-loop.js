#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DEFAULT_OUT_DIR = '.kiro/reports/interactive-loop';
const DEFAULT_USER_ID = 'anonymous-user';
const DEFAULT_APPROVAL_ACTOR = 'workflow-operator';
const DEFAULT_FEEDBACK_CHANNEL = 'ui';
const DEFAULT_AUTH_PASSWORD_HASH_ENV = 'SCE_INTERACTIVE_AUTH_PASSWORD_SHA256';
const DEFAULT_RUNTIME_MODE = 'ops-fix';
const DEFAULT_RUNTIME_ENVIRONMENT = 'staging';
const DEFAULT_DIALOGUE_PROFILE = 'business-user';
const FEEDBACK_CHANNELS = new Set(['ui', 'cli', 'api', 'other']);
const RUNTIME_MODES = new Set(['user-assist', 'ops-fix', 'feature-dev']);
const RUNTIME_ENVIRONMENTS = new Set(['dev', 'staging', 'prod']);
const DIALOGUE_PROFILES = new Set(['business-user', 'system-maintainer']);

const SCRIPT_DIALOGUE = path.resolve(__dirname, 'interactive-dialogue-governance.js');
const SCRIPT_INTENT = path.resolve(__dirname, 'interactive-intent-build.js');
const SCRIPT_PLAN = path.resolve(__dirname, 'interactive-plan-build.js');
const SCRIPT_GATE = path.resolve(__dirname, 'interactive-change-plan-gate.js');
const SCRIPT_RUNTIME = path.resolve(__dirname, 'interactive-runtime-policy-evaluate.js');
const SCRIPT_APPROVAL = path.resolve(__dirname, 'interactive-approval-workflow.js');
const SCRIPT_ADAPTER = path.resolve(__dirname, 'interactive-moqui-adapter.js');
const SCRIPT_FEEDBACK = path.resolve(__dirname, 'interactive-feedback-log.js');
const SCRIPT_WORK_ORDER = path.resolve(__dirname, 'interactive-work-order-build.js');

function parseArgs(argv) {
  const options = {
    context: null,
    goal: null,
    goalFile: null,
    userId: DEFAULT_USER_ID,
    sessionId: null,
    executionMode: 'suggestion',
    policy: null,
    catalog: null,
    dialoguePolicy: null,
    dialogueProfile: DEFAULT_DIALOGUE_PROFILE,
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
    workOrderOut: null,
    workOrderMarkdownOut: null,
    approvalActor: DEFAULT_APPROVAL_ACTOR,
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
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--context' && next) {
      options.context = next;
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
    } else if (token === '--dialogue-profile' && next) {
      options.dialogueProfile = next;
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
    } else if (token === '--work-order-out' && next) {
      options.workOrderOut = next;
      index += 1;
    } else if (token === '--work-order-markdown-out' && next) {
      options.workOrderMarkdownOut = next;
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
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.context) {
    throw new Error('--context is required.');
  }
  if (!options.goal && !options.goalFile) {
    throw new Error('either --goal or --goal-file is required.');
  }
  if (!['suggestion', 'apply'].includes(`${options.executionMode || ''}`.trim())) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }
  if (!RUNTIME_MODES.has(`${options.runtimeMode || ''}`.trim().toLowerCase())) {
    throw new Error(`--runtime-mode must be one of: ${Array.from(RUNTIME_MODES).join(', ')}`);
  }
  if (!RUNTIME_ENVIRONMENTS.has(`${options.runtimeEnvironment || ''}`.trim().toLowerCase())) {
    throw new Error(`--runtime-environment must be one of: ${Array.from(RUNTIME_ENVIRONMENTS).join(', ')}`);
  }
  if (options.feedbackScore != null) {
    if (!Number.isFinite(options.feedbackScore) || options.feedbackScore < 0 || options.feedbackScore > 5) {
      throw new Error('--feedback-score must be between 0 and 5.');
    }
  }
  if (options.authPasswordHash != null) {
    const normalizedHash = `${options.authPasswordHash || ''}`.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(normalizedHash)) {
      throw new Error('--auth-password-hash must be a sha256 hex string (64 chars).');
    }
  }
  if (options.authPasswordEnv != null && `${options.authPasswordEnv || ''}`.trim().length === 0) {
    throw new Error('--auth-password-env cannot be empty.');
  }

  options.userId = `${options.userId || ''}`.trim() || DEFAULT_USER_ID;
  options.approvalActor = `${options.approvalActor || ''}`.trim() || DEFAULT_APPROVAL_ACTOR;
  options.approvalActorRole = `${options.approvalActorRole || ''}`.trim().toLowerCase() || null;
  options.approverActor = `${options.approverActor || ''}`.trim() || options.approvalActor;
  options.approverActorRole = `${options.approverActorRole || ''}`.trim().toLowerCase() || options.approvalActorRole;
  options.approvalRolePolicy = `${options.approvalRolePolicy || ''}`.trim() || null;
  options.feedbackComment = `${options.feedbackComment || ''}`.trim() || null;
  options.dialoguePolicy = `${options.dialoguePolicy || ''}`.trim() || null;
  options.dialogueProfile = `${options.dialogueProfile || ''}`.trim().toLowerCase() || DEFAULT_DIALOGUE_PROFILE;
  options.dialogueOut = `${options.dialogueOut || ''}`.trim() || null;
  options.runtimeMode = `${options.runtimeMode || ''}`.trim().toLowerCase() || DEFAULT_RUNTIME_MODE;
  options.runtimeEnvironment = `${options.runtimeEnvironment || ''}`.trim().toLowerCase() || DEFAULT_RUNTIME_ENVIRONMENT;
  options.runtimePolicy = `${options.runtimePolicy || ''}`.trim() || null;
  options.runtimeOut = `${options.runtimeOut || ''}`.trim() || null;
  options.feedbackChannel = `${options.feedbackChannel || ''}`.trim().toLowerCase() || DEFAULT_FEEDBACK_CHANNEL;
  options.authPassword = options.authPassword == null ? null : `${options.authPassword}`;
  options.authPasswordHash = options.authPasswordHash == null
    ? null
    : `${options.authPasswordHash}`.trim().toLowerCase();
  options.authPasswordEnv = `${options.authPasswordEnv || ''}`.trim() || null;
  options.workOrderOut = `${options.workOrderOut || ''}`.trim() || null;
  options.workOrderMarkdownOut = `${options.workOrderMarkdownOut || ''}`.trim() || null;
  if (!FEEDBACK_CHANNELS.has(options.feedbackChannel)) {
    throw new Error(`--feedback-channel must be one of: ${Array.from(FEEDBACK_CHANNELS).join(', ')}`);
  }
  options.feedbackTags = Array.from(new Set(options.feedbackTags.map(item => item.toLowerCase())));
  if (!DIALOGUE_PROFILES.has(options.dialogueProfile)) {
    throw new Error(`--dialogue-profile must be one of: ${Array.from(DIALOGUE_PROFILES).join(', ')}`);
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-customization-loop.js --context <path> (--goal <text> | --goal-file <path>) [options]',
    '',
    'Pipeline:',
    '  dialogue -> intent -> plan -> gate -> approval(init/submit) -> optional low-risk apply',
    '',
    'Options:',
    '  --context <path>                 Page context JSON file (required)',
    '  --goal <text>                    Business goal text',
    '  --goal-file <path>               File containing business goal text',
    `  --user-id <id>                   User identifier (default: ${DEFAULT_USER_ID})`,
    '  --session-id <id>                Session id (default: auto-generated)',
    '  --execution-mode <mode>          suggestion|apply (default: suggestion)',
    '  --policy <path>                  Guardrail policy override',
    '  --catalog <path>                 High-risk catalog override',
    '  --dialogue-policy <path>         Dialogue governance policy override',
    `  --dialogue-profile <name>        business-user|system-maintainer (default: ${DEFAULT_DIALOGUE_PROFILE})`,
    '  --dialogue-out <path>            Dialogue governance report output path',
    `  --runtime-mode <name>            user-assist|ops-fix|feature-dev (default: ${DEFAULT_RUNTIME_MODE})`,
    `  --runtime-environment <name>     dev|staging|prod (default: ${DEFAULT_RUNTIME_ENVIRONMENT})`,
    '  --runtime-policy <path>          Runtime mode/environment policy override',
    '  --runtime-out <path>             Runtime policy evaluation report output path',
    '  --context-contract <path>        Context contract override for intent build',
    '  --no-strict-contract             Do not fail when context contract validation has issues',
    '  --moqui-config <path>            Moqui adapter runtime config',
    `  --out-dir <path>                 Loop artifact root (default: ${DEFAULT_OUT_DIR})`,
    '  --out <path>                     Loop summary JSON output path',
    '  --work-order-out <path>          Work-order JSON output path',
    '  --work-order-markdown-out <path> Work-order markdown output path',
    `  --approval-actor <id>            Approval workflow actor (default: ${DEFAULT_APPROVAL_ACTOR})`,
    '  --approval-actor-role <name>     Approval actor role for role-policy checks',
    '  --approver-actor <id>            Auto-approve actor (default: approval actor)',
    '  --approver-actor-role <name>     Auto-approve actor role (default: approval actor role)',
    '  --approval-role-policy <path>    Approval role policy JSON path',
    '  --skip-submit                    Skip approval submit step',
    '  --auto-approve-low-risk          Auto-approve when gate=allow and risk=low',
    '  --auto-execute-low-risk          Auto-run adapter low-risk-apply when gate=allow and risk=low',
    '  --allow-suggestion-apply         Allow applying plans with execution_mode=suggestion',
    '  --live-apply                     Enable live apply mode for adapter',
    '  --no-dry-run                     Disable dry-run simulation when live apply is enabled',
    '  --feedback-score <0..5>          Optional user feedback score to append into feedback JSONL',
    '  --feedback-comment <text>        Optional user feedback comment',
    '  --feedback-tags <csv>            Optional feedback tags (comma-separated)',
    `  --feedback-channel <name>        ui|cli|api|other (default: ${DEFAULT_FEEDBACK_CHANNEL})`,
    '  --auth-password <text>           One-time password for protected execute action',
    '  --auth-password-hash <sha256>    Password verifier hash override',
    `  --auth-password-env <name>       Password hash env name (default: ${DEFAULT_AUTH_PASSWORD_HASH_ENV})`,
    '  --fail-on-dialogue-deny          Exit code 2 if dialogue decision is deny',
    '  --fail-on-gate-deny              Exit code 2 if gate decision is deny',
    '  --fail-on-gate-non-allow         Exit code 2 if gate decision is deny/review-required',
    '  --fail-on-runtime-non-allow      Exit code 2 if runtime decision is deny/review-required',
    '  --fail-on-execute-blocked        Exit code 2 if auto execute result is blocked/non-success',
    '  --json                           Print loop summary JSON',
    '  -h, --help                       Show this help'
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

function runScript({
  label,
  scriptPath,
  args,
  cwd,
  allowedExitCodes
}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8'
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;

  if (!allowedExitCodes.includes(exitCode)) {
    const stderr = `${result.stderr || ''}`.trim();
    throw new Error(
      `${label} failed with exit code ${exitCode}${stderr ? `: ${stderr}` : ''}`
    );
  }

  return {
    exit_code: exitCode,
    stdout: `${result.stdout || ''}`,
    stderr: `${result.stderr || ''}`
  };
}

function toRelative(cwd, absolutePath) {
  return path.relative(cwd, absolutePath) || '.';
}

function buildStep(name, payload, command, exitCode) {
  return {
    name,
    command,
    exit_code: exitCode,
    payload
  };
}

function shouldAutoLowRisk({
  gateDecision,
  riskLevel,
  dialogueDecision,
  runtimeDecision,
  runtimeAutoExecuteAllowed
}) {
  return `${dialogueDecision || ''}`.trim().toLowerCase() !== 'deny' &&
    `${gateDecision || ''}`.trim().toLowerCase() === 'allow' &&
    `${riskLevel || ''}`.trim().toLowerCase() === 'low' &&
    `${runtimeDecision || ''}`.trim().toLowerCase() === 'allow' &&
    runtimeAutoExecuteAllowed === true;
}

function buildSummaryStatus({
  dialogueDecision,
  gateDecision,
  runtimeDecision,
  executionAttempted,
  executionBlocked,
  executionResult
}) {
  const normalizedDialogueDecision = `${dialogueDecision || ''}`.trim().toLowerCase();
  const decision = `${gateDecision || ''}`.trim().toLowerCase();
  const runtime = `${runtimeDecision || ''}`.trim().toLowerCase();
  if (normalizedDialogueDecision === 'deny') {
    return 'blocked';
  }
  if (runtime === 'deny') {
    return 'blocked';
  }
  if (runtime === 'review-required') {
    return 'requires-review';
  }
  if (normalizedDialogueDecision === 'clarify' && decision === 'allow' && !executionAttempted) {
    return 'requires-clarification';
  }
  if (decision === 'deny') {
    return 'blocked';
  }
  if (decision === 'review-required') {
    return 'requires-review';
  }
  if (!executionAttempted) {
    return 'ready-for-apply';
  }
  if (executionBlocked) {
    return 'apply-blocked';
  }
  if (`${executionResult || ''}`.trim().toLowerCase() === 'success') {
    return 'completed';
  }
  return 'apply-finished-with-risk';
}

function detectExecutionBlockReasonCategory(execution) {
  if (!execution || execution.blocked !== true) {
    return null;
  }
  const reason = `${execution.reason || ''}`.trim().toLowerCase();
  const decision = `${execution.decision || ''}`.trim().toLowerCase();

  if (reason.includes('password authorization')) {
    return 'password-authorization';
  }
  if (reason.includes('actor role') || reason.includes('allowed roles')) {
    return 'role-policy';
  }
  if (decision === 'runtime-blocked' || reason.includes('runtime environment')) {
    return 'runtime-policy';
  }
  if (decision === 'approval-blocked') {
    return 'approval-policy';
  }
  return 'unknown';
}

function buildExecutionBlockRemediationHint({
  blockReasonCategory,
  executionReason
}) {
  if (!blockReasonCategory) {
    return null;
  }
  if (blockReasonCategory === 'password-authorization') {
    return 'Provide one-time password authorization and rerun apply.';
  }
  if (blockReasonCategory === 'role-policy') {
    return 'Use an actor role allowed by approval role policy for this action and rerun apply.';
  }
  if (blockReasonCategory === 'runtime-policy') {
    return 'Adjust runtime mode/environment policy or run under an environment that permits the action.';
  }
  if (blockReasonCategory === 'approval-policy') {
    return 'Complete required approval workflow transitions before execute.';
  }
  if (`${executionReason || ''}`.trim().length > 0) {
    return `Review execution block reason: ${executionReason}`;
  }
  return 'Review execution block reason and approval/runtime policies.';
}

function buildNextActions({
  dialogueDecision,
  gateDecision,
  runtimeDecision,
  riskLevel,
  runtime,
  autoExecuteTriggered,
  executionPayload,
  executionBlockReasonCategory,
  executionReason,
  approvalStatus,
  feedbackLogged,
  artifacts
}) {
  const actions = [];
  const dialogue = `${dialogueDecision || ''}`.trim().toLowerCase();
  const decision = `${gateDecision || ''}`.trim().toLowerCase();
  const runtimeDecisionNormalized = `${runtimeDecision || ''}`.trim().toLowerCase();
  const risk = `${riskLevel || ''}`.trim().toLowerCase();

  if (dialogue === 'deny') {
    actions.push('Rewrite the goal to remove sensitive/forbidden requests and rerun dialogue governance.');
    actions.push(`node scripts/interactive-dialogue-governance.js --goal "..." --context ${artifacts.context_json} --json`);
  } else if (runtimeDecisionNormalized === 'deny') {
    actions.push('Runtime policy denied the plan. Switch runtime mode/environment or reduce risky actions.');
    actions.push(`node scripts/interactive-runtime-policy-evaluate.js --plan ${artifacts.plan_json} --runtime-mode ${runtime.mode || DEFAULT_RUNTIME_MODE} --runtime-environment ${runtime.environment || DEFAULT_RUNTIME_ENVIRONMENT} --json`);
  } else if (runtimeDecisionNormalized === 'review-required') {
    actions.push('Runtime policy requires manual review before apply.');
    actions.push('Complete review ticket and approval workflow before any execution step.');
  } else if (decision === 'deny') {
    actions.push('Revise business goal wording and regenerate intent/plan before retrying.');
    actions.push('Review gate failure reasons in the generated gate markdown report.');
  } else if (decision === 'review-required') {
    actions.push('Complete manual approval review before any apply step.');
    actions.push('Tune plan actions to reduce sensitive or high-risk operations.');
  } else if (!autoExecuteTriggered) {
    actions.push('Review plan and gate outputs, then run adapter low-risk apply when ready.');
    actions.push(`node scripts/interactive-moqui-adapter.js --action low-risk-apply --plan ${artifacts.plan_json} --json`);
  } else if (executionPayload && executionPayload.execution_record) {
    const record = executionPayload.execution_record;
    if (`${record.result || ''}`.trim().toLowerCase() === 'success') {
      if (feedbackLogged) {
        actions.push(`Execution succeeded (execution_id=${record.execution_id || 'n/a'}) and feedback was logged.`);
        actions.push('node scripts/interactive-governance-report.js --period weekly --json');
      } else {
        actions.push(`Execution succeeded (execution_id=${record.execution_id || 'n/a'}). Collect user feedback for governance.`);
        actions.push('node scripts/interactive-feedback-log.js --score 5 --comment "business flow improved" --json');
      }
    } else {
      actions.push('Execution was blocked or failed. Inspect adapter output and adjust plan/policy.');
      actions.push(`node scripts/interactive-moqui-adapter.js --action validate --plan ${artifacts.plan_json} --json`);
    }
  } else if (executionBlockReasonCategory === 'password-authorization') {
    actions.push('Provide one-time password authorization and rerun low-risk apply.');
    actions.push(`node scripts/interactive-customization-loop.js --context ${artifacts.context_json} --goal "..." --execution-mode apply --auto-execute-low-risk --auth-password "<password>" --json`);
  } else if (executionBlockReasonCategory === 'role-policy') {
    actions.push('Use an approver actor role allowed by approval role policy, then rerun low-risk apply.');
    actions.push(`node scripts/interactive-approval-workflow.js --action status --state-file ${artifacts.approval_state_json} --json`);
    actions.push(`node scripts/interactive-customization-loop.js --context ${artifacts.context_json} --goal "..." --execution-mode apply --auto-execute-low-risk --approval-role-policy "<role-policy.json>" --approver-actor-role "<allowed-role>" --json`);
  }

  if (risk === 'low' && approvalStatus === 'submitted') {
    actions.push('Optional: approve workflow to keep an auditable close-loop trail.');
  }
  return actions;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const sessionId = normalizeSessionId(options.sessionId);

  const contextPath = resolvePath(cwd, options.context);
  const globalFeedbackPath = resolvePath(cwd, '.kiro/reports/interactive-user-feedback.jsonl');
  const outRoot = resolvePath(cwd, options.outDir);
  const sessionDir = path.join(outRoot, sessionId);
  const summaryOutPath = options.out
    ? resolvePath(cwd, options.out)
    : path.join(sessionDir, 'interactive-customization-loop.summary.json');

  const artifacts = {
    session_dir: toRelative(cwd, sessionDir),
    context_json: toRelative(cwd, contextPath),
    dialogue_json: toRelative(cwd, options.dialogueOut
      ? resolvePath(cwd, options.dialogueOut)
      : path.join(sessionDir, 'interactive-dialogue-governance.json')),
    runtime_json: toRelative(cwd, options.runtimeOut
      ? resolvePath(cwd, options.runtimeOut)
      : path.join(sessionDir, 'interactive-runtime-policy.json')),
    intent_json: toRelative(cwd, path.join(sessionDir, 'interactive-change-intent.json')),
    explain_md: toRelative(cwd, path.join(sessionDir, 'interactive-page-explain.md')),
    intent_audit_jsonl: toRelative(cwd, path.join(sessionDir, 'interactive-copilot-audit.jsonl')),
    plan_json: toRelative(cwd, path.join(sessionDir, 'interactive-change-plan.generated.json')),
    plan_md: toRelative(cwd, path.join(sessionDir, 'interactive-change-plan.generated.md')),
    gate_json: toRelative(cwd, path.join(sessionDir, 'interactive-change-plan-gate.json')),
    gate_md: toRelative(cwd, path.join(sessionDir, 'interactive-change-plan-gate.md')),
    approval_state_json: toRelative(cwd, path.join(sessionDir, 'interactive-approval-state.json')),
    approval_audit_jsonl: toRelative(cwd, path.join(sessionDir, 'interactive-approval-events.jsonl')),
    adapter_json: toRelative(cwd, path.join(sessionDir, 'interactive-moqui-adapter.json')),
    work_order_json: toRelative(cwd, options.workOrderOut
      ? resolvePath(cwd, options.workOrderOut)
      : path.join(sessionDir, 'interactive-work-order.json')),
    work_order_md: toRelative(cwd, options.workOrderMarkdownOut
      ? resolvePath(cwd, options.workOrderMarkdownOut)
      : path.join(sessionDir, 'interactive-work-order.md')),
    feedback_global_jsonl: toRelative(cwd, globalFeedbackPath),
    feedback_jsonl: toRelative(cwd, path.join(sessionDir, 'interactive-user-feedback.jsonl')),
    summary_json: toRelative(cwd, summaryOutPath)
  };

  await fs.ensureDir(sessionDir);

  const steps = [];

  const dialogueArgs = [
    '--context', contextPath,
    '--out', resolvePath(cwd, artifacts.dialogue_json),
    '--json'
  ];
  if (options.goal) {
    dialogueArgs.push('--goal', options.goal);
  } else {
    dialogueArgs.push('--goal-file', resolvePath(cwd, options.goalFile));
  }
  if (options.dialoguePolicy) {
    dialogueArgs.push('--policy', resolvePath(cwd, options.dialoguePolicy));
  }
  if (options.dialogueProfile) {
    dialogueArgs.push('--profile', options.dialogueProfile);
  }
  const dialogueResult = runScript({
    label: 'interactive-dialogue-governance',
    scriptPath: SCRIPT_DIALOGUE,
    args: dialogueArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const dialoguePayload = parseJsonOutput(dialogueResult.stdout, 'interactive-dialogue-governance');
  const dialogueDecision = dialoguePayload && dialoguePayload.decision ? dialoguePayload.decision : 'allow';
  steps.push(buildStep(
    'dialogue',
    dialoguePayload,
    buildCommandString(SCRIPT_DIALOGUE, dialogueArgs),
    dialogueResult.exit_code
  ));

  const intentArgs = [
    '--context', contextPath,
    '--user-id', options.userId,
    '--session-id', sessionId,
    '--out-intent', resolvePath(cwd, artifacts.intent_json),
    '--out-explain', resolvePath(cwd, artifacts.explain_md),
    '--audit-file', resolvePath(cwd, artifacts.intent_audit_jsonl),
    '--json'
  ];
  if (options.goal) {
    intentArgs.push('--goal', options.goal);
  } else {
    intentArgs.push('--goal-file', resolvePath(cwd, options.goalFile));
  }
  if (options.contextContract) {
    intentArgs.push('--context-contract', resolvePath(cwd, options.contextContract));
  }
  if (!options.strictContract) {
    intentArgs.push('--no-strict-contract');
  }
  const intentResult = runScript({
    label: 'interactive-intent-build',
    scriptPath: SCRIPT_INTENT,
    args: intentArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const intentPayload = parseJsonOutput(intentResult.stdout, 'interactive-intent-build');
  steps.push(buildStep('intent', intentPayload, buildCommandString(SCRIPT_INTENT, intentArgs), intentResult.exit_code));

  const planArgs = [
    '--intent', resolvePath(cwd, artifacts.intent_json),
    '--context', contextPath,
    '--execution-mode', options.executionMode,
    '--out-plan', resolvePath(cwd, artifacts.plan_json),
    '--out-markdown', resolvePath(cwd, artifacts.plan_md),
    '--json'
  ];
  const planResult = runScript({
    label: 'interactive-plan-build',
    scriptPath: SCRIPT_PLAN,
    args: planArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const planPayload = parseJsonOutput(planResult.stdout, 'interactive-plan-build');
  steps.push(buildStep('plan', planPayload, buildCommandString(SCRIPT_PLAN, planArgs), planResult.exit_code));

  const gateArgs = [
    '--plan', resolvePath(cwd, artifacts.plan_json),
    '--out', resolvePath(cwd, artifacts.gate_json),
    '--markdown-out', resolvePath(cwd, artifacts.gate_md),
    '--json'
  ];
  if (options.policy) {
    gateArgs.push('--policy', resolvePath(cwd, options.policy));
  }
  if (options.catalog) {
    gateArgs.push('--catalog', resolvePath(cwd, options.catalog));
  }
  const gateResult = runScript({
    label: 'interactive-change-plan-gate',
    scriptPath: SCRIPT_GATE,
    args: gateArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const gatePayload = parseJsonOutput(gateResult.stdout, 'interactive-change-plan-gate');
  steps.push(buildStep('gate', gatePayload, buildCommandString(SCRIPT_GATE, gateArgs), gateResult.exit_code));

  const gateDecision = gatePayload && gatePayload.decision ? gatePayload.decision : 'deny';
  const riskLevel = planPayload && planPayload.plan ? planPayload.plan.risk_level : null;

  const runtimeArgs = [
    '--plan', resolvePath(cwd, artifacts.plan_json),
    '--runtime-mode', options.runtimeMode,
    '--runtime-environment', options.runtimeEnvironment,
    '--out', resolvePath(cwd, artifacts.runtime_json),
    '--json'
  ];
  if (options.runtimePolicy) {
    runtimeArgs.push('--policy', resolvePath(cwd, options.runtimePolicy));
  }
  const runtimeResult = runScript({
    label: 'interactive-runtime-policy-evaluate',
    scriptPath: SCRIPT_RUNTIME,
    args: runtimeArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const runtimePayload = parseJsonOutput(runtimeResult.stdout, 'interactive-runtime-policy-evaluate');
  steps.push(buildStep(
    'runtime',
    runtimePayload,
    buildCommandString(SCRIPT_RUNTIME, runtimeArgs),
    runtimeResult.exit_code
  ));
  const runtimeDecision = runtimePayload && runtimePayload.decision ? runtimePayload.decision : 'deny';
  const runtimeRequirements = runtimePayload && runtimePayload.requirements && typeof runtimePayload.requirements === 'object'
    ? runtimePayload.requirements
    : {};

  const approvalInitArgs = [
    '--action', 'init',
    '--plan', resolvePath(cwd, artifacts.plan_json),
    '--state-file', resolvePath(cwd, artifacts.approval_state_json),
    '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
    '--actor', options.approvalActor,
    '--comment', 'interactive loop init',
    '--force',
    '--json'
  ];
  if (options.approvalActorRole) {
    approvalInitArgs.push('--actor-role', options.approvalActorRole);
  }
  if (options.approvalRolePolicy) {
    approvalInitArgs.push('--role-policy', resolvePath(cwd, options.approvalRolePolicy));
  }
  if (options.authPasswordHash) {
    approvalInitArgs.push('--password-hash', options.authPasswordHash);
  }
  if (options.authPasswordEnv) {
    approvalInitArgs.push('--password-hash-env', options.authPasswordEnv);
  }
  const approvalInitResult = runScript({
    label: 'interactive-approval-workflow:init',
    scriptPath: SCRIPT_APPROVAL,
    args: approvalInitArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const approvalInitPayload = parseJsonOutput(approvalInitResult.stdout, 'interactive-approval-workflow:init');
  steps.push(buildStep(
    'approval_init',
    approvalInitPayload,
    buildCommandString(SCRIPT_APPROVAL, approvalInitArgs, ['--password-hash']),
    approvalInitResult.exit_code
  ));

  if (!options.skipSubmit) {
    const approvalSubmitArgs = [
      '--action', 'submit',
      '--state-file', resolvePath(cwd, artifacts.approval_state_json),
      '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
      '--actor', options.approvalActor,
      '--comment', 'interactive loop submit',
      '--json'
    ];
    if (options.approvalActorRole) {
      approvalSubmitArgs.push('--actor-role', options.approvalActorRole);
    }
    const approvalSubmitResult = runScript({
      label: 'interactive-approval-workflow:submit',
      scriptPath: SCRIPT_APPROVAL,
      args: approvalSubmitArgs,
      cwd,
      allowedExitCodes: [0]
    });
    const approvalSubmitPayload = parseJsonOutput(approvalSubmitResult.stdout, 'interactive-approval-workflow:submit');
    steps.push(buildStep('approval_submit', approvalSubmitPayload, buildCommandString(SCRIPT_APPROVAL, approvalSubmitArgs), approvalSubmitResult.exit_code));
  }

  const canAutoLowRisk = shouldAutoLowRisk({
    gateDecision,
    riskLevel,
    dialogueDecision,
    runtimeDecision,
    runtimeAutoExecuteAllowed: runtimeRequirements.auto_execute_allowed === true
  });

  if (options.autoApproveLowRisk && canAutoLowRisk) {
    const approvalApproveArgs = [
      '--action', 'approve',
      '--state-file', resolvePath(cwd, artifacts.approval_state_json),
      '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
      '--actor', options.approverActor,
      '--comment', 'auto approve low-risk allow plan',
      '--json'
    ];
    if (options.approverActorRole) {
      approvalApproveArgs.push('--actor-role', options.approverActorRole);
    }
    const approvalApproveResult = runScript({
      label: 'interactive-approval-workflow:approve',
      scriptPath: SCRIPT_APPROVAL,
      args: approvalApproveArgs,
      cwd,
      allowedExitCodes: [0]
    });
    const approvalApprovePayload = parseJsonOutput(approvalApproveResult.stdout, 'interactive-approval-workflow:approve');
    steps.push(buildStep('approval_approve_auto', approvalApprovePayload, buildCommandString(SCRIPT_APPROVAL, approvalApproveArgs), approvalApproveResult.exit_code));
  }

  let execution = {
    attempted: false,
    auto_triggered: false,
    blocked: false,
    result: null,
    decision: null,
    reason: null,
    execution_id: null,
    payload: null,
    exit_code: null
  };

  if (options.autoExecuteLowRisk && canAutoLowRisk) {
    let runtimeExecutionBlockReason = null;
    if (options.liveApply && runtimeRequirements.allow_live_apply !== true) {
      runtimeExecutionBlockReason = `runtime environment "${options.runtimeEnvironment}" does not allow live apply`;
    } else if (
      options.liveApply &&
      !options.dryRun &&
      runtimeRequirements.require_dry_run_before_live_apply === true
    ) {
      runtimeExecutionBlockReason = `runtime environment "${options.runtimeEnvironment}" requires dry-run before live apply`;
    }

    if (runtimeExecutionBlockReason) {
      execution = {
        attempted: true,
        auto_triggered: true,
        blocked: true,
        result: 'blocked',
        decision: 'runtime-blocked',
        reason: runtimeExecutionBlockReason,
        execution_id: null,
        payload: {
          mode: 'interactive-runtime-policy-evaluate',
          decision: 'blocked',
          reason: runtimeExecutionBlockReason
        },
        exit_code: 2
      };
      steps.push(buildStep(
        'runtime_apply_guard',
        {
          decision: 'blocked',
          reason: runtimeExecutionBlockReason,
          runtime_mode: options.runtimeMode,
          runtime_environment: options.runtimeEnvironment
        },
        'runtime-guard',
        2
      ));
    } else {
      const approvalExecuteArgs = [
        '--action', 'execute',
        '--state-file', resolvePath(cwd, artifacts.approval_state_json),
        '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
        '--actor', options.approverActor,
        '--comment', 'auto execute low-risk allow plan',
        '--json'
      ];
      if (options.approverActorRole) {
        approvalExecuteArgs.push('--actor-role', options.approverActorRole);
      }
      if (options.authPassword) {
        approvalExecuteArgs.push('--password', options.authPassword);
      }
      const approvalExecuteResult = runScript({
        label: 'interactive-approval-workflow:execute',
        scriptPath: SCRIPT_APPROVAL,
        args: approvalExecuteArgs,
        cwd,
        allowedExitCodes: [0, 2]
      });
      const approvalExecutePayload = parseJsonOutput(approvalExecuteResult.stdout, 'interactive-approval-workflow:execute');
      steps.push(buildStep(
        'approval_execute_auto',
        approvalExecutePayload,
        buildCommandString(SCRIPT_APPROVAL, approvalExecuteArgs, ['--password']),
        approvalExecuteResult.exit_code
      ));

      if (approvalExecuteResult.exit_code === 2 || approvalExecutePayload.decision === 'blocked') {
        execution = {
          attempted: true,
          auto_triggered: true,
          blocked: true,
          result: 'blocked',
          decision: 'approval-blocked',
          reason: approvalExecutePayload.reason || 'approval execute blocked',
          execution_id: null,
          payload: approvalExecutePayload,
          exit_code: approvalExecuteResult.exit_code
        };
      } else {
        const adapterArgs = [
          '--action', 'low-risk-apply',
          '--plan', resolvePath(cwd, artifacts.plan_json),
          '--out', resolvePath(cwd, artifacts.adapter_json),
          '--json'
        ];
        if (options.policy) {
          adapterArgs.push('--policy', resolvePath(cwd, options.policy));
        }
        if (options.catalog) {
          adapterArgs.push('--catalog', resolvePath(cwd, options.catalog));
        }
        if (options.moquiConfig) {
          adapterArgs.push('--moqui-config', resolvePath(cwd, options.moquiConfig));
        }
        if (options.liveApply) {
          adapterArgs.push('--live-apply');
        }
        if (!options.dryRun) {
          adapterArgs.push('--no-dry-run');
        }
        if (options.allowSuggestionApply) {
          adapterArgs.push('--allow-suggestion-apply');
        }

        const adapterResult = runScript({
          label: 'interactive-moqui-adapter:low-risk-apply',
          scriptPath: SCRIPT_ADAPTER,
          args: adapterArgs,
          cwd,
          allowedExitCodes: [0, 2]
        });
        const adapterPayload = parseJsonOutput(adapterResult.stdout, 'interactive-moqui-adapter:low-risk-apply');
        const record = adapterPayload &&
          adapterPayload.payload &&
          adapterPayload.payload.execution_record &&
          typeof adapterPayload.payload.execution_record === 'object'
          ? adapterPayload.payload.execution_record
          : null;

        execution = {
          attempted: true,
          auto_triggered: true,
          blocked: adapterResult.exit_code === 2,
          result: record ? record.result : null,
          decision: adapterPayload && adapterPayload.payload ? adapterPayload.payload.decision : null,
          reason: adapterPayload && adapterPayload.payload ? adapterPayload.payload.reason || null : null,
          execution_id: record ? record.execution_id : null,
          payload: adapterPayload,
          exit_code: adapterResult.exit_code
        };
        steps.push(buildStep('adapter_low_risk_apply_auto', adapterPayload, buildCommandString(SCRIPT_ADAPTER, adapterArgs), adapterResult.exit_code));

        if (adapterResult.exit_code === 0) {
          const approvalVerifyArgs = [
            '--action', 'verify',
            '--state-file', resolvePath(cwd, artifacts.approval_state_json),
            '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
            '--actor', options.approverActor,
            '--comment', 'auto verify after successful low-risk apply',
            '--json'
          ];
          if (options.approverActorRole) {
            approvalVerifyArgs.push('--actor-role', options.approverActorRole);
          }
          const approvalVerifyResult = runScript({
            label: 'interactive-approval-workflow:verify',
            scriptPath: SCRIPT_APPROVAL,
            args: approvalVerifyArgs,
            cwd,
            allowedExitCodes: [0, 2]
          });
          const approvalVerifyPayload = parseJsonOutput(approvalVerifyResult.stdout, 'interactive-approval-workflow:verify');
          steps.push(buildStep('approval_verify_auto', approvalVerifyPayload, buildCommandString(SCRIPT_APPROVAL, approvalVerifyArgs), approvalVerifyResult.exit_code));
        }
      }
    }
  }

  const approvalStatusArgs = [
    '--action', 'status',
    '--state-file', resolvePath(cwd, artifacts.approval_state_json),
    '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
    '--json'
  ];
  const approvalStatusResult = runScript({
    label: 'interactive-approval-workflow:status',
    scriptPath: SCRIPT_APPROVAL,
    args: approvalStatusArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const approvalStatusPayload = parseJsonOutput(approvalStatusResult.stdout, 'interactive-approval-workflow:status');
  steps.push(buildStep('approval_status', approvalStatusPayload, buildCommandString(SCRIPT_APPROVAL, approvalStatusArgs), approvalStatusResult.exit_code));

  const approvalState = approvalStatusPayload && approvalStatusPayload.state ? approvalStatusPayload.state : {};
  const approvalStatus = approvalState && approvalState.status ? approvalState.status : null;
  const intentRecord = intentPayload && intentPayload.intent && typeof intentPayload.intent === 'object'
    ? intentPayload.intent
    : {};
  const planRecord = planPayload && planPayload.plan && typeof planPayload.plan === 'object'
    ? planPayload.plan
    : {};
  const contextRef = intentRecord.context_ref && typeof intentRecord.context_ref === 'object'
    ? intentRecord.context_ref
    : {};

  const feedback = {
    requested: options.feedbackScore != null,
    logged: false,
    score: options.feedbackScore,
    feedback_id: null,
    global_file: artifacts.feedback_global_jsonl,
    session_file: artifacts.feedback_jsonl,
    payload: null,
    exit_code: null
  };

  if (options.feedbackScore != null) {
    const feedbackArgs = [
      '--score', String(options.feedbackScore),
      '--user-id', options.userId,
      '--session-id', sessionId,
      '--feedback-file', globalFeedbackPath,
      '--channel', options.feedbackChannel,
      '--json'
    ];
    if (options.feedbackComment) {
      feedbackArgs.push('--comment', options.feedbackComment);
    }
    if (options.feedbackTags.length > 0) {
      feedbackArgs.push('--tags', options.feedbackTags.join(','));
    }
    if (intentRecord.intent_id) {
      feedbackArgs.push('--intent-id', intentRecord.intent_id);
    }
    if (planRecord.plan_id) {
      feedbackArgs.push('--plan-id', planRecord.plan_id);
    }
    if (execution.execution_id) {
      feedbackArgs.push('--execution-id', execution.execution_id);
    }
    if (contextRef.product) {
      feedbackArgs.push('--product', `${contextRef.product}`);
    }
    if (contextRef.module) {
      feedbackArgs.push('--module', `${contextRef.module}`);
    }
    if (contextRef.page) {
      feedbackArgs.push('--page', `${contextRef.page}`);
    }
    if (contextRef.scene_id) {
      feedbackArgs.push('--scene-id', `${contextRef.scene_id}`);
    }
    const feedbackResult = runScript({
      label: 'interactive-feedback-log',
      scriptPath: SCRIPT_FEEDBACK,
      args: feedbackArgs,
      cwd,
      allowedExitCodes: [0]
    });
    const feedbackPayload = parseJsonOutput(feedbackResult.stdout, 'interactive-feedback-log');
    const feedbackRecord = feedbackPayload && feedbackPayload.record && typeof feedbackPayload.record === 'object'
      ? feedbackPayload.record
      : null;
    if (feedbackRecord) {
      await fs.ensureDir(path.dirname(resolvePath(cwd, artifacts.feedback_jsonl)));
      await fs.appendFile(
        resolvePath(cwd, artifacts.feedback_jsonl),
        `${JSON.stringify(feedbackRecord)}\n`,
        'utf8'
      );
    }
    steps.push(buildStep('feedback_log', feedbackPayload, buildCommandString(SCRIPT_FEEDBACK, feedbackArgs), feedbackResult.exit_code));
    feedback.logged = true;
    feedback.payload = feedbackPayload;
    feedback.exit_code = feedbackResult.exit_code;
    feedback.feedback_id = feedbackRecord
      ? feedbackRecord.feedback_id || null
      : null;
  }

  const workOrderArgs = [
    '--plan', resolvePath(cwd, artifacts.plan_json),
    '--dialogue', resolvePath(cwd, artifacts.dialogue_json),
    '--intent', resolvePath(cwd, artifacts.intent_json),
    '--gate', resolvePath(cwd, artifacts.gate_json),
    '--runtime', resolvePath(cwd, artifacts.runtime_json),
    '--approval-state', resolvePath(cwd, artifacts.approval_state_json),
    '--session-id', sessionId,
    '--runtime-mode', options.runtimeMode,
    '--runtime-environment', options.runtimeEnvironment,
    '--out', resolvePath(cwd, artifacts.work_order_json),
    '--markdown-out', resolvePath(cwd, artifacts.work_order_md),
    '--json'
  ];
  if (options.goal) {
    workOrderArgs.push('--goal', options.goal);
  }
  if (execution.attempted) {
    workOrderArgs.push('--execution-attempted');
  }
  if (execution.blocked) {
    workOrderArgs.push('--execution-blocked');
  }
  if (execution.result) {
    workOrderArgs.push('--execution-result', execution.result);
  }
  if (execution.reason) {
    workOrderArgs.push('--execution-reason', execution.reason);
  }
  if (execution.execution_id) {
    workOrderArgs.push('--execution-id', execution.execution_id);
  }
  const workOrderResult = runScript({
    label: 'interactive-work-order-build',
    scriptPath: SCRIPT_WORK_ORDER,
    args: workOrderArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const workOrderPayload = parseJsonOutput(workOrderResult.stdout, 'interactive-work-order-build');
  steps.push(buildStep(
    'work_order',
    workOrderPayload,
    buildCommandString(SCRIPT_WORK_ORDER, workOrderArgs),
    workOrderResult.exit_code
  ));

  const summaryStatus = buildSummaryStatus({
    dialogueDecision,
    gateDecision,
    runtimeDecision,
    executionAttempted: execution.attempted,
    executionBlocked: execution.blocked,
    executionResult: execution.result
  });
  const executionBlockReasonCategory = detectExecutionBlockReasonCategory(execution);
  const executionBlockRemediationHint = buildExecutionBlockRemediationHint({
    blockReasonCategory: executionBlockReasonCategory,
    executionReason: execution.reason
  });

  const payload = {
    mode: 'interactive-customization-loop',
    generated_at: new Date().toISOString(),
    session_id: sessionId,
    input: {
      context: toRelative(cwd, contextPath),
      goal: options.goal || null,
      goal_file: options.goalFile ? toRelative(cwd, resolvePath(cwd, options.goalFile)) : null,
      user_id: options.userId,
      execution_mode: options.executionMode
    },
    options: {
      policy: options.policy ? toRelative(cwd, resolvePath(cwd, options.policy)) : null,
      catalog: options.catalog ? toRelative(cwd, resolvePath(cwd, options.catalog)) : null,
      moqui_config: options.moquiConfig ? toRelative(cwd, resolvePath(cwd, options.moquiConfig)) : null,
      approval_actor: options.approvalActor,
      approval_actor_role: options.approvalActorRole,
      approver_actor: options.approverActor,
      approver_actor_role: options.approverActorRole,
      approval_role_policy: options.approvalRolePolicy ? toRelative(cwd, resolvePath(cwd, options.approvalRolePolicy)) : null,
      skip_submit: options.skipSubmit,
      auto_approve_low_risk: options.autoApproveLowRisk,
      auto_execute_low_risk: options.autoExecuteLowRisk,
      allow_suggestion_apply: options.allowSuggestionApply,
      live_apply: options.liveApply,
      dry_run: options.dryRun,
      feedback_score: options.feedbackScore,
      feedback_comment: options.feedbackComment,
      feedback_tags: options.feedbackTags,
      feedback_channel: options.feedbackChannel,
      dialogue_policy: options.dialoguePolicy ? toRelative(cwd, resolvePath(cwd, options.dialoguePolicy)) : null,
      dialogue_profile: options.dialogueProfile,
      runtime_mode: options.runtimeMode,
      runtime_environment: options.runtimeEnvironment,
      runtime_policy: options.runtimePolicy ? toRelative(cwd, resolvePath(cwd, options.runtimePolicy)) : null,
      auth_password_hash: options.authPasswordHash ? '***' : null,
      auth_password_env: options.authPasswordEnv || DEFAULT_AUTH_PASSWORD_HASH_ENV
    },
    dialogue: {
      decision: dialogueDecision,
      profile: dialoguePayload && dialoguePayload.policy ? dialoguePayload.policy.active_profile || null : null,
      reasons: Array.isArray(dialoguePayload && dialoguePayload.reasons) ? dialoguePayload.reasons : [],
      clarification_questions: Array.isArray(dialoguePayload && dialoguePayload.clarification_questions)
        ? dialoguePayload.clarification_questions
        : []
    },
    gate: {
      decision: gateDecision,
      risk_level: riskLevel,
      reasons: Array.isArray(gatePayload && gatePayload.reasons) ? gatePayload.reasons : []
    },
    runtime: {
      decision: runtimeDecision,
      mode: runtimePayload && runtimePayload.runtime_mode ? runtimePayload.runtime_mode : options.runtimeMode,
      environment: runtimePayload && runtimePayload.runtime_environment ? runtimePayload.runtime_environment : options.runtimeEnvironment,
      reasons: Array.isArray(runtimePayload && runtimePayload.reasons) ? runtimePayload.reasons : [],
      requirements: runtimeRequirements
    },
    approval: {
      workflow_id: approvalState.workflow_id || null,
      status: approvalStatus,
      approval_required: approvalState.approval_required === true,
      approvals: approvalState.approvals || {},
      authorization: approvalStatusPayload && approvalStatusPayload.authorization
        ? approvalStatusPayload.authorization
        : {}
    },
    execution,
    summary: {
      status: summaryStatus,
      execution_block_reason_category: executionBlockReasonCategory,
      execution_block_remediation_hint: executionBlockRemediationHint,
      next_actions: buildNextActions({
        dialogueDecision,
        gateDecision,
        runtimeDecision,
        riskLevel,
        runtime: {
          mode: runtimePayload && runtimePayload.runtime_mode ? runtimePayload.runtime_mode : options.runtimeMode,
          environment: runtimePayload && runtimePayload.runtime_environment ? runtimePayload.runtime_environment : options.runtimeEnvironment
        },
        autoExecuteTriggered: execution.auto_triggered === true,
        executionPayload: execution.payload && execution.payload.payload ? execution.payload.payload : null,
        executionBlockReasonCategory,
        executionReason: execution.reason,
        approvalStatus,
        feedbackLogged: feedback.logged,
        artifacts
      })
    },
    work_order: workOrderPayload && workOrderPayload.work_order
      ? workOrderPayload.work_order
      : null,
    feedback,
    artifacts,
    steps
  };

  await fs.ensureDir(path.dirname(summaryOutPath));
  await fs.writeJson(summaryOutPath, payload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive customization loop completed: ${payload.summary.status}\n`);
    process.stdout.write(`- Session: ${sessionId}\n`);
    process.stdout.write(`- Gate: ${gateDecision}\n`);
    process.stdout.write(`- Runtime: ${runtimeDecision}\n`);
    process.stdout.write(`- Summary: ${toRelative(cwd, summaryOutPath)}\n`);
  }

  if (options.failOnGateDeny && `${gateDecision}`.trim().toLowerCase() === 'deny') {
    process.exitCode = 2;
  } else if (options.failOnDialogueDeny && `${dialogueDecision}`.trim().toLowerCase() === 'deny') {
    process.exitCode = 2;
  } else if (options.failOnGateNonAllow && `${gateDecision}`.trim().toLowerCase() !== 'allow') {
    process.exitCode = 2;
  } else if (options.failOnRuntimeNonAllow && `${runtimeDecision}`.trim().toLowerCase() !== 'allow') {
    process.exitCode = 2;
  } else if (options.failOnExecuteBlocked && execution.attempted && execution.blocked) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive customization loop failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_OUT_DIR,
  DEFAULT_USER_ID,
  DEFAULT_APPROVAL_ACTOR,
  DEFAULT_FEEDBACK_CHANNEL,
  DEFAULT_RUNTIME_MODE,
  DEFAULT_RUNTIME_ENVIRONMENT,
  DEFAULT_DIALOGUE_PROFILE,
  FEEDBACK_CHANNELS,
  RUNTIME_MODES,
  RUNTIME_ENVIRONMENTS,
  DIALOGUE_PROFILES,
  parseArgs,
  resolvePath,
  normalizeSessionId,
  parseJsonOutput,
  buildCommandString,
  runScript,
  toRelative,
  buildStep,
  shouldAutoLowRisk,
  buildSummaryStatus,
  detectExecutionBlockReasonCategory,
  buildExecutionBlockRemediationHint,
  buildNextActions,
  main
};
