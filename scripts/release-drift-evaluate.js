'use strict';

const fs = require('fs');
const {
  buildReleaseDriftSignals,
  parseBoolean,
  resolveReleaseDriftThresholds
} = require('./release-drift-signals');

function appendSummary(summaryPath, lines = []) {
  if (!summaryPath) {
    return;
  }
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n\n`, 'utf8');
}

function buildThresholdPayload(thresholds) {
  return {
    fail_streak_min: thresholds.failStreakMin,
    high_risk_share_min_percent: thresholds.highRiskShareMinPercent,
    high_risk_share_delta_min_percent: thresholds.highRiskShareDeltaMinPercent,
    preflight_block_rate_min_percent: thresholds.preflightBlockRateMinPercent,
    hard_gate_block_streak_min: thresholds.hardGateBlockStreakMin,
    preflight_unavailable_streak_min: thresholds.preflightUnavailableStreakMin
  };
}

function evaluateReleaseDrift(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const now = typeof options.now === 'function'
    ? options.now
    : () => new Date().toISOString();
  const historyFile = env.RELEASE_DRIFT_HISTORY_FILE;
  const gateReportFile = env.RELEASE_GATE_REPORT_FILE;
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  const enforce = parseBoolean(env.RELEASE_DRIFT_ENFORCE, false);
  const thresholds = resolveReleaseDriftThresholds(env);

  if (!historyFile || !fs.existsSync(historyFile)) {
    const msg = `[release-drift] history summary missing: ${historyFile || 'n/a'}`;
    console.warn(msg);
    appendSummary(summaryPath, ['## Release Drift Alerts', '', `- ${msg}`]);
    return {
      exit_code: 0,
      blocked: false,
      alerts: [],
      warning: msg,
      drift: null
    };
  }

  let payload = null;
  try {
    payload = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch (error) {
    const msg = `[release-drift] failed to parse history summary: ${error.message}`;
    console.warn(msg);
    appendSummary(summaryPath, ['## Release Drift Alerts', '', `- ${msg}`]);
    return {
      exit_code: 0,
      blocked: false,
      alerts: [],
      warning: msg,
      drift: null
    };
  }

  const signals = buildReleaseDriftSignals(payload, { thresholds });
  const {
    alerts,
    failedStreak,
    hardGateBlockedStreak,
    highRiskDeltaPercent,
    highRiskShare,
    preflightUnavailableStreak,
    recentPreflightBlocked,
    recentPreflightBlockedRate,
    recentPreflightKnown,
    windows
  } = signals;
  const blocked = enforce && alerts.length > 0;
  const evaluatedAt = now();

  const driftPayload = {
    enforce,
    thresholds: buildThresholdPayload(thresholds),
    metrics: {
      failed_streak_latest5: failedStreak,
      high_risk_share_latest5_percent: highRiskShare,
      high_risk_share_delta_percent: highRiskDeltaPercent,
      preflight_known_latest5: recentPreflightKnown,
      preflight_blocked_latest5: recentPreflightBlocked,
      preflight_blocked_rate_latest5_percent: recentPreflightBlockedRate,
      hard_gate_blocked_streak_latest5: hardGateBlockedStreak,
      preflight_unavailable_streak_latest5: preflightUnavailableStreak,
      recent_window_size: windows.recent,
      short_window_size: windows.short,
      long_window_size: windows.long
    },
    alerts,
    alert_count: alerts.length,
    blocked,
    evaluated_at: evaluatedAt
  };

  console.log(
    `[release-drift] enforce=${enforce} fail_streak_threshold=${thresholds.failStreakMin} `
    + `high_share_threshold=${thresholds.highRiskShareMinPercent}% `
    + `high_delta_threshold=${thresholds.highRiskShareDeltaMinPercent}% `
    + `preflight_block_rate_threshold=${thresholds.preflightBlockRateMinPercent}% `
    + `hard_gate_block_streak_threshold=${thresholds.hardGateBlockStreakMin} `
    + `preflight_unavailable_streak_threshold=${thresholds.preflightUnavailableStreakMin}`
  );
  console.log(
    `[release-drift] metrics failed_streak=${failedStreak} high_share=${highRiskShare}% `
    + `high_delta=${highRiskDeltaPercent}% `
    + `preflight_block_rate=${recentPreflightBlockedRate === null ? 'n/a' : `${recentPreflightBlockedRate}%`} `
    + `hard_gate_block_streak=${hardGateBlockedStreak} `
    + `preflight_unavailable_streak=${preflightUnavailableStreak}`
  );
  if (alerts.length > 0) {
    alerts.forEach(item => console.warn(`[release-drift] alert=${item}`));
  } else {
    console.log('[release-drift] no drift alerts');
  }

  if (gateReportFile) {
    let gatePayload = {};
    try {
      if (fs.existsSync(gateReportFile)) {
        gatePayload = JSON.parse(fs.readFileSync(gateReportFile, 'utf8'));
      }
    } catch (_error) {
      gatePayload = {};
    }
    gatePayload.drift = driftPayload;
    gatePayload.updated_at = evaluatedAt;
    fs.writeFileSync(gateReportFile, `${JSON.stringify(gatePayload, null, 2)}\n`, 'utf8');
    console.log(`[release-drift] merged drift into gate report: ${gateReportFile}`);
  }

  const summaryLines = [
    '## Release Drift Alerts',
    '',
    `- enforce: ${enforce}`,
    `- fail streak threshold: ${thresholds.failStreakMin}`,
    `- high risk share threshold: ${thresholds.highRiskShareMinPercent}%`,
    `- high risk delta threshold: ${thresholds.highRiskShareDeltaMinPercent}%`,
    `- release preflight blocked rate threshold: ${thresholds.preflightBlockRateMinPercent}%`,
    `- hard-gate blocked streak threshold: ${thresholds.hardGateBlockStreakMin}`,
    `- preflight unavailable streak threshold: ${thresholds.preflightUnavailableStreakMin}`,
    `- failed streak (latest 5): ${failedStreak}`,
    `- high risk share (latest 5): ${highRiskShare}%`,
    `- high risk delta (short-long): ${highRiskDeltaPercent}%`,
    `- release preflight blocked ratio (latest 5): ${
      recentPreflightKnown === 0
        ? 'n/a'
        : `${recentPreflightBlocked}/${recentPreflightKnown} (${recentPreflightBlockedRate}%)`
    }`,
    `- hard-gate blocked streak (latest 5): ${hardGateBlockedStreak}`,
    `- preflight unavailable streak (latest 5): ${preflightUnavailableStreak}`
  ];
  if (alerts.length === 0) {
    summaryLines.push('', '- no alerts');
  } else {
    summaryLines.push('', '### Alerts');
    alerts.forEach(item => summaryLines.push(`- ${item}`));
  }
  appendSummary(summaryPath, summaryLines);

  if (blocked) {
    console.error(`[release-drift] blocked by drift alerts: ${alerts.join('; ')}`);
  }

  return {
    exit_code: blocked ? 1 : 0,
    blocked,
    alerts,
    warning: null,
    drift: driftPayload
  };
}

if (require.main === module) {
  const result = evaluateReleaseDrift();
  process.exit(result.exit_code);
}

module.exports = {
  evaluateReleaseDrift
};
