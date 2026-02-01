const fs = require('fs').promises;
const path = require('path');
const GitOperations = require('./git-operations');
const PathResolver = require('./path-resolver');
const RepoError = require('./errors/repo-error');

/**
 * RepoManager - Orchestrates operations across multiple repositories
 * 
 * Provides high-level operations for repository discovery, status checking,
 * command execution, and health diagnostics across multiple Git repositories.
 */
class RepoManager {
  /**
   * Create a new RepoManager
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    if (!projectRoot) {
      throw new Error('Project root is required');
    }
    this.projectRoot = projectRoot;
    this.gitOps = new GitOperations();
    this.pathResolver = new PathResolver();
  }

  /**
   * Scan directory for Git repositories
   * @param {string} rootPath - Root path to scan
   * @param {Object} options - Scan options
   * @param {number} options.maxDepth - Maximum depth to scan (default: 3)
   * @param {string[]} options.exclude - Directories to exclude (default: ['.kiro'])
   * @returns {Promise<Array<{path: string, name: string, remote: string|null, branch: string, hasRemote: boolean}>>}
   */
  async discoverRepositories(rootPath, options = {}) {
    const maxDepth = options.maxDepth || 3;
    const exclude = options.exclude || ['.kiro'];
    
    const discovered = [];
    
    try {
      await this._scanDirectory(rootPath, rootPath, 0, maxDepth, exclude, discovered);
    } catch (error) {
      throw new RepoError(
        `Failed to scan directory: ${error.message}`,
        null,
        { rootPath, error: error.message }
      );
    }
    
    return discovered;
  }

  /**
   * Recursively scan directory for Git repositories
   * @private
   */
  async _scanDirectory(currentPath, rootPath, depth, maxDepth, exclude, discovered) {
    // Check depth limit
    if (depth > maxDepth) {
      return;
    }

    // Check if current directory should be excluded
    const dirName = path.basename(currentPath);
    if (exclude.includes(dirName)) {
      return;
    }

    // Check if current directory is a Git repository
    const isRepo = await this.gitOps.isGitRepo(currentPath);
    
    if (isRepo) {
      // Extract repository information
      try {
        const branch = await this.gitOps.getCurrentBranch(currentPath);
        const remotes = await this.gitOps.getRemotes(currentPath);
        
        // Select remote: prefer 'origin', otherwise use first available
        let remoteUrl = null;
        let hasRemote = false;
        
        if (remotes.length > 0) {
          hasRemote = true;
          const originRemote = remotes.find(r => r.name === 'origin');
          if (originRemote) {
            remoteUrl = originRemote.refs.fetch;
          } else {
            remoteUrl = remotes[0].refs.fetch;
          }
        }
        
        // Generate repository name from path
        const relativePath = this.pathResolver.toRelative(currentPath, rootPath);
        const repoName = relativePath === '.' ? path.basename(rootPath) : relativePath.replace(/\//g, '-');
        
        discovered.push({
          path: relativePath,
          name: repoName,
          remote: remoteUrl,
          branch: branch,
          hasRemote: hasRemote
        });
        
        // Don't scan subdirectories of a Git repository
        return;
      } catch (error) {
        // If we can't get repo info, skip this directory
        return;
      }
    }

    // Scan subdirectories
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(currentPath, entry.name);
        await this._scanDirectory(subPath, rootPath, depth + 1, maxDepth, exclude, discovered);
      }
    }
  }

  /**
   * Get status for a single repository
   * @param {Object} repo - Repository configuration
   * @param {string} repo.name - Repository name
   * @param {string} repo.path - Repository path
   * @returns {Promise<Object>} Repository status
   */
  async getRepoStatus(repo) {
    const repoPath = this.pathResolver.resolvePath(repo.path, this.projectRoot);
    
    try {
      // Check if path exists
      try {
        await fs.access(repoPath);
      } catch (error) {
        return {
          name: repo.name,
          path: repo.path,
          branch: null,
          isClean: false,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: 'Path not found or inaccessible'
        };
      }

      // Check if it's a Git repository
      const isRepo = await this.gitOps.isGitRepo(repoPath);
      if (!isRepo) {
        return {
          name: repo.name,
          path: repo.path,
          branch: null,
          isClean: false,
          modified: 0,
          added: 0,
          deleted: 0,
          ahead: 0,
          behind: 0,
          error: 'Not a Git repository'
        };
      }

      // Get status
      const status = await this.gitOps.getStatus(repoPath);
      
      return {
        name: repo.name,
        path: repo.path,
        branch: status.current,
        isClean: status.isClean(),
        modified: status.modified.length,
        added: status.created.length,
        deleted: status.deleted.length,
        ahead: status.ahead,
        behind: status.behind,
        error: null
      };
    } catch (error) {
      return {
        name: repo.name,
        path: repo.path,
        branch: null,
        isClean: false,
        modified: 0,
        added: 0,
        deleted: 0,
        ahead: 0,
        behind: 0,
        error: error.message
      };
    }
  }

  /**
   * Get status for all repositories
   * @param {Array<Object>} repos - Array of repository configurations
   * @returns {Promise<Array<Object>>} Array of repository statuses
   */
  async getAllRepoStatuses(repos) {
    const statuses = [];
    
    for (const repo of repos) {
      const status = await this.getRepoStatus(repo);
      statuses.push(status);
    }
    
    return statuses;
  }

  /**
   * Execute command in a repository
   * @param {Object} repo - Repository configuration
   * @param {string} command - Git command to execute (without 'git' prefix)
   * @returns {Promise<Object>} Execution result
   */
  async execInRepo(repo, command) {
    const repoPath = this.pathResolver.resolvePath(repo.path, this.projectRoot);
    
    try {
      // Check if path exists and is a Git repository
      try {
        await fs.access(repoPath);
      } catch (error) {
        return {
          name: repo.name,
          path: repo.path,
          command: command,
          success: false,
          output: '',
          error: 'Path not found or inaccessible',
          exitCode: 1
        };
      }

      const isRepo = await this.gitOps.isGitRepo(repoPath);
      if (!isRepo) {
        return {
          name: repo.name,
          path: repo.path,
          command: command,
          success: false,
          output: '',
          error: 'Not a Git repository',
          exitCode: 1
        };
      }

      // Parse command into arguments
      const args = command.trim().split(/\s+/);
      
      // Execute command
      const output = await this.gitOps.execRaw(repoPath, args);
      
      return {
        name: repo.name,
        path: repo.path,
        command: command,
        success: true,
        output: output.trim(),
        error: null,
        exitCode: 0
      };
    } catch (error) {
      return {
        name: repo.name,
        path: repo.path,
        command: command,
        success: false,
        output: '',
        error: error.message,
        exitCode: error.exitCode || 1
      };
    }
  }

  /**
   * Execute command in all repositories
   * @param {Array<Object>} repos - Array of repository configurations
   * @param {string} command - Git command to execute
   * @returns {Promise<Array<Object>>} Array of execution results
   */
  async execInAllRepos(repos, command) {
    const results = [];
    
    for (const repo of repos) {
      const result = await this.execInRepo(repo, command);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Perform health check on a repository
   * @param {Object} repo - Repository configuration
   * @param {string} repo.name - Repository name
   * @param {string} repo.path - Repository path
   * @param {string} [repo.remote] - Remote URL
   * @param {string} [repo.defaultBranch] - Default branch name
   * @returns {Promise<Object>} Health check result
   */
  async checkRepoHealth(repo) {
    const repoPath = this.pathResolver.resolvePath(repo.path, this.projectRoot);
    const checks = {
      pathExists: false,
      isGitRepo: false,
      remoteReachable: null,
      branchExists: null
    };
    const errors = [];
    const warnings = [];

    // Check 1: Path exists
    try {
      await fs.access(repoPath);
      checks.pathExists = true;
    } catch (error) {
      errors.push(`Path does not exist or is not accessible: ${repo.path}`);
      return {
        name: repo.name,
        path: repo.path,
        checks,
        errors,
        warnings,
        healthy: false
      };
    }

    // Check 2: Is Git repository
    try {
      checks.isGitRepo = await this.gitOps.isGitRepo(repoPath);
      if (!checks.isGitRepo) {
        errors.push(`Path is not a valid Git repository: ${repo.path}`);
        return {
          name: repo.name,
          path: repo.path,
          checks,
          errors,
          warnings,
          healthy: false
        };
      }
    } catch (error) {
      errors.push(`Failed to verify Git repository: ${error.message}`);
      return {
        name: repo.name,
        path: repo.path,
        checks,
        errors,
        warnings,
        healthy: false
      };
    }

    // Check 3: Remote reachable (if remote is configured)
    if (repo.remote) {
      try {
        const remotes = await this.gitOps.getRemotes(repoPath);
        const hasOrigin = remotes.some(r => r.name === 'origin');
        
        if (hasOrigin) {
          checks.remoteReachable = await this.gitOps.isRemoteReachable(repoPath, 'origin');
          if (!checks.remoteReachable) {
            warnings.push('Remote "origin" is not reachable (network issue or invalid URL)');
          }
        } else {
          checks.remoteReachable = false;
          warnings.push('Remote "origin" is not configured');
        }
      } catch (error) {
        checks.remoteReachable = false;
        warnings.push(`Failed to check remote: ${error.message}`);
      }
    }

    // Check 4: Default branch exists (if configured)
    if (repo.defaultBranch) {
      try {
        const currentBranch = await this.gitOps.getCurrentBranch(repoPath);
        checks.branchExists = currentBranch === repo.defaultBranch;
        
        if (!checks.branchExists) {
          warnings.push(
            `Current branch "${currentBranch}" differs from configured default branch "${repo.defaultBranch}"`
          );
        }
      } catch (error) {
        checks.branchExists = false;
        warnings.push(`Failed to check branch: ${error.message}`);
      }
    }

    const healthy = errors.length === 0;

    return {
      name: repo.name,
      path: repo.path,
      checks,
      errors,
      warnings,
      healthy
    };
  }

  /**
   * Perform health check on all repositories
   * @param {Array<Object>} repos - Array of repository configurations
   * @returns {Promise<Array<Object>>} Array of health check results
   */
  async checkAllReposHealth(repos) {
    const results = [];
    
    for (const repo of repos) {
      const result = await this.checkRepoHealth(repo);
      results.push(result);
    }
    
    return results;
  }
}

module.exports = RepoManager;
