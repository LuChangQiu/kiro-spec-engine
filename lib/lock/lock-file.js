/**
 * LockFile - Manages lock file I/O operations
 * @module lib/lock/lock-file
 */

const fs = require('fs').promises;
const path = require('path');

const LOCK_FILE_NAME = '.lock';
const LOCK_VERSION = '1.0.0';

class LockFile {
  /**
   * @param {string} specsDir - Path to specs directory
   */
  constructor(specsDir) {
    this.specsDir = specsDir;
  }

  /**
   * Get lock file path for a spec
   * @param {string} specName - Name of the Spec
   * @returns {string}
   * @private
   */
  _getLockPath(specName) {
    return path.join(this.specsDir, specName, LOCK_FILE_NAME);
  }

  /**
   * Read lock metadata from a Spec
   * @param {string} specName - Name of the Spec
   * @returns {Promise<LockMetadata|null>}
   */
  async read(specName) {
    const lockPath = this._getLockPath(specName);
    
    try {
      const data = await fs.readFile(lockPath, 'utf8');
      const metadata = JSON.parse(data);
      
      if (!this._isValidMetadata(metadata)) {
        return null; // Corrupted lock file
      }
      
      return this._normalizeMetadata(metadata);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // No lock file
      }
      if (error instanceof SyntaxError) {
        return null; // Invalid JSON - corrupted
      }
      throw error;
    }
  }

  /**
   * Write lock metadata to a Spec
   * @param {string} specName - Name of the Spec
   * @param {LockMetadata} metadata - Lock metadata to write
   * @returns {Promise<void>}
   */
  async write(specName, metadata) {
    const lockPath = this._getLockPath(specName);
    const specDir = path.dirname(lockPath);
    
    // Ensure spec directory exists
    await fs.mkdir(specDir, { recursive: true });
    
    const normalizedMetadata = {
      ...metadata,
      version: metadata.version || LOCK_VERSION
    };
    
    if (!this._isValidMetadata(normalizedMetadata)) {
      throw new Error('Invalid lock metadata: missing required fields');
    }
    
    // Atomic write using temp file
    const tempPath = `${lockPath}.tmp`;
    const content = JSON.stringify(normalizedMetadata, null, 2);
    
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, lockPath);
  }


  /**
   * Delete lock file from a Spec
   * @param {string} specName - Name of the Spec
   * @returns {Promise<boolean>}
   */
  async delete(specName) {
    const lockPath = this._getLockPath(specName);
    
    try {
      await fs.unlink(lockPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // Already deleted
      }
      throw error;
    }
  }

  /**
   * Check if lock file exists
   * @param {string} specName - Name of the Spec
   * @returns {Promise<boolean>}
   */
  async exists(specName) {
    const lockPath = this._getLockPath(specName);
    
    try {
      await fs.access(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all Specs with lock files
   * @returns {Promise<string[]>}
   */
  async listLockedSpecs() {
    const lockedSpecs = [];
    
    try {
      const entries = await fs.readdir(this.specsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const lockPath = path.join(this.specsDir, entry.name, LOCK_FILE_NAME);
          try {
            await fs.access(lockPath);
            lockedSpecs.push(entry.name);
          } catch {
            // No lock file
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    
    return lockedSpecs;
  }

  /**
   * Validate lock metadata structure
   * @param {Object} metadata
   * @returns {boolean}
   * @private
   */
  _isValidMetadata(metadata) {
    return (
      metadata &&
      typeof metadata.owner === 'string' &&
      typeof metadata.machineId === 'string' &&
      typeof metadata.hostname === 'string' &&
      typeof metadata.timestamp === 'string' &&
      typeof metadata.timeout === 'number' &&
      metadata.owner.length > 0 &&
      metadata.machineId.length > 0
    );
  }

  /**
   * Normalize metadata with default values for optional fields
   * @param {Object} metadata
   * @returns {LockMetadata}
   * @private
   */
  _normalizeMetadata(metadata) {
    return {
      owner: metadata.owner,
      machineId: metadata.machineId,
      hostname: metadata.hostname,
      timestamp: metadata.timestamp,
      reason: metadata.reason || null,
      timeout: metadata.timeout,
      version: metadata.version || LOCK_VERSION
    };
  }
}

module.exports = { LockFile, LOCK_FILE_NAME, LOCK_VERSION };
