const WatchManager = require('../../lib/watch/watch-manager');
const fs = require('fs-extra');
const path = require('path');

describe('WatchManager', () => {
  let manager;
  let testDir;
  let configPath;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../fixtures/watch-manager-test');
    await fs.ensureDir(testDir);
    
    configPath = path.join(testDir, '.sce/watch-config.json');
    
    manager = new WatchManager({
      basePath: testDir,
      configFile: '.sce/watch-config.json'
    });
  });

  afterEach(async () => {
    if (manager && manager.isRunning) {
      await manager.stop();
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      await fs.remove(testDir);
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });

  describe('constructor', () => {
    test('should create WatchManager with default config', () => {
      expect(manager).toBeDefined();
      expect(manager.isRunning).toBe(false);
      expect(manager.config.configFile).toBe('.sce/watch-config.json');
    });

    test('should create WatchManager with custom config', () => {
      manager = new WatchManager({
        basePath: '/custom/path',
        configFile: 'custom-config.json'
      });

      expect(manager.config.basePath).toBe('/custom/path');
      expect(manager.config.configFile).toBe('custom-config.json');
    });
  });

  describe('configuration', () => {
    test('should load default config if file does not exist', async () => {
      const config = await manager.loadConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.patterns).toEqual(['**/*.md']);
    });

    test('should load config from file', async () => {
      const testConfig = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {
          '**/*.txt': {
            command: 'echo test'
          }
        },
        debounce: {
          default: 1000
        },
        logging: {
          enabled: true,
          level: 'debug',
          maxSize: '5MB',
          rotation: true
        },
        retry: {
          enabled: true,
          maxAttempts: 2,
          backoff: 'linear'
        }
      };

      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, testConfig);

      const config = await manager.loadConfig();

      expect(config.patterns).toEqual(['**/*.txt']);
      expect(config.debounce.default).toBe(1000);
    });

    test('should emit config:loaded event', async () => {
      const loadedPromise = new Promise(resolve => {
        manager.once('config:loaded', resolve);
      });

      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, { patterns: ['**/*.md'] });

      await manager.loadConfig();

      const data = await loadedPromise;
      expect(data.configPath).toBeDefined();
    });

    test('should save config to file', async () => {
      const testConfig = {
        enabled: true,
        patterns: ['**/*.js'],
        actions: {},
        debounce: { default: 2000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.saveConfig(testConfig);

      expect(await fs.pathExists(configPath)).toBe(true);

      const saved = await fs.readJson(configPath);
      expect(saved.patterns).toEqual(['**/*.js']);
    });

    test('should emit config:saved event', async () => {
      const savedPromise = new Promise(resolve => {
        manager.once('config:saved', resolve);
      });

      const testConfig = {
        enabled: true,
        patterns: ['**/*.md'],
        actions: {},
        debounce: { default: 2000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.saveConfig(testConfig);

      const data = await savedPromise;
      expect(data.configPath).toBeDefined();
    });

    test('should validate config on save', async () => {
      const invalidConfig = {
        patterns: 'not-an-array'
      };

      await expect(manager.saveConfig(invalidConfig)).rejects.toThrow();
    });
  });

  describe('lifecycle', () => {
    test('should start watch mode', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      expect(manager.isRunning).toBe(true);
      expect(manager.stats.startedAt).toBeDefined();
    });

    test('should emit started event', async () => {
      const startedPromise = new Promise(resolve => {
        manager.once('started', resolve);
      });

      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const data = await startedPromise;
      expect(data.config).toBeDefined();
    });

    test('should throw error if already running', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      await expect(manager.start(config)).rejects.toThrow('already running');
    });

    test('should stop watch mode', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);
      await manager.stop();

      expect(manager.isRunning).toBe(false);
      expect(manager.stats.stoppedAt).toBeDefined();
    });

    test('should emit stopped event', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const stoppedPromise = new Promise(resolve => {
        manager.once('stopped', resolve);
      });

      await manager.stop();

      const data = await stoppedPromise;
      expect(data.stats).toBeDefined();
    });

    test('should not throw if stopping when not running', async () => {
      await expect(manager.stop()).resolves.not.toThrow();
    });

    test('should restart watch mode', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);
      await manager.restart();

      expect(manager.isRunning).toBe(true);
    }, 15000);
  });

  describe('status and stats', () => {
    test('should get status', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const status = manager.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.config).toBeDefined();
      expect(status.stats).toBeDefined();
      expect(status.components).toBeDefined();
    });

    test('should get stats', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const stats = manager.getStats();

      expect(stats.startedAt).toBeDefined();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should get metrics', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const metrics = manager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalExecutions).toBeDefined();
    });

    test('should get logs', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const logs = await manager.getLogs(10);

      expect(Array.isArray(logs)).toBe(true);
    });

    test('should export metrics', async () => {
      const config = {
        enabled: true,
        patterns: ['**/*.txt'],
        actions: {},
        debounce: { default: 1000 },
        logging: { enabled: true, level: 'info', maxSize: '10MB', rotation: true },
        retry: { enabled: true, maxAttempts: 3, backoff: 'exponential' }
      };

      await manager.start(config);

      const outputPath = await manager.exportMetrics('json');

      expect(await fs.pathExists(outputPath)).toBe(true);
    });
  });

  describe('validation', () => {
    test('should validate config on start', async () => {
      const invalidConfig = {
        patterns: []
      };

      await expect(manager.start(invalidConfig)).rejects.toThrow('At least one pattern is required');
    });

    test('should validate patterns type', async () => {
      const invalidConfig = {
        patterns: 'not-an-array'
      };

      await expect(manager.start(invalidConfig)).rejects.toThrow('At least one pattern is required');
    });

    test('should validate actions type', async () => {
      const invalidConfig = {
        patterns: ['**/*.txt'],
        actions: 'not-an-object'
      };

      await expect(manager.start(invalidConfig)).rejects.toThrow('Actions must be an object');
    });
  });

  describe('size parsing', () => {
    test('should parse size strings', () => {
      expect(manager._parseSize('10B')).toBe(10);
      expect(manager._parseSize('10KB')).toBe(10 * 1024);
      expect(manager._parseSize('10MB')).toBe(10 * 1024 * 1024);
      expect(manager._parseSize('1GB')).toBe(1024 * 1024 * 1024);
    });

    test('should handle decimal values', () => {
      expect(manager._parseSize('1.5KB')).toBe(Math.floor(1.5 * 1024));
    });

    test('should throw error for invalid format', () => {
      expect(() => manager._parseSize('invalid')).toThrow('Invalid size format');
    });

    test('should throw error for unknown unit', () => {
      expect(() => manager._parseSize('10TB')).toThrow('Unknown size unit');
    });
  });
});
