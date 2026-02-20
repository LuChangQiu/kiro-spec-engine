'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { evaluateReleaseWeeklyOpsGate } = require('../../../scripts/release-weekly-ops-gate');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sce-release-weekly-ops-gate-'));
}

describe('release weekly ops gate script', () => {
  test('passes when risk is within default threshold', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'weekly-ops-summary.json');
    const gateFile = path.join(tempDir, 'release-gate.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      mode: 'release-weekly-ops-summary',
      health: {
        risk: 'medium',
        concerns: ['sample concern']
      },
      snapshots: {
        interactive_governance: {
          status: 'ok',
          breaches: 0
        },
        matrix_signals: {
          regression_positive_rate_percent: 10
        },
        handoff: {
          gate_pass_rate_percent: 95
        }
      }
    }, null, 2), 'utf8');

    const result = evaluateReleaseWeeklyOpsGate({
      env: {
        RELEASE_WEEKLY_OPS_SUMMARY_FILE: summaryFile,
        RELEASE_GATE_REPORT_FILE: gateFile
      },
      now: () => '2026-02-20T00:00:00.000Z'
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.payload.violations).toEqual([]);
    const gatePayload = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
    expect(gatePayload.weekly_ops).toEqual(expect.objectContaining({
      mode: 'release-weekly-ops-gate',
      blocked: false,
      max_risk_level: 'medium'
    }));
  });

  test('blocks by default when risk is high', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'weekly-ops-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      mode: 'release-weekly-ops-summary',
      health: {
        risk: 'high',
        concerns: ['high risk concern']
      },
      snapshots: {
        interactive_governance: {
          status: 'alert',
          breaches: 2
        },
        matrix_signals: {
          regression_positive_rate_percent: 40
        },
        handoff: {
          gate_pass_rate_percent: 70
        }
      }
    }, null, 2), 'utf8');

    const result = evaluateReleaseWeeklyOpsGate({
      env: {
        RELEASE_WEEKLY_OPS_SUMMARY_FILE: summaryFile
      }
    });

    expect(result.exit_code).toBe(1);
    expect(result.blocked).toBe(true);
    expect(result.violations.some(item => item.includes('risk high'))).toBe(true);
  });

  test('does not block in advisory mode', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'weekly-ops-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      mode: 'release-weekly-ops-summary',
      health: {
        risk: 'high'
      },
      snapshots: {
        interactive_governance: {
          status: 'alert',
          breaches: 3
        },
        matrix_signals: {
          regression_positive_rate_percent: 45
        }
      }
    }, null, 2), 'utf8');

    const result = evaluateReleaseWeeklyOpsGate({
      env: {
        RELEASE_WEEKLY_OPS_SUMMARY_FILE: summaryFile,
        RELEASE_WEEKLY_OPS_ENFORCE: 'false',
        RELEASE_WEEKLY_OPS_MAX_GOVERNANCE_BREACHES: '0',
        RELEASE_WEEKLY_OPS_MAX_MATRIX_REGRESSION_RATE_PERCENT: '20'
      }
    });

    expect(result.exit_code).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  test('blocks when summary is missing and require_summary is enabled', () => {
    const tempDir = makeTempDir();
    const summaryFile = path.join(tempDir, 'missing-summary.json');

    const result = evaluateReleaseWeeklyOpsGate({
      env: {
        RELEASE_WEEKLY_OPS_SUMMARY_FILE: summaryFile
      }
    });

    expect(result.exit_code).toBe(1);
    expect(result.blocked).toBe(true);
    expect(result.violations.some(item => item.includes('missing file'))).toBe(true);
  });
});

