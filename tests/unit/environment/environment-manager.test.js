const fs = require('fs-extra');
const path = require('path');
const EnvironmentManager = require('../../../lib/environment/environment-manager');

describe('EnvironmentManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../temp', `env-manager-${Date.now()}`);
    await fs.ensureDir(tempDir);
    await fs.ensureDir(path.join(tempDir, '.kiro'));
    manager = new EnvironmentManager(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('constructor', () => {
    it('should create manager with project root', () => {
      expect(manager.projectRoot).toBe(tempDir);
      expect(manager.workspaceContext).toBeNull();
    });

    it('should resolve project-level registry path', () => {
      const expectedPath = path.join(tempDir, '.kiro', 'environments.json');
      expect(manager.registryPath).toBe(expectedPath);
    });

    it('should resolve workspace-specific registry path', () => {
      const wsManager = new EnvironmentManager(tempDir, 'my-workspace');
      const expectedPath = path.join(
        tempDir,
        '.kiro',
        'workspaces',
        'my-workspace',
        'environments.json'
      );
      expect(wsManager.registryPath).toBe(expectedPath);
    });
  });

  describe('registerEnvironment', () => {
    it('should register new environment', async () => {
      // Create source file
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [
          { source: '.env.test', target: '.env' }
        ]
      };

      const result = await manager.registerEnvironment(config);

      expect(result.success).toBe(true);
      expect(result.environment).toBe('test-env');

      // Verify registry was updated
      const environments = await manager.listEnvironments();
      expect(environments).toHaveLength(1);
      expect(environments[0].name).toBe('test-env');
    });

    it('should reject duplicate environment name', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [
          { source: '.env.test', target: '.env' }
        ]
      };

      await manager.registerEnvironment(config);

      await expect(manager.registerEnvironment(config))
        .rejects.toThrow('Environment "test-env" already exists');
    });

    it('should reject if source file does not exist', async () => {
      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [
          { source: '.env.nonexistent', target: '.env' }
        ]
      };

      await expect(manager.registerEnvironment(config))
        .rejects.toThrow('Source file does not exist: .env.nonexistent');
    });

    it('should validate environment configuration', async () => {
      const config = {
        name: 'InvalidName',
        description: 'Test',
        config_files: [
          { source: '.env.test', target: '.env' }
        ]
      };

      await expect(manager.registerEnvironment(config))
        .rejects.toThrow('Environment name must be kebab-case');
    });
  });

  describe('listEnvironments', () => {
    it('should return empty array for new registry', async () => {
      const environments = await manager.listEnvironments();
      expect(environments).toEqual([]);
    });

    it('should list all registered environments', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test1'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, '.env.test2'), 'TEST=2', 'utf8');

      await manager.registerEnvironment({
        name: 'env1',
        description: 'Environment 1',
        config_files: [{ source: '.env.test1', target: '.env' }]
      });

      await manager.registerEnvironment({
        name: 'env2',
        description: 'Environment 2',
        config_files: [{ source: '.env.test2', target: '.env' }],
        verification: {
          command: 'node verify.js',
          expected_output: 'OK'
        }
      });

      const environments = await manager.listEnvironments();

      expect(environments).toHaveLength(2);
      expect(environments[0]).toMatchObject({
        name: 'env1',
        description: 'Environment 1',
        isActive: false,
        configFilesCount: 1,
        hasVerification: false
      });
      expect(environments[1]).toMatchObject({
        name: 'env2',
        description: 'Environment 2',
        isActive: false,
        configFilesCount: 1,
        hasVerification: true
      });
    });

    it('should indicate active environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      const environments = await manager.listEnvironments();
      expect(environments[0].isActive).toBe(true);
    });
  });

  describe('getActiveEnvironment', () => {
    it('should throw error if no active environment', async () => {
      await expect(manager.getActiveEnvironment())
        .rejects.toThrow('No active environment');
    });

    it('should return active environment details', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      const config = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [{ source: '.env.test', target: '.env' }]
      };

      await manager.registerEnvironment(config);
      await manager.setActiveEnvironment('test-env');

      const active = await manager.getActiveEnvironment();
      expect(active).toMatchObject(config);
    });

    it('should throw error if active environment not found in registry', async () => {
      // Manually create corrupted registry
      const registryPath = manager.registryPath;
      await fs.writeFile(
        registryPath,
        JSON.stringify({
          version: '1.0',
          environments: [],
          active_environment: 'nonexistent'
        }),
        'utf8'
      );

      await expect(manager.getActiveEnvironment())
        .rejects.toThrow('Active environment "nonexistent" not found in registry');
    });
  });

  describe('setActiveEnvironment', () => {
    it('should set active environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      const active = await manager.getActiveEnvironment();
      expect(active.name).toBe('test-env');
    });

    it('should throw error if environment does not exist', async () => {
      await expect(manager.setActiveEnvironment('nonexistent'))
        .rejects.toThrow('Environment "nonexistent" not found');
    });
  });

  describe('switchEnvironment', () => {
    it('should switch to environment and copy files', async () => {
      // Create source files
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');
      await fs.writeFile(
        path.join(tempDir, 'config.test.json'),
        '{"test": true}',
        'utf8'
      );

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [
          { source: '.env.test', target: '.env' },
          { source: 'config.test.json', target: 'config/app.json' }
        ]
      });

      const result = await manager.switchEnvironment('test-env');

      expect(result.success).toBe(true);
      expect(result.new_environment).toBe('test-env');
      expect(result.files_copied).toBe(2);

      // Verify files were copied
      const envContent = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
      expect(envContent).toBe('TEST=1');

      const configContent = await fs.readFile(
        path.join(tempDir, 'config', 'app.json'),
        'utf8'
      );
      expect(configContent).toBe('{"test": true}');

      // Verify active environment was updated
      const active = await manager.getActiveEnvironment();
      expect(active.name).toBe('test-env');
    });

    it('should create target directories if needed', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [
          { source: '.env.test', target: 'nested/deep/dir/.env' }
        ]
      });

      const result = await manager.switchEnvironment('test-env');

      expect(result.success).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'nested', 'deep', 'dir', '.env')))
        .toBe(true);
    });

    it('should return error if environment not found', async () => {
      const result = await manager.switchEnvironment('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Environment "nonexistent" not found');
    });

    it('should return error if source file missing', async () => {
      // Create source file first to register
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [
          { source: '.env.test', target: '.env' }
        ]
      });

      // Delete source file before switching
      await fs.remove(path.join(tempDir, '.env.test'));

      const result = await manager.switchEnvironment('test-env');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Source file does not exist');
    });

    it('should track previous environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test1'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, '.env.test2'), 'TEST=2', 'utf8');

      await manager.registerEnvironment({
        name: 'env1',
        description: 'Env 1',
        config_files: [{ source: '.env.test1', target: '.env' }]
      });

      await manager.registerEnvironment({
        name: 'env2',
        description: 'Env 2',
        config_files: [{ source: '.env.test2', target: '.env' }]
      });

      await manager.switchEnvironment('env1');
      const result = await manager.switchEnvironment('env2');

      expect(result.previous_environment).toBe('env1');
      expect(result.new_environment).toBe('env2');
    });
  });

  describe('unregisterEnvironment', () => {
    it('should unregister environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      const result = await manager.unregisterEnvironment('test-env');

      expect(result.success).toBe(true);

      const environments = await manager.listEnvironments();
      expect(environments).toHaveLength(0);
    });

    it('should throw error if environment not found', async () => {
      await expect(manager.unregisterEnvironment('nonexistent'))
        .rejects.toThrow('Environment "nonexistent" not found');
    });

    it('should prevent unregistering active environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      await expect(manager.unregisterEnvironment('test-env'))
        .rejects.toThrow('Cannot unregister active environment');
    });
  });

  describe('verifyEnvironment', () => {
    it('should return success if no verification rules', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.verifyEnvironment();

      expect(result.success).toBe(true);
      expect(result.environment_name).toBe('test-env');
      expect(result.command).toBeNull();
    });

    it('should verify environment with matching output', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      // Create a simple verification script
      const verifyScript = path.join(tempDir, 'verify.js');
      await fs.writeFile(
        verifyScript,
        'console.log("Environment: test-env");',
        'utf8'
      );

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          command: `node ${verifyScript}`,
          expected_output: 'test-env'
        }
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.verifyEnvironment();

      expect(result.success).toBe(true);
      expect(result.environment_name).toBe('test-env');
      expect(result.actual_output).toContain('test-env');
      expect(result.exit_code).toBe(0);
    });

    it('should fail verification with non-matching output', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      const verifyScript = path.join(tempDir, 'verify.js');
      await fs.writeFile(
        verifyScript,
        'console.log("Environment: wrong");',
        'utf8'
      );

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          command: `node ${verifyScript}`,
          expected_output: 'test-env'
        }
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.verifyEnvironment();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Output does not match expected pattern');
      expect(result.actual_output).toContain('wrong');
    });

    it('should handle verification command failure', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          command: 'node nonexistent-script.js',
          expected_output: 'test-env'
        }
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.verifyEnvironment();

      expect(result.success).toBe(false);
      expect(result.exit_code).not.toBe(0);
      expect(result.error).toBeTruthy();
    });

    it('should throw error if no active environment', async () => {
      await expect(manager.verifyEnvironment())
        .rejects.toThrow('No active environment');
    });
  });

  describe('runInEnvironment', () => {
    it('should run command in active environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.runInEnvironment('node --version');

      expect(result.success).toBe(true);
      expect(result.environment_name).toBe('test-env');
      expect(result.command).toBe('node --version');
      expect(result.output).toMatch(/v\d+\.\d+\.\d+/);
      expect(result.exit_code).toBe(0);
    });

    it('should switch to specified environment before running', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test1'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, '.env.test2'), 'TEST=2', 'utf8');

      await manager.registerEnvironment({
        name: 'env1',
        description: 'Env 1',
        config_files: [{ source: '.env.test1', target: '.env' }]
      });

      await manager.registerEnvironment({
        name: 'env2',
        description: 'Env 2',
        config_files: [{ source: '.env.test2', target: '.env' }]
      });

      await manager.setActiveEnvironment('env1');

      const result = await manager.runInEnvironment('node --version', 'env2');

      expect(result.success).toBe(true);
      expect(result.environment_name).toBe('env2');

      // Verify environment was switched
      const active = await manager.getActiveEnvironment();
      expect(active.name).toBe('env2');
    });

    it('should handle command failure', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      const result = await manager.runInEnvironment('node nonexistent-script.js');

      expect(result.success).toBe(false);
      expect(result.exit_code).not.toBe(0);
      expect(result.error).toBeTruthy();
    });

    it('should throw error if no active environment', async () => {
      await expect(manager.runInEnvironment('node --version'))
        .rejects.toThrow('No active environment');
    });

    it('should throw error if specified environment does not exist', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test'), 'TEST=1', 'utf8');

      await manager.registerEnvironment({
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      });

      await manager.setActiveEnvironment('test-env');

      await expect(manager.runInEnvironment('node --version', 'nonexistent'))
        .rejects.toThrow('Failed to switch to environment "nonexistent"');
    });
  });

  describe('rollbackEnvironment', () => {
    it('should rollback to previous environment', async () => {
      await fs.writeFile(path.join(tempDir, '.env.test1'), 'TEST=1', 'utf8');
      await fs.writeFile(path.join(tempDir, '.env.test2'), 'TEST=2', 'utf8');
      await fs.writeFile(path.join(tempDir, '.env'), 'ORIGINAL=1', 'utf8');

      await manager.registerEnvironment({
        name: 'env1',
        description: 'Env 1',
        config_files: [{ source: '.env.test1', target: '.env' }]
      });

      await manager.registerEnvironment({
        name: 'env2',
        description: 'Env 2',
        config_files: [{ source: '.env.test2', target: '.env' }]
      });

      // Switch to env1 (creates backup of original)
      await manager.switchEnvironment('env1');

      // Switch to env2 (creates backup of env1)
      await manager.switchEnvironment('env2');

      // Rollback should restore env1
      const result = await manager.rollbackEnvironment();

      expect(result.environment_name).toBe('env2');
      expect(result.files_restored).toBeGreaterThan(0);

      // Verify active environment was updated
      const active = await manager.getActiveEnvironment();
      expect(active.name).toBe('env2');
    });

    it('should throw error if no backups exist', async () => {
      await expect(manager.rollbackEnvironment())
        .rejects.toThrow('No backups available to restore');
    });
  });
});
