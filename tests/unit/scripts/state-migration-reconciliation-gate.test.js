const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('state-migration-reconciliation-gate script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-state-gate-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('passes when there are no blocking or pending requirements', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'state-migration-reconciliation-gate.js');

    const result = spawnSync(process.execPath, [scriptPath, '--workspace', tempDir, '--json'], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('state-migration-reconciliation-gate');
    expect(payload.passed).toBe(true);
    expect(payload.fail_on_blocking).toBe(false);
  });

  test('fails on pending migration when --fail-on-pending is set', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'state-migration-reconciliation-gate.js');

    await fs.ensureDir(path.join(tempDir, '.sce', 'config'));
    await fs.writeJson(path.join(tempDir, '.sce', 'config', 'agent-registry.json'), {
      version: '1.0.0',
      agents: {
        'machine-a:0': {
          agentId: 'machine-a:0',
          machineId: 'machine-a',
          instanceIndex: 0,
          hostname: 'host-a',
          registeredAt: '2026-03-05T00:00:00.000Z',
          lastHeartbeat: '2026-03-05T00:05:00.000Z',
          status: 'active'
        }
      }
    }, { spaces: 2 });

    const result = spawnSync(process.execPath, [
      scriptPath,
      '--workspace',
      tempDir,
      '--fail-on-pending',
      '--json'
    ], {
      cwd: projectRoot,
      encoding: 'utf8'
    });

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('state-migration-reconciliation-gate');
    expect(payload.passed).toBe(false);
    expect(payload.fail_on_blocking).toBe(false);
    expect(payload.pending_components).toEqual(expect.arrayContaining(['collab.agent-registry']));
  });
});
