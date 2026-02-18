/**
 * Tests for BackupManager
 * 
 * Validates mandatory backup creation and validation functionality.
 */

const BackupManager = require('../../../lib/adoption/backup-manager');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

describe('BackupManager', () => {
  let backupManager;
  let testProjectPath;
  let mockSelectiveBackup;

  beforeEach(async () => {
    // Create temporary test directory
    testProjectPath = path.join(os.tmpdir(), `sce-test-${Date.now()}`);
    await fs.ensureDir(testProjectPath);
    await fs.ensureDir(path.join(testProjectPath, '.kiro'));

    // Create mock SelectiveBackup
    mockSelectiveBackup = {
      createSelectiveBackup: jest.fn()
    };

    // Create BackupManager with mock
    backupManager = new BackupManager({
      selectiveBackup: mockSelectiveBackup
    });
  });

  afterEach(async () => {
    // Clean up test directory - check if exists first for better cross-platform compatibility
    if (await fs.pathExists(testProjectPath)) {
      try {
        await fs.remove(testProjectPath);
      } catch (error) {
        // Ignore cleanup errors in tests
        console.warn(`Warning: Could not clean up test directory: ${error.message}`);
      }
    }
  });

  describe('createMandatoryBackup', () => {
    test('should create backup successfully', async () => {
      // Setup
      const filesToModify = ['steering/CORE_PRINCIPLES.md', 'steering/ENVIRONMENT.md'];
      const mockBackup = {
        id: 'adopt-smart-2026-01-27-143022',
        path: path.join(testProjectPath, '.kiro', 'backups', 'adopt-smart-2026-01-27-143022'),
        fileCount: 2,
        totalSize: 1024,
        created: new Date().toISOString(),
        type: 'adopt-smart',
        files: filesToModify
      };

      // Create backup directory structure
      await fs.ensureDir(path.join(mockBackup.path, 'files'));
      for (const file of filesToModify) {
        const filePath = path.join(mockBackup.path, 'files', file);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, 'test content');
      }

      mockSelectiveBackup.createSelectiveBackup.mockResolvedValue(mockBackup);

      // Execute
      const result = await backupManager.createMandatoryBackup(
        testProjectPath,
        filesToModify
      );

      // Verify
      expect(result).toBeDefined();
      expect(result.id).toBe(mockBackup.id);
      expect(result.location).toBe(mockBackup.path);
      expect(result.filesCount).toBe(2);
      expect(result.validated).toBe(true);
      expect(result.validationDetails).toBeDefined();
      expect(result.validationDetails.filesVerified).toBe(2);

      // Verify SelectiveBackup was called correctly
      expect(mockSelectiveBackup.createSelectiveBackup).toHaveBeenCalledWith(
        testProjectPath,
        filesToModify,
        { type: 'adopt-smart' }
      );
    });

    test('should return null when no files to modify', async () => {
      // Execute
      const result = await backupManager.createMandatoryBackup(
        testProjectPath,
        []
      );

      // Verify
      expect(result).toBeNull();
      expect(mockSelectiveBackup.createSelectiveBackup).not.toHaveBeenCalled();
    });

    test('should throw error when project path is missing', async () => {
      // Execute & Verify
      await expect(
        backupManager.createMandatoryBackup(null, ['file.txt'])
      ).rejects.toThrow('Project path is required');
    });

    test('should throw error when filesToModify is not an array', async () => {
      // Execute & Verify
      await expect(
        backupManager.createMandatoryBackup(testProjectPath, 'not-an-array')
      ).rejects.toThrow('filesToModify must be an array');
    });

    test('should throw error when backup creation fails', async () => {
      // Setup
      mockSelectiveBackup.createSelectiveBackup.mockRejectedValue(
        new Error('Disk full')
      );

      // Execute & Verify
      await expect(
        backupManager.createMandatoryBackup(testProjectPath, ['file.txt'])
      ).rejects.toThrow('Failed to create mandatory backup: Disk full');
    });

    test('should throw error when backup validation fails', async () => {
      // Setup
      const filesToModify = ['steering/CORE_PRINCIPLES.md'];
      const mockBackup = {
        id: 'test-backup',
        path: path.join(testProjectPath, '.kiro', 'backups', 'test-backup'),
        fileCount: 1,
        totalSize: 512,
        created: new Date().toISOString(),
        type: 'adopt-smart',
        files: filesToModify
      };

      // Don't create backup directory - validation will fail
      mockSelectiveBackup.createSelectiveBackup.mockResolvedValue(mockBackup);

      // Execute & Verify
      await expect(
        backupManager.createMandatoryBackup(testProjectPath, filesToModify)
      ).rejects.toThrow('Backup validation failed');
    });

    test('should support custom backup type', async () => {
      // Setup
      const filesToModify = ['file.txt'];
      const mockBackup = {
        id: 'custom-type-123',
        path: path.join(testProjectPath, '.kiro', 'backups', 'custom-type-123'),
        fileCount: 1,
        totalSize: 100,
        created: new Date().toISOString(),
        type: 'custom-type',
        files: filesToModify
      };

      await fs.ensureDir(path.join(mockBackup.path, 'files'));
      await fs.writeFile(path.join(mockBackup.path, 'files', 'file.txt'), 'content');

      mockSelectiveBackup.createSelectiveBackup.mockResolvedValue(mockBackup);

      // Execute
      const result = await backupManager.createMandatoryBackup(
        testProjectPath,
        filesToModify,
        { type: 'custom-type' }
      );

      // Verify
      expect(result.type).toBe('custom-type');
      expect(mockSelectiveBackup.createSelectiveBackup).toHaveBeenCalledWith(
        testProjectPath,
        filesToModify,
        { type: 'custom-type' }
      );
    });
  });

  describe('validateBackup', () => {
    test('should validate backup successfully', async () => {
      // Setup
      const backupId = 'test-backup-123';
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', backupId);
      const files = ['steering/CORE_PRINCIPLES.md', 'steering/ENVIRONMENT.md'];

      // Create backup structure
      await fs.ensureDir(path.join(backupPath, 'files'));
      for (const file of files) {
        const filePath = path.join(backupPath, 'files', file);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, 'backup content');
      }

      const backup = {
        id: backupId,
        location: backupPath,
        filesCount: 2,
        files: files
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(true);
      expect(result.filesVerified).toBe(2);
      expect(result.contentVerified).toBe(false);
      expect(result.message).toContain('2 files verified');
    });

    test('should return success for null backup', async () => {
      // Execute
      const result = await backupManager.validateBackup(null);

      // Verify
      expect(result.success).toBe(true);
      expect(result.filesVerified).toBe(0);
      expect(result.message).toBe('No backup to validate');
    });

    test('should fail when backup location is missing', async () => {
      // Setup
      const backup = {
        id: 'test',
        filesCount: 1,
        files: ['file.txt']
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup location not specified');
    });

    test('should fail when backup directory does not exist', async () => {
      // Setup
      const backup = {
        id: 'nonexistent',
        location: path.join(testProjectPath, '.kiro', 'backups', 'nonexistent'),
        filesCount: 1,
        files: ['file.txt']
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup directory not found');
    });

    test('should fail when files directory does not exist', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      await fs.ensureDir(backupPath);

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: ['file.txt']
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup files directory not found');
    });

    test('should fail when file count mismatch', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      await fs.ensureDir(path.join(backupPath, 'files'));

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 2,
        files: ['file1.txt'] // Only 1 file, but count says 2
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('File count mismatch');
    });

    test('should fail when file is missing from backup', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      await fs.ensureDir(path.join(backupPath, 'files'));

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: ['missing-file.txt']
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('File missing from backup');
    });

    test('should validate content when requested', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      const files = ['steering/CORE_PRINCIPLES.md'];
      const content = 'test content for validation';

      // Create original file
      const originalPath = path.join(testProjectPath, '.kiro', files[0]);
      await fs.ensureDir(path.dirname(originalPath));
      await fs.writeFile(originalPath, content);

      // Create backup file
      const backupFilePath = path.join(backupPath, 'files', files[0]);
      await fs.ensureDir(path.dirname(backupFilePath));
      await fs.writeFile(backupFilePath, content);

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: files
      };

      // Execute
      const result = await backupManager.validateBackup(backup, {
        validateContent: true,
        originalPath: testProjectPath
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.filesVerified).toBe(1);
      expect(result.contentVerified).toBe(true);
    });

    test('should fail content validation on size mismatch', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      const files = ['file.txt'];

      // Create original file
      const originalPath = path.join(testProjectPath, '.kiro', files[0]);
      await fs.ensureDir(path.dirname(originalPath));
      await fs.writeFile(originalPath, 'original content');

      // Create backup file with different size
      const backupFilePath = path.join(backupPath, 'files', files[0]);
      await fs.ensureDir(path.dirname(backupFilePath));
      await fs.writeFile(backupFilePath, 'different');

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: files
      };

      // Execute
      const result = await backupManager.validateBackup(backup, {
        validateContent: true,
        originalPath: testProjectPath
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('File size mismatch');
    });

    test('should fail content validation on hash mismatch for critical files', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      const files = ['steering/CORE_PRINCIPLES.md']; // Critical file

      // Create original file
      const originalPath = path.join(testProjectPath, '.kiro', files[0]);
      await fs.ensureDir(path.dirname(originalPath));
      await fs.writeFile(originalPath, 'original');

      // Create backup file with same size but different content
      const backupFilePath = path.join(backupPath, 'files', files[0]);
      await fs.ensureDir(path.dirname(backupFilePath));
      await fs.writeFile(backupFilePath, 'modified');

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: files
      };

      // Execute
      const result = await backupManager.validateBackup(backup, {
        validateContent: true,
        originalPath: testProjectPath
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toContain('mismatch');
    });
  });

  describe('getBackupInfo', () => {
    test('should retrieve backup information', async () => {
      // Setup
      const backupId = 'test-backup-456';
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', backupId);
      const metadata = {
        id: backupId,
        type: 'adopt-smart',
        created: new Date().toISOString(),
        fileCount: 2,
        totalSize: 2048,
        files: ['file1.txt', 'file2.txt']
      };

      await fs.ensureDir(backupPath);
      await fs.writeJson(path.join(backupPath, 'metadata.json'), metadata);

      // Execute
      const result = await backupManager.getBackupInfo(testProjectPath, backupId);

      // Verify
      expect(result.id).toBe(backupId);
      expect(result.type).toBe('adopt-smart');
      expect(result.filesCount).toBe(2);
      expect(result.totalSize).toBe(2048);
      expect(result.files).toEqual(['file1.txt', 'file2.txt']);
      expect(result.location).toBe(backupPath);
    });

    test('should throw error when backup does not exist', async () => {
      // Execute & Verify
      await expect(
        backupManager.getBackupInfo(testProjectPath, 'nonexistent')
      ).rejects.toThrow('Backup not found: nonexistent');
    });

    test('should throw error when metadata is missing', async () => {
      // Setup
      const backupId = 'no-metadata';
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', backupId);
      await fs.ensureDir(backupPath);

      // Execute & Verify
      await expect(
        backupManager.getBackupInfo(testProjectPath, backupId)
      ).rejects.toThrow('Backup metadata not found');
    });
  });

  describe('edge cases', () => {
    test('should handle empty files array', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'empty');
      await fs.ensureDir(path.join(backupPath, 'files'));

      const backup = {
        id: 'empty',
        location: backupPath,
        filesCount: 0,
        files: []
      };

      // Execute
      const result = await backupManager.validateBackup(backup);

      // Verify
      expect(result.success).toBe(true);
      expect(result.filesVerified).toBe(0);
    });

    test('should handle backup with missing original files during content validation', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      const files = ['deleted-file.txt'];

      // Create backup file but not original
      const backupFilePath = path.join(backupPath, 'files', files[0]);
      await fs.ensureDir(path.dirname(backupFilePath));
      await fs.writeFile(backupFilePath, 'content');

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: files
      };

      // Execute - should succeed (original may have been deleted)
      const result = await backupManager.validateBackup(backup, {
        validateContent: true,
        originalPath: testProjectPath
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.contentVerified).toBe(true);
    });

    test('should handle non-critical files without hash validation', async () => {
      // Setup
      const backupPath = path.join(testProjectPath, '.kiro', 'backups', 'test');
      const files = ['custom/non-critical.txt']; // Non-critical file

      // Create files with same size but different content
      const originalPath = path.join(testProjectPath, '.kiro', files[0]);
      await fs.ensureDir(path.dirname(originalPath));
      await fs.writeFile(originalPath, 'original');

      const backupFilePath = path.join(backupPath, 'files', files[0]);
      await fs.ensureDir(path.dirname(backupFilePath));
      await fs.writeFile(backupFilePath, 'original'); // Same content

      const backup = {
        id: 'test',
        location: backupPath,
        filesCount: 1,
        files: files
      };

      // Execute - should succeed (no hash check for non-critical)
      const result = await backupManager.validateBackup(backup, {
        validateContent: true,
        originalPath: testProjectPath
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.contentVerified).toBe(true);
    });
  });
});
