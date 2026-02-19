const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-release-summary script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-moqui-release-summary-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('builds a passed summary from release evidence inputs', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'moqui-release-summary.js');
    const workspace = path.join(tempDir, 'workspace');
    const evidenceFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    const baselineFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-template-baseline.json');
    const lexiconFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-lexicon-audit.json');
    const capabilityMatrixFile = path.join(workspace, '.kiro', 'reports', 'handoff-capability-matrix.json');

    await fs.ensureDir(path.dirname(evidenceFile));
    await fs.ensureDir(path.dirname(capabilityMatrixFile));

    await fs.writeJson(evidenceFile, {
      mode: 'auto-handoff-release-evidence',
      latest_session_id: 'handoff-pass',
      sessions: [
        {
          session_id: 'handoff-pass',
          merged_at: '2026-02-18T01:00:00.000Z',
          status: 'completed',
          policy: {
            max_moqui_matrix_regressions: 0
          },
          gate: {
            passed: true,
            actual: {
              spec_success_rate_percent: 100,
              risk_level: 'low'
            }
          },
          release_gate_preflight: {
            blocked: false
          },
          moqui_baseline: {
            status: 'passed',
            summary: {
              portfolio_passed: true,
              avg_score: 88,
              valid_rate_percent: 100,
              baseline_failed: 0
            },
            compare: {
              regressions: []
            }
          },
          moqui_capability_coverage: {
            summary: {
              passed: true,
              semantic_passed: true,
              coverage_percent: 100,
              semantic_complete_percent: 100,
              covered_capabilities: 5,
              uncovered_capabilities: 0
            }
          },
          scene_package_batch: {
            status: 'passed',
            summary: {
              batch_gate_passed: true,
              failed: 0,
              selected: 5
            }
          }
        }
      ]
    }, { spaces: 2 });

    await fs.writeJson(baselineFile, {
      mode: 'moqui-template-baseline',
      summary: {
        portfolio_passed: true,
        avg_score: 90,
        valid_rate_percent: 100,
        baseline_failed: 0
      },
      compare: {
        regressions: []
      }
    }, { spaces: 2 });

    await fs.writeJson(lexiconFile, {
      mode: 'moqui-lexicon-audit',
      summary: {
        passed: true,
        expected_unknown_count: 0,
        provided_unknown_count: 0,
        uncovered_expected_count: 0,
        coverage_percent: 100
      }
    }, { spaces: 2 });

    await fs.writeJson(capabilityMatrixFile, {
      mode: 'auto-handoff-capability-matrix',
      status: 'ready',
      gates: {
        passed: true,
        capability_coverage: { passed: true },
        capability_semantic: { passed: true },
        capability_lexicon: { passed: true }
      },
      capability_coverage: {
        summary: {
          passed: true,
          semantic_passed: true,
          coverage_percent: 100,
          semantic_complete_percent: 100
        }
      }
    }, { spaces: 2 });

    const result = spawnSync(process.execPath, [scriptPath, '--json'], {
      cwd: workspace,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('moqui-release-summary');
    expect(payload.summary).toEqual(expect.objectContaining({
      gate_status: 'passed',
      gate_passed: true,
      matrix_regression_check: true
    }));
    expect(payload.lexicon.passed).toBe(true);
    expect(payload.capability_coverage.passed).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-release-summary.json'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-release-summary.md'))).toBe(true);
  });

  test('returns exit code 2 when gate fails with --fail-on-gate-fail', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'moqui-release-summary.js');
    const workspace = path.join(tempDir, 'workspace');
    const evidenceFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    const baselineFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-template-baseline.json');
    const lexiconFile = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'moqui-lexicon-audit.json');
    const capabilityMatrixFile = path.join(workspace, '.kiro', 'reports', 'handoff-capability-matrix.json');

    await fs.ensureDir(path.dirname(evidenceFile));
    await fs.ensureDir(path.dirname(capabilityMatrixFile));

    await fs.writeJson(evidenceFile, {
      mode: 'auto-handoff-release-evidence',
      latest_session_id: 'handoff-fail',
      sessions: [
        {
          session_id: 'handoff-fail',
          merged_at: '2026-02-18T01:00:00.000Z',
          status: 'failed',
          policy: {
            max_moqui_matrix_regressions: 0
          },
          gate: {
            passed: false,
            actual: {
              spec_success_rate_percent: 75,
              risk_level: 'high'
            }
          },
          release_gate_preflight: {
            blocked: true
          },
          moqui_baseline: {
            status: 'failed',
            summary: {
              portfolio_passed: false,
              avg_score: 62,
              valid_rate_percent: 80,
              baseline_failed: 2
            },
            compare: {
              regressions: [
                { metric: 'business_rule_closed', delta_rate_percent: -10 }
              ]
            }
          },
          moqui_capability_coverage: {
            summary: {
              passed: false,
              semantic_passed: false,
              coverage_percent: 50,
              semantic_complete_percent: 50,
              covered_capabilities: 1,
              uncovered_capabilities: 1
            }
          },
          scene_package_batch: {
            status: 'failed',
            summary: {
              batch_gate_passed: false,
              failed: 1,
              selected: 2
            }
          }
        }
      ]
    }, { spaces: 2 });

    await fs.writeJson(baselineFile, {
      mode: 'moqui-template-baseline',
      summary: {
        portfolio_passed: false,
        avg_score: 62,
        valid_rate_percent: 80,
        baseline_failed: 2
      },
      compare: {
        regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -10 }
        ]
      }
    }, { spaces: 2 });

    await fs.writeJson(lexiconFile, {
      mode: 'moqui-lexicon-audit',
      summary: {
        passed: false,
        expected_unknown_count: 1,
        provided_unknown_count: 0,
        uncovered_expected_count: 1,
        coverage_percent: 50
      }
    }, { spaces: 2 });

    await fs.writeJson(capabilityMatrixFile, {
      mode: 'auto-handoff-capability-matrix',
      status: 'needs-remediation',
      gates: {
        passed: false,
        capability_coverage: { passed: false },
        capability_semantic: { passed: false },
        capability_lexicon: { passed: false }
      },
      capability_coverage: {
        summary: {
          passed: false,
          semantic_passed: false,
          coverage_percent: 50,
          semantic_complete_percent: 50
        }
      }
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--json', '--fail-on-gate-fail'],
      {
        cwd: workspace,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.gate_status).toBe('failed');
    expect(payload.summary.gate_passed).toBe(false);
    expect(payload.recommendations.some(item => item.includes('moqui-lexicon-audit.js'))).toBe(true);
  });
});
