/**
 * Rollback Command
 * 
 * Restores project from a backup.
 * Provides safety net for failed adoptions or upgrades.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const BackupSystem = require('../backup/backup-system');

/**
 * Executes the rollback command
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.auto - Skip confirmations
 * @param {string} options.backup - Specific backup ID to restore
 * @returns {Promise<void>}
 */
async function rollbackCommand(options = {}) {
  const { auto = false, backup: backupId = null } = options;
  const projectPath = process.cwd();
  
  console.log(chalk.red('🔥') + ' Scene Capability Engine - Rollback');
  console.log();
  
  try {
    const backupSystem = new BackupSystem();
    
    // 1. List available backups
    console.log(chalk.blue('📦 Loading backups...'));
    const backups = await backupSystem.listBackups(projectPath);
    
    if (backups.length === 0) {
      console.log(chalk.yellow('⚠️  No backups found'));
      console.log();
      console.log(chalk.gray('Backups are created automatically during:'));
      console.log('  - Project adoption (sce adopt)');
      console.log('  - Version upgrades (sce upgrade)');
      return;
    }
    
    console.log();
    console.log(chalk.blue('Available backups:'));
    backups.forEach((backup, index) => {
      const date = new Date(backup.created).toLocaleString();
      const size = (backup.size / 1024).toFixed(1);
      console.log(`  ${index + 1}. ${chalk.cyan(backup.id)}`);
      console.log(`     Type: ${backup.type}`);
      console.log(`     Version: ${backup.version}`);
      console.log(`     Created: ${date}`);
      console.log(`     Size: ${size} KB (${backup.files} files)`);
      console.log();
    });
    
    // 2. Select backup
    let selectedBackup;
    
    if (backupId) {
      // Use specified backup ID
      selectedBackup = backups.find(b => b.id === backupId);
      
      if (!selectedBackup) {
        console.log(chalk.red(`❌ Backup not found: ${backupId}`));
        console.log();
        console.log(chalk.gray('Available backups:'));
        backups.forEach(b => console.log(`  - ${b.id}`));
        return;
      }
    } else {
      // Interactive selection
      const { selection } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selection',
          message: 'Select backup to restore:',
          choices: backups.map((backup, index) => ({
            name: `${backup.id} (${backup.type}, ${new Date(backup.created).toLocaleString()})`,
            value: index
          }))
        }
      ]);
      
      selectedBackup = backups[selection];
    }
    
    console.log();
    console.log(chalk.blue('Selected backup:'));
    console.log(`  ID: ${chalk.cyan(selectedBackup.id)}`);
    console.log(`  Type: ${selectedBackup.type}`);
    console.log(`  Version: ${selectedBackup.version}`);
    console.log(`  Created: ${new Date(selectedBackup.created).toLocaleString()}`);
    console.log();
    
    // 3. Validate backup
    console.log(chalk.blue('🔍 Validating backup...'));
    const isValid = await backupSystem.validateBackup(selectedBackup.path);
    
    if (!isValid) {
      console.log(chalk.red('❌ Backup validation failed'));
      console.log();
      console.log(chalk.yellow('This backup may be corrupted or incomplete.'));
      console.log(chalk.gray('Proceeding with restore may cause data loss.'));
      
      if (!auto) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Proceed anyway? (not recommended)',
            default: false
          }
        ]);
        
        if (!proceed) {
          console.log(chalk.yellow('Rollback cancelled'));
          return;
        }
      } else {
        console.log(chalk.red('Aborting rollback (use --force to override)'));
        return;
      }
    } else {
      console.log(chalk.green('✅ Backup is valid'));
    }
    
    console.log();
    
    // 4. Confirm with user (unless --auto)
    if (!auto) {
      console.log(chalk.yellow('⚠️  Warning: This will replace your current .sce/ directory'));
      console.log(chalk.gray('A backup of the current state will be created first'));
      console.log();
      
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Restore from backup ${selectedBackup.id}?`,
          default: false
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Rollback cancelled'));
        return;
      }
    }
    
    console.log();
    
    // 5. Create backup of current state
    console.log(chalk.blue('📦 Creating backup of current state...'));
    
    let currentBackup;
    try {
      currentBackup = await backupSystem.createBackup(projectPath, { type: 'pre-rollback' });
      console.log(chalk.green(`✅ Current state backed up: ${currentBackup.id}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not create backup: ${error.message}`));
      console.log(chalk.gray('Continuing with rollback...'));
    }
    
    console.log();
    
    // 6. Restore from backup
    console.log(chalk.blue('🔄 Restoring from backup...'));
    
    const result = await backupSystem.restore(projectPath, selectedBackup.id);
    
    console.log();
    
    // 7. Report results
    if (result.success) {
      console.log(chalk.green('✅ Rollback completed successfully!'));
      console.log();
      console.log(`  Restored ${result.filesRestored} files from backup`);
      console.log(`  Backup: ${chalk.cyan(selectedBackup.id)}`);
      
      if (currentBackup) {
        console.log();
        console.log(chalk.blue('📦 Previous state backed up:'), currentBackup.id);
        console.log(chalk.gray('  You can restore it if needed'));
      }
      
      console.log();
      console.log(chalk.blue('💡 Next steps:'));
      console.log('  1. Verify your project is working correctly');
      console.log('  2. Check project status: ' + chalk.cyan('sce status'));
      console.log();
      console.log(chalk.red('🔥') + ' Rollback complete!');
    } else {
      console.log(chalk.red('❌ Rollback failed'));
      console.log();
      console.log(chalk.red('This is a critical error. Your project may be in an inconsistent state.'));
      
      if (currentBackup) {
        console.log();
        console.log(chalk.blue('📦 Pre-rollback backup available:'), currentBackup.id);
        console.log(chalk.gray('  You may be able to restore from this backup'));
      }
      
      console.log();
      console.log(chalk.gray('Please report this issue:'));
      console.log(chalk.cyan('https://github.com/heguangyong/scene-capability-engine/issues'));
      
      process.exit(1);
    }
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    console.log();
    console.log(chalk.gray('If you need help, please report this issue:'));
    console.log(chalk.cyan('https://github.com/heguangyong/scene-capability-engine/issues'));
    process.exit(1);
  }
}

module.exports = rollbackCommand;
