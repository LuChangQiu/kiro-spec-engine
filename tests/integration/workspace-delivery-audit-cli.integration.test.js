const { execSync, spawnSync } = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { runCliWithRetry } = require('./cli-runner');

function resolveGitBinary() {
  if (process.platform !== 'win32') {
    return 'git';
  }
  const whereResult = spawnSync('where', ['git'], {
    encoding: 'utf8',
    windowsHide: true
  });
  const gitPath = `${whereResult.stdout || ''}`
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean);
  return gitPath || 'git';
}

function runGit(repoPath, args) {
  const command = [JSON.stringify(resolveGitBinary()), ...args.map(arg => JSON.stringify(String(arg)))].join(' ');
  return execSync(command, {
    cwd: repoPath,
    encoding: 'utf8',
    windowsHide: true
  });
}

jest.setTimeout(30000);

describe('workspace delivery-audit CLI integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-workspace-delivery-audit-'));
    runGit(tempDir, ['init', '-b', 'main']);
    runGit(tempDir, ['config', 'user.email', 'bot@example.com']);
    runGit(tempDir, ['config', 'user.name', 'bot']);
    await fs.writeFile(path.join(tempDir, 'README.md'), '# demo\n', 'utf8');
    runGit(tempDir, ['add', '.']);
    runGit(tempDir, ['commit', '-m', 'init']);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('fails with --strict when a declared deliverable is not tracked by git', async () => {
    const specDir = path.join(tempDir, '.sce', 'specs', '121-00-spec-delivery-sync-integrity-gate');
    const featureFile = path.join(tempDir, 'src', 'feature.js');

    await fs.ensureDir(specDir);
    await fs.ensureDir(path.dirname(featureFile));
    await fs.writeJson(path.join(specDir, 'deliverables.json'), {
      verification_mode: 'blocking',
      declared_files: ['src/feature.js']
    }, { spaces: 2 });
    await fs.writeFile(featureFile, 'module.exports = true;\n', 'utf8');

    const result = await runCliWithRetry(
      ['workspace', 'delivery-audit', '--json', '--strict'],
      { cwd: tempDir }
    );

    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('spec-delivery-audit');
    expect(payload.passed).toBe(false);
    expect(payload.violations.some(item => item.includes('src/feature.js => not-tracked'))).toBe(true);
  });
});
