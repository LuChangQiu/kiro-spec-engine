const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ComplianceAutoFixer = require('../../../lib/steering/compliance-auto-fixer');

describe('ComplianceAutoFixer', () => {
  let fixer;
  let tempDir;
  let steeringPath;

  beforeEach(async () => {
    fixer = new ComplianceAutoFixer();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-test-'));
    steeringPath = path.join(tempDir, '.sce', 'steering');
    await fs.ensureDir(steeringPath);
  });

  afterEach(async () => {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('fix', () => {
    it('should return success when no violations', async () => {
      const result = await fixer.fix(steeringPath, []);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('No violations to fix');
      expect(result.backupPath).toBeNull();
      expect(result.cleanedFiles).toEqual([]);
      expect(result.cleanedDirs).toEqual([]);
    });

    it('should backup and remove disallowed files', async () => {
      // Create disallowed file
      const disallowedFile = 'test-file.md';
      await fs.writeFile(path.join(steeringPath, disallowedFile), 'test content');

      const violations = [
        { type: 'disallowed_file', name: disallowedFile, path: path.join(steeringPath, disallowedFile) }
      ];

      const result = await fixer.fix(steeringPath, violations);

      expect(result.success).toBe(true);
      expect(result.cleanedFiles).toContain(disallowedFile);
      expect(result.backupPath).toBeTruthy();
      
      // Verify file was removed
      expect(await fs.pathExists(path.join(steeringPath, disallowedFile))).toBe(false);
      
      // Verify backup exists
      expect(await fs.pathExists(path.join(result.backupPath, disallowedFile))).toBe(true);
    });

    it('should backup and remove subdirectories', async () => {
      // Create subdirectory
      const subdir = 'archive';
      const subdirPath = path.join(steeringPath, subdir);
      await fs.ensureDir(subdirPath);
      await fs.writeFile(path.join(subdirPath, 'old-file.md'), 'old content');

      const violations = [
        { type: 'subdirectory', name: subdir, path: subdirPath }
      ];

      const result = await fixer.fix(steeringPath, violations);

      expect(result.success).toBe(true);
      expect(result.cleanedDirs).toContain(subdir);
      expect(result.backupPath).toBeTruthy();
      
      // Verify directory was removed
      expect(await fs.pathExists(subdirPath)).toBe(false);
      
      // Verify backup exists with contents
      expect(await fs.pathExists(path.join(result.backupPath, subdir, 'old-file.md'))).toBe(true);
    });

    it('should handle both files and directories', async () => {
      // Create violations
      const disallowedFile = 'test.md';
      const subdir = 'old';
      
      await fs.writeFile(path.join(steeringPath, disallowedFile), 'test');
      await fs.ensureDir(path.join(steeringPath, subdir));
      await fs.writeFile(path.join(steeringPath, subdir, 'file.md'), 'content');

      const violations = [
        { type: 'disallowed_file', name: disallowedFile, path: path.join(steeringPath, disallowedFile) },
        { type: 'subdirectory', name: subdir, path: path.join(steeringPath, subdir) }
      ];

      const result = await fixer.fix(steeringPath, violations);

      expect(result.success).toBe(true);
      expect(result.cleanedFiles).toContain(disallowedFile);
      expect(result.cleanedDirs).toContain(subdir);
      
      // Verify both removed
      expect(await fs.pathExists(path.join(steeringPath, disallowedFile))).toBe(false);
      expect(await fs.pathExists(path.join(steeringPath, subdir))).toBe(false);
      
      // Verify both backed up
      expect(await fs.pathExists(path.join(result.backupPath, disallowedFile))).toBe(true);
      expect(await fs.pathExists(path.join(result.backupPath, subdir, 'file.md'))).toBe(true);
    });

    it('should create backup manifest', async () => {
      const disallowedFile = 'test.md';
      await fs.writeFile(path.join(steeringPath, disallowedFile), 'test');

      const violations = [
        { type: 'disallowed_file', name: disallowedFile, path: path.join(steeringPath, disallowedFile) }
      ];

      const result = await fixer.fix(steeringPath, violations);

      const manifestPath = path.join(result.backupPath, 'manifest.json');
      expect(await fs.pathExists(manifestPath)).toBe(true);

      const manifest = await fs.readJson(manifestPath);
      expect(manifest.type).toBe('steering-cleanup');
      expect(manifest.files).toContain(disallowedFile);
      expect(manifest.totalItems).toBe(1);
    });
  });

  describe('restore', () => {
    it('should restore files from backup', async () => {
      // Create and fix violation
      const disallowedFile = 'test.md';
      const content = 'test content';
      await fs.writeFile(path.join(steeringPath, disallowedFile), content);

      const violations = [
        { type: 'disallowed_file', name: disallowedFile, path: path.join(steeringPath, disallowedFile) }
      ];

      const fixResult = await fixer.fix(steeringPath, violations);

      // Verify file was removed
      expect(await fs.pathExists(path.join(steeringPath, disallowedFile))).toBe(false);

      // Restore
      const restoreResult = await fixer.restore(fixResult.backupPath, steeringPath);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredFiles).toContain(disallowedFile);
      
      // Verify file was restored
      expect(await fs.pathExists(path.join(steeringPath, disallowedFile))).toBe(true);
      const restoredContent = await fs.readFile(path.join(steeringPath, disallowedFile), 'utf8');
      expect(restoredContent).toBe(content);
    });

    it('should restore directories from backup', async () => {
      // Create and fix violation
      const subdir = 'archive';
      const subdirPath = path.join(steeringPath, subdir);
      await fs.ensureDir(subdirPath);
      await fs.writeFile(path.join(subdirPath, 'file.md'), 'content');

      const violations = [
        { type: 'subdirectory', name: subdir, path: subdirPath }
      ];

      const fixResult = await fixer.fix(steeringPath, violations);

      // Verify directory was removed
      expect(await fs.pathExists(subdirPath)).toBe(false);

      // Restore
      const restoreResult = await fixer.restore(fixResult.backupPath, steeringPath);

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredDirs).toContain(subdir);
      
      // Verify directory was restored with contents
      expect(await fs.pathExists(path.join(subdirPath, 'file.md'))).toBe(true);
    });

    it('should throw error for invalid backup', async () => {
      const invalidBackupPath = path.join(tempDir, 'invalid-backup');
      await fs.ensureDir(invalidBackupPath);

      await expect(fixer.restore(invalidBackupPath, steeringPath))
        .rejects.toThrow('Invalid backup: manifest.json not found');
    });
  });
});
