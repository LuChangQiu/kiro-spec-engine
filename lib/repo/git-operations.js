const simpleGit = require('simple-git');
const GitError = require('./errors/git-error');

/**
 * GitOperations - Low-level Git operations wrapper around simple-git
 * 
 * Provides a clean interface for Git operations with consistent error handling
 * and cross-platform compatibility.
 */
class GitOperations {
  /**
   * Create a simple-git instance for a repository
   * @param {string} repoPath - Path to the Git repository
   * @returns {SimpleGit} Configured simple-git instance
   */
  createGitInstance(repoPath) {
    return simpleGit(repoPath);
  }

  /**
   * Check if path is a valid Git repository
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if path contains a valid Git repository
   */
  async isGitRepo(path) {
    try {
      const git = this.createGitInstance(path);
      await git.revparse(['--git-dir']);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get repository status
   * @param {string} repoPath - Path to the Git repository
   * @returns {Promise<StatusSummary>} Status summary from simple-git
   * @throws {GitError} If status retrieval fails
   */
  async getStatus(repoPath) {
    try {
      const git = this.createGitInstance(repoPath);
      return await git.status();
    } catch (error) {
      throw new GitError(
        `Failed to get status for repository at ${repoPath}`,
        'status',
        null,
        error.message
      );
    }
  }

  /**
   * Get current branch name
   * @param {string} repoPath - Path to the Git repository
   * @returns {Promise<string>} Current branch name
   * @throws {GitError} If branch retrieval fails
   */
  async getCurrentBranch(repoPath) {
    try {
      const git = this.createGitInstance(repoPath);
      const status = await git.status();
      return status.current;
    } catch (error) {
      throw new GitError(
        `Failed to get current branch for repository at ${repoPath}`,
        'branch',
        null,
        error.message
      );
    }
  }

  /**
   * Get remote URL
   * @param {string} repoPath - Path to the Git repository
   * @param {string} remoteName - Name of the remote (default: 'origin')
   * @returns {Promise<string|null>} Remote URL or null if remote doesn't exist
   * @throws {GitError} If remote retrieval fails
   */
  async getRemoteUrl(repoPath, remoteName = 'origin') {
    try {
      const git = this.createGitInstance(repoPath);
      const remotes = await git.getRemotes(true);
      const remote = remotes.find(r => r.name === remoteName);
      return remote ? remote.refs.fetch : null;
    } catch (error) {
      throw new GitError(
        `Failed to get remote URL for ${remoteName} in repository at ${repoPath}`,
        'remote',
        null,
        error.message
      );
    }
  }

  /**
   * Get all remotes
   * @param {string} repoPath - Path to the Git repository
   * @returns {Promise<Array<{name: string, refs: {fetch: string, push: string}}>>} Array of remotes
   * @throws {GitError} If remotes retrieval fails
   */
  async getRemotes(repoPath) {
    try {
      const git = this.createGitInstance(repoPath);
      return await git.getRemotes(true);
    } catch (error) {
      throw new GitError(
        `Failed to get remotes for repository at ${repoPath}`,
        'remote',
        null,
        error.message
      );
    }
  }

  /**
   * Check if remote is reachable
   * @param {string} repoPath - Path to the Git repository
   * @param {string} remoteName - Name of the remote (default: 'origin')
   * @returns {Promise<boolean>} True if remote is reachable
   */
  async isRemoteReachable(repoPath, remoteName = 'origin') {
    try {
      const git = this.createGitInstance(repoPath);
      // Use ls-remote to check if remote is reachable
      await git.listRemote([remoteName]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute raw Git command
   * @param {string} repoPath - Path to the Git repository
   * @param {string[]} args - Git command arguments
   * @returns {Promise<string>} Command output
   * @throws {GitError} If command execution fails
   */
  async execRaw(repoPath, args) {
    try {
      const git = this.createGitInstance(repoPath);
      const result = await git.raw(args);
      return result;
    } catch (error) {
      throw new GitError(
        `Failed to execute git command: git ${args.join(' ')}`,
        `git ${args.join(' ')}`,
        error.exitCode || null,
        error.message
      );
    }
  }
}

module.exports = GitOperations;
