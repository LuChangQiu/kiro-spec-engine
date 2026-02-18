'use strict';

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = `${value}`.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeRisk(value) {
  const normalized = `${value || 'unknown'}`.trim().toLowerCase();
  if (['low', 'medium', 'high', 'unknown'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
}

function countConsecutive(items, predicate) {
  let count = 0;
  for (const item of items) {
    if (!predicate(item)) {
      break;
    }
    count += 1;
  }
  return count;
}

function resolveReleaseDriftThresholds(env = process.env) {
  return {
    failStreakMin: Math.max(
      1,
      Math.floor(parseNumber(env.RELEASE_DRIFT_FAIL_STREAK_MIN, 2))
    ),
    highRiskShareMinPercent: Math.max(
      0,
      Math.min(100, parseNumber(env.RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT, 60))
    ),
    highRiskShareDeltaMinPercent: Math.max(
      0,
      Math.min(100, parseNumber(env.RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT, 25))
    ),
    preflightBlockRateMinPercent: Math.max(
      0,
      Math.min(100, parseNumber(env.RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT, 40))
    ),
    hardGateBlockStreakMin: Math.max(
      1,
      Math.floor(parseNumber(env.RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN, 2))
    ),
    preflightUnavailableStreakMin: Math.max(
      1,
      Math.floor(parseNumber(env.RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN, 2))
    )
  };
}

function buildReleaseDriftSignals(payload = {}, options = {}) {
  const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
  const windowSize = Math.max(1, Math.floor(parseNumber(options.windowSize, 5)));
  const shortWindowSize = Math.max(1, Math.floor(parseNumber(options.shortWindowSize, 3)));
  const longWindowSize = Math.max(shortWindowSize, Math.floor(parseNumber(options.longWindowSize, 5)));
  const thresholds = options.thresholds || resolveReleaseDriftThresholds(options.env || process.env);

  const recent = entries.slice(0, Math.min(entries.length, windowSize));
  const shortWindow = entries.slice(0, Math.min(entries.length, shortWindowSize));
  const longWindow = entries.slice(0, Math.min(entries.length, longWindowSize));

  const riskCounts = recent.reduce((acc, item) => {
    const risk = normalizeRisk(item && item.risk_level);
    acc[risk] += 1;
    return acc;
  }, { low: 0, medium: 0, high: 0, unknown: 0 });

  const recentPass = recent.filter(item => item && item.gate_passed === true).length;
  const recentKnown = recent.filter(item => item && typeof item.gate_passed === 'boolean').length;
  const failedStreak = countConsecutive(recent, item => item && item.gate_passed === false);
  const highRiskShare = recent.length > 0
    ? Number(((riskCounts.high / recent.length) * 100).toFixed(2))
    : 0;
  const shortHighShare = shortWindow.length > 0
    ? shortWindow.filter(item => normalizeRisk(item && item.risk_level) === 'high').length / shortWindow.length
    : 0;
  const longHighShare = longWindow.length > 0
    ? longWindow.filter(item => normalizeRisk(item && item.risk_level) === 'high').length / longWindow.length
    : 0;
  const highRiskDeltaPercent = Number(((shortHighShare - longHighShare) * 100).toFixed(2));

  const recentPreflightKnown = recent.filter(
    item => item && typeof item.release_gate_preflight_blocked === 'boolean'
  ).length;
  const recentPreflightBlocked = recent.filter(
    item => item && item.release_gate_preflight_blocked === true
  ).length;
  const recentPreflightBlockedRate = recentPreflightKnown > 0
    ? Number(((recentPreflightBlocked / recentPreflightKnown) * 100).toFixed(2))
    : null;
  const hardGateBlockedStreak = countConsecutive(
    recent,
    item => item && item.require_release_gate_preflight === true && item.release_gate_preflight_blocked === true
  );
  const preflightUnavailableStreak = countConsecutive(
    recent,
    item => item && item.release_gate_preflight_available === false
  );

  const alerts = [];
  if (failedStreak >= thresholds.failStreakMin) {
    alerts.push(`consecutive gate failures: ${failedStreak} (threshold=${thresholds.failStreakMin})`);
  }
  if (highRiskShare >= thresholds.highRiskShareMinPercent) {
    alerts.push(
      `high-risk share in latest ${windowSize} is ${highRiskShare}% `
      + `(threshold=${thresholds.highRiskShareMinPercent}%)`
    );
  }
  if (
    shortWindow.length >= 2 &&
    longWindow.length >= 3 &&
    highRiskDeltaPercent >= thresholds.highRiskShareDeltaMinPercent
  ) {
    alerts.push(
      `high-risk share increased from ${(longHighShare * 100).toFixed(2)}% to ${(shortHighShare * 100).toFixed(2)}% `
      + `(threshold=${thresholds.highRiskShareDeltaMinPercent}%)`
    );
  }
  if (
    recentPreflightBlockedRate !== null &&
    recentPreflightBlockedRate >= thresholds.preflightBlockRateMinPercent
  ) {
    alerts.push(
      `release preflight blocked rate in latest ${windowSize} is ${recentPreflightBlockedRate}% `
      + `(threshold=${thresholds.preflightBlockRateMinPercent}%, known=${recentPreflightKnown})`
    );
  }
  if (hardGateBlockedStreak >= thresholds.hardGateBlockStreakMin) {
    alerts.push(
      `hard-gate preflight blocked streak is ${hardGateBlockedStreak} `
      + `(threshold=${thresholds.hardGateBlockStreakMin})`
    );
  }
  if (preflightUnavailableStreak >= thresholds.preflightUnavailableStreakMin) {
    alerts.push(
      `release preflight unavailable streak is ${preflightUnavailableStreak} `
      + `(threshold=${thresholds.preflightUnavailableStreakMin})`
    );
  }

  return {
    entries,
    recent,
    recentPass,
    recentKnown,
    riskCounts,
    failedStreak,
    highRiskShare,
    highRiskDeltaPercent,
    recentPreflightKnown,
    recentPreflightBlocked,
    recentPreflightBlockedRate,
    hardGateBlockedStreak,
    preflightUnavailableStreak,
    alerts,
    thresholds,
    windows: {
      recent: recent.length,
      short: shortWindow.length,
      long: longWindow.length
    }
  };
}

module.exports = {
  buildReleaseDriftSignals,
  parseBoolean,
  parseNumber,
  resolveReleaseDriftThresholds
};

