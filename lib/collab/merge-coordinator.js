/**
 * Merge Coordinator - Manages Agent Git branches and merge operations
 *
 * Handles branch creation, conflict detection, auto-merge, and cleanup
 * for multi-Agent parallel coordination. In single-Agent mode, all
 * branch operations are skipped (agents work on the current branch).
 *
 * Branch naming: `agent/{agentId}/{specName}`
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

const { execSync } = require('child_process');
const { MultiAgentConfig } = require('./multi-agent-config');

/** Default options for execSync Git commands */
const EXEC_OPTS = Object.freeze({
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
});

class MergeCoordinator {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   */
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * Execute a Git command in the workspace root.
   * @param {string} command - Git command (without the leading `git `)
   * @returns {string} Trimmed stdout
   * @private
   */
  _git(command) {
    return execSync(`git ${command}`, {
      ...EXEC_OPTS,
      cwd: this._workspaceRoot,
    }).trim();
  }

  /**
   * Whether multi-Agent mode is enabled.
   * In single-Agent mode all branch operations are skipped (Req 4.6).
   * @returns {Promise<boolean>}
   */
  async isMultiAgentMode() {
    return this._multiAgentConfig.isEnabled();
  }

  /**
   * Create an agent-specific branch from the current HEAD.
   * Branch name follows the format `agent/{agentId}/{specName}` (Req 4.1).
   *
   * In single-Agent mode, returns the current branch name without creating
   * a new branch (Req 4.6).
   *
   * @param {string} agentId
   * @param {string} specName
   * @returns {Promise<{branchName: string, created: boolean}>}
   */
  async createAgentBranch(agentId, specName) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      // Single-Agent mode – stay on the current branch (Req 4.6)
      const current = this._getCurrentBranch();
      return { branchName: current, created: false };
    }

    const branchName = `agent/${agentId}/${specName}`;

    try {
      // Check if branch already exists
      this._git(`rev-parse --verify refs/heads/${branchName}`);
      // Branch exists – just switch to it
      this._git(`checkout ${branchName}`);
      return { branchName, created: false };
    } catch (_err) {
      // Branch does not exist – create it from current HEAD
      try {
        this._git(`checkout -b ${branchName}`);
        return { branchName, created: true };
      } catch (createErr) {
        throw new Error(
          `Failed to create agent branch "${branchName}": ${createErr.message}`
        );
      }
    }
  }

  /**
   * Detect merge conflicts between a branch and a target branch (Req 4.2).
   *
   * Uses `git merge --no-commit --no-ff` followed by `git merge --abort`
   * to perform a dry-run merge without altering the working tree permanently.
   *
   * @param {string} branchName - Source branch to merge
   * @param {string} targetBranch - Target branch (e.g. "main")
   * @returns {Promise<{hasConflicts: boolean, files: string[]}>}
   */
  async detectConflicts(branchName, targetBranch) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return { hasConflicts: false, files: [] };
    }

    // Save current branch so we can restore it
    const originalBranch = this._getCurrentBranch();

    try {
      // Switch to target branch for the trial merge
      this._git(`checkout ${targetBranch}`);

      try {
        this._git(`merge --no-commit --no-ff ${branchName}`);
        // Merge succeeded without conflicts – abort to undo
        this._safeAbortMerge();
        return { hasConflicts: false, files: [] };
      } catch (_mergeErr) {
        // Merge had conflicts – collect conflicting files
        const files = this._getConflictFiles();
        this._safeAbortMerge();
        return { hasConflicts: true, files };
      }
    } finally {
      // Always restore the original branch
      try {
        this._git(`checkout ${originalBranch}`);
      } catch (_restoreErr) {
        // Best-effort restore; nothing more we can do
      }
    }
  }

  /**
   * Execute a merge of branchName into targetBranch (Req 4.3, 4.4).
   *
   * When no conflicts exist, performs a fast-forward merge if possible,
   * otherwise creates a merge commit. When conflicts exist, records the
   * conflict details and returns them without modifying the target branch.
   *
   * @param {string} branchName - Source branch to merge
   * @param {string} targetBranch - Target branch
   * @returns {Promise<{success: boolean, strategy: string|null, conflicts: string[]}>}
   */
  async merge(branchName, targetBranch) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return { success: true, strategy: 'single-agent-noop', conflicts: [] };
    }

    const originalBranch = this._getCurrentBranch();

    try {
      this._git(`checkout ${targetBranch}`);

      // Try fast-forward first
      try {
        this._git(`merge --ff-only ${branchName}`);
        return { success: true, strategy: 'fast-forward', conflicts: [] };
      } catch (_ffErr) {
        // Fast-forward not possible – try regular merge
      }

      try {
        this._git(`merge ${branchName} -m "Merge ${branchName} into ${targetBranch}"`);
        return { success: true, strategy: 'merge-commit', conflicts: [] };
      } catch (_mergeErr) {
        // Conflicts detected (Req 4.4)
        const conflicts = this._getConflictFiles();
        this._safeAbortMerge();
        return { success: false, strategy: null, conflicts };
      }
    } finally {
      try {
        this._git(`checkout ${originalBranch}`);
      } catch (_restoreErr) {
        // Best-effort restore
      }
    }
  }

  /**
   * Delete a branch that has already been merged (Req 4.5).
   *
   * Uses `git branch -d` which only succeeds if the branch is fully merged.
   *
   * @param {string} branchName
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async cleanupBranch(branchName) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return { success: true, error: null };
    }

    try {
      this._git(`branch -d ${branchName}`);
      return { success: true, error: null };
    } catch (err) {
      return {
        success: false,
        error: `Failed to delete branch "${branchName}": ${err.message}`,
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Get the name of the currently checked-out branch.
   * @returns {string}
   * @private
   */
  _getCurrentBranch() {
    try {
      return this._git('rev-parse --abbrev-ref HEAD');
    } catch (_err) {
      return 'HEAD'; // detached HEAD or not a git repo
    }
  }

  /**
   * Collect the list of files with merge conflicts from `git diff --name-only --diff-filter=U`.
   * @returns {string[]}
   * @private
   */
  _getConflictFiles() {
    try {
      const output = this._git('diff --name-only --diff-filter=U');
      return output ? output.split('\n').filter(Boolean) : [];
    } catch (_err) {
      return [];
    }
  }

  /**
   * Safely abort a merge in progress. Swallows errors if no merge is active.
   * @private
   */
  _safeAbortMerge() {
    try {
      this._git('merge --abort');
    } catch (_err) {
      // No merge to abort – that's fine
    }
  }
}

module.exports = { MergeCoordinator };
