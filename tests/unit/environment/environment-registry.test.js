const fs = require('fs-extra');
const path = require('path');
const EnvironmentRegistry = require('../../../lib/environment/environment-registry');

describe('EnvironmentRegistry', () => {
  let tempDir;
  let registryPath;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../temp', `env-registry-${Date.now()}`);
    await fs.ensureDir(tempDir);
    registryPath = path.join(tempDir, 'environments.json');
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('initialize', () => {
    it('should create empty registry structure', () => {
      const registry = EnvironmentRegistry.initialize();
      
      expect(registry).toEqual({
        version: '1.0',
        environments: [],
        active_environment: null
      });
    });
  });

  describe('validate', () => {
    it('should validate correct registry structure', () => {
      const registry = {
        version: '1.0',
        environments: [
          {
            name: 'test-env',
            description: 'Test environment',
            config_files: [
              { source: '.env.test', target: '.env' }
            ]
          }
        ],
        active_environment: 'test-env'
      };

      expect(() => EnvironmentRegistry.validate(registry)).not.toThrow();
    });

    it('should reject registry without version', () => {
      const registry = {
        environments: []
      };

      expect(() => EnvironmentRegistry.validate(registry))
        .toThrow('Registry must have a version field');
    });

    it('should reject registry without environments array', () => {
      const registry = {
        version: '1.0'
      };

      expect(() => EnvironmentRegistry.validate(registry))
        .toThrow('Registry must have an environments array');
    });

    it('should reject duplicate environment names', () => {
      const registry = {
        version: '1.0',
        environments: [
          {
            name: 'test-env',
            description: 'Test 1',
            config_files: [{ source: '.env.test', target: '.env' }]
          },
          {
            name: 'test-env',
            description: 'Test 2',
            config_files: [{ source: '.env.test2', target: '.env' }]
          }
        ]
      };

      expect(() => EnvironmentRegistry.validate(registry))
        .toThrow('Duplicate environment name: test-env');
    });

    it('should reject active_environment not in registry', () => {
      const registry = {
        version: '1.0',
        environments: [
          {
            name: 'test-env',
            description: 'Test',
            config_files: [{ source: '.env.test', target: '.env' }]
          }
        ],
        active_environment: 'nonexistent'
      };

      expect(() => EnvironmentRegistry.validate(registry))
        .toThrow('Active environment "nonexistent" not found in registry');
    });
  });

  describe('validateEnvironment', () => {
    it('should validate correct environment', () => {
      const env = {
        name: 'test-env',
        description: 'Test environment',
        config_files: [
          { source: '.env.test', target: '.env' }
        ]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env)).not.toThrow();
    });

    it('should reject environment without name', () => {
      const env = {
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('Environment must have a name (string)');
    });

    it('should reject non-kebab-case name', () => {
      const env = {
        name: 'TestEnv',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('Environment name must be kebab-case');
    });

    it('should reject environment without description', () => {
      const env = {
        name: 'test-env',
        config_files: [{ source: '.env.test', target: '.env' }]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('must have a description');
    });

    it('should reject environment without config files', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: []
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('must have at least one config file mapping');
    });

    it('should reject config file mapping without source', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: [{ target: '.env' }]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('missing source');
    });

    it('should reject config file mapping without target', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test' }]
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('missing target');
    });

    it('should validate environment with verification rules', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          command: 'node verify.js',
          expected_output: 'OK'
        }
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env)).not.toThrow();
    });

    it('should reject verification without command', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          expected_output: 'OK'
        }
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('missing command');
    });

    it('should reject verification without expected_output', () => {
      const env = {
        name: 'test-env',
        description: 'Test',
        config_files: [{ source: '.env.test', target: '.env' }],
        verification: {
          command: 'node verify.js'
        }
      };

      expect(() => EnvironmentRegistry.validateEnvironment(env))
        .toThrow('missing expected_output');
    });
  });

  describe('load', () => {
    it('should return initialized registry if file does not exist', async () => {
      const registry = await EnvironmentRegistry.load(registryPath);
      
      expect(registry).toEqual({
        version: '1.0',
        environments: [],
        active_environment: null
      });
    });

    it('should load valid registry from file', async () => {
      const data = {
        version: '1.0',
        environments: [
          {
            name: 'test-env',
            description: 'Test',
            config_files: [{ source: '.env.test', target: '.env' }]
          }
        ],
        active_environment: null
      };

      await fs.writeFile(registryPath, JSON.stringify(data), 'utf8');
      const registry = await EnvironmentRegistry.load(registryPath);
      
      expect(registry).toEqual(data);
    });

    it('should throw error for corrupted JSON', async () => {
      await fs.writeFile(registryPath, '{ invalid json', 'utf8');
      
      await expect(EnvironmentRegistry.load(registryPath))
        .rejects.toThrow('Registry file is corrupted');
    });

    it('should throw error for invalid registry structure', async () => {
      await fs.writeFile(registryPath, JSON.stringify({ invalid: true }), 'utf8');
      
      await expect(EnvironmentRegistry.load(registryPath))
        .rejects.toThrow('Registry must have a version field');
    });
  });

  describe('save', () => {
    it('should save registry to file', async () => {
      const registry = {
        version: '1.0',
        environments: [
          {
            name: 'test-env',
            description: 'Test',
            config_files: [{ source: '.env.test', target: '.env' }]
          }
        ],
        active_environment: null
      };

      await EnvironmentRegistry.save(registryPath, registry);
      
      const content = await fs.readFile(registryPath, 'utf8');
      const loaded = JSON.parse(content);
      expect(loaded).toEqual(registry);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'environments.json');
      const registry = EnvironmentRegistry.initialize();

      await EnvironmentRegistry.save(nestedPath, registry);
      
      expect(await fs.pathExists(nestedPath)).toBe(true);
    });

    it('should validate registry before saving', async () => {
      const invalidRegistry = { invalid: true };

      await expect(EnvironmentRegistry.save(registryPath, invalidRegistry))
        .rejects.toThrow('Registry must have a version field');
    });

    it('should format JSON with indentation', async () => {
      const registry = EnvironmentRegistry.initialize();
      await EnvironmentRegistry.save(registryPath, registry);
      
      const content = await fs.readFile(registryPath, 'utf8');
      expect(content).toContain('\n  ');
    });
  });
});
