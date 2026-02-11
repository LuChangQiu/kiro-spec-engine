/**
 * SteeringFileLock - Protects concurrent writes to Steering files
 *
 * Uses file-level locks with exclusive create (`wx`) to serialize writes
 * to `.kiro/steering/` files. When lock acquisition fails after retries,
 * falls back to writing a pending file for later merge.
 *
 * Lock file path: `.kiro/steering/{filename}.lock`
 * Pending file path: `.kiro/steering/{filename}.pending.{agentId}`
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const fsUtils = require('../utils/fs-utils');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;
const STALE_LOCK_MS = 30000; // 30 seconds

class SteeringFileLock {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   */
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._steeringDir = path.join(workspaceRoot, '.kiro', 'steering');
  }

  /**
   * Lock file path for a given steering filename.
   * @param {string} filename
   * @returns {string}
   * @private
   */
  _lockPath(filename) {
    return path.join(this._steeringDir, `${filename}.lock`);
  }

  /**
   * Acquire a write lock for a Steering file.
   * Retries up to MAX_RETRIES times with exponential backoff (Req 5.2).
   *
   * @param {string} filename - Steering filename (e.g. "CURRENT_CONTEXT.md")
   * @returns {Promise<{success: boolean, lockId?: string, error?: string}>}
   */
  async acquireLock(filename) {
    const lockFile = this._lockPath(filename);
    const lockId = crypto.randomUUID();
    const lockData = JSON.stringify({
      lockId,
      acquiredAt: new Date().toISOString(),
    });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await this._sleep(delayMs);
      }

      try {
        await fsUtils.ensureDirectory(this._steeringDir);
        await fs.writeFile(lockFile, lockData, { flag: 'wx' });
        return { success: true, lockId };
      } catch (err) {
        if (err.code === 'EEXIST') {
          // Lock held — check for staleness
          const claimed = await this._tryClaimStaleLock(lockFile, lockData);
          if (claimed) {
            return { success: true, lockId };
          }
          continue; // retry
        }
        throw err;
      }
    }

    return { success: false, error: 'Failed to acquire lock: retries exhausted' };
  }

  /**
   * Release a previously acquired write lock.
   * Only the holder (matching lockId) can release the lock.
   *
   * @param {string} filename - Steering filename
   * @param {string} lockId - The lockId returned by acquireLock
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async releaseLock(filename, lockId) {
    const lockFile = this._lockPath(filename);

    try {
      const raw = await fs.readFile(lockFile, 'utf8');
      const data = JSON.parse(raw);

      if (data.lockId !== lockId) {
        return { success: false, error: 'Lock owned by different caller' };
      }

      await fs.unlink(lockFile);
      return { success: true };
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Lock already gone — treat as success
        return { success: true };
      }
      if (err instanceof SyntaxError) {
        // Corrupted lock file — remove it
        try { await fs.unlink(lockFile); } catch (_) { /* ignore */ }
        return { success: true };
      }
      throw err;
    }
  }

  /**
   * Execute a callback while holding the Steering file lock.
   * Acquires the lock, runs the callback, then releases the lock.
   * If lock acquisition fails, throws an error.
   *
   * @param {string} filename - Steering filename
   * @param {Function} callback - async () => result
   * @returns {Promise<*>} The callback's return value
   */
  async withLock(filename, callback) {
    const { success, lockId, error } = await this.acquireLock(filename);
    if (!success) {
      throw new Error(error || 'Failed to acquire steering file lock');
    }

    try {
      return await callback();
    } finally {
      await this.releaseLock(filename, lockId);
    }
  }

  /**
   * Write content to a pending file as a fallback when lock acquisition fails.
   * Pending file path: `.kiro/steering/{filename}.pending.{agentId}`
   * Uses atomic write for file integrity (Req 5.3, 5.4).
   *
   * @param {string} filename - Steering filename
   * @param {string} content - Content to write
   * @param {string} agentId - Agent identifier
   * @returns {Promise<{pendingPath: string}>}
   */
  async writePending(filename, content, agentId) {
    await fsUtils.ensureDirectory(this._steeringDir);
    const pendingPath = path.join(this._steeringDir, `${filename}.pending.${agentId}`);
    await fsUtils.atomicWrite(pendingPath, content);
    return { pendingPath };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * If the existing lock file is older than STALE_LOCK_MS, remove it and
   * re-attempt acquisition.
   *
   * @param {string} lockFile
   * @param {string} lockData
   * @returns {Promise<boolean>}
   * @private
   */
  async _tryClaimStaleLock(lockFile, lockData) {
    try {
      const stat = await fs.stat(lockFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > STALE_LOCK_MS) {
        await fs.unlink(lockFile);
        try {
          await fs.writeFile(lockFile, lockData, { flag: 'wx' });
          return true;
        } catch (retryErr) {
          if (retryErr.code === 'EEXIST') return false;
          throw retryErr;
        }
      }
    } catch (statErr) {
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

  /**
   * Promise-based sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { SteeringFileLock };
