#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_OUT = '.kiro/reports/interactive-work-order.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/interactive-work-order.md';

function parseArgs(argv) {
  const options = {
    sessionId: null,
    goal: null,
    dialogue: null,
    intent: null,
    plan: null,
    gate: null,
    runtime: null,
    authorizationTier: null,
    approvalState: null,
    runtimeMode: null,
    runtimeEnvironment: null,
    executionAttempted: false,
    executionBlocked: false,
    executionResult: null,
    executionReason: null,
    executionId: null,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--session-id' && next) {
      options.sessionId = next;
      index += 1;
    } else if (token === '--goal' && next) {
      options.goal = next;
      index += 1;
    } else if (token === '--dialogue' && next) {
      options.dialogue = next;
      index += 1;
    } else if (token === '--intent' && next) {
      options.intent = next;
      index += 1;
    } else if (token === '--plan' && next) {
      options.plan = next;
      index += 1;
    } else if (token === '--gate' && next) {
      options.gate = next;
      index += 1;
    } else if (token === '--runtime' && next) {
      options.runtime = next;
      index += 1;
    } else if (token === '--authorization-tier' && next) {
      options.authorizationTier = next;
      index += 1;
    } else if (token === '--approval-state' && next) {
      options.approvalState = next;
      index += 1;
    } else if (token === '--runtime-mode' && next) {
      options.runtimeMode = next;
      index += 1;
    } else if (token === '--runtime-environment' && next) {
      options.runtimeEnvironment = next;
      index += 1;
    } else if (token === '--execution-attempted') {
      options.executionAttempted = true;
    } else if (token === '--execution-blocked') {
      options.executionBlocked = true;
    } else if (token === '--execution-result' && next) {
      options.executionResult = next;
      index += 1;
    } else if (token === '--execution-reason' && next) {
      options.executionReason = next;
      index += 1;
    } else if (token === '--execution-id' && next) {
      options.executionId = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      index += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.plan) {
    throw new Error('--plan is required.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-work-order-build.js --plan <path> [options]',
    '',
    'Options:',
    '  --plan <path>                 Change plan JSON file (required)',
    '  --dialogue <path>             Dialogue governance JSON file',
    '  --intent <path>               Change intent JSON file',
    '  --gate <path>                 Change plan gate report JSON file',
    '  --runtime <path>              Runtime policy evaluation JSON file',
    '  --authorization-tier <path>   Authorization tier evaluation JSON file',
    '  --approval-state <path>       Approval workflow state JSON file',
    '  --session-id <id>             Session identifier',
    '  --goal <text>                 Optional goal override',
    '  --runtime-mode <name>         Optional runtime mode override',
    '  --runtime-environment <name>  Optional runtime environment override',
    '  --execution-attempted         Mark execution as attempted',
    '  --execution-blocked           Mark execution as blocked',
    '  --execution-result <value>    Execution result (for example success|blocked|failed)',
    '  --execution-reason <text>     Execution reason/details',
    '  --execution-id <id>           Execution ID',
    `  --out <path>                  Work-order JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>         Work-order markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --json                        Print payload to stdout',
    '  -h, --help                    Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function tryReadJsonFile(filePath) {
  if (!filePath) {
    return null;
  }
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON in ${filePath}: ${error.message}`);
  }
}

function normalizeRiskLevel(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (['high', 'critical'].includes(normalized)) {
    return 'high';
  }
  if (normalized === 'medium') {
    return 'medium';
  }
  return 'low';
}

function normalizeDecision(value, fallback = 'unknown') {
  const normalized = `${value || ''}`.trim().toLowerCase();
  return normalized || fallback;
}

function normalizeStatus(value, fallback = 'unknown') {
  return normalizeDecision(value, fallback);
}

function inferWorkOrderStatus({
  dialogueDecision,
  gateDecision,
  runtimeDecision,
  authorizationTierDecision,
  approvalStatus,
  executionAttempted,
  executionBlocked,
  executionResult
}) {
  if (
    dialogueDecision === 'deny' ||
    gateDecision === 'deny' ||
    runtimeDecision === 'deny' ||
    authorizationTierDecision === 'deny'
  ) {
    return 'blocked';
  }
  if (executionAttempted && executionBlocked) {
    return 'blocked';
  }
  if (executionAttempted && executionResult === 'success') {
    return 'completed';
  }
  if (
    gateDecision === 'review-required' ||
    runtimeDecision === 'review-required' ||
    authorizationTierDecision === 'review-required'
  ) {
    return 'pending-review';
  }
  if (['draft', 'submitted', 'rejected'].includes(approvalStatus)) {
    return 'pending-review';
  }
  if (['approved', 'verified', 'archived'].includes(approvalStatus)) {
    return 'ready-for-apply';
  }
  if (gateDecision === 'allow' && runtimeDecision === 'allow') {
    return 'ready-for-apply';
  }
  return 'pending-review';
}

function inferPriority(riskLevel, gateDecision, runtimeDecision, authorizationTierDecision) {
  if (
    gateDecision === 'deny' ||
    runtimeDecision === 'deny' ||
    authorizationTierDecision === 'deny' ||
    riskLevel === 'high'
  ) {
    return 'high';
  }
  if (
    gateDecision === 'review-required' ||
    runtimeDecision === 'review-required' ||
    authorizationTierDecision === 'review-required' ||
    riskLevel === 'medium'
  ) {
    return 'medium';
  }
  return 'low';
}

function inferNextActions({
  dialogueDecision,
  gateDecision,
  runtimeDecision,
  authorizationTierDecision,
  approvalStatus,
  executionAttempted,
  executionBlocked,
  executionResult,
  runtimeRequirements,
  authorizationTierRequirements
}) {
  const actions = [];
  if (dialogueDecision === 'deny') {
    actions.push('Rewrite goal to satisfy dialogue governance and rerun planning.');
    return actions;
  }
  if (gateDecision === 'deny') {
    actions.push('Refactor plan actions and pass interactive-change-plan-gate again.');
    return actions;
  }
  if (runtimeDecision === 'deny') {
    actions.push('Switch runtime mode/environment or lower risk/action set before apply.');
    return actions;
  }
  if (authorizationTierDecision === 'deny') {
    actions.push('Use system-maintainer profile and satisfy step-up authorization requirements before apply.');
    return actions;
  }
  if (
    gateDecision === 'review-required' ||
    runtimeDecision === 'review-required' ||
    authorizationTierDecision === 'review-required'
  ) {
    actions.push('Create review ticket and complete manual review/approval before apply.');
  }
  if (runtimeRequirements && runtimeRequirements.require_work_order === true) {
    actions.push('Keep this work-order in audit trail and link approval/execution evidence.');
  }
  if (authorizationTierRequirements && authorizationTierRequirements.require_password_for_apply === true) {
    actions.push('Provide one-time password authorization for apply execution.');
  }
  if (authorizationTierRequirements && authorizationTierRequirements.require_role_policy === true) {
    actions.push('Provide approval role policy and actor role mapping for apply execution.');
  }
  if (authorizationTierRequirements && authorizationTierRequirements.require_distinct_actor_roles === true) {
    actions.push('Use distinct operator role and approver role to satisfy separation-of-duties.');
  }
  if (!executionAttempted) {
    actions.push('Run apply path only after review checks and approval are satisfied.');
  } else if (executionBlocked) {
    actions.push('Investigate blocked reason and rerun after governance conditions are satisfied.');
  } else if (executionResult === 'success') {
    actions.push('Collect user feedback and close work-order after verification.');
  }
  if (!['approved', 'verified', 'archived'].includes(approvalStatus)) {
    actions.push('Complete approval workflow state transition to approved/verified.');
  }
  return actions;
}

function buildMarkdown(payload) {
  const workOrder = payload.work_order;
  const scope = workOrder.scope || {};
  const governance = workOrder.governance || {};
  const execution = workOrder.execution || {};
  const runtime = workOrder.runtime || {};
  const authorization = workOrder.authorization || {};

  const lines = [];
  lines.push('# Interactive Work Order');
  lines.push('');
  lines.push(`- Work-order ID: ${workOrder.work_order_id}`);
  lines.push(`- Session ID: ${workOrder.session_id || 'n/a'}`);
  lines.push(`- Status: ${workOrder.status}`);
  lines.push(`- Priority: ${workOrder.priority}`);
  lines.push(`- Runtime: ${runtime.mode || 'n/a'} @ ${runtime.environment || 'n/a'}`);
  lines.push(`- Runtime decision: ${runtime.decision || 'unknown'}`);
  lines.push(`- Authorization tier decision: ${authorization.decision || 'unknown'}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push(`- Product: ${scope.product || 'n/a'}`);
  lines.push(`- Module: ${scope.module || 'n/a'}`);
  lines.push(`- Page: ${scope.page || 'n/a'}`);
  lines.push(`- Entity: ${scope.entity || 'n/a'}`);
  lines.push(`- Scene: ${scope.scene_id || 'n/a'}`);
  lines.push('');
  lines.push('## Governance');
  lines.push('');
  lines.push(`- Dialogue: ${governance.dialogue_decision || 'unknown'}`);
  lines.push(`- Gate: ${governance.gate_decision || 'unknown'}`);
  lines.push(`- Runtime: ${governance.runtime_decision || 'unknown'}`);
  lines.push(`- Authorization tier: ${governance.authorization_tier_decision || 'unknown'}`);
  lines.push(`- Approval: ${governance.approval_status || 'unknown'}`);
  lines.push(`- Risk level: ${governance.risk_level || 'unknown'}`);
  lines.push('');
  lines.push('## Authorization Tier');
  lines.push('');
  lines.push(`- Profile: ${authorization.profile || 'n/a'}`);
  lines.push(`- Runtime environment: ${authorization.runtime_environment || 'n/a'}`);
  lines.push(`- Decision: ${authorization.decision || 'unknown'}`);
  lines.push(`- Require secondary authorization: ${authorization.requirements && authorization.requirements.require_secondary_authorization ? 'yes' : 'no'}`);
  lines.push(`- Require password for apply: ${authorization.requirements && authorization.requirements.require_password_for_apply ? 'yes' : 'no'}`);
  lines.push(`- Require role policy: ${authorization.requirements && authorization.requirements.require_role_policy ? 'yes' : 'no'}`);
  lines.push(`- Require distinct actor roles: ${authorization.requirements && authorization.requirements.require_distinct_actor_roles ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Execution');
  lines.push('');
  lines.push(`- Attempted: ${execution.attempted ? 'yes' : 'no'}`);
  lines.push(`- Blocked: ${execution.blocked ? 'yes' : 'no'}`);
  lines.push(`- Result: ${execution.result || 'n/a'}`);
  lines.push(`- Execution ID: ${execution.execution_id || 'n/a'}`);
  lines.push(`- Reason: ${execution.reason || 'n/a'}`);
  lines.push('');
  lines.push('## Actions');
  lines.push('');
  lines.push('| Action ID | Type | Sensitive | Privilege Escalation | Irreversible |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const action of workOrder.actions) {
    lines.push(`| ${action.action_id || 'n/a'} | ${action.type || 'unknown'} | ${action.touches_sensitive_data ? 'yes' : 'no'} | ${action.requires_privilege_escalation ? 'yes' : 'no'} | ${action.irreversible ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  if (Array.isArray(workOrder.next_actions) && workOrder.next_actions.length > 0) {
    workOrder.next_actions.forEach(item => lines.push(`- ${item}`));
  } else {
    lines.push('- none');
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const planPath = resolvePath(cwd, options.plan);
  const dialoguePath = options.dialogue ? resolvePath(cwd, options.dialogue) : null;
  const intentPath = options.intent ? resolvePath(cwd, options.intent) : null;
  const gatePath = options.gate ? resolvePath(cwd, options.gate) : null;
  const runtimePath = options.runtime ? resolvePath(cwd, options.runtime) : null;
  const authorizationTierPath = options.authorizationTier ? resolvePath(cwd, options.authorizationTier) : null;
  const approvalStatePath = options.approvalState ? resolvePath(cwd, options.approvalState) : null;
  const outPath = resolvePath(cwd, options.out);
  const markdownOutPath = resolvePath(cwd, options.markdownOut);

  const [dialogue, intent, plan, gate, runtime, authorizationTier, approvalState] = await Promise.all([
    tryReadJsonFile(dialoguePath),
    tryReadJsonFile(intentPath),
    tryReadJsonFile(planPath),
    tryReadJsonFile(gatePath),
    tryReadJsonFile(runtimePath),
    tryReadJsonFile(authorizationTierPath),
    tryReadJsonFile(approvalStatePath)
  ]);

  if (!plan) {
    throw new Error(`plan not found or invalid: ${planPath}`);
  }

  const dialogueDecision = normalizeDecision(dialogue && dialogue.decision, 'unknown');
  const gateDecision = normalizeDecision(gate && gate.decision, 'unknown');
  const runtimeDecision = normalizeDecision(runtime && runtime.decision, 'unknown');
  const authorizationTierDecision = normalizeDecision(authorizationTier && authorizationTier.decision, 'unknown');
  const approvalStatus = normalizeStatus(approvalState && approvalState.status, 'unknown');
  const executionResult = normalizeDecision(options.executionResult, '');
  const riskLevel = normalizeRiskLevel(plan.risk_level);
  const runtimeMode = `${options.runtimeMode || (runtime && runtime.runtime_mode) || ''}`.trim() || null;
  const runtimeEnvironment = `${options.runtimeEnvironment || (runtime && runtime.runtime_environment) || ''}`.trim() || null;

  const status = inferWorkOrderStatus({
    dialogueDecision,
    gateDecision,
    runtimeDecision,
    authorizationTierDecision,
    approvalStatus,
    executionAttempted: options.executionAttempted,
    executionBlocked: options.executionBlocked,
    executionResult
  });
  const priority = inferPriority(riskLevel, gateDecision, runtimeDecision, authorizationTierDecision);
  const runtimeRequirements = runtime && runtime.requirements && typeof runtime.requirements === 'object'
    ? runtime.requirements
    : {};
  const authorizationTierContext = authorizationTier && authorizationTier.context && typeof authorizationTier.context === 'object'
    ? authorizationTier.context
    : {};
  const authorizationTierRequirements = authorizationTier && authorizationTier.requirements && typeof authorizationTier.requirements === 'object'
    ? authorizationTier.requirements
    : {};
  const nextActions = inferNextActions({
    dialogueDecision,
    gateDecision,
    runtimeDecision,
    authorizationTierDecision,
    approvalStatus,
    executionAttempted: options.executionAttempted,
    executionBlocked: options.executionBlocked,
    executionResult,
    runtimeRequirements,
    authorizationTierRequirements
  });

  const scope = plan.scope && typeof plan.scope === 'object' ? plan.scope : {};
  const actions = Array.isArray(plan.actions) ? plan.actions : [];
  const goalText = `${options.goal || (intent && intent.business_goal) || ''}`.trim();

  const workOrder = {
    work_order_id: `wo-${crypto.randomUUID()}`,
    session_id: options.sessionId || null,
    title: goalText || `Interactive change for ${scope.module || scope.product || 'unknown-scope'}`,
    status,
    priority,
    phase: runtimeMode || 'runtime-unspecified',
    intent_id: intent && intent.intent_id ? intent.intent_id : (plan.intent_id || null),
    plan_id: plan.plan_id || null,
    workflow_id: approvalState && approvalState.workflow_id ? approvalState.workflow_id : null,
    scope: {
      product: scope.product || null,
      module: scope.module || null,
      page: scope.page || null,
      entity: scope.entity || null,
      scene_id: scope.scene_id || null
    },
    governance: {
      dialogue_decision: dialogueDecision,
      gate_decision: gateDecision,
      runtime_decision: runtimeDecision,
      authorization_tier_decision: authorizationTierDecision,
      approval_status: approvalStatus,
      risk_level: riskLevel
    },
    runtime: {
      mode: runtimeMode,
      environment: runtimeEnvironment,
      decision: runtimeDecision,
      reasons: Array.isArray(runtime && runtime.reasons) ? runtime.reasons : [],
      requirements: runtimeRequirements
    },
    authorization: {
      profile: authorizationTierContext.dialogue_profile || null,
      runtime_environment: authorizationTierContext.runtime_environment || runtimeEnvironment,
      decision: authorizationTierDecision,
      reasons: Array.isArray(authorizationTier && authorizationTier.reasons) ? authorizationTier.reasons : [],
      requirements: authorizationTierRequirements
    },
    execution: {
      attempted: options.executionAttempted,
      blocked: options.executionBlocked,
      result: executionResult || null,
      reason: options.executionReason || null,
      execution_id: options.executionId || null
    },
    verification_checks: Array.isArray(plan.verification_checks) ? plan.verification_checks : [],
    rollback_plan: plan.rollback_plan || {},
    actions,
    next_actions: nextActions,
    created_at: new Date().toISOString()
  };

  const payload = {
    mode: 'interactive-work-order-build',
    generated_at: new Date().toISOString(),
    work_order: workOrder,
    inputs: {
      dialogue: dialoguePath ? (path.relative(cwd, dialoguePath) || '.') : null,
      intent: intentPath ? (path.relative(cwd, intentPath) || '.') : null,
      plan: path.relative(cwd, planPath) || '.',
      gate: gatePath ? (path.relative(cwd, gatePath) || '.') : null,
      runtime: runtimePath ? (path.relative(cwd, runtimePath) || '.') : null,
      authorization_tier: authorizationTierPath ? (path.relative(cwd, authorizationTierPath) || '.') : null,
      approval_state: approvalStatePath ? (path.relative(cwd, approvalStatePath) || '.') : null
    },
    output: {
      json: path.relative(cwd, outPath) || '.',
      markdown: path.relative(cwd, markdownOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(payload), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive work-order generated: ${workOrder.status}\n`);
    process.stdout.write(`- Work-order: ${workOrder.work_order_id}\n`);
    process.stdout.write(`- JSON: ${payload.output.json}\n`);
    process.stdout.write(`- Markdown: ${payload.output.markdown}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive work-order build failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_OUT,
  DEFAULT_MARKDOWN_OUT,
  parseArgs,
  resolvePath,
  tryReadJsonFile,
  normalizeRiskLevel,
  normalizeDecision,
  normalizeStatus,
  inferWorkOrderStatus,
  inferPriority,
  inferNextActions,
  buildMarkdown,
  main
};
