const fs = require('fs').promises;
const path = require('path');
const InitHandler = require('../../../../lib/repo/handlers/init-handler');
const RepoManager = require('../../../../lib/repo/repo-manager');
const ConfigManager = require('../../../../lib/repo/config-manager');

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((question, callback) => {
      callback('y'); // Default to yes
    }),
    close: jest.fn()
  }))
}));

describe('InitHandler', () => {
  let handler;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '..', '..', '..', 'temp', `init-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.kiro'), { recursive: true });

    handler = new InitHandler(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('execute', () => {
    test('should discover repositories and create configuration', async () => {
      // Mock discoverRepositories to return test data
      jest.spyOn(handler.repoManager, 'discoverRepositories').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          remote: 'https://github.com/user/repo1.git',
          branch: 'main',
          hasRemote: true
        },
        {
          name: 'repo2',
          path: './repo2',
          remote: null,
          branch: 'master',
          hasRemote: false
        }
      ]);

      const result = await handler.execute({ yes: true });

      expect(result.cancelled).toBe(false);
      expect(result.discovered).toHaveLength(2);
      expect(result.discovered[0].name).toBe('repo1');
      expect(result.discovered[1].name).toBe('repo2');

      // Verify configuration was saved
      const configPath = handler.configManager.getConfigPath();
      const configExists = await handler.configManager.configExists();
      expect(configExists).toBe(true);

      // Verify configuration content
      const config = await handler.configManager.loadConfig({ skipFilesystemValidation: true });
      expect(config.version).toBe('1.0');
      expect(config.repositories).toHaveLength(2);
      expect(config.repositories[0].name).toBe('repo1');
      expect(config.repositories[0].remote).toBe('https://github.com/user/repo1.git');
      expect(config.repositories[1].name).toBe('repo2');
      expect(config.repositories[1].remote).toBeNull();
    });

    test('should handle no repositories found', async () => {
      jest.spyOn(handler.repoManager, 'discoverRepositories').mockResolvedValue([]);

      const result = await handler.execute({ yes: true });

      expect(result.cancelled).toBe(false);
      expect(result.discovered).toHaveLength(0);
    });

    test('should prompt for confirmation when config exists', async () => {
      // Create existing config
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      // Mock user input to decline
      const readline = require('readline');
      readline.createInterface.mockReturnValue({
        question: jest.fn((question, callback) => {
          callback('n'); // User declines
        }),
        close: jest.fn()
      });

      jest.spyOn(handler.repoManager, 'discoverRepositories').mockResolvedValue([]);

      const result = await handler.execute({ yes: false });

      expect(result.cancelled).toBe(true);
    });

    test('should skip confirmation with yes flag', async () => {
      // Create existing config
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'discoverRepositories').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          remote: 'https://github.com/user/repo1.git',
          branch: 'main',
          hasRemote: true
        }
      ]);

      const result = await handler.execute({ yes: true });

      expect(result.cancelled).toBe(false);
      expect(result.discovered).toHaveLength(1);
    });

    test('should handle scan errors', async () => {
      jest.spyOn(handler.repoManager, 'discoverRepositories').mockRejectedValue(
        new Error('Scan failed')
      );

      await expect(handler.execute({ yes: true })).rejects.toThrow('Scan failed');
    });

    test('should respect maxDepth option', async () => {
      const discoverSpy = jest.spyOn(handler.repoManager, 'discoverRepositories')
        .mockResolvedValue([]);

      await handler.execute({ yes: true, maxDepth: 5 });

      expect(discoverSpy).toHaveBeenCalledWith(testDir, {
        maxDepth: 5,
        exclude: ['.kiro'],
        nested: true
      });
    });

    test('should respect exclude option', async () => {
      const discoverSpy = jest.spyOn(handler.repoManager, 'discoverRepositories')
        .mockResolvedValue([]);

      await handler.execute({ yes: true, exclude: ['.kiro', 'node_modules'] });

      expect(discoverSpy).toHaveBeenCalledWith(testDir, {
        maxDepth: 3,
        exclude: ['.kiro', 'node_modules'],
        nested: true
      });
    });
  });

  describe('confirmOverwrite', () => {
    test('should return true when user confirms', async () => {
      const readline = require('readline');
      readline.createInterface.mockReturnValue({
        question: jest.fn((question, callback) => {
          callback('y');
        }),
        close: jest.fn()
      });

      const result = await handler.confirmOverwrite();
      expect(result).toBe(true);
    });

    test('should return true for "yes" input', async () => {
      const readline = require('readline');
      readline.createInterface.mockReturnValue({
        question: jest.fn((question, callback) => {
          callback('yes');
        }),
        close: jest.fn()
      });

      const result = await handler.confirmOverwrite();
      expect(result).toBe(true);
    });

    test('should return false when user declines', async () => {
      const readline = require('readline');
      readline.createInterface.mockReturnValue({
        question: jest.fn((question, callback) => {
          callback('n');
        }),
        close: jest.fn()
      });

      const result = await handler.confirmOverwrite();
      expect(result).toBe(false);
    });

    test('should return false for empty input', async () => {
      const readline = require('readline');
      readline.createInterface.mockReturnValue({
        question: jest.fn((question, callback) => {
          callback('');
        }),
        close: jest.fn()
      });

      const result = await handler.confirmOverwrite();
      expect(result).toBe(false);
    });
  });

  describe('displaySummary', () => {
    test('should display summary without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = {
        discovered: [
          {
            name: 'repo1',
            path: './repo1',
            branch: 'main',
            hasRemote: true
          },
          {
            name: 'repo2',
            path: './repo2',
            branch: 'master',
            hasRemote: true
          }
        ],
        configPath: '/path/to/config.json'
      };

      handler.displaySummary(result);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Repository configuration initialized');
      expect(output).toContain('repo1');
      expect(output).toContain('repo2');

      consoleSpy.mockRestore();
    });

    test('should display warning for repos without remotes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = {
        discovered: [
          {
            name: 'repo1',
            path: './repo1',
            branch: 'main',
            hasRemote: false
          }
        ],
        configPath: '/path/to/config.json'
      };

      handler.displaySummary(result);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('without remote URLs');
      expect(output).toContain('repo1');

      consoleSpy.mockRestore();
    });
  });
});
