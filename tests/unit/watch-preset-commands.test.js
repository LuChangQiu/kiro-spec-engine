/**
 * Tests for Watch Preset Commands
 */

const fs = require('fs-extra');
const path = require('path');
const { listPresetsWatch, installPresetWatch } = require('../../lib/commands/watch');

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

describe('Watch Preset Commands', () => {
  const testDir = path.join(__dirname, '../fixtures/watch-preset-commands-test');
  const configPath = path.join(testDir, '.kiro/watch-config.json');
  const originalCwd = process.cwd();
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('listPresetsWatch', () => {
    it('should list all available presets', async () => {
      await listPresetsWatch();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('auto-sync');
      expect(output).toContain('prompt-regen');
      expect(output).toContain('context-export');
      expect(output).toContain('test-runner');
    });
  });
  
  describe('installPresetWatch', () => {
    it('should install auto-sync preset', async () => {
      await installPresetWatch('auto-sync');
      
      expect(await fs.pathExists(configPath)).toBe(true);
      
      const config = await fs.readJson(configPath);
      expect(config.patterns).toContain('**/tasks.md');
      expect(config.actions['**/tasks.md']).toBeDefined();
      expect(config.actions['**/tasks.md'].command).toBe('sce workspace sync');
    });
    
    it('should install prompt-regen preset', async () => {
      await installPresetWatch('prompt-regen');
      
      const config = await fs.readJson(configPath);
      expect(config.patterns).toContain('**/.kiro/specs/*/requirements.md');
      expect(config.patterns).toContain('**/.kiro/specs/*/design.md');
    });
    
    it('should install context-export preset', async () => {
      await installPresetWatch('context-export');
      
      const config = await fs.readJson(configPath);
      expect(config.patterns).toContain('**/.kiro/specs/*/.complete');
    });
    
    it('should install test-runner preset', async () => {
      await installPresetWatch('test-runner');
      
      const config = await fs.readJson(configPath);
      expect(config.patterns).toContain('**/lib/**/*.js');
      expect(config.patterns).toContain('**/src/**/*.js');
    });
    
    it('should merge with existing config', async () => {
      // Create initial config
      const initialConfig = {
        enabled: true,
        patterns: ['**/*.custom'],
        actions: {
          '**/*.custom': {
            command: 'custom command',
            debounce: 1000
          }
        },
        debounce: { default: 1000 }
      };
      
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, initialConfig);
      
      // Install preset
      await installPresetWatch('auto-sync');
      
      const config = await fs.readJson(configPath);
      expect(config.patterns).toContain('**/*.custom');
      expect(config.patterns).toContain('**/tasks.md');
      expect(config.actions['**/*.custom']).toBeDefined();
      expect(config.actions['**/tasks.md']).toBeDefined();
    });
    
    it('should handle invalid preset name', async () => {
      await expect(installPresetWatch('invalid-preset')).rejects.toThrow();
      
      const output = consoleOutput.join('\n');
      expect(output).toContain('Invalid preset');
    });
  });
});
