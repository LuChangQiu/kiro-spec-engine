#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_STATE_FILE = '.kiro/reports/interactive-approval-state.json';
const DEFAULT_AUDIT_FILE = '.kiro/reports/interactive-approval-events.jsonl';

function parseArgs(argv) {
  const options = {
    action: null,
    plan: null,
    stateFile: DEFAULT_STATE_FILE,
    auditFile: DEFAULT_AUDIT_FILE,
    actor: null,
    comment: null,
    force: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--action' && next) {
      options.action = next;
      i += 1;
    } else if (token === '--plan' && next) {
      options.plan = next;
      i += 1;
    } else if (token === '--state-file' && next) {
      options.stateFile = next;
      i += 1;
    } else if (token === '--audit-file' && next) {
      options.auditFile = next;
      i += 1;
    } else if (token === '--actor' && next) {
      options.actor = next;
      i += 1;
    } else if (token === '--comment' && next) {
      options.comment = next;
      i += 1;
    } else if (token === '--force') {
      options.force = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.action) {
    throw new Error('--action is required.');
  }
  const action = `${options.action}`.trim().toLowerCase();
  const allowedActions = new Set([
    'init',
    'submit',
    'approve',
    'reject',
    'execute',
    'verify',
    'archive',
    'status'
  ]);
  if (!allowedActions.has(action)) {
    throw new Error(`--action must be one of: ${Array.from(allowedActions).join(', ')}`);
  }
  options.action = action;

  if (action === 'init' && !options.plan) {
    throw new Error('--plan is required for --action init.');
  }
  if (action !== 'status' && `${options.actor || ''}`.trim().length === 0) {
    throw new Error('--actor is required for mutating actions.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-approval-workflow.js --action <name> [options]',
    '',
    'Actions:',
    '  init, submit, approve, reject, execute, verify, archive, status',
    '',
    'Options:',
    '  --action <name>          Workflow action (required)',
    '  --plan <path>            Change plan JSON (required for init)',
    `  --state-file <path>      Workflow state JSON file (default: ${DEFAULT_STATE_FILE})`,
    `  --audit-file <path>      Workflow events JSONL file (default: ${DEFAULT_AUDIT_FILE})`,
    '  --actor <id>             Actor identifier (required for mutating actions)',
    '  --comment <text>         Optional action comment',
    '  --force                  Allow init to overwrite existing state file',
    '  --json                   Print JSON payload',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function readJsonFile(filePath, label) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const content = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`invalid JSON in ${label}: ${error.message}`);
  }
}

function normalizeRiskLevel(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
}

function createEvent(state, action, actor, comment, fromStatus, toStatus, blocked, reason) {
  return {
    event_id: `event-${crypto.randomUUID()}`,
    workflow_id: state && state.workflow_id ? state.workflow_id : null,
    event_type: blocked ? 'interactive.approval.blocked' : `interactive.approval.${action}`,
    action,
    actor,
    comment: comment || null,
    from_status: fromStatus || null,
    to_status: toStatus || null,
    blocked: blocked === true,
    reason: reason || null,
    timestamp: new Date().toISOString()
  };
}

function toBoolean(value) {
  return value === true;
}

function computeApprovalFlags(plan) {
  const actions = Array.isArray(plan && plan.actions)
    ? plan.actions.filter(item => item && typeof item === 'object')
    : [];
  const riskLevel = normalizeRiskLevel(plan && plan.risk_level);
  const privilegeEscalationDetected = actions.some(item => item.requires_privilege_escalation === true);
  const approvalRequired = (
    riskLevel === 'high' ||
    privilegeEscalationDetected ||
    (plan && plan.approval && plan.approval.status === 'pending') ||
    (plan && plan.approval && plan.approval.status === 'approved')
  );
  const dualApprovalRequired = toBoolean(
    plan && plan.approval && plan.approval.dual_approved === false && privilegeEscalationDetected
  );
  return {
    approval_required: approvalRequired,
    dual_approval_required: dualApprovalRequired,
    privilege_escalation_detected: privilegeEscalationDetected
  };
}

function buildInitialState(plan, actor, comment) {
  const now = new Date().toISOString();
  const flags = computeApprovalFlags(plan);
  const initial = {
    mode: 'interactive-approval-workflow',
    workflow_id: `wf-${crypto.randomUUID()}`,
    plan_id: plan.plan_id || null,
    intent_id: plan.intent_id || null,
    risk_level: normalizeRiskLevel(plan.risk_level),
    execution_mode: `${plan.execution_mode || 'suggestion'}`.trim() || 'suggestion',
    approval_required: flags.approval_required,
    dual_approval_required: flags.dual_approval_required,
    privilege_escalation_detected: flags.privilege_escalation_detected,
    status: 'draft',
    approvals: {
      status: flags.approval_required ? 'pending' : 'not-required',
      approvers: [],
      rejected_by: null
    },
    history: [],
    created_at: now,
    updated_at: now
  };
  const event = createEvent(initial, 'init', actor, comment, null, 'draft', false, null);
  initial.history.push(event);
  return { state: initial, event };
}

function assertTransition(state, fromList, action) {
  if (!fromList.includes(state.status)) {
    return {
      ok: false,
      reason: `cannot ${action} when status is ${state.status}; expected ${fromList.join('|')}`
    };
  }
  return { ok: true, reason: null };
}

function mutateStateForAction(state, options) {
  const actor = `${options.actor || ''}`.trim();
  const comment = options.comment || null;
  const action = options.action;
  const now = new Date().toISOString();
  let fromStatus = state.status;
  let toStatus = state.status;
  let blocked = false;
  let reason = null;

  const fail = (message) => {
    blocked = true;
    reason = message;
  };

  if (action === 'status') {
    fromStatus = state.status;
    toStatus = state.status;
  } else if (action === 'submit') {
    const check = assertTransition(state, ['draft'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      toStatus = 'submitted';
      state.status = toStatus;
      if (state.approval_required && state.approvals.status === 'not-required') {
        state.approvals.status = 'pending';
      }
    }
  } else if (action === 'approve') {
    const check = assertTransition(state, ['submitted'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      toStatus = 'approved';
      state.status = toStatus;
      if (!state.approvals.approvers.includes(actor)) {
        state.approvals.approvers.push(actor);
      }
      state.approvals.status = 'approved';
      state.approvals.rejected_by = null;
    }
  } else if (action === 'reject') {
    const check = assertTransition(state, ['submitted'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      toStatus = 'rejected';
      state.status = toStatus;
      state.approvals.status = 'rejected';
      state.approvals.rejected_by = actor;
    }
  } else if (action === 'execute') {
    const validFrom = ['submitted', 'approved'];
    const check = assertTransition(state, validFrom, action);
    if (!check.ok) {
      fail(check.reason);
    } else if (state.approval_required && state.status !== 'approved') {
      fail('approval required before execute');
    } else {
      toStatus = 'executed';
      state.status = toStatus;
    }
  } else if (action === 'verify') {
    const check = assertTransition(state, ['executed'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      toStatus = 'verified';
      state.status = toStatus;
    }
  } else if (action === 'archive') {
    const check = assertTransition(state, ['verified', 'rejected'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      toStatus = 'archived';
      state.status = toStatus;
    }
  } else {
    fail(`unsupported action: ${action}`);
  }

  const event = createEvent(
    state,
    action,
    actor,
    comment,
    fromStatus,
    blocked ? fromStatus : toStatus,
    blocked,
    reason
  );
  state.history.push(event);
  state.updated_at = now;
  return { blocked, reason, event };
}

async function appendAuditLine(auditPath, event) {
  await fs.ensureDir(path.dirname(auditPath));
  await fs.appendFile(auditPath, `${JSON.stringify(event)}\n`, 'utf8');
}

function buildOutput(state, options, statePath, auditPath, decision, reason) {
  return {
    mode: 'interactive-approval-workflow',
    generated_at: new Date().toISOString(),
    action: options.action,
    actor: options.actor || null,
    decision,
    reason: reason || null,
    state,
    output: {
      state: path.relative(process.cwd(), statePath) || '.',
      audit: path.relative(process.cwd(), auditPath) || '.'
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const statePath = resolvePath(cwd, options.stateFile);
  const auditPath = resolvePath(cwd, options.auditFile);

  if (options.action === 'init') {
    if ((await fs.pathExists(statePath)) && !options.force) {
      throw new Error(`state file already exists; use --force to re-init: ${statePath}`);
    }
    const planPath = resolvePath(cwd, options.plan);
    const plan = await readJsonFile(planPath, 'plan');
    const { state, event } = buildInitialState(plan, options.actor, options.comment);
    await fs.ensureDir(path.dirname(statePath));
    await fs.writeJson(statePath, state, { spaces: 2 });
    await appendAuditLine(auditPath, event);
    const payload = buildOutput(state, options, statePath, auditPath, 'ok', null);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`Interactive approval workflow initialized: ${state.workflow_id}\n`);
      process.stdout.write(`- State: ${payload.output.state}\n`);
      process.stdout.write(`- Audit: ${payload.output.audit}\n`);
    }
    return;
  }

  if (!(await fs.pathExists(statePath))) {
    throw new Error(`state file not found: ${statePath}`);
  }
  const state = await readJsonFile(statePath, 'state-file');

  if (options.action === 'status') {
    const payload = buildOutput(state, options, statePath, auditPath, 'ok', null);
    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`Interactive approval status: ${state.status}\n`);
      process.stdout.write(`- State: ${payload.output.state}\n`);
    }
    return;
  }

  const result = mutateStateForAction(state, options);
  await fs.ensureDir(path.dirname(statePath));
  await fs.writeJson(statePath, state, { spaces: 2 });
  await appendAuditLine(auditPath, result.event);
  const payload = buildOutput(
    state,
    options,
    statePath,
    auditPath,
    result.blocked ? 'blocked' : 'ok',
    result.reason
  );

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive approval action ${options.action}: ${payload.decision}\n`);
    process.stdout.write(`- Status: ${state.status}\n`);
    if (payload.reason) {
      process.stdout.write(`- Reason: ${payload.reason}\n`);
    }
    process.stdout.write(`- State: ${payload.output.state}\n`);
    process.stdout.write(`- Audit: ${payload.output.audit}\n`);
  }

  if (result.blocked) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Interactive approval workflow failed: ${error.message}`);
  process.exit(1);
});
