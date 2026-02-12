/**
 * Unit tests for ExecutionLogger
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ExecutionLogger = require('../../../lib/governance/execution-logger');

describe('ExecutionLogger', () => {
  let tempDir;
  let logger;
  
  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-logger-test-'));
    logger = new ExecutionLogger(tempDir);
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });
  
  describe('logExecution', () => {
    test('should create log directory if it does not exist', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      const logDirExists = await fs.pathExists(logger.logDir);
      expect(logDirExists).toBe(true);
    });
    
    test('should create log file if it does not exist', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      const logFileExists = await fs.pathExists(logger.logFile);
      expect(logFileExists).toBe(true);
    });
    
    test('should log execution with timestamp, tool, operation, and results', async () => {
      const results = { compliant: true, violations: [] };
      
      await logger.logExecution('diagnostic', 'scan', results);
      
      const content = await fs.readFile(logger.logFile, 'utf8');
      const entries = JSON.parse(content);
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        tool: 'diagnostic',
        operation: 'scan',
        results: { compliant: true, violations: [] }
      });
      expect(entries[0].timestamp).toBeDefined();
      expect(new Date(entries[0].timestamp)).toBeInstanceOf(Date);
    });
    
    test('should append to existing log file', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: ['test.md'] });
      
      const content = await fs.readFile(logger.logFile, 'utf8');
      const entries = JSON.parse(content);
      
      expect(entries).toHaveLength(2);
      expect(entries[0].tool).toBe('diagnostic');
      expect(entries[1].tool).toBe('cleanup');
    });
    
    test('should handle corrupted log file gracefully', async () => {
      // Create corrupted log file
      await fs.ensureDir(logger.logDir);
      await fs.writeFile(logger.logFile, 'invalid json', 'utf8');
      
      // Should not throw
      await expect(logger.logExecution('diagnostic', 'scan', { compliant: true }))
        .resolves.not.toThrow();
      
      // Should create new log
      const content = await fs.readFile(logger.logFile, 'utf8');
      const entries = JSON.parse(content);
      
      expect(entries).toHaveLength(1);
      expect(entries[0].tool).toBe('diagnostic');
    });
    
    test('should sanitize large arrays in results', async () => {
      const largeArray = Array(150).fill({ path: 'test.md', type: 'violation' });
      const results = { violations: largeArray };
      
      await logger.logExecution('diagnostic', 'scan', results);
      
      const content = await fs.readFile(logger.logFile, 'utf8');
      const entries = JSON.parse(content);
      
      expect(entries[0].results.violations).toHaveLength(100);
      expect(entries[0].results.violationsTruncated).toBe(true);
    });
    
    test('should not throw if logging fails', async () => {
      // Make log directory read-only to cause write failure
      await fs.ensureDir(logger.logDir);
      await fs.chmod(logger.logDir, 0o444);
      
      // Should not throw
      await expect(logger.logExecution('diagnostic', 'scan', { compliant: true }))
        .resolves.not.toThrow();
      
      // Restore permissions for cleanup
      await fs.chmod(logger.logDir, 0o755);
    });
  });
  
  describe('getHistory', () => {
    test('should return empty array if log file does not exist', async () => {
      const history = await logger.getHistory();
      
      expect(history).toEqual([]);
    });
    
    test('should return all entries when no filters applied', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: [] });
      await logger.logExecution('validation', 'validate', { valid: true });
      
      const history = await logger.getHistory();
      
      expect(history).toHaveLength(3);
    });
    
    test('should filter by tool name', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: [] });
      await logger.logExecution('diagnostic', 'scan', { compliant: false });
      
      const history = await logger.getHistory({ tool: 'diagnostic' });
      
      expect(history).toHaveLength(2);
      expect(history[0].tool).toBe('diagnostic');
      expect(history[1].tool).toBe('diagnostic');
    });
    
    test('should filter by date', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      // Get history since yesterday (should include today's entry)
      const history = await logger.getHistory({ since: yesterday });
      
      expect(history).toHaveLength(1);
    });
    
    test('should limit number of entries', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: [] });
      await logger.logExecution('validation', 'validate', { valid: true });
      await logger.logExecution('archive', 'move', { movedFiles: [] });
      
      const history = await logger.getHistory({ limit: 2 });
      
      expect(history).toHaveLength(2);
      // Should return last 2 entries
      expect(history[0].tool).toBe('validation');
      expect(history[1].tool).toBe('archive');
    });
    
    test('should combine filters', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      await logger.logExecution('diagnostic', 'scan', { compliant: false });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: [] });
      
      const history = await logger.getHistory({ 
        tool: 'diagnostic',
        since: yesterday,
        limit: 1
      });
      
      expect(history).toHaveLength(1);
      expect(history[0].tool).toBe('diagnostic');
    });
    
    test('should handle corrupted log file gracefully', async () => {
      // Create corrupted log file
      await fs.ensureDir(logger.logDir);
      await fs.writeFile(logger.logFile, 'invalid json', 'utf8');
      
      const history = await logger.getHistory();
      
      expect(history).toEqual([]);
    });
    
    test('should handle non-array log file gracefully', async () => {
      // Create log file with object instead of array
      await fs.ensureDir(logger.logDir);
      await fs.writeFile(logger.logFile, '{"not": "an array"}', 'utf8');
      
      const history = await logger.getHistory();
      
      expect(history).toEqual([]);
    });
  });
  
  describe('rotateLogIfNeeded', () => {
    test('should not rotate if log file does not exist', async () => {
      await logger.rotateLogIfNeeded();
      
      const logFileExists = await fs.pathExists(logger.logFile);
      expect(logFileExists).toBe(false);
    });
    
    test('should not rotate if log file is below max size', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      await logger.rotateLogIfNeeded();
      
      // Original log should still exist
      const logFileExists = await fs.pathExists(logger.logFile);
      expect(logFileExists).toBe(true);
      
      // No rotated log should exist
      const rotatedLogExists = await fs.pathExists(
        path.join(logger.logDir, 'governance-history.1.json')
      );
      expect(rotatedLogExists).toBe(false);
    });
    
    test('should rotate if log file exceeds max size', async () => {
      // Create a large log file (> 10MB) using repeated string instead of JSON.stringify on huge array
      await fs.ensureDir(logger.logDir);
      const chunk = '{"timestamp":"2026-01-01T00:00:00.000Z","tool":"diagnostic","operation":"scan","results":{"violations":[{"path":"test.md"}]}},\n';
      const repeatCount = Math.ceil((logger.maxLogSize + 1024) / chunk.length);
      await fs.writeFile(logger.logFile, '[' + chunk.repeat(repeatCount).slice(0, -2) + ']', 'utf8');
      
      // Verify file is large enough
      const stats = await fs.stat(logger.logFile);
      expect(stats.size).toBeGreaterThan(logger.maxLogSize);
      
      await logger.rotateLogIfNeeded();
      
      // Rotated log should exist
      const rotatedLogExists = await fs.pathExists(
        path.join(logger.logDir, 'governance-history.1.json')
      );
      expect(rotatedLogExists).toBe(true);
      
      // New log should be empty array
      const content = await fs.readFile(logger.logFile, 'utf8');
      expect(JSON.parse(content)).toEqual([]);
    });
  });
  
  describe('rotateLog', () => {
    test('should move current log to .1', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      await logger.rotateLog();
      
      // Rotated log should exist
      const rotatedLogExists = await fs.pathExists(
        path.join(logger.logDir, 'governance-history.1.json')
      );
      expect(rotatedLogExists).toBe(true);
      
      // New log should be empty array
      const content = await fs.readFile(logger.logFile, 'utf8');
      expect(JSON.parse(content)).toEqual([]);
    });
    
    test('should shift existing rotated logs', async () => {
      // Create multiple rotated logs
      await fs.ensureDir(logger.logDir);
      await fs.writeFile(
        path.join(logger.logDir, 'governance-history.1.json'),
        JSON.stringify([{ tool: 'log1' }]),
        'utf8'
      );
      await fs.writeFile(
        path.join(logger.logDir, 'governance-history.2.json'),
        JSON.stringify([{ tool: 'log2' }]),
        'utf8'
      );
      
      // Create current log
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      await logger.rotateLog();
      
      // Check that logs were shifted
      const log2Content = await fs.readFile(
        path.join(logger.logDir, 'governance-history.2.json'),
        'utf8'
      );
      expect(JSON.parse(log2Content)[0].tool).toBe('log1');
      
      const log3Content = await fs.readFile(
        path.join(logger.logDir, 'governance-history.3.json'),
        'utf8'
      );
      expect(JSON.parse(log3Content)[0].tool).toBe('log2');
    });
    
    test('should remove oldest log when max rotated logs reached', async () => {
      // Create max number of rotated logs
      await fs.ensureDir(logger.logDir);
      for (let i = 1; i <= logger.maxRotatedLogs; i++) {
        await fs.writeFile(
          path.join(logger.logDir, `governance-history.${i}.json`),
          JSON.stringify([{ tool: `log${i}` }]),
          'utf8'
        );
      }
      
      // Create current log
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      await logger.rotateLog();
      
      // Oldest log (now would be .6) should not exist
      const oldestLogExists = await fs.pathExists(
        path.join(logger.logDir, 'governance-history.6.json')
      );
      expect(oldestLogExists).toBe(false);
      
      // Max rotated log (.5) should exist
      const maxLogExists = await fs.pathExists(
        path.join(logger.logDir, `governance-history.${logger.maxRotatedLogs}.json`)
      );
      expect(maxLogExists).toBe(true);
    });
  });
  
  describe('sanitizeResults', () => {
    test('should not modify small arrays', () => {
      const results = {
        violations: Array(50).fill({ path: 'test.md' })
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.violations).toHaveLength(50);
      expect(sanitized.violationsTruncated).toBeUndefined();
    });
    
    test('should truncate violations array if too large', () => {
      const results = {
        violations: Array(150).fill({ path: 'test.md' })
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.violations).toHaveLength(100);
      expect(sanitized.violationsTruncated).toBe(true);
    });
    
    test('should truncate deletedFiles array if too large', () => {
      const results = {
        deletedFiles: Array(150).fill('test.md')
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.deletedFiles).toHaveLength(100);
      expect(sanitized.deletedFilesTruncated).toBe(true);
    });
    
    test('should truncate movedFiles array if too large', () => {
      const results = {
        movedFiles: Array(150).fill({ from: 'test.md', to: 'docs/test.md' })
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.movedFiles).toHaveLength(100);
      expect(sanitized.movedFilesTruncated).toBe(true);
    });
    
    test('should truncate errors array if too large', () => {
      const results = {
        errors: Array(150).fill({ path: 'test.md', error: 'Failed' })
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.errors).toHaveLength(100);
      expect(sanitized.errorsTruncated).toBe(true);
    });
    
    test('should handle multiple large arrays', () => {
      const results = {
        violations: Array(150).fill({ path: 'test.md' }),
        deletedFiles: Array(150).fill('test.md'),
        errors: Array(150).fill({ path: 'test.md', error: 'Failed' })
      };
      
      const sanitized = logger.sanitizeResults(results);
      
      expect(sanitized.violations).toHaveLength(100);
      expect(sanitized.violationsTruncated).toBe(true);
      expect(sanitized.deletedFiles).toHaveLength(100);
      expect(sanitized.deletedFilesTruncated).toBe(true);
      expect(sanitized.errors).toHaveLength(100);
      expect(sanitized.errorsTruncated).toBe(true);
    });
  });
  
  describe('clearLogs', () => {
    test('should remove main log file', async () => {
      await logger.logExecution('diagnostic', 'scan', { compliant: true });
      
      await logger.clearLogs();
      
      const logFileExists = await fs.pathExists(logger.logFile);
      expect(logFileExists).toBe(false);
    });
    
    test('should remove all rotated logs', async () => {
      // Create rotated logs
      await fs.ensureDir(logger.logDir);
      for (let i = 1; i <= logger.maxRotatedLogs; i++) {
        await fs.writeFile(
          path.join(logger.logDir, `governance-history.${i}.json`),
          JSON.stringify([{ tool: `log${i}` }]),
          'utf8'
        );
      }
      
      await logger.clearLogs();
      
      // Check all rotated logs are removed
      for (let i = 1; i <= logger.maxRotatedLogs; i++) {
        const rotatedLogExists = await fs.pathExists(
          path.join(logger.logDir, `governance-history.${i}.json`)
        );
        expect(rotatedLogExists).toBe(false);
      }
    });
    
    test('should not throw if log files do not exist', async () => {
      await expect(logger.clearLogs()).resolves.not.toThrow();
    });
  });
});
