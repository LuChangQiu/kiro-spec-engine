const fs = require('fs-extra');
const path = require('path');
const EnvironmentCLI = require('../../../lib/commands/env');

// Mock console methods
let consoleOutput = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args) => {
    consoleOutput.push(args.join(' '));
  };
  console.error = (...args) => {
    consoleOutput.push(args.join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('EnvironmentCLI', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../temp', `env-cli-${Date.now()}`);
    await fs.ensureDir(tempDir);
    await fs.ensureDir(path.join(tempDir, '.kiro'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  describe('handleCommand', () => {
    it('should display help for unknown subcommand', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['unknown']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Environment Management Commands');
    });

    it('should display help for no subcommand', async () => {
      const exitCode = await EnvironmentCLI.handleCommand([]);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Environment Management Commands');
    });
  });

  describe('handleList', () => {
    it('should show message when no environments registered', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['list']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('No environments registered');
    });

    it('should list registered environments', async () => {
      // Register an environment
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );
      await EnvironmentCLI.handleCommand(['register', 'env-config.json']);

      // Clear output
      consoleOutput = [];

      // List environments
      const exitCode = await EnvironmentCLI.handleCommand(['list']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('test-env');
      expect(consoleOutput.join('\n')).toContain('Test environment');
    });

    it('should indicate active environment', async () => {
      // Register and switch to environment
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );
      await EnvironmentCLI.handleCommand(['register', 'env-config.json']);
      await EnvironmentCLI.handleCommand(['switch', 'test-env']);

      // Clear output
      consoleOutput = [];

      // List environments
      const exitCode = await EnvironmentCLI.handleCommand(['list']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('active');
    });
  });

  describe('handleSwitch', () => {
    it('should require environment name', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['switch']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Environment name is required');
    });

    it('should switch to environment', async () => {
      // Register environment
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );
      await EnvironmentCLI.handleCommand(['register', 'env-config.json']);

      // Clear output
      consoleOutput = [];

      // Switch to environment
      const exitCode = await EnvironmentCLI.handleCommand(['switch', 'test-env']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('Environment switched successfully');
      expect(consoleOutput.join('\n')).toContain('test-env');
    });

    it('should show error for nonexistent environment', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['switch', 'nonexistent']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Environment switch failed');
    });
  });

  describe('handleInfo', () => {
    it('should show message when no active environment', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['info']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('No active environment');
    });

    it('should display active environment details', async () => {
      // Register and switch to environment
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [
          { source: '.env.test', target: '.env' }
        ],
        verification: {
          command: 'node verify.js',
          expected_output: 'OK'
        }
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );
      await EnvironmentCLI.handleCommand(['register', 'env-config.json']);
      await EnvironmentCLI.handleCommand(['switch', 'test-env']);

      // Clear output
      consoleOutput = [];

      // Get info
      const exitCode = await EnvironmentCLI.handleCommand(['info']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('test-env');
      expect(consoleOutput.join('\n')).toContain('Test environment');
      expect(consoleOutput.join('\n')).toContain('.env.test');
      expect(consoleOutput.join('\n')).toContain('node verify.js');
    });
  });

  describe('handleRegister', () => {
    it('should require config file', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['register']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Configuration file is required');
    });

    it('should show error for nonexistent config file', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['register', 'nonexistent.json']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Configuration file not found');
    });

    it('should register environment from config file', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );

      const exitCode = await EnvironmentCLI.handleCommand(['register', 'env-config.json']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('registered successfully');
    });

    it('should show error for invalid JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, 'invalid.json'),
        '{ invalid json',
        'utf8'
      );

      const exitCode = await EnvironmentCLI.handleCommand(['register', 'invalid.json']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Invalid JSON');
    });
  });

  describe('handleUnregister', () => {
    it('should require environment name', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['unregister']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Environment name is required');
    });

    it('should require --force flag', async () => {
      const exitCode = await EnvironmentCLI.handleCommand(['unregister', 'test-env']);
      
      expect(exitCode).toBe(1);
      expect(consoleOutput.join('\n')).toContain('Use --force');
    });

    it('should unregister environment with --force', async () => {
      // Register environment
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };
      await fs.writeFile(
        path.join(tempDir, 'env-config.json'),
        JSON.stringify(config),
        'utf8'
      );
      await EnvironmentCLI.handleCommand(['register', 'env-config.json']);

      // Clear output
      consoleOutput = [];

      // Unregister
      const exitCode = await EnvironmentCLI.handleCommand(['unregister', 'test-env', '--force']);
      
      expect(exitCode).toBe(0);
      expect(consoleOutput.join('\n')).toContain('unregistered successfully');
    });
  });
});
