const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('release-risk-remediation-bundle script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-release-remediation-bundle-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('builds remediation command bundle from weekly and drift blocking signals', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'release-risk-remediation-bundle.js');
    const workspace = path.join(tempDir, 'workspace');
    const gateReport = path.join(workspace, '.kiro', 'reports', 'release-evidence', 'release-gate-v3.1.0.json');
    await fs.ensureDir(path.dirname(gateReport));

    await fs.writeJson(gateReport, {
      mode: 'release-gate',
      weekly_ops: {
        blocked: true,
        violations: ['weekly ops risk high exceeds max medium'],
        signals: {
          risk: 'high',
          governance_status: 'alert'
        }
      },
      drift: {
        blocked: true,
        alerts: ['consecutive gate failures: 3 (threshold=2)']
      }
    }, { spaces: 2 });

    const result = spawnSync(process.execPath, [
      scriptPath,
      '--gate-report', gateReport,
      '--json'
    ], {
      cwd: workspace,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('release-risk-remediation-bundle');
    expect(payload.summary.blocking_signal_count).toBeGreaterThan(0);
    expect(payload.plan.commands.some(item => item.includes('release-ops-weekly-summary.js'))).toBe(true);
    expect(payload.plan.commands.some(item => item.includes('release-drift-evaluate.js'))).toBe(true);
    expect(payload.plan.commands.some(item => item.includes('interactive-governance-report.js'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'release-risk-remediation-bundle.json'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'release-risk-remediation-bundle.md'))).toBe(true);
    expect(await fs.pathExists(path.join(workspace, '.kiro', 'reports', 'release-evidence', 'release-risk-remediation.commands.lines'))).toBe(true);
  });
});

