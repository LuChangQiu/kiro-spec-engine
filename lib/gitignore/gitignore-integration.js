/**
 * GitignoreIntegration - Integrates .gitignore auto-fix with adopt/upgrade flows
 * 
 * Coordinates detection, backup, transformation, and reporting for .gitignore fixes.
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const GitignoreDetector = require('./gitignore-detector');
const GitignoreTransformer = require('./gitignore-transformer');
const GitignoreBackup = require('./gitignore-backup');

/**
 * @typedef {Object} GitignoreFixResult
 * @property {boolean} success - Fix succeeded
 * @property {string} action - 'created' | 'updated' | 'skipped'
 * @property {string} backupId - Backup ID (if created)
 * @property {string[]} added - Rules added
 * @property {string[]} removed - Rules removed
 * @property {string} message - User-friendly message
 */

class GitignoreIntegration {
  constructor(dependencies = {}) {
    this.detector = dependencies.detector || new GitignoreDetector();
    this.transformer = dependencies.transformer || new GitignoreTransformer();
    this.backup = dependencies.backup || new GitignoreBackup();
  }

  /**
   * Runs .gitignore check and fix
   * 
   * @param {string} projectPath - Project root path
   * @param {Object} options - Integration options
   * @param {boolean} options.skipBackup - Skip backup creation (dangerous)
   * @param {boolean} options.dryRun - Preview without executing
   * @returns {Promise<GitignoreFixResult>}
   */
  async checkAndFix(projectPath, options = {}) {
    const { skipBackup = false, dryRun = false } = options;
    
    try {
      // Stage 1: Detect .gitignore status
      const status = await this.detector.analyzeGitignore(projectPath);
      
      // If compliant, no action needed
      if (status.strategy === 'skip') {
        return {
          success: true,
          action: 'skipped',
          backupId: null,
          added: [],
          removed: [],
          message: '.gitignore already optimal'
        };
      }
      
      // Stage 2: Transform content
      const transformResult = this.transformer.transform(status.content, status);
      
      // Dry run mode - stop here
      if (dryRun) {
        return {
          success: true,
          action: status.strategy === 'add' ? 'would-create' : 'would-update',
          backupId: null,
          added: transformResult.added,
          removed: transformResult.removed,
          message: 'Dry run - no changes made'
        };
      }
      
      // Stage 3: Create backup (if file exists and not skipped)
      let backupId = null;
      if (status.exists && !skipBackup) {
        const backupInfo = await this.backup.createBackup(projectPath);
        backupId = backupInfo.id;
      }
      
      // Stage 4: Write new .gitignore
      const gitignorePath = path.join(projectPath, '.gitignore');
      await fs.writeFile(gitignorePath, transformResult.content, 'utf8');
      
      // Stage 5: Return result
      return {
        success: true,
        action: status.strategy === 'add' ? 'created' : 'updated',
        backupId,
        added: transformResult.added,
        removed: transformResult.removed,
        message: this.generateSuccessMessage(status, backupId)
      };
      
    } catch (error) {
      return {
        success: false,
        action: 'failed',
        backupId: null,
        added: [],
        removed: [],
        message: `Failed to fix .gitignore: ${error.message}`
      };
    }
  }

  /**
   * Integrates with adoption flow
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<GitignoreFixResult>}
   */
  async integrateWithAdopt(projectPath) {
    return await this.checkAndFix(projectPath);
  }

  /**
   * Integrates with upgrade flow
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<GitignoreFixResult>}
   */
  async integrateWithUpgrade(projectPath) {
    return await this.checkAndFix(projectPath);
  }

  /**
   * Standalone doctor command
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<GitignoreFixResult>}
   */
  async runDoctor(projectPath) {
    console.log(chalk.blue('🔍 Checking .gitignore configuration...'));
    console.log();
    
    const result = await this.checkAndFix(projectPath);
    
    // Display detailed result
    this.displayDoctorResult(result);
    
    return result;
  }

  /**
   * Generates success message
   * 
   * @param {Object} status - Detection status
   * @param {string} backupId - Backup ID
   * @returns {string}
   */
  generateSuccessMessage(status, backupId) {
    if (status.strategy === 'add') {
      return '.gitignore created with layered strategy';
    } else if (status.strategy === 'update') {
      return `.gitignore updated for team collaboration${backupId ? ` (backup: ${backupId})` : ''}`;
    }
    return '.gitignore already optimal';
  }

  /**
   * Displays doctor command result
   * 
   * @param {GitignoreFixResult} result - Fix result
   */
  displayDoctorResult(result) {
    if (result.action === 'skipped') {
      console.log(chalk.green('✅ .gitignore is already optimal'));
      console.log();
      console.log(chalk.gray('  Current strategy: Layered .sce/ management'));
      console.log(chalk.gray('  - Specs are committable'));
      console.log(chalk.gray('  - Personal state is excluded'));
      console.log();
      return;
    }
    
    if (!result.success) {
      console.log(chalk.red('❌ Failed to fix .gitignore'));
      console.log();
      console.log(chalk.red(`  ${result.message}`));
      console.log();
      return;
    }
    
    console.log(chalk.green(`✅ .gitignore ${result.action}`));
    console.log();
    
    if (result.backupId) {
      console.log(chalk.blue('📦 Backup created:'), result.backupId);
      console.log(chalk.gray('  Location:'), `.sce/backups/${result.backupId}`);
      console.log();
    }
    
    if (result.removed.length > 0) {
      console.log(chalk.yellow('Removed old patterns:'));
      result.removed.forEach(pattern => {
        console.log(chalk.red(`  - ${pattern}`));
      });
      console.log();
    }
    
    if (result.added.length > 0) {
      console.log(chalk.green('Added layered rules:'));
      console.log(chalk.gray(`  + ${result.added.length} exclusion rules`));
      console.log();
    }
    
    console.log(chalk.blue('💡 What this means:'));
    console.log('  ✅ Spec documents are now committable');
    console.log('  ✅ Team can see requirements, design, and tasks');
    console.log('  ✅ Personal state is excluded (no merge conflicts)');
    console.log();
    
    console.log(chalk.gray('  Learn more:'), chalk.cyan('docs/team-collaboration-guide.md'));
    
    if (result.backupId) {
      console.log();
      console.log(chalk.gray('  To rollback:'), chalk.cyan(`sce doctor --restore-gitignore ${result.backupId}`));
    }
    
    console.log();
  }

  /**
   * Displays integration result (for adopt/upgrade flows)
   * 
   * @param {GitignoreFixResult} result - Fix result
   */
  displayIntegrationResult(result) {
    if (result.action === 'skipped') {
      return; // No output for compliant .gitignore
    }
    
    if (!result.success) {
      console.log(chalk.yellow('⚠️  .gitignore fix failed:'), result.message);
      console.log(chalk.gray('  Run'), chalk.cyan('sce doctor --fix-gitignore'), chalk.gray('to fix manually'));
      return;
    }
    
    console.log(chalk.blue('📝 .gitignore updated for team collaboration'));
    
    if (result.backupId) {
      console.log(chalk.gray('  Backup:'), result.backupId);
    }
    
    if (result.removed.length > 0) {
      console.log(chalk.gray('  Changes:'));
      console.log(chalk.yellow(`    - Removed ${result.removed.length} old pattern(s)`));
    }
    
    console.log(chalk.green('    + Added layered .sce/ exclusion rules'));
    console.log(chalk.green('    + Specs are now committable'));
    console.log(chalk.green('    + Personal state is excluded'));
    console.log();
    
    console.log(chalk.blue('💡 Why this matters:'));
    console.log('  - Team can see Spec documents (requirements, design, tasks)');
    console.log('  - No merge conflicts on personal state');
    console.log('  - Follows best practices for team collaboration');
    console.log();
    
    console.log(chalk.gray('  Learn more:'), chalk.cyan('docs/team-collaboration-guide.md'));
    console.log();
  }
}

module.exports = GitignoreIntegration;
