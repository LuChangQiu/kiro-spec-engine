const GitOperations = require('../../../lib/repo/git-operations');
const GitError = require('../../../lib/repo/errors/git-error');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

// Mock simple-git
jest.mock('simple-git');

// Mock fs.promises.stat
jest.mock('fs', () => {
  const originalModule = jest.requireActual('fs');
  return {
    ...originalModule,
    promises: {
      ...originalModule.promises,
      stat: jest.fn()
    }
  };
});

const mockStat = fs.promises.stat;

describe('GitOperations', () => {
  let gitOps;
  let mockGit;

  beforeEach(() => {
    gitOps = new GitOperations();
    
    // Create mock git instance
    mockGit = {
      revparse: jest.fn(),
      status: jest.fn(),
      getRemotes: jest.fn(),
      listRemote: jest.fn(),
      raw: jest.fn()
    };
    
    simpleGit.mockReturnValue(mockGit);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createGitInstance', () => {
    it('should create a simple-git instance for the given path', () => {
      const repoPath = '/path/to/repo';
      const result = gitOps.createGitInstance(repoPath);
      
      expect(simpleGit).toHaveBeenCalledWith(repoPath);
      expect(result).toBe(mockGit);
    });
  });

  describe('isGitRepo', () => {
    it('should return true for a valid Git repository', async () => {
      // Mock .git directory exists and is a directory
      mockStat.mockResolvedValue({
        isDirectory: () => true
      });
      mockGit.revparse.mockResolvedValue('.git');
      
      const result = await gitOps.isGitRepo('/path/to/repo');
      
      expect(result).toBe(true);
      expect(mockStat).toHaveBeenCalledWith(path.join('/path/to/repo', '.git'));
      expect(mockGit.revparse).toHaveBeenCalledWith(['--git-dir']);
    });

    it('should return false for a directory without .git', async () => {
      // Mock .git directory does not exist
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      const result = await gitOps.isGitRepo('/path/to/non-repo');
      
      expect(result).toBe(false);
      expect(mockStat).toHaveBeenCalledWith(path.join('/path/to/non-repo', '.git'));
    });

    it('should return false for a directory with .git file (Git worktree)', async () => {
      // Mock .git exists but is a file, not a directory
      mockStat.mockResolvedValue({
        isDirectory: () => false
      });
      
      const result = await gitOps.isGitRepo('/path/to/worktree');
      
      expect(result).toBe(false);
      expect(mockStat).toHaveBeenCalledWith(path.join('/path/to/worktree', '.git'));
    });

    it('should return false for inaccessible .git directory', async () => {
      // Mock permission denied
      mockStat.mockRejectedValue(new Error('EACCES: permission denied'));
      
      const result = await gitOps.isGitRepo('/path/to/restricted');
      
      expect(result).toBe(false);
    });

    it('should return true even if git command fails but .git directory exists', async () => {
      // Mock .git directory exists
      mockStat.mockResolvedValue({
        isDirectory: () => true
      });
      // Mock git command fails (corrupted repo)
      mockGit.revparse.mockRejectedValue(new Error('Not a git repository'));
      
      const result = await gitOps.isGitRepo('/path/to/corrupted-repo');
      
      expect(result).toBe(true);
      expect(mockStat).toHaveBeenCalledWith(path.join('/path/to/corrupted-repo', '.git'));
    });

    it('should return false for a non-existent path', async () => {
      mockStat.mockRejectedValue(new Error('Path does not exist'));
      
      const result = await gitOps.isGitRepo('/non/existent/path');
      
      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return status summary for a repository', async () => {
      const mockStatus = {
        current: 'main',
        modified: ['file1.js'],
        created: ['file2.js'],
        deleted: [],
        ahead: 1,
        behind: 0
      };
      mockGit.status.mockResolvedValue(mockStatus);
      
      const result = await gitOps.getStatus('/path/to/repo');
      
      expect(result).toEqual(mockStatus);
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should throw GitError when status retrieval fails', async () => {
      mockGit.status.mockRejectedValue(new Error('Git error'));
      
      await expect(gitOps.getStatus('/path/to/repo'))
        .rejects.toThrow(GitError);
    });

    it('should include error details in GitError', async () => {
      const errorMessage = 'fatal: not a git repository';
      mockGit.status.mockRejectedValue(new Error(errorMessage));
      
      try {
        await gitOps.getStatus('/path/to/repo');
        fail('Should have thrown GitError');
      } catch (error) {
        expect(error).toBeInstanceOf(GitError);
        expect(error.command).toBe('status');
        expect(error.details).toBe(errorMessage);
      }
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      mockGit.status.mockResolvedValue({ current: 'main' });
      
      const result = await gitOps.getCurrentBranch('/path/to/repo');
      
      expect(result).toBe('main');
    });

    it('should return feature branch name', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature/new-feature' });
      
      const result = await gitOps.getCurrentBranch('/path/to/repo');
      
      expect(result).toBe('feature/new-feature');
    });

    it('should throw GitError when branch retrieval fails', async () => {
      mockGit.status.mockRejectedValue(new Error('Git error'));
      
      await expect(gitOps.getCurrentBranch('/path/to/repo'))
        .rejects.toThrow(GitError);
    });
  });

  describe('getRemoteUrl', () => {
    it('should return remote URL for origin', async () => {
      const mockRemotes = [
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git', push: 'https://github.com/user/repo.git' } }
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);
      
      const result = await gitOps.getRemoteUrl('/path/to/repo', 'origin');
      
      expect(result).toBe('https://github.com/user/repo.git');
    });

    it('should return null when remote does not exist', async () => {
      mockGit.getRemotes.mockResolvedValue([]);
      
      const result = await gitOps.getRemoteUrl('/path/to/repo', 'origin');
      
      expect(result).toBeNull();
    });

    it('should use origin as default remote name', async () => {
      const mockRemotes = [
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git', push: 'https://github.com/user/repo.git' } }
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);
      
      const result = await gitOps.getRemoteUrl('/path/to/repo');
      
      expect(result).toBe('https://github.com/user/repo.git');
    });

    it('should return URL for custom remote name', async () => {
      const mockRemotes = [
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git', push: 'https://github.com/org/repo.git' } }
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);
      
      const result = await gitOps.getRemoteUrl('/path/to/repo', 'upstream');
      
      expect(result).toBe('https://github.com/org/repo.git');
    });

    it('should throw GitError when remote retrieval fails', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Git error'));
      
      await expect(gitOps.getRemoteUrl('/path/to/repo'))
        .rejects.toThrow(GitError);
    });
  });

  describe('getRemotes', () => {
    it('should return all remotes', async () => {
      const mockRemotes = [
        { name: 'origin', refs: { fetch: 'https://github.com/user/repo.git', push: 'https://github.com/user/repo.git' } },
        { name: 'upstream', refs: { fetch: 'https://github.com/org/repo.git', push: 'https://github.com/org/repo.git' } }
      ];
      mockGit.getRemotes.mockResolvedValue(mockRemotes);
      
      const result = await gitOps.getRemotes('/path/to/repo');
      
      expect(result).toEqual(mockRemotes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no remotes exist', async () => {
      mockGit.getRemotes.mockResolvedValue([]);
      
      const result = await gitOps.getRemotes('/path/to/repo');
      
      expect(result).toEqual([]);
    });

    it('should throw GitError when remotes retrieval fails', async () => {
      mockGit.getRemotes.mockRejectedValue(new Error('Git error'));
      
      await expect(gitOps.getRemotes('/path/to/repo'))
        .rejects.toThrow(GitError);
    });
  });

  describe('isRemoteReachable', () => {
    it('should return true when remote is reachable', async () => {
      mockGit.listRemote.mockResolvedValue('refs/heads/main');
      
      const result = await gitOps.isRemoteReachable('/path/to/repo', 'origin');
      
      expect(result).toBe(true);
      expect(mockGit.listRemote).toHaveBeenCalledWith(['origin']);
    });

    it('should return false when remote is not reachable', async () => {
      mockGit.listRemote.mockRejectedValue(new Error('Network error'));
      
      const result = await gitOps.isRemoteReachable('/path/to/repo', 'origin');
      
      expect(result).toBe(false);
    });

    it('should use origin as default remote name', async () => {
      mockGit.listRemote.mockResolvedValue('refs/heads/main');
      
      await gitOps.isRemoteReachable('/path/to/repo');
      
      expect(mockGit.listRemote).toHaveBeenCalledWith(['origin']);
    });

    it('should return false for invalid remote name', async () => {
      mockGit.listRemote.mockRejectedValue(new Error('Remote not found'));
      
      const result = await gitOps.isRemoteReachable('/path/to/repo', 'invalid');
      
      expect(result).toBe(false);
    });
  });

  describe('execRaw', () => {
    it('should execute raw Git command', async () => {
      mockGit.raw.mockResolvedValue('command output');
      
      const result = await gitOps.execRaw('/path/to/repo', ['log', '--oneline']);
      
      expect(result).toBe('command output');
      expect(mockGit.raw).toHaveBeenCalledWith(['log', '--oneline']);
    });

    it('should throw GitError when command fails', async () => {
      mockGit.raw.mockRejectedValue(new Error('Command failed'));
      
      await expect(gitOps.execRaw('/path/to/repo', ['invalid', 'command']))
        .rejects.toThrow(GitError);
    });

    it('should include command in error message', async () => {
      mockGit.raw.mockRejectedValue(new Error('Command failed'));
      
      try {
        await gitOps.execRaw('/path/to/repo', ['log', '--invalid-flag']);
        fail('Should have thrown GitError');
      } catch (error) {
        expect(error).toBeInstanceOf(GitError);
        expect(error.message).toContain('git log --invalid-flag');
        expect(error.command).toBe('git log --invalid-flag');
      }
    });

    it('should preserve exit code in error', async () => {
      const gitError = new Error('Command failed');
      gitError.exitCode = 128;
      mockGit.raw.mockRejectedValue(gitError);
      
      try {
        await gitOps.execRaw('/path/to/repo', ['log']);
        fail('Should have thrown GitError');
      } catch (error) {
        expect(error).toBeInstanceOf(GitError);
        expect(error.exitCode).toBe(128);
      }
    });
  });
});
