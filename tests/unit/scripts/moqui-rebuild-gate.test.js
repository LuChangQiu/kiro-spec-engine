const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-rebuild-gate script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-moqui-rebuild-gate-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('passes on fixture metadata and writes gate report', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'moqui-rebuild-gate.js');
    const metadataPath = path.join(
      projectRoot,
      'tests',
      'fixtures',
      'moqui-standard-rebuild',
      'metadata.json'
    );
    const outFile = path.join(tempDir, 'rebuild.json');
    const markdownFile = path.join(tempDir, 'rebuild.md');
    const bundleDir = path.join(tempDir, 'bundle');

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--metadata',
        metadataPath,
        '--out',
        outFile,
        '--markdown-out',
        markdownFile,
        '--bundle-out',
        bundleDir
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('moqui-rebuild-gate');
    expect(payload.passed).toBe(true);
    expect(payload.readiness_summary).toEqual(expect.objectContaining({
      ready: expect.any(Number),
      partial: expect.any(Number),
      gap: expect.any(Number)
    }));
    expect(Array.isArray(payload.checks)).toBe(true);
    expect(payload.checks.length).toBe(3);
    expect(payload.checks.every(item => item.passed === true)).toBe(true);
  });
});

