'use strict';

const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const { createMoquiAdapterHandler } = require('../scene-runtime/moqui-adapter');
const {
  evaluatePlanGate,
  DEFAULT_POLICY,
  DEFAULT_CATALOG
} = require('./change-plan-gate-core');

const ADAPTER_TYPE = 'moqui-interactive-adapter';
const ADAPTER_VERSION = '1.0.0';

const DEFAULT_EXECUTION_RECORD_OUT = '.sce/reports/interactive-execution-record.latest.json';
const DEFAULT_EXECUTION_LEDGER_OUT = '.sce/reports/interactive-execution-ledger.jsonl';

const SUPPORTED_ACTION_TYPES = [
  'analysis_only',
  'workflow_approval_chain_change',
  'update_rule_threshold',
  'ui_form_field_adjust',
  'inventory_adjustment_bulk',
  'payment_rule_change',
  'bulk_delete_without_filter',
  'permission_grant_super_admin',
  'credential_export'
];

function normalizeText(value) {
  return `${value || ''}`.trim();
}

function resolvePath(projectRoot, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(projectRoot, filePath);
}

function pickContextValue(context, fallback, field) {
  if (context && context[field] != null) {
    return context[field];
  }
  if (fallback && fallback[field] != null) {
    return fallback[field];
  }
  return null;
}

function inferActionTypes(changeIntent, context) {
  const goalText = normalizeText(changeIntent && changeIntent.business_goal).toLowerCase();
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
  if (['bulk_delete_without_filter'].includes(type)) {
    base.irreversible = true;
  }

  return base;
}

function inferRiskLevel(actions, changeIntent, context) {
  const goalText = normalizeText(changeIntent && changeIntent.business_goal).toLowerCase();
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

function buildRollbackPlan(actions, nowIso) {
  const irreversible = actions.some(item => item.irreversible);
  return {
    type: irreversible ? 'backup-restore' : 'config-revert',
    reference: irreversible
      ? `backup-required-${nowIso.slice(0, 10)}`
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

function isApproved(changePlan) {
  return (
    changePlan &&
    changePlan.approval &&
    typeof changePlan.approval === 'object' &&
    changePlan.approval.status === 'approved'
  );
}

function buildPlanFromIntent(changeIntent, context, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const idProvider = typeof options.idProvider === 'function'
    ? options.idProvider
    : () => crypto.randomUUID();
  const fallbackContext = changeIntent && changeIntent.context_ref && typeof changeIntent.context_ref === 'object'
    ? changeIntent.context_ref
    : {};
  const normalizedContext = context && typeof context === 'object' ? context : {};
  const executionMode = ['suggestion', 'apply'].includes(`${options.executionMode || ''}`)
    ? `${options.executionMode}`
    : 'suggestion';

  const actionTypes = inferActionTypes(changeIntent, normalizedContext);
  const actions = actionTypes.map((type, index) => actionTemplate(type, index));
  const riskLevel = inferRiskLevel(actions, changeIntent, normalizedContext);
  const rollbackPlan = buildRollbackPlan(actions, nowIso);

  return {
    plan_id: `plan-${idProvider()}`,
    intent_id: normalizeText(changeIntent && changeIntent.intent_id) || `intent-${idProvider()}`,
    risk_level: riskLevel,
    execution_mode: executionMode,
    scope: {
      product: pickContextValue(normalizedContext, fallbackContext, 'product'),
      module: pickContextValue(normalizedContext, fallbackContext, 'module'),
      page: pickContextValue(normalizedContext, fallbackContext, 'page'),
      entity: pickContextValue(normalizedContext, fallbackContext, 'entity'),
      scene_id: pickContextValue(normalizedContext, fallbackContext, 'scene_id')
    },
    actions,
    impact_assessment: summarizeImpact(actions, normalizedContext),
    verification_checks: buildVerificationChecks(actions),
    rollback_plan: rollbackPlan,
    approval: buildApproval(riskLevel, executionMode, actions),
    security: {
      masking_applied: actions.some(item => item.touches_sensitive_data),
      plaintext_secrets_in_payload: false,
      backup_reference: rollbackPlan.type === 'backup-restore'
        ? rollbackPlan.reference
        : undefined
    },
    created_at: nowIso
  };
}

function inferRecordResult(actionResults) {
  const failedCount = actionResults.filter(item => item.status === 'failed').length;
  return failedCount > 0 ? 'failed' : 'success';
}

function summarizeActionDiff(actionResults, runtime) {
  const summaryItems = actionResults.map(item => ({
    action_id: item.action_id || null,
    type: item.type || null,
    mode: item.mode || 'simulate',
    status: item.status || 'failed',
    reason: item.reason || null,
    binding_ref: item.binding_ref || null
  }));

  return {
    action_total: summaryItems.length,
    success_count: summaryItems.filter(item => item.status === 'success').length,
    failed_count: summaryItems.filter(item => item.status === 'failed').length,
    simulated_count: summaryItems.filter(item => item.mode === 'simulate').length,
    live_count: summaryItems.filter(item => item.mode === 'live').length,
    execution_mode: runtime.liveApply ? 'live' : 'simulate',
    dry_run: runtime.dryRun === true,
    action_results: summaryItems
  };
}

function parseExecutionLedger(text) {
  return `${text || ''}`
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

class MoquiInteractiveAdapter {
  constructor(options = {}) {
    this.projectRoot = path.resolve(options.projectRoot || process.cwd());
    this.policyPath = resolvePath(this.projectRoot, options.policyPath || DEFAULT_POLICY);
    this.catalogPath = resolvePath(this.projectRoot, options.catalogPath || DEFAULT_CATALOG);
    this.catalogPathExplicit = Object.prototype.hasOwnProperty.call(options, 'catalogPath');
    this.executionRecordOut = resolvePath(
      this.projectRoot,
      options.executionRecordOut || DEFAULT_EXECUTION_RECORD_OUT
    );
    this.executionLedgerOut = resolvePath(
      this.projectRoot,
      options.executionLedgerOut || DEFAULT_EXECUTION_LEDGER_OUT
    );
    this.defaultLiveApply = options.liveApply === true;
    this.defaultDryRun = options.dryRun !== false;
    this.moquiConfigPath = options.moquiConfigPath || null;
    this.moquiProjectRoot = options.moquiProjectRoot || this.projectRoot;
    this.handlerFactory = typeof options.handlerFactory === 'function'
      ? options.handlerFactory
      : createMoquiAdapterHandler;
    this.moquiHandler = null;
    this.client = options.client || null;
    this.nowProvider = typeof options.nowProvider === 'function'
      ? options.nowProvider
      : () => new Date();
    this.uuidProvider = typeof options.uuidProvider === 'function'
      ? options.uuidProvider
      : () => crypto.randomUUID();
  }

  capabilities() {
    return {
      adapter_type: ADAPTER_TYPE,
      adapter_version: ADAPTER_VERSION,
      runtime: 'moqui',
      supported_change_types: SUPPORTED_ACTION_TYPES.slice(),
      supported_execution_modes: ['suggestion', 'apply'],
      risk_statement: {
        auto_apply_risk_levels: ['low'],
        approval_required_risk_levels: ['medium', 'high'],
        deny_action_types: [
          'credential_export',
          'permission_grant_super_admin',
          'bulk_delete_without_filter'
        ],
        default_execution_mode: 'suggestion'
      },
      interfaces: ['capabilities', 'plan', 'validate', 'apply', 'rollback'],
      default_runtime_behavior: {
        live_apply: this.defaultLiveApply,
        dry_run: this.defaultDryRun
      }
    };
  }

  async plan(changeIntent, context = {}, options = {}) {
    if (!changeIntent || typeof changeIntent !== 'object') {
      throw new Error('changeIntent must be a non-null object');
    }

    const nowIso = this.nowProvider().toISOString();
    return buildPlanFromIntent(changeIntent, context, {
      executionMode: options.executionMode || changeIntent.execution_mode || 'suggestion',
      nowIso,
      idProvider: this.uuidProvider
    });
  }

  async loadPolicyAndCatalog() {
    if (!(await fs.pathExists(this.policyPath))) {
      throw new Error(`policy not found: ${this.policyPath}`);
    }

    const policy = await fs.readJson(this.policyPath);
    const catalogFromPolicy = policy &&
      policy.catalog_policy &&
      typeof policy.catalog_policy.catalog_file === 'string'
      ? resolvePath(this.projectRoot, policy.catalog_policy.catalog_file)
      : null;
    const resolvedCatalogPath = this.catalogPathExplicit
      ? this.catalogPath
      : (catalogFromPolicy || this.catalogPath);

    if (!(await fs.pathExists(resolvedCatalogPath))) {
      throw new Error(`catalog not found: ${resolvedCatalogPath}`);
    }

    const catalog = await fs.readJson(resolvedCatalogPath);
    return {
      policy,
      catalog,
      policyPath: this.policyPath,
      catalogPath: resolvedCatalogPath
    };
  }

  async validate(changePlan) {
    if (!changePlan || typeof changePlan !== 'object') {
      throw new Error('changePlan must be a non-null object');
    }

    const bundle = await this.loadPolicyAndCatalog();
    const evaluation = evaluatePlanGate(changePlan, bundle.policy, bundle.catalog);
    return {
      adapter_type: ADAPTER_TYPE,
      validated_at: this.nowProvider().toISOString(),
      policy_path: path.relative(this.projectRoot, bundle.policyPath) || '.',
      catalog_path: path.relative(this.projectRoot, bundle.catalogPath) || '.',
      ...evaluation
    };
  }

  getMoquiHandler() {
    if (!this.moquiHandler) {
      this.moquiHandler = this.handlerFactory({
        configPath: this.moquiConfigPath,
        projectRoot: this.moquiProjectRoot,
        client: this.client
      });
    }
    return this.moquiHandler;
  }

  async executeAction(action, runtime) {
    const result = {
      action_id: action && action.action_id ? action.action_id : null,
      type: action && action.type ? action.type : null,
      mode: runtime.liveApply ? 'live' : 'simulate',
      status: 'success',
      reason: null,
      binding_ref: null
    };

    if (!runtime.liveApply || runtime.dryRun) {
      return result;
    }

    const bindingRef = normalizeText(
      action && (action.binding_ref || action.moqui_binding_ref || action.bindingRef)
    );

    result.binding_ref = bindingRef || null;

    if (!bindingRef) {
      result.status = 'failed';
      result.reason = 'live apply requires action.binding_ref';
      return result;
    }

    const handler = this.getMoquiHandler();
    const payload = action && typeof action.payload === 'object' ? action.payload : {};
    const response = await handler.execute({ binding_ref: bindingRef }, payload);

    if (!response || response.status !== 'success') {
      const errorMessage = response && response.error && response.error.message
        ? response.error.message
        : 'moqui execution failed';
      result.status = 'failed';
      result.reason = errorMessage;
    }

    return result;
  }

  buildExecutionRecord(changePlan, validation, actionResults, overrides = {}) {
    const executionId = normalizeText(overrides.executionId) || `exec-${this.uuidProvider()}`;
    const auditTraceId = normalizeText(overrides.auditTraceId) || `audit-${this.uuidProvider()}`;
    const nowIso = this.nowProvider().toISOString();
    const result = normalizeText(overrides.result) || inferRecordResult(actionResults);
    const rollbackRef = result === 'success'
      ? `rollback-${executionId}`
      : (normalizeText(overrides.rollbackRef) || null);

    const record = {
      execution_id: executionId,
      plan_id: normalizeText(changePlan && changePlan.plan_id) || 'unknown-plan',
      adapter_type: ADAPTER_TYPE,
      policy_decision: validation && validation.decision ? validation.decision : 'deny',
      approval_snapshot: changePlan && changePlan.approval ? changePlan.approval : {},
      diff_summary: summarizeActionDiff(actionResults, overrides.runtime || {}),
      result,
      rollback_ref: rollbackRef,
      audit_trace_id: auditTraceId,
      executed_at: nowIso
    };

    if (overrides.validationSnapshot) {
      record.validation_snapshot = overrides.validationSnapshot;
    }

    return record;
  }

  async persistExecutionRecord(record) {
    await fs.ensureDir(path.dirname(this.executionRecordOut));
    await fs.writeJson(this.executionRecordOut, record, { spaces: 2 });

    await fs.ensureDir(path.dirname(this.executionLedgerOut));
    await fs.appendFile(this.executionLedgerOut, `${JSON.stringify(record)}\n`, 'utf8');
  }

  async apply(changePlan, options = {}) {
    if (!changePlan || typeof changePlan !== 'object') {
      throw new Error('changePlan must be a non-null object');
    }

    const runtime = {
      liveApply: options.liveApply === true ? true : this.defaultLiveApply,
      dryRun: options.dryRun === false ? false : this.defaultDryRun
    };

    const validation = await this.validate(changePlan);

    if (validation.decision === 'deny') {
      const blocked = this.buildExecutionRecord(
        changePlan,
        validation,
        [],
        {
          result: 'failed',
          rollbackRef: null,
          validationSnapshot: validation,
          runtime
        }
      );
      blocked.diff_summary.reason = 'blocked by policy gate (deny)';
      await this.persistExecutionRecord(blocked);
      return { blocked: true, reason: blocked.diff_summary.reason, record: blocked, validation };
    }

    if (validation.decision === 'review-required' && !isApproved(changePlan)) {
      const blocked = this.buildExecutionRecord(
        changePlan,
        validation,
        [],
        {
          result: 'skipped',
          rollbackRef: null,
          validationSnapshot: validation,
          runtime
        }
      );
      blocked.diff_summary.reason = 'approval required before apply';
      await this.persistExecutionRecord(blocked);
      return { blocked: true, reason: blocked.diff_summary.reason, record: blocked, validation };
    }

    if (
      changePlan.execution_mode === 'suggestion' &&
      options.allowSuggestionApply !== true
    ) {
      const skipped = this.buildExecutionRecord(
        changePlan,
        validation,
        [],
        {
          result: 'skipped',
          rollbackRef: null,
          validationSnapshot: validation,
          runtime
        }
      );
      skipped.diff_summary.reason = 'plan is in suggestion mode; set allowSuggestionApply to execute';
      await this.persistExecutionRecord(skipped);
      return { blocked: true, reason: skipped.diff_summary.reason, record: skipped, validation };
    }

    const actions = Array.isArray(changePlan.actions)
      ? changePlan.actions.filter(item => item && typeof item === 'object')
      : [];
    const actionResults = [];

    for (const action of actions) {
      const actionResult = await this.executeAction(action, runtime);
      actionResults.push(actionResult);
    }

    const record = this.buildExecutionRecord(changePlan, validation, actionResults, {
      runtime,
      validationSnapshot: validation
    });
    await this.persistExecutionRecord(record);

    return {
      blocked: false,
      reason: null,
      record,
      validation,
      action_results: actionResults
    };
  }

  async applyLowRisk(changePlan, options = {}) {
    if (!changePlan || typeof changePlan !== 'object') {
      throw new Error('changePlan must be a non-null object');
    }

    const runtime = {
      liveApply: options.liveApply === true ? true : this.defaultLiveApply,
      dryRun: options.dryRun === false ? false : this.defaultDryRun
    };

    const validation = await this.validate(changePlan);
    const riskLevel = normalizeText(changePlan.risk_level).toLowerCase();

    if (validation.decision !== 'allow' || riskLevel !== 'low') {
      const blocked = this.buildExecutionRecord(
        changePlan,
        validation,
        [],
        {
          result: 'skipped',
          rollbackRef: null,
          validationSnapshot: validation,
          runtime
        }
      );
      blocked.diff_summary.reason = 'low-risk apply accepts only risk_level=low and gate decision=allow';
      await this.persistExecutionRecord(blocked);
      return {
        blocked: true,
        reason: blocked.diff_summary.reason,
        record: blocked,
        validation
      };
    }

    return this.apply(changePlan, {
      ...options,
      liveApply: runtime.liveApply,
      dryRun: runtime.dryRun
    });
  }

  async readLedger() {
    if (!(await fs.pathExists(this.executionLedgerOut))) {
      return [];
    }
    const content = await fs.readFile(this.executionLedgerOut, 'utf8');
    return parseExecutionLedger(content);
  }

  async rollback(executionId) {
    const targetExecutionId = normalizeText(executionId);
    if (!targetExecutionId) {
      throw new Error('executionId is required');
    }

    const ledger = await this.readLedger();
    const target = ledger.find(item => item && item.execution_id === targetExecutionId);

    if (!target) {
      const missingRecord = {
        execution_id: `exec-${this.uuidProvider()}`,
        plan_id: 'unknown-plan',
        adapter_type: ADAPTER_TYPE,
        policy_decision: 'deny',
        approval_snapshot: {},
        diff_summary: {
          reason: `execution_id not found: ${targetExecutionId}`
        },
        result: 'failed',
        rollback_ref: targetExecutionId,
        audit_trace_id: `audit-${this.uuidProvider()}`,
        executed_at: this.nowProvider().toISOString()
      };
      await this.persistExecutionRecord(missingRecord);
      return {
        found: false,
        record: missingRecord
      };
    }

    const rollbackRecord = {
      execution_id: `exec-${this.uuidProvider()}`,
      plan_id: target.plan_id || 'unknown-plan',
      adapter_type: ADAPTER_TYPE,
      policy_decision: target.policy_decision || 'review-required',
      approval_snapshot: target.approval_snapshot || {},
      diff_summary: {
        rollback_of_execution_id: targetExecutionId,
        rollback_scope: target.diff_summary || {},
        note: 'rollback recorded as controlled simulation'
      },
      result: 'rolled-back',
      rollback_ref: targetExecutionId,
      audit_trace_id: `audit-${this.uuidProvider()}`,
      executed_at: this.nowProvider().toISOString()
    };
    rollbackRecord.validation_snapshot = target.validation_snapshot || null;

    await this.persistExecutionRecord(rollbackRecord);
    return {
      found: true,
      record: rollbackRecord,
      source: target
    };
  }
}

module.exports = {
  ADAPTER_TYPE,
  ADAPTER_VERSION,
  DEFAULT_EXECUTION_RECORD_OUT,
  DEFAULT_EXECUTION_LEDGER_OUT,
  SUPPORTED_ACTION_TYPES,
  buildPlanFromIntent,
  parseExecutionLedger,
  MoquiInteractiveAdapter
};
