const fs = require('fs-extra');
const path = require('path');

/**
 * Backup System
 * 
 * Manages automatic backups before environment switches and supports rollback.
 * Maintains backup history with a maximum of 10 backups per target file.
 */
class BackupSystem {
  /**
   * Create a new Backup System
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.backupDir = path.join(projectRoot, '.kiro', 'env-backups');
  }

  /**
   * Create backup of target files
   * @param {Array} targetFiles - Array of file paths to backup
   * @param {string} environmentName - Name of environment being switched to
   * @returns {Object} Backup metadata (timestamp, files, location)
   * @throws {Error} If backup creation fails
   */
  async createBackup(targetFiles, environmentName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(this.backupDir, `${timestamp}_${environmentName}`);

    await fs.ensureDir(backupSubDir);

    const backedUpFiles = [];

    for (const targetFile of targetFiles) {
      const targetPath = path.join(this.projectRoot, targetFile);
      
      // Only backup if file exists
      if (await fs.pathExists(targetPath)) {
        const backupPath = path.join(backupSubDir, targetFile);
        const backupFileDir = path.dirname(backupPath);
        
        await fs.ensureDir(backupFileDir);
        await fs.copy(targetPath, backupPath);

        backedUpFiles.push({
          original_path: targetFile,
          backup_path: path.relative(this.projectRoot, backupPath)
        });
      }
    }

    // Save backup metadata
    const metadata = {
      timestamp,
      environment_name: environmentName,
      backup_directory: path.relative(this.projectRoot, backupSubDir),
      files: backedUpFiles
    };

    await fs.writeFile(
      path.join(backupSubDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // Clean up old backups
    await this.cleanupOldBackups();

    return metadata;
  }

  /**
   * Restore most recent backup
   * @param {string} environmentName - Optional environment name to restore
   * @returns {Object} Restore result with restored files
   * @throws {Error} If restore fails or no backups exist
   */
  async restoreBackup(environmentName = null) {
    const backups = await this.listBackups();

    if (backups.length === 0) {
      throw new Error('No backups available to restore');
    }

    // Find most recent backup (optionally filtered by environment name)
    let targetBackup = null;
    if (environmentName) {
      const filtered = backups.filter(b => b.environment_name === environmentName);
      if (filtered.length === 0) {
        throw new Error(`No backups found for environment "${environmentName}"`);
      }
      targetBackup = filtered[0]; // Most recent
    } else {
      targetBackup = backups[0]; // Most recent overall
    }

    const restoredFiles = [];

    // Restore each file
    for (const fileInfo of targetBackup.files) {
      const backupPath = path.join(this.projectRoot, fileInfo.backup_path);
      const targetPath = path.join(this.projectRoot, fileInfo.original_path);

      if (await fs.pathExists(backupPath)) {
        const targetDir = path.dirname(targetPath);
        await fs.ensureDir(targetDir);
        await fs.copy(backupPath, targetPath, { overwrite: true });
        restoredFiles.push(fileInfo.original_path);
      }
    }

    return {
      success: true,
      backup_timestamp: targetBackup.timestamp,
      environment_name: targetBackup.environment_name,
      files_restored: restoredFiles.length,
      restored_files: restoredFiles
    };
  }

  /**
   * List available backups
   * @returns {Array} Array of backup metadata objects (sorted by timestamp, newest first)
   */
  async listBackups() {
    if (!await fs.pathExists(this.backupDir)) {
      return [];
    }

    const entries = await fs.readdir(this.backupDir);
    const backups = [];

    for (const entry of entries) {
      const metadataPath = path.join(this.backupDir, entry, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        try {
          const content = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(content);
          backups.push(metadata);
        } catch (error) {
          // Skip corrupted metadata files
          continue;
        }
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return backups;
  }

  /**
   * Clean up old backups (keep last 10 per file)
   * @returns {Object} Cleanup result with removed backup count
   */
  async cleanupOldBackups() {
    const backups = await this.listBackups();

    if (backups.length <= 10) {
      return { removed: 0 };
    }

    // Remove oldest backups (keep only last 10)
    const backupsToRemove = backups.slice(10);
    
    let removed = 0;
    for (const backup of backupsToRemove) {
      const fullPath = path.join(this.projectRoot, backup.backup_directory);
      if (await fs.pathExists(fullPath)) {
        await fs.remove(fullPath);
        removed++;
      }
    }

    return { removed };
  }

  /**
   * Get backup directory path
   * @returns {string} Path to backup directory
   */
  getBackupDirectory() {
    return this.backupDir;
  }
}

module.exports = BackupSystem;
