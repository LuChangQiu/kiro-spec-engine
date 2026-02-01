const ConfigError = require('../../../lib/repo/errors/config-error');
const RepoError = require('../../../lib/repo/errors/repo-error');
const GitError = require('../../../lib/repo/errors/git-error');

describe('Error Classes', () => {
  describe('ConfigError', () => {
    it('should create error with message', () => {
      const error = new ConfigError('Configuration is invalid');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.name).toBe('ConfigError');
      expect(error.message).toBe('Configuration is invalid');
      expect(error.details).toBeNull();
    });

    it('should create error with details', () => {
      const details = { field: 'name', reason: 'missing' };
      const error = new ConfigError('Configuration is invalid', details);
      expect(error.message).toBe('Configuration is invalid');
      expect(error.details).toEqual(details);
    });

    it('should have stack trace', () => {
      const error = new ConfigError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConfigError');
    });
  });

  describe('RepoError', () => {
    it('should create error with message', () => {
      const error = new RepoError('Repository operation failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RepoError);
      expect(error.name).toBe('RepoError');
      expect(error.message).toBe('Repository operation failed');
      expect(error.repoName).toBeNull();
      expect(error.details).toBeNull();
    });

    it('should create error with repo name', () => {
      const error = new RepoError('Repository not found', 'my-repo');
      expect(error.message).toBe('Repository not found');
      expect(error.repoName).toBe('my-repo');
    });

    it('should create error with repo name and details', () => {
      const details = { path: '/path/to/repo' };
      const error = new RepoError('Repository not found', 'my-repo', details);
      expect(error.repoName).toBe('my-repo');
      expect(error.details).toEqual(details);
    });

    it('should have stack trace', () => {
      const error = new RepoError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('RepoError');
    });
  });

  describe('GitError', () => {
    it('should create error with message', () => {
      const error = new GitError('Git command failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GitError);
      expect(error.name).toBe('GitError');
      expect(error.message).toBe('Git command failed');
      expect(error.command).toBeNull();
      expect(error.exitCode).toBeNull();
      expect(error.details).toBeNull();
    });

    it('should create error with command', () => {
      const error = new GitError('Git command failed', 'git status');
      expect(error.message).toBe('Git command failed');
      expect(error.command).toBe('git status');
    });

    it('should create error with command and exit code', () => {
      const error = new GitError('Git command failed', 'git push', 128);
      expect(error.command).toBe('git push');
      expect(error.exitCode).toBe(128);
    });

    it('should create error with all parameters', () => {
      const details = { stderr: 'Permission denied' };
      const error = new GitError('Git command failed', 'git push', 128, details);
      expect(error.message).toBe('Git command failed');
      expect(error.command).toBe('git push');
      expect(error.exitCode).toBe(128);
      expect(error.details).toEqual(details);
    });

    it('should have stack trace', () => {
      const error = new GitError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('GitError');
    });
  });
});
