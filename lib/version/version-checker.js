/**
 * Version Checker
 * 
 * Automatically detects version mismatches between project and installed sce.
 * Displays warnings and upgrade suggestions.
 */

const chalk = require('chalk');
const VersionManager = require('./version-manager');

class VersionChecker {
  constructor() {
    this.versionManager = new VersionManager();
    this.suppressWarnings = false;
  }

  /**
   * Checks for version mismatch and displays warning if needed
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {Object} options - Check options
   * @param {boolean} options.noVersionCheck - Suppress warnings
   * @returns {Promise<VersionCheckResult>}
   */
  async checkVersion(projectPath, options = {}) {
    const { noVersionCheck = false } = options;
    
    if (noVersionCheck || this.suppressWarnings) {
      return { mismatch: false, shouldUpgrade: false };
    }
    
    try {
      // Read project version
      const projectVersionInfo = await this.versionManager.readVersion(projectPath);
      
      if (!projectVersionInfo) {
        // No version.json - project might not be initialized
        return { mismatch: false, shouldUpgrade: false };
      }
      
      const projectVersion = projectVersionInfo['sce-version'];
      
      // Get current sce version
      const packageJson = require('../../package.json');
      const sceVersion = packageJson.version;
      
      // Check if upgrade is needed
      const needsUpgrade = this.versionManager.needsUpgrade(projectVersion, sceVersion);
      
      if (needsUpgrade) {
        this.displayWarning(projectVersion, sceVersion);
      }
      
      return {
        mismatch: needsUpgrade,
        shouldUpgrade: needsUpgrade,
        projectVersion,
        sceVersion
      };
    } catch (error) {
      // Silently fail - don't block commands if version check fails
      return { mismatch: false, shouldUpgrade: false, error: error.message };
    }
  }

  /**
   * Displays version mismatch warning
   * 
   * @param {string} projectVersion - Project version
   * @param {string} sceVersion - Current sce version
   */
  displayWarning(projectVersion, sceVersion) {
    console.log();
    console.log(chalk.yellow('⚠️  Version Mismatch Detected'));
    console.log(chalk.gray('  Project initialized with sce'), chalk.cyan(`v${projectVersion}`));
    console.log(chalk.gray('  Current sce version:'), chalk.cyan(`v${sceVersion}`));
    console.log();
    console.log(chalk.blue('💡 Tip:'), chalk.gray('Run'), chalk.cyan('sce upgrade'), chalk.gray('to update project templates'));
    console.log(chalk.gray('  Or use'), chalk.cyan('--no-version-check'), chalk.gray('to suppress this warning'));
    console.log();
  }

  /**
   * Checks version and displays detailed information
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<void>}
   */
  async displayVersionInfo(projectPath) {
    try {
      const projectVersionInfo = await this.versionManager.readVersion(projectPath);
      
      if (!projectVersionInfo) {
        console.log(chalk.yellow('⚠️  No version information found'));
        console.log(chalk.gray('  This project may not be initialized with sce'));
        console.log(chalk.gray('  Run'), chalk.cyan('sce adopt'), chalk.gray('to adopt this project'));
        return;
      }
      
      const packageJson = require('../../package.json');
      const sceVersion = packageJson.version;
      
      console.log(chalk.blue('📦 Version Information'));
      console.log();
      console.log(chalk.gray('Project:'));
      console.log(`  sce version: ${chalk.cyan(projectVersionInfo['sce-version'])}`);
      console.log(`  Template version: ${chalk.cyan(projectVersionInfo['template-version'])}`);
      console.log(`  Created: ${chalk.gray(new Date(projectVersionInfo.created).toLocaleString())}`);
      console.log(`  Last upgraded: ${chalk.gray(new Date(projectVersionInfo['last-upgraded']).toLocaleString())}`);
      
      console.log();
      console.log(chalk.gray('Installed:'));
      console.log(`  sce version: ${chalk.cyan(sceVersion)}`);
      
      if (projectVersionInfo['upgrade-history'].length > 0) {
        console.log();
        console.log(chalk.gray('Upgrade History:'));
        projectVersionInfo['upgrade-history'].forEach((entry, index) => {
          const icon = entry.success ? chalk.green('✅') : chalk.red('❌');
          const date = new Date(entry.date).toLocaleString();
          console.log(`  ${icon} ${entry.from} → ${entry.to} (${date})`);
          if (entry.error) {
            console.log(`     ${chalk.red('Error:')} ${entry.error}`);
          }
        });
      }
      
      console.log();
      
      const needsUpgrade = this.versionManager.needsUpgrade(
        projectVersionInfo['sce-version'],
        sceVersion
      );
      
      if (needsUpgrade) {
        console.log(chalk.yellow('⚠️  Upgrade available'));
        console.log(chalk.gray('  Run'), chalk.cyan('sce upgrade'), chalk.gray('to update to'), chalk.cyan(`v${sceVersion}`));
      } else {
        console.log(chalk.green('✅ Project is up to date'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Error:'), error.message);
    }
  }

  /**
   * Suppresses version check warnings
   * 
   * @param {boolean} suppress - Whether to suppress warnings
   */
  setSuppressWarnings(suppress) {
    this.suppressWarnings = suppress;
  }
}

module.exports = VersionChecker;
