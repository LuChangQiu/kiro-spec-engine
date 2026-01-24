/**
 * Selective Backup System
 * 
 * Creates targeted backups of specific files rather than entire directories.
 * Used for conflict resolution during adoption to backup only files being overwritten.
 */

const path = require('path');
const fs = require('fs').promises;
const {
  pathExists,
  ensureDirectory,
  safeCopy,
  readJSON,
  writeJSON
} = require('../utils/fs-utils');

/**
 * SelectiveBackup class for creating targeted file backups
 */
class SelectiveBackup {
  constructor() {
    this.backupDir = '.kiro/backups';
  }

  /**
   * Creates a backup of specific files before overwriting
   * 
   * @param {string} projectPath - Project root path
   * @param {string[]} filePaths - Relative paths of files to backup (from .kiro/)
   * @param {Object} options - Backup options
   * @param {string} options.type - Backup type (default: 'conflict')
   * @returns {Promise<SelectiveBackupInfo>}
   */
  async createSelectiveBackup(projectPath, filePaths, options = {}) {
    const { type = 'conflict' } = options;
    
    // Generate backup ID with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const dateStr = timestamp[0];
    const timeStr = timestamp[1].split('-').slice(0, 3).join('');
    const backupId = `${type}-${dateStr}-${timeStr}`;
    
    const backupPath = path.join(projectPath, this.backupDir, backupId);
    const filesBackupPath = path.join(backupPath, 'files');
    
    // Create backup directory structure
    await ensureDirectory(backupPath);
    await ensureDirectory(filesBackupPath);
    
    const backedUpFiles = [];
    let totalSize = 0;
    
    // Backup each file
    for (const filePath of filePaths) {
      const sourcePath = path.join(projectPath, this.backupDir.replace('/backups', ''), filePath);
      const destPath = path.join(filesBackupPath, filePath);
      
      // Check if source file exists
      const sourceExists = await pathExists(sourcePath);
      if (!sourceExists) {
        continue; // Skip non-existent files
      }
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await ensureDirectory(destDir);
      
      // Copy file
      await safeCopy(sourcePath, destPath, { overwrite: true });
      
      // Get file size
      const stats = await fs.stat(sourcePath);
      totalSize += stats.size;
      
      backedUpFiles.push(filePath);
    }
    
    // Create metadata
    const metadata = {
      id: backupId,
      type,
      created: new Date().toISOString(),
      files: backedUpFiles,
      fileCount: backedUpFiles.length,
      totalSize
    };
    
    // Write metadata
    await writeJSON(path.join(backupPath, 'metadata.json'), metadata);
    
    // Write files list
    await writeJSON(path.join(backupPath, 'files.json'), backedUpFiles);
    
    return {
      id: backupId,
      type,
      created: metadata.created,
      files: backedUpFiles,
      fileCount: backedUpFiles.length,
      totalSize,
      path: backupPath
    };
  }

  /**
   * Restores specific files from a selective backup
   * 
   * @param {string} projectPath - Project root path
   * @param {string} backupId - Backup ID to restore from
   * @param {string[]} filePaths - Optional: specific files to restore (if not provided, restores all)
   * @returns {Promise<RestoreResult>}
   */
  async restoreSelective(projectPath, backupId, filePaths = null) {
    const backupPath = path.join(projectPath, this.backupDir, backupId);
    
    // Check if backup exists
    const backupExists = await pathExists(backupPath);
    if (!backupExists) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    // Read metadata
    const metadataPath = path.join(backupPath, 'metadata.json');
    const metadata = await readJSON(metadataPath);
    
    if (!metadata) {
      throw new Error(`Invalid backup: metadata.json not found in ${backupId}`);
    }
    
    // Determine which files to restore
    const filesToRestore = filePaths || metadata.files;
    
    const restoredFiles = [];
    const errors = [];
    
    // Restore each file
    for (const filePath of filesToRestore) {
      try {
        const sourcePath = path.join(backupPath, 'files', filePath);
        const destPath = path.join(projectPath, this.backupDir.replace('/backups', ''), filePath);
        
        // Check if backup file exists
        const sourceExists = await pathExists(sourcePath);
        if (!sourceExists) {
          errors.push(`File not found in backup: ${filePath}`);
          continue;
        }
        
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        await ensureDirectory(destDir);
        
        // Restore file
        await safeCopy(sourcePath, destPath, { overwrite: true });
        restoredFiles.push(filePath);
      } catch (error) {
        errors.push(`Failed to restore ${filePath}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      backupId,
      restoredFiles,
      errors
    };
  }

  /**
   * Lists files in a selective backup
   * 
   * @param {string} projectPath - Project root path
   * @param {string} backupId - Backup ID
   * @returns {Promise<string[]>} - Array of file paths in backup
   */
  async listBackupFiles(projectPath, backupId) {
    const backupPath = path.join(projectPath, this.backupDir, backupId);
    
    // Check if backup exists
    const backupExists = await pathExists(backupPath);
    if (!backupExists) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    // Read files list
    const filesPath = path.join(backupPath, 'files.json');
    const filesExists = await pathExists(filesPath);
    
    if (filesExists) {
      const files = await readJSON(filesPath);
      return files || [];
    }
    
    // Fallback: read from metadata
    const metadataPath = path.join(backupPath, 'metadata.json');
    const metadata = await readJSON(metadataPath);
    
    if (metadata && metadata.files) {
      return metadata.files;
    }
    
    return [];
  }
}

module.exports = SelectiveBackup;
