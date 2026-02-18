'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildReleaseDriftSignals,
  parseBoolean,
  resolveReleaseDriftThresholds
} = require('../../../scripts/release-drift-signals');

describe('release drift signals', () => {
  test('resolves thresholds from env with defaults and clamps', () => {
    const thresholds = resolveReleaseDriftThresholds({
      RELEASE_DRIFT_FAIL_STREAK_MIN: '3',
      RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT: '150',
      RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT: '-2',
      RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT: '55',
      RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN: '0',
      RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN: '4'
    });

    expect(thresholds).toEqual({
      failStreakMin: 3,
      highRiskShareMinPercent: 100,
      highRiskShareDeltaMinPercent: 0,
      preflightBlockRateMinPercent: 55,
      hardGateBlockStreakMin: 1,
      preflightUnavailableStreakMin: 4,
      capabilityExpectedUnknownRateMinPercent: 40,
      capabilityProvidedUnknownRateMinPercent: 40
    });
  });

  test('builds alerts including preflight and hard-gate drift signals', () => {
    const payload = {
      entries: [
        {
          tag: 'v1.3.0',
          gate_passed: false,
          risk_level: 'high',
          release_gate_preflight_available: false,
          release_gate_preflight_blocked: true,
          require_release_gate_preflight: true,
          capability_expected_unknown_count: 1,
          capability_provided_unknown_count: 2
        },
        {
          tag: 'v1.2.0',
          gate_passed: false,
          risk_level: 'high',
          release_gate_preflight_available: false,
          release_gate_preflight_blocked: true,
          require_release_gate_preflight: true,
          capability_expected_unknown_count: 0,
          capability_provided_unknown_count: 0
        },
        {
          tag: 'v1.1.0',
          gate_passed: true,
          risk_level: 'high',
          release_gate_preflight_available: true,
          release_gate_preflight_blocked: false,
          require_release_gate_preflight: false,
          capability_expected_unknown_count: 1,
          capability_provided_unknown_count: 0
        }
      ]
    };

    const signals = buildReleaseDriftSignals(payload, {
      thresholds: {
        failStreakMin: 2,
        highRiskShareMinPercent: 60,
        highRiskShareDeltaMinPercent: 0,
        preflightBlockRateMinPercent: 50,
        hardGateBlockStreakMin: 2,
        preflightUnavailableStreakMin: 2,
        capabilityExpectedUnknownRateMinPercent: 50,
        capabilityProvidedUnknownRateMinPercent: 50
      }
    });

    expect(signals.failedStreak).toBe(2);
    expect(signals.highRiskShare).toBe(100);
    expect(signals.recentPreflightBlockedRate).toBe(66.67);
    expect(signals.hardGateBlockedStreak).toBe(2);
    expect(signals.preflightUnavailableStreak).toBe(2);
    expect(signals.recentCapabilityExpectedUnknownRate).toBe(66.67);
    expect(signals.recentCapabilityProvidedUnknownRate).toBe(33.33);
    expect(signals.alerts).toEqual(expect.arrayContaining([
      expect.stringContaining('consecutive gate failures'),
      expect.stringContaining('high-risk share in latest 5'),
      expect.stringContaining('release preflight blocked rate'),
      expect.stringContaining('hard-gate preflight blocked streak'),
      expect.stringContaining('release preflight unavailable streak'),
      expect.stringContaining('capability expected unknown positive rate')
    ]));
    expect(signals.alerts.some(item => item.includes('capability provided unknown positive rate'))).toBe(false);
  });

  test('does not emit preflight block-rate alert without known preflight signals', () => {
    const signals = buildReleaseDriftSignals({
      entries: [
        { gate_passed: true, risk_level: 'low' },
        { gate_passed: true, risk_level: 'low' }
      ]
    }, {
      thresholds: {
        failStreakMin: 2,
        highRiskShareMinPercent: 100,
        highRiskShareDeltaMinPercent: 100,
        preflightBlockRateMinPercent: 1,
        hardGateBlockStreakMin: 1,
        preflightUnavailableStreakMin: 1,
        capabilityExpectedUnknownRateMinPercent: 1,
        capabilityProvidedUnknownRateMinPercent: 1
      }
    });

    expect(signals.recentPreflightKnown).toBe(0);
    expect(signals.recentPreflightBlockedRate).toBeNull();
    expect(signals.alerts.some(item => item.includes('release preflight blocked rate'))).toBe(false);
  });

  test('parses booleans with fallback', () => {
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean('off')).toBe(false);
    expect(parseBoolean('')).toBe(false);
    expect(parseBoolean('not-a-bool', true)).toBe(true);
  });

  test('replays blocked fixture and emits composite drift alerts', () => {
    const blockedFixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../fixtures/release-drift-history/blocked.json'),
        'utf8'
      )
    );

    const signals = buildReleaseDriftSignals(blockedFixture, {
      thresholds: {
        failStreakMin: 2,
        highRiskShareMinPercent: 60,
        highRiskShareDeltaMinPercent: 10,
        preflightBlockRateMinPercent: 50,
        hardGateBlockStreakMin: 2,
        preflightUnavailableStreakMin: 2,
        capabilityExpectedUnknownRateMinPercent: 100,
        capabilityProvidedUnknownRateMinPercent: 100
      }
    });

    expect(signals.alerts).toEqual(expect.arrayContaining([
      expect.stringContaining('consecutive gate failures'),
      expect.stringContaining('high-risk share'),
      expect.stringContaining('release preflight blocked rate'),
      expect.stringContaining('hard-gate preflight blocked streak'),
      expect.stringContaining('release preflight unavailable streak')
    ]));
  });

  test('replays healthy fixture and keeps alert list empty', () => {
    const healthyFixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../fixtures/release-drift-history/healthy.json'),
        'utf8'
      )
    );

    const signals = buildReleaseDriftSignals(healthyFixture, {
      thresholds: {
        failStreakMin: 2,
        highRiskShareMinPercent: 60,
        highRiskShareDeltaMinPercent: 10,
        preflightBlockRateMinPercent: 50,
        hardGateBlockStreakMin: 2,
        preflightUnavailableStreakMin: 2,
        capabilityExpectedUnknownRateMinPercent: 100,
        capabilityProvidedUnknownRateMinPercent: 100
      }
    });

    expect(signals.alerts).toEqual([]);
  });
});
