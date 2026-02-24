const fs = require('fs-extra');
const path = require('path');
const BackupSystem = require('../../../lib/environment/backup-system');

describe('BackupSystem', () => {
  let tempDir;
  let backupSystem;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../temp', `backup-system-${Date.now()}`);
    await fs.ensureDir(tempDir);
    backupSystem = new BackupSystem(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('constructor', () => {
    it('should create backup system with project root', () => {
      expect(backupSystem.projectRoot).toBe(tempDir);
      expect(backupSystem.backupDir).toBe(path.join(tempDir, '.sce', 'env-backups'));
    });
  });

  describe('createBackup', () => {
    it('should create backup of existing files', async () => {
      // Create target files
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, 'config.json'), '{}', 'utf8');

      const metadata = await backupSystem.createBackup(
        ['.env', 'config.json'],
        'test-env'
      );

      expect(metadata.environment_name).toBe('test-env');
      expect(metadata.files).toHaveLength(2);
      expect(metadata.timestamp).toBeDefined();

      // Verify backup files exist
      for (const fileInfo of metadata.files) {
        const backupPath = path.join(tempDir, fileInfo.backup_path);
        expect(await fs.pathExists(backupPath)).toBe(true);
      }
    });

    it('should skip non-existent files', async () => {
      // Create only one file
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      const metadata = await backupSystem.createBackup(
        ['.env', 'nonexistent.txt'],
        'test-env'
      );

      expect(metadata.files).toHaveLength(1);
      expect(metadata.files[0].original_path).toBe('.env');
    });

    it('should create backup directory if it does not exist', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      await backupSystem.createBackup(['.env'], 'test-env');

      expect(await fs.pathExists(backupSystem.backupDir)).toBe(true);
    });

    it('should save backup metadata', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      const metadata = await backupSystem.createBackup(['.env'], 'test-env');

      const metadataPath = path.join(tempDir, metadata.backup_directory, 'metadata.json');
      expect(await fs.pathExists(metadataPath)).toBe(true);

      const content = await fs.readFile(metadataPath, 'utf8');
      const loaded = JSON.parse(content);
      expect(loaded.environment_name).toBe('test-env');
    });

    it('should handle nested file paths', async () => {
      await fs.ensureDir(path.join(tempDir, 'config'));
      await fs.writeFile(path.join(tempDir, 'config', 'app.json'), '{}', 'utf8');

      const metadata = await backupSystem.createBackup(
        ['config/app.json'],
        'test-env'
      );

      expect(metadata.files).toHaveLength(1);
      const backupPath = path.join(tempDir, metadata.files[0].backup_path);
      expect(await fs.pathExists(backupPath)).toBe(true);
    });
  });

  describe('listBackups', () => {
    it('should return empty array if no backups exist', async () => {
      const backups = await backupSystem.listBackups();
      expect(backups).toEqual([]);
    });

    it('should list all backups', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      await backupSystem.createBackup(['.env'], 'env1');
      await backupSystem.createBackup(['.env'], 'env2');

      const backups = await backupSystem.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].environment_name).toBe('env2'); // Newest first
      expect(backups[1].environment_name).toBe('env1');
    });

    it('should sort backups by timestamp (newest first)', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      const backup1 = await backupSystem.createBackup(['.env'], 'env1');
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const backup2 = await backupSystem.createBackup(['.env'], 'env2');

      const backups = await backupSystem.listBackups();

      expect(backups[0].timestamp).toBe(backup2.timestamp);
      expect(backups[1].timestamp).toBe(backup1.timestamp);
    });

    it('should skip corrupted metadata files', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      await backupSystem.createBackup(['.env'], 'env1');

      // Create corrupted backup
      const corruptedDir = path.join(backupSystem.backupDir, 'corrupted');
      await fs.ensureDir(corruptedDir);
      await fs.writeFile(
        path.join(corruptedDir, 'metadata.json'),
        '{ invalid json',
        'utf8'
      );

      const backups = await backupSystem.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].environment_name).toBe('env1');
    });
  });

  describe('restoreBackup', () => {
    it('should throw error if no backups exist', async () => {
      await expect(backupSystem.restoreBackup())
        .rejects.toThrow('No backups available to restore');
    });

    it('should restore most recent backup', async () => {
      // Create and backup file
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');
      await backupSystem.createBackup(['.env'], 'env1');

      // Modify file
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=2', 'utf8');

      // Restore
      const result = await backupSystem.restoreBackup();

      expect(result.success).toBe(true);
      expect(result.files_restored).toBe(1);

      // Verify file was restored
      const content = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
      expect(content).toBe('TEST=1');
    });

    it('should restore backup for specific environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');
      await backupSystem.createBackup(['.env'], 'env1');

      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=2', 'utf8');
      await backupSystem.createBackup(['.env'], 'env2');

      // Restore env1 backup
      const result = await backupSystem.restoreBackup('env1');

      expect(result.environment_name).toBe('env1');

      const content = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
      expect(content).toBe('TEST=1');
    });

    it('should throw error if no backup for specified environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');
      await backupSystem.createBackup(['.env'], 'env1');

      await expect(backupSystem.restoreBackup('nonexistent'))
        .rejects.toThrow('No backups found for environment "nonexistent"');
    });

    it('should create target directories if needed', async () => {
      await fs.ensureDir(path.join(tempDir, 'config'));
      await fs.writeFile(path.join(tempDir, 'config', 'app.json'), '{}', 'utf8');
      await backupSystem.createBackup(['config/app.json'], 'env1');

      // Remove directory
      await fs.remove(path.join(tempDir, 'config'));

      // Restore
      await backupSystem.restoreBackup();

      expect(await fs.pathExists(path.join(tempDir, 'config', 'app.json'))).toBe(true);
    });

    it('should return restore result with details', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, 'config.json'), '{}', 'utf8');
      await backupSystem.createBackup(['.env', 'config.json'], 'env1');

      const result = await backupSystem.restoreBackup();

      expect(result).toMatchObject({
        success: true,
        environment_name: 'env1',
        files_restored: 2
      });
      expect(result.restored_files).toContain('.env');
      expect(result.restored_files).toContain('config.json');
    });
  });

  describe('cleanupOldBackups', () => {
    it('should not remove backups if count <= 10', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      for (let i = 0; i < 5; i++) {
        await backupSystem.createBackup(['.env'], `env${i}`);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const result = await backupSystem.cleanupOldBackups();

      expect(result.removed).toBe(0);

      const backups = await backupSystem.listBackups();
      expect(backups).toHaveLength(5);
    });

    it('should keep only last 10 backups per file', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'TEST=1', 'utf8');

      // Create 15 backups
      for (let i = 0; i < 15; i++) {
        await backupSystem.createBackup(['.env'], `env${i}`);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // createBackup already calls cleanupOldBackups, so check the result
      const backups = await backupSystem.listBackups();
      expect(backups.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getBackupDirectory', () => {
    it('should return backup directory path', () => {
      const dir = backupSystem.getBackupDirectory();
      expect(dir).toBe(path.join(tempDir, '.sce', 'env-backups'));
    });
  });
});
