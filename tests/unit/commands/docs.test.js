/**
 * Unit tests for docs command
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const docsCommand = require('../../../lib/commands/docs');

describe('docs command', () => {
  let testDir;
  let originalCwd;
  let consoleLogSpy;
  let consoleErrorSpy;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-cmd-test-'));
    
    // Save original cwd and change to test directory
    originalCwd = process.cwd();
    process.chdir(testDir);
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);
    
    // Clean up test directory
    await fs.remove(testDir);
    
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  describe('diagnose subcommand', () => {
    test('should return 0 when project is compliant', async () => {
      // Create compliant project
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      const exitCode = await docsCommand('diagnose');
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
    
    test('should return 1 when violations found', async () => {
      // Create non-compliant project
      await fs.writeFile(path.join(testDir, 'TEMP-file.md'), '# Temp');
      
      const exitCode = await docsCommand('diagnose');
      
      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
  
  describe('cleanup subcommand', () => {
    test('should clean up temporary files', async () => {
      await fs.writeFile(path.join(testDir, 'TEMP-file.md'), '# Temp');
      
      const exitCode = await docsCommand('cleanup');
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(testDir, 'TEMP-file.md'))).toBe(false);
    });
    
    test('should support dry-run mode', async () => {
      await fs.writeFile(path.join(testDir, 'TEMP-file.md'), '# Temp');
      
      const exitCode = await docsCommand('cleanup', { dryRun: true });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(testDir, 'TEMP-file.md'))).toBe(true);
    });
    
    test('should support spec-specific cleanup', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'TEMP-file.md'), '# Temp');
      
      const exitCode = await docsCommand('cleanup', { spec: 'test-spec' });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(specPath, 'TEMP-file.md'))).toBe(false);
    });
  });
  
  describe('validate subcommand', () => {
    test('should return 0 when validation passes', async () => {
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      const exitCode = await docsCommand('validate');
      
      expect(exitCode).toBe(0);
    });
    
    test('should return 1 when validation fails', async () => {
      await fs.writeFile(path.join(testDir, 'TEMP-file.md'), '# Temp');
      
      const exitCode = await docsCommand('validate');
      
      expect(exitCode).toBe(1);
    });
    
    test('should support --all option', async () => {
      const spec1Path = path.join(testDir, '.sce/specs/spec-1');
      await fs.ensureDir(spec1Path);
      await fs.writeFile(path.join(spec1Path, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(spec1Path, 'design.md'), '# Design');
      await fs.writeFile(path.join(spec1Path, 'tasks.md'), '# Tasks');
      
      const exitCode = await docsCommand('validate', { all: true });
      
      expect(exitCode).toBe(0);
    });
    
    test('should support --spec option', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      
      const exitCode = await docsCommand('validate', { spec: 'test-spec' });
      
      expect(exitCode).toBe(0);
    });
  });
  
  describe('archive subcommand', () => {
    test('should require --spec option', async () => {
      const exitCode = await docsCommand('archive');
      
      expect(exitCode).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
    
    test('should archive files in Spec directory', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      
      const exitCode = await docsCommand('archive', { spec: 'test-spec' });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(specPath, 'scripts/script.js'))).toBe(true);
    });
    
    test('should support dry-run mode', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      
      const exitCode = await docsCommand('archive', { spec: 'test-spec', dryRun: true });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(specPath, 'script.js'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'scripts/script.js'))).toBe(false);
    });
  });
  
  describe('help subcommand', () => {
    test('should display help message', async () => {
      const exitCode = await docsCommand('help');
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Document Governance');
      expect(output).toContain('diagnose');
      expect(output).toContain('cleanup');
      expect(output).toContain('validate');
      expect(output).toContain('archive');
      expect(output).toContain('hooks');
    });
    
    test('should display help for unknown subcommand', async () => {
      const exitCode = await docsCommand('unknown');
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
  
  describe('hooks subcommand', () => {
    test('should check hooks status', async () => {
      const exitCode = await docsCommand('hooks', { _: ['status'] });
      
      // Should return 1 because not a git repo
      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('not installed');
    });
    
    test('should install hooks in git repo', async () => {
      // Create .git directory
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      const exitCode = await docsCommand('hooks', { _: ['install'] });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit'))).toBe(true);
    });
    
    test('should uninstall hooks', async () => {
      // Create .git directory and install hooks
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      await docsCommand('hooks', { _: ['install'] });
      
      const exitCode = await docsCommand('hooks', { _: ['uninstall'] });
      
      expect(exitCode).toBe(0);
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit'))).toBe(false);
    });
    
    test('should fail to install when not a git repo', async () => {
      const exitCode = await docsCommand('hooks', { _: ['install'] });
      
      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Not a Git repository');
    });
    
    test('should default to status when no action specified', async () => {
      const exitCode = await docsCommand('hooks', {});
      
      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
  
  describe('error handling', () => {
    test('should return error code on failure', async () => {
      // Archive without --spec should return error code
      const exitCode = await docsCommand('archive');
      
      expect(exitCode).toBe(2);
    });
  });
  
  describe('configuration', () => {
    test('should load and use configuration', async () => {
      // Create custom config
      const configPath = path.join(testDir, '.sce/config');
      await fs.ensureDir(configPath);
      await fs.writeJson(path.join(configPath, 'docs.json'), {
        rootAllowedFiles: ['README.md', 'CUSTOM.md'],
        specSubdirs: ['reports', 'scripts', 'tests', 'results', 'docs'],
        temporaryPatterns: ['*-SUMMARY.md']
      });
      
      // Create file that would be allowed by custom config
      await fs.writeFile(path.join(testDir, 'CUSTOM.md'), '# Custom');
      
      const exitCode = await docsCommand('diagnose');
      
      // Should pass because CUSTOM.md is allowed in custom config
      expect(exitCode).toBe(0);
    });
  });
  
  describe('config subcommand', () => {
    test('should display current configuration', async () => {
      const exitCode = await docsCommand('config');
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Document Governance Configuration');
      expect(output).toContain('Root Allowed Files');
      expect(output).toContain('README.md');
      expect(output).toContain('Spec Subdirectories');
      expect(output).toContain('Temporary Patterns');
    });
    
    test('should set configuration value', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', 'README.md,CUSTOM.md']
      });
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration updated');
      
      // Verify config was saved
      const configPath = path.join(testDir, '.sce/config/docs.json');
      expect(await fs.pathExists(configPath)).toBe(true);
      const config = await fs.readJson(configPath);
      expect(config.rootAllowedFiles).toEqual(['README.md', 'CUSTOM.md']);
    });
    
    test('should set spec-subdirs configuration', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'spec-subdirs', 'reports,scripts,custom']
      });
      
      expect(exitCode).toBe(0);
      
      // Verify config was saved
      const configPath = path.join(testDir, '.sce/config/docs.json');
      const config = await fs.readJson(configPath);
      expect(config.specSubdirs).toEqual(['reports', 'scripts', 'custom']);
    });
    
    test('should set temporary-patterns configuration', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'temporary-patterns', 'TEMP-*.md,WIP-*.md']
      });
      
      expect(exitCode).toBe(0);
      
      // Verify config was saved
      const configPath = path.join(testDir, '.sce/config/docs.json');
      const config = await fs.readJson(configPath);
      expect(config.temporaryPatterns).toEqual(['TEMP-*.md', 'WIP-*.md']);
    });
    
    test('should reject invalid configuration key', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'invalid-key', 'value']
      });
      
      expect(exitCode).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Invalid configuration key');
    });
    
    test('should reject empty value', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', '']
      });
      
      expect(exitCode).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Value cannot be empty');
    });
    
    test('should require key for --set', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config']
      });
      
      expect(exitCode).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Missing configuration key');
    });
    
    test('should require value for --set', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files']
      });
      
      expect(exitCode).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Missing configuration value');
    });
    
    test('should reset configuration to defaults', async () => {
      // First set custom config
      await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', 'CUSTOM.md']
      });
      
      // Then reset
      const exitCode = await docsCommand('config', { reset: true });
      
      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration reset to defaults');
      
      // Verify config was reset
      const configPath = path.join(testDir, '.sce/config/docs.json');
      const config = await fs.readJson(configPath);
      expect(config.rootAllowedFiles).toEqual([
        'README.md',
        'README.zh.md',
        'CHANGELOG.md',
        'CONTRIBUTING.md'
      ]);
    });
    
    test('should persist configuration changes', async () => {
      // Set config
      await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', 'README.md,CUSTOM.md']
      });
      
      // Display config (which loads from file)
      consoleLogSpy.mockClear();
      await docsCommand('config');
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('CUSTOM.md');
    });
    
    test('should handle comma-separated values with spaces', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', 'README.md, CUSTOM.md, OTHER.md']
      });
      
      expect(exitCode).toBe(0);
      
      const configPath = path.join(testDir, '.sce/config/docs.json');
      const config = await fs.readJson(configPath);
      expect(config.rootAllowedFiles).toEqual(['README.md', 'CUSTOM.md', 'OTHER.md']);
    });
    
    test('should filter out empty values from comma-separated list', async () => {
      const exitCode = await docsCommand('config', {
        set: true,
        _: ['config', 'root-allowed-files', 'README.md,,CUSTOM.md,']
      });
      
      expect(exitCode).toBe(0);
      
      const configPath = path.join(testDir, '.sce/config/docs.json');
      const config = await fs.readJson(configPath);
      expect(config.rootAllowedFiles).toEqual(['README.md', 'CUSTOM.md']);
    });
  });
});
