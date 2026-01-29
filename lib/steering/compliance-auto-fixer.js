const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Automatically fix steering directory compliance violations
 * by backing up and removing disallowed files and subdirectories
 */
class ComplianceAutoFixer {
  /**
   * Fix compliance violations automatically (no user confirmation)
   * @param {string} steeringPath - Path to steering directory
   * @param {Array} violations - List of violations from compliance check
   * @returns {Object} Fix result with backup info and cleaned files
   */
  async fix(steeringPath, violations) {
    if (!violations || violations.length === 0) {
      return {
        success: true,
        message: 'No violations to fix',
        backupPath: null,
        cleanedFiles: [],
        cleanedDirs: []
      };
    }

    // Separate violations by type
    const disallowedFiles = violations
      .filter(v => v.type === 'disallowed_file')
      .map(v => v.name);
    const subdirectories = violations
      .filter(v => v.type === 'subdirectory')
      .map(v => v.name);

    // Check if this is a multi-user project (contexts/ directory exists)
    const contextsPath = path.join(path.dirname(path.dirname(steeringPath)), 'contexts');
    const isMultiUser = await fs.pathExists(contextsPath);

    // Show what will be fixed
    console.log(chalk.yellow('\n🔧 Auto-fixing steering directory compliance violations...\n'));
    
    if (disallowedFiles.length > 0) {
      console.log(chalk.yellow('Disallowed files to be removed:'));
      disallowedFiles.forEach(file => console.log(`  - ${file}`));
      console.log();
    }
    
    if (subdirectories.length > 0) {
      console.log(chalk.yellow('Subdirectories to be removed:'));
      subdirectories.forEach(dir => console.log(`  - ${dir}/`));
      console.log();
    }

    // Show multi-user warning if applicable
    if (isMultiUser) {
      console.log(chalk.blue('ℹ️  Multi-user project detected'));
      console.log(chalk.blue('   Your personal CURRENT_CONTEXT.md is preserved in contexts/'));
      console.log();
    }

    // Create backup
    const backupPath = await this._createBackup(steeringPath, disallowedFiles, subdirectories);
    console.log(chalk.green(`✓ Backup created: ${backupPath}\n`));

    // Clean up violations
    const cleanedFiles = [];
    const cleanedDirs = [];

    // Remove disallowed files
    for (const file of disallowedFiles) {
      const filePath = path.join(steeringPath, file);
      try {
        await fs.remove(filePath);
        cleanedFiles.push(file);
        console.log(chalk.green(`✓ Removed file: ${file}`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to remove ${file}: ${error.message}`));
      }
    }

    // Remove subdirectories
    for (const dir of subdirectories) {
      const dirPath = path.join(steeringPath, dir);
      try {
        await fs.remove(dirPath);
        cleanedDirs.push(dir);
        console.log(chalk.green(`✓ Removed directory: ${dir}/`));
      } catch (error) {
        console.error(chalk.red(`✗ Failed to remove ${dir}/: ${error.message}`));
      }
    }

    console.log(chalk.green('\n✓ Steering directory cleaned successfully!\n'));
    console.log(chalk.blue('Backup location:'));
    console.log(`  ${backupPath}\n`);
    console.log(chalk.blue('To restore from backup:'));
    console.log(`  kse rollback --backup ${path.basename(backupPath)}\n`);

    return {
      success: true,
      message: 'Steering directory fixed successfully',
      backupPath,
      cleanedFiles,
      cleanedDirs
    };
  }

  /**
   * Create differential backup of violations only
   * @private
   */
  async _createBackup(steeringPath, files, dirs) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupId = `steering-cleanup-${timestamp}`;
    const backupPath = path.join(path.dirname(path.dirname(steeringPath)), 'backups', backupId);

    // Create backup directory
    await fs.ensureDir(backupPath);

    // Backup disallowed files
    for (const file of files) {
      const sourcePath = path.join(steeringPath, file);
      const destPath = path.join(backupPath, file);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
      }
    }

    // Backup subdirectories
    for (const dir of dirs) {
      const sourcePath = path.join(steeringPath, dir);
      const destPath = path.join(backupPath, dir);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
      }
    }

    // Create backup manifest
    const manifest = {
      backupId,
      timestamp: new Date().toISOString(),
      type: 'steering-cleanup',
      steeringPath,
      files,
      directories: dirs,
      totalItems: files.length + dirs.length
    };

    await fs.writeJson(path.join(backupPath, 'manifest.json'), manifest, { spaces: 2 });

    return backupPath;
  }

  /**
   * Restore from backup
   * @param {string} backupPath - Path to backup directory
   * @param {string} steeringPath - Path to steering directory
   */
  async restore(backupPath, steeringPath) {
    // Read manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('Invalid backup: manifest.json not found');
    }

    const manifest = await fs.readJson(manifestPath);

    console.log(chalk.yellow('\n🔄 Restoring from backup...\n'));

    // Restore files
    for (const file of manifest.files) {
      const sourcePath = path.join(backupPath, file);
      const destPath = path.join(steeringPath, file);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        console.log(chalk.green(`✓ Restored file: ${file}`));
      }
    }

    // Restore directories
    for (const dir of manifest.directories) {
      const sourcePath = path.join(backupPath, dir);
      const destPath = path.join(steeringPath, dir);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        console.log(chalk.green(`✓ Restored directory: ${dir}/`));
      }
    }

    console.log(chalk.green('\n✓ Restore completed!\n'));

    return {
      success: true,
      restoredFiles: manifest.files,
      restoredDirs: manifest.directories
    };
  }
}

module.exports = ComplianceAutoFixer;
