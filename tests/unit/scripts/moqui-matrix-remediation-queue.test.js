const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-matrix-remediation-queue script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-matrix-remediation-queue-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'moqui-matrix-remediation-queue.js');
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

  test('exports queue lines from matrix regressions', async () => {
    const workspace = path.join(tempDir, 'workspace-export');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    const linesOut = path.join(workspace, 'queue.lines');
    const out = path.join(workspace, 'plan.json');
    const markdownOut = path.join(workspace, 'plan.md');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -12.5 },
          { metric: 'decision_closed', delta_rate_percent: -8.3 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--out', out,
      '--lines-out', linesOut,
      '--markdown-out', markdownOut,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.selected_regressions).toBe(2);

    const lines = (await fs.readFile(linesOut, 'utf8'))
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('business_rule_closed');
    expect(await fs.pathExists(markdownOut)).toBe(true);
  });

  test('applies min delta filter', async () => {
    const workspace = path.join(tempDir, 'workspace-filter');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -12.5 },
          { metric: 'decision_closed', delta_rate_percent: -4.2 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--min-delta-abs', '10',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.selected_regressions).toBe(1);
    expect(payload.items[0].metric).toBe('business_rule_closed');
  });
});
