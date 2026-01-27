/**
 * Unit Tests for Progress Reporter
 */

const ProgressReporter = require('../../../lib/adoption/progress-reporter');
const { ProgressStage, ProgressStatus, StatusIcons } = require('../../../lib/adoption/progress-reporter');

// Mock console methods
let consoleOutput = [];
const originalConsoleLog = console.log;

beforeEach(() => {
  consoleOutput = [];
  console.log = jest.fn((...args) => {
    consoleOutput.push(args.join(' '));
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('ProgressReporter', () => {
  describe('Constructor', () => {
    test('should create reporter with default options', () => {
      const reporter = new ProgressReporter();
      
      expect(reporter.verbose).toBe(false);
      expect(reporter.quiet).toBe(false);
      expect(reporter.currentStage).toBeNull();
      expect(reporter.fileOperations.processed).toBe(0);
    });

    test('should create reporter with verbose option', () => {
      const reporter = new ProgressReporter({ verbose: true });
      
      expect(reporter.verbose).toBe(true);
      expect(reporter.quiet).toBe(false);
    });

    test('should create reporter with quiet option', () => {
      const reporter = new ProgressReporter({ quiet: true });
      
      expect(reporter.verbose).toBe(false);
      expect(reporter.quiet).toBe(true);
    });
  });

  describe('start()', () => {
    test('should initialize start time', () => {
      const reporter = new ProgressReporter();
      reporter.start();
      
      expect(reporter.totalStartTime).toBeDefined();
      expect(reporter.totalStartTime).toBeGreaterThan(0);
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true });
      reporter.start();
      
      expect(consoleOutput.length).toBe(0);
    });
  });

  describe('reportStage()', () => {
    test('should report stage in progress', () => {
      const reporter = new ProgressReporter();
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.IN_PROGRESS);
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('Analyzing project structure');
      expect(consoleOutput[0]).toContain('🔄');
    });

    test('should report stage completion', () => {
      const reporter = new ProgressReporter();
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.COMPLETE);
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('Analyzing project structure');
      expect(consoleOutput[0]).toContain('✅');
    });

    test('should report stage error', () => {
      const reporter = new ProgressReporter();
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.ERROR);
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('Creating backup');
      expect(consoleOutput[0]).toContain('❌');
    });

    test('should include details when provided', () => {
      const reporter = new ProgressReporter();
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.COMPLETE, 'backup-123');
      
      expect(consoleOutput[0]).toContain('backup-123');
    });

    test('should track stage timing', () => {
      const reporter = new ProgressReporter();
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.IN_PROGRESS);
      
      expect(reporter.currentStage).toBe(ProgressStage.ANALYZING);
      expect(reporter.stageStartTime).toBeDefined();
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true });
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.COMPLETE);
      
      expect(consoleOutput.length).toBe(0);
    });

    test('should show timing in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.IN_PROGRESS);
      
      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Small delay
      }
      
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.COMPLETE);
      
      expect(consoleOutput[1]).toMatch(/\d+ms|\d+\.\d+s/);
    });
  });

  describe('reportFileOperation()', () => {
    test('should report file creation', () => {
      const reporter = new ProgressReporter();
      reporter.reportFileOperation('create', '.kiro/steering/CORE_PRINCIPLES.md');
      
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain('.kiro/steering/CORE_PRINCIPLES.md');
      expect(consoleOutput[0]).toContain('➕');
      expect(reporter.fileOperations.created).toBe(1);
      expect(reporter.fileOperations.processed).toBe(1);
    });

    test('should report file update', () => {
      const reporter = new ProgressReporter();
      reporter.reportFileOperation('update', '.kiro/steering/ENVIRONMENT.md');
      
      expect(consoleOutput[0]).toContain('.kiro/steering/ENVIRONMENT.md');
      expect(consoleOutput[0]).toContain('📝');
      expect(reporter.fileOperations.updated).toBe(1);
    });

    test('should report file deletion', () => {
      const reporter = new ProgressReporter();
      reporter.reportFileOperation('delete', 'old-file.txt');
      
      expect(consoleOutput[0]).toContain('old-file.txt');
      expect(consoleOutput[0]).toContain('🗑️');
      expect(reporter.fileOperations.deleted).toBe(1);
    });

    test('should report file preservation', () => {
      const reporter = new ProgressReporter();
      reporter.reportFileOperation('preserve', '.kiro/specs/');
      
      expect(consoleOutput[0]).toContain('.kiro/specs/');
      expect(consoleOutput[0]).toContain('💾');
      expect(reporter.fileOperations.preserved).toBe(1);
    });

    test('should include details when provided', () => {
      const reporter = new ProgressReporter();
      reporter.reportFileOperation('update', 'file.txt', { details: 'template updated' });
      
      expect(consoleOutput[0]).toContain('template updated');
    });

    test('should show progress counter in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      reporter.setTotalFiles(3);
      
      reporter.reportFileOperation('create', 'file1.txt');
      reporter.reportFileOperation('create', 'file2.txt');
      
      expect(consoleOutput.some(line => line.includes('Progress:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('2/3'))).toBe(true);
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true });
      reporter.reportFileOperation('create', 'file.txt');
      
      expect(consoleOutput.length).toBe(0);
      expect(reporter.fileOperations.created).toBe(1); // Counter still updated
    });
  });

  describe('reportBatchOperation()', () => {
    test('should report batch creation', () => {
      const reporter = new ProgressReporter();
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];
      
      reporter.reportBatchOperation('create', files);
      
      expect(consoleOutput[0]).toContain('3 file(s)');
      expect(consoleOutput[0]).toContain('➕');
      expect(reporter.fileOperations.created).toBe(3);
      expect(reporter.fileOperations.processed).toBe(3);
    });

    test('should report batch update', () => {
      const reporter = new ProgressReporter();
      const files = ['file1.txt', 'file2.txt'];
      
      reporter.reportBatchOperation('update', files, { description: 'templates' });
      
      expect(consoleOutput[0]).toContain('2 file(s)');
      expect(consoleOutput[0]).toContain('templates');
      expect(reporter.fileOperations.updated).toBe(2);
    });

    test('should show individual files in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      const files = ['file1.txt', 'file2.txt'];
      
      reporter.reportBatchOperation('create', files);
      
      expect(consoleOutput.length).toBeGreaterThan(1);
      expect(consoleOutput.some(line => line.includes('file1.txt'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('file2.txt'))).toBe(true);
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true });
      reporter.reportBatchOperation('create', ['file1.txt', 'file2.txt']);
      
      expect(consoleOutput.length).toBe(0);
      expect(reporter.fileOperations.created).toBe(2);
    });
  });

  describe('setTotalFiles()', () => {
    test('should set total file count', () => {
      const reporter = new ProgressReporter();
      reporter.setTotalFiles(10);
      
      expect(reporter.fileOperations.total).toBe(10);
    });
  });

  describe('reportBackup()', () => {
    test('should report backup creation', () => {
      const reporter = new ProgressReporter();
      const backup = {
        id: 'backup-123',
        location: '/path/to/backup',
        filesCount: 5,
        totalSize: 1024000
      };
      
      reporter.reportBackup(backup);
      
      expect(consoleOutput[0]).toContain('Backup created');
      expect(consoleOutput[0]).toContain('backup-123');
      expect(consoleOutput[0]).toContain('📦');
    });

    test('should show details in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      const backup = {
        id: 'backup-123',
        location: '/path/to/backup',
        filesCount: 5,
        totalSize: 1024000
      };
      
      reporter.reportBackup(backup);
      
      expect(consoleOutput.some(line => line.includes('Location:'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Files: 5'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Size:'))).toBe(true);
    });
  });

  describe('reportValidation()', () => {
    test('should report successful validation', () => {
      const reporter = new ProgressReporter();
      const validation = {
        success: true,
        filesVerified: 5
      };
      
      reporter.reportValidation(validation);
      
      expect(consoleOutput[0]).toContain('Validation complete');
      expect(consoleOutput[0]).toContain('5 file(s) verified');
      expect(consoleOutput[0]).toContain('✅');
    });

    test('should report failed validation', () => {
      const reporter = new ProgressReporter();
      const validation = {
        success: false,
        error: 'File count mismatch'
      };
      
      reporter.reportValidation(validation);
      
      expect(consoleOutput[0]).toContain('Validation failed');
      expect(consoleOutput[0]).toContain('File count mismatch');
      expect(consoleOutput[0]).toContain('❌');
    });
  });

  describe('reportWarning()', () => {
    test('should report warning message', () => {
      const reporter = new ProgressReporter();
      reporter.reportWarning('This is a warning');
      
      expect(consoleOutput[0]).toContain('This is a warning');
      expect(consoleOutput[0]).toContain('⚠️');
    });
  });

  describe('reportError()', () => {
    test('should report error message', () => {
      const reporter = new ProgressReporter();
      reporter.reportError('This is an error');
      
      expect(consoleOutput[0]).toContain('This is an error');
      expect(consoleOutput[0]).toContain('❌');
    });
  });

  describe('reportInfo()', () => {
    test('should report info message', () => {
      const reporter = new ProgressReporter();
      reporter.reportInfo('This is information');
      
      expect(consoleOutput[0]).toContain('This is information');
      expect(consoleOutput[0]).toContain('ℹ️');
    });
  });

  describe('reportSuccess()', () => {
    test('should report success message', () => {
      const reporter = new ProgressReporter();
      reporter.reportSuccess('Operation successful');
      
      expect(consoleOutput[0]).toContain('Operation successful');
      expect(consoleOutput[0]).toContain('✅');
    });
  });

  describe('displayPlan()', () => {
    test('should display adoption plan', () => {
      const reporter = new ProgressReporter();
      const plan = {
        mode: 'smart-update',
        requiresBackup: true,
        changes: {
          created: ['file1.txt'],
          updated: ['file2.txt', 'file3.txt'],
          preserved: ['specs/']
        }
      };
      
      reporter.displayPlan(plan);
      
      expect(consoleOutput.some(line => line.includes('Adoption Plan'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Smart Update'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Backup existing files'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Create 1 new file(s)'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Update 2 template file(s)'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Preserve 1 user file(s)'))).toBe(true);
    });

    test('should not show backup line if not required', () => {
      const reporter = new ProgressReporter();
      const plan = {
        mode: 'fresh',
        requiresBackup: false,
        changes: {
          created: ['file1.txt'],
          updated: [],
          preserved: []
        }
      };
      
      reporter.displayPlan(plan);
      
      expect(consoleOutput.some(line => line.includes('Backup existing files'))).toBe(false);
    });
  });

  describe('displaySummary()', () => {
    test('should display complete summary', () => {
      const reporter = new ProgressReporter();
      reporter.fileOperations.created = 2;
      reporter.fileOperations.updated = 3;
      reporter.fileOperations.preserved = 1;
      
      const result = {
        mode: 'smart-update',
        backup: {
          id: 'backup-123'
        },
        changes: {
          updated: ['file1.txt', 'file2.txt', 'file3.txt'],
          created: ['file4.txt', 'file5.txt'],
          preserved: ['specs/']
        },
        warnings: ['Warning message']
      };
      
      reporter.displaySummary(result);
      
      expect(consoleOutput.some(line => line.includes('Adoption completed successfully'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Summary'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Smart Update'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('backup-123'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Updated files'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Preserved files'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Your original files are safely backed up'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Warnings'))).toBe(true);
    });

    test('should show timing in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      reporter.start();
      reporter.fileOperations.created = 1;
      
      const result = {
        mode: 'fresh',
        changes: {
          updated: [],
          created: ['file1.txt'],
          preserved: []
        }
      };
      
      reporter.displaySummary(result);
      
      expect(consoleOutput.some(line => line.includes('Duration:'))).toBe(true);
    });
  });

  describe('displayErrorSummary()', () => {
    test('should display error summary', () => {
      const reporter = new ProgressReporter();
      const result = {
        errors: ['Error 1', 'Error 2'],
        backup: {
          id: 'backup-123'
        }
      };
      
      reporter.displayErrorSummary(result);
      
      expect(consoleOutput.some(line => line.includes('Adoption failed'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Error 1'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Error 2'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('Backup available'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('backup-123'))).toBe(true);
    });
  });

  describe('end()', () => {
    test('should show total time in verbose mode', () => {
      const reporter = new ProgressReporter({ verbose: true });
      reporter.start();
      
      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Small delay
      }
      
      reporter.end();
      
      expect(consoleOutput.some(line => line.includes('Total time:'))).toBe(true);
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true, verbose: true });
      reporter.start();
      reporter.end();
      
      expect(consoleOutput.length).toBe(0);
    });
  });

  describe('Helper Methods', () => {
    test('_formatDuration should format milliseconds', () => {
      const reporter = new ProgressReporter();
      
      expect(reporter._formatDuration(500)).toBe('500ms');
      expect(reporter._formatDuration(1500)).toBe('1.5s');
      expect(reporter._formatDuration(65000)).toBe('1m 5s');
    });

    test('_formatSize should format bytes', () => {
      const reporter = new ProgressReporter();
      
      expect(reporter._formatSize(500)).toBe('500 B');
      expect(reporter._formatSize(1536)).toBe('1.5 KB');
      expect(reporter._formatSize(1572864)).toBe('1.5 MB');
    });

    test('_getModeDisplayName should return display names', () => {
      const reporter = new ProgressReporter();
      
      expect(reporter._getModeDisplayName('fresh')).toBe('Fresh Adoption');
      expect(reporter._getModeDisplayName('smart-adopt')).toBe('Smart Adoption');
      expect(reporter._getModeDisplayName('smart-update')).toBe('Smart Update');
      expect(reporter._getModeDisplayName('skip')).toBe('Already Up-to-Date');
      expect(reporter._getModeDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('newLine()', () => {
    test('should output blank line', () => {
      const reporter = new ProgressReporter();
      reporter.newLine();
      
      expect(consoleOutput.length).toBe(1);
      expect(consoleOutput[0]).toBe('');
    });

    test('should not output in quiet mode', () => {
      const reporter = new ProgressReporter({ quiet: true });
      reporter.newLine();
      
      expect(consoleOutput.length).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete adoption flow', () => {
      const reporter = new ProgressReporter();
      
      reporter.start();
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.IN_PROGRESS);
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.COMPLETE);
      
      reporter.reportStage(ProgressStage.PLANNING, ProgressStatus.IN_PROGRESS);
      reporter.reportStage(ProgressStage.PLANNING, ProgressStatus.COMPLETE);
      
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.IN_PROGRESS);
      reporter.reportBackup({ id: 'backup-123', filesCount: 3, totalSize: 1024 });
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.COMPLETE);
      
      reporter.reportStage(ProgressStage.UPDATING, ProgressStatus.IN_PROGRESS);
      reporter.setTotalFiles(3);
      reporter.reportFileOperation('update', 'file1.txt');
      reporter.reportFileOperation('update', 'file2.txt');
      reporter.reportFileOperation('create', 'file3.txt');
      reporter.reportStage(ProgressStage.UPDATING, ProgressStatus.COMPLETE);
      
      reporter.end();
      
      expect(reporter.fileOperations.processed).toBe(3);
      expect(reporter.fileOperations.updated).toBe(2);
      expect(reporter.fileOperations.created).toBe(1);
      expect(consoleOutput.length).toBeGreaterThan(10);
    });

    test('should handle error scenario', () => {
      const reporter = new ProgressReporter();
      
      reporter.start();
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.IN_PROGRESS);
      reporter.reportStage(ProgressStage.ANALYZING, ProgressStatus.COMPLETE);
      
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.IN_PROGRESS);
      reporter.reportStage(ProgressStage.BACKING_UP, ProgressStatus.ERROR);
      reporter.reportError('Backup failed: insufficient disk space');
      
      const result = {
        errors: ['Backup failed: insufficient disk space']
      };
      reporter.displayErrorSummary(result);
      
      expect(consoleOutput.some(line => line.includes('Adoption failed'))).toBe(true);
      expect(consoleOutput.some(line => line.includes('insufficient disk space'))).toBe(true);
    });
  });
});
