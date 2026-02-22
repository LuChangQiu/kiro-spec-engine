const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('failure-attribution-repair script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-failure-attribution-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'failure-attribution-repair.js');
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

  test('classifies dependency failure and schedules bounded repair pass', async () => {
    const result = runScript(projectRoot, [
      '--error', 'Cannot find module @acme/order-core',
      '--attempted-passes', '0',
      '--max-repair-passes', '1',
      '--test-failures', '2',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('failure-attribution-repair');
    expect(payload.attribution.category).toBe('dependency');
    expect(payload.repair_pass.decision).toBe('run_repair_pass');
    expect(payload.terminal_summary.status).toBe('repair-scheduled');
  });

  test('stops when repair pass budget is exhausted', async () => {
    const result = runScript(projectRoot, [
      '--error', 'Syntax Error: Unexpected token',
      '--attempted-passes', '1',
      '--max-repair-passes', '1',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.attribution.category).toBe('compilation');
    expect(payload.repair_pass.decision).toBe('stop');
    expect(payload.terminal_summary.status).toBe('stopped');
    expect(payload.terminal_summary.stop_reason).toContain('budget exhausted');
  });

  test('stops immediately for non-repairable policy gate failures', async () => {
    const result = runScript(projectRoot, [
      '--error', 'Policy gate blocked write: approval required',
      '--attempted-passes', '0',
      '--max-repair-passes', '1',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.attribution.category).toBe('policy_gate');
    expect(payload.attribution.repairable).toBe(false);
    expect(payload.repair_pass.decision).toBe('stop');
    expect(payload.terminal_summary.stop_reason).toContain('non-repairable');
  });
});
