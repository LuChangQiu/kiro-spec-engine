/**
 * GitignoreBackup - Creates backups before modifying .gitignore
 * 
 * Provides backup creation, restoration, and management functionality
 * with automatic cleanup of old backups.
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * @typedef {Object} BackupInfo
 * @property {string} id - Backup ID (e.g., 'gitignore-2026-01-30-143022')
 * @property {string} created - ISO timestamp
 * @property {string} path - Backup file path
 * @property {number} size - File size in bytes
 */

/**
 * @typedef {Object} RestoreResult
 * @property {boolean} success - Restoration succeeded
 * @property {string} message - Result message
 */

class GitignoreBackup {
  constructor() {
    this.MAX_BACKUPS = 10;
  }

  /**
   * Creates backup of .gitignore
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<BackupInfo>}
   */
  async createBackup(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    // Check if .gitignore exists
    if (!await fs.pathExists(gitignorePath)) {
      throw new Error('.gitignore file does not exist');
    }
    
    // Read .gitignore content
    const content = await fs.readFile(gitignorePath, 'utf8');
    const stats = await fs.stat(gitignorePath);
    
    // Generate backup ID with timestamp
    const timestamp = this.generateTimestamp();
    const backupId = `gitignore-${timestamp}`;
    
    // Create backup directory
    const backupDir = path.join(projectPath, '.kiro', 'backups');
    await fs.ensureDir(backupDir);
    
    // Write backup file
    const backupPath = path.join(backupDir, backupId);
    await fs.writeFile(backupPath, content, 'utf8');
    
    // Create metadata
    const checksum = this.calculateChecksum(content);
    const metadata = {
      id: backupId,
      created: new Date().toISOString(),
      originalPath: '.gitignore',
      size: stats.size,
      checksum
    };
    
    const metaPath = path.join(backupDir, `${backupId}.meta.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    // Cleanup old backups
    await this.cleanupOldBackups(projectPath);
    
    return {
      id: backupId,
      created: metadata.created,
      path: backupPath,
      size: stats.size
    };
  }

  /**
   * Restores .gitignore from backup
   * 
   * @param {string} projectPath - Project root path
   * @param {string} backupId - Backup ID
   * @returns {Promise<RestoreResult>}
   */
  async restore(projectPath, backupId) {
    const backupDir = path.join(projectPath, '.kiro', 'backups');
    const backupPath = path.join(backupDir, backupId);
    const metaPath = path.join(backupDir, `${backupId}.meta.json`);
    
    // Check if backup exists
    if (!await fs.pathExists(backupPath)) {
      return {
        success: false,
        message: `Backup not found: ${backupId}`
      };
    }
    
    // Read backup content
    const content = await fs.readFile(backupPath, 'utf8');
    
    // Verify checksum if metadata exists
    if (await fs.pathExists(metaPath)) {
      const metadata = await fs.readJson(metaPath);
      const checksum = this.calculateChecksum(content);
      
      if (checksum !== metadata.checksum) {
        return {
          success: false,
          message: 'Backup file is corrupted (checksum mismatch)'
        };
      }
    }
    
    // Restore to original location
    const gitignorePath = path.join(projectPath, '.gitignore');
    await fs.writeFile(gitignorePath, content, 'utf8');
    
    return {
      success: true,
      message: `Successfully restored .gitignore from backup: ${backupId}`
    };
  }

  /**
   * Lists available .gitignore backups
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<BackupInfo[]>}
   */
  async listBackups(projectPath) {
    const backupDir = path.join(projectPath, '.kiro', 'backups');
    
    if (!await fs.pathExists(backupDir)) {
      return [];
    }
    
    const files = await fs.readdir(backupDir);
    const backups = [];
    
    for (const file of files) {
      if (file.startsWith('gitignore-') && !file.endsWith('.meta.json')) {
        const backupPath = path.join(backupDir, file);
        const metaPath = path.join(backupDir, `${file}.meta.json`);
        
        let metadata = null;
        if (await fs.pathExists(metaPath)) {
          metadata = await fs.readJson(metaPath);
        }
        
        const stats = await fs.stat(backupPath);
        
        backups.push({
          id: file,
          created: metadata ? metadata.created : stats.mtime.toISOString(),
          path: backupPath,
          size: stats.size
        });
      }
    }
    
    // Sort by creation time (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return backups;
  }

  /**
   * Cleans up old backups (keep last 10)
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<void>}
   */
  async cleanupOldBackups(projectPath) {
    const backups = await this.listBackups(projectPath);
    
    if (backups.length <= this.MAX_BACKUPS) {
      return;
    }
    
    // Remove oldest backups
    const toRemove = backups.slice(this.MAX_BACKUPS);
    
    for (const backup of toRemove) {
      await fs.remove(backup.path);
      
      // Remove metadata if exists
      const metaPath = `${backup.path}.meta.json`;
      if (await fs.pathExists(metaPath)) {
        await fs.remove(metaPath);
      }
    }
  }

  /**
   * Generates timestamp for backup ID
   * 
   * @returns {string} - Timestamp in format YYYY-MM-DD-HHMMSS
   */
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Calculates SHA-256 checksum of content
   * 
   * @param {string} content - Content to hash
   * @returns {string} - Hex checksum
   */
  calculateChecksum(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}

module.exports = GitignoreBackup;
