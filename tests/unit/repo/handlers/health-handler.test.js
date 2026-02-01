const fs = require('fs').promises;
const path = require('path');
const HealthHandler = require('../../../../lib/repo/handlers/health-handler');

describe('HealthHandler', () => {
  let handler;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '..', '..', '..', 'temp', `health-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.kiro'), { recursive: true });

    handler = new HealthHandler(testDir);
    
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
    test('should perform health checks on all repositories', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: 'https://github.com/user/repo1.git', defaultBranch: 'main' },
          { name: 'repo2', path: './repo2', remote: null, defaultBranch: 'master' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'checkAllReposHealth').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: true,
            isGitRepo: true,
            remoteReachable: true,
            branchExists: true
          },
          errors: [],
          warnings: [],
          healthy: true
        },
        {
          name: 'repo2',
          path: './repo2',
          checks: {
            pathExists: true,
            isGitRepo: true,
            remoteReachable: null,
            branchExists: true
          },
          errors: [],
          warnings: ['Remote "origin" is not configured'],
          healthy: true
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({});

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Health Check Results');
      expect(output).toContain('repo1');
      expect(output).toContain('repo2');
      expect(output).toContain('Healthy');
      expect(output).toContain('All repositories are healthy');

      consoleSpy.mockRestore();
    });

    test('should handle unhealthy repositories', async () => {
      const config = {
        version: '1.0',
        repositories: [
          { name: 'repo1', path: './repo1', remote: null, defaultBranch: 'main' }
        ]
      };
      await handler.configManager.saveConfig(config);

      jest.spyOn(handler.repoManager, 'checkAllReposHealth').mockResolvedValue([
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: false,
            isGitRepo: false,
            remoteReachable: null,
            branchExists: null
          },
          errors: ['Path does not exist or is not accessible: ./repo1'],
          warnings: [],
          healthy: false
        }
      ]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({});

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Unhealthy');
      expect(output).toContain('Path does not exist');
      expect(output).toContain('Unhealthy: 1');
      expect(output).toContain('Unhealthy repositories');

      consoleSpy.mockRestore();
    });

    test('should handle no repositories configured', async () => {
      const config = {
        version: '1.0',
        repositories: []
      };
      await handler.configManager.saveConfig(config);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute({});

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No repositories configured');

      consoleSpy.mockRestore();
    });

    test('should handle missing configuration file', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(handler.execute({})).rejects.toThrow();

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Configuration file not found');

      consoleSpy.mockRestore();
    });
  });

  describe('displayResults', () => {
    test('should display healthy repository results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: true,
            isGitRepo: true,
            remoteReachable: true,
            branchExists: true
          },
          errors: [],
          warnings: [],
          healthy: true
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Health Check Results');
      expect(output).toContain('repo1');
      expect(output).toContain('Healthy ✓');
      expect(output).toContain('Path exists:');
      expect(output).toContain('✓ Pass');
      expect(output).toContain('Is Git repository:');
      expect(output).toContain('Remote reachable:');
      expect(output).toContain('Branch exists:');

      consoleSpy.mockRestore();
    });

    test('should display unhealthy repository results with errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: false,
            isGitRepo: false,
            remoteReachable: null,
            branchExists: null
          },
          errors: ['Path does not exist or is not accessible: ./repo1'],
          warnings: [],
          healthy: false
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Unhealthy ✗');
      expect(output).toContain('Path exists:');
      expect(output).toContain('✗ Fail');
      expect(output).toContain('Is Git repository:');
      expect(output).toContain('Errors:');
      expect(output).toContain('Path does not exist');

      consoleSpy.mockRestore();
    });

    test('should display warnings', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: true,
            isGitRepo: true,
            remoteReachable: false,
            branchExists: true
          },
          errors: [],
          warnings: ['Remote "origin" is not reachable'],
          healthy: true
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Warnings:');
      expect(output).toContain('Remote "origin" is not reachable');

      consoleSpy.mockRestore();
    });

    test('should handle null check values', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          checks: {
            pathExists: true,
            isGitRepo: true,
            remoteReachable: null,
            branchExists: null
          },
          errors: [],
          warnings: [],
          healthy: true
        }
      ];

      handler.displayResults(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Path exists:');
      expect(output).toContain('✓ Pass');
      expect(output).toContain('Is Git repository:');
      // Should not display checks with null values
      expect(output).not.toContain('Remote reachable: null');
      expect(output).not.toContain('Branch exists: null');

      consoleSpy.mockRestore();
    });
  });

  describe('displaySummary', () => {
    test('should display summary with all healthy repositories', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          healthy: true,
          errors: [],
          warnings: []
        },
        {
          name: 'repo2',
          path: './repo2',
          healthy: true,
          errors: [],
          warnings: []
        }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Overall Health Summary');
      expect(output).toContain('Total repositories: 2');
      expect(output).toContain('Healthy: 2');
      expect(output).toContain('All repositories are healthy! 🎉');

      consoleSpy.mockRestore();
    });

    test('should display summary with unhealthy repositories', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          healthy: true,
          errors: [],
          warnings: []
        },
        {
          name: 'repo2',
          path: './repo2',
          healthy: false,
          errors: ['Path not found'],
          warnings: []
        }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Unhealthy: 1');
      expect(output).toContain('Unhealthy repositories');
      expect(output).toContain('repo2');
      expect(output).toContain('Path not found');

      consoleSpy.mockRestore();
    });

    test('should display warning summary', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          healthy: true,
          errors: [],
          warnings: ['Warning 1', 'Warning 2']
        },
        {
          name: 'repo2',
          path: './repo2',
          healthy: true,
          errors: [],
          warnings: ['Warning 3']
        }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('2 repositories have warnings');
      expect(output).toContain('repo1: 2 warnings');
      expect(output).toContain('repo2: 1 warning');

      consoleSpy.mockRestore();
    });

    test('should handle single repository with warning', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const results = [
        {
          name: 'repo1',
          path: './repo1',
          healthy: true,
          errors: [],
          warnings: ['Single warning']
        }
      ];

      handler.displaySummary(results);

      const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('1 repository has warnings');
      expect(output).toContain('repo1: 1 warning');

      consoleSpy.mockRestore();
    });
  });

  describe('_formatCheckResult', () => {
    test('should format passing check', () => {
      const result = handler._formatCheckResult(true);
      expect(result).toContain('✓ Pass');
    });

    test('should format failing check', () => {
      const result = handler._formatCheckResult(false);
      expect(result).toContain('✗ Fail');
    });
  });
});
