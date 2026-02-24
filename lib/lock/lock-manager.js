/**
 * LockManager - Manages Spec locks for multi-user collaboration
 * @module lib/lock/lock-manager
 */

const path = require('path');
const os = require('os');
const { LockFile } = require('./lock-file');
const { MachineIdentifier } = require('./machine-identifier');

const DEFAULT_TIMEOUT_HOURS = 24;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 100;

class LockManager {
  /**
   * @param {string} workspaceRoot - Root directory of the workspace
   * @param {MachineIdentifier} [machineIdentifier] - Machine ID provider
   */
  constructor(workspaceRoot, machineIdentifier = null) {
    this.workspaceRoot = workspaceRoot;
    this.specsDir = path.join(workspaceRoot, '.sce', 'specs');
    this.configDir = path.join(workspaceRoot, '.sce', 'config');
    this.lockFile = new LockFile(this.specsDir);
    this.machineIdentifier = machineIdentifier || new MachineIdentifier(this.configDir);
  }

  /**
   * Acquire a lock on a Spec
   * @param {string} specName - Name of the Spec to lock
   * @param {Object} options - Lock options
   * @param {string} [options.reason] - Reason for acquiring the lock
   * @param {number} [options.timeout] - Lock timeout in hours (default: 24)
   * @returns {Promise<LockResult>}
   */
  async acquireLock(specName, options = {}) {
    const { reason = null, timeout = DEFAULT_TIMEOUT_HOURS } = options;

    // Check if spec directory exists
    const specDir = path.join(this.specsDir, specName);
    try {
      const fs = require('fs').promises;
      await fs.access(specDir);
    } catch {
      return { success: false, error: 'Spec not found' };
    }

    // Check existing lock with retry for concurrent access
    for (let attempt = 0; attempt < MAX_RETRY_COUNT; attempt++) {
      const existingLock = await this.lockFile.read(specName);
      
      if (existingLock) {
        const machineId = await this.machineIdentifier.getMachineId();
        if (existingLock.machineId === machineId.id) {
          // Already locked by this machine - update the lock
          const lock = await this._createLockMetadata(reason, timeout);
          await this.lockFile.write(specName, lock);
          return { success: true, lock };
        }
        return {
          success: false,
          error: 'Spec is already locked',
          existingLock
        };
      }

      // Try to acquire lock
      try {
        const lock = await this._createLockMetadata(reason, timeout);
        await this.lockFile.write(specName, lock);
        
        // Verify we got the lock (handle race condition)
        const verifyLock = await this.lockFile.read(specName);
        const machineId = await this.machineIdentifier.getMachineId();
        
        if (verifyLock && verifyLock.machineId === machineId.id) {
          return { success: true, lock };
        }
        
        // Someone else got the lock
        return {
          success: false,
          error: 'Spec is already locked',
          existingLock: verifyLock
        };
      } catch (error) {
        if (attempt < MAX_RETRY_COUNT - 1) {
          await this._delay(RETRY_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw error;
      }
    }

    return { success: false, error: 'Failed to acquire lock after retries' };
  }


  /**
   * Release a lock on a Spec
   * @param {string} specName - Name of the Spec to unlock
   * @param {Object} options - Unlock options
   * @param {boolean} [options.force] - Force unlock regardless of ownership
   * @returns {Promise<UnlockResult>}
   */
  async releaseLock(specName, options = {}) {
    const { force = false } = options;

    const existingLock = await this.lockFile.read(specName);
    
    if (!existingLock) {
      return { success: true, message: 'No lock exists on this Spec' };
    }

    const machineId = await this.machineIdentifier.getMachineId();
    
    if (existingLock.machineId !== machineId.id && !force) {
      return {
        success: false,
        error: 'Lock owned by different machine',
        existingLock
      };
    }

    const deleted = await this.lockFile.delete(specName);
    
    return {
      success: true,
      forced: force && existingLock.machineId !== machineId.id,
      previousLock: existingLock
    };
  }

  /**
   * Get lock status for a specific Spec or all Specs
   * @param {string} [specName] - Optional Spec name, if omitted returns all locks
   * @returns {Promise<LockStatus|LockStatus[]>}
   */
  async getLockStatus(specName) {
    if (specName) {
      return this._getSingleLockStatus(specName);
    }
    return this._getAllLockStatus();
  }

  /**
   * Get lock status for a single spec
   * @param {string} specName
   * @returns {Promise<LockStatus>}
   * @private
   */
  async _getSingleLockStatus(specName) {
    const lock = await this.lockFile.read(specName);
    const machineId = await this.machineIdentifier.getMachineId();
    
    if (!lock) {
      return { specName, locked: false };
    }

    return {
      specName,
      locked: true,
      lock,
      isStale: this._isStale(lock),
      isOwnedByMe: lock.machineId === machineId.id,
      duration: this._formatDuration(lock.timestamp)
    };
  }

  /**
   * Get lock status for all specs
   * @returns {Promise<LockStatus[]>}
   * @private
   */
  async _getAllLockStatus() {
    const lockedSpecs = await this.lockFile.listLockedSpecs();
    const statuses = [];
    
    for (const specName of lockedSpecs) {
      const status = await this._getSingleLockStatus(specName);
      statuses.push(status);
    }
    
    return statuses;
  }

  /**
   * Clean up stale locks
   * @returns {Promise<CleanupResult>}
   */
  async cleanupStaleLocks() {
    const result = { cleaned: 0, cleanedLocks: [], errors: [] };
    const lockedSpecs = await this.lockFile.listLockedSpecs();
    
    for (const specName of lockedSpecs) {
      try {
        const lock = await this.lockFile.read(specName);
        if (lock && this._isStale(lock)) {
          await this.lockFile.delete(specName);
          result.cleaned++;
          result.cleanedLocks.push({ specName, lock });
        }
      } catch (error) {
        result.errors.push({ specName, error: error.message });
      }
    }
    
    return result;
  }

  /**
   * Check if a Spec is locked
   * @param {string} specName - Name of the Spec
   * @returns {Promise<boolean>}
   */
  async isLocked(specName) {
    return this.lockFile.exists(specName);
  }

  /**
   * Check if current machine owns the lock
   * @param {string} specName - Name of the Spec
   * @returns {Promise<boolean>}
   */
  async isLockedByMe(specName) {
    const lock = await this.lockFile.read(specName);
    if (!lock) return false;
    
    const machineId = await this.machineIdentifier.getMachineId();
    return lock.machineId === machineId.id;
  }


  /**
   * Create lock metadata
   * @param {string|null} reason
   * @param {number} timeout
   * @returns {Promise<LockMetadata>}
   * @private
   */
  async _createLockMetadata(reason, timeout) {
    const machineId = await this.machineIdentifier.getMachineId();
    const owner = this._getOwnerName();
    
    return {
      owner,
      machineId: machineId.id,
      hostname: machineId.hostname,
      timestamp: new Date().toISOString(),
      reason: reason || null,
      timeout,
      version: '1.0.0'
    };
  }

  /**
   * Get owner name from git config or environment
   * @returns {string}
   * @private
   */
  _getOwnerName() {
    try {
      const { execSync } = require('child_process');
      const gitUser = execSync('git config user.name', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (gitUser) return gitUser;
    } catch {
      // Git not available or not configured
    }
    
    try {
      return os.userInfo().username || process.env.USER || process.env.USERNAME || 'unknown';
    } catch {
      return process.env.USER || process.env.USERNAME || 'unknown';
    }
  }

  /**
   * Check if a lock is stale
   * @param {LockMetadata} lock
   * @returns {boolean}
   * @private
   */
  _isStale(lock) {
    const lockTime = new Date(lock.timestamp).getTime();
    const now = Date.now();
    const timeoutMs = lock.timeout * 60 * 60 * 1000;
    return (now - lockTime) > timeoutMs;
  }

  /**
   * Format duration since lock was acquired
   * @param {string} timestamp
   * @returns {string}
   * @private
   */
  _formatDuration(timestamp) {
    const lockTime = new Date(timestamp).getTime();
    const now = Date.now();
    const diffMs = now - lockTime;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Delay helper for retry logic
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { LockManager, DEFAULT_TIMEOUT_HOURS };
