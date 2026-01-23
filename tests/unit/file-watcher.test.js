const FileWatcher = require('../../lib/watch/file-watcher');
const fs = require('fs-extra');
const path = require('path');

describe('FileWatcher', () => {
  let watcher;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../fixtures/watch-test');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    if (watcher && watcher.isWatching) {
      await watcher.stop();
    }
    
    // Add delay to allow file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup warning:', error.message);
    }
  });

  describe('constructor', () => {
    test('should create FileWatcher with default config', () => {
      watcher = new FileWatcher();
      
      expect(watcher).toBeDefined();
      expect(watcher.isWatching).toBe(false);
      expect(watcher.config.persistent).toBe(true);
      expect(watcher.config.ignoreInitial).toBe(true);
    });

    test('should create FileWatcher with custom config', () => {
      watcher = new FileWatcher({
        patterns: ['**/*.md'],
        persistent: false
      });
      
      expect(watcher.config.patterns).toEqual(['**/*.md']);
      expect(watcher.config.persistent).toBe(false);
    });

    test('should have default ignored patterns', () => {
      watcher = new FileWatcher();
      
      expect(watcher.config.ignored).toContain('**/node_modules/**');
      expect(watcher.config.ignored).toContain('**/.git/**');
    });
  });

  describe('start', () => {
    test('should start watching files', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      const startedPromise = new Promise(resolve => {
        watcher.once('started', resolve);
      });

      await watcher.start(testDir);
      await startedPromise;

      expect(watcher.isWatching).toBe(true);
      expect(watcher.stats.startedAt).toBeDefined();
    });

    test('should throw error if already watching', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await watcher.start(testDir);

      await expect(watcher.start(testDir)).rejects.toThrow('already running');
    });

    test('should throw error if no patterns specified', async () => {
      watcher = new FileWatcher();

      await expect(watcher.start(testDir)).rejects.toThrow('No patterns specified');
    });

    test('should emit ready event when initialized', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      const readyPromise = new Promise(resolve => {
        watcher.once('ready', resolve);
      });

      await watcher.start(testDir);
      const readyData = await readyPromise;

      expect(readyData).toBeDefined();
      expect(readyData.patterns).toEqual(['**/*.txt']);
    });
  });

  describe('stop', () => {
    test('should stop watching files', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await watcher.start(testDir);
      expect(watcher.isWatching).toBe(true);

      const stoppedPromise = new Promise(resolve => {
        watcher.once('stopped', resolve);
      });

      await watcher.stop();
      await stoppedPromise;

      expect(watcher.isWatching).toBe(false);
    });

    test('should not throw if not watching', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await expect(watcher.stop()).resolves.not.toThrow();
    });
  });

  describe('file events', () => {
    test('should detect file changes', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      // Create file first
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'initial content');

      await watcher.start(testDir);

      const changePromise = new Promise(resolve => {
        watcher.once('file:changed', resolve);
      });

      // Wait for watcher to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Modify file
      await fs.writeFile(testFile, 'modified content');

      const changeData = await changePromise;

      expect(changeData).toBeDefined();
      expect(changeData.path).toContain('test.txt');
      expect(changeData.event).toBe('change');
    }, 15000);

    test('should detect file deletion', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      // Create file first
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      await watcher.start(testDir);

      const deletePromise = new Promise(resolve => {
        watcher.once('file:deleted', resolve);
      });

      // Delete file
      await fs.remove(testFile);

      const deleteData = await deletePromise;

      expect(deleteData).toBeDefined();
      expect(deleteData.path).toContain('test.txt');
      expect(deleteData.event).toBe('unlink');
    }, 10000);
  });

  describe('getStatus', () => {
    test('should return current status', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      let status = watcher.getStatus();
      expect(status.isWatching).toBe(false);

      await watcher.start(testDir);

      status = watcher.getStatus();
      expect(status.isWatching).toBe(true);
      expect(status.patterns).toEqual(['**/*.txt']);
    });
  });

  describe('getStats', () => {
    test('should return statistics', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await watcher.start(testDir);

      const stats = watcher.getStats();

      expect(stats).toBeDefined();
      expect(stats.startedAt).toBeDefined();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.eventsEmitted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getWatchedFiles', () => {
    test('should return list of watched files', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      // Create test file
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      await watcher.start(testDir);

      // Wait for file to be detected
      await new Promise(resolve => setTimeout(resolve, 500));

      const files = watcher.getWatchedFiles();

      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('pattern matching', () => {
    test('should validate patterns on construction', () => {
      expect(() => {
        new FileWatcher({ patterns: 'not-an-array' });
      }).toThrow('Patterns must be an array');

      expect(() => {
        new FileWatcher({ patterns: [123] });
      }).toThrow('Pattern must be a string');
    });

    test('should match files against patterns', () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt', '**/*.md']
      });

      expect(watcher.matchesPattern('test.txt')).toBe(true);
      expect(watcher.matchesPattern('docs/readme.md')).toBe(true);
      expect(watcher.matchesPattern('test.js')).toBe(false);
    });

    test('should respect ignored patterns', () => {
      watcher = new FileWatcher({
        patterns: ['**/*.js'],
        ignored: ['**/node_modules/**', '**/test/**']
      });

      expect(watcher.matchesPattern('src/index.js')).toBe(true);
      expect(watcher.matchesPattern('node_modules/lib/index.js')).toBe(false);
      expect(watcher.matchesPattern('test/sample.js')).toBe(false);
    });

    test('should normalize path separators', () => {
      watcher = new FileWatcher({
        patterns: ['src/**/*.js']
      });

      expect(watcher.matchesPattern('src\\utils\\helper.js')).toBe(true);
      expect(watcher.matchesPattern('src/utils/helper.js')).toBe(true);
    });

    test('should get current patterns', () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt', '**/*.md']
      });

      const patterns = watcher.getPatterns();
      expect(patterns).toEqual(['**/*.txt', '**/*.md']);
    });

    test('should get ignored patterns', () => {
      watcher = new FileWatcher({
        ignored: ['**/node_modules/**', '**/.git/**']
      });

      const ignored = watcher.getIgnoredPatterns();
      expect(ignored).toContain('**/node_modules/**');
      expect(ignored).toContain('**/.git/**');
    });

    test('should add patterns dynamically', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await watcher.start(testDir);

      const addedPromise = new Promise(resolve => {
        watcher.once('patterns:added', resolve);
      });

      await watcher.addPatterns('**/*.md');
      await addedPromise;

      const patterns = watcher.getPatterns();
      expect(patterns).toContain('**/*.txt');
      expect(patterns).toContain('**/*.md');
    });

    test('should remove patterns dynamically', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt', '**/*.md']
      });

      await watcher.start(testDir);

      const removedPromise = new Promise(resolve => {
        watcher.once('patterns:removed', resolve);
      });

      await watcher.removePatterns('**/*.md');
      await removedPromise;

      const patterns = watcher.getPatterns();
      expect(patterns).toContain('**/*.txt');
      expect(patterns).not.toContain('**/*.md');
    });

    test('should throw error when adding patterns while not watching', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await expect(watcher.addPatterns('**/*.md')).rejects.toThrow('not running');
    });

    test('should throw error when removing patterns while not watching', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt']
      });

      await expect(watcher.removePatterns('**/*.txt')).rejects.toThrow('not running');
    });
  });

  describe('error handling', () => {
    test('should track errors', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 0  // 禁用自动恢复
      });

      await watcher.start(testDir);

      // Listen for error event to prevent unhandled error
      watcher.on('error', () => {});

      // Simulate error
      watcher._handleError(new Error('Test error'));

      expect(watcher.stats.errors).toBe(1);
      expect(watcher.getLastError()).toBeDefined();
      expect(watcher.getLastError().message).toBe('Test error');
    });

    test('should emit error events', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 0
      });

      await watcher.start(testDir);

      const errorPromise = new Promise(resolve => {
        watcher.once('error', resolve);
      });

      watcher._handleError(new Error('Test error'));

      const errorData = await errorPromise;
      expect(errorData.error).toBeDefined();
      expect(errorData.context).toBe('watcher');
    });

    test('should reset error count', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 0
      });

      await watcher.start(testDir);

      watcher.on('error', () => {});
      watcher._handleError(new Error('Test error'));
      expect(watcher.stats.errors).toBe(1);

      watcher.resetErrorCount();
      expect(watcher.stats.errors).toBe(0);
      expect(watcher.getLastError()).toBeNull();
    });

    test('should report health status', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 0
      });

      await watcher.start(testDir);

      let health = watcher.getHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.isWatching).toBe(true);
      expect(health.errorCount).toBe(0);

      // Simulate errors
      watcher.on('error', () => {});
      watcher._handleError(new Error('Test error'));

      health = watcher.getHealth();
      expect(health.errorCount).toBe(1);
      expect(health.lastError).toBe('Test error');
    });

    test('should attempt recovery on error', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 2,
        retryDelay: 100
      });

      await watcher.start(testDir);

      const recoveryAttemptPromise = new Promise(resolve => {
        watcher.once('recovery:attempt', resolve);
      });

      watcher.on('error', () => {});
      watcher._handleError(new Error('Test error'));

      const recoveryData = await recoveryAttemptPromise;
      expect(recoveryData.retryCount).toBe(1);
      expect(recoveryData.delay).toBe(100);

      // Wait for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }, 10000);

    test('should stop after max retries', async () => {
      watcher = new FileWatcher({
        patterns: ['**/*.txt'],
        maxRetries: 1,
        retryDelay: 100
      });

      await watcher.start(testDir);

      const recoveryFailedPromise = new Promise(resolve => {
        watcher.once('recovery:failed', resolve);
      });

      watcher.on('error', () => {});
      
      // Simulate multiple errors
      watcher.retryCount = 1;
      watcher._handleError(new Error('Test error'));

      const failedData = await recoveryFailedPromise;
      expect(failedData.message).toBe('Max retries exceeded');

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }, 10000);
  });
});
