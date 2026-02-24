const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-core-regression-suite script', () => {
  let tempDir;
  let fixtureWorkspace;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-moqui-core-regression-'));
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    fixtureWorkspace = path.join(
      projectRoot,
      'tests',
      'fixtures',
      'moqui-core-regression',
      'workspace'
    );
  });

  afterEach(async () => {
    if (fixtureWorkspace) {
      await fs.remove(path.join(fixtureWorkspace, '.sce', 'reports', 'moqui-core-regression'));
    }
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('runs deterministic regression stages and emits pass summary', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const outFile = path.join(tempDir, 'moqui-core-regression-suite.json');
    const markdownFile = path.join(tempDir, 'moqui-core-regression-suite.md');
    const scriptPath = path.join(projectRoot, 'scripts', 'moqui-core-regression-suite.js');

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--workspace',
        fixtureWorkspace,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--json',
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('moqui-core-regression-suite');
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.failed_stages)).toBe(true);
    expect(payload.failed_stages).toHaveLength(0);
    expect(Array.isArray(payload.stages)).toBe(true);
    expect(payload.stages).toHaveLength(4);
    expect(payload.stages.every(stage => stage.passed === true)).toBe(true);
    expect(payload.stages.map(stage => stage.name)).toEqual(expect.arrayContaining([
      'moqui-baseline',
      'scene-package-publish-batch-dry-run',
      'moqui-lexicon-audit',
      'auto-handoff-dry-run'
    ]));
    expect(await fs.pathExists(outFile)).toBe(true);
    expect(await fs.pathExists(markdownFile)).toBe(true);
  });
});
