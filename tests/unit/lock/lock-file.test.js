const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { LockFile } = require('../../../lib/lock/lock-file');

describe('LockFile', () => {
  let tempRoot;
  let specsDir;
  let lockFile;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-lock-file-'));
    specsDir = path.join(tempRoot, '.sce', 'specs');
    lockFile = new LockFile(specsDir);
    await fs.ensureDir(path.join(specsDir, 'spec-a'));
    await fs.ensureDir(path.join(specsDir, 'spec-b'));
  });

  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  function createMetadata(overrides = {}) {
    return {
      owner: 'tester',
      machineId: 'machine-1',
      hostname: 'test-host',
      timestamp: new Date().toISOString(),
      timeout: 24,
      reason: 'unit-test',
      version: '1.0.0',
      ...overrides
    };
  }

  test('write/read round-trip keeps lock metadata', async () => {
    const metadata = createMetadata();

    await lockFile.write('spec-a', metadata);
    const loaded = await lockFile.read('spec-a');

    expect(loaded).toMatchObject(metadata);
  });

  test('read returns null for missing and corrupted lock files', async () => {
    expect(await lockFile.read('spec-a')).toBeNull();

    const lockPath = path.join(specsDir, 'spec-a', '.lock');
    await fs.writeFile(lockPath, '{invalid json', 'utf8');

    expect(await lockFile.read('spec-a')).toBeNull();
  });

  test('write rejects invalid lock metadata', async () => {
    await expect(lockFile.write('spec-a', { owner: 'tester' })).rejects.toThrow('Invalid lock metadata');
  });

  test('exists/delete/listLockedSpecs work as expected', async () => {
    await lockFile.write('spec-a', createMetadata({ machineId: 'machine-a' }));
    await lockFile.write('spec-b', createMetadata({ machineId: 'machine-b' }));

    expect(await lockFile.exists('spec-a')).toBe(true);
    expect(await lockFile.exists('spec-b')).toBe(true);

    const lockedSpecs = await lockFile.listLockedSpecs();
    expect(lockedSpecs.sort()).toEqual(['spec-a', 'spec-b']);

    expect(await lockFile.delete('spec-a')).toBe(true);
    expect(await lockFile.delete('spec-a')).toBe(false);
  });
});
