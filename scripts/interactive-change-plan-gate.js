#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_POLICY = 'docs/interactive-customization/guardrail-policy-baseline.json';
const DEFAULT_CATALOG = 'docs/interactive-customization/high-risk-action-catalog.json';
const DEFAULT_OUT = '.kiro/reports/interactive-change-plan-gate.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/interactive-change-plan-gate.md';

function parseArgs(argv) {
  const options = {
    plan: null,
    policy: DEFAULT_POLICY,
    catalog: null,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    failOnBlock: false,
    failOnNonAllow: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--plan' && next) {
      options.plan = next;
      i += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      i += 1;
    } else if (token === '--catalog' && next) {
      options.catalog = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--fail-on-block') {
      options.failOnBlock = true;
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
    'Usage: node scripts/interactive-change-plan-gate.js --plan <path> [options]',
    '',
    'Options:',
    '  --plan <path>            Change plan JSON file (required)',
    `  --policy <path>          Guardrail policy JSON file (default: ${DEFAULT_POLICY})`,
    `  --catalog <path>         High-risk action catalog JSON file (default: ${DEFAULT_CATALOG})`,
    `  --out <path>             Report JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>    Report markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --fail-on-block          Exit code 2 when decision is deny',
    '  --fail-on-non-allow      Exit code 2 when decision is deny/review-required',
    '  --json                   Print JSON report to stdout',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function parseJson(text, sourceLabel) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${sourceLabel}: ${error.message}`);
  }
}

async function readJsonFile(filePath, sourceLabel) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${sourceLabel} not found: ${filePath}`);
  }
  const content = await fs.readFile(filePath, 'utf8');
  return parseJson(content, sourceLabel);
}

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

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Interactive Change Plan Gate');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Decision: ${report.decision}`);
  lines.push(`- Plan: ${report.inputs.plan}`);
  lines.push(`- Policy: ${report.inputs.policy}`);
  lines.push(`- Catalog: ${report.inputs.catalog}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Checks: ${report.summary.check_total}`);
  lines.push(`- Failed checks: ${report.summary.failed_total}`);
  lines.push(`- Failed deny checks: ${report.summary.failed_deny_total}`);
  lines.push(`- Failed review checks: ${report.summary.failed_review_total}`);
  lines.push(`- Action count: ${report.summary.action_count}`);
  lines.push(`- Risk level: ${report.summary.risk_level || 'n/a'}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  lines.push('| Check | Result | Severity | Details |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of report.checks) {
    lines.push(
      `| ${check.id} | ${check.passed ? 'pass' : 'fail'} | ${check.severity} | ${check.details || 'n/a'} |`
    );
  }
  lines.push('');
  lines.push('## Reasons');
  lines.push('');
  if (!Array.isArray(report.reasons) || report.reasons.length === 0) {
    lines.push('- none');
  } else {
    for (const reason of report.reasons) {
      lines.push(`- ${reason}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function resolveReportPath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const planPath = resolveReportPath(cwd, options.plan);
  const policyPath = resolveReportPath(cwd, options.policy);
  const policy = await readJsonFile(policyPath, 'policy');
  const catalogFromPolicy = policy && policy.catalog_policy && typeof policy.catalog_policy.catalog_file === 'string'
    ? policy.catalog_policy.catalog_file
    : null;
  const catalogPath = resolveReportPath(
    cwd,
    options.catalog || catalogFromPolicy || DEFAULT_CATALOG
  );
  const [plan, catalog] = await Promise.all([
    readJsonFile(planPath, 'plan'),
    readJsonFile(catalogPath, 'catalog')
  ]);

  const evaluation = evaluatePlanGate(plan, policy, catalog);
  const outPath = resolveReportPath(cwd, options.out);
  const markdownOutPath = resolveReportPath(cwd, options.markdownOut);
  const report = {
    mode: 'interactive-change-plan-gate',
    generated_at: new Date().toISOString(),
    inputs: {
      plan: path.relative(cwd, planPath) || '.',
      policy: path.relative(cwd, policyPath) || '.',
      catalog: path.relative(cwd, catalogPath) || '.'
    },
    ...evaluation,
    output: {
      json: path.relative(cwd, outPath) || '.',
      markdown: path.relative(cwd, markdownOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(report), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive change plan gate: ${report.decision}\n`);
    process.stdout.write(`- JSON: ${report.output.json}\n`);
    process.stdout.write(`- Markdown: ${report.output.markdown}\n`);
  }

  if (options.failOnBlock && report.decision === 'deny') {
    process.exitCode = 2;
  } else if (options.failOnNonAllow && report.decision !== 'allow') {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Interactive change plan gate failed: ${error.message}`);
  process.exit(1);
});
