const RepoManager = require('../../../lib/repo/repo-manager');
const GitOperations = require('../../../lib/repo/git-operations');
const PathResolver = require('../../../lib/repo/path-resolver');
const RepoError = require('../../../lib/repo/errors/repo-error');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('../../../lib/repo/git-operations');
jest.mock('../../../lib/repo/path-resolver');
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readdir: jest.fn()
  }
}));

describe('RepoManager', () => {
  let repoManager;
  let mockGitOps;
  let mockPathResolver;
  const projectRoot = '/project/root';

  beforeEach(() => {
    // Create mock instances
    mockGitOps = {
      isGitRepo: jest.fn(),
      getCurrentBranch: jest.fn(),
      getRemotes: jest.fn(),
      getStatus: jest.fn(),
      execRaw: jest.fn(),
      isRemoteReachable: jest.fn()
    };

    mockPathResolver = {
      resolvePath: jest.fn((path, root) => `${root}/${path}`),
      toRelative: jest.fn((abs, base) => abs.replace(base + '/', '')),
      normalizePath: jest.fn(p => p)
    };

    GitOperations.mockImplementation(() => mockGitOps);
    PathResolver.mockImplementation(() => mockPathResolver);

    repoManager = new RepoManager(projectRoot);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RepoManager with project root', () => {
      expect(repoManager.projectRoot).toBe(projectRoot);
      expect(repoManager.gitOps).toBeDefined();
      expect(repoManager.pathResolver).toBeDefined();
    });

    it('should throw error if project root is not provided', () => {
      expect(() => new RepoManager()).toThrow('Project root is required');
    });
  });

  describe('discoverRepositories', () => {
    it('should discover Git repositories in directory', async () => {
      // Mock directory structure: root with one repo
      fs.readdir
        .mockResolvedValueOnce([
          { name: 'repo1', isDirectory: () => true },
          { name: 'file.txt', isDirectory: () => false }
        ]);

      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false) // root is not a repo
        .mockResolvedValueOnce(true); // repo1 is a repo

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo1.git' } }
      ]);

      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'repo1',
        name: 'repo1',
        remote: 'https://github.com/user/repo1.git',
        branch: 'main',
        hasRemote: true
      });
    });

    it('should exclude .kiro directory from scanning', async () => {
      // Mock root directory scan - returns .kiro and repo1
      fs.readdir.mockResolvedValue([
        { name: '.kiro', isDirectory: () => true },
        { name: 'repo1', isDirectory: () => true }
      ]);

      // isGitRepo is called for:
      // 1. root directory (not a repo)
      // 2. .kiro is skipped due to exclusion
      // 3. repo1 (is a repo)
      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false) // root is not a repo
        .mockResolvedValueOnce(true); // repo1 is a repo

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([]);
      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot);

      // .kiro should be excluded, only repo1 should be found
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('repo1');
      
      // Verify .kiro was never checked as a Git repo (excluded before check)
      expect(mockGitOps.isGitRepo).toHaveBeenCalledTimes(2); // root + repo1 only
    });

    it('should handle repositories without remotes', async () => {
      fs.readdir.mockResolvedValue([
        { name: 'repo1', isDirectory: () => true }
      ]);

      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([]); // No remotes

      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot);

      expect(result[0]).toEqual({
        path: 'repo1',
        name: 'repo1',
        remote: null,
        branch: 'main',
        hasRemote: false
      });
    });

    it('should prefer origin remote over others', async () => {
      // Mock root directory scan
      fs.readdir.mockResolvedValue([
        { name: 'repo1', isDirectory: () => true }
      ]);

      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false) // root is not a repo
        .mockResolvedValueOnce(true); // repo1 is a repo

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git' } },
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ]);

      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot);

      expect(result[0].remote).toBe('https://github.com/user/repo.git');
    });

    it('should use first remote if origin does not exist', async () => {
      // Mock root directory scan
      fs.readdir.mockResolvedValue([
        { name: 'repo1', isDirectory: () => true }
      ]);

      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false) // root is not a repo
        .mockResolvedValueOnce(true); // repo1 is a repo

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git' } }
      ]);

      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot);

      expect(result).toHaveLength(1);
      expect(result[0].remote).toBe('https://github.com/org/repo.git');
    });

    it('should respect maxDepth option', async () => {
      // This test verifies depth limiting works
      fs.readdir.mockResolvedValue([]);
      mockGitOps.isGitRepo.mockResolvedValue(false);

      const result = await repoManager.discoverRepositories(projectRoot, { maxDepth: 0 });

      // With maxDepth 0, should only check root
      expect(result).toEqual([]);
    });

    it('should handle custom exclude directories', async () => {
      fs.readdir.mockResolvedValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: 'repo1', isDirectory: () => true }
      ]);

      mockGitOps.isGitRepo
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      mockGitOps.getCurrentBranch.mockResolvedValue('main');
      mockGitOps.getRemotes.mockResolvedValue([]);
      mockPathResolver.toRelative.mockReturnValue('repo1');

      const result = await repoManager.discoverRepositories(projectRoot, {
        exclude: ['.kiro', 'node_modules']
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('repo1');
    });

    it('should throw RepoError when root directory scan fails', async () => {
      // Root directory readdir fails immediately
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      mockGitOps.isGitRepo.mockResolvedValue(false);

      // Should throw RepoError when root scan fails
      await expect(repoManager.discoverRepositories(projectRoot))
        .rejects.toThrow(RepoError);
      
      // Reset and test again for error message
      fs.readdir.mockRejectedValue(new Error('Permission denied'));
      await expect(repoManager.discoverRepositories(projectRoot))
        .rejects.toThrow('Failed to scan directory: Permission denied');
    });
  });

  describe('getRepoStatus', () => {
    const repo = { name: 'test-repo', path: 'repos/test' };

    it('should return status for a clean repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getStatus.mockResolvedValue({
        current: 'main',
        modified: [],
        created: [],
        deleted: [],
        ahead: 0,
        behind: 0,
        isClean: () => true
      });

      const result = await repoManager.getRepoStatus(repo);

      expect(result).toEqual({
        name: 'test-repo',
        path: 'repos/test',
        branch: 'main',
        isClean: true,
        modified: 0,
        added: 0,
        deleted: 0,
        ahead: 0,
        behind: 0,
        error: null
      });
    });

    it('should return status for a dirty repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getStatus.mockResolvedValue({
        current: 'feature/test',
        modified: ['file1.js', 'file2.js'],
        created: ['file3.js'],
        deleted: ['file4.js'],
        ahead: 2,
        behind: 1,
        isClean: () => false
      });

      const result = await repoManager.getRepoStatus(repo);

      expect(result).toEqual({
        name: 'test-repo',
        path: 'repos/test',
        branch: 'feature/test',
        isClean: false,
        modified: 2,
        added: 1,
        deleted: 1,
        ahead: 2,
        behind: 1,
        error: null
      });
    });

    it('should handle path not found error', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await repoManager.getRepoStatus(repo);

      expect(result.error).toBe('Path not found or inaccessible');
      expect(result.branch).toBeNull();
    });

    it('should handle non-Git repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(false);

      const result = await repoManager.getRepoStatus(repo);

      expect(result.error).toBe('Not a Git repository');
      expect(result.branch).toBeNull();
    });

    it('should handle Git operation errors', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getStatus.mockRejectedValue(new Error('Git error'));

      const result = await repoManager.getRepoStatus(repo);

      expect(result.error).toBe('Git error');
      expect(result.branch).toBeNull();
    });
  });

  describe('getAllRepoStatuses', () => {
    it('should return statuses for all repositories', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getStatus.mockResolvedValue({
        current: 'main',
        modified: [],
        created: [],
        deleted: [],
        ahead: 0,
        behind: 0,
        isClean: () => true
      });

      const result = await repoManager.getAllRepoStatuses(repos);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('repo1');
      expect(result[1].name).toBe('repo2');
    });

    it('should continue on individual repository errors', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access
        .mockResolvedValueOnce() // repo1 exists
        .mockRejectedValueOnce(new Error('ENOENT')); // repo2 not found

      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getStatus.mockResolvedValue({
        current: 'main',
        modified: [],
        created: [],
        deleted: [],
        ahead: 0,
        behind: 0,
        isClean: () => true
      });

      const result = await repoManager.getAllRepoStatuses(repos);

      expect(result).toHaveLength(2);
      expect(result[0].error).toBeNull();
      expect(result[1].error).toBe('Path not found or inaccessible');
    });
  });

  describe('execInRepo', () => {
    const repo = { name: 'test-repo', path: 'repos/test' };

    it('should execute command successfully', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.execRaw.mockResolvedValue('command output\n');

      const result = await repoManager.execInRepo(repo, 'log --oneline');

      expect(result).toEqual({
        name: 'test-repo',
        path: 'repos/test',
        command: 'log --oneline',
        success: true,
        output: 'command output',
        error: null,
        exitCode: 0
      });
      expect(mockGitOps.execRaw).toHaveBeenCalledWith(
        '/project/root/repos/test',
        ['log', '--oneline']
      );
    });

    it('should handle path not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await repoManager.execInRepo(repo, 'status');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path not found or inaccessible');
      expect(result.exitCode).toBe(1);
    });

    it('should handle non-Git repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(false);

      const result = await repoManager.execInRepo(repo, 'status');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a Git repository');
    });

    it('should handle command execution failure', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      
      const gitError = new Error('Command failed');
      gitError.exitCode = 128;
      mockGitOps.execRaw.mockRejectedValue(gitError);

      const result = await repoManager.execInRepo(repo, 'invalid command');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
      expect(result.exitCode).toBe(128);
    });

    it('should parse command with multiple arguments', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.execRaw.mockResolvedValue('output');

      await repoManager.execInRepo(repo, 'log --oneline --graph --all');

      expect(mockGitOps.execRaw).toHaveBeenCalledWith(
        '/project/root/repos/test',
        ['log', '--oneline', '--graph', '--all']
      );
    });
  });

  describe('execInAllRepos', () => {
    it('should execute command in all repositories', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.execRaw.mockResolvedValue('output');

      const result = await repoManager.execInAllRepos(repos, 'status');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('repo1');
      expect(result[1].name).toBe('repo2');
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(true);
    });

    it('should continue execution on individual failures', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.execRaw
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('Command failed'));

      const result = await repoManager.execInAllRepos(repos, 'pull');

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
      expect(result[1].error).toBe('Command failed');
    });
  });

  describe('checkRepoHealth', () => {
    const repo = {
      name: 'test-repo',
      path: 'repos/test',
      remote: 'https://github.com/user/repo.git',
      defaultBranch: 'main'
    };

    it('should return healthy status for valid repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ]);
      mockGitOps.isRemoteReachable.mockResolvedValue(true);
      mockGitOps.getCurrentBranch.mockResolvedValue('main');

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.healthy).toBe(true);
      expect(result.checks.pathExists).toBe(true);
      expect(result.checks.isGitRepo).toBe(true);
      expect(result.checks.remoteReachable).toBe(true);
      expect(result.checks.branchExists).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect path not found', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.healthy).toBe(false);
      expect(result.checks.pathExists).toBe(false);
      expect(result.errors).toContain('Path does not exist or is not accessible: repos/test');
    });

    it('should detect non-Git repository', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(false);

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.healthy).toBe(false);
      expect(result.checks.isGitRepo).toBe(false);
      expect(result.errors).toContain('Path is not a valid Git repository: repos/test');
    });

    it('should detect unreachable remote', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ]);
      mockGitOps.isRemoteReachable.mockResolvedValue(false);
      mockGitOps.getCurrentBranch.mockResolvedValue('main');

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.healthy).toBe(true); // Still healthy, just a warning
      expect(result.warnings).toContain('Remote "origin" is not reachable (network issue or invalid URL)');
    });

    it('should detect branch mismatch', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git' } }
      ]);
      mockGitOps.isRemoteReachable.mockResolvedValue(true);
      mockGitOps.getCurrentBranch.mockResolvedValue('feature/test');

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.healthy).toBe(true); // Still healthy, just a warning
      expect(result.warnings).toContain(
        'Current branch "feature/test" differs from configured default branch "main"'
      );
    });

    it('should handle repository without remote configuration', async () => {
      const repoNoRemote = {
        name: 'test-repo',
        path: 'repos/test'
      };

      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);

      const result = await repoManager.checkRepoHealth(repoNoRemote);

      expect(result.checks.remoteReachable).toBeNull();
      expect(result.checks.branchExists).toBeNull();
    });

    it('should detect missing origin remote', async () => {
      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);
      mockGitOps.getRemotes.mockResolvedValue([
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git' } }
      ]);
      mockGitOps.getCurrentBranch.mockResolvedValue('main');

      const result = await repoManager.checkRepoHealth(repo);

      expect(result.warnings).toContain('Remote "origin" is not configured');
    });
  });

  describe('checkAllReposHealth', () => {
    it('should check health of all repositories', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access.mockResolvedValue();
      mockGitOps.isGitRepo.mockResolvedValue(true);

      const result = await repoManager.checkAllReposHealth(repos);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('repo1');
      expect(result[1].name).toBe('repo2');
    });

    it('should continue checking on individual failures', async () => {
      const repos = [
        { name: 'repo1', path: 'repos/repo1' },
        { name: 'repo2', path: 'repos/repo2' }
      ];

      fs.access
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('ENOENT'));

      mockGitOps.isGitRepo.mockResolvedValue(true);

      const result = await repoManager.checkAllReposHealth(repos);

      expect(result).toHaveLength(2);
      expect(result[0].healthy).toBe(true);
      expect(result[1].healthy).toBe(false);
    });
  });
});
