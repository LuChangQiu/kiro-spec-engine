const ExecutionLogger = require('../../lib/watch/execution-logger');
const fs = require('fs-extra');
const path = require('path');

describe('ExecutionLogger', () => {
  let logger;
  let testLogDir;

  beforeEach(async () => {
    testLogDir = path.join(__dirname, '../fixtures/test-logs');
    await fs.ensureDir(testLogDir);
    
    logger = new ExecutionLogger({
      logDir: testLogDir,
      logFile: 'test.log',
      maxLogSize: 1024, // 1KB for testing
      maxLogFiles: 3
    });
  });

  afterEach(async () => {
    if (logger) {
      logger.removeAllListeners();
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await fs.remove(testLogDir);
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });

  describe('constructor', () => {
    test('should create ExecutionLogger with default config', () => {
      logger = new ExecutionLogger();
      
      expect(logger).toBeDefined();
      expect(logger.config.logLevel).toBe('info');
      expect(logger.config.maxLogSize).toBe(10 * 1024 * 1024);
      expect(logger.config.maxLogFiles).toBe(5);
    });

    test('should create ExecutionLogger with custom config', () => {
      expect(logger.config.logDir).toBe(testLogDir);
      expect(logger.config.logFile).toBe('test.log');
      expect(logger.config.maxLogSize).toBe(1024);
      expect(logger.config.maxLogFiles).toBe(3);
    });

    test('should create log directory', () => {
      expect(fs.existsSync(testLogDir)).toBe(true);
    });
  });

  describe('logging', () => {
    test('should log info message', () => {
      logger.info('test_event', { message: 'test' });

      const logPath = path.join(testLogDir, 'test.log');
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('test_event');
      expect(content).toContain('info');
    });

    test('should log debug message', () => {
      logger = new ExecutionLogger({
        logDir: testLogDir,
        logLevel: 'debug'
      });

      logger.debug('debug_event', { data: 'test' });

      const logPath = path.join(testLogDir, 'execution.log');
      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('debug_event');
      expect(content).toContain('debug');
    });

    test('should log warn message', () => {
      logger.warn('warn_event', { warning: 'test' });

      const logPath = path.join(testLogDir, 'test.log');
      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('warn_event');
      expect(content).toContain('warn');
    });

    test('should log error message', () => {
      logger.error('error_event', { error: 'test error' });

      const logPath = path.join(testLogDir, 'test.log');
      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('error_event');
      expect(content).toContain('error');
    });

    test('should respect log level', () => {
      logger = new ExecutionLogger({
        logDir: testLogDir,
        logLevel: 'warn'
      });

      logger.debug('debug_event', {});
      logger.info('info_event', {});
      logger.warn('warn_event', {});

      const logPath = path.join(testLogDir, 'execution.log');
      const content = fs.readFileSync(logPath, 'utf8');
      
      expect(content).not.toContain('debug_event');
      expect(content).not.toContain('info_event');
      expect(content).toContain('warn_event');
    });

    test('should emit log event', () => {
      const logPromise = new Promise(resolve => {
        logger.once('log', resolve);
      });

      logger.info('test_event', { data: 'test' });

      return logPromise.then(logEntry => {
        expect(logEntry.event).toBe('test_event');
        expect(logEntry.level).toBe('info');
      });
    });

    test('should emit level-specific event', () => {
      const logPromise = new Promise(resolve => {
        logger.once('log:error', resolve);
      });

      logger.error('error_event', { error: 'test' });

      return logPromise.then(logEntry => {
        expect(logEntry.event).toBe('error_event');
        expect(logEntry.level).toBe('error');
      });
    });

    test('should set log level', () => {
      logger.setLogLevel('debug');
      expect(logger.config.logLevel).toBe('debug');
    });

    test('should throw error for invalid log level', () => {
      expect(() => {
        logger.setLogLevel('invalid');
      }).toThrow('Invalid log level');
    });

    test('should emit config:updated event', () => {
      const updatePromise = new Promise(resolve => {
        logger.once('config:updated', resolve);
      });

      logger.setLogLevel('debug');

      return updatePromise.then(data => {
        expect(data.logLevel).toBe('debug');
      });
    });
  });

  describe('metrics', () => {
    test('should track execution metrics', () => {
      logger.info('execution:success', {
        command: 'echo test',
        duration: 100
      });

      const metrics = logger.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.successfulExecutions).toBe(1);
      expect(metrics.totalDuration).toBe(100);
    });

    test('should track failed executions', () => {
      logger.error('execution:error', {
        command: 'invalid-command',
        error: 'Command not found'
      });

      const metrics = logger.getMetrics();
      expect(metrics.totalExecutions).toBe(1);
      expect(metrics.failedExecutions).toBe(1);
    });

    test('should calculate average duration', () => {
      logger.info('execution:success', { duration: 100 });
      logger.info('execution:success', { duration: 200 });

      const metrics = logger.getMetrics();
      expect(metrics.averageDuration).toBe(150);
    });

    test('should calculate success rate', () => {
      logger.info('execution:success', {});
      logger.error('execution:error', {});

      const metrics = logger.getMetrics();
      expect(metrics.successRate).toBe('50.00%');
    });

    test('should track executions by action', () => {
      logger.info('execution:success', { command: 'echo test' });
      logger.info('execution:success', { command: 'echo test2' });
      logger.error('execution:error', { command: 'echo test3' });

      const metrics = logger.getMetrics();
      expect(metrics.executionsByAction.echo).toBeDefined();
      expect(metrics.executionsByAction.echo.count).toBe(3);
      expect(metrics.executionsByAction.echo.success).toBe(2);
      expect(metrics.executionsByAction.echo.failed).toBe(1);
    });

    test('should track errors by type', () => {
      logger.error('execution:error', { error: 'ENOENT: file not found' });
      logger.error('execution:error', { error: 'ENOENT: another error' });
      logger.error('execution:error', { error: 'TIMEOUT: command timeout' });

      const metrics = logger.getMetrics();
      expect(metrics.errorsByType.ENOENT).toBe(2);
      expect(metrics.errorsByType.TIMEOUT).toBe(1);
    });

    test('should estimate time saved', () => {
      logger.info('execution:success', {});
      logger.info('execution:success', {});

      const metrics = logger.getMetrics();
      expect(metrics.timeSaved).toBe(60000); // 2 * 30 seconds
    });

    test('should reset metrics', () => {
      logger.info('execution:success', { duration: 100 });

      logger.resetMetrics();

      const metrics = logger.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
    });

    test('should emit metrics:reset event', () => {
      const resetPromise = new Promise(resolve => {
        logger.once('metrics:reset', resolve);
      });

      logger.resetMetrics();

      return resetPromise;
    });
  });

  describe('error tracking', () => {
    test('should record errors', () => {
      logger.error('test_error', { error: 'test error message' });

      const errors = logger.getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].event).toBe('test_error');
    });

    test('should limit error count', () => {
      logger = new ExecutionLogger({
        logDir: testLogDir,
        maxErrors: 3
      });

      for (let i = 0; i < 5; i++) {
        logger.error('test_error', { error: `error ${i}` });
      }

      const errors = logger.getErrors();
      expect(errors.length).toBe(3);
    });

    test('should get limited errors', () => {
      for (let i = 0; i < 5; i++) {
        logger.error('test_error', { error: `error ${i}` });
      }

      const errors = logger.getErrors(2);
      expect(errors.length).toBe(2);
    });

    test('should clear errors', () => {
      logger.error('test_error', { error: 'test' });

      logger.clearErrors();

      const errors = logger.getErrors();
      expect(errors.length).toBe(0);
    });

    test('should emit errors:cleared event', () => {
      const clearedPromise = new Promise(resolve => {
        logger.once('errors:cleared', resolve);
      });

      logger.clearErrors();

      return clearedPromise;
    });
  });

  describe('log rotation', () => {
    test('should rotate logs when size exceeds limit', () => {
      // Write enough data to trigger rotation
      for (let i = 0; i < 50; i++) {
        logger.info('test_event', { 
          data: 'x'.repeat(50),
          index: i 
        });
      }

      const rotatedPath = path.join(testLogDir, 'test.log.1');
      expect(fs.existsSync(rotatedPath)).toBe(true);
    });

    test('should emit rotated event', (done) => {
      logger.once('rotated', (data) => {
        expect(data.rotatedFile).toBeDefined();
        done();
      });

      // Write enough data to trigger rotation
      for (let i = 0; i < 50; i++) {
        logger.info('test_event', { data: 'x'.repeat(50) });
      }
    });

    test('should manually rotate logs', () => {
      logger.info('test_event', { data: 'test' });

      logger.rotate();

      const rotatedPath = path.join(testLogDir, 'test.log.1');
      expect(fs.existsSync(rotatedPath)).toBe(true);
    });

    test('should keep only max log files', () => {
      // Create multiple rotations
      for (let rotation = 0; rotation < 5; rotation++) {
        for (let i = 0; i < 50; i++) {
          logger.info('test_event', { data: 'x'.repeat(50) });
        }
      }

      // Should only have maxLogFiles (3) + current
      const log1 = path.join(testLogDir, 'test.log.1');
      const log2 = path.join(testLogDir, 'test.log.2');
      const log3 = path.join(testLogDir, 'test.log.3');
      const log4 = path.join(testLogDir, 'test.log.4');

      expect(fs.existsSync(log1)).toBe(true);
      expect(fs.existsSync(log2)).toBe(true);
      expect(fs.existsSync(log3)).toBe(true);
      expect(fs.existsSync(log4)).toBe(false);
    });
  });

  describe('metrics export', () => {
    test('should export metrics to JSON', async () => {
      logger.info('execution:success', { duration: 100 });

      const outputPath = await logger.exportMetrics('json');

      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = await fs.readJson(outputPath);
      expect(content.totalExecutions).toBe(1);
    });

    test('should export metrics to CSV', async () => {
      logger.info('execution:success', { duration: 100 });

      const outputPath = await logger.exportMetrics('csv');

      expect(fs.existsSync(outputPath)).toBe(true);
      
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toContain('Total Executions,1');
    });

    test('should emit metrics:exported event', async () => {
      const exportedPromise = new Promise(resolve => {
        logger.once('metrics:exported', resolve);
      });

      await logger.exportMetrics('json');

      const data = await exportedPromise;
      expect(data.format).toBe('json');
      expect(data.outputPath).toBeDefined();
    });

    test('should throw error for unsupported format', async () => {
      await expect(logger.exportMetrics('xml')).rejects.toThrow('Unsupported format');
    });
  });

  describe('log reading', () => {
    test('should read logs', async () => {
      logger.info('event1', { data: 'test1' });
      logger.info('event2', { data: 'test2' });

      const logs = await logger.readLogs();

      expect(logs.length).toBe(2);
      expect(logs[0].event).toBe('event1');
      expect(logs[1].event).toBe('event2');
    });

    test('should limit log lines', async () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`event${i}`, { index: i });
      }

      const logs = await logger.readLogs(5);

      expect(logs.length).toBe(5);
      expect(logs[0].event).toBe('event5');
    });

    test('should return empty array if no logs', async () => {
      const logs = await logger.readLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('configuration', () => {
    test('should get configuration', () => {
      const config = logger.getConfig();

      expect(config.logDir).toBe(testLogDir);
      expect(config.logFile).toBe('test.log');
    });

    test('should not modify original config', () => {
      const config = logger.getConfig();
      config.logLevel = 'debug';

      expect(logger.config.logLevel).toBe('info');
    });
  });
});
