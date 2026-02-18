'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { evaluateReleaseDrift } = require('../../../scripts/release-drift-evaluate');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kse-release-drift-evaluate-'));
}

function readFixture(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../fixtures/release-drift-history', name),
      'utf8'
    )
  );
}

describe('release drift evaluate script', () => {
  test('writes drift payload into gate report and keeps advisory pass', () => {
    const tempDir = makeTempDir();
    const historyFile = path.join(tempDir, 'history.json');
    const gateFile = path.join(tempDir, 'release-gate.json');
    const summaryFile = path.join(tempDir, 'summary.md');
    fs.writeFileSync(historyFile, JSON.stringify(readFixture('blocked.json'), null, 2), 'utf8');
    fs.writeFileSync(gateFile, JSON.stringify({ gate_passed: false }, null, 2), 'utf8');

    const result = evaluateReleaseDrift({
      env: {
        RELEASE_DRIFT_HISTORY_FILE: historyFile,
        RELEASE_GATE_REPORT_FILE: gateFile,
        GITHUB_STEP_SUMMARY: summaryFile,
        RELEASE_DRIFT_ENFORCE: 'false',
        RELEASE_DRIFT_FAIL_STREAK_MIN: '2',
        RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT: '60',
        RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT: '10',
        RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT: '50',
        RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN: '2',
        RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN: '2'
      },
      now: () => '2026-02-18T00:00:00.000Z'
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.alerts.length).toBeGreaterThan(0);

    const gatePayload = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
    expect(gatePayload.drift).toEqual(expect.objectContaining({
      enforce: false,
      blocked: false,
      alert_count: expect.any(Number),
      evaluated_at: '2026-02-18T00:00:00.000Z'
    }));
    expect(gatePayload.drift.metrics).toEqual(expect.objectContaining({
      failed_streak_latest5: expect.any(Number),
      high_risk_share_latest5_percent: expect.any(Number)
    }));

    const summary = fs.readFileSync(summaryFile, 'utf8');
    expect(summary).toContain('## Release Drift Alerts');
    expect(summary).toContain('### Alerts');
  });

  test('returns blocking exit code when enforce is true and alerts exist', () => {
    const tempDir = makeTempDir();
    const historyFile = path.join(tempDir, 'history.json');
    fs.writeFileSync(historyFile, JSON.stringify(readFixture('blocked.json'), null, 2), 'utf8');

    const result = evaluateReleaseDrift({
      env: {
        RELEASE_DRIFT_HISTORY_FILE: historyFile,
        RELEASE_DRIFT_ENFORCE: 'true',
        RELEASE_DRIFT_FAIL_STREAK_MIN: '2',
        RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT: '60',
        RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT: '10',
        RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT: '50',
        RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN: '2',
        RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN: '2'
      }
    });

    expect(result.exit_code).toBe(1);
    expect(result.blocked).toBe(true);
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.drift).toEqual(expect.objectContaining({
      blocked: true,
      enforce: true
    }));
  });

  test('returns success and no alerts on healthy fixture', () => {
    const tempDir = makeTempDir();
    const historyFile = path.join(tempDir, 'history.json');
    const summaryFile = path.join(tempDir, 'summary.md');
    fs.writeFileSync(historyFile, JSON.stringify(readFixture('healthy.json'), null, 2), 'utf8');

    const result = evaluateReleaseDrift({
      env: {
        RELEASE_DRIFT_HISTORY_FILE: historyFile,
        GITHUB_STEP_SUMMARY: summaryFile,
        RELEASE_DRIFT_ENFORCE: 'true',
        RELEASE_DRIFT_FAIL_STREAK_MIN: '2',
        RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT: '60',
        RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT: '10',
        RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT: '50',
        RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN: '2',
        RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN: '2'
      }
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.alerts).toEqual([]);
    const summary = fs.readFileSync(summaryFile, 'utf8');
    expect(summary).toContain('- no alerts');
  });

  test('gracefully exits when history file is missing', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'summary.md');

    const result = evaluateReleaseDrift({
      env: {
        RELEASE_DRIFT_HISTORY_FILE: path.join(tempDir, 'missing.json'),
        GITHUB_STEP_SUMMARY: summaryFile,
        RELEASE_DRIFT_ENFORCE: 'true'
      }
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.warning).toContain('history summary missing');
    const summary = fs.readFileSync(summaryFile, 'utf8');
    expect(summary).toContain('history summary missing');
  });
});
