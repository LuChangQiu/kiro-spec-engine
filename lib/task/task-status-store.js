/**
 * Task Status Store
 *
 * Provides concurrency-safe reads and writes to tasks.md.
 * In multi-Agent mode, uses file-level locks + exponential backoff retry
 * to prevent concurrent write conflicts.
 * In single-Agent mode, delegates directly to the existing TaskClaimer
 * (no locks, no retries) for full backward compatibility.
 *
 * Requirements: 3.1-3.6
 */

const fs = require('fs-extra');
const path = require('path');
const { MultiAgentConfig } = require('../collab/multi-agent-config');
const TaskClaimer = require('./task-claimer');
const fsUtils = require('../utils/fs-utils');

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 100;
const STALE_LOCK_MS = 30000; // 30 seconds

class TaskStatusStore {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   */
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._config = new MultiAgentConfig(workspaceRoot);
    this._claimer = new TaskClaimer();
  }

  /**
   * Whether multi-Agent mode is currently enabled.
   * @returns {Promise<boolean>}
   */
  async isMultiAgentMode() {
    return this._config.isEnabled();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Safely update a task's status in tasks.md.
   *
   * Multi-Agent mode: acquire file lock → verify line → write → release lock.
   * Single-Agent mode: delegate to TaskClaimer.updateTaskStatus().
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} status
   * @param {object} [options]
   * @returns {Promise<object>} UpdateResult
   */
  async updateStatus(specName, taskId, status, _options = {}) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return this._claimer.updateTaskStatus(this._workspaceRoot, specName, taskId, status);
    }

    return this._withLockAndRetry(specName, async () => {
      const tasksPath = this._tasksPath(specName);
      const content = await fs.readFile(tasksPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const tasks = await this._claimer.parseTasks(tasksPath);
      const task = tasks.find(t => t.taskId === taskId);

      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      // Verify target line hasn't been modified (Requirement 3.4)
      if (lines[task.lineNumber] !== task.originalLine) {
        throw new ConflictError(`Target line modified by another agent`);
      }

      // Build new line
      const statusChar = this._claimer.statusToChar(status);
      const optionalMarker = task.isOptional ? '*' : '';
      const linePrefix = task.linePrefix || '- ';
      let newLine = `${linePrefix}[${statusChar}]${optionalMarker} ${taskId} ${task.title}`;
      if (task.claimedBy) {
        newLine += ` [@${task.claimedBy}, claimed: ${task.claimedAt}]`;
      }

      lines[task.lineNumber] = newLine;
      await fsUtils.atomicWrite(tasksPath, lines.join('\n'));

      return { success: true, taskId, oldStatus: task.status, newStatus: status };
    });
  }

  /**
   * Safely claim a task in tasks.md.
   *
   * Multi-Agent mode: acquire file lock → verify line → write → release lock.
   * Single-Agent mode: delegate to TaskClaimer.claimTask().
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} agentId
   * @param {string} username
   * @returns {Promise<object>} ClaimResult
   */
  async claimTask(specName, taskId, agentId, username) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return this._claimer.claimTask(this._workspaceRoot, specName, taskId, username);
    }

    return this._withLockAndRetry(specName, async () => {
      const tasksPath = this._tasksPath(specName);
      const content = await fs.readFile(tasksPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const tasks = await this._claimer.parseTasks(tasksPath);
      const task = tasks.find(t => t.taskId === taskId);

      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      // Verify target line hasn't been modified (Requirement 3.4)
      if (lines[task.lineNumber] !== task.originalLine) {
        throw new ConflictError(`Target line modified by another agent`);
      }

      // Check if already claimed by another user
      if (task.claimedBy && task.claimedBy !== username) {
        return {
          success: false,
          error: `Task already claimed by ${task.claimedBy}`,
          currentClaim: {
            username: task.claimedBy,
            claimedAt: task.claimedAt,
          },
        };
      }

      // Build new line with claim info
      const claimTimestamp = new Date().toISOString();
      const statusChar = this._claimer.statusToChar('in-progress');
      const optionalMarker = task.isOptional ? '*' : '';
      const linePrefix = task.linePrefix || '- ';
      const newLine = `${linePrefix}[${statusChar}]${optionalMarker} ${taskId} ${task.title} [@${username}, claimed: ${claimTimestamp}]`;

      lines[task.lineNumber] = newLine;
      await fsUtils.atomicWrite(tasksPath, lines.join('\n'));

      return {
        success: true,
        taskId,
        agentId,
        username,
        claimedAt: claimTimestamp,
        previousClaim: task.claimedBy
          ? { username: task.claimedBy, claimedAt: task.claimedAt }
          : null,
      };
    });
  }

  /**
   * Safely unclaim a task in tasks.md.
   *
   * Multi-Agent mode: acquire file lock → verify line → write → release lock.
   * Single-Agent mode: delegate to TaskClaimer.unclaimTask().
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} agentId
   * @param {string} username
   * @returns {Promise<object>} UnclaimResult
   */
  async unclaimTask(specName, taskId, agentId, username) {
    const multiAgent = await this.isMultiAgentMode();
    if (!multiAgent) {
      return this._claimer.unclaimTask(this._workspaceRoot, specName, taskId, username);
    }

    return this._withLockAndRetry(specName, async () => {
      const tasksPath = this._tasksPath(specName);
      const content = await fs.readFile(tasksPath, 'utf8');
      const lines = content.split(/\r?\n/);
      const tasks = await this._claimer.parseTasks(tasksPath);
      const task = tasks.find(t => t.taskId === taskId);

      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      // Verify target line hasn't been modified (Requirement 3.4)
      if (lines[task.lineNumber] !== task.originalLine) {
        throw new ConflictError(`Target line modified by another agent`);
      }

      if (!task.claimedBy) {
        return { success: false, error: 'Task is not claimed' };
      }

      if (task.claimedBy !== username) {
        return { success: false, error: `Task is claimed by ${task.claimedBy}, not ${username}` };
      }

      // Build new line without claim info, reset status
      const statusChar = this._claimer.statusToChar('not-started');
      const optionalMarker = task.isOptional ? '*' : '';
      const linePrefix = task.linePrefix || '- ';
      const newLine = `${linePrefix}[${statusChar}]${optionalMarker} ${taskId} ${task.title}`;

      lines[task.lineNumber] = newLine;
      await fsUtils.atomicWrite(tasksPath, lines.join('\n'));

      return {
        success: true,
        taskId,
        agentId,
        username,
        unclaimedAt: new Date().toISOString(),
      };
    });
  }


  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Absolute path to tasks.md for a given spec.
   * @param {string} specName
   * @returns {string}
   */
  _tasksPath(specName) {
    return path.join(this._workspaceRoot, '.sce/specs', specName, 'tasks.md');
  }

  /**
   * Absolute path to the file-level lock for tasks.md.
   * @param {string} specName
   * @returns {string}
   */
  _lockPath(specName) {
    return path.join(this._workspaceRoot, '.sce/specs', specName, 'tasks.md.lock');
  }

  // ---------------------------------------------------------------------------
  // File lock primitives
  // ---------------------------------------------------------------------------

  /**
   * Try to acquire the file-level lock.
   * Uses `wx` (exclusive create) flag so that only one writer can succeed.
   *
   * @param {string} specName
   * @returns {Promise<boolean>} true if lock acquired
   */
  async _acquireLock(specName) {
    const lockFile = this._lockPath(specName);
    const lockData = JSON.stringify({
      acquiredAt: new Date().toISOString(),
    });

    try {
      await fs.writeFile(lockFile, lockData, { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock held – check for staleness
        return this._tryClaimStaleLock(lockFile, lockData);
      }
      throw err;
    }
  }

  /**
   * Release the file-level lock by deleting the lock file.
   * @param {string} specName
   */
  async _releaseLock(specName) {
    const lockFile = this._lockPath(specName);
    try {
      await fs.unlink(lockFile);
    } catch (err) {
      // Ignore ENOENT – lock may have been cleaned up already
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * If the existing lock file is older than STALE_LOCK_MS, delete it and
   * re-attempt acquisition.
   *
   * @param {string} lockFile
   * @param {string} lockData
   * @returns {Promise<boolean>}
   */
  async _tryClaimStaleLock(lockFile, lockData) {
    try {
      const stat = await fs.stat(lockFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > STALE_LOCK_MS) {
        // Stale lock – remove and retry
        await fs.unlink(lockFile);
        try {
          await fs.writeFile(lockFile, lockData, { flag: 'wx' });
          return true;
        } catch (retryErr) {
          // Another agent beat us to it
          if (retryErr.code === 'EEXIST') return false;
          throw retryErr;
        }
      }
    } catch (statErr) {
      // Lock file disappeared between our check and stat – try again
      if (statErr.code === 'ENOENT') {
        try {
          await fs.writeFile(lockFile, lockData, { flag: 'wx' });
          return true;
        } catch (retryErr) {
          if (retryErr.code === 'EEXIST') return false;
          throw retryErr;
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Retry orchestration
  // ---------------------------------------------------------------------------

  /**
   * Execute `fn` while holding the tasks.md file lock.
   * On failure (lock contention or ConflictError), retries with exponential
   * backoff up to MAX_RETRIES times.
   *
   * If `fn` returns a result with `success: false` that is NOT a conflict
   * (e.g. "Task not found"), the result is returned immediately without retry.
   *
   * @param {string} specName
   * @param {Function} fn - async () => result
   * @returns {Promise<object>}
   */
  async _withLockAndRetry(specName, fn) {
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Back off before retrying (skip delay on first attempt)
      if (attempt > 0) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await this._sleep(delayMs);
      }

      let lockAcquired = false;
      try {
        lockAcquired = await this._acquireLock(specName);
        if (!lockAcquired) {
          lastError = new Error('Failed to acquire file lock');
          continue; // retry
        }

        const result = await fn();

        // Non-conflict failures (e.g. task not found) – return immediately
        if (result && result.success === false) {
          return result;
        }

        return result;
      } catch (err) {
        if (err instanceof ConflictError) {
          lastError = err;
          continue; // retry
        }
        // Unexpected error – propagate
        throw err;
      } finally {
        if (lockAcquired) {
          await this._releaseLock(specName);
        }
      }
    }

    // Retries exhausted – return conflict error (Requirement 3.5)
    return {
      success: false,
      error: 'Conflict: retries exhausted, original file preserved',
      conflict: true,
      lastError: lastError ? lastError.message : 'unknown',
    };
  }

  /**
   * Promise-based sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Internal error type for conflict detection
// ---------------------------------------------------------------------------

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

module.exports = { TaskStatusStore, ConflictError };
