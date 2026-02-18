const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { Command } = require('commander');

const { registerLockCommands } = require('../../lib/commands/lock');

async function runCommand(argv) {
  const program = new Command();
  registerLockCommands(program);
  await program.parseAsync(argv, { from: 'user' });
}

describe('lock commands integration', () => {
  let tempRoot;
  let originalCwd;
  let originalExitCode;
  let logSpy;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-lock-cmd-'));
    originalCwd = process.cwd();
    originalExitCode = process.exitCode;
    process.chdir(tempRoot);

    await fs.ensureDir(path.join(tempRoot, '.kiro', 'specs', 'spec-lock'));

    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    delete process.exitCode;
  });

  afterEach(async () => {
    logSpy.mockRestore();
    process.chdir(originalCwd);
    process.exitCode = originalExitCode;
    await fs.remove(tempRoot);
  });

  test('acquire and release lock through CLI commands', async () => {
    const lockPath = path.join(tempRoot, '.kiro', 'specs', 'spec-lock', '.lock');

    await runCommand(['lock', 'acquire', 'spec-lock', '--reason', 'integration', '--timeout', '2']);

    expect(await fs.pathExists(lockPath)).toBe(true);
    const lockJson = await fs.readJson(lockPath);
    expect(lockJson.reason).toBe('integration');

    await runCommand(['unlock', 'spec-lock']);

    expect(await fs.pathExists(lockPath)).toBe(false);
    expect(process.exitCode).toBeUndefined();
  });

  test('cleanup command removes stale locks', async () => {
    const lockPath = path.join(tempRoot, '.kiro', 'specs', 'spec-lock', '.lock');
    const staleTimestamp = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

    await fs.writeJson(lockPath, {
      owner: 'tester',
      machineId: 'stale-machine',
      hostname: 'stale-host',
      timestamp: staleTimestamp,
      timeout: 1,
      reason: 'stale',
      version: '1.0.0'
    }, { spaces: 2 });

    await runCommand(['lock', 'cleanup']);

    expect(await fs.pathExists(lockPath)).toBe(false);
    expect(process.exitCode).toBeUndefined();
  });
});
