/**
 * Unit tests for Summary Generator
 */

const SummaryGenerator = require('../../../lib/adoption/summary-generator');

describe('SummaryGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new SummaryGenerator();
  });

  describe('constructor', () => {
    it('should initialize with empty summary data', () => {
      expect(generator.summaryData).toBeDefined();
      expect(generator.summaryData.mode).toBeNull();
      expect(generator.summaryData.backup).toBeNull();
      expect(generator.summaryData.changes.created).toEqual([]);
      expect(generator.summaryData.changes.updated).toEqual([]);
      expect(generator.summaryData.changes.deleted).toEqual([]);
      expect(generator.summaryData.changes.preserved).toEqual([]);
      expect(generator.summaryData.warnings).toEqual([]);
      expect(generator.summaryData.errors).toEqual([]);
    });
  });

  describe('start', () => {
    it('should record start time', () => {
      const beforeStart = Date.now();
      generator.start();
      const afterStart = Date.now();

      expect(generator.summaryData.metadata.startTime).toBeGreaterThanOrEqual(beforeStart);
      expect(generator.summaryData.metadata.startTime).toBeLessThanOrEqual(afterStart);
    });
  });

  describe('setMode', () => {
    it('should set adoption mode', () => {
      generator.setMode('smart-update');
      expect(generator.summaryData.mode).toBe('smart-update');
    });

    it('should handle all valid modes', () => {
      const modes = ['fresh', 'smart-adopt', 'smart-update', 'skip', 'warning'];
      
      modes.forEach(mode => {
        generator.setMode(mode);
        expect(generator.summaryData.mode).toBe(mode);
      });
    });
  });

  describe('setBackup', () => {
    it('should set backup information', () => {
      const backup = {
        id: 'backup-20260127-143022',
        location: '.kiro/backups/adopt-20260127-143022',
        filesCount: 5,
        totalSize: 12345
      };

      generator.setBackup(backup);

      expect(generator.summaryData.backup).toEqual(backup);
    });

    it('should handle backup with filesBackedUp array', () => {
      const backup = {
        id: 'backup-123',
        location: '.kiro/backups/backup-123',
        filesBackedUp: ['file1.js', 'file2.js', 'file3.js'],
        totalSize: 5000
      };

      generator.setBackup(backup);

      expect(generator.summaryData.backup.filesCount).toBe(3);
    });

    it('should default to 0 for missing counts', () => {
      const backup = {
        id: 'backup-123',
        location: '.kiro/backups/backup-123'
      };

      generator.setBackup(backup);

      expect(generator.summaryData.backup.filesCount).toBe(0);
      expect(generator.summaryData.backup.totalSize).toBe(0);
    });
  });

  describe('addFileChange', () => {
    it('should add created file', () => {
      generator.addFileChange('create', '.kiro/README.md');
      expect(generator.summaryData.changes.created).toContain('.kiro/README.md');
    });

    it('should add updated file', () => {
      generator.addFileChange('update', '.kiro/steering/CORE_PRINCIPLES.md');
      expect(generator.summaryData.changes.updated).toContain('.kiro/steering/CORE_PRINCIPLES.md');
    });

    it('should add deleted file', () => {
      generator.addFileChange('delete', 'old-file.txt');
      expect(generator.summaryData.changes.deleted).toContain('old-file.txt');
    });

    it('should add preserved file', () => {
      generator.addFileChange('preserve', '.kiro/specs/my-spec/requirements.md');
      expect(generator.summaryData.changes.preserved).toContain('.kiro/specs/my-spec/requirements.md');
    });

    it('should normalize Windows paths to forward slashes', () => {
      generator.addFileChange('create', '.kiro\\steering\\ENVIRONMENT.md');
      expect(generator.summaryData.changes.created).toContain('.kiro/steering/ENVIRONMENT.md');
    });

    it('should not add duplicate files', () => {
      generator.addFileChange('update', 'file.js');
      generator.addFileChange('update', 'file.js');
      expect(generator.summaryData.changes.updated).toEqual(['file.js']);
    });
  });

  describe('addFileChanges', () => {
    it('should add multiple files at once', () => {
      const files = ['file1.js', 'file2.js', 'file3.js'];
      generator.addFileChanges('create', files);

      expect(generator.summaryData.changes.created).toEqual(files);
    });

    it('should handle empty array', () => {
      generator.addFileChanges('update', []);
      expect(generator.summaryData.changes.updated).toEqual([]);
    });
  });

  describe('addWarning', () => {
    it('should add warning message', () => {
      generator.addWarning('Version mismatch detected');
      expect(generator.summaryData.warnings).toContain('Version mismatch detected');
    });

    it('should not add duplicate warnings', () => {
      generator.addWarning('Same warning');
      generator.addWarning('Same warning');
      expect(generator.summaryData.warnings).toEqual(['Same warning']);
    });
  });

  describe('addError', () => {
    it('should add error message', () => {
      generator.addError('Backup failed');
      expect(generator.summaryData.errors).toContain('Backup failed');
    });

    it('should not add duplicate errors', () => {
      generator.addError('Same error');
      generator.addError('Same error');
      expect(generator.summaryData.errors).toEqual(['Same error']);
    });
  });

  describe('complete', () => {
    it('should record end time', () => {
      generator.start();
      const beforeComplete = Date.now();
      generator.complete();
      const afterComplete = Date.now();

      expect(generator.summaryData.metadata.endTime).toBeGreaterThanOrEqual(beforeComplete);
      expect(generator.summaryData.metadata.endTime).toBeLessThanOrEqual(afterComplete);
    });

    it('should calculate duration', () => {
      generator.start();
      // Simulate some work
      const startTime = generator.summaryData.metadata.startTime;
      generator.summaryData.metadata.startTime = startTime - 1000; // 1 second ago
      generator.complete();

      expect(generator.summaryData.metadata.duration).toBeGreaterThan(0);
    });
  });

  describe('generateSummary', () => {
    beforeEach(() => {
      generator.start();
      generator.setMode('smart-update');
      generator.setBackup({
        id: 'backup-123',
        location: '.kiro/backups/backup-123',
        filesCount: 3,
        totalSize: 5000
      });
      generator.addFileChange('update', 'file1.js');
      generator.addFileChange('update', 'file2.js');
      generator.addFileChange('preserve', 'file3.js');
      generator.addWarning('Test warning');
      generator.complete();
    });

    it('should generate complete summary object', () => {
      const summary = generator.generateSummary();

      expect(summary.mode).toBe('smart-update');
      expect(summary.backup).toBeDefined();
      expect(summary.changes).toBeDefined();
      expect(summary.statistics).toBeDefined();
      expect(summary.rollback).toBeDefined();
      expect(summary.nextSteps).toBeDefined();
      expect(summary.warnings).toBeDefined();
      expect(summary.errors).toBeDefined();
      expect(summary.metadata).toBeDefined();
    });

    it('should include all file changes', () => {
      const summary = generator.generateSummary();

      expect(summary.changes.updated).toEqual(['file1.js', 'file2.js']);
      expect(summary.changes.preserved).toEqual(['file3.js']);
      expect(summary.changes.total).toBe(2); // Only created, updated, deleted count
    });

    it('should include statistics', () => {
      const summary = generator.generateSummary();

      expect(summary.statistics.totalFiles).toBe(2);
      expect(summary.statistics.filesUpdated).toBe(2);
      expect(summary.statistics.filesPreserved).toBe(1);
      expect(summary.statistics.hasBackup).toBe(true);
      expect(summary.statistics.hasWarnings).toBe(true);
      expect(summary.statistics.hasErrors).toBe(false);
    });

    it('should include rollback information', () => {
      const summary = generator.generateSummary();

      expect(summary.rollback.available).toBe(true);
      expect(summary.rollback.command).toBe('sce rollback backup-123');
      expect(summary.rollback.backupId).toBe('backup-123');
    });

    it('should include next steps', () => {
      const summary = generator.generateSummary();

      expect(summary.nextSteps).toBeInstanceOf(Array);
      expect(summary.nextSteps.length).toBeGreaterThan(0);
    });

    it('should mark as success when no errors', () => {
      const summary = generator.generateSummary();
      expect(summary.metadata.success).toBe(true);
    });

    it('should mark as failure when errors exist', () => {
      generator.addError('Test error');
      const summary = generator.generateSummary();
      expect(summary.metadata.success).toBe(false);
    });
  });

  describe('generateTextSummary', () => {
    beforeEach(() => {
      generator.start();
      generator.setMode('smart-update');
      generator.setBackup({
        id: 'backup-123',
        location: '.kiro/backups/backup-123',
        filesCount: 2,
        totalSize: 5000
      });
      generator.addFileChange('update', 'file1.js');
      generator.addFileChange('preserve', 'file2.js');
      generator.complete();
    });

    it('should generate text summary', () => {
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('✅ Adoption completed successfully!');
      expect(text).toContain('📊 Summary:');
      expect(text).toContain('Mode: Smart Update');
      expect(text).toContain('Backup: backup-123');
    });

    it('should include updated files', () => {
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('Updated files:');
      expect(text).toContain('file1.js');
    });

    it('should include preserved files', () => {
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('Preserved files:');
      expect(text).toContain('file2.js');
    });

    it('should include rollback command', () => {
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('Your original files are safely backed up');
      expect(text).toContain('sce rollback backup-123');
    });

    it('should include next steps', () => {
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('📋 Next steps:');
      expect(text).toMatch(/\d+\./); // Should have numbered steps
    });

    it('should show duration in verbose mode', () => {
      // Wait a bit to ensure duration is measurable
      generator.summaryData.metadata.startTime = Date.now() - 100;
      generator.complete();
      const text = generator.generateTextSummary({ verbose: true, color: false });

      // Duration is shown in the summary section
      expect(text).toContain('Duration:');
    });

    it('should show created files in verbose mode', () => {
      generator.addFileChange('create', 'new-file.js');
      const text = generator.generateTextSummary({ verbose: true, color: false });

      expect(text).toContain('Created files:');
      expect(text).toContain('new-file.js');
    });

    it('should show warnings if present', () => {
      generator.addWarning('Test warning');
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('⚠️  Warnings:');
      expect(text).toContain('Test warning');
    });

    it('should show errors if present', () => {
      generator.addError('Test error');
      const text = generator.generateTextSummary({ color: false });

      expect(text).toContain('❌ Adoption failed');
      expect(text).toContain('❌ Errors:');
      expect(text).toContain('Test error');
    });
  });

  describe('reset', () => {
    it('should reset all summary data', () => {
      generator.setMode('smart-update');
      generator.addFileChange('update', 'file.js');
      generator.addWarning('Warning');
      generator.addError('Error');

      generator.reset();

      expect(generator.summaryData.mode).toBeNull();
      expect(generator.summaryData.backup).toBeNull();
      expect(generator.summaryData.changes.created).toEqual([]);
      expect(generator.summaryData.changes.updated).toEqual([]);
      expect(generator.summaryData.changes.deleted).toEqual([]);
      expect(generator.summaryData.changes.preserved).toEqual([]);
      expect(generator.summaryData.warnings).toEqual([]);
      expect(generator.summaryData.errors).toEqual([]);
    });
  });

  describe('next steps generation', () => {
    it('should suggest appropriate steps for fresh adoption', () => {
      generator.setMode('fresh');
      const summary = generator.generateSummary();

      expect(summary.nextSteps).toContain('Review the created .kiro/ structure');
      expect(summary.nextSteps).toContain('Customize CURRENT_CONTEXT.md for your project');
    });

    it('should suggest appropriate steps for smart update', () => {
      generator.setMode('smart-update');
      const summary = generator.generateSummary();

      expect(summary.nextSteps).toContain('Review updated template files');
      expect(summary.nextSteps).toContain('Check if CURRENT_CONTEXT.md needs updates');
    });

    it('should suggest appropriate steps for smart adopt', () => {
      generator.setMode('smart-adopt');
      const summary = generator.generateSummary();

      expect(summary.nextSteps).toContain('Review the adoption changes');
      expect(summary.nextSteps).toContain('Verify your specs are intact');
    });

    it('should suggest error recovery steps when errors exist', () => {
      generator.setMode('smart-update');
      generator.addError('Test error');
      const summary = generator.generateSummary();

      expect(summary.nextSteps).toContain('Review error messages above');
      expect(summary.nextSteps).toContain('Check log files for detailed error information');
    });

    it('should suggest rollback when errors and backup exist', () => {
      generator.setMode('smart-update');
      generator.setBackup({ id: 'backup-123', location: '.kiro/backups/backup-123' });
      generator.addError('Test error');
      const summary = generator.generateSummary();

      expect(summary.nextSteps.some(step => step.includes('rollback'))).toBe(true);
    });

    it('should suggest reviewing warnings when present', () => {
      generator.setMode('smart-update');
      generator.addWarning('Test warning');
      const summary = generator.generateSummary();

      expect(summary.nextSteps.some(step => step.includes('warnings'))).toBe(true);
    });
  });

  describe('rollback information', () => {
    it('should indicate rollback not available without backup', () => {
      const summary = generator.generateSummary();

      expect(summary.rollback.available).toBe(false);
      expect(summary.rollback.command).toBeNull();
    });

    it('should provide rollback command with backup', () => {
      generator.setBackup({
        id: 'backup-456',
        location: '.kiro/backups/backup-456',
        filesCount: 5,
        totalSize: 10000
      });
      const summary = generator.generateSummary();

      expect(summary.rollback.available).toBe(true);
      expect(summary.rollback.command).toBe('sce rollback backup-456');
      expect(summary.rollback.backupId).toBe('backup-456');
      expect(summary.rollback.backupLocation).toBe('.kiro/backups/backup-456');
    });
  });

  describe('statistics generation', () => {
    it('should calculate correct statistics', () => {
      generator.addFileChanges('create', ['file1.js', 'file2.js']);
      generator.addFileChanges('update', ['file3.js']);
      generator.addFileChanges('delete', ['file4.js']);
      generator.addFileChanges('preserve', ['file5.js', 'file6.js']);
      generator.setBackup({ id: 'backup-123', location: '.kiro/backups/backup-123' });
      generator.addWarning('Warning');

      const summary = generator.generateSummary();

      expect(summary.statistics.totalFiles).toBe(4); // create + update + delete
      expect(summary.statistics.filesCreated).toBe(2);
      expect(summary.statistics.filesUpdated).toBe(1);
      expect(summary.statistics.filesDeleted).toBe(1);
      expect(summary.statistics.filesPreserved).toBe(2);
      expect(summary.statistics.hasBackup).toBe(true);
      expect(summary.statistics.hasWarnings).toBe(true);
      expect(summary.statistics.hasErrors).toBe(false);
    });
  });

  describe('mode display names', () => {
    it('should return correct display names for all modes', () => {
      const modes = {
        'fresh': 'Fresh Adoption',
        'smart-adopt': 'Smart Adoption',
        'smart-update': 'Smart Update',
        'skip': 'Already Up-to-Date',
        'warning': 'Version Warning'
      };

      Object.entries(modes).forEach(([mode, displayName]) => {
        generator.setMode(mode);
        const summary = generator.generateSummary();
        const text = generator.generateTextSummary({ color: false });
        expect(text).toContain(`Mode: ${displayName}`);
      });
    });
  });

  describe('duration formatting', () => {
    it('should format milliseconds', () => {
      const formatted = generator._formatDuration(500);
      expect(formatted).toBe('500ms');
    });

    it('should format seconds', () => {
      const formatted = generator._formatDuration(5500);
      expect(formatted).toBe('5.5s');
    });

    it('should format minutes and seconds', () => {
      const formatted = generator._formatDuration(125000);
      expect(formatted).toBe('2m 5s');
    });
  });
});
