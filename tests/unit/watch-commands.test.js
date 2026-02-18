/**
 * Tests for Watch CLI Commands
 */

const fs = require('fs-extra');
const path = require('path');
const watchCommands = require('../../lib/commands/watch');

// Mock console methods
const originalLog = console.log;
const originalError = console.error;
let consoleOutput = [];

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args) => consoleOutput.push(args.join(' '));
  console.error = (...args) => consoleOutput.push(args.join(' '));
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('Watch Commands', () => {
  const testDir = path.join(__dirname, '../fixtures/watch-commands-test');
  const configPath = path.join(testDir, '.kiro/watch-config.json');
  const originalCwd = process.cwd();
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    // Give time for file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });
  
  describe('initWatch', () => {
    it('should create default configuration', async () => {
      await watchCommands.initWatch();
      
      expect(await fs.pathExists(configPath)).toBe(true);
      
      const config = await fs.readJson(configPath);
      expect(config.enabled).toBe(true);
      expect(config.patterns).toContain('**/tasks.md');
      expect(config.actions['**/tasks.md']).toBeDefined();
      expect(config.actions['**/tasks.md'].command).toBe('sce workspace sync');
    });
    
    it('should not overwrite existing config without force', async () => {
      const existingConfig = { custom: 'config' };
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, existingConfig);
      
      await watchCommands.initWatch();
      
      const config = await fs.readJson(configPath);
      expect(config.custom).toBe('config');
    });
    
    it('should overwrite existing config with force', async () => {
      const existingConfig = { custom: 'config' };
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, existingConfig);
      
      await watchCommands.initWatch({ force: true });
      
      const config = await fs.readJson(configPath);
      expect(config.custom).toBeUndefined();
      expect(config.enabled).toBe(true);
    });
  });
  
  describe('statusWatch', () => {
    it('should show stopped status when not running', async () => {
      await watchCommands.initWatch();
      await watchCommands.statusWatch();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Stopped');
    });
  });
  
  describe('metricsWatch', () => {
    it('should display metrics in text format', async () => {
      await watchCommands.initWatch();
      await watchCommands.metricsWatch();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Execution Statistics');
      expect(output).toContain('Total executions');
    });
    
    it('should display metrics in JSON format', async () => {
      await watchCommands.initWatch();
      await watchCommands.metricsWatch({ format: 'json' });
      
      const output = consoleOutput.join('\n');
      // Find the JSON part (skip the title line)
      const lines = output.split('\n');
      const jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      const jsonOutput = lines.slice(jsonStart).join('\n');
      
      const metrics = JSON.parse(jsonOutput);
      expect(metrics).toHaveProperty('totalExecutions');
      expect(metrics.totalExecutions).toBe(0);
    });
  });
  
  describe('logsWatch', () => {
    it('should show no logs message when no logs exist', async () => {
      await watchCommands.initWatch();
      await watchCommands.logsWatch();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('No logs found');
    });

    it('should display existing logs from execution log file', async () => {
      const logDir = path.join(testDir, '.kiro/watch/logs');
      const logPath = path.join(logDir, 'execution.log');

      await fs.ensureDir(logDir);
      await fs.writeFile(logPath, [
        JSON.stringify({
          timestamp: '2026-02-14T10:00:00.000Z',
          level: 'info',
          message: 'first log entry'
        }),
        JSON.stringify({
          timestamp: '2026-02-14T10:00:01.000Z',
          level: 'warn',
          message: 'second log entry'
        })
      ].join('\n'), 'utf8');

      await watchCommands.logsWatch({ tail: 1 });

      const output = consoleOutput.join('\n');
      expect(output).toContain('Showing last');
      expect(output).toContain('second log entry');
      expect(output).not.toContain('first log entry');
    });

    it('should follow and print appended logs', async () => {
      const logDir = path.join(testDir, '.kiro/watch/logs');
      const logPath = path.join(logDir, 'execution.log');

      await fs.ensureDir(logDir);
      await fs.writeFile(logPath, JSON.stringify({
        timestamp: '2026-02-14T10:00:00.000Z',
        level: 'info',
        message: 'initial'
      }) + '\n', 'utf8');

      const followPromise = watchCommands.logsWatch({
        tail: 1,
        follow: true,
        pollIntervalMs: 50,
        followDurationMs: 350
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      await fs.appendFile(logPath, JSON.stringify({
        timestamp: '2026-02-14T10:00:01.000Z',
        level: 'info',
        message: 'appended'
      }) + '\n', 'utf8');

      await followPromise;

      const output = consoleOutput.join('\n');
      expect(output).toContain('Following logs...');
      expect(output).toContain('appended');
    });
  });
});
