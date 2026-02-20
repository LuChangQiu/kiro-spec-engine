const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('matrix-regression-gate script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-matrix-regression-gate-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'matrix-regression-gate.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  test('passes when regression count is within threshold', async () => {
    const workspace = path.join(tempDir, 'workspace-pass');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'decision_closed', delta_rate_percent: -5 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--max-regressions', '2',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('passed');
    expect(payload.summary.regressions).toBe(1);
  });

  test('fails with exit code 2 in enforce mode', async () => {
    const workspace = path.join(tempDir, 'workspace-fail');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'decision_closed', delta_rate_percent: -5 },
          { metric: 'business_rule_closed', delta_rate_percent: -10 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--max-regressions', '0',
      '--enforce',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('failed');
  });
});
