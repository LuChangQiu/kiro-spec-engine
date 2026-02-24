#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_INTENT_AUDIT = '.sce/reports/interactive-copilot-audit.jsonl';
const DEFAULT_APPROVAL_AUDIT = '.sce/reports/interactive-approval-events.jsonl';
const DEFAULT_EXECUTION_LEDGER = '.sce/reports/interactive-execution-ledger.jsonl';
const DEFAULT_FEEDBACK_FILE = '.sce/reports/interactive-user-feedback.jsonl';
const DEFAULT_MATRIX_SIGNALS = '.sce/reports/interactive-matrix-signals.jsonl';
const DEFAULT_DIALOGUE_AUTHORIZATION_SIGNALS = '.sce/reports/interactive-dialogue-authorization-signals.jsonl';
const DEFAULT_RUNTIME_SIGNALS = '.sce/reports/interactive-runtime-signals.jsonl';
const DEFAULT_AUTHORIZATION_TIER_SIGNALS = '.sce/reports/interactive-authorization-tier-signals.jsonl';
const DEFAULT_THRESHOLDS = 'docs/interactive-customization/governance-threshold-baseline.json';
const DEFAULT_OUT = '.sce/reports/interactive-governance-report.json';
const DEFAULT_MARKDOWN_OUT = '.sce/reports/interactive-governance-report.md';

function parseArgs(argv) {
  const options = {
    intentAudit: DEFAULT_INTENT_AUDIT,
    approvalAudit: DEFAULT_APPROVAL_AUDIT,
    executionLedger: DEFAULT_EXECUTION_LEDGER,
    feedbackFile: DEFAULT_FEEDBACK_FILE,
    matrixSignals: DEFAULT_MATRIX_SIGNALS,
    dialogueAuthorizationSignals: DEFAULT_DIALOGUE_AUTHORIZATION_SIGNALS,
    runtimeSignals: DEFAULT_RUNTIME_SIGNALS,
    authorizationTierSignals: DEFAULT_AUTHORIZATION_TIER_SIGNALS,
    thresholds: DEFAULT_THRESHOLDS,
    period: 'weekly',
    from: null,
    to: null,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    failOnAlert: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--intent-audit' && next) {
      options.intentAudit = next;
      i += 1;
    } else if (token === '--approval-audit' && next) {
      options.approvalAudit = next;
      i += 1;
    } else if (token === '--execution-ledger' && next) {
      options.executionLedger = next;
      i += 1;
    } else if (token === '--feedback-file' && next) {
      options.feedbackFile = next;
      i += 1;
    } else if (token === '--matrix-signals' && next) {
      options.matrixSignals = next;
      i += 1;
    } else if (token === '--dialogue-authorization-signals' && next) {
      options.dialogueAuthorizationSignals = next;
      i += 1;
    } else if (token === '--runtime-signals' && next) {
      options.runtimeSignals = next;
      i += 1;
    } else if (token === '--authorization-tier-signals' && next) {
      options.authorizationTierSignals = next;
      i += 1;
    } else if (token === '--thresholds' && next) {
      options.thresholds = next;
      i += 1;
    } else if (token === '--period' && next) {
      options.period = next;
      i += 1;
    } else if (token === '--from' && next) {
      options.from = next;
      i += 1;
    } else if (token === '--to' && next) {
      options.to = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--fail-on-alert') {
      options.failOnAlert = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  const allowedPeriods = new Set(['weekly', 'monthly', 'all', 'custom']);
  const normalizedPeriod = `${options.period || ''}`.trim().toLowerCase();
  if (!allowedPeriods.has(normalizedPeriod)) {
    throw new Error('--period must be one of: weekly, monthly, all, custom');
  }
  options.period = normalizedPeriod;

  if (options.period === 'custom') {
    if (!options.from || !options.to) {
      throw new Error('--from and --to are required when --period custom is used');
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-governance-report.js [options]',
    '',
    'Options:',
    `  --intent-audit <path>      Intent audit JSONL (default: ${DEFAULT_INTENT_AUDIT})`,
    `  --approval-audit <path>    Approval audit JSONL (default: ${DEFAULT_APPROVAL_AUDIT})`,
    `  --execution-ledger <path>  Execution ledger JSONL (default: ${DEFAULT_EXECUTION_LEDGER})`,
    `  --feedback-file <path>     User feedback JSONL (default: ${DEFAULT_FEEDBACK_FILE})`,
    `  --matrix-signals <path>    Matrix signal JSONL (default: ${DEFAULT_MATRIX_SIGNALS})`,
    `  --dialogue-authorization-signals <path> Dialogue authorization signal JSONL (default: ${DEFAULT_DIALOGUE_AUTHORIZATION_SIGNALS})`,
    `  --runtime-signals <path>    Runtime policy signal JSONL (default: ${DEFAULT_RUNTIME_SIGNALS})`,
    `  --authorization-tier-signals <path> Authorization tier signal JSONL (default: ${DEFAULT_AUTHORIZATION_TIER_SIGNALS})`,
    `  --thresholds <path>        Governance threshold JSON (default: ${DEFAULT_THRESHOLDS})`,
    '  --period <type>            weekly|monthly|all|custom (default: weekly)',
    '  --from <ISO datetime>      Start time (required for custom period)',
    '  --to <ISO datetime>        End time (required for custom period)',
    `  --out <path>               JSON report output (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>      Markdown report output (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --fail-on-alert            Exit code 2 when any medium/high breach exists',
    '  --json                     Print JSON payload',
    '  -h, --help                 Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function parseDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid date for ${label}: ${value}`);
  }
  return date;
}

function buildPeriodWindow(options, now = new Date()) {
  if (options.period === 'all') {
    return { from: null, to: null, period: 'all' };
  }

  if (options.period === 'custom') {
    const from = parseDate(options.from, '--from');
    const to = parseDate(options.to, '--to');
    if (from.getTime() > to.getTime()) {
      throw new Error('--from must be <= --to');
    }
    return { from, to, period: 'custom' };
  }

  const to = now;
  const from = new Date(now.getTime());
  if (options.period === 'weekly') {
    from.setUTCDate(from.getUTCDate() - 7);
  } else {
    from.setUTCDate(from.getUTCDate() - 30);
  }
  return { from, to, period: options.period };
}

async function readJsonLinesFile(filePath) {
  if (!(await fs.pathExists(filePath))) {
    return [];
  }
  const content = await fs.readFile(filePath, 'utf8');
  return `${content || ''}`
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

function pickTimestamp(entry, fields = []) {
  for (const field of fields) {
    if (!entry || entry[field] == null) {
      continue;
    }
    const date = new Date(entry[field]);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function filterByWindow(entries, fields, window) {
  const fromMs = window.from ? window.from.getTime() : null;
  const toMs = window.to ? window.to.getTime() : null;
  return entries.filter((entry) => {
    const timestamp = pickTimestamp(entry, fields);
    if (!timestamp) {
      return false;
    }
    const value = timestamp.getTime();
    if (fromMs != null && value < fromMs) {
      return false;
    }
    if (toMs != null && value > toMs) {
      return false;
    }
    return true;
  });
}

function toRatePercent(numerator, denominator) {
  const d = Number(denominator);
  if (!Number.isFinite(d) || d <= 0) {
    return null;
  }
  return Number(((Number(numerator) / d) * 100).toFixed(2));
}

function toAverage(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const numbers = values
    .map(item => Number(item))
    .filter(value => Number.isFinite(value));
  if (numbers.length === 0) {
    return null;
  }
  return Number((numbers.reduce((acc, value) => acc + value, 0) / numbers.length).toFixed(2));
}

function normalizeBusinessMode(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'user-mode' || normalized === 'ops-mode' || normalized === 'dev-mode') {
    return normalized;
  }
  return 'unknown';
}

function createBusinessModeBucket() {
  return {
    total: 0,
    allow_total: 0,
    deny_total: 0,
    review_required_total: 0,
    block_total: 0,
    block_rate_percent: null
  };
}

function buildBusinessModeBreakdown(entries = []) {
  const byMode = {
    user_mode: createBusinessModeBucket(),
    ops_mode: createBusinessModeBucket(),
    dev_mode: createBusinessModeBucket(),
    unknown: createBusinessModeBucket()
  };

  const modeKeyMap = {
    'user-mode': 'user_mode',
    'ops-mode': 'ops_mode',
    'dev-mode': 'dev_mode',
    unknown: 'unknown'
  };

  for (const entry of entries) {
    const mode = normalizeBusinessMode(entry && entry.business_mode);
    const modeKey = modeKeyMap[mode] || 'unknown';
    const decision = `${entry && entry.decision ? entry.decision : ''}`.trim().toLowerCase();
    const bucket = byMode[modeKey];
    bucket.total += 1;
    if (decision === 'allow') {
      bucket.allow_total += 1;
    } else if (decision === 'deny') {
      bucket.deny_total += 1;
    } else if (decision === 'review-required') {
      bucket.review_required_total += 1;
    }
  }

  for (const bucket of Object.values(byMode)) {
    bucket.block_total = bucket.deny_total + bucket.review_required_total;
    bucket.block_rate_percent = toRatePercent(bucket.block_total, bucket.total);
  }

  const total = Object.values(byMode).reduce((acc, bucket) => acc + bucket.total, 0);
  const unknownTotal = byMode.unknown.total;
  return {
    total,
    known_total: total - unknownTotal,
    unknown_total: unknownTotal,
    user_mode_total: byMode.user_mode.total,
    ops_mode_total: byMode.ops_mode.total,
    dev_mode_total: byMode.dev_mode.total,
    by_mode: byMode
  };
}

function loadThresholds(raw = {}) {
  const thresholds = raw && typeof raw === 'object' ? raw : {};
  return {
    min_intent_samples: Number.isFinite(Number(thresholds.min_intent_samples))
      ? Number(thresholds.min_intent_samples)
      : 5,
    adoption_rate_min_percent: Number.isFinite(Number(thresholds.adoption_rate_min_percent))
      ? Number(thresholds.adoption_rate_min_percent)
      : 30,
    execution_success_rate_min_percent: Number.isFinite(Number(thresholds.execution_success_rate_min_percent))
      ? Number(thresholds.execution_success_rate_min_percent)
      : 90,
    rollback_rate_max_percent: Number.isFinite(Number(thresholds.rollback_rate_max_percent))
      ? Number(thresholds.rollback_rate_max_percent)
      : 20,
    security_intercept_rate_max_percent: Number.isFinite(Number(thresholds.security_intercept_rate_max_percent))
      ? Number(thresholds.security_intercept_rate_max_percent)
      : 60,
    satisfaction_min_score: Number.isFinite(Number(thresholds.satisfaction_min_score))
      ? Number(thresholds.satisfaction_min_score)
      : 4,
    min_feedback_samples: Number.isFinite(Number(thresholds.min_feedback_samples))
      ? Number(thresholds.min_feedback_samples)
      : 3,
    min_matrix_samples: Number.isFinite(Number(thresholds.min_matrix_samples))
      ? Number(thresholds.min_matrix_samples)
      : 3,
    min_dialogue_authorization_samples: Number.isFinite(Number(thresholds.min_dialogue_authorization_samples))
      ? Number(thresholds.min_dialogue_authorization_samples)
      : 3,
    dialogue_authorization_block_rate_max_percent: Number.isFinite(Number(thresholds.dialogue_authorization_block_rate_max_percent))
      ? Number(thresholds.dialogue_authorization_block_rate_max_percent)
      : 40,
    min_runtime_samples: Number.isFinite(Number(thresholds.min_runtime_samples))
      ? Number(thresholds.min_runtime_samples)
      : 3,
    runtime_block_rate_max_percent: Number.isFinite(Number(thresholds.runtime_block_rate_max_percent))
      ? Number(thresholds.runtime_block_rate_max_percent)
      : 40,
    runtime_ui_mode_violation_max_total: Number.isFinite(Number(thresholds.runtime_ui_mode_violation_max_total))
      ? Number(thresholds.runtime_ui_mode_violation_max_total)
      : 0,
    min_authorization_tier_samples: Number.isFinite(Number(thresholds.min_authorization_tier_samples))
      ? Number(thresholds.min_authorization_tier_samples)
      : 3,
    authorization_tier_block_rate_max_percent: Number.isFinite(Number(thresholds.authorization_tier_block_rate_max_percent))
      ? Number(thresholds.authorization_tier_block_rate_max_percent)
      : 40,
    matrix_portfolio_pass_rate_min_percent: Number.isFinite(Number(thresholds.matrix_portfolio_pass_rate_min_percent))
      ? Number(thresholds.matrix_portfolio_pass_rate_min_percent)
      : 80,
    matrix_regression_positive_rate_max_percent: Number.isFinite(Number(thresholds.matrix_regression_positive_rate_max_percent))
      ? Number(thresholds.matrix_regression_positive_rate_max_percent)
      : 20,
    matrix_stage_error_rate_max_percent: Number.isFinite(Number(thresholds.matrix_stage_error_rate_max_percent))
      ? Number(thresholds.matrix_stage_error_rate_max_percent)
      : 20
  };
}

function buildAlert({
  id,
  severity,
  metric,
  actual,
  threshold,
  direction,
  message,
  recommendation
}) {
  return {
    id,
    severity,
    status: 'breach',
    metric,
    actual,
    threshold,
    direction,
    message,
    recommendation
  };
}

function evaluateAlerts(metrics, thresholds) {
  const alerts = [];

  if (metrics.intent_total < thresholds.min_intent_samples) {
    alerts.push({
      id: 'adoption-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'intent_total',
      actual: metrics.intent_total,
      threshold: thresholds.min_intent_samples,
      direction: 'min',
      message: 'Intent sample size is below minimum; adoption trend is not statistically stable.',
      recommendation: 'Collect more interactive intent/apply runs before enforcing adoption policy.'
    });
  } else if (
    metrics.adoption_rate_percent != null &&
    metrics.adoption_rate_percent < thresholds.adoption_rate_min_percent
  ) {
    alerts.push(buildAlert({
      id: 'adoption-rate-low',
      severity: 'medium',
      metric: 'adoption_rate_percent',
      actual: metrics.adoption_rate_percent,
      threshold: thresholds.adoption_rate_min_percent,
      direction: 'min',
      message: 'Adoption rate is below minimum threshold.',
      recommendation: 'Review plan quality and reduce review friction in common low-risk scenarios.'
    }));
  }

  if (
    metrics.execution_success_rate_percent != null &&
    metrics.execution_success_rate_percent < thresholds.execution_success_rate_min_percent
  ) {
    alerts.push(buildAlert({
      id: 'execution-success-low',
      severity: 'high',
      metric: 'execution_success_rate_percent',
      actual: metrics.execution_success_rate_percent,
      threshold: thresholds.execution_success_rate_min_percent,
      direction: 'min',
      message: 'Execution success rate is below minimum threshold.',
      recommendation: 'Analyze failed apply records and tighten validation before execution.'
    }));
  }

  if (
    metrics.rollback_rate_percent != null &&
    metrics.rollback_rate_percent > thresholds.rollback_rate_max_percent
  ) {
    alerts.push(buildAlert({
      id: 'rollback-rate-high',
      severity: 'high',
      metric: 'rollback_rate_percent',
      actual: metrics.rollback_rate_percent,
      threshold: thresholds.rollback_rate_max_percent,
      direction: 'max',
      message: 'Rollback rate is above maximum threshold.',
      recommendation: 'Freeze risky rollout scope and enforce stronger verification checks before apply.'
    }));
  }

  if (
    metrics.security_intercept_rate_percent != null &&
    metrics.security_intercept_rate_percent > thresholds.security_intercept_rate_max_percent
  ) {
    alerts.push(buildAlert({
      id: 'security-intercept-high',
      severity: 'medium',
      metric: 'security_intercept_rate_percent',
      actual: metrics.security_intercept_rate_percent,
      threshold: thresholds.security_intercept_rate_max_percent,
      direction: 'max',
      message: 'Security intercept rate is above maximum threshold.',
      recommendation: 'Improve intent guidance and plan generation to avoid blocked action categories.'
    }));
  }

  if (
    metrics.satisfaction_response_count >= thresholds.min_feedback_samples &&
    metrics.satisfaction_avg_score != null &&
    metrics.satisfaction_avg_score < thresholds.satisfaction_min_score
  ) {
    alerts.push(buildAlert({
      id: 'satisfaction-low',
      severity: 'medium',
      metric: 'satisfaction_avg_score',
      actual: metrics.satisfaction_avg_score,
      threshold: thresholds.satisfaction_min_score,
      direction: 'min',
      message: 'User satisfaction is below minimum threshold.',
      recommendation: 'Review failed/blocked cases with business users and tune scene guidance.'
    }));
  }

  if (metrics.satisfaction_response_count < thresholds.min_feedback_samples) {
    alerts.push({
      id: 'feedback-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'satisfaction_response_count',
      actual: metrics.satisfaction_response_count,
      threshold: thresholds.min_feedback_samples,
      direction: 'min',
      message: 'Feedback sample size is below minimum; satisfaction trend is not statistically stable.',
      recommendation: 'Collect more user feedback samples before making policy changes.'
    });
  }

  if (metrics.dialogue_authorization_total < thresholds.min_dialogue_authorization_samples) {
    alerts.push({
      id: 'dialogue-authorization-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'dialogue_authorization_total',
      actual: metrics.dialogue_authorization_total,
      threshold: thresholds.min_dialogue_authorization_samples,
      direction: 'min',
      message: 'Dialogue authorization sample size is below minimum; block trend is not statistically stable.',
      recommendation: 'Collect more user-app/ops-console sessions before tightening dialogue authorization policy.'
    });
  } else if (
    metrics.dialogue_authorization_block_rate_percent != null &&
    metrics.dialogue_authorization_block_rate_percent > thresholds.dialogue_authorization_block_rate_max_percent
  ) {
    alerts.push(buildAlert({
      id: 'dialogue-authorization-block-rate-high',
      severity: 'medium',
      metric: 'dialogue_authorization_block_rate_percent',
      actual: metrics.dialogue_authorization_block_rate_percent,
      threshold: thresholds.dialogue_authorization_block_rate_max_percent,
      direction: 'max',
      message: 'Dialogue authorization block/review rate is above maximum threshold.',
      recommendation: 'Tune ui-mode/profile defaults and dialogue policy prompts to reduce non-actionable requests.'
    }));
  }

  if (metrics.runtime_total < thresholds.min_runtime_samples) {
    alerts.push({
      id: 'runtime-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'runtime_total',
      actual: metrics.runtime_total,
      threshold: thresholds.min_runtime_samples,
      direction: 'min',
      message: 'Runtime policy sample size is below minimum; runtime block trend is not statistically stable.',
      recommendation: 'Collect more runtime policy evaluations before tightening runtime thresholds.'
    });
  } else if (
    metrics.runtime_block_rate_percent != null &&
    metrics.runtime_block_rate_percent > thresholds.runtime_block_rate_max_percent
  ) {
    alerts.push(buildAlert({
      id: 'runtime-block-rate-high',
      severity: 'medium',
      metric: 'runtime_block_rate_percent',
      actual: metrics.runtime_block_rate_percent,
      threshold: thresholds.runtime_block_rate_max_percent,
      direction: 'max',
      message: 'Runtime policy block/review rate is above maximum threshold.',
      recommendation: 'Review runtime mode/environment defaults and reduce invalid apply paths before runtime gate.'
    }));
  }

  if (
    Number.isFinite(metrics.runtime_ui_mode_violation_total) &&
    metrics.runtime_ui_mode_violation_total > thresholds.runtime_ui_mode_violation_max_total
  ) {
    alerts.push(buildAlert({
      id: 'runtime-ui-mode-violation-high',
      severity: 'medium',
      metric: 'runtime_ui_mode_violation_total',
      actual: metrics.runtime_ui_mode_violation_total,
      threshold: thresholds.runtime_ui_mode_violation_max_total,
      direction: 'max',
      message: 'Runtime ui_mode policy violations are above maximum threshold.',
      recommendation: 'Route user-app apply intents to ops-console and align runtime ui_mode policy with surface roles.'
    }));
  }

  if (Number.isFinite(metrics.business_mode_unknown_signal_total) && metrics.business_mode_unknown_signal_total > 0) {
    alerts.push({
      id: 'business-mode-signal-missing',
      severity: 'low',
      status: 'warning',
      metric: 'business_mode_unknown_signal_total',
      actual: metrics.business_mode_unknown_signal_total,
      threshold: 0,
      direction: 'max',
      message: 'Some governance signals are missing business_mode tagging.',
      recommendation: 'Upgrade interactive-loop/flow signal emitters so every signal includes business_mode.'
    });
  }

  if (metrics.authorization_tier_total < thresholds.min_authorization_tier_samples) {
    alerts.push({
      id: 'authorization-tier-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'authorization_tier_total',
      actual: metrics.authorization_tier_total,
      threshold: thresholds.min_authorization_tier_samples,
      direction: 'min',
      message: 'Authorization tier sample size is below minimum; block trend is not statistically stable.',
      recommendation: 'Collect more authorization-tier evaluations before tightening tier policy.'
    });
  } else if (
    metrics.authorization_tier_block_rate_percent != null &&
    metrics.authorization_tier_block_rate_percent > thresholds.authorization_tier_block_rate_max_percent
  ) {
    alerts.push(buildAlert({
      id: 'authorization-tier-block-rate-high',
      severity: 'medium',
      metric: 'authorization_tier_block_rate_percent',
      actual: metrics.authorization_tier_block_rate_percent,
      threshold: thresholds.authorization_tier_block_rate_max_percent,
      direction: 'max',
      message: 'Authorization tier block/review rate is above maximum threshold.',
      recommendation: 'Refine dialogue profile defaults and step-up policy to reduce non-actionable apply requests.'
    }));
  }

  if (metrics.matrix_signal_total < thresholds.min_matrix_samples) {
    alerts.push({
      id: 'matrix-sample-insufficient',
      severity: 'low',
      status: 'warning',
      metric: 'matrix_signal_total',
      actual: metrics.matrix_signal_total,
      threshold: thresholds.min_matrix_samples,
      direction: 'min',
      message: 'Matrix signal sample size is below minimum; matrix trend is not statistically stable.',
      recommendation: 'Collect more interactive-flow runs with matrix snapshots before tightening matrix gates.'
    });
  } else {
    if (
      metrics.matrix_portfolio_pass_rate_percent != null &&
      metrics.matrix_portfolio_pass_rate_percent < thresholds.matrix_portfolio_pass_rate_min_percent
    ) {
      alerts.push(buildAlert({
        id: 'matrix-portfolio-pass-rate-low',
        severity: 'medium',
        metric: 'matrix_portfolio_pass_rate_percent',
        actual: metrics.matrix_portfolio_pass_rate_percent,
        threshold: thresholds.matrix_portfolio_pass_rate_min_percent,
        direction: 'min',
        message: 'Matrix portfolio pass rate is below minimum threshold.',
        recommendation: 'Prioritize ontology closure and semantic quality improvements in failing templates.'
      }));
    }

    if (
      metrics.matrix_regression_positive_rate_percent != null &&
      metrics.matrix_regression_positive_rate_percent > thresholds.matrix_regression_positive_rate_max_percent
    ) {
      alerts.push(buildAlert({
        id: 'matrix-regression-rate-high',
        severity: 'medium',
        metric: 'matrix_regression_positive_rate_percent',
        actual: metrics.matrix_regression_positive_rate_percent,
        threshold: thresholds.matrix_regression_positive_rate_max_percent,
        direction: 'max',
        message: 'Matrix regression-positive rate is above maximum threshold.',
        recommendation: 'Run matrix remediation queue and block release until regression deltas are closed.'
      }));
    }

    if (
      metrics.matrix_stage_error_rate_percent != null &&
      metrics.matrix_stage_error_rate_percent > thresholds.matrix_stage_error_rate_max_percent
    ) {
      alerts.push(buildAlert({
        id: 'matrix-stage-error-rate-high',
        severity: 'medium',
        metric: 'matrix_stage_error_rate_percent',
        actual: metrics.matrix_stage_error_rate_percent,
        threshold: thresholds.matrix_stage_error_rate_max_percent,
        direction: 'max',
        message: 'Matrix stage non-zero/error rate is above maximum threshold.',
        recommendation: 'Stabilize matrix baseline runtime (inputs/template-dir/compare refs) before scale-out.'
      }));
    }
  }

  return alerts;
}

function buildRecommendations(alerts) {
  const recommendations = [];
  const seen = new Set();
  for (const alert of alerts) {
    const recommendation = `${alert.recommendation || ''}`.trim();
    if (!recommendation || seen.has(recommendation)) {
      continue;
    }
    seen.add(recommendation);
    recommendations.push(recommendation);
  }
  if (recommendations.length === 0) {
    recommendations.push('Current governance metrics are within configured thresholds.');
  }
  return recommendations;
}

function parseFeedbackScore(entry) {
  const candidates = [
    entry && entry.satisfaction_score,
    entry && entry.score,
    entry && entry.rating
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Interactive Governance Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Period: ${report.period.type}`);
  lines.push(`- Window: ${report.period.from || 'n/a'} -> ${report.period.to || 'n/a'}`);
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Adoption rate | ${report.metrics.adoption_rate_percent == null ? 'n/a' : `${report.metrics.adoption_rate_percent}%`} |`);
  lines.push(`| Execution success rate | ${report.metrics.execution_success_rate_percent == null ? 'n/a' : `${report.metrics.execution_success_rate_percent}%`} |`);
  lines.push(`| Rollback rate | ${report.metrics.rollback_rate_percent == null ? 'n/a' : `${report.metrics.rollback_rate_percent}%`} |`);
  lines.push(`| Security intercept rate | ${report.metrics.security_intercept_rate_percent == null ? 'n/a' : `${report.metrics.security_intercept_rate_percent}%`} |`);
  lines.push(`| Dialogue authorization deny total | ${report.metrics.dialogue_authorization_deny_total} |`);
  lines.push(`| Dialogue authorization review-required total | ${report.metrics.dialogue_authorization_review_required_total} |`);
  lines.push(`| Dialogue authorization block rate | ${report.metrics.dialogue_authorization_block_rate_percent == null ? 'n/a' : `${report.metrics.dialogue_authorization_block_rate_percent}%`} |`);
  lines.push(`| User-app apply attempt total | ${report.metrics.dialogue_authorization_user_app_apply_attempt_total} |`);
  lines.push(`| Runtime deny total | ${report.metrics.runtime_deny_total} |`);
  lines.push(`| Runtime review-required total | ${report.metrics.runtime_review_required_total} |`);
  lines.push(`| Runtime block rate | ${report.metrics.runtime_block_rate_percent == null ? 'n/a' : `${report.metrics.runtime_block_rate_percent}%`} |`);
  lines.push(`| Runtime ui-mode violation total | ${report.metrics.runtime_ui_mode_violation_total} |`);
  lines.push(`| Runtime unknown business-mode total | ${report.metrics.runtime_unknown_business_mode_total} |`);
  lines.push(`| Authorization tier deny total | ${report.metrics.authorization_tier_deny_total} |`);
  lines.push(`| Authorization tier review-required total | ${report.metrics.authorization_tier_review_required_total} |`);
  lines.push(`| Authorization tier block rate | ${report.metrics.authorization_tier_block_rate_percent == null ? 'n/a' : `${report.metrics.authorization_tier_block_rate_percent}%`} |`);
  lines.push(`| Authorization tier unknown business-mode total | ${report.metrics.authorization_tier_unknown_business_mode_total} |`);
  lines.push(`| Satisfaction (avg) | ${report.metrics.satisfaction_avg_score == null ? 'n/a' : report.metrics.satisfaction_avg_score} |`);
  lines.push(`| Satisfaction samples | ${report.metrics.satisfaction_response_count} |`);
  lines.push(`| Matrix portfolio pass rate | ${report.metrics.matrix_portfolio_pass_rate_percent == null ? 'n/a' : `${report.metrics.matrix_portfolio_pass_rate_percent}%`} |`);
  lines.push(`| Matrix regression-positive rate | ${report.metrics.matrix_regression_positive_rate_percent == null ? 'n/a' : `${report.metrics.matrix_regression_positive_rate_percent}%`} |`);
  lines.push(`| Matrix stage error rate | ${report.metrics.matrix_stage_error_rate_percent == null ? 'n/a' : `${report.metrics.matrix_stage_error_rate_percent}%`} |`);
  lines.push(`| Matrix avg semantic score | ${report.metrics.matrix_avg_score == null ? 'n/a' : report.metrics.matrix_avg_score} |`);
  lines.push(`| Matrix signal samples | ${report.metrics.matrix_signal_total} |`);
  lines.push(`| Dialogue unknown business-mode total | ${report.metrics.dialogue_authorization_unknown_business_mode_total} |`);
  lines.push(`| All unknown business-mode signals | ${report.metrics.business_mode_unknown_signal_total} |`);
  lines.push('');
  lines.push('## Alerts');
  lines.push('');
  if (!Array.isArray(report.alerts) || report.alerts.length === 0) {
    lines.push('- none');
  } else {
    for (const alert of report.alerts) {
      lines.push(`- [${alert.severity}/${alert.status}] ${alert.id}: ${alert.message} (actual=${alert.actual}, threshold=${alert.threshold})`);
    }
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const item of report.recommendations || []) {
    lines.push(`- ${item}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const intentAuditPath = resolvePath(cwd, options.intentAudit);
  const approvalAuditPath = resolvePath(cwd, options.approvalAudit);
  const executionLedgerPath = resolvePath(cwd, options.executionLedger);
  const feedbackFilePath = resolvePath(cwd, options.feedbackFile);
  const matrixSignalsPath = resolvePath(cwd, options.matrixSignals);
  const dialogueAuthorizationSignalsPath = resolvePath(cwd, options.dialogueAuthorizationSignals);
  const runtimeSignalsPath = resolvePath(cwd, options.runtimeSignals);
  const authorizationTierSignalsPath = resolvePath(cwd, options.authorizationTierSignals);
  const thresholdsPath = resolvePath(cwd, options.thresholds);
  const outPath = resolvePath(cwd, options.out);
  const markdownOutPath = resolvePath(cwd, options.markdownOut);

  const window = buildPeriodWindow(options, new Date());

  const [
    intentEventsRaw,
    approvalEventsRaw,
    executionRecordsRaw,
    feedbackRaw,
    matrixSignalsRaw,
    dialogueAuthorizationSignalsRaw,
    runtimeSignalsRaw,
    authorizationTierSignalsRaw
  ] = await Promise.all([
    readJsonLinesFile(intentAuditPath),
    readJsonLinesFile(approvalAuditPath),
    readJsonLinesFile(executionLedgerPath),
    readJsonLinesFile(feedbackFilePath),
    readJsonLinesFile(matrixSignalsPath),
    readJsonLinesFile(dialogueAuthorizationSignalsPath),
    readJsonLinesFile(runtimeSignalsPath),
    readJsonLinesFile(authorizationTierSignalsPath)
  ]);

  const thresholds = loadThresholds(
    await fs.readJson(thresholdsPath).catch(() => ({}))
  );

  const intentEvents = filterByWindow(
    intentEventsRaw.filter(item => item && (item.intent_id || `${item.event_type || ''}`.startsWith('interactive.intent.'))),
    ['timestamp', 'created_at', 'generated_at'],
    window
  );

  const approvalEvents = filterByWindow(
    approvalEventsRaw.filter(item => item && item.action),
    ['timestamp', 'updated_at', 'created_at'],
    window
  );

  const executionRecords = filterByWindow(
    executionRecordsRaw.filter(item => item && item.execution_id && item.result),
    ['executed_at', 'timestamp'],
    window
  );

  const feedbackEvents = filterByWindow(
    feedbackRaw,
    ['timestamp', 'created_at', 'submitted_at'],
    window
  );

  const matrixSignals = filterByWindow(
    matrixSignalsRaw.filter(item => item && item.matrix && typeof item.matrix === 'object'),
    ['generated_at', 'timestamp', 'created_at'],
    window
  );
  const dialogueAuthorizationSignals = filterByWindow(
    dialogueAuthorizationSignalsRaw.filter(item => item && item.decision),
    ['timestamp', 'evaluated_at', 'generated_at', 'created_at'],
    window
  );
  const runtimeSignals = filterByWindow(
    runtimeSignalsRaw.filter(item => item && item.decision),
    ['timestamp', 'evaluated_at', 'generated_at', 'created_at'],
    window
  );
  const authorizationTierSignals = filterByWindow(
    authorizationTierSignalsRaw.filter(item => item && item.decision),
    ['timestamp', 'evaluated_at', 'generated_at', 'created_at'],
    window
  );

  const applyRecords = executionRecords.filter(item =>
    ['success', 'failed', 'skipped'].includes(`${item.result || ''}`.trim().toLowerCase())
  );
  const rollbackRecords = executionRecords.filter(item =>
    `${item.result || ''}`.trim().toLowerCase() === 'rolled-back'
  );

  const successApplyCount = applyRecords.filter(item =>
    `${item.result || ''}`.trim().toLowerCase() === 'success'
  ).length;
  const failedApplyCount = applyRecords.filter(item =>
    `${item.result || ''}`.trim().toLowerCase() === 'failed'
  ).length;
  const skippedApplyCount = applyRecords.filter(item =>
    `${item.result || ''}`.trim().toLowerCase() === 'skipped'
  ).length;
  const executedApplyCount = successApplyCount + failedApplyCount;
  const securityInterceptCount = applyRecords.filter((item) => {
    const decision = `${item.policy_decision || ''}`.trim().toLowerCase();
    const result = `${item.result || ''}`.trim().toLowerCase();
    return decision !== 'allow' || result === 'skipped';
  }).length;

  const feedbackScores = feedbackEvents
    .map(parseFeedbackScore)
    .filter(value => Number.isFinite(value) && value >= 0);
  const matrixScoreValues = matrixSignals
    .map((item) => Number(item && item.matrix ? item.matrix.avg_score : null))
    .filter(value => Number.isFinite(value));
  const matrixValidRateValues = matrixSignals
    .map((item) => Number(item && item.matrix ? item.matrix.valid_rate_percent : null))
    .filter(value => Number.isFinite(value));
  const matrixPortfolioPassedCount = matrixSignals.filter((item) =>
    item && item.matrix && item.matrix.portfolio_passed === true
  ).length;
  const matrixRegressionPositiveCount = matrixSignals.filter((item) =>
    Number(item && item.matrix ? item.matrix.regression_count : 0) > 0
  ).length;
  const matrixStageErrorCount = matrixSignals.filter((item) => {
    const status = `${item && item.matrix ? item.matrix.stage_status || '' : ''}`.trim().toLowerCase();
    return status === 'error' || status === 'non-zero-exit';
  }).length;
  const dialogueAuthorizationDenyCount = dialogueAuthorizationSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'deny'
  ).length;
  const dialogueAuthorizationReviewRequiredCount = dialogueAuthorizationSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'review-required'
  ).length;
  const dialogueAuthorizationAllowCount = dialogueAuthorizationSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'allow'
  ).length;
  const dialogueAuthorizationBlockCount = dialogueAuthorizationDenyCount + dialogueAuthorizationReviewRequiredCount;
  const dialogueAuthorizationUserAppApplyAttemptCount = dialogueAuthorizationSignals.filter((item) =>
    `${item && item.ui_mode ? item.ui_mode : ''}`.trim().toLowerCase() === 'user-app' &&
    `${item && item.execution_mode ? item.execution_mode : ''}`.trim().toLowerCase() === 'apply'
  ).length;
  const runtimeDenyCount = runtimeSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'deny'
  ).length;
  const runtimeReviewRequiredCount = runtimeSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'review-required'
  ).length;
  const runtimeAllowCount = runtimeSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'allow'
  ).length;
  const runtimeBlockCount = runtimeDenyCount + runtimeReviewRequiredCount;
  const runtimeUiModeViolationCount = runtimeSignals.filter((item) => {
    if (item && item.ui_mode_violation === true) {
      return true;
    }
    const codes = Array.isArray(item && item.violation_codes)
      ? item.violation_codes
      : [];
    return codes.some(code => `${code || ''}`.trim().toLowerCase().startsWith('ui-mode-'));
  }).length;
  const authorizationTierDenyCount = authorizationTierSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'deny'
  ).length;
  const authorizationTierReviewRequiredCount = authorizationTierSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'review-required'
  ).length;
  const authorizationTierAllowCount = authorizationTierSignals.filter((item) =>
    `${item && item.decision ? item.decision : ''}`.trim().toLowerCase() === 'allow'
  ).length;
  const authorizationTierBlockCount = authorizationTierDenyCount + authorizationTierReviewRequiredCount;
  const dialogueAuthorizationBusinessModeBreakdown = buildBusinessModeBreakdown(dialogueAuthorizationSignals);
  const runtimeBusinessModeBreakdown = buildBusinessModeBreakdown(runtimeSignals);
  const authorizationTierBusinessModeBreakdown = buildBusinessModeBreakdown(authorizationTierSignals);
  const businessModeUnknownSignalTotal =
    dialogueAuthorizationBusinessModeBreakdown.unknown_total +
    runtimeBusinessModeBreakdown.unknown_total +
    authorizationTierBusinessModeBreakdown.unknown_total;

  const approvalSubmittedCount = approvalEvents.filter(item =>
    `${item.action || ''}`.trim().toLowerCase() === 'submit' && item.blocked !== true
  ).length;
  const approvalApprovedCount = approvalEvents.filter(item =>
    `${item.action || ''}`.trim().toLowerCase() === 'approve' && item.blocked !== true
  ).length;
  const approvalRejectedCount = approvalEvents.filter(item =>
    `${item.action || ''}`.trim().toLowerCase() === 'reject' && item.blocked !== true
  ).length;

  const metrics = {
    intent_total: intentEvents.length,
    apply_total: applyRecords.length,
    apply_success_total: successApplyCount,
    apply_failed_total: failedApplyCount,
    apply_skipped_total: skippedApplyCount,
    rollback_total: rollbackRecords.length,
    security_intercept_total: securityInterceptCount,
    approval_submitted_total: approvalSubmittedCount,
    approval_approved_total: approvalApprovedCount,
    approval_rejected_total: approvalRejectedCount,
    adoption_rate_percent: toRatePercent(successApplyCount, intentEvents.length),
    execution_success_rate_percent: toRatePercent(successApplyCount, executedApplyCount),
    rollback_rate_percent: toRatePercent(rollbackRecords.length, successApplyCount),
    security_intercept_rate_percent: toRatePercent(securityInterceptCount, applyRecords.length),
    satisfaction_avg_score: toAverage(feedbackScores),
    satisfaction_response_count: feedbackScores.length,
    matrix_signal_total: matrixSignals.length,
    dialogue_authorization_total: dialogueAuthorizationSignals.length,
    dialogue_authorization_allow_total: dialogueAuthorizationAllowCount,
    dialogue_authorization_deny_total: dialogueAuthorizationDenyCount,
    dialogue_authorization_review_required_total: dialogueAuthorizationReviewRequiredCount,
    dialogue_authorization_block_total: dialogueAuthorizationBlockCount,
    dialogue_authorization_user_app_apply_attempt_total: dialogueAuthorizationUserAppApplyAttemptCount,
    dialogue_authorization_unknown_business_mode_total: dialogueAuthorizationBusinessModeBreakdown.unknown_total,
    dialogue_authorization_business_mode_breakdown: dialogueAuthorizationBusinessModeBreakdown,
    runtime_total: runtimeSignals.length,
    runtime_allow_total: runtimeAllowCount,
    runtime_deny_total: runtimeDenyCount,
    runtime_review_required_total: runtimeReviewRequiredCount,
    runtime_block_total: runtimeBlockCount,
    runtime_ui_mode_violation_total: runtimeUiModeViolationCount,
    runtime_unknown_business_mode_total: runtimeBusinessModeBreakdown.unknown_total,
    runtime_business_mode_breakdown: runtimeBusinessModeBreakdown,
    authorization_tier_total: authorizationTierSignals.length,
    authorization_tier_allow_total: authorizationTierAllowCount,
    authorization_tier_deny_total: authorizationTierDenyCount,
    authorization_tier_review_required_total: authorizationTierReviewRequiredCount,
    authorization_tier_block_total: authorizationTierBlockCount,
    authorization_tier_unknown_business_mode_total: authorizationTierBusinessModeBreakdown.unknown_total,
    authorization_tier_business_mode_breakdown: authorizationTierBusinessModeBreakdown,
    business_mode_unknown_signal_total: businessModeUnknownSignalTotal,
    matrix_portfolio_pass_total: matrixPortfolioPassedCount,
    matrix_regression_positive_total: matrixRegressionPositiveCount,
    matrix_stage_error_total: matrixStageErrorCount,
    matrix_portfolio_pass_rate_percent: toRatePercent(matrixPortfolioPassedCount, matrixSignals.length),
    matrix_regression_positive_rate_percent: toRatePercent(matrixRegressionPositiveCount, matrixSignals.length),
    matrix_stage_error_rate_percent: toRatePercent(matrixStageErrorCount, matrixSignals.length),
    dialogue_authorization_block_rate_percent: toRatePercent(dialogueAuthorizationBlockCount, dialogueAuthorizationSignals.length),
    runtime_block_rate_percent: toRatePercent(runtimeBlockCount, runtimeSignals.length),
    runtime_ui_mode_violation_rate_percent: toRatePercent(runtimeUiModeViolationCount, runtimeSignals.length),
    authorization_tier_block_rate_percent: toRatePercent(authorizationTierBlockCount, authorizationTierSignals.length),
    matrix_avg_score: toAverage(matrixScoreValues),
    matrix_avg_valid_rate_percent: toAverage(matrixValidRateValues)
  };

  const alerts = evaluateAlerts(metrics, thresholds);
  const recommendations = buildRecommendations(alerts);
  const breachCount = alerts.filter(item => item.status === 'breach').length;
  const warningCount = alerts.filter(item => item.status === 'warning').length;

  const report = {
    mode: 'interactive-governance-report',
    generated_at: new Date().toISOString(),
    period: {
      type: window.period,
      from: window.from ? window.from.toISOString() : null,
      to: window.to ? window.to.toISOString() : null
    },
    inputs: {
      intent_audit: path.relative(cwd, intentAuditPath) || '.',
      approval_audit: path.relative(cwd, approvalAuditPath) || '.',
      execution_ledger: path.relative(cwd, executionLedgerPath) || '.',
      feedback_file: path.relative(cwd, feedbackFilePath) || '.',
      matrix_signals: path.relative(cwd, matrixSignalsPath) || '.',
      dialogue_authorization_signals: path.relative(cwd, dialogueAuthorizationSignalsPath) || '.',
      runtime_signals: path.relative(cwd, runtimeSignalsPath) || '.',
      authorization_tier_signals: path.relative(cwd, authorizationTierSignalsPath) || '.',
      thresholds: path.relative(cwd, thresholdsPath) || '.'
    },
    thresholds,
    metrics,
    summary: {
      breaches: breachCount,
      warnings: warningCount,
      status: breachCount > 0 ? 'alert' : 'ok'
    },
    alerts,
    recommendations,
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
    process.stdout.write(`Interactive governance report generated: ${report.summary.status}\n`);
    process.stdout.write(`- JSON: ${report.output.json}\n`);
    process.stdout.write(`- Markdown: ${report.output.markdown}\n`);
    process.stdout.write(`- Breaches: ${report.summary.breaches}\n`);
    process.stdout.write(`- Warnings: ${report.summary.warnings}\n`);
  }

  if (
    options.failOnAlert &&
    alerts.some(item => item.status === 'breach' && ['medium', 'high'].includes(item.severity))
  ) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive governance report failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_INTENT_AUDIT,
  DEFAULT_APPROVAL_AUDIT,
  DEFAULT_EXECUTION_LEDGER,
  DEFAULT_FEEDBACK_FILE,
  DEFAULT_MATRIX_SIGNALS,
  DEFAULT_DIALOGUE_AUTHORIZATION_SIGNALS,
  DEFAULT_RUNTIME_SIGNALS,
  DEFAULT_AUTHORIZATION_TIER_SIGNALS,
  DEFAULT_THRESHOLDS,
  DEFAULT_OUT,
  DEFAULT_MARKDOWN_OUT,
  parseArgs,
  buildPeriodWindow,
  readJsonLinesFile,
  filterByWindow,
  toRatePercent,
  toAverage,
  normalizeBusinessMode,
  buildBusinessModeBreakdown,
  loadThresholds,
  evaluateAlerts,
  parseFeedbackScore,
  buildMarkdown,
  main
};
