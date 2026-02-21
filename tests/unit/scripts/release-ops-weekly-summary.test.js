const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('release-ops-weekly-summary script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-release-ops-weekly-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('builds weekly ops summary from release evidence inputs', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'release-ops-weekly-summary.js');
    const workspace = path.join(tempDir, 'workspace');
    const evidenceFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    const gateHistoryFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'release-gate-history.json');
    const governanceFile = path.join(workspace, '.kiro', 'reports', 'interactive-governance-report.json');
    const matrixSignalsFile = path.join(workspace, '.kiro', 'reports', 'interactive-matrix-signals.jsonl');

    await fs.ensureDir(path.dirname(evidenceFile));
    await fs.ensureDir(path.dirname(governanceFile));

    await fs.writeJson(evidenceFile, {
      mode: 'auto-handoff-release-evidence',
      sessions: [
        {
          session_id: 'handoff-1',
          merged_at: '2026-02-15T02:00:00.000Z',
          status: 'completed',
          gate: {
            passed: true,
            actual: {
              spec_success_rate_percent: 98,
              risk_level: 'low',
              capability_expected_unknown_count: 0,
              capability_provided_unknown_count: 0
            }
          },
          release_gate_preflight: {
            blocked: false
          },
          scene_package_batch: {
            summary: {
              batch_gate_passed: true
            }
          }
        },
        {
          session_id: 'handoff-2',
          merged_at: '2026-02-16T03:00:00.000Z',
          status: 'failed',
          gate: {
            passed: false,
            actual: {
              spec_success_rate_percent: 80,
              risk_level: 'medium',
              capability_expected_unknown_count: 1,
              capability_provided_unknown_count: 0
            }
          },
          release_gate_preflight: {
            blocked: true
          },
          scene_package_batch: {
            summary: {
              batch_gate_passed: false
            }
          }
        }
      ]
    }, { spaces: 2 });

    await fs.writeJson(gateHistoryFile, {
      mode: 'auto-handoff-release-gate-history',
      entries: [
        {
          tag: 'v3.0.8',
          evaluated_at: '2026-02-15T05:00:00.000Z',
          gate_passed: true,
          risk_level: 'low',
          release_gate_preflight_blocked: false,
          capability_expected_unknown_count: 0,
          capability_provided_unknown_count: 0,
          drift_alert_count: 0
        },
        {
          tag: 'v3.0.9',
          evaluated_at: '2026-02-16T05:00:00.000Z',
          gate_passed: false,
          risk_level: 'high',
          release_gate_preflight_blocked: true,
          capability_expected_unknown_count: 1,
          capability_provided_unknown_count: 1,
          drift_alert_count: 2
        }
      ]
    }, { spaces: 2 });

    await fs.writeJson(governanceFile, {
      mode: 'interactive-governance-report',
      generated_at: '2026-02-16T10:00:00.000Z',
      summary: {
        status: 'ok',
        breaches: 0,
        warnings: 1
      },
      metrics: {
        authorization_tier_total: 2,
        authorization_tier_deny_total: 0,
        authorization_tier_review_required_total: 1,
        authorization_tier_block_rate_percent: 50,
        dialogue_authorization_total: 4,
        dialogue_authorization_block_total: 2,
        dialogue_authorization_block_rate_percent: 50,
        dialogue_authorization_user_app_apply_attempt_total: 1,
        matrix_signal_total: 2,
        matrix_portfolio_pass_rate_percent: 50,
        matrix_regression_positive_rate_percent: 50,
        matrix_stage_error_rate_percent: 0
      }
    }, { spaces: 2 });

    await fs.writeFile(
      matrixSignalsFile,
      [
        JSON.stringify({
          generated_at: '2026-02-15T03:00:00.000Z',
          matrix: {
            portfolio_passed: true,
            regression_count: 0,
            stage_status: 'ok',
            avg_score: 92
          }
        }),
        JSON.stringify({
          generated_at: '2026-02-16T03:00:00.000Z',
          matrix: {
            portfolio_passed: false,
            regression_count: 1,
            stage_status: 'non-zero-exit',
            avg_score: 70
          }
        })
      ].join('\n'),
      'utf8'
    );

    const result = spawnSync(process.execPath, [
      scriptPath,
      '--from', '2026-02-14T00:00:00.000Z',
      '--to', '2026-02-17T00:00:00.000Z',
      '--json'
    ], {
      cwd: workspace,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('release-weekly-ops-summary');
    expect(payload.snapshots.handoff.total_runs).toBe(2);
    expect(payload.snapshots.handoff.gate_pass_rate_percent).toBe(50);
    expect(payload.snapshots.release_gate_history.total_entries).toBe(2);
    expect(payload.snapshots.release_gate_history.drift_alert_positive_rate_percent).toBe(50);
    expect(payload.snapshots.interactive_governance.authorization_tier_total).toBe(2);
    expect(payload.snapshots.interactive_governance.authorization_tier_block_rate_percent).toBe(50);
    expect(payload.snapshots.interactive_governance.dialogue_authorization_total).toBe(4);
    expect(payload.snapshots.interactive_governance.dialogue_authorization_block_rate_percent).toBe(50);
    expect(payload.snapshots.matrix_signals.total_signals).toBe(2);
    expect(payload.health.risk).toMatch(/medium|high/);

    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'weekly-ops-summary.json'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'weekly-ops-summary.md'))).toBe(true);
  });

  test('emits warnings and recommendations when evidence files are missing', () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'release-ops-weekly-summary.js');
    const workspace = path.join(tempDir, 'workspace');
    fs.ensureDirSync(workspace);

    const result = spawnSync(process.execPath, [scriptPath, '--json'], {
      cwd: workspace,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(Array.isArray(payload.warnings)).toBe(true);
    expect(payload.warnings.length).toBeGreaterThan(0);
    expect(payload.health.risk).toMatch(/medium|high/);
    expect(payload.health.recommendations.some(item => item.includes('auto handoff run'))).toBe(true);
  });
});
