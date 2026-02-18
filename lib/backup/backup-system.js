/**
 * Backup System
 * 
 * Creates, manages, and restores backups of the .kiro/ directory.
 * Provides rollback capability for safe adoption and upgrade operations.
 */

const path = require('path');
const fs = require('fs-extra');
const {
  pathExists,
  copyDirectory,
  ensureDirectory,
  listFiles,
  listFilesRecursive,
  getDirectorySize,
  readJSON,
  writeJSON,
  remove
} = require('../utils/fs-utils');

class BackupSystem {
  constructor() {
    this.backupDirName = 'backups';
  }

  /**
   * Gets the path to the backups directory
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {string} - Absolute path to backups directory
   */
  getBackupDir(projectPath) {
    return path.join(projectPath, '.kiro', this.backupDirName);
  }

  /**
   * Gets the path to the .kiro directory
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {string} - Absolute path to .kiro directory
   */
  getKiroDir(projectPath) {
    return path.join(projectPath, '.kiro');
  }

  /**
   * Generates a backup ID based on type and timestamp
   * 
   * @param {string} type - Backup type (adopt, upgrade, pre-rollback)
   * @returns {string} - Backup ID (e.g., "adopt-2026-01-23-100000")
   */
  generateBackupId(type) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${type}-${year}-${month}-${day}-${hours}${minutes}${seconds}`;
  }

  /**
   * Creates backup of .kiro/ directory
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {Object} options - Backup options
   * @param {string} options.type - Backup type (adopt, upgrade, pre-rollback)
   * @returns {Promise<BackupInfo>}
   */
  async createBackup(projectPath, options = {}) {
    const { type = 'manual' } = options;
    
    try {
      const kiroDir = this.getKiroDir(projectPath);
      
      // Check if .kiro/ exists
      const kiroExists = await pathExists(kiroDir);
      if (!kiroExists) {
        throw new Error('.kiro/ directory does not exist');
      }
      
      // Create backups directory if it doesn't exist
      const backupDir = this.getBackupDir(projectPath);
      await ensureDirectory(backupDir);
      
      // Generate backup ID
      const backupId = this.generateBackupId(type);
      const backupPath = path.join(backupDir, backupId);
      
      // Check if backup already exists (shouldn't happen with timestamp)
      const backupExists = await pathExists(backupPath);
      if (backupExists) {
        throw new Error(`Backup already exists: ${backupId}`);
      }
      
      // Create backup directory
      await ensureDirectory(backupPath);
      
      // Copy .kiro/ contents to backup (excluding backups/ itself)
      const items = await listFiles(kiroDir);
      
      for (const item of items) {
        // Skip the backups directory itself
        if (item === this.backupDirName) {
          continue;
        }
        
        const sourcePath = path.join(kiroDir, item);
        const destPath = path.join(backupPath, item);
        
        await copyDirectory(sourcePath, destPath, { overwrite: false });
      }
      
      // Get backup metadata
      const files = await listFilesRecursive(backupPath);
      const size = await getDirectorySize(backupPath);
      
      // Read version from backup if it exists
      const versionPath = path.join(backupPath, 'version.json');
      let version = 'unknown';
      try {
        const versionExists = await pathExists(versionPath);
        if (versionExists) {
          const versionInfo = await readJSON(versionPath);
          version = versionInfo['sce-version'] || 'unknown';
        }
      } catch (error) {
        // Ignore version read errors
      }
      
      // Create metadata file
      const metadata = {
        id: backupId,
        type,
        created: new Date().toISOString(),
        version,
        size,
        files: files.length
      };
      
      const metadataPath = path.join(backupPath, 'metadata.json');
      await writeJSON(metadataPath, metadata, { spaces: 2 });
      
      // Return backup info
      return {
        id: backupId,
        type,
        created: metadata.created,
        version,
        size,
        files: files.length,
        path: backupPath
      };
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Lists available backups
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<BackupInfo[]>} - Array of backup info, sorted by date (newest first)
   */
  async listBackups(projectPath) {
    try {
      const backupDir = this.getBackupDir(projectPath);
      
      // Check if backups directory exists
      const backupDirExists = await pathExists(backupDir);
      if (!backupDirExists) {
        return [];
      }
      
      // List backup directories
      const items = await listFiles(backupDir);
      const backups = [];
      
      for (const item of items) {
        const backupPath = path.join(backupDir, item);
        const metadataPath = path.join(backupPath, 'metadata.json');
        
        try {
          // Check if metadata exists
          const metadataExists = await pathExists(metadataPath);
          if (!metadataExists) {
            continue;
          }
          
          // Read metadata
          const metadata = await readJSON(metadataPath);
          
          backups.push({
            id: metadata.id,
            type: metadata.type,
            created: metadata.created,
            version: metadata.version,
            size: metadata.size,
            files: metadata.files,
            path: backupPath
          });
        } catch (error) {
          // Skip backups with invalid metadata
          continue;
        }
      }
      
      // Sort by created date (newest first)
      backups.sort((a, b) => {
        return new Date(b.created) - new Date(a.created);
      });
      
      return backups;
    } catch (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Restores from backup
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {string} backupId - Backup ID to restore from
   * @returns {Promise<RestoreResult>}
   */
  async restore(projectPath, backupId) {
    try {
      const backupDir = this.getBackupDir(projectPath);
      const backupPath = path.join(backupDir, backupId);
      
      // Check if backup exists
      const backupExists = await pathExists(backupPath);
      if (!backupExists) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      // Validate backup before restoring
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        throw new Error(`Backup validation failed: ${backupId}`);
      }
      
      const kiroDir = this.getKiroDir(projectPath);
      
      // Get list of items to restore (excluding metadata.json)
      const items = await listFiles(backupPath);
      const itemsToRestore = items.filter(item => item !== 'metadata.json');
      
      // Remove existing .kiro/ contents (except backups/)
      const existingItems = await listFiles(kiroDir);
      for (const item of existingItems) {
        if (item === this.backupDirName) {
          continue;
        }
        
        const itemPath = path.join(kiroDir, item);
        await remove(itemPath);
      }
      
      // Restore items from backup
      const restoredFiles = [];
      for (const item of itemsToRestore) {
        const sourcePath = path.join(backupPath, item);
        const destPath = path.join(kiroDir, item);
        
        await copyDirectory(sourcePath, destPath, { overwrite: true });
        restoredFiles.push(item);
      }
      
      return {
        success: true,
        backupId,
        filesRestored: restoredFiles.length,
        files: restoredFiles
      };
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  /**
   * Validates backup integrity
   * 
   * @param {string} backupPath - Absolute path to backup directory
   * @returns {Promise<boolean>}
   */
  async validateBackup(backupPath) {
    try {
      // Check if backup directory exists
      const backupExists = await pathExists(backupPath);
      if (!backupExists) {
        return false;
      }
      
      // Check if metadata exists
      const metadataPath = path.join(backupPath, 'metadata.json');
      const metadataExists = await pathExists(metadataPath);
      if (!metadataExists) {
        return false;
      }
      
      // Read and validate metadata
      const metadata = await readJSON(metadataPath);
      if (!metadata.id || !metadata.type || !metadata.created) {
        return false;
      }
      
      // Count files in backup
      const files = await listFilesRecursive(backupPath);
      // Subtract 1 for metadata.json itself
      const fileCount = files.length - 1;
      
      // Verify file count matches metadata (allow some tolerance)
      // Files might be slightly different due to metadata.json
      if (Math.abs(fileCount - metadata.files) > 1) {
        return false;
      }
      
      // Verify version.json exists and is valid (if present)
      const versionPath = path.join(backupPath, 'version.json');
      const versionExists = await pathExists(versionPath);
      if (versionExists) {
        try {
          const versionInfo = await readJSON(versionPath);
          // Basic validation
          if (!versionInfo['sce-version']) {
            return false;
          }
        } catch (error) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleans old backups (keeps last N backups)
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {number} keepCount - Number of backups to keep (default: 5)
   * @returns {Promise<void>}
   */
  async cleanOldBackups(projectPath, keepCount = 5) {
    try {
      // Get all backups sorted by date (newest first)
      const backups = await this.listBackups(projectPath);
      
      // If we have fewer backups than keepCount, nothing to do
      if (backups.length <= keepCount) {
        return;
      }
      
      // Remove old backups
      const backupsToRemove = backups.slice(keepCount);
      
      for (const backup of backupsToRemove) {
        await remove(backup.path);
      }
    } catch (error) {
      throw new Error(`Failed to clean old backups: ${error.message}`);
    }
  }
}

module.exports = BackupSystem;
