const fs = require('fs').promises;
const path = require('path');
const ExecHandler = require('../../../../lib/repo/handlers/exec-handler');

describe('ExecHandler', () => {
  let handler;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '..', '..', '..', 'temp', `exec-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.kiro'), { recursive: true });

    handler = new ExecHandler(testDir);
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
    test('should execute command in all repositories', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: 'https://github.com/user/repo1.git', defaultBranch: 'main' },
          { name: 'repo2', path: './repo2', remote: null, defaultBranch: 'master' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'execInAllRepos').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          command: 'status',
          success: true,
          output: 'On branch main\nnothing to commit',
          error: null,
          exitCode: 0
        },
        {
          name: 'repo2',
          path: './repo2',
          command: 'status',
          success: true,
          output: 'On branch master\nnothing to commit',
          error: null,
          exitCode: 0
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute('status', { dryRun: false });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Execution Results');
      expect(output).toContain('repo1');
      expect(output).toContain('repo2');
      expect(output).toContain('Success');
      expect(output).toContain('Successful: 2');

      consoleSpy.mockRestore();
    });

    test('should handle command failures', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: null, defaultBranch: 'main' },
          { name: 'repo2', path: './repo2', remote: null, defaultBranch: 'master' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'execInAllRepos').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          command: 'invalid-command',
          success: false,
          output: '',
          error: 'git: \'invalid-command\' is not a git command',
          exitCode: 1
        },
        {
          name: 'repo2',
          path: './repo2',
          command: 'invalid-command',
          success: true,
          output: 'Success',
          error: null,
          exitCode: 0
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute('invalid-command', { dryRun: false });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Failed');
      expect(output).toContain('Failed: 1');
      expect(output).toContain('Failed repositories');
      expect(output).toContain('exit code: 1');

      consoleSpy.mockRestore();
    });

    test('should handle dry-run mode', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: null, defaultBranch: 'main' },
          { name: 'repo2', path: './repo2', remote: null, defaultBranch: 'master' }
        ]
      };
      await handler.configManager.saveConfig(config);

      const execSpy = jest.spyOn(handler.repoManager, 'execInAllRepos');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute('status', { dryRun: true });

      // Should not execute commands in dry-run mode
      expect(execSpy).not.toHaveBeenCalled();

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Dry-run mode');
      expect(output).toContain('Commands that would be executed');
      expect(output).toContain('git status');
      expect(output).toContain('repo1');
      expect(output).toContain('repo2');

      consoleSpy.mockRestore();
    });

    test('should require command parameter', async () => {
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(handler.execute('', { dryRun: false })).rejects.toThrow('Command is required');

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Command is required');

      consoleSpy.mockRestore();
    });

    test('should handle no repositories configured', async () => {
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute('status', { dryRun: false });

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No repositories configured');

      consoleSpy.mockRestore();
    });

    test('should handle missing configuration file', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(handler.execute('status', { dryRun: false })).rejects.toThrow();

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration file not found');

      consoleSpy.mockRestore();
    });
  });

  describe('displayResults', () => {
    test('should display successful execution results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          command: 'status',
          success: true,
          output: 'On branch main\nnothing to commit',
          error: null,
          exitCode: 0
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Execution Results');
      expect(output).toContain('repo1');
      expect(output).toContain('git status');
      expect(output).toContain('Success');
      expect(output).toContain('On branch main');

      consoleSpy.mockRestore();
    });

    test('should display failed execution results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          command: 'invalid',
          success: false,
          output: '',
          error: 'Command not found',
          exitCode: 1
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Failed');
      expect(output).toContain('exit code: 1');
      expect(output).toContain('Command not found');

      consoleSpy.mockRestore();
    });

    test('should handle empty output', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          command: 'status',
          success: true,
          output: '',
          error: null,
          exitCode: 0
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('(No output)');

      consoleSpy.mockRestore();
    });
  });

  describe('displaySummary', () => {
    test('should display summary with all successes', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        { name: 'repo1', path: './repo1', success: true, exitCode: 0 },
        { name: 'repo2', path: './repo2', success: true, exitCode: 0 }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Summary');
      expect(output).toContain('Total repositories: 2');
      expect(output).toContain('Successful: 2');
      expect(output).not.toContain('Failed');

      consoleSpy.mockRestore();
    });

    test('should display summary with failures', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        { name: 'repo1', path: './repo1', success: true, exitCode: 0 },
        { name: 'repo2', path: './repo2', success: false, error: 'Error message', exitCode: 1 }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Failed: 1');
      expect(output).toContain('Failed repositories');
      expect(output).toContain('repo2');
      expect(output).toContain('Error message');
      expect(output).toContain('Exit codes');

      consoleSpy.mockRestore();
    });

    test('should display exit codes for failed commands', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        { name: 'repo1', path: './repo1', success: false, error: 'Error 1', exitCode: 1 },
        { name: 'repo2', path: './repo2', success: false, error: 'Error 2', exitCode: 128 }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Exit codes');
      expect(output).toContain('repo1: 1');
      expect(output).toContain('repo2: 128');

      consoleSpy.mockRestore();
    });
  });
});
