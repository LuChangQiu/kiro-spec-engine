const fs = require('fs').promises;
const path = require('path');
const ConfigManager = require('../../../lib/repo/config-manager');
const ConfigError = require('../../../lib/repo/errors/config-error');

describe('ConfigManager', () => {
  let tempDir;
  let configManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(__dirname, '../../temp', `test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    configManager = new ConfigManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    test('should throw error if project root is not provided', () => {
      expect(() => new ConfigManager()).toThrow('Project root is required');
    });

    test('should create instance with valid project root', () => {
      const manager = new ConfigManager('/some/path');
      expect(manager.projectRoot).toBe('/some/path');
    });
  });

  describe('getConfigPath', () => {
    test('should return correct config path', () => {
      const expectedPath = path.join(tempDir, '.sce', 'project-repos.json');
      expect(configManager.getConfigPath()).toBe(expectedPath);
    });
  });

  describe('configExists', () => {
    test('should return false when config does not exist', async () => {
      const exists = await configManager.configExists();
      expect(exists).toBe(false);
    });

    test('should return true when config exists', async () => {
      const configPath = configManager.getConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, '{}', 'utf8');

      const exists = await configManager.configExists();
      expect(exists).toBe(true);
    });
  });

  describe('validateConfig', () => {
    test('should reject non-object config', () => {
      const result = configManager.validateConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    test('should accept config without version (defaults to 1.0)', () => {
      const config = { repositories: [] };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject config with non-string version', () => {
      const config = { version: 1.0, repositories: [] };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "version" must be a string');
    });

    test('should reject unsupported version', () => {
      const config = { version: '2.0', repositories: [] };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unsupported configuration version'))).toBe(true);
    });

    test('should reject config without repositories', () => {
      const config = { version: '1.0' };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: repositories');
    });

    test('should reject config with non-array repositories', () => {
      const config = { version: '1.0', repositories: {} };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "repositories" must be an array');
    });

    test('should accept valid minimal config', () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1' }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should accept valid complete config', () => {
      const config = {
        version: '1.0',
        repositories: [
          {
            name: 'repo1',
            path: './repo1',
            remote: 'https://github.com/user/repo1.git',
            defaultBranch: 'main',
            description: 'First repository',
            tags: ['frontend', 'react'],
            group: 'web'
          }
        ],
        groups: {
          web: { description: 'Web projects', color: 'blue' }
        },
        settings: {
          defaultRemote: 'origin',
          scanDepth: 3
        }
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject repository without name', () => {
      const config = {
        version: '1.0',
        repositories: [{ path: './repo1' }]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required field "name"'))).toBe(true);
    });

    test('should reject repository without path', () => {
      const config = {
        version: '1.0',
        repositories: [{ name: 'repo1' }]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required field "path"'))).toBe(true);
    });

    test('should reject invalid repository name with special characters', () => {
      const config = {
        version: '1.0',
        repositories: [{ name: 'repo@1', path: './repo1' }]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid repository name'))).toBe(true);
    });

    test('should accept valid repository names', () => {
      const validNames = ['repo1', 'my-repo', 'my_repo', 'repo.1', 'a', 'repo-1.2_test'];
      validNames.forEach(name => {
        const config = {
          version: '1.0',
          repositories: [{ name, path: './repo' }]
        };
        const result = configManager.validateConfig(config);
        expect(result.valid).toBe(true);
      });
    });

    test('should reject duplicate repository names', () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1' },
          { name: 'repo1', path: './repo2' }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate repository name'))).toBe(true);
    });

    test('should reject duplicate repository paths', () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo' },
          { name: 'repo2', path: './repo' }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate path found'))).toBe(true);
    });

    test('should reject overlapping repository paths', () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './parent' },
          { name: 'repo2', path: './parent/child' }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nested within'))).toBe(true);
    });

    test('should validate optional field types', () => {
      const config = {
        version: '1.0',
        repositories: [
          {
            name: 'repo1',
            path: './repo1',
            remote: 123, // Should be string or null
            defaultBranch: true, // Should be string
            description: [], // Should be string
            tags: 'tag', // Should be array
            group: {} // Should be string
          }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should accept null remote', () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: null }
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(true);
    });

    test('should reject non-object groups', () => {
      const config = {
        version: '1.0',
        repositories: [],
        groups: 'invalid'
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "groups" must be an object');
    });

    test('should reject non-object settings', () => {
      const config = {
        version: '1.0',
        repositories: [],
        settings: 'invalid'
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "settings" must be an object');
    });

    test('should collect all validation errors', () => {
      const config = {
        version: '2.0', // Unsupported
        repositories: [
          { name: 'repo@1', path: './repo1' }, // Invalid name
          { name: 'repo2' }, // Missing path
          { path: './repo3' } // Missing name
        ]
      };
      const result = configManager.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe('saveConfig', () => {
    test('should save valid config to disk', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1' }
        ]
      };

      await configManager.saveConfig(config);

      const configPath = configManager.getConfigPath();
      const fileContent = await fs.readFile(configPath, 'utf8');
      const savedConfig = JSON.parse(fileContent);

      expect(savedConfig).toEqual(config);
    });

    test('should create .sce directory if it does not exist', async () => {
      const config = {
        version: '1.0',
        repositories: []
      };

      await configManager.saveConfig(config);

      const kiroDir = path.join(tempDir, '.sce');
      const stats = await fs.stat(kiroDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should reject invalid config', async () => {
      const config = {
        version: '1.0',
        repositories: 'invalid'
      };

      await expect(configManager.saveConfig(config)).rejects.toThrow(ConfigError);
    });

    test('should format JSON with indentation', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1' }
        ]
      };

      await configManager.saveConfig(config);

      const configPath = configManager.getConfigPath();
      const fileContent = await fs.readFile(configPath, 'utf8');

      // Check that JSON is formatted with indentation
      expect(fileContent).toContain('\n');
      expect(fileContent).toContain('  ');
    });
  });

  describe('loadConfig', () => {
    test('should throw error when config does not exist', async () => {
      await expect(configManager.loadConfig()).rejects.toThrow(ConfigError);
      await expect(configManager.loadConfig()).rejects.toThrow('Configuration file not found');
    });

    test('should throw error for invalid JSON', async () => {
      const configPath = configManager.getConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'invalid json', 'utf8');

      await expect(configManager.loadConfig()).rejects.toThrow(ConfigError);
      await expect(configManager.loadConfig()).rejects.toThrow('invalid JSON');
    });

    test('should throw error for invalid config structure', async () => {
      const configPath = configManager.getConfigPath();
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }), 'utf8');

      await expect(configManager.loadConfig()).rejects.toThrow(ConfigError);
      await expect(configManager.loadConfig()).rejects.toThrow('validation failed');
    });

    test('should load valid config', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1' }
        ]
      };

      await configManager.saveConfig(config);
      const loadedConfig = await configManager.loadConfig({ skipFilesystemValidation: true });

      expect(loadedConfig).toEqual(config);
    });

    test('should preserve all fields when loading', async () => {
      const config = {
        version: '1.0',
        repositories: [
          {
            name: 'repo1',
            path: './repo1',
            remote: 'https://github.com/user/repo1.git',
            defaultBranch: 'main',
            description: 'Test repo',
            tags: ['test'],
            group: 'test-group'
          }
        ],
        groups: {
          'test-group': { description: 'Test group' }
        },
        settings: {
          defaultRemote: 'origin'
        }
      };

      await configManager.saveConfig(config);
      const loadedConfig = await configManager.loadConfig({ skipFilesystemValidation: true });

      expect(loadedConfig).toEqual(config);
    });
  });

  describe('round-trip consistency', () => {
    test('should maintain config integrity through save and load', async () => {
      const config = {
        version: '1.0',
        repositories: [
          {
            name: 'repo1',
            path: './repo1',
            remote: 'https://github.com/user/repo1.git',
            defaultBranch: 'main',
            description: 'First repository',
            tags: ['frontend', 'react'],
            group: 'web'
          },
          {
            name: 'repo2',
            path: './repo2',
            remote: null,
            defaultBranch: 'develop'
          }
        ],
        groups: {
          web: { description: 'Web projects', color: 'blue' }
        },
        settings: {
          defaultRemote: 'origin',
          scanDepth: 3
        }
      };

      await configManager.saveConfig(config);
      const loadedConfig = await configManager.loadConfig({ skipFilesystemValidation: true });

      expect(loadedConfig).toEqual(config);
    });
  });

  describe('error details', () => {
    test('should include path in error details for missing file', async () => {
      try {
        await configManager.loadConfig();
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect(error.details).toBeDefined();
        expect(error.details.path).toBe(configManager.getConfigPath());
      }
    });

    test('should include validation errors in details', async () => {
      const config = {
        version: '1.0',
        repositories: 'invalid'
      };

      try {
        await configManager.saveConfig(config);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect(error.details).toBeDefined();
        expect(error.details.errors).toBeDefined();
        expect(Array.isArray(error.details.errors)).toBe(true);
      }
    });
  });
});
