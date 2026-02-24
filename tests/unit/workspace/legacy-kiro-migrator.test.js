const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {
  findLegacyKiroDirectories,
  migrateLegacyKiroDirectories,
  autoMigrateLegacyKiroDirectories,
} = require('../../../lib/workspace/legacy-kiro-migrator');

describe('legacy-kiro-migrator', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-legacy-migrator-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('findLegacyKiroDirectories finds legacy directories recursively', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro'));
    await fs.ensureDir(path.join(tempDir, 'apps/a/.kiro'));
    await fs.ensureDir(path.join(tempDir, 'apps/a/.sce'));

    const dirs = await findLegacyKiroDirectories(tempDir, { maxDepth: 6 });
    expect(dirs).toHaveLength(2);
    expect(dirs.some((dir) => dir.endsWith(path.join('.kiro')))).toBe(true);
  });

  test('migrateLegacyKiroDirectories renames .kiro to .sce when target missing', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro/specs/demo'));
    await fs.writeFile(path.join(tempDir, '.kiro/specs/demo/requirements.md'), '# req', 'utf8');

    const report = await migrateLegacyKiroDirectories(tempDir);
    expect(report.scanned).toBe(1);
    expect(report.migrated).toBe(1);
    expect(report.renamed).toBe(1);
    expect(await fs.pathExists(path.join(tempDir, '.sce/specs/demo/requirements.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, '.kiro'))).toBe(false);
  });

  test('migrateLegacyKiroDirectories merges into existing .sce and keeps conflicts', async () => {
    await fs.ensureDir(path.join(tempDir, '.sce/specs/demo'));
    await fs.ensureDir(path.join(tempDir, '.kiro/specs/demo'));
    await fs.writeFile(path.join(tempDir, '.sce/specs/demo/file.md'), 'new-content', 'utf8');
    await fs.writeFile(path.join(tempDir, '.kiro/specs/demo/file.md'), 'old-content', 'utf8');
    await fs.writeFile(path.join(tempDir, '.kiro/specs/demo/extra.md'), 'extra', 'utf8');

    const report = await migrateLegacyKiroDirectories(tempDir);
    expect(report.scanned).toBe(1);
    expect(report.merged).toBe(1);
    expect(report.conflict_files).toBe(1);
    expect(report.moved_files).toBe(1);
    expect(await fs.pathExists(path.join(tempDir, '.sce/specs/demo/extra.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, '.kiro'))).toBe(false);

    const entries = await fs.readdir(path.join(tempDir, '.sce/specs/demo'));
    expect(entries.some((entry) => entry.includes('legacy-kiro'))).toBe(true);
  });

  test('dry-run does not change filesystem', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro/specs/demo'));
    await fs.writeFile(path.join(tempDir, '.kiro/specs/demo/a.md'), 'a', 'utf8');

    const report = await migrateLegacyKiroDirectories(tempDir, { dryRun: true });
    expect(report.scanned).toBe(1);
    expect(report.migrated).toBe(1);
    expect(await fs.pathExists(path.join(tempDir, '.kiro/specs/demo/a.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tempDir, '.sce/specs/demo/a.md'))).toBe(false);
  });

  test('autoMigrateLegacyKiroDirectories returns detection summary', async () => {
    await fs.ensureDir(path.join(tempDir, '.kiro'));
    const result = await autoMigrateLegacyKiroDirectories(tempDir);
    expect(result.detected).toBe(1);
    expect(result.migrated).toBe(1);
    expect(await fs.pathExists(path.join(tempDir, '.sce'))).toBe(true);
  });
});

