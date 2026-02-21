#!/usr/bin/env node
'use strict';

const fs = require('fs');

function appendSummary(summaryPath, lines = []) {
  if (!summaryPath) {
    return;
  }
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n\n`, 'utf8');
}

function readValue(env, name, fallback = '') {
  const value = env[name];
  return value === undefined || value === null ? fallback : `${value}`.trim();
}

function parseBoolean(raw, fallback) {
  const value = `${raw || ''}`.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(value)) {
    return false;
  }
  return fallback;
}

function normalizeRiskLevel(raw, fallback = 'medium') {
  const value = `${raw || ''}`.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (['low', 'medium', 'high', 'unknown'].includes(value)) {
    return value;
  }
  return fallback;
}

function riskRank(level) {
  const normalized = normalizeRiskLevel(level, 'unknown');
  if (normalized === 'low') {
    return 1;
  }
  if (normalized === 'medium') {
    return 2;
  }
  if (normalized === 'high') {
    return 3;
  }
  return 4;
}

function parseOptionalNumberWithWarning(env, name, warnings) {
  const raw = readValue(env, name, '');
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  warnings.push(`invalid number ${name}=${raw}, fallback=default`);
  return null;
}

function safeReadJson(file) {
  if (!file || !fs.existsSync(file)) {
    return {
      ok: false,
      error: `missing file: ${file || 'n/a'}`,
      payload: null
    };
  }
  try {
    return {
      ok: true,
      error: null,
      payload: JSON.parse(fs.readFileSync(file, 'utf8'))
    };
  } catch (error) {
    return {
      ok: false,
      error: `parse error: ${error.message}`,
      payload: null
    };
  }
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildWeeklyOpsSignals(payload) {
  const health = payload && payload.health && typeof payload.health === 'object'
    ? payload.health
    : {};
  const snapshots = payload && payload.snapshots && typeof payload.snapshots === 'object'
    ? payload.snapshots
    : {};
  const governance = snapshots.interactive_governance && typeof snapshots.interactive_governance === 'object'
    ? snapshots.interactive_governance
    : {};
  const matrixSignals = snapshots.matrix_signals && typeof snapshots.matrix_signals === 'object'
    ? snapshots.matrix_signals
    : {};
  const handoff = snapshots.handoff && typeof snapshots.handoff === 'object'
    ? snapshots.handoff
    : {};

  return {
    risk: normalizeRiskLevel(health.risk, 'unknown'),
    concerns_count: Array.isArray(health.concerns) ? health.concerns.length : 0,
    governance_status: typeof governance.status === 'string' ? governance.status : null,
    governance_breaches: normalizeNumber(governance.breaches),
    authorization_tier_block_rate_percent: normalizeNumber(governance.authorization_tier_block_rate_percent),
    dialogue_authorization_block_rate_percent: normalizeNumber(governance.dialogue_authorization_block_rate_percent),
    runtime_block_rate_percent: normalizeNumber(governance.runtime_block_rate_percent),
    runtime_ui_mode_violation_total: normalizeNumber(governance.runtime_ui_mode_violation_total),
    runtime_ui_mode_violation_rate_percent: normalizeNumber(governance.runtime_ui_mode_violation_rate_percent),
    matrix_regression_positive_rate_percent: normalizeNumber(matrixSignals.regression_positive_rate_percent),
    handoff_gate_pass_rate_percent: normalizeNumber(handoff.gate_pass_rate_percent)
  };
}

function mergeGateReport(gateReportFile, payload) {
  if (!gateReportFile) {
    return;
  }
  let base = {};
  try {
    if (fs.existsSync(gateReportFile)) {
      base = JSON.parse(fs.readFileSync(gateReportFile, 'utf8'));
    }
  } catch (_error) {
    base = {};
  }
  base.weekly_ops = payload;
  base.updated_at = payload.evaluated_at;
  fs.writeFileSync(gateReportFile, `${JSON.stringify(base, null, 2)}\n`, 'utf8');
}

function evaluateReleaseWeeklyOpsGate(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();

  const summaryFile = readValue(env, 'RELEASE_WEEKLY_OPS_SUMMARY_FILE', '');
  const enforce = parseBoolean(readValue(env, 'RELEASE_WEEKLY_OPS_ENFORCE', ''), true);
  const requireSummary = parseBoolean(readValue(env, 'RELEASE_WEEKLY_OPS_REQUIRE_SUMMARY', ''), true);
  const maxRiskLevel = normalizeRiskLevel(readValue(env, 'RELEASE_WEEKLY_OPS_MAX_RISK_LEVEL', ''), 'medium');
  const configWarnings = [];
  const maxGovernanceBreaches = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_GOVERNANCE_BREACHES',
    configWarnings
  );
  const maxAuthorizationTierBlockRatePercentRaw = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_AUTHORIZATION_TIER_BLOCK_RATE_PERCENT',
    configWarnings
  );
  const maxAuthorizationTierBlockRatePercent = Number.isFinite(maxAuthorizationTierBlockRatePercentRaw)
    ? maxAuthorizationTierBlockRatePercentRaw
    : 40;
  const maxDialogueAuthorizationBlockRatePercentRaw = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_DIALOGUE_AUTHORIZATION_BLOCK_RATE_PERCENT',
    configWarnings
  );
  const maxDialogueAuthorizationBlockRatePercent = Number.isFinite(maxDialogueAuthorizationBlockRatePercentRaw)
    ? maxDialogueAuthorizationBlockRatePercentRaw
    : 40;
  const maxRuntimeUiModeViolationTotalRaw = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_RUNTIME_UI_MODE_VIOLATION_TOTAL',
    configWarnings
  );
  const maxRuntimeUiModeViolationTotal = Number.isFinite(maxRuntimeUiModeViolationTotalRaw)
    ? maxRuntimeUiModeViolationTotalRaw
    : 0;
  const maxRuntimeUiModeViolationRatePercent = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_RUNTIME_UI_MODE_VIOLATION_RATE_PERCENT',
    configWarnings
  );
  const maxMatrixRegressionPositiveRatePercent = parseOptionalNumberWithWarning(
    env,
    'RELEASE_WEEKLY_OPS_MAX_MATRIX_REGRESSION_RATE_PERCENT',
    configWarnings
  );
  const gateReportFile = readValue(env, 'RELEASE_GATE_REPORT_FILE', '');
  const summaryPath = readValue(env, 'GITHUB_STEP_SUMMARY', '');

  const violations = [];
  const warnings = configWarnings.slice();
  const summaryResult = safeReadJson(summaryFile);
  let signals = null;

  if (!summaryResult.ok) {
    if (requireSummary) {
      violations.push(summaryResult.error);
    } else {
      warnings.push(summaryResult.error);
    }
  } else {
    signals = buildWeeklyOpsSignals(summaryResult.payload);
    if (riskRank(signals.risk) > riskRank(maxRiskLevel)) {
      violations.push(`weekly ops risk ${signals.risk} exceeds max ${maxRiskLevel}`);
    }
    if (
      Number.isFinite(maxGovernanceBreaches)
      && Number.isFinite(signals.governance_breaches)
      && signals.governance_breaches > maxGovernanceBreaches
    ) {
      violations.push(
        `weekly ops governance breaches ${signals.governance_breaches} exceeds max ${maxGovernanceBreaches}`
      );
    }
    if (
      Number.isFinite(maxAuthorizationTierBlockRatePercent)
      && Number.isFinite(signals.authorization_tier_block_rate_percent)
      && signals.authorization_tier_block_rate_percent > maxAuthorizationTierBlockRatePercent
    ) {
      violations.push(
        `weekly ops authorization-tier block rate ${signals.authorization_tier_block_rate_percent}% exceeds max ${maxAuthorizationTierBlockRatePercent}%`
      );
    }
    if (
      Number.isFinite(maxDialogueAuthorizationBlockRatePercent)
      && Number.isFinite(signals.dialogue_authorization_block_rate_percent)
      && signals.dialogue_authorization_block_rate_percent > maxDialogueAuthorizationBlockRatePercent
    ) {
      violations.push(
        `weekly ops dialogue-authorization block rate ${signals.dialogue_authorization_block_rate_percent}% exceeds max ${maxDialogueAuthorizationBlockRatePercent}%`
      );
    }
    if (
      Number.isFinite(maxRuntimeUiModeViolationTotal)
      && Number.isFinite(signals.runtime_ui_mode_violation_total)
      && signals.runtime_ui_mode_violation_total > maxRuntimeUiModeViolationTotal
    ) {
      violations.push(
        `weekly ops runtime ui-mode violation total ${signals.runtime_ui_mode_violation_total} exceeds max ${maxRuntimeUiModeViolationTotal}`
      );
    }
    if (
      Number.isFinite(maxRuntimeUiModeViolationRatePercent)
      && Number.isFinite(signals.runtime_ui_mode_violation_rate_percent)
      && signals.runtime_ui_mode_violation_rate_percent > maxRuntimeUiModeViolationRatePercent
    ) {
      violations.push(
        `weekly ops runtime ui-mode violation rate ${signals.runtime_ui_mode_violation_rate_percent}% exceeds max ${maxRuntimeUiModeViolationRatePercent}%`
      );
    }
    if (
      Number.isFinite(maxMatrixRegressionPositiveRatePercent)
      && Number.isFinite(signals.matrix_regression_positive_rate_percent)
      && signals.matrix_regression_positive_rate_percent > maxMatrixRegressionPositiveRatePercent
    ) {
      violations.push(
        `weekly ops matrix regression-positive rate ${signals.matrix_regression_positive_rate_percent}% exceeds max ${maxMatrixRegressionPositiveRatePercent}%`
      );
    }
  }

  const blocked = enforce && violations.length > 0;
  const evaluatedAt = now();
  const payload = {
    mode: 'release-weekly-ops-gate',
    evaluated_at: evaluatedAt,
    summary_file: summaryFile || null,
    available: summaryResult.ok,
    enforce,
    require_summary: requireSummary,
    max_risk_level: maxRiskLevel,
    max_governance_breaches: maxGovernanceBreaches,
    max_authorization_tier_block_rate_percent: maxAuthorizationTierBlockRatePercent,
    max_dialogue_authorization_block_rate_percent: maxDialogueAuthorizationBlockRatePercent,
    max_runtime_ui_mode_violation_total: maxRuntimeUiModeViolationTotal,
    max_runtime_ui_mode_violation_rate_percent: maxRuntimeUiModeViolationRatePercent,
    max_matrix_regression_positive_rate_percent: maxMatrixRegressionPositiveRatePercent,
    config_warnings: configWarnings,
    signals,
    warnings,
    violations,
    blocked
  };

  mergeGateReport(gateReportFile, payload);

  const summaryLines = [
    '## Release Weekly Ops Gate',
    '',
    `- enforce: ${enforce}`,
    `- require summary: ${requireSummary}`,
    `- max risk level: ${maxRiskLevel}`,
    `- summary file: ${summaryFile || 'n/a'}`,
    `- available: ${summaryResult.ok}`
  ];
  if (Number.isFinite(maxGovernanceBreaches)) {
    summaryLines.push(`- max governance breaches: ${maxGovernanceBreaches}`);
  }
  if (Number.isFinite(maxAuthorizationTierBlockRatePercent)) {
    summaryLines.push(`- max authorization-tier block rate: ${maxAuthorizationTierBlockRatePercent}%`);
  }
  if (Number.isFinite(maxDialogueAuthorizationBlockRatePercent)) {
    summaryLines.push(`- max dialogue-authorization block rate: ${maxDialogueAuthorizationBlockRatePercent}%`);
  }
  if (Number.isFinite(maxRuntimeUiModeViolationTotal)) {
    summaryLines.push(`- max runtime ui-mode violation total: ${maxRuntimeUiModeViolationTotal}`);
  }
  if (Number.isFinite(maxRuntimeUiModeViolationRatePercent)) {
    summaryLines.push(`- max runtime ui-mode violation rate: ${maxRuntimeUiModeViolationRatePercent}%`);
  }
  if (Number.isFinite(maxMatrixRegressionPositiveRatePercent)) {
    summaryLines.push(`- max matrix regression-positive rate: ${maxMatrixRegressionPositiveRatePercent}%`);
  }
  if (signals) {
    summaryLines.push(`- risk: ${signals.risk}`);
    summaryLines.push(`- governance breaches: ${signals.governance_breaches === null ? 'n/a' : signals.governance_breaches}`);
    summaryLines.push(
      `- authorization-tier block rate: ${signals.authorization_tier_block_rate_percent === null ? 'n/a' : `${signals.authorization_tier_block_rate_percent}%`}`
    );
    summaryLines.push(
      `- dialogue-authorization block rate: ${signals.dialogue_authorization_block_rate_percent === null ? 'n/a' : `${signals.dialogue_authorization_block_rate_percent}%`}`
    );
    summaryLines.push(
      `- runtime ui-mode violation total: ${signals.runtime_ui_mode_violation_total === null ? 'n/a' : signals.runtime_ui_mode_violation_total}`
    );
    summaryLines.push(
      `- runtime ui-mode violation rate: ${signals.runtime_ui_mode_violation_rate_percent === null ? 'n/a' : `${signals.runtime_ui_mode_violation_rate_percent}%`}`
    );
    summaryLines.push(
      `- matrix regression-positive rate: ${signals.matrix_regression_positive_rate_percent === null ? 'n/a' : `${signals.matrix_regression_positive_rate_percent}%`}`
    );
    summaryLines.push(
      `- handoff gate pass rate: ${signals.handoff_gate_pass_rate_percent === null ? 'n/a' : `${signals.handoff_gate_pass_rate_percent}%`}`
    );
  }
  if (warnings.length > 0) {
    summaryLines.push('', '### Warnings');
    warnings.forEach(item => summaryLines.push(`- ${item}`));
  }
  if (violations.length > 0) {
    summaryLines.push('', '### Violations');
    violations.forEach(item => summaryLines.push(`- ${item}`));
  } else {
    summaryLines.push('', '### Result', '- gate passed');
  }
  appendSummary(summaryPath, summaryLines);

  console.log(
    `[release-weekly-ops-gate] enforce=${enforce} require_summary=${requireSummary} `
    + `max_risk_level=${maxRiskLevel} available=${summaryResult.ok}`
  );
  if (signals) {
    console.log(
      `[release-weekly-ops-gate] risk=${signals.risk} governance_breaches=${signals.governance_breaches === null ? 'n/a' : signals.governance_breaches} `
      + `authorization_tier_block_rate=${signals.authorization_tier_block_rate_percent === null ? 'n/a' : `${signals.authorization_tier_block_rate_percent}%`} `
      + `dialogue_authorization_block_rate=${signals.dialogue_authorization_block_rate_percent === null ? 'n/a' : `${signals.dialogue_authorization_block_rate_percent}%`} `
      + `runtime_ui_mode_violation_total=${signals.runtime_ui_mode_violation_total === null ? 'n/a' : signals.runtime_ui_mode_violation_total} `
      + `runtime_ui_mode_violation_rate=${signals.runtime_ui_mode_violation_rate_percent === null ? 'n/a' : `${signals.runtime_ui_mode_violation_rate_percent}%`} `
      + `matrix_regression_positive_rate=${signals.matrix_regression_positive_rate_percent === null ? 'n/a' : `${signals.matrix_regression_positive_rate_percent}%`}`
    );
  }
  warnings.forEach(item => console.warn(`[release-weekly-ops-gate] warning=${item}`));
  if (violations.length > 0) {
    console.error(`[release-weekly-ops-gate] violations=${violations.join('; ')}`);
  } else {
    console.log('[release-weekly-ops-gate] passed');
  }

  return {
    exit_code: blocked ? 1 : 0,
    blocked,
    warnings,
    violations,
    payload
  };
}

if (require.main === module) {
  const result = evaluateReleaseWeeklyOpsGate();
  process.exit(result.exit_code);
}

module.exports = {
  evaluateReleaseWeeklyOpsGate
};
