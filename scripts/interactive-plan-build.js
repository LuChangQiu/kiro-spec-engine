#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_OUT_PLAN = '.kiro/reports/interactive-change-plan.generated.json';
const DEFAULT_OUT_MARKDOWN = '.kiro/reports/interactive-change-plan.generated.md';
const DEFAULT_AUTH_PASSWORD_HASH_ENV = 'SCE_INTERACTIVE_AUTH_PASSWORD_SHA256';
const DEFAULT_AUTH_PASSWORD_TTL_SECONDS = 600;

function parseArgs(argv) {
  const options = {
    intent: null,
    context: null,
    executionMode: 'suggestion',
    outPlan: DEFAULT_OUT_PLAN,
    outMarkdown: DEFAULT_OUT_MARKDOWN,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--intent' && next) {
      options.intent = next;
      i += 1;
    } else if (token === '--context' && next) {
      options.context = next;
      i += 1;
    } else if (token === '--execution-mode' && next) {
      options.executionMode = next;
      i += 1;
    } else if (token === '--out-plan' && next) {
      options.outPlan = next;
      i += 1;
    } else if (token === '--out-markdown' && next) {
      options.outMarkdown = next;
      i += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.intent) {
    throw new Error('--intent is required.');
  }
  if (!['suggestion', 'apply'].includes(`${options.executionMode || ''}`.trim())) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }
  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-plan-build.js --intent <path> [options]',
    '',
    'Options:',
    '  --intent <path>            Change intent JSON file (required)',
    '  --context <path>           Optional page context JSON file',
    '  --execution-mode <mode>    suggestion|apply (default: suggestion)',
    `  --out-plan <path>          Plan JSON output path (default: ${DEFAULT_OUT_PLAN})`,
    `  --out-markdown <path>      Plan markdown output path (default: ${DEFAULT_OUT_MARKDOWN})`,
    '  --json                     Print generated payload to stdout',
    '  -h, --help                 Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolveFile(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function readJsonFile(filePath, label) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const text = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${label}: ${error.message}`);
  }
}

function normalizeText(value) {
  return `${value || ''}`.trim();
}

function inferActionTypes(intent, context) {
  const goalText = normalizeText(intent && intent.business_goal).toLowerCase();
  const moduleText = normalizeText(context && context.module).toLowerCase();
  const entityText = normalizeText(context && context.entity).toLowerCase();
  const merged = `${goalText} ${moduleText} ${entityText}`;

  const actionTypes = [];
  const pushType = (value) => {
    if (!actionTypes.includes(value)) {
      actionTypes.push(value);
    }
  };

  if (/(approval|workflow|escalation|review)/.test(merged)) {
    pushType('workflow_approval_chain_change');
  }
  if (/(rule|threshold|policy|strategy|decision)/.test(merged)) {
    pushType('update_rule_threshold');
  }
  if (/(field|form|layout|ui|screen|page)/.test(merged)) {
    pushType('ui_form_field_adjust');
  }
  if (/(inventory|stock|warehouse|reserve)/.test(merged)) {
    pushType('inventory_adjustment_bulk');
  }
  if (/(payment|refund|billing)/.test(merged)) {
    pushType('payment_rule_change');
  }
  if (/(delete|drop|remove all|truncate)/.test(merged)) {
    pushType('bulk_delete_without_filter');
  }
  if (/(permission|privilege|admin|role)/.test(merged)) {
    pushType('permission_grant_super_admin');
  }
  if (/(token|secret|credential|apikey|password)/.test(merged)) {
    pushType('credential_export');
  }

  if (actionTypes.length === 0) {
    pushType('analysis_only');
  }
  return actionTypes;
}

function actionTemplate(type, index) {
  const base = {
    action_id: `act-${String(index + 1).padStart(3, '0')}`,
    type,
    touches_sensitive_data: false,
    requires_privilege_escalation: false,
    irreversible: false
  };

  if (['payment_rule_change', 'credential_export'].includes(type)) {
    base.touches_sensitive_data = true;
  }
  if (['permission_grant_super_admin'].includes(type)) {
    base.requires_privilege_escalation = true;
  }
  if (['bulk_delete_without_filter', 'raw_sql_destructive'].includes(type)) {
    base.irreversible = true;
  }
  return base;
}

function inferRiskLevel(actions, intent, context) {
  const goalText = normalizeText(intent && intent.business_goal).toLowerCase();
  const actionTypes = actions.map(item => item.type);
  if (
    actionTypes.some(type => [
      'credential_export',
      'permission_grant_super_admin',
      'bulk_delete_without_filter'
    ].includes(type)) ||
    /(delete|privilege|token|secret|credential)/.test(goalText)
  ) {
    return 'high';
  }
  if (
    actionTypes.some(type => [
      'workflow_approval_chain_change',
      'payment_rule_change',
      'inventory_adjustment_bulk'
    ].includes(type)) ||
    /(approval|workflow|payment|inventory|refund)/.test(goalText) ||
    /(payment|inventory)/.test(normalizeText(context && context.module).toLowerCase())
  ) {
    return 'medium';
  }
  return 'low';
}

function buildVerificationChecks(actions) {
  const checks = [];
  const pushCheck = (value) => {
    if (!checks.includes(value)) {
      checks.push(value);
    }
  };

  pushCheck('intent-to-plan consistency review');
  actions.forEach(action => {
    switch (action.type) {
      case 'workflow_approval_chain_change':
        pushCheck('approval workflow regression smoke');
        pushCheck('approval escalation path validation');
        break;
      case 'update_rule_threshold':
        pushCheck('rule threshold snapshot compare');
        break;
      case 'ui_form_field_adjust':
        pushCheck('ui field rendering smoke');
        break;
      case 'inventory_adjustment_bulk':
        pushCheck('inventory non-negative invariant check');
        break;
      case 'payment_rule_change':
        pushCheck('payment authorization regression smoke');
        break;
      case 'bulk_delete_without_filter':
        pushCheck('destructive action simulation in dry-run');
        break;
      default:
        pushCheck('general change smoke validation');
        break;
    }
  });
  return checks;
}

function summarizeImpact(actions, context) {
  const actionTypes = actions.map(item => item.type);
  return {
    business: actionTypes.length === 1 && actionTypes[0] === 'analysis_only'
      ? 'analysis only, no direct business mutation proposed'
      : `potential impact on ${normalizeText(context && context.module) || 'business module'} operations`,
    technical: `generated ${actions.length} action(s): ${actionTypes.join(', ')}`,
    data: actions.some(item => item.touches_sensitive_data)
      ? 'sensitive data path involved; masking and approval required'
      : 'no explicit sensitive data write path detected'
  };
}

function buildRollbackPlan(actions) {
  const irreversible = actions.some(item => item.irreversible);
  return {
    type: irreversible ? 'backup-restore' : 'config-revert',
    reference: irreversible
      ? `backup-required-${new Date().toISOString().slice(0, 10)}`
      : 'previous-config-snapshot',
    note: irreversible
      ? 'irreversible action detected; verified backup is mandatory before apply'
      : 'revert to previous rule/config snapshot'
  };
}

function buildApproval(riskLevel, executionMode, actions) {
  const hasPrivilegeEscalation = actions.some(item => item.requires_privilege_escalation);
  const mustApprove = (
    riskLevel === 'high' ||
    (riskLevel === 'medium' && executionMode === 'apply') ||
    hasPrivilegeEscalation
  );
  return {
    status: mustApprove ? 'pending' : 'not-required',
    dual_approved: false,
    approvers: []
  };
}

function isMutatingAction(actionType) {
  return `${actionType || ''}`.trim().toLowerCase() !== 'analysis_only';
}

function buildAuthorization(actions, executionMode, riskLevel) {
  const mutating = actions.some(action => isMutatingAction(action.type));
  const requiresPrivilegeEscalation = actions.some(action => action.requires_privilege_escalation === true);
  const requiresPassword = mutating && `${executionMode || ''}`.trim().toLowerCase() === 'apply';
  const reasonCodes = [];

  if (requiresPassword) {
    reasonCodes.push('mutating-action-apply-mode');
  }
  if (requiresPrivilegeEscalation) {
    reasonCodes.push('privilege-escalation-detected');
  }
  if (`${riskLevel || ''}`.trim().toLowerCase() === 'high') {
    reasonCodes.push('high-risk-plan');
  }

  return {
    password_required: requiresPassword,
    password_scope: requiresPassword ? ['execute'] : [],
    password_hash_env: DEFAULT_AUTH_PASSWORD_HASH_ENV,
    password_ttl_seconds: DEFAULT_AUTH_PASSWORD_TTL_SECONDS,
    reason_codes: reasonCodes
  };
}

function buildMarkdown(payload) {
  const plan = payload.plan;
  const lines = [];
  lines.push('# Interactive Change Plan (Generated)');
  lines.push('');
  lines.push(`- Generated at: ${payload.generated_at}`);
  lines.push(`- Intent ID: ${plan.intent_id}`);
  lines.push(`- Plan ID: ${plan.plan_id}`);
  lines.push(`- Risk level: ${plan.risk_level}`);
  lines.push(`- Execution mode: ${plan.execution_mode}`);
  lines.push(`- Approval status: ${plan.approval.status}`);
  lines.push(`- Password authorization required: ${plan.authorization.password_required ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push(`- Product: ${plan.scope.product || 'n/a'}`);
  lines.push(`- Module: ${plan.scope.module || 'n/a'}`);
  lines.push(`- Page: ${plan.scope.page || 'n/a'}`);
  lines.push(`- Entity: ${plan.scope.entity || 'n/a'}`);
  lines.push(`- Scene: ${plan.scope.scene_id || 'n/a'}`);
  lines.push('');
  lines.push('## Actions');
  lines.push('');
  lines.push('| Action ID | Type | Sensitive | Privilege Escalation | Irreversible |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const action of plan.actions) {
    lines.push(`| ${action.action_id} | ${action.type} | ${action.touches_sensitive_data ? 'yes' : 'no'} | ${action.requires_privilege_escalation ? 'yes' : 'no'} | ${action.irreversible ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  plan.verification_checks.forEach(item => lines.push(`- ${item}`));
  lines.push('');
  lines.push('## Rollback');
  lines.push('');
  lines.push(`- Type: ${plan.rollback_plan.type}`);
  lines.push(`- Reference: ${plan.rollback_plan.reference}`);
  lines.push(`- Note: ${plan.rollback_plan.note}`);
  lines.push('');
  lines.push('## Authorization');
  lines.push('');
  lines.push(`- Password required: ${plan.authorization.password_required ? 'yes' : 'no'}`);
  lines.push(`- Password scope: ${Array.isArray(plan.authorization.password_scope) && plan.authorization.password_scope.length > 0 ? plan.authorization.password_scope.join(', ') : 'none'}`);
  lines.push(`- Password hash env: ${plan.authorization.password_hash_env || 'n/a'}`);
  lines.push(`- Password TTL (seconds): ${plan.authorization.password_ttl_seconds || 'n/a'}`);
  if (Array.isArray(plan.authorization.reason_codes) && plan.authorization.reason_codes.length > 0) {
    lines.push(`- Reason codes: ${plan.authorization.reason_codes.join(', ')}`);
  }
  lines.push('');
  lines.push('## Gate Command');
  lines.push('');
  lines.push(`- ${payload.gate_hint_command}`);
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const intentPath = resolveFile(cwd, options.intent);
  const contextPath = options.context ? resolveFile(cwd, options.context) : null;
  const outPlanPath = resolveFile(cwd, options.outPlan);
  const outMarkdownPath = resolveFile(cwd, options.outMarkdown);

  const intent = await readJsonFile(intentPath, 'intent');
  const context = contextPath ? await readJsonFile(contextPath, 'context') : (intent.context_ref || {});

  const actionTypes = inferActionTypes(intent, context);
  const actions = actionTypes.map((type, index) => actionTemplate(type, index));
  const riskLevel = inferRiskLevel(actions, intent, context);
  const verificationChecks = buildVerificationChecks(actions);
  const rollbackPlan = buildRollbackPlan(actions);
  const approval = buildApproval(riskLevel, options.executionMode, actions);
  const authorization = buildAuthorization(actions, options.executionMode, riskLevel);
  const security = {
    masking_applied: actions.some(item => item.touches_sensitive_data),
    plaintext_secrets_in_payload: false,
    backup_reference: rollbackPlan.type === 'backup-restore' ? rollbackPlan.reference : undefined
  };

  const plan = {
    plan_id: `plan-${crypto.randomUUID()}`,
    intent_id: intent.intent_id,
    risk_level: riskLevel,
    execution_mode: options.executionMode,
    scope: {
      product: context.product || intent.context_ref && intent.context_ref.product || null,
      module: context.module || intent.context_ref && intent.context_ref.module || null,
      page: context.page || intent.context_ref && intent.context_ref.page || null,
      entity: context.entity || intent.context_ref && intent.context_ref.entity || null,
      scene_id: context.scene_id || intent.context_ref && intent.context_ref.scene_id || null
    },
    actions,
    impact_assessment: summarizeImpact(actions, context),
    verification_checks: verificationChecks,
    rollback_plan: rollbackPlan,
    approval,
    authorization,
    security,
    created_at: new Date().toISOString()
  };

  const payload = {
    mode: 'interactive-plan-build',
    generated_at: plan.created_at,
    input: {
      intent: path.relative(cwd, intentPath) || '.',
      context: contextPath ? (path.relative(cwd, contextPath) || '.') : null
    },
    plan,
    gate_hint_command: `node scripts/interactive-change-plan-gate.js --plan ${path.relative(cwd, outPlanPath) || '.'} --json`,
    output: {
      plan: path.relative(cwd, outPlanPath) || '.',
      markdown: path.relative(cwd, outMarkdownPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPlanPath));
  await fs.writeJson(outPlanPath, plan, { spaces: 2 });
  await fs.ensureDir(path.dirname(outMarkdownPath));
  await fs.writeFile(outMarkdownPath, buildMarkdown(payload), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive change plan generated.\n');
    process.stdout.write(`- Plan: ${payload.output.plan}\n`);
    process.stdout.write(`- Markdown: ${payload.output.markdown}\n`);
  }
}

main().catch((error) => {
  console.error(`Interactive plan build failed: ${error.message}`);
  process.exit(1);
});
