/**
 * Tests for AdoptionLogger
 */

const fs = require('fs');
const path = require('path');
const AdoptionLogger = require('../../../lib/adoption/adoption-logger');
const { LogLevel, LogLevelNames } = require('../../../lib/adoption/adoption-logger');

describe('AdoptionLogger', () => {
  let tempDir;
  let logger;

  beforeEach(() => {
    // Create temp directory for test logs
    tempDir = path.join(__dirname, '..', '..', 'temp', 'logger-test-' + Date.now());
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    it('should create logger with default options', () => {
      logger = new AdoptionLogger();

      expect(logger.enabled).toBe(true);
      expect(logger.level).toBe(LogLevel.INFO);
      expect(logger.logToFile).toBe(true);
      expect(logger.logToConsole).toBe(false);
      expect(logger.logBuffer).toEqual([]);
    });

    it('should create logger with custom options', () => {
      logger = new AdoptionLogger({
        enabled: false,
        level: 'debug',
        logToFile: false,
        logToConsole: true,
        maxBufferSize: 500
      });

      expect(logger.enabled).toBe(false);
      expect(logger.level).toBe(LogLevel.DEBUG);
      expect(logger.logToFile).toBe(false);
      expect(logger.logToConsole).toBe(true);
      expect(logger.maxBufferSize).toBe(500);
    });

    it('should parse log level from string', () => {
      const logger1 = new AdoptionLogger({ level: 'error' });
      expect(logger1.level).toBe(LogLevel.ERROR);

      const logger2 = new AdoptionLogger({ level: 'warn' });
      expect(logger2.level).toBe(LogLevel.WARN);

      const logger3 = new AdoptionLogger({ level: 'info' });
      expect(logger3.level).toBe(LogLevel.INFO);

      const logger4 = new AdoptionLogger({ level: 'debug' });
      expect(logger4.level).toBe(LogLevel.DEBUG);

      const logger5 = new AdoptionLogger({ level: 'verbose' });
      expect(logger5.level).toBe(LogLevel.VERBOSE);
    });

    it('should parse log level from number', () => {
      logger = new AdoptionLogger({ level: 3 });
      expect(logger.level).toBe(3);
    });

    it('should default to INFO for invalid level', () => {
      logger = new AdoptionLogger({ level: 'invalid' });
      expect(logger.level).toBe(LogLevel.INFO);
    });
  });

  describe('initialize()', () => {
    it('should create log file with header', () => {
      logger = new AdoptionLogger();
      const adoptionId = '20260127-143022';

      logger.initialize(tempDir, adoptionId);

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      expect(fs.existsSync(logFilePath)).toBe(true);

      const content = fs.readFileSync(logFilePath, 'utf8');
      expect(content).toContain('Scene Capability Engine - Adoption Log');
      expect(content).toContain(`Adoption ID: ${adoptionId}`);
      expect(content).toContain('Log Level: INFO');
    });

    it('should create logs directory if it does not exist', () => {
      logger = new AdoptionLogger();
      const adoptionId = '20260127-143022';

      logger.initialize(tempDir, adoptionId);

      const logsDir = path.join(tempDir, '.kiro', 'logs');
      expect(fs.existsSync(logsDir)).toBe(true);
    });

    it('should not create log file if logToFile is false', () => {
      logger = new AdoptionLogger({ logToFile: false });
      const adoptionId = '20260127-143022';

      logger.initialize(tempDir, adoptionId);

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      expect(fs.existsSync(logFilePath)).toBe(false);
    });

    it('should handle initialization errors gracefully', () => {
      logger = new AdoptionLogger();
      const adoptionId = '20260127-143022';

      // Mock fs.mkdirSync to throw an error
      const originalMkdirSync = fs.mkdirSync;
      fs.mkdirSync = () => {
        throw new Error('Permission denied');
      };

      try {
        logger.initialize(tempDir, adoptionId);
      } finally {
        // Restore original function
        fs.mkdirSync = originalMkdirSync;
      }

      // Should disable file logging on error
      expect(logger.logToFile).toBe(false);
      expect(logger.logFilePath).toBe(null);
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      logger = new AdoptionLogger({
        level: 'verbose',
        logToFile: false,
        logToConsole: false
      });
    });

    it('should log error messages', () => {
      logger.error('Test error', { code: 'ERR001' });

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('ERROR');
      expect(logger.logBuffer[0].message).toBe('Test error');
      expect(logger.logBuffer[0].data).toEqual({ code: 'ERR001' });
    });

    it('should log warning messages', () => {
      logger.warn('Test warning');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('WARN');
      expect(logger.logBuffer[0].message).toBe('Test warning');
    });

    it('should log info messages', () => {
      logger.info('Test info');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('INFO');
      expect(logger.logBuffer[0].message).toBe('Test info');
    });

    it('should log debug messages', () => {
      logger.debug('Test debug');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('DEBUG');
      expect(logger.logBuffer[0].message).toBe('Test debug');
    });

    it('should log verbose messages', () => {
      logger.verbose('Test verbose');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('VERBOSE');
      expect(logger.logBuffer[0].message).toBe('Test verbose');
    });

    it('should include timestamp and elapsed time', () => {
      logger.info('Test message');

      const entry = logger.logBuffer[0];
      expect(entry.timestamp).toBeDefined();
      expect(entry.elapsed).toBeGreaterThanOrEqual(0);
    });

    it('should respect log level filtering', () => {
      logger.setLevel('warn');

      logger.error('Error message');
      logger.warn('Warning message');
      logger.info('Info message');
      logger.debug('Debug message');

      expect(logger.logBuffer).toHaveLength(2);
      expect(logger.logBuffer[0].level).toBe('ERROR');
      expect(logger.logBuffer[1].level).toBe('WARN');
    });

    it('should not log when disabled', () => {
      logger.disable();

      logger.error('Error message');
      logger.info('Info message');

      expect(logger.logBuffer).toHaveLength(0);
    });

    it('should log when re-enabled', () => {
      logger.disable();
      logger.info('Should not log');

      logger.enable();
      logger.info('Should log');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Should log');
    });
  });

  describe('Operation Logging', () => {
    beforeEach(() => {
      logger = new AdoptionLogger({
        level: 'verbose',
        logToFile: false,
        logToConsole: false
      });
    });

    it('should log operation start', () => {
      logger.startOperation('backup', { files: 5 });

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Starting operation: backup');
      expect(logger.logBuffer[0].data).toEqual({ files: 5 });
    });

    it('should log operation end', () => {
      logger.endOperation('backup', { success: true });

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Completed operation: backup');
      expect(logger.logBuffer[0].data).toEqual({ success: true });
    });

    it('should log operation error', () => {
      const error = new Error('Operation failed');
      logger.operationError('backup', error);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('ERROR');
      expect(logger.logBuffer[0].message).toBe('Operation failed: backup');
      expect(logger.logBuffer[0].data.message).toBe('Operation failed');
      expect(logger.logBuffer[0].data.stack).toBeDefined();
    });

    it('should log file operations', () => {
      logger.fileOperation('create', 'test.txt', { size: 1024 });

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('DEBUG');
      expect(logger.logBuffer[0].message).toBe('File create: test.txt');
      expect(logger.logBuffer[0].data).toEqual({ size: 1024 });
    });
  });

  describe('Domain-Specific Logging', () => {
    beforeEach(() => {
      logger = new AdoptionLogger({
        level: 'verbose',
        logToFile: false,
        logToConsole: false
      });
    });

    it('should log detection result', () => {
      const state = {
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.7.0',
        targetVersion: '1.8.0',
        conflicts: ['file1.txt', 'file2.txt']
      };

      logger.detectionResult(state);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Project state detected');
      expect(logger.logBuffer[0].data.conflictsCount).toBe(2);
    });

    it('should log strategy selection', () => {
      logger.strategySelected('smart-update', 'Version mismatch detected');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Strategy selected');
      expect(logger.logBuffer[0].data.mode).toBe('smart-update');
      expect(logger.logBuffer[0].data.reason).toBe('Version mismatch detected');
    });

    it('should log conflict resolution', () => {
      logger.conflictResolved('test.txt', 'update', 'Template file');

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Conflict resolved');
      expect(logger.logBuffer[0].data.filePath).toBe('test.txt');
      expect(logger.logBuffer[0].data.resolution).toBe('update');
    });

    it('should log backup creation', () => {
      const backup = {
        id: 'backup-123',
        location: '/path/to/backup',
        filesCount: 5,
        totalSize: 10240
      };

      logger.backupCreated(backup);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Backup created');
      expect(logger.logBuffer[0].data.id).toBe('backup-123');
    });

    it('should log validation result - success', () => {
      const validation = {
        success: true,
        filesVerified: 5
      };

      logger.validationResult(validation);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('INFO');
      expect(logger.logBuffer[0].message).toBe('Validation successful');
    });

    it('should log validation result - failure', () => {
      const validation = {
        success: false,
        error: 'File count mismatch'
      };

      logger.validationResult(validation);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('ERROR');
      expect(logger.logBuffer[0].message).toBe('Validation failed');
    });

    it('should log adoption plan', () => {
      const plan = {
        mode: 'smart-update',
        requiresBackup: true,
        changes: {
          created: ['file1.txt'],
          updated: ['file2.txt', 'file3.txt'],
          deleted: [],
          preserved: ['file4.txt']
        }
      };

      logger.adoptionPlan(plan);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].message).toBe('Adoption plan created');
      expect(logger.logBuffer[0].data.changesCount.updated).toBe(2);
    });

    it('should log adoption result - success', () => {
      const result = {
        success: true,
        mode: 'smart-update',
        backup: { id: 'backup-123' },
        changes: {
          created: [],
          updated: ['file1.txt'],
          deleted: [],
          preserved: ['file2.txt']
        }
      };

      logger.adoptionResult(result);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('INFO');
      expect(logger.logBuffer[0].message).toBe('Adoption completed successfully');
    });

    it('should log adoption result - failure', () => {
      const result = {
        success: false,
        errors: ['Error 1', 'Error 2']
      };

      logger.adoptionResult(result);

      expect(logger.logBuffer).toHaveLength(1);
      expect(logger.logBuffer[0].level).toBe('ERROR');
      expect(logger.logBuffer[0].message).toBe('Adoption failed');
    });
  });

  describe('Buffer Management', () => {
    beforeEach(() => {
      logger = new AdoptionLogger({
        level: 'verbose',
        logToFile: false,
        logToConsole: false,
        maxBufferSize: 5
      });
    });

    it('should maintain buffer within max size', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }

      expect(logger.logBuffer).toHaveLength(5);
      expect(logger.logBuffer[0].message).toBe('Message 5');
      expect(logger.logBuffer[4].message).toBe('Message 9');
    });

    it('should get log buffer', () => {
      logger.info('Test message');
      const buffer = logger.getLogBuffer();

      expect(buffer).toHaveLength(1);
      expect(buffer[0].message).toBe('Test message');
    });

    it('should clear log buffer', () => {
      logger.info('Test message');
      expect(logger.logBuffer).toHaveLength(1);

      logger.clearBuffer();
      expect(logger.logBuffer).toHaveLength(0);
    });
  });

  describe('File Logging', () => {
    it('should write logs to file', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: true,
        logToConsole: false
      });

      const adoptionId = '20260127-143022';
      logger.initialize(tempDir, adoptionId);

      logger.info('Test message 1');
      logger.info('Test message 2');

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      const content = fs.readFileSync(logFilePath, 'utf8');

      expect(content).toContain('Test message 1');
      expect(content).toContain('Test message 2');
    });

    it('should include timestamps in file logs', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: true,
        logToConsole: false
      });

      const adoptionId = '20260127-143022';
      logger.initialize(tempDir, adoptionId);

      logger.info('Test message');

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      const content = fs.readFileSync(logFilePath, 'utf8');

      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include elapsed time in file logs', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: true,
        logToConsole: false
      });

      const adoptionId = '20260127-143022';
      logger.initialize(tempDir, adoptionId);

      logger.info('Test message');

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      const content = fs.readFileSync(logFilePath, 'utf8');

      expect(content).toMatch(/\[\+\d+ms\]/);
    });

    it('should get log file path', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: true,
        logToConsole: false
      });

      const adoptionId = '20260127-143022';
      logger.initialize(tempDir, adoptionId);

      const logFilePath = logger.getLogFilePath();
      expect(logFilePath).toContain(`adopt-${adoptionId}.log`);
    });
  });

  describe('flush()', () => {
    it('should write footer to log file', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: true,
        logToConsole: false
      });

      const adoptionId = '20260127-143022';
      logger.initialize(tempDir, adoptionId);

      logger.info('Test message');
      logger.flush();

      const logFilePath = path.join(tempDir, '.kiro', 'logs', `adopt-${adoptionId}.log`);
      const content = fs.readFileSync(logFilePath, 'utf8');

      expect(content).toContain('End Time:');
      expect(content).toContain('Total Duration:');
      expect(content).toContain('Total Log Entries:');
    });

    it('should not throw error if logToFile is false', () => {
      logger = new AdoptionLogger({
        level: 'info',
        logToFile: false,
        logToConsole: false
      });

      expect(() => {
        logger.flush();
      }).not.toThrow();
    });
  });

  describe('Format Helpers', () => {
    beforeEach(() => {
      logger = new AdoptionLogger({
        level: 'verbose',
        logToFile: false,
        logToConsole: false
      });
    });

    it('should format elapsed time correctly', () => {
      expect(logger._formatElapsed(500)).toBe('500ms');
      expect(logger._formatElapsed(1500)).toBe('1.50s');
      expect(logger._formatElapsed(65000)).toBe('1m5.00s');
    });

    it('should format log entry correctly', () => {
      const entry = {
        timestamp: '2026-01-27T14:30:22.123Z',
        elapsed: 1500,
        level: 'INFO',
        message: 'Test message',
        data: { key: 'value' }
      };

      const formatted = logger._formatLogEntry(entry);

      expect(formatted).toContain('[2026-01-27T14:30:22.123Z]');
      expect(formatted).toContain('[+1.50s]');
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('"key": "value"');
    });
  });
});
