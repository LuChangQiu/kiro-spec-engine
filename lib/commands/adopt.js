/**
 * Adopt Command
 * 
 * Intelligently adopts existing projects into kiro-spec-engine.
 * Supports fresh, partial, and full adoption modes.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const DetectionEngine = require('../adoption/detection-engine');
const { getAdoptionStrategy } = require('../adoption/adoption-strategy');
const BackupSystem = require('../backup/backup-system');
const VersionManager = require('../version/version-manager');
const SteeringManager = require('../steering/steering-manager');
const AdoptionConfig = require('../steering/adoption-config');
const { detectTool, generateAutoConfig } = require('../utils/tool-detector');

/**
 * Executes the adopt command
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.auto - Skip confirmations
 * @param {boolean} options.dryRun - Show what would change without making changes
 * @param {string} options.mode - Force specific adoption mode (fresh/partial/full)
 * @returns {Promise<void>}
 */
async function adoptCommand(options = {}) {
  const { auto = false, dryRun = false, mode: forcedMode = null } = options;
  const projectPath = process.cwd();
  
  console.log(chalk.red('🔥') + ' Kiro Spec Engine - Project Adoption');
  console.log();
  
  try {
    // 1. Detect project structure
    console.log(chalk.blue('📦 Analyzing project structure...'));
    const detectionEngine = new DetectionEngine();
    const detection = await detectionEngine.analyze(projectPath);
    
    // 2. Determine strategy
    const strategy = forcedMode || detectionEngine.determineStrategy(detection);
    
    // 3. Show analysis to user
    console.log();
    console.log(detectionEngine.getSummary(detection));
    console.log();
    
    // 4. Show adoption plan
    console.log(chalk.blue('📋 Adoption Plan:'));
    console.log(`  Mode: ${chalk.cyan(strategy)}`);
    
    if (strategy === 'fresh') {
      console.log('  Actions:');
      console.log('    - Create .kiro/ directory structure');
      console.log('    - Copy template files (steering, tools, docs)');
      console.log('    - Create version.json');
    } else if (strategy === 'partial') {
      console.log('  Actions:');
      console.log('    - Preserve existing specs/ and steering/');
      console.log('    - Add missing components');
      console.log('    - Create/update version.json');
      if (detection.hasKiroDir) {
        console.log('    - Create backup before changes');
      }
    } else if (strategy === 'full') {
      console.log('  Actions:');
      console.log(`    - Upgrade from ${detection.existingVersion || 'unknown'} to current version`);
      console.log('    - Update template files');
      console.log('    - Preserve user content (specs/)');
      console.log('    - Create backup before changes');
    }
    
    // Show conflicts if any
    if (detection.conflicts.length > 0) {
      console.log();
      console.log(chalk.yellow('⚠️  Conflicts detected:'));
      detection.conflicts.forEach(conflict => {
        console.log(`    - ${conflict.path}`);
      });
      console.log('  Existing files will be preserved, template files will be skipped');
    }
    
    console.log();
    
    // 5. Dry run mode
    if (dryRun) {
      console.log(chalk.yellow('🔍 Dry run mode - no changes will be made'));
      console.log();
      
      const adoptionStrategy = getAdoptionStrategy(strategy);
      const versionManager = new VersionManager();
      const packageJson = require('../../package.json');
      
      const result = await adoptionStrategy.execute(projectPath, strategy, {
        kseVersion: packageJson.version,
        dryRun: true
      });
      
      if (result.success) {
        console.log(chalk.green('✅ Dry run completed successfully'));
        console.log();
        console.log('Files that would be created:');
        result.filesCreated.forEach(file => console.log(`  + ${file}`));
        if (result.filesUpdated.length > 0) {
          console.log('Files that would be updated:');
          result.filesUpdated.forEach(file => console.log(`  ~ ${file}`));
        }
        if (result.filesSkipped.length > 0) {
          console.log('Files that would be skipped:');
          result.filesSkipped.forEach(file => console.log(`  - ${file}`));
        }
      } else {
        console.log(chalk.red('❌ Dry run failed'));
        result.errors.forEach(error => console.log(`  ${error}`));
      }
      
      return;
    }
    
    // 6. Confirm with user (unless --auto)
    if (!auto) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with adoption?',
          default: true
        }
      ]);
      
      if (!confirmed) {
        console.log(chalk.yellow('Adoption cancelled'));
        return;
      }
    }
    
    console.log();
    
    // 7. Handle steering strategy if conflicts detected
    let steeringStrategy = null;
    let steeringBackupId = null;
    
    if (detection.steeringDetection && detection.steeringDetection.hasExistingSteering) {
      console.log(chalk.blue('🎯 Handling steering files...'));
      const steeringManager = new SteeringManager();
      
      // Prompt for strategy
      steeringStrategy = await steeringManager.promptStrategy(detection.steeringDetection);
      
      if (steeringStrategy === 'use-kse') {
        // Backup existing steering files
        console.log(chalk.blue('📦 Backing up existing steering files...'));
        const backupResult = await steeringManager.backupSteering(projectPath);
        
        if (backupResult.success) {
          steeringBackupId = backupResult.backupId;
          console.log(chalk.green(`✅ Steering backup created: ${steeringBackupId}`));
          
          // Install kse steering files
          console.log(chalk.blue('📝 Installing kse steering files...'));
          const installResult = await steeringManager.installKseSteering(projectPath);
          
          if (installResult.success) {
            console.log(chalk.green(`✅ Installed ${installResult.filesInstalled} kse steering file(s)`));
          } else {
            console.log(chalk.red(`❌ Failed to install kse steering: ${installResult.error}`));
            console.log(chalk.yellow('Aborting adoption'));
            return;
          }
        } else {
          console.log(chalk.red(`❌ Failed to backup steering: ${backupResult.error}`));
          console.log(chalk.yellow('Aborting adoption for safety'));
          return;
        }
      } else if (steeringStrategy === 'use-project') {
        console.log(chalk.blue('✅ Keeping existing steering files'));
      }
      
      // Save steering strategy to adoption config
      const adoptionConfig = new AdoptionConfig(projectPath);
      await adoptionConfig.updateSteeringStrategy(steeringStrategy, steeringBackupId);
      
      console.log();
    }
    
    // 8. Create backup if needed
    let backupId = null;
    if (detection.hasKiroDir && (strategy === 'partial' || strategy === 'full')) {
      console.log(chalk.blue('📦 Creating backup...'));
      const backupSystem = new BackupSystem();
      
      try {
        const backup = await backupSystem.createBackup(projectPath, { type: 'adopt' });
        backupId = backup.id;
        console.log(chalk.green(`✅ Backup created: ${backupId}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to create backup: ${error.message}`));
        console.log(chalk.yellow('Aborting adoption for safety'));
        return;
      }
    }
    
    console.log();
    
    // 9. Execute adoption
    console.log(chalk.blue('🚀 Executing adoption...'));
    const adoptionStrategy = getAdoptionStrategy(strategy);
    const packageJson = require('../../package.json');
    
    const result = await adoptionStrategy.execute(projectPath, strategy, {
      kseVersion: packageJson.version,
      dryRun: false,
      backupId
    });
    
    console.log();
    
    // 10. Report results
    if (result.success) {
      console.log(chalk.green('✅ Adoption completed successfully!'));
      console.log();
      
      if (steeringStrategy) {
        console.log(chalk.blue('Steering Strategy:'), steeringStrategy);
        if (steeringBackupId) {
          console.log(chalk.gray('  Backup:'), steeringBackupId);
        }
        console.log();
      }
      
      if (result.filesCreated.length > 0) {
        console.log(chalk.blue('Files created:'));
        result.filesCreated.forEach(file => console.log(`  + ${file}`));
      }
      
      if (result.filesUpdated.length > 0) {
        console.log(chalk.blue('Files updated:'));
        result.filesUpdated.forEach(file => console.log(`  ~ ${file}`));
      }
      
      if (result.filesSkipped.length > 0) {
        console.log(chalk.gray('Files skipped:'));
        result.filesSkipped.forEach(file => console.log(`  - ${file}`));
      }
      
      if (result.warnings.length > 0) {
        console.log();
        console.log(chalk.yellow('⚠️  Warnings:'));
        result.warnings.forEach(warning => console.log(`  ${warning}`));
      }
      
      if (backupId) {
        console.log();
        console.log(chalk.blue('📦 Backup:'), backupId);
        console.log(chalk.gray('  Run'), chalk.cyan('kse rollback'), chalk.gray('if you need to undo changes'));
      }
      
      console.log();
      
      // 11. Detect tool and offer automation setup
      console.log(chalk.blue('🔍 Detecting your development environment...'));
      try {
        const toolDetection = await detectTool(projectPath);
        const autoConfig = await generateAutoConfig(toolDetection, projectPath);
        
        console.log();
        console.log(chalk.blue('Tool Detected:'), chalk.cyan(toolDetection.primaryTool));
        console.log(chalk.blue('Confidence:'), autoConfig.confidence);
        
        if (autoConfig.notes.length > 0) {
          console.log();
          autoConfig.notes.forEach(note => console.log(chalk.gray(`  ℹ️  ${note}`)));
        }
        
        // Offer automation setup (unless --auto)
        if (!auto && autoConfig.suggestedPresets.length > 0) {
          console.log();
          const { setupAutomation } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'setupAutomation',
              message: 'Would you like to set up automation for this tool?',
              default: true
            }
          ]);
          
          if (setupAutomation) {
            console.log();
            console.log(chalk.blue('📋 Recommended automation setup:'));
            console.log();
            console.log(chalk.gray('Suggested presets:'));
            autoConfig.suggestedPresets.forEach(preset => {
              console.log(`  - ${preset}`);
            });
            console.log();
            console.log(chalk.gray('Run these commands to set up:'));
            autoConfig.suggestedCommands.forEach(cmd => {
              console.log(chalk.cyan(`  ${cmd}`));
            });
          }
        } else if (autoConfig.suggestedCommands.length > 0) {
          console.log();
          console.log(chalk.blue('💡 Automation setup:'));
          autoConfig.suggestedCommands.forEach(cmd => {
            console.log(chalk.gray(`  ${cmd}`));
          });
        }
      } catch (toolError) {
        // Tool detection is optional, don't fail adoption if it errors
        console.log(chalk.yellow('⚠️  Could not detect development tool'));
        console.log(chalk.gray('  You can manually set up automation later'));
      }
      
      console.log();
      console.log(chalk.blue('💡 Next steps:'));
      console.log('  1. Review the .kiro/ directory structure');
      console.log('  2. Create your first spec: ' + chalk.cyan('kse create-spec my-feature'));
      console.log('  3. Check project status: ' + chalk.cyan('kse status'));
      console.log();
      console.log(chalk.red('🔥') + ' Ready to build with Kiro Spec Engine!');
    } else {
      console.log(chalk.red('❌ Adoption failed'));
      console.log();
      result.errors.forEach(error => console.log(chalk.red(`  ${error}`)));
      
      if (backupId) {
        console.log();
        console.log(chalk.blue('📦 Backup available:'), backupId);
        console.log(chalk.gray('  Run'), chalk.cyan('kse rollback'), chalk.gray('to restore'));
      }
      
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

module.exports = adoptCommand;
