const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function runCli(args, options = {}) {
  const binPath = path.join(__dirname, '..', '..', 'bin', 'scene-capability-engine.js');
  const cwd = options.cwd || process.cwd();
  const timeoutMs = options.timeoutMs || 15000;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(
      'node',
      [binPath, '--no-version-check', '--skip-steering-check', ...args],
      {
        cwd,
        env: process.env,
        shell: false
      }
    );

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`CLI command timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({
        exitCode: typeof code === 'number' ? code : 1,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

describe('legacy migration guard CLI integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-legacy-guard-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('blocks non-migration commands when legacy .kiro directories exist', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro/steering'));
    await fs.writeFile(path.join(tempDir, '.kiro/steering/ENVIRONMENT.md'), '# legacy', 'utf8');

    const result = await runCli(['status'], { cwd: tempDir });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Legacy workspace migration required');
    expect(await fs.pathExists(path.join(tempDir, '.kiro'))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, '.sce'))).toBe(false);
  });

  test('allows legacy workspace scan and manual migration commands', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro/steering'));
    await fs.writeFile(path.join(tempDir, '.kiro/steering/ENVIRONMENT.md'), '# legacy', 'utf8');

    const scanResult = await runCli(['workspace', 'legacy-scan', '--json'], { cwd: tempDir });
    expect(scanResult.exitCode).toBe(0);
    const scanPayload = JSON.parse(`${scanResult.stdout}`.trim());
    expect(scanPayload.count).toBe(1);

    const migrateResult = await runCli(['workspace', 'legacy-migrate', '--json'], { cwd: tempDir });
    expect(migrateResult.exitCode).toBe(0);
    const migratePayload = JSON.parse(`${migrateResult.stdout}`.trim());
    expect(migratePayload.scanned).toBe(1);
    expect(migratePayload.migrated).toBe(1);
    expect(await fs.pathExists(path.join(tempDir, '.kiro'))).toBe(false);
    expect(await fs.pathExists(path.join(tempDir, '.sce/steering/ENVIRONMENT.md'))).toBe(true);
  });
});

