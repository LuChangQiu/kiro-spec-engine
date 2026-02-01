const fs = require('fs').promises;
const path = require('path');
const StatusHandler = require('../../../../lib/repo/handlers/status-handler');

describe('StatusHandler', () => {
  let handler;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '..', '..', '..', 'temp', `status-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.kiro'), { recursive: true });

    handler = new StatusHandler(testDir);
    
    // Mock filesystem validation to avoid path existence checks in tests
    jest.spyOn(handler.configManager, '_validateRepositoryPath').mockResolvedValue([]);
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
    test('should display status for all repositories', async () => {
      // Create test configuration
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: 'https://github.com/user/repo1.git', defaultBranch: 'main' },
          { name: 'repo2', path: './repo2', remote: null, defaultBranch: 'master' }
        ]
      };
      await handler.configManager.saveConfig(config);

      // Mock getAllRepoStatuses
      jest.spyOn(handler.repoManager, 'getAllRepoStatuses').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: true,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: null
        },
        {
          name: 'repo2',
          path: './repo2',
          branch: 'master',
          isClean: false,
          modified: 2,
          added: 1,
          deleted: 0,
          ahead: 1,
          behind: 0,
          error: null
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({ verbose: false });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('repo1');
      expect(output).toContain('repo2');
      expect(output).toContain('Summary');
      expect(output).toContain('Clean: 1');
      expect(output).toContain('Modified: 1');

      consoleSpy.mockRestore();
    });

    test('should display verbose status', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: 'https://github.com/user/repo1.git', defaultBranch: 'main' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'getAllRepoStatuses').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: false,
          modified: 3,
          added: 2,
          deleted: 1,
          ahead: 2,
          behind: 1,
          error: null
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({ verbose: true });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Repository Status (Verbose)');
      expect(output).toContain('Modified files: 3');
      expect(output).toContain('Added files: 2');
      expect(output).toContain('Deleted files: 1');
      expect(output).toContain('Commits ahead: 2');
      expect(output).toContain('Commits behind: 1');

      consoleSpy.mockRestore();
    });

    test('should handle repositories with errors', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: null, defaultBranch: 'main' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'getAllRepoStatuses').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          branch: null,
          isClean: false,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: 'Path not found or inaccessible'
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({ verbose: false });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('ERROR');
      expect(output).toContain('Path not found or inaccessible');
      expect(output).toContain('Errors: 1');

      consoleSpy.mockRestore();
    });

    test('should handle no repositories configured', async () => {
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({ verbose: false });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No repositories configured');

      consoleSpy.mockRestore();
    });

    test('should handle missing configuration file', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(handler.execute({ verbose: false })).rejects.toThrow();

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration file not found');

      consoleSpy.mockRestore();
    });
  });

  describe('formatStatusTable', () => {
    test('should format clean repository status', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: true,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: null
        }
      ];

      handler.formatStatusTable(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('repo1');
      expect(output).toContain('main');
      expect(output).toContain('Clean');

      consoleSpy.mockRestore();
    });

    test('should format modified repository status with changes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: false,
          modified: 2,
          added: 1,
          deleted: 1,
          ahead: 3,
          behind: 1,
          error: null
        }
      ];

      handler.formatStatusTable(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('repo1');
      expect(output).toContain('Modified');
      expect(output).toContain('M:2');
      expect(output).toContain('A:1');
      expect(output).toContain('D:1');
      expect(output).toContain('↑3');
      expect(output).toContain('↓1');

      consoleSpy.mockRestore();
    });

    test('should format error status', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: null,
          isClean: false,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: 'Not a Git repository'
        }
      ];

      handler.formatStatusTable(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('ERROR');
      expect(output).toContain('Not a Git repository');

      consoleSpy.mockRestore();
    });
  });

  describe('formatVerboseStatus', () => {
    test('should format verbose status for clean repository', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: true,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: null
        }
      ];

      handler.formatVerboseStatus(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Repository Status (Verbose)');
      expect(output).toContain('repo1');
      expect(output).toContain('Branch:');
      expect(output).toContain('main');
      expect(output).toContain('Clean - no changes');

      consoleSpy.mockRestore();
    });

    test('should format verbose status for modified repository', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: 'main',
          isClean: false,
          modified: 2,
          added: 1,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: null
        }
      ];

      handler.formatVerboseStatus(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Status: Modified');
      expect(output).toContain('Modified files: 2');
      expect(output).toContain('Added files: 1');

      consoleSpy.mockRestore();
    });

    test('should format verbose status with error', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const statuses = [
        {
          name: 'repo1',
          path: './repo1',
          branch: null,
          isClean: false,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: 'Path not found'
        }
      ];

      handler.formatVerboseStatus(statuses);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Error:');
      expect(output).toContain('Path not found');

      consoleSpy.mockRestore();
    });
  });
});
