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
const FEEDBACK_CHANNELS = new Set(['ui', 'cli', 'api', 'other']);

const SCRIPT_INTENT = path.resolve(__dirname, 'interactive-intent-build.js');
const SCRIPT_PLAN = path.resolve(__dirname, 'interactive-plan-build.js');
const SCRIPT_GATE = path.resolve(__dirname, 'interactive-change-plan-gate.js');
const SCRIPT_APPROVAL = path.resolve(__dirname, 'interactive-approval-workflow.js');
const SCRIPT_ADAPTER = path.resolve(__dirname, 'interactive-moqui-adapter.js');
const SCRIPT_FEEDBACK = path.resolve(__dirname, 'interactive-feedback-log.js');

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
    contextContract: null,
    strictContract: true,
    moquiConfig: null,
    outDir: DEFAULT_OUT_DIR,
    out: null,
    approvalActor: DEFAULT_APPROVAL_ACTOR,
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

  if (!options.context) {
    throw new Error('--context is required.');
  }
  if (!options.goal && !options.goalFile) {
    throw new Error('either --goal or --goal-file is required.');
  }
  if (!['suggestion', 'apply'].includes(`${options.executionMode || ''}`.trim())) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }
  if (options.feedbackScore != null) {
    if (!Number.isFinite(options.feedbackScore) || options.feedbackScore < 0 || options.feedbackScore > 5) {
      throw new Error('--feedback-score must be between 0 and 5.');
    }
  }

  options.userId = `${options.userId || ''}`.trim() || DEFAULT_USER_ID;
  options.approvalActor = `${options.approvalActor || ''}`.trim() || DEFAULT_APPROVAL_ACTOR;
  options.approverActor = `${options.approverActor || ''}`.trim() || options.approvalActor;
  options.feedbackComment = `${options.feedbackComment || ''}`.trim() || null;
  options.feedbackChannel = `${options.feedbackChannel || ''}`.trim().toLowerCase() || DEFAULT_FEEDBACK_CHANNEL;
  if (!FEEDBACK_CHANNELS.has(options.feedbackChannel)) {
    throw new Error(`--feedback-channel must be one of: ${Array.from(FEEDBACK_CHANNELS).join(', ')}`);
  }
  options.feedbackTags = Array.from(new Set(options.feedbackTags.map(item => item.toLowerCase())));

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-customization-loop.js --context <path> (--goal <text> | --goal-file <path>) [options]',
    '',
    'Pipeline:',
    '  intent -> plan -> gate -> approval(init/submit) -> optional low-risk apply',
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
    '  --context-contract <path>        Context contract override for intent build',
    '  --no-strict-contract             Do not fail when context contract validation has issues',
    '  --moqui-config <path>            Moqui adapter runtime config',
    `  --out-dir <path>                 Loop artifact root (default: ${DEFAULT_OUT_DIR})`,
    '  --out <path>                     Loop summary JSON output path',
    `  --approval-actor <id>            Approval workflow actor (default: ${DEFAULT_APPROVAL_ACTOR})`,
    '  --approver-actor <id>            Auto-approve actor (default: approval actor)',
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
    '  --fail-on-gate-deny              Exit code 2 if gate decision is deny',
    '  --fail-on-gate-non-allow         Exit code 2 if gate decision is deny/review-required',
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

function shouldAutoLowRisk(gateDecision, riskLevel) {
  return `${gateDecision || ''}`.trim().toLowerCase() === 'allow' &&
    `${riskLevel || ''}`.trim().toLowerCase() === 'low';
}

function buildSummaryStatus({ gateDecision, executionAttempted, executionBlocked, executionResult }) {
  const decision = `${gateDecision || ''}`.trim().toLowerCase();
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

function buildNextActions({ gateDecision, riskLevel, autoExecuteTriggered, executionPayload, approvalStatus, feedbackLogged, artifacts }) {
  const actions = [];
  const decision = `${gateDecision || ''}`.trim().toLowerCase();
  const risk = `${riskLevel || ''}`.trim().toLowerCase();

  if (decision === 'deny') {
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
    feedback_global_jsonl: toRelative(cwd, globalFeedbackPath),
    feedback_jsonl: toRelative(cwd, path.join(sessionDir, 'interactive-user-feedback.jsonl')),
    summary_json: toRelative(cwd, summaryOutPath)
  };

  await fs.ensureDir(sessionDir);

  const steps = [];

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
  steps.push(buildStep('intent', intentPayload, [process.execPath, SCRIPT_INTENT, ...intentArgs].join(' '), intentResult.exit_code));

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
  steps.push(buildStep('plan', planPayload, [process.execPath, SCRIPT_PLAN, ...planArgs].join(' '), planResult.exit_code));

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
  steps.push(buildStep('gate', gatePayload, [process.execPath, SCRIPT_GATE, ...gateArgs].join(' '), gateResult.exit_code));

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
  const approvalInitResult = runScript({
    label: 'interactive-approval-workflow:init',
    scriptPath: SCRIPT_APPROVAL,
    args: approvalInitArgs,
    cwd,
    allowedExitCodes: [0]
  });
  const approvalInitPayload = parseJsonOutput(approvalInitResult.stdout, 'interactive-approval-workflow:init');
  steps.push(buildStep('approval_init', approvalInitPayload, [process.execPath, SCRIPT_APPROVAL, ...approvalInitArgs].join(' '), approvalInitResult.exit_code));

  let latestApprovalPayload = approvalInitPayload;
  if (!options.skipSubmit) {
    const approvalSubmitArgs = [
      '--action', 'submit',
      '--state-file', resolvePath(cwd, artifacts.approval_state_json),
      '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
      '--actor', options.approvalActor,
      '--comment', 'interactive loop submit',
      '--json'
    ];
    const approvalSubmitResult = runScript({
      label: 'interactive-approval-workflow:submit',
      scriptPath: SCRIPT_APPROVAL,
      args: approvalSubmitArgs,
      cwd,
      allowedExitCodes: [0]
    });
    latestApprovalPayload = parseJsonOutput(approvalSubmitResult.stdout, 'interactive-approval-workflow:submit');
    steps.push(buildStep('approval_submit', latestApprovalPayload, [process.execPath, SCRIPT_APPROVAL, ...approvalSubmitArgs].join(' '), approvalSubmitResult.exit_code));
  }

  const gateDecision = gatePayload && gatePayload.decision ? gatePayload.decision : 'deny';
  const riskLevel = planPayload && planPayload.plan ? planPayload.plan.risk_level : null;
  const canAutoLowRisk = shouldAutoLowRisk(gateDecision, riskLevel);

  if (options.autoApproveLowRisk && canAutoLowRisk) {
    const approvalApproveArgs = [
      '--action', 'approve',
      '--state-file', resolvePath(cwd, artifacts.approval_state_json),
      '--audit-file', resolvePath(cwd, artifacts.approval_audit_jsonl),
      '--actor', options.approverActor,
      '--comment', 'auto approve low-risk allow plan',
      '--json'
    ];
    const approvalApproveResult = runScript({
      label: 'interactive-approval-workflow:approve',
      scriptPath: SCRIPT_APPROVAL,
      args: approvalApproveArgs,
      cwd,
      allowedExitCodes: [0]
    });
    latestApprovalPayload = parseJsonOutput(approvalApproveResult.stdout, 'interactive-approval-workflow:approve');
    steps.push(buildStep('approval_approve_auto', latestApprovalPayload, [process.execPath, SCRIPT_APPROVAL, ...approvalApproveArgs].join(' '), approvalApproveResult.exit_code));
  }

  let execution = {
    attempted: false,
    auto_triggered: false,
    blocked: false,
    result: null,
    decision: null,
    execution_id: null,
    payload: null,
    exit_code: null
  };

  if (options.autoExecuteLowRisk && canAutoLowRisk) {
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
      execution_id: record ? record.execution_id : null,
      payload: adapterPayload,
      exit_code: adapterResult.exit_code
    };
    steps.push(buildStep('adapter_low_risk_apply_auto', adapterPayload, [process.execPath, SCRIPT_ADAPTER, ...adapterArgs].join(' '), adapterResult.exit_code));
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
  latestApprovalPayload = approvalStatusPayload;
  steps.push(buildStep('approval_status', approvalStatusPayload, [process.execPath, SCRIPT_APPROVAL, ...approvalStatusArgs].join(' '), approvalStatusResult.exit_code));

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
    steps.push(buildStep('feedback_log', feedbackPayload, [process.execPath, SCRIPT_FEEDBACK, ...feedbackArgs].join(' '), feedbackResult.exit_code));
    feedback.logged = true;
    feedback.payload = feedbackPayload;
    feedback.exit_code = feedbackResult.exit_code;
    feedback.feedback_id = feedbackRecord
      ? feedbackRecord.feedback_id || null
      : null;
  }

  const summaryStatus = buildSummaryStatus({
    gateDecision,
    executionAttempted: execution.attempted,
    executionBlocked: execution.blocked,
    executionResult: execution.result
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
      approver_actor: options.approverActor,
      skip_submit: options.skipSubmit,
      auto_approve_low_risk: options.autoApproveLowRisk,
      auto_execute_low_risk: options.autoExecuteLowRisk,
      allow_suggestion_apply: options.allowSuggestionApply,
      live_apply: options.liveApply,
      dry_run: options.dryRun,
      feedback_score: options.feedbackScore,
      feedback_comment: options.feedbackComment,
      feedback_tags: options.feedbackTags,
      feedback_channel: options.feedbackChannel
    },
    gate: {
      decision: gateDecision,
      risk_level: riskLevel,
      reasons: Array.isArray(gatePayload && gatePayload.reasons) ? gatePayload.reasons : []
    },
    approval: {
      workflow_id: approvalState.workflow_id || null,
      status: approvalStatus,
      approval_required: approvalState.approval_required === true,
      approvals: approvalState.approvals || {}
    },
    execution,
    summary: {
      status: summaryStatus,
      next_actions: buildNextActions({
        gateDecision,
        riskLevel,
      autoExecuteTriggered: execution.auto_triggered === true,
      executionPayload: execution.payload && execution.payload.payload ? execution.payload.payload : null,
      approvalStatus,
      feedbackLogged: feedback.logged,
      artifacts
    })
  },
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
    process.stdout.write(`- Summary: ${toRelative(cwd, summaryOutPath)}\n`);
  }

  if (options.failOnGateDeny && `${gateDecision}`.trim().toLowerCase() === 'deny') {
    process.exitCode = 2;
  } else if (options.failOnGateNonAllow && `${gateDecision}`.trim().toLowerCase() !== 'allow') {
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
  FEEDBACK_CHANNELS,
  parseArgs,
  resolvePath,
  normalizeSessionId,
  parseJsonOutput,
  runScript,
  toRelative,
  buildStep,
  shouldAutoLowRisk,
  buildSummaryStatus,
  buildNextActions,
  main
};
