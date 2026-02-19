'use strict';

const DEFAULT_POLICY = 'docs/interactive-customization/guardrail-policy-baseline.json';
const DEFAULT_CATALOG = 'docs/interactive-customization/high-risk-action-catalog.json';

function toUniqueList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(
    value
      .map(item => `${item || ''}`.trim())
      .filter(Boolean)
  ));
}

function normalizeRiskLevel(value) {
  const risk = `${value || ''}`.trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(risk) ? risk : null;
}

function buildCheck(id, passed, severity, details) {
  return {
    id,
    passed: passed === true,
    severity,
    details: details || null
  };
}

function evaluatePlanGate(plan, policy, catalog) {
  const checks = [];
  const actions = Array.isArray(plan && plan.actions) ? plan.actions.filter(item => item && typeof item === 'object') : [];
  const riskLevel = normalizeRiskLevel(plan && plan.risk_level);
  const approval = plan && plan.approval && typeof plan.approval === 'object' ? plan.approval : {};
  const security = plan && plan.security && typeof plan.security === 'object' ? plan.security : {};

  const planShapePassed = (
    Boolean(plan && typeof plan.plan_id === 'string' && plan.plan_id.trim().length > 0) &&
    Boolean(plan && typeof plan.intent_id === 'string' && plan.intent_id.trim().length > 0) &&
    Boolean(riskLevel) &&
    actions.length > 0
  );
  checks.push(buildCheck(
    'plan-shape',
    planShapePassed,
    'deny',
    planShapePassed ? null : 'plan_id/intent_id/risk_level/actions is invalid or missing'
  ));

  const policyApproval = policy && policy.approval_policy && typeof policy.approval_policy === 'object'
    ? policy.approval_policy
    : {};
  const policySecurity = policy && policy.security_policy && typeof policy.security_policy === 'object'
    ? policy.security_policy
    : {};
  const catalogData = catalog && catalog.catalog && typeof catalog.catalog === 'object'
    ? catalog.catalog
    : {};

  const denyActionTypes = new Set(toUniqueList(catalogData.deny_action_types));
  const reviewActionTypes = new Set(toUniqueList(catalogData.review_required_action_types));

  const deniedActionHits = actions
    .map(item => `${item.type || ''}`.trim())
    .filter(type => type && denyActionTypes.has(type));
  checks.push(buildCheck(
    'deny-action-types',
    deniedActionHits.length === 0,
    'deny',
    deniedActionHits.length > 0
      ? `blocked action types: ${Array.from(new Set(deniedActionHits)).join(', ')}`
      : null
  ));

  const reviewActionHits = actions
    .map(item => `${item.type || ''}`.trim())
    .filter(type => type && reviewActionTypes.has(type));
  const reviewActionApproved = reviewActionHits.length === 0 || approval.status === 'approved';
  checks.push(buildCheck(
    'review-action-types',
    reviewActionApproved,
    'review',
    reviewActionApproved
      ? null
      : `review-required action types without approval: ${Array.from(new Set(reviewActionHits)).join(', ')}`
  ));

  const approvalRiskLevels = new Set(
    toUniqueList(policyApproval.require_approval_for_risk_levels).map(item => item.toLowerCase())
  );
  const riskApprovalPassed = !approvalRiskLevels.has(riskLevel || '') || approval.status === 'approved';
  checks.push(buildCheck(
    'risk-approval',
    riskApprovalPassed,
    'review',
    riskApprovalPassed
      ? null
      : `risk level ${riskLevel} requires approval`
  ));

  const maxActionsWithoutApproval = Number(policyApproval.max_actions_without_approval);
  const actionCountApprovalPassed = (
    !Number.isFinite(maxActionsWithoutApproval) ||
    maxActionsWithoutApproval < 0 ||
    actions.length <= maxActionsWithoutApproval ||
    approval.status === 'approved'
  );
  checks.push(buildCheck(
    'action-count-approval',
    actionCountApprovalPassed,
    'review',
    actionCountApprovalPassed
      ? null
      : `action count ${actions.length} exceeds max_actions_without_approval ${maxActionsWithoutApproval}`
  ));

  const privilegeEscalation = actions.some(item => item && item.requires_privilege_escalation === true);
  const requireDualApproval = policyApproval.require_dual_approval_for_privilege_escalation === true;
  const dualApprovalPassed = !privilegeEscalation || !requireDualApproval || approval.dual_approved === true;
  checks.push(buildCheck(
    'privilege-escalation-dual-approval',
    dualApprovalPassed,
    'review',
    dualApprovalPassed
      ? null
      : 'privilege escalation detected without dual approval'
  ));

  const touchesSensitiveData = actions.some(item => item && item.touches_sensitive_data === true);
  const requireMasking = policySecurity.require_masking_when_sensitive_data === true;
  const maskingPassed = !touchesSensitiveData || !requireMasking || security.masking_applied === true;
  checks.push(buildCheck(
    'sensitive-data-masking',
    maskingPassed,
    'deny',
    maskingPassed
      ? null
      : 'sensitive data change requires masking_applied=true'
  ));

  const forbidPlaintextSecrets = policySecurity.forbid_plaintext_secrets === true;
  const plaintextSecretsPassed = !forbidPlaintextSecrets || security.plaintext_secrets_in_payload !== true;
  checks.push(buildCheck(
    'plaintext-secrets',
    plaintextSecretsPassed,
    'deny',
    plaintextSecretsPassed
      ? null
      : 'plaintext secrets detected in plan payload'
  ));

  const hasIrreversibleAction = actions.some(item => item && item.irreversible === true);
  const requireBackup = policySecurity.require_backup_for_irreversible_actions === true;
  const backupPassed = !hasIrreversibleAction || !requireBackup || Boolean(`${security.backup_reference || ''}`.trim());
  checks.push(buildCheck(
    'irreversible-backup',
    backupPassed,
    'deny',
    backupPassed
      ? null
      : 'irreversible actions require backup_reference'
  ));

  const failedDenyChecks = checks.filter(item => item.passed !== true && item.severity === 'deny');
  const failedReviewChecks = checks.filter(item => item.passed !== true && item.severity === 'review');

  let decision = 'allow';
  if (failedDenyChecks.length > 0) {
    decision = 'deny';
  } else if (failedReviewChecks.length > 0) {
    decision = 'review-required';
  }

  return {
    decision,
    checks,
    failed_deny_checks: failedDenyChecks.map(item => item.id),
    failed_review_checks: failedReviewChecks.map(item => item.id),
    reasons: checks
      .filter(item => item.passed !== true && item.details)
      .map(item => item.details),
    summary: {
      check_total: checks.length,
      failed_total: checks.filter(item => item.passed !== true).length,
      failed_deny_total: failedDenyChecks.length,
      failed_review_total: failedReviewChecks.length,
      action_count: actions.length,
      risk_level: riskLevel
    }
  };
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_CATALOG,
  toUniqueList,
  normalizeRiskLevel,
  buildCheck,
  evaluatePlanGate
};
