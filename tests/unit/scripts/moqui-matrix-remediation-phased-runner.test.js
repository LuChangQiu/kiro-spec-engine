const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-matrix-remediation-phased-runner script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-matrix-remediation-phased-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'moqui-matrix-remediation-phased-runner.js');
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

  test('plans high and medium phases from goals json in dry-run mode', async () => {
    const workspace = path.join(tempDir, 'workspace-dry-run');
    await fs.ensureDir(path.join(workspace, '.kiro', 'auto'));
    await fs.writeJson(path.join(workspace, '.kiro', 'auto', 'matrix-remediation.goals.high.json'), {
      goals: ['Recover metric A']
    }, { spaces: 2 });
    await fs.writeJson(path.join(workspace, '.kiro', 'auto', 'matrix-remediation.goals.medium.json'), {
      goals: ['Recover metric B']
    }, { spaces: 2 });

    const result = runScript(workspace, ['--dry-run', '--json']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.status).toBe('dry-run');
    expect(payload.summary.runnable_phases).toBe(2);
    expect(payload.summary.planned_phases).toBe(2);
    expect(payload.cooldown.planned).toBe(true);
    expect(payload.cooldown.applied).toBe(false);
    expect(payload.phases[0].phase).toBe('high');
    expect(payload.phases[0].status).toBe('planned');
    expect(payload.phases[0].selected_input.source).toBe('goals-json');
    expect(payload.phases[1].phase).toBe('medium');
    expect(payload.phases[1].status).toBe('planned');
    expect(payload.phases[1].selected_input.source).toBe('goals-json');
    expect(payload.phases[0].command).toContain('auto close-loop-batch');
  });

  test('falls back to lines when goals json is unavailable', async () => {
    const workspace = path.join(tempDir, 'workspace-fallback-lines');
    await fs.ensureDir(path.join(workspace, '.kiro', 'auto'));
    await fs.writeFile(
      path.join(workspace, '.kiro', 'auto', 'matrix-remediation.high.lines'),
      'Recover metric A from lines\n',
      'utf8'
    );

    const result = runScript(workspace, ['--dry-run', '--json']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.status).toBe('dry-run');
    expect(payload.summary.runnable_phases).toBe(1);
    expect(payload.phases[0].phase).toBe('high');
    expect(payload.phases[0].status).toBe('planned');
    expect(payload.phases[0].selected_input.source).toBe('lines-fallback');
    expect(payload.phases[0].selected_input.format).toBe('lines');
    expect(payload.phases[1].phase).toBe('medium');
    expect(payload.phases[1].status).toBe('skipped');
  });

  test('reports no-op when no phase input is available', async () => {
    const workspace = path.join(tempDir, 'workspace-noop');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, ['--dry-run', '--json', '--no-fallback-lines']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.status).toBe('no-op');
    expect(payload.summary.runnable_phases).toBe(0);
    expect(payload.summary.planned_phases).toBe(0);
    expect(payload.phases[0].status).toBe('skipped');
    expect(payload.phases[1].status).toBe('skipped');
  });
});
