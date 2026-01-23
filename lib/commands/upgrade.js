/**
 * Upgrade Command
 * 
 * Upgrades project to a newer version of kiro-spec-engine.
 * Handles incremental upgrades and migration scripts.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const VersionManager = require('../version/version-manager');
const MigrationEngine = require('../upgrade/migration-engine');
const BackupSystem = require('../backup/backup-system');

/**
 * Executes the upgrade command
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.auto - Skip confirmations
 * @param {boolean} options.dryRun - Show upgrade plan without making changes
 * @param {string} options.to - Target version (default: current kse version)
 * @returns {Promise<void>}
 */
async function upgradeCommand(options = {}) {
  const { auto = false, dryRun = false, to: targetVersion = null } = options;
  const projectPath = process.cwd();
  
  console.log(chalk.red('🔥') + ' Kiro Spec Engine - Project Upgrade');
  console.log();
  
  try {
    const versionManager = new VersionManager();
    const migrationEngine = new MigrationEngine();
    const packageJson = require('../../package.json');
    
    // 1. Read current version
    console.log(chalk.blue('📦 Checking project version...'));
    const currentVersionInfo = await versionManager.readVersion(projectPath);
    
    if (!currentVersionInfo) {
      console.log(chalk.red('❌ No version.json found'));
      console.log();
      console.log(chalk.yellow('This project may not be initialized with kse.'));
      console.log(chalk.gray('Run'), chalk.cyan('kse adopt'), chalk.gray('to adopt this project first.'));
      return;
    }
    
    const currentVersion = currentVersionInfo['kse-version'];
    const targetVer = targetVersion || packageJson.version;
    
    console.log(`  Current version: ${chalk.cyan(currentVersion)}`);
    console.log(`  Target version: ${chalk.cyan(targetVer)}`);
    console.log();
    
    // 2. Check if upgrade is needed
    if (!versionManager.needsUpgrade(currentVersion, targetVer)) {
      console.log(chalk.green(`✅ Already at version ${targetVer}`));
      console.log(chalk.gray('No upgrade needed'));
      return;
    }
    
    // 3. Plan upgrade
    console.log(chalk.blue('📋 Planning upgrade...'));
    const plan = await migrationEngine.planUpgrade(currentVersion, targetVer);
    
    console.log();
    console.log(chalk.blue('Upgrade Plan:'));
    console.log(`  From: ${chalk.cyan(plan.fromVersion)}`);
    console.log(`  To: ${chalk.cyan(plan.toVersion)}`);
    console.log(`  Path: ${plan.path.map(v => chalk.cyan(v)).join(' → ')}`);
    console.log(`  Estimated time: ${plan.estimatedTime}`);
    
    if (plan.migrations.length > 0) {
      console.log();
      console.log(chalk.blue('Migrations:'));
      plan.migrations.forEach((migration, index) => {
        const icon = migration.breaking ? chalk.red('⚠️ ') : chalk.green('✅');
        const label = migration.breaking ? chalk.red('BREAKING') : chalk.green('safe');
        console.log(`  ${index + 1}. ${migration.from} → ${migration.to} [${label}]`);
        if (migration.script) {
          console.log(`     Script: ${chalk.gray(path.basename(migration.script))}`);
        } else {
          console.log(`     ${chalk.gray('No migration script needed')}`);
        }
      });
    } else {
      console.log();
      console.log(chalk.gray('No migrations needed'));
    }
    
    console.log();
    
    // 4. Dry run mode
    if (dryRun) {
      console.log(chalk.yellow('🔍 Dry run mode - no changes will be made'));
      console.log();
      
      const result = await migrationEngine.executeUpgrade(projectPath, plan, {
        dryRun: true
      });
      
      if (result.success) {
        console.log(chalk.green('✅ Dry run completed successfully'));
        console.log();
        console.log('Migrations that would be executed:');
        result.migrationsExecuted.forEach((migration, index) => {
          console.log(`  ${index + 1}. ${migration.from} → ${migration.to}`);
          migration.changes.forEach(change => {
            console.log(`     - ${change}`);
          });
        });
      } else {
        console.log(chalk.red('❌ Dry run failed'));
        result.errors.forEach(error => console.log(`  ${error}`));
      }
      
      return;
    }
    
    // 5. Confirm with user (unless --auto)
    if (!auto) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with upgrade?',
          default: true
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Upgrade cancelled'));
        return;
      }
    }
    
    console.log();
    
    // 6. Create backup
    console.log(chalk.blue('📦 Creating backup...'));
    const backupSystem = new BackupSystem();
    
    let backup;
    try {
      backup = await backupSystem.createBackup(projectPath, { type: 'upgrade' });
      console.log(chalk.green(`✅ Backup created: ${backup.id}`));
    } catch (error) {
      console.log(chalk.red(`❌ Failed to create backup: ${error.message}`));
      console.log(chalk.yellow('Aborting upgrade for safety'));
      return;
    }
    
    console.log();
    
    // 7. Execute upgrade
    console.log(chalk.blue('🚀 Executing upgrade...'));
    
    const result = await migrationEngine.executeUpgrade(projectPath, plan, {
      dryRun: false,
      onProgress: (step, total, message) => {
        console.log(`  [${step}/${total}] ${message}`);
      }
    });
    
    console.log();
    
    // 8. Validate
    console.log(chalk.blue('🔍 Validating upgrade...'));
    const validation = await migrationEngine.validate(projectPath);
    
    if (!validation.success) {
      console.log(chalk.yellow('⚠️  Validation warnings:'));
      validation.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    console.log();
    
    // 9. Report results
    if (result.success) {
      console.log(chalk.green('✅ Upgrade completed successfully!'));
      console.log();
      console.log(`  Upgraded from ${chalk.cyan(result.fromVersion)} to ${chalk.cyan(result.toVersion)}`);
      
      if (result.migrationsExecuted.length > 0) {
        console.log();
        console.log(chalk.blue('Migrations executed:'));
        result.migrationsExecuted.forEach((migration, index) => {
          const icon = migration.success ? chalk.green('✅') : chalk.red('❌');
          console.log(`  ${icon} ${migration.from} → ${migration.to}`);
          if (migration.changes.length > 0) {
            migration.changes.forEach(change => {
              console.log(`     - ${change}`);
            });
          }
        });
      }
      
      if (result.warnings.length > 0) {
        console.log();
        console.log(chalk.yellow('⚠️  Warnings:'));
        result.warnings.forEach(warning => console.log(`  ${warning}`));
      }
      
      console.log();
      console.log(chalk.blue('📦 Backup:'), backup.id);
      console.log(chalk.gray('  Run'), chalk.cyan('kse rollback'), chalk.gray('if you encounter issues'));
      
      console.log();
      console.log(chalk.red('🔥') + ' Upgrade complete!');
    } else {
      console.log(chalk.red('❌ Upgrade failed'));
      console.log();
      result.errors.forEach(error => console.log(chalk.red(`  ${error}`)));
      
      console.log();
      console.log(chalk.blue('📦 Backup available:'), backup.id);
      console.log(chalk.gray('  Run'), chalk.cyan('kse rollback'), chalk.gray('to restore'));
      
      process.exit(1);
    }
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    console.log();
    console.log(chalk.gray('If you need help, please report this issue:'));
    console.log(chalk.cyan('https://github.com/heguangyong/kiro-spec-engine/issues'));
    process.exit(1);
  }
}

module.exports = upgradeCommand;
