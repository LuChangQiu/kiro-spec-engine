const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { LockManager } = require('../../../lib/lock/lock-manager');

describe('LockManager', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-lock-manager-'));
    await fs.ensureDir(path.join(tempRoot, '.kiro', 'specs', 'spec-a'));
    await fs.ensureDir(path.join(tempRoot, '.kiro', 'specs', 'spec-b'));
  });

  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  function createMachineIdentifier(id, hostname) {
    return {
      getMachineId: jest.fn().mockResolvedValue({
        id,
        hostname,
        createdAt: new Date().toISOString()
      })
    };
  }

  test('acquireLock succeeds and rejects lock contention from another machine', async () => {
    const managerA = new LockManager(tempRoot, createMachineIdentifier('machine-a', 'host-a'));
    const managerB = new LockManager(tempRoot, createMachineIdentifier('machine-b', 'host-b'));

    const first = await managerA.acquireLock('spec-a', { reason: 'owner-a', timeout: 12 });
    const second = await managerB.acquireLock('spec-a', { reason: 'owner-b', timeout: 12 });

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.error).toBe('Spec is already locked');
  });

  test('releaseLock validates ownership and supports force release', async () => {
    const managerA = new LockManager(tempRoot, createMachineIdentifier('machine-a', 'host-a'));
    const managerB = new LockManager(tempRoot, createMachineIdentifier('machine-b', 'host-b'));

    await managerA.acquireLock('spec-a', { timeout: 24 });

    const denied = await managerB.releaseLock('spec-a');
    expect(denied.success).toBe(false);
    expect(denied.error).toBe('Lock owned by different machine');

    const forced = await managerB.releaseLock('spec-a', { force: true });
    expect(forced.success).toBe(true);
    expect(forced.forced).toBe(true);
  });

  test('cleanupStaleLocks removes expired locks', async () => {
    const manager = new LockManager(tempRoot, createMachineIdentifier('machine-a', 'host-a'));

    const staleTimestamp = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await manager.lockFile.write('spec-b', {
      owner: 'tester',
      machineId: 'machine-old',
      hostname: 'host-old',
      timestamp: staleTimestamp,
      timeout: 1,
      reason: 'stale lock',
      version: '1.0.0'
    });

    const result = await manager.cleanupStaleLocks();

    expect(result.cleaned).toBe(1);
    expect(result.cleanedLocks[0].specName).toBe('spec-b');
    expect(await manager.isLocked('spec-b')).toBe(false);
  });

  test('isLockedByMe returns true only for current machine lock', async () => {
    const managerA = new LockManager(tempRoot, createMachineIdentifier('machine-a', 'host-a'));
    const managerB = new LockManager(tempRoot, createMachineIdentifier('machine-b', 'host-b'));

    await managerA.acquireLock('spec-a');

    expect(await managerA.isLockedByMe('spec-a')).toBe(true);
    expect(await managerB.isLockedByMe('spec-a')).toBe(false);
  });
});
