/**
 * TaskLockManager - Task-level fine-grained lock manager
 *
 * Provides per-task locking instead of per-Spec locking, allowing multiple
 * Agents to work on different tasks within the same Spec concurrently.
 *
 * Lock file path: `.kiro/specs/{specName}/locks/{taskId}.lock`
 * (dots in taskId replaced with dashes for filesystem safety)
 *
 * In single-Agent mode, delegates to the existing LockManager (Spec-level lock).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

const fs = require('fs').promises;
const path = require('path');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('../collab/multi-agent-config');
const { LockManager } = require('./lock-manager');
const TaskClaimer = require('../task/task-claimer');

class TaskLockManager {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('./machine-identifier').MachineIdentifier} machineIdentifier
   */
  constructor(workspaceRoot, machineIdentifier) {
    this._workspaceRoot = workspaceRoot;
    this._machineIdentifier = machineIdentifier;
    this._specsDir = path.join(workspaceRoot, '.kiro', 'specs');
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
    this._lockManager = new LockManager(workspaceRoot, machineIdentifier);
    this._taskClaimer = new TaskClaimer();
  }

  /**
   * Convert a taskId to a filesystem-safe filename.
   * Replaces dots with dashes (e.g. "2.1" → "2-1").
   * @param {string} taskId
   * @returns {string}
   * @private
   */
  _safeTaskId(taskId) {
    return taskId.replace(/\./g, '-');
  }

  /**
   * Get the locks directory for a spec.
   * @param {string} specName
   * @returns {string}
   * @private
   */
  _locksDir(specName) {
    return path.join(this._specsDir, specName, 'locks');
  }

  /**
   * Get the lock file path for a specific task.
   * @param {string} specName
   * @param {string} taskId
   * @returns {string}
   * @private
   */
  _lockFilePath(specName, taskId) {
    return path.join(this._locksDir(specName), `${this._safeTaskId(taskId)}.lock`);
  }

  /**
   * Check whether multi-Agent mode is enabled.
   * @returns {Promise<boolean>}
   */
  async isMultiAgentMode() {
    return this._multiAgentConfig.isEnabled();
  }

  /**
   * Acquire a task-level lock.
   *
   * In multi-Agent mode: creates `.kiro/specs/{specName}/locks/{taskId}.lock`
   * In single-Agent mode: delegates to LockManager.acquireLock(specName)
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} agentId
   * @param {object} [options={}]
   * @param {string} [options.reason] - Reason for acquiring the lock
   * @returns {Promise<{success: boolean, lock?: object, holder?: object, error?: string}>}
   */
  async acquireTaskLock(specName, taskId, agentId, options = {}) {
    const multiAgent = await this.isMultiAgentMode();

    if (!multiAgent) {
      // Single-Agent mode: delegate to Spec-level lock
      return this._lockManager.acquireLock(specName, { reason: options.reason });
    }

    const lockPath = this._lockFilePath(specName, taskId);

    // Check for existing lock
    const existing = await this._readLockFile(lockPath);
    if (existing) {
      if (existing.agentId === agentId) {
        // Already held by this agent – refresh
        const lock = await this._buildLockRecord(specName, taskId, agentId, options.reason);
        await this._atomicWriteLock(lockPath, lock);
        return { success: true, lock };
      }
      // Held by another agent (Req 2.2)
      return { success: false, error: 'Task is already locked', holder: existing };
    }

    // Acquire new lock (Req 2.1)
    const lock = await this._buildLockRecord(specName, taskId, agentId, options.reason);
    await fsUtils.ensureDirectory(this._locksDir(specName));
    await this._atomicWriteLock(lockPath, lock);

    // Verify we actually got the lock (race-condition guard)
    const verify = await this._readLockFile(lockPath);
    if (verify && verify.agentId === agentId) {
      // Integrate with TaskClaimer: claim the task atomically (Req 2.5)
      const claimResult = await this._taskClaimer.claimTask(
        this._workspaceRoot, specName, taskId, agentId, true
      );
      if (!claimResult.success) {
        // Rollback: release the lock file since claim failed
        try {
          await fs.unlink(lockPath);
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') throw unlinkErr;
        }
        return { success: false, error: `Lock acquired but claim failed: ${claimResult.error}` };
      }
      return { success: true, lock };
    }

    return { success: false, error: 'Task is already locked', holder: verify };
  }

  /**
   * Release a task-level lock.
   *
   * In multi-Agent mode: deletes the lock file (Req 2.3)
   * In single-Agent mode: delegates to LockManager.releaseLock(specName)
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} agentId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async releaseTaskLock(specName, taskId, agentId) {
    const multiAgent = await this.isMultiAgentMode();

    if (!multiAgent) {
      return this._lockManager.releaseLock(specName);
    }

    const lockPath = this._lockFilePath(specName, taskId);
    const existing = await this._readLockFile(lockPath);

    if (!existing) {
      return { success: true }; // Nothing to release
    }

    if (existing.agentId !== agentId) {
      return { success: false, error: 'Lock owned by different agent', holder: existing };
    }

    // Integrate with TaskClaimer: unclaim the task (best effort) (Req 2.5)
    try {
      await this._taskClaimer.unclaimTask(this._workspaceRoot, specName, taskId, agentId);
    } catch (_unclaimErr) {
      // Best effort – proceed with lock file deletion even if unclaim fails
    }

    try {
      await fs.unlink(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    return { success: true };
  }

  /**
   * Release all task locks held by a specific agent.
   * Scans all spec directories for `locks/` subdirectories.
   *
   * @param {string} agentId
   * @returns {Promise<{released: Array<{specName: string, taskId: string}>}>}
   */
  async releaseAllLocks(agentId) {
    const released = [];

    let specEntries;
    try {
      specEntries = await fs.readdir(this._specsDir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return { released };
      throw err;
    }

    for (const entry of specEntries) {
      if (!entry.isDirectory()) continue;

      const specName = entry.name;
      const locksDir = this._locksDir(specName);

      let lockFiles;
      try {
        lockFiles = await fs.readdir(locksDir);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }

      for (const file of lockFiles) {
        if (!file.endsWith('.lock')) continue;

        const lockPath = path.join(locksDir, file);
        const lockData = await this._readLockFile(lockPath);

        if (lockData && lockData.agentId === agentId) {
          try {
            await fs.unlink(lockPath);
            released.push({ specName, taskId: lockData.taskId });
          } catch (err) {
            if (err.code !== 'ENOENT') throw err;
          }
        }
      }
    }

    return { released };
  }

  /**
   * Get the lock status for a specific task.
   *
   * @param {string} specName
   * @param {string} taskId
   * @returns {Promise<{locked: boolean, lock?: object}>}
   */
  async getTaskLockStatus(specName, taskId) {
    const lockPath = this._lockFilePath(specName, taskId);
    const lockData = await this._readLockFile(lockPath);

    if (!lockData) {
      return { locked: false, specName, taskId };
    }

    return { locked: true, specName, taskId, lock: lockData };
  }

  /**
   * List all locked tasks within a spec.
   *
   * @param {string} specName
   * @returns {Promise<Array<{locked: boolean, specName: string, taskId: string, lock?: object}>>}
   */
  async listLockedTasks(specName) {
    const locksDir = this._locksDir(specName);
    const results = [];

    let files;
    try {
      files = await fs.readdir(locksDir);
    } catch (err) {
      if (err.code === 'ENOENT') return results;
      throw err;
    }

    for (const file of files) {
      if (!file.endsWith('.lock')) continue;

      const lockPath = path.join(locksDir, file);
      const lockData = await this._readLockFile(lockPath);

      if (lockData) {
        results.push({
          locked: true,
          specName,
          taskId: lockData.taskId,
          lock: lockData,
        });
      }
    }

    return results;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Build a lock record object.
   * @private
   */
  async _buildLockRecord(specName, taskId, agentId, reason) {
    const machineInfo = await this._machineIdentifier.getMachineId();
    return {
      agentId,
      machineId: machineInfo.id,
      hostname: machineInfo.hostname,
      taskId,
      specName,
      acquiredAt: new Date().toISOString(),
      reason: reason || null,
    };
  }

  /**
   * Read and parse a lock file. Returns null if missing or corrupted.
   * @param {string} lockPath
   * @returns {Promise<object|null>}
   * @private
   */
  async _readLockFile(lockPath) {
    try {
      const raw = await fs.readFile(lockPath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data.agentId === 'string' && typeof data.taskId === 'string') {
        return data;
      }
      return null; // Invalid structure
    } catch (err) {
      if (err.code === 'ENOENT' || err instanceof SyntaxError) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Atomically write a lock file using temp + rename (Req 2.7).
   * @param {string} lockPath
   * @param {object} data
   * @returns {Promise<void>}
   * @private
   */
  async _atomicWriteLock(lockPath, data) {
    const content = JSON.stringify(data, null, 2);
    await fsUtils.atomicWrite(lockPath, content);
  }
}

module.exports = { TaskLockManager };
