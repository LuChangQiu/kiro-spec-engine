#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_POLICY = 'docs/interactive-customization/runtime-mode-policy-baseline.json';
const DEFAULT_OUT = '.kiro/reports/interactive-runtime-policy.json';
const RISK_ORDER = ['low', 'medium', 'high', 'critical'];

function parseArgs(argv) {
  const options = {
    plan: null,
    uiMode: null,
    runtimeMode: null,
    runtimeEnvironment: null,
    policy: DEFAULT_POLICY,
    out: DEFAULT_OUT,
    failOnNonAllow: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--plan' && next) {
      options.plan = next;
      index += 1;
    } else if (token === '--ui-mode' && next) {
      options.uiMode = `${next}`.trim().toLowerCase();
      index += 1;
    } else if (token === '--runtime-mode' && next) {
      options.runtimeMode = next;
      index += 1;
    } else if (token === '--runtime-environment' && next) {
      options.runtimeEnvironment = next;
      index += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--fail-on-non-allow') {
      options.failOnNonAllow = true;
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
    'Usage: node scripts/interactive-runtime-policy-evaluate.js --plan <path> [options]',
    '',
    'Options:',
    '  --plan <path>                 Change plan JSON file (required)',
    '  --ui-mode <name>              UI surface mode (optional, evaluated when policy.ui_modes is present)',
    '  --runtime-mode <name>         Runtime mode (default from policy defaults.runtime_mode)',
    '  --runtime-environment <name>  Runtime environment (default from policy defaults.runtime_environment)',
    `  --policy <path>               Runtime policy JSON file (default: ${DEFAULT_POLICY})`,
    `  --out <path>                  Report JSON output path (default: ${DEFAULT_OUT})`,
    '  --fail-on-non-allow           Exit code 2 when decision is deny/review-required',
    '  --json                        Print report to stdout',
    '  -h, --help                    Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function normalizeRiskLevel(value, fallback = 'medium') {
  const normalized = `${value || ''}`.trim().toLowerCase();
  return RISK_ORDER.includes(normalized) ? normalized : fallback;
}

function riskRank(value) {
  return RISK_ORDER.indexOf(normalizeRiskLevel(value, 'medium'));
}

function isMutatingAction(action) {
  const actionType = `${action && action.type ? action.type : ''}`.trim().toLowerCase();
  return actionType.length > 0 && actionType !== 'analysis_only';
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

function toUniqueList(values = []) {
  return Array.from(new Set(
    values
      .map(item => `${item || ''}`.trim())
      .filter(Boolean)
  ));
}

function addViolation(violations, severity, code, message, details = {}) {
  violations.push({
    severity,
    code,
    message,
    details
  });
}

function decideFromViolations(violations = []) {
  if (violations.some(item => item && item.severity === 'deny')) {
    return 'deny';
  }
  if (violations.some(item => item && item.severity === 'review')) {
    return 'review-required';
  }
  return 'allow';
}

function evaluateRuntimePolicy({
  plan,
  uiMode,
  runtimeMode,
  runtimeEnvironment,
  policy
}) {
  const normalizedRuntimeMode = `${runtimeMode || ''}`.trim().toLowerCase();
  const normalizedRuntimeEnvironment = `${runtimeEnvironment || ''}`.trim().toLowerCase();
  const normalizedUiMode = `${uiMode || (plan && plan.ui_mode) || ''}`.trim().toLowerCase() || null;

  const modeConfig = policy && policy.modes ? policy.modes[normalizedRuntimeMode] : null;
  const envConfig = policy && policy.environments ? policy.environments[normalizedRuntimeEnvironment] : null;
  const uiModePolicyConfig = policy && policy.ui_modes && typeof policy.ui_modes === 'object'
    ? policy.ui_modes
    : null;
  const hasUiModePolicy = Boolean(uiModePolicyConfig && Object.keys(uiModePolicyConfig).length > 0);
  const uiModeConfig = normalizedUiMode && hasUiModePolicy
    ? uiModePolicyConfig[normalizedUiMode]
    : null;

  if (!modeConfig) {
    throw new Error(`runtime mode not defined in policy: ${normalizedRuntimeMode}`);
  }
  if (!envConfig) {
    throw new Error(`runtime environment not defined in policy: ${normalizedRuntimeEnvironment}`);
  }

  const executionMode = `${plan && plan.execution_mode ? plan.execution_mode : 'suggestion'}`.trim().toLowerCase();
  const riskLevel = normalizeRiskLevel(plan && plan.risk_level, 'medium');
  const actionItems = Array.isArray(plan && plan.actions)
    ? plan.actions.filter(item => item && typeof item === 'object')
    : [];
  const actionTypes = toUniqueList(actionItems.map(item => `${item.type || ''}`.trim().toLowerCase()));
  const mutatingActions = actionItems.filter(item => isMutatingAction(item));
  const mutatingActionTypes = toUniqueList(mutatingActions.map(item => `${item.type || ''}`.trim().toLowerCase()));
  const approvalStatus = `${plan && plan.approval && plan.approval.status ? plan.approval.status : ''}`.trim().toLowerCase();
  const planAuthorization = plan && plan.authorization && typeof plan.authorization === 'object'
    ? plan.authorization
    : {};

  const allowedExecutionModes = toUniqueList(
    Array.isArray(modeConfig.allow_execution_modes)
      ? modeConfig.allow_execution_modes.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );
  const denyActionTypes = toUniqueList(
    Array.isArray(modeConfig.deny_action_types)
      ? modeConfig.deny_action_types.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );
  const reviewRequiredActionTypes = toUniqueList(
    Array.isArray(modeConfig.review_required_action_types)
      ? modeConfig.review_required_action_types.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );
  const approvalRiskLevels = toUniqueList(
    Array.isArray(envConfig.require_approval_for_risk_levels)
      ? envConfig.require_approval_for_risk_levels.map(item => normalizeRiskLevel(item, 'medium'))
      : []
  );
  const uiModeAllowedRuntimeModes = toUniqueList(
    Array.isArray(uiModeConfig && uiModeConfig.allow_runtime_modes)
      ? uiModeConfig.allow_runtime_modes.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );
  const uiModeAllowedExecutionModes = toUniqueList(
    Array.isArray(uiModeConfig && uiModeConfig.allow_execution_modes)
      ? uiModeConfig.allow_execution_modes.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );
  const uiModeDenyExecutionModes = toUniqueList(
    Array.isArray(uiModeConfig && uiModeConfig.deny_execution_modes)
      ? uiModeConfig.deny_execution_modes.map(item => `${item || ''}`.trim().toLowerCase())
      : []
  );

  const maxRiskLevelForApply = normalizeRiskLevel(envConfig.max_risk_level_for_apply, 'high');
  const maxAutoExecuteRiskLevel = normalizeRiskLevel(envConfig.max_auto_execute_risk_level, 'low');
  const requireWorkOrder = modeConfig.require_work_order === true;
  const allowMutatingApply = modeConfig.allow_mutating_apply === true;
  const allowLiveApply = envConfig.allow_live_apply === true;
  const requireDryRunBeforeLiveApply = envConfig.require_dry_run_before_live_apply === true;
  const manualReviewRequiredForApply = envConfig.manual_review_required_for_apply === true && executionMode === 'apply';
  const requirePasswordForApplyMutations = (
    envConfig.require_password_for_apply_mutations === true &&
    executionMode === 'apply' &&
    mutatingActions.length > 0
  );
  const passwordConfigured = planAuthorization.password_required === true;
  const approvalRequired = executionMode === 'apply' && approvalRiskLevels.includes(riskLevel);
  const approvalSatisfied = !approvalRequired || approvalStatus === 'approved';
  const reviewActionHits = actionTypes.filter(type => reviewRequiredActionTypes.includes(type));
  const denyActionHits = actionTypes.filter(type => denyActionTypes.includes(type));

  const violations = [];

  if (!allowedExecutionModes.includes(executionMode)) {
    addViolation(
      violations,
      'deny',
      'execution-mode-not-allowed',
      `execution_mode "${executionMode}" is not allowed in runtime mode "${runtimeMode}"`,
      { execution_mode: executionMode, allowed_execution_modes: allowedExecutionModes }
    );
  }
  if (denyActionHits.length > 0) {
    addViolation(
      violations,
      'deny',
      'deny-action-type-hit',
      'plan contains action types denied by runtime mode policy',
      { action_types: denyActionHits }
    );
  }
  if (normalizedUiMode && hasUiModePolicy && !uiModeConfig) {
    addViolation(
      violations,
      'deny',
      'ui-mode-not-defined',
      `ui_mode "${normalizedUiMode}" is not defined in runtime policy`,
      { ui_mode: normalizedUiMode }
    );
  }
  if (
    normalizedUiMode &&
    uiModeConfig &&
    uiModeAllowedRuntimeModes.length > 0 &&
    !uiModeAllowedRuntimeModes.includes(normalizedRuntimeMode)
  ) {
    addViolation(
      violations,
      'deny',
      'ui-mode-runtime-mode-not-allowed',
      `runtime_mode "${normalizedRuntimeMode}" is not allowed for ui_mode "${normalizedUiMode}"`,
      { ui_mode: normalizedUiMode, runtime_mode: normalizedRuntimeMode, allowed_runtime_modes: uiModeAllowedRuntimeModes }
    );
  }
  if (
    normalizedUiMode &&
    uiModeConfig &&
    uiModeDenyExecutionModes.includes(executionMode)
  ) {
    addViolation(
      violations,
      'deny',
      'ui-mode-execution-mode-denied',
      `execution_mode "${executionMode}" is denied for ui_mode "${normalizedUiMode}"`,
      { ui_mode: normalizedUiMode, execution_mode: executionMode, deny_execution_modes: uiModeDenyExecutionModes }
    );
  }
  if (
    normalizedUiMode &&
    uiModeConfig &&
    uiModeAllowedExecutionModes.length > 0 &&
    !uiModeAllowedExecutionModes.includes(executionMode)
  ) {
    addViolation(
      violations,
      'deny',
      'ui-mode-execution-mode-not-allowed',
      `execution_mode "${executionMode}" is not allowed for ui_mode "${normalizedUiMode}"`,
      { ui_mode: normalizedUiMode, execution_mode: executionMode, allowed_execution_modes: uiModeAllowedExecutionModes }
    );
  }
  if (executionMode === 'apply' && mutatingActions.length > 0 && !allowMutatingApply) {
    addViolation(
      violations,
      'deny',
      'mutating-apply-not-allowed',
      `runtime mode "${runtimeMode}" disallows mutating apply`,
      { mutating_action_types: mutatingActionTypes }
    );
  }
  if (executionMode === 'apply' && riskRank(riskLevel) > riskRank(maxRiskLevelForApply)) {
    addViolation(
      violations,
      'deny',
      'risk-exceeds-max-apply',
      `risk_level "${riskLevel}" exceeds max apply risk "${maxRiskLevelForApply}" for environment "${runtimeEnvironment}"`,
      { risk_level: riskLevel, max_risk_level_for_apply: maxRiskLevelForApply }
    );
  }
  if (reviewActionHits.length > 0) {
    addViolation(
      violations,
      'review',
      'review-action-type-hit',
      'plan contains action types that require manual review',
      { action_types: reviewActionHits }
    );
  }
  if (manualReviewRequiredForApply) {
    addViolation(
      violations,
      'review',
      'manual-review-required-for-apply',
      `runtime environment "${runtimeEnvironment}" requires manual review before apply`,
      { runtime_environment: runtimeEnvironment }
    );
  }
  if (approvalRequired && !approvalSatisfied) {
    addViolation(
      violations,
      'review',
      'approval-required',
      `risk_level "${riskLevel}" requires approval before apply in environment "${runtimeEnvironment}"`,
      { approval_status: approvalStatus || 'unknown', required_levels: approvalRiskLevels }
    );
  }
  if (requirePasswordForApplyMutations && !passwordConfigured) {
    addViolation(
      violations,
      'review',
      'password-authorization-required',
      'mutating apply requires password authorization configuration',
      {
        authorization_required: true,
        plan_password_required: planAuthorization.password_required === true
      }
    );
  }

  const decision = decideFromViolations(violations);
  const reasons = violations.map(item => item.message);
  const autoExecuteAllowed = (
    executionMode === 'apply' &&
    riskRank(riskLevel) <= riskRank(maxAutoExecuteRiskLevel) &&
    decision === 'allow'
  );

  return {
    decision,
    reasons,
    violations,
    summary: {
      ui_mode: normalizedUiMode,
      execution_mode: executionMode,
      risk_level: riskLevel,
      action_count: actionItems.length,
      mutating_action_count: mutatingActions.length,
      action_types: actionTypes
    },
    requirements: {
      require_work_order: requireWorkOrder,
      allow_live_apply: allowLiveApply,
      require_dry_run_before_live_apply: requireDryRunBeforeLiveApply,
      manual_review_required_for_apply: manualReviewRequiredForApply,
      allow_mutating_apply: allowMutatingApply,
      require_password_for_apply_mutations: requirePasswordForApplyMutations,
      password_configured: passwordConfigured,
      require_approval: approvalRequired,
      approval_satisfied: approvalSatisfied,
      approval_risk_levels: approvalRiskLevels,
      ui_mode_policy_evaluated: normalizedUiMode !== null && hasUiModePolicy,
      ui_mode_policy_configured: Boolean(uiModeConfig),
      ui_mode_allowed_runtime_modes: uiModeAllowedRuntimeModes,
      ui_mode_allowed_execution_modes: uiModeAllowedExecutionModes,
      ui_mode_deny_execution_modes: uiModeDenyExecutionModes,
      ui_mode_runtime_mode_allowed: uiModeAllowedRuntimeModes.length > 0
        ? uiModeAllowedRuntimeModes.includes(normalizedRuntimeMode)
        : null,
      ui_mode_execution_mode_allowed: uiModeAllowedExecutionModes.length > 0
        ? uiModeAllowedExecutionModes.includes(executionMode)
        : null,
      max_risk_level_for_apply: maxRiskLevelForApply,
      max_auto_execute_risk_level: maxAutoExecuteRiskLevel,
      auto_execute_allowed: autoExecuteAllowed,
      review_action_hits: reviewActionHits,
      deny_action_hits: denyActionHits
    }
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const planPath = resolvePath(cwd, options.plan);
  const policyPath = resolvePath(cwd, options.policy);
  const outPath = resolvePath(cwd, options.out);

  const [plan, policy] = await Promise.all([
    readJsonFile(planPath, 'plan'),
    readJsonFile(policyPath, 'policy')
  ]);

  const defaults = policy && policy.defaults && typeof policy.defaults === 'object'
    ? policy.defaults
    : {};
  const uiMode = `${options.uiMode || defaults.ui_mode || ''}`.trim().toLowerCase() || null;
  const runtimeMode = `${options.runtimeMode || defaults.runtime_mode || ''}`.trim().toLowerCase();
  const runtimeEnvironment = `${options.runtimeEnvironment || defaults.runtime_environment || ''}`.trim().toLowerCase();

  if (!runtimeMode) {
    throw new Error('runtime_mode is required (set --runtime-mode or defaults.runtime_mode in policy).');
  }
  if (!runtimeEnvironment) {
    throw new Error('runtime_environment is required (set --runtime-environment or defaults.runtime_environment in policy).');
  }

  const evaluation = evaluateRuntimePolicy({
    plan,
    uiMode,
    runtimeMode,
    runtimeEnvironment,
    policy
  });

  const payload = {
    mode: 'interactive-runtime-policy-evaluate',
    generated_at: new Date().toISOString(),
    ui_mode: uiMode,
    runtime_mode: runtimeMode,
    runtime_environment: runtimeEnvironment,
    inputs: {
      plan: path.relative(cwd, planPath) || '.',
      policy: path.relative(cwd, policyPath) || '.'
    },
    ...evaluation,
    output: {
      json: path.relative(cwd, outPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive runtime policy decision: ${payload.decision}\n`);
    process.stdout.write(`- Runtime: ${runtimeMode}@${runtimeEnvironment}\n`);
    process.stdout.write(`- Output: ${payload.output.json}\n`);
  }

  if (options.failOnNonAllow && payload.decision !== 'allow') {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive runtime policy evaluate failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_OUT,
  RISK_ORDER,
  parseArgs,
  resolvePath,
  normalizeRiskLevel,
  riskRank,
  isMutatingAction,
  readJsonFile,
  toUniqueList,
  evaluateRuntimePolicy,
  main
};
