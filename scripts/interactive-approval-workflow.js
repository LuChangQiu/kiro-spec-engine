#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_STATE_FILE = '.kiro/reports/interactive-approval-state.json';
const DEFAULT_AUDIT_FILE = '.kiro/reports/interactive-approval-events.jsonl';
const DEFAULT_PASSWORD_HASH_ENV = 'SCE_INTERACTIVE_AUTH_PASSWORD_SHA256';
const DEFAULT_PASSWORD_TTL_SECONDS = 600;
const PASSWORD_SCOPES = new Set(['approve', 'execute']);
const WORKFLOW_ACTIONS = new Set([
  'init',
  'submit',
  'approve',
  'reject',
  'execute',
  'verify',
  'archive',
  'status'
]);
const ROLE_SCOPED_ACTIONS = new Set(['submit', 'approve', 'reject', 'execute', 'verify', 'archive']);

function parseArgs(argv) {
  const options = {
    action: null,
    plan: null,
    stateFile: DEFAULT_STATE_FILE,
    auditFile: DEFAULT_AUDIT_FILE,
    actor: null,
    comment: null,
    force: false,
    actorRole: null,
    rolePolicy: null,
    password: null,
    passwordHash: null,
    passwordHashEnv: null,
    passwordRequired: false,
    passwordScope: null,
    passwordTtlSeconds: null,
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
    } else if (token === '--actor-role' && next) {
      options.actorRole = next;
      i += 1;
    } else if (token === '--role-policy' && next) {
      options.rolePolicy = next;
      i += 1;
    } else if (token === '--force') {
      options.force = true;
    } else if (token === '--password' && next) {
      options.password = next;
      i += 1;
    } else if (token === '--password-hash' && next) {
      options.passwordHash = next;
      i += 1;
    } else if (token === '--password-hash-env' && next) {
      options.passwordHashEnv = next;
      i += 1;
    } else if (token === '--password-required') {
      options.passwordRequired = true;
    } else if (token === '--password-scope' && next) {
      options.passwordScope = next;
      i += 1;
    } else if (token === '--password-ttl-seconds' && next) {
      options.passwordTtlSeconds = Number(next);
      i += 1;
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
  if (!WORKFLOW_ACTIONS.has(action)) {
    throw new Error(`--action must be one of: ${Array.from(WORKFLOW_ACTIONS).join(', ')}`);
  }
  options.action = action;

  if (action === 'init' && !options.plan) {
    throw new Error('--plan is required for --action init.');
  }
  if (action !== 'status' && `${options.actor || ''}`.trim().length === 0) {
    throw new Error('--actor is required for mutating actions.');
  }

  if (options.passwordHash && !isSha256Hash(options.passwordHash)) {
    throw new Error('--password-hash must be a sha256 hex string (64 chars).');
  }
  if (options.passwordHashEnv != null && `${options.passwordHashEnv || ''}`.trim().length === 0) {
    throw new Error('--password-hash-env cannot be empty.');
  }
  if (options.actorRole != null && `${options.actorRole || ''}`.trim().length === 0) {
    throw new Error('--actor-role cannot be empty.');
  }
  if (options.rolePolicy != null && `${options.rolePolicy || ''}`.trim().length === 0) {
    throw new Error('--role-policy cannot be empty.');
  }
  if (options.passwordScope != null) {
    options.passwordScope = parsePasswordScope(options.passwordScope, '--password-scope');
  }
  if (options.passwordTtlSeconds != null) {
    if (!Number.isFinite(options.passwordTtlSeconds) || options.passwordTtlSeconds <= 0) {
      throw new Error('--password-ttl-seconds must be a positive number.');
    }
  }

  options.passwordHash = options.passwordHash ? options.passwordHash.trim().toLowerCase() : null;
  options.passwordHashEnv = options.passwordHashEnv ? options.passwordHashEnv.trim() : null;
  options.actorRole = options.actorRole ? options.actorRole.trim().toLowerCase() : null;
  options.rolePolicy = options.rolePolicy ? options.rolePolicy.trim() : null;
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
    '  --action <name>              Workflow action (required)',
    '  --plan <path>                Change plan JSON (required for init)',
    `  --state-file <path>          Workflow state JSON file (default: ${DEFAULT_STATE_FILE})`,
    `  --audit-file <path>          Workflow events JSONL file (default: ${DEFAULT_AUDIT_FILE})`,
    '  --actor <id>                 Actor identifier (required for mutating actions)',
    '  --actor-role <name>          Actor role identifier for role-policy checks',
    '  --role-policy <path>         Role policy JSON path (optional; enables role checks)',
    '  --comment <text>             Optional action comment',
    '  --force                      Allow init to overwrite existing state file',
    '  --password <text>            One-time password input (for password-protected actions)',
    '  --password-hash <sha256>     Password verifier hash override for init',
    `  --password-hash-env <name>   Environment variable that stores password hash (default: ${DEFAULT_PASSWORD_HASH_ENV})`,
    '  --password-required          Force password authorization requirement in init',
    '  --password-scope <csv>       Password scope override: approve,execute',
    `  --password-ttl-seconds <n>   Password verification TTL seconds (default: ${DEFAULT_PASSWORD_TTL_SECONDS})`,
    '  --json                       Print JSON payload',
    '  -h, --help                   Show this help'
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

async function resolveRoleRequirements(cwd, options, plan) {
  let fromPolicy = {};
  if (options.rolePolicy) {
    const rolePolicyPath = resolvePath(cwd, options.rolePolicy);
    const rolePolicy = await readJsonFile(rolePolicyPath, 'role-policy');
    const policyRoles = rolePolicy && rolePolicy.role_requirements && typeof rolePolicy.role_requirements === 'object'
      ? rolePolicy.role_requirements
      : {};
    fromPolicy = normalizeRoleRequirements(policyRoles);
  }

  const planAuthorization = plan && plan.authorization && typeof plan.authorization === 'object'
    ? plan.authorization
    : {};
  const fromPlan = normalizeRoleRequirements(planAuthorization.role_requirements || {});
  return mergeRoleRequirements(fromPolicy, fromPlan);
}

function normalizeRiskLevel(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
}

function createEvent(state, action, actor, actorRole, comment, fromStatus, toStatus, blocked, reason) {
  return {
    event_id: `event-${crypto.randomUUID()}`,
    workflow_id: state && state.workflow_id ? state.workflow_id : null,
    event_type: blocked ? 'interactive.approval.blocked' : `interactive.approval.${action}`,
    action,
    actor,
    actor_role: actorRole || null,
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

function isSha256Hash(value) {
  return /^[a-fA-F0-9]{64}$/.test(`${value || ''}`.trim());
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function parsePasswordScope(value, label = 'password scope') {
  const tokens = `${value || ''}`
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  const unique = Array.from(new Set(tokens));
  const invalid = unique.filter(item => !PASSWORD_SCOPES.has(item));
  if (invalid.length > 0) {
    throw new Error(`${label} supports only: approve, execute`);
  }
  return unique;
}

function normalizePasswordScope(value, fallback = []) {
  if (Array.isArray(value)) {
    const normalized = value
      .map(item => `${item || ''}`.trim().toLowerCase())
      .filter(item => PASSWORD_SCOPES.has(item));
    return Array.from(new Set(normalized));
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      return parsePasswordScope(value);
    } catch (_error) {
      return [...fallback];
    }
  }
  return [...fallback];
}

function normalizeRoleName(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => normalizeRoleName(item)).filter(Boolean)));
  }
  if (typeof value === 'string' && value.trim()) {
    return Array.from(new Set(
      value
        .split(',')
        .map(item => normalizeRoleName(item))
        .filter(Boolean)
    ));
  }
  return [];
}

function normalizeRoleRequirements(value = {}) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const normalized = {};
  for (const key of Object.keys(value)) {
    const action = normalizeRoleName(key);
    if (!ROLE_SCOPED_ACTIONS.has(action)) {
      continue;
    }
    const roles = normalizeRoleList(value[key]);
    if (roles.length > 0) {
      normalized[action] = roles;
    }
  }
  return normalized;
}

function mergeRoleRequirements(base = {}, override = {}) {
  const merged = { ...base };
  const normalizedOverride = normalizeRoleRequirements(override);
  for (const action of Object.keys(normalizedOverride)) {
    merged[action] = normalizedOverride[action];
  }
  return merged;
}

function resolvePasswordTtlSeconds(optionsTtl, planTtl) {
  const fromOptions = Number(optionsTtl);
  if (Number.isFinite(fromOptions) && fromOptions > 0) {
    return Math.floor(fromOptions);
  }
  const fromPlan = Number(planTtl);
  if (Number.isFinite(fromPlan) && fromPlan > 0) {
    return Math.floor(fromPlan);
  }
  return DEFAULT_PASSWORD_TTL_SECONDS;
}

function isMutatingPlanAction(item) {
  return `${item && item.type ? item.type : ''}`.trim().toLowerCase() !== 'analysis_only';
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

function computeAuthorization(plan, options = {}) {
  const authorization = plan && plan.authorization && typeof plan.authorization === 'object'
    ? plan.authorization
    : {};
  const actions = Array.isArray(plan && plan.actions)
    ? plan.actions.filter(item => item && typeof item === 'object')
    : [];
  const executionMode = `${plan && plan.execution_mode ? plan.execution_mode : ''}`.trim().toLowerCase();
  const mutating = actions.some(item => isMutatingPlanAction(item));

  const passwordRequired = (
    options.passwordRequired === true ||
    authorization.password_required === true ||
    (executionMode === 'apply' && mutating)
  );
  const passwordScope = passwordRequired
    ? (
      (Array.isArray(options.passwordScope) && options.passwordScope.length > 0)
        ? [...options.passwordScope]
        : normalizePasswordScope(authorization.password_scope, ['execute'])
    )
    : [];
  const passwordHash = options.passwordHash
    ? options.passwordHash
    : (isSha256Hash(authorization.password_hash) ? String(authorization.password_hash).trim().toLowerCase() : null);
  const passwordHashEnv = options.passwordHashEnv
    ? options.passwordHashEnv
    : `${authorization.password_hash_env || DEFAULT_PASSWORD_HASH_ENV}`.trim() || DEFAULT_PASSWORD_HASH_ENV;
  const passwordTtlSeconds = resolvePasswordTtlSeconds(options.passwordTtlSeconds, authorization.password_ttl_seconds);
  const reasonCodes = Array.isArray(authorization.reason_codes)
    ? authorization.reason_codes.map(item => `${item || ''}`.trim()).filter(Boolean)
    : [];
  const roleRequirements = normalizeRoleRequirements(options.roleRequirements || authorization.role_requirements || {});

  return {
    password_required: passwordRequired,
    password_scope: passwordScope,
    password_hash: passwordHash,
    password_hash_env: passwordHashEnv,
    password_ttl_seconds: passwordTtlSeconds,
    password_verified: false,
    password_verified_at: null,
    password_verified_by: null,
    password_expires_at: null,
    reason_codes: reasonCodes,
    role_requirements: roleRequirements
  };
}

function buildInitialState(plan, actor, comment, options) {
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
    authorization: computeAuthorization(plan, options),
    history: [],
    created_at: now,
    updated_at: now
  };
  const event = createEvent(
    initial,
    'init',
    actor,
    options && options.actorRole ? options.actorRole : null,
    comment,
    null,
    'draft',
    false,
    null
  );
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

function resolveVerifierHash(state, env = process.env) {
  const authorization = state && state.authorization && typeof state.authorization === 'object'
    ? state.authorization
    : {};
  if (authorization.password_hash && isSha256Hash(authorization.password_hash)) {
    return String(authorization.password_hash).trim().toLowerCase();
  }
  const envName = `${authorization.password_hash_env || DEFAULT_PASSWORD_HASH_ENV}`.trim();
  const fromEnv = env && Object.prototype.hasOwnProperty.call(env, envName)
    ? `${env[envName] || ''}`.trim().toLowerCase()
    : '';
  if (isSha256Hash(fromEnv)) {
    return fromEnv;
  }
  return null;
}

function isPasswordVerificationActive(authorization, nowMs) {
  if (!authorization || authorization.password_verified !== true) {
    return false;
  }
  const expires = authorization.password_expires_at
    ? Date.parse(authorization.password_expires_at)
    : Number.NaN;
  if (!Number.isFinite(expires)) {
    return false;
  }
  return nowMs < expires;
}

function requirePasswordForAction(state, options, action, nowIso) {
  const authorization = state && state.authorization && typeof state.authorization === 'object'
    ? state.authorization
    : {};
  const scope = normalizePasswordScope(authorization.password_scope, []);
  if (authorization.password_required !== true || !scope.includes(action)) {
    return { ok: true, reason: null };
  }

  const nowMs = Date.parse(nowIso);
  if (isPasswordVerificationActive(authorization, nowMs)) {
    return { ok: true, reason: null };
  }

  const verifierHash = resolveVerifierHash(state, process.env);
  if (!verifierHash) {
    return {
      ok: false,
      reason: 'password authorization required but verifier hash is not configured'
    };
  }

  const candidate = `${options.password || ''}`;
  if (!candidate.trim()) {
    return {
      ok: false,
      reason: `password authorization required for ${action}`
    };
  }

  const candidateHash = sha256(candidate).toLowerCase();
  if (candidateHash !== verifierHash) {
    return {
      ok: false,
      reason: 'password authorization failed'
    };
  }

  const ttlSeconds = resolvePasswordTtlSeconds(
    authorization.password_ttl_seconds,
    DEFAULT_PASSWORD_TTL_SECONDS
  );
  authorization.password_verified = true;
  authorization.password_verified_by = `${options.actor || ''}`.trim() || null;
  authorization.password_verified_at = nowIso;
  authorization.password_expires_at = new Date(nowMs + (ttlSeconds * 1000)).toISOString();
  state.authorization = authorization;
  return { ok: true, reason: null };
}

function requireRoleForAction(state, options, action) {
  const authorization = state && state.authorization && typeof state.authorization === 'object'
    ? state.authorization
    : {};
  const roleRequirements = authorization && authorization.role_requirements && typeof authorization.role_requirements === 'object'
    ? authorization.role_requirements
    : {};
  const allowedRoles = normalizeRoleList(roleRequirements[action]);
  if (allowedRoles.length === 0) {
    return { ok: true, reason: null };
  }

  const actorRole = normalizeRoleName(options && options.actorRole);
  if (!actorRole) {
    return {
      ok: false,
      reason: `actor role required for ${action}; allowed roles: ${allowedRoles.join(', ')}`
    };
  }
  if (!allowedRoles.includes(actorRole)) {
    return {
      ok: false,
      reason: `actor role "${actorRole}" is not allowed for ${action}; allowed roles: ${allowedRoles.join(', ')}`
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
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        toStatus = 'submitted';
        state.status = toStatus;
        if (state.approval_required && state.approvals.status === 'not-required') {
          state.approvals.status = 'pending';
        }
      }
    }
  } else if (action === 'approve') {
    const check = assertTransition(state, ['submitted'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        const auth = requirePasswordForAction(state, options, action, now);
        if (!auth.ok) {
          fail(auth.reason);
        } else {
          toStatus = 'approved';
          state.status = toStatus;
          if (!state.approvals.approvers.includes(actor)) {
            state.approvals.approvers.push(actor);
          }
          state.approvals.status = 'approved';
          state.approvals.rejected_by = null;
        }
      }
    }
  } else if (action === 'reject') {
    const check = assertTransition(state, ['submitted'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        toStatus = 'rejected';
        state.status = toStatus;
        state.approvals.status = 'rejected';
        state.approvals.rejected_by = actor;
      }
    }
  } else if (action === 'execute') {
    const validFrom = ['submitted', 'approved'];
    const check = assertTransition(state, validFrom, action);
    if (!check.ok) {
      fail(check.reason);
    } else if (state.approval_required && state.status !== 'approved') {
      fail('approval required before execute');
    } else {
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        const auth = requirePasswordForAction(state, options, action, now);
        if (!auth.ok) {
          fail(auth.reason);
        } else {
          toStatus = 'executed';
          state.status = toStatus;
        }
      }
    }
  } else if (action === 'verify') {
    const check = assertTransition(state, ['executed'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        toStatus = 'verified';
        state.status = toStatus;
      }
    }
  } else if (action === 'archive') {
    const check = assertTransition(state, ['verified', 'rejected'], action);
    if (!check.ok) {
      fail(check.reason);
    } else {
      const roleCheck = requireRoleForAction(state, options, action);
      if (!roleCheck.ok) {
        fail(roleCheck.reason);
      } else {
        toStatus = 'archived';
        state.status = toStatus;
      }
    }
  } else {
    fail(`unsupported action: ${action}`);
  }

  const event = createEvent(
    state,
    action,
    actor,
    options && options.actorRole ? options.actorRole : null,
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

function buildAuthorizationSummary(state) {
  const authorization = state && state.authorization && typeof state.authorization === 'object'
    ? state.authorization
    : {};
  return {
    password_required: authorization.password_required === true,
    password_scope: Array.isArray(authorization.password_scope) ? authorization.password_scope : [],
    password_verified: authorization.password_verified === true,
    password_verified_at: authorization.password_verified_at || null,
    password_expires_at: authorization.password_expires_at || null,
    password_hash_env: authorization.password_hash_env || DEFAULT_PASSWORD_HASH_ENV,
    verifier_configured: Boolean(resolveVerifierHash(state, process.env)),
    role_requirements: normalizeRoleRequirements(authorization.role_requirements || {})
  };
}

function buildOutput(state, options, statePath, auditPath, decision, reason) {
  const publicState = JSON.parse(JSON.stringify(state || {}));
  if (
    publicState.authorization &&
    typeof publicState.authorization === 'object' &&
    publicState.authorization.password_hash
  ) {
    publicState.authorization.password_hash = '***';
  }
  return {
    mode: 'interactive-approval-workflow',
    generated_at: new Date().toISOString(),
    action: options.action,
    actor: options.actor || null,
    actor_role: options.actorRole || null,
    decision,
    reason: reason || null,
    state: publicState,
    authorization: buildAuthorizationSummary(state),
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
    const roleRequirements = await resolveRoleRequirements(cwd, options, plan);
    const initOptions = {
      ...options,
      roleRequirements
    };
    const { state, event } = buildInitialState(plan, options.actor, options.comment, initOptions);
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
    process.stdout.write(`- Password required: ${payload.authorization.password_required ? 'yes' : 'no'}\n`);
    process.stdout.write(`- Password verified: ${payload.authorization.password_verified ? 'yes' : 'no'}\n`);
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
