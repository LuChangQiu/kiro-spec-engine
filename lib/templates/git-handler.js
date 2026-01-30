/**
 * GitHandler - Handles Git operations for template repositories
 * 
 * Provides functionality for cloning, updating, and managing Git repositories
 * containing template libraries.
 */

const { execSync, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { GitError } = require('./template-error');

class GitHandler {
  constructor() {
    this.gitAvailable = null;
  }

  /**
   * Checks if Git is installed and available
   * 
   * @returns {boolean} True if Git is available
   */
  isGitInstalled() {
    if (this.gitAvailable !== null) {
      return this.gitAvailable;
    }

    try {
      execSync('git --version', { stdio: 'ignore' });
      this.gitAvailable = true;
      return true;
    } catch (error) {
      this.gitAvailable = false;
      return false;
    }
  }

  /**
   * Clones a Git repository
   * 
   * @param {string} url - Repository URL
   * @param {string} targetPath - Local path to clone to
   * @param {Object} options - Clone options
   * @param {boolean} options.shallow - Use shallow clone (--depth 1)
   * @param {string} options.branch - Branch to clone
   * @returns {Promise<void>}
   */
  async cloneRepository(url, targetPath, options = {}) {
    const { shallow = true, branch = null } = options;

    // Check Git installation
    if (!this.isGitInstalled()) {
      throw new GitError(
        'Git is not installed or not in PATH',
        {
          url,
          targetPath,
          suggestion: 'Install Git from https://git-scm.com/'
        }
      );
    }

    // Ensure target directory doesn't exist
    if (await fs.pathExists(targetPath)) {
      throw new GitError(
        'Target directory already exists',
        {
          targetPath,
          suggestion: 'Remove the directory or choose a different path'
        }
      );
    }

    // Build clone command
    let command = 'git clone';
    
    if (shallow) {
      command += ' --depth 1';
    }
    
    if (branch) {
      command += ` --branch ${branch}`;
    }
    
    command += ` "${url}" "${targetPath}"`;

    // Execute clone
    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          // Classify error type
          const errorMessage = stderr || error.message;
          
          if (errorMessage.includes('Authentication failed') || 
              errorMessage.includes('could not read Username')) {
            reject(new GitError(
              'Git authentication failed',
              {
                url,
                error: errorMessage,
                suggestion: 'Check repository URL and authentication credentials'
              }
            ));
          } else if (errorMessage.includes('Repository not found') ||
                     errorMessage.includes('not found')) {
            reject(new GitError(
              'Repository not found',
              {
                url,
                error: errorMessage,
                suggestion: 'Verify the repository URL is correct'
              }
            ));
          } else if (errorMessage.includes('Connection') ||
                     errorMessage.includes('network') ||
                     errorMessage.includes('timeout')) {
            reject(new GitError(
              'Network error during clone',
              {
                url,
                error: errorMessage,
                suggestion: 'Check your internet connection and try again'
              }
            ));
          } else {
            reject(new GitError(
              'Git clone failed',
              {
                url,
                targetPath,
                error: errorMessage
              }
            ));
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Checks if a directory is a Git repository
   * 
   * @param {string} repoPath - Path to check
   * @returns {Promise<boolean>}
   */
  async isGitRepository(repoPath) {
    const gitDir = path.join(repoPath, '.git');
    return await fs.pathExists(gitDir);
  }

  /**
   * Gets the remote URL of a Git repository
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<string>} Remote URL
   */
  async getRemoteUrl(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    try {
      const url = execSync('git remote get-url origin', {
        cwd: repoPath,
        encoding: 'utf8'
      }).trim();
      
      return url;
    } catch (error) {
      throw new GitError(
        'Failed to get remote URL',
        {
          repoPath,
          error: error.message
        }
      );
    }
  }

  /**
   * Gets the current commit hash
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<string>} Commit hash
   */
  async getCurrentCommit(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    try {
      const hash = execSync('git rev-parse HEAD', {
        cwd: repoPath,
        encoding: 'utf8'
      }).trim();
      
      return hash;
    } catch (error) {
      throw new GitError(
        'Failed to get current commit',
        {
          repoPath,
          error: error.message
        }
      );
    }
  }

  /**
   * Pulls latest changes from remote
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<void>}
   */
  async pullUpdates(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    return new Promise((resolve, reject) => {
      exec('git pull', { cwd: repoPath }, (error, stdout, stderr) => {
        if (error) {
          const errorMessage = stderr || error.message;
          
          if (errorMessage.includes('conflict') || errorMessage.includes('CONFLICT')) {
            reject(new GitError(
              'Merge conflict during pull',
              {
                repoPath,
                error: errorMessage,
                suggestion: 'Resolve conflicts manually or clear cache and re-download'
              }
            ));
          } else if (errorMessage.includes('Authentication') || 
                     errorMessage.includes('Permission denied')) {
            reject(new GitError(
              'Authentication failed during pull',
              {
                repoPath,
                error: errorMessage,
                suggestion: 'Check repository access permissions'
              }
            ));
          } else {
            reject(new GitError(
              'Git pull failed',
              {
                repoPath,
                error: errorMessage
              }
            ));
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Checks out a specific version (tag or commit)
   * 
   * @param {string} repoPath - Repository path
   * @param {string} version - Tag name or commit hash
   * @returns {Promise<void>}
   */
  async checkoutVersion(repoPath, version) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    return new Promise((resolve, reject) => {
      exec(`git checkout ${version}`, { cwd: repoPath }, (error, stdout, stderr) => {
        if (error) {
          const errorMessage = stderr || error.message;
          
          if (errorMessage.includes('did not match') || 
              errorMessage.includes('pathspec')) {
            reject(new GitError(
              'Version not found',
              {
                repoPath,
                version,
                error: errorMessage,
                suggestion: 'Check that the tag or commit exists'
              }
            ));
          } else {
            reject(new GitError(
              'Git checkout failed',
              {
                repoPath,
                version,
                error: errorMessage
              }
            ));
          }
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Gets list of available tags
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<string[]>} Array of tag names
   */
  async getTags(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    try {
      const output = execSync('git tag', {
        cwd: repoPath,
        encoding: 'utf8'
      });
      
      const tags = output.trim().split('\n').filter(tag => tag.length > 0);
      return tags;
    } catch (error) {
      throw new GitError(
        'Failed to get tags',
        {
          repoPath,
          error: error.message
        }
      );
    }
  }

  /**
   * Gets the current branch name
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<string>} Branch name
   */
  async getCurrentBranch(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath,
        encoding: 'utf8'
      }).trim();
      
      return branch;
    } catch (error) {
      throw new GitError(
        'Failed to get current branch',
        {
          repoPath,
          error: error.message
        }
      );
    }
  }

  /**
   * Validates repository structure
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Validation result
   */
  async validateRepository(repoPath) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check if it's a Git repository
    if (!await this.isGitRepository(repoPath)) {
      result.valid = false;
      result.errors.push('Not a Git repository');
      return result;
    }

    // Check if template-registry.json exists
    const registryPath = path.join(repoPath, 'template-registry.json');
    if (!await fs.pathExists(registryPath)) {
      result.valid = false;
      result.errors.push('Missing template-registry.json');
    }

    // Check if README.md exists
    const readmePath = path.join(repoPath, 'README.md');
    if (!await fs.pathExists(readmePath)) {
      result.warnings.push('Missing README.md');
    }

    // Check if CONTRIBUTING.md exists
    const contributingPath = path.join(repoPath, 'CONTRIBUTING.md');
    if (!await fs.pathExists(contributingPath)) {
      result.warnings.push('Missing CONTRIBUTING.md');
    }

    return result;
  }

  /**
   * Gets repository version information
   * 
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Version info
   */
  async getRepoVersion(repoPath) {
    if (!await this.isGitRepository(repoPath)) {
      throw new GitError(
        'Not a Git repository',
        { repoPath }
      );
    }

    const commit = await this.getCurrentCommit(repoPath);
    const branch = await this.getCurrentBranch(repoPath);
    const tags = await this.getTags(repoPath);

    // Find if current commit has a tag
    let currentTag = null;
    for (const tag of tags) {
      try {
        const tagCommit = execSync(`git rev-list -n 1 ${tag}`, {
          cwd: repoPath,
          encoding: 'utf8'
        }).trim();
        
        if (tagCommit === commit) {
          currentTag = tag;
          break;
        }
      } catch (error) {
        // Ignore errors for individual tags
      }
    }

    return {
      commit,
      branch,
      tag: currentTag,
      allTags: tags
    };
  }
}

module.exports = GitHandler;
