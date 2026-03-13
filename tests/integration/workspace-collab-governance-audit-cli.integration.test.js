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

describe('workspace collab-governance-audit CLI integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-workspace-collab-governance-audit-'));
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

  test('fails with --strict when governance drift is detected', async () => {
    await fs.ensureDir(path.join(tempDir, 'docs'));
    await fs.writeFile(path.join(tempDir, 'docs', 'guide.md'), 'legacy path: .kiro-workspaces\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.gitignore'), '.sce/steering/CURRENT_CONTEXT.md\n', 'utf8');

    const result = await runCliWithRetry(
      ['workspace', 'collab-governance-audit', '--json', '--strict'],
      { cwd: tempDir }
    );

    expect(result.exitCode).toBe(1);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('workspace-collab-governance-audit');
    expect(payload.passed).toBe(false);
    expect(payload.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing ignore rule'),
        'legacy .kiro reference: docs/guide.md:1'
      ])
    );
  });
});
