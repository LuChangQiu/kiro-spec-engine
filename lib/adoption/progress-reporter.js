/**
 * Progress Reporter
 * 
 * Provides real-time progress reporting for adoption process.
 * Displays clear status indicators, file operations, and progress stages.
 * 
 * Core Responsibilities:
 * - Display progress stages with status icons
 * - Report file operations in real-time
 * - Show file counts (processed/total)
 * - Maintain clean, readable output
 * - Support verbose mode for detailed logging
 */

const chalk = require('chalk');

/**
 * Progress stages for adoption process
 */
const ProgressStage = {
  ANALYZING: 'Analyzing project structure',
  PLANNING: 'Creating adoption plan',
  BACKING_UP: 'Creating backup',
  VALIDATING: 'Validating backup',
  UPDATING: 'Updating files',
  CLEANING: 'Cleaning old files',
  FINALIZING: 'Finalizing adoption',
  COMPLETE: 'Adoption complete'
};

/**
 * Status types for progress updates
 */
const ProgressStatus = {
  IN_PROGRESS: 'in-progress',
  COMPLETE: 'complete',
  ERROR: 'error',
  SKIP: 'skip',
  WARNING: 'warning'
};

/**
 * Status icons for visual feedback
 */
const StatusIcons = {
  'in-progress': '🔄',
  'complete': '✅',
  'error': '❌',
  'skip': '⏭️',
  'warning': '⚠️',
  'backup': '📦',
  'update': '📝',
  'delete': '🗑️',
  'create': '➕',
  'preserve': '💾'
};

/**
 * Progress Reporter for adoption process
 */
class ProgressReporter {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
    this.currentStage = null;
    this.stageStartTime = null;
    this.totalStartTime = null;
    this.fileOperations = {
      processed: 0,
      total: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      preserved: 0
    };
  }

  /**
   * Starts progress reporting
   */
  start() {
    this.totalStartTime = Date.now();
    if (!this.quiet) {
      console.log();
    }
  }

  /**
   * Reports progress for a stage
   * 
   * @param {string} stage - Progress stage (from ProgressStage)
   * @param {string} status - Status (from ProgressStatus)
   * @param {string|Object} details - Optional details or options
   */
  reportStage(stage, status, details = null) {
    if (this.quiet) return;

    // Track stage timing
    if (status === ProgressStatus.IN_PROGRESS) {
      this.currentStage = stage;
      this.stageStartTime = Date.now();
    }

    const icon = StatusIcons[status] || '📝';
    let message = `${icon} ${stage}`;

    // Add details if provided
    if (details) {
      if (typeof details === 'string') {
        message += ` ${details}`;
      } else if (details.message) {
        message += ` ${details.message}`;
      }
    }

    // Add timing in verbose mode
    if (this.verbose && status === ProgressStatus.COMPLETE && this.stageStartTime) {
      const duration = Date.now() - this.stageStartTime;
      message += chalk.gray(` (${this._formatDuration(duration)})`);
    }

    // Color based on status
    if (status === ProgressStatus.ERROR) {
      console.log(chalk.red(message));
    } else if (status === ProgressStatus.WARNING) {
      console.log(chalk.yellow(message));
    } else if (status === ProgressStatus.COMPLETE) {
      console.log(chalk.green(message));
    } else if (status === ProgressStatus.SKIP) {
      console.log(chalk.gray(message));
    } else {
      console.log(message);
    }
  }

  /**
   * Reports file operation progress
   * 
   * @param {string} operation - Operation type: 'create', 'update', 'delete', 'preserve'
   * @param {string} filePath - File path
   * @param {Object} options - Additional options
   */
  reportFileOperation(operation, filePath, options = {}) {
    // Update counters (always, even in quiet mode)
    this.fileOperations.processed++;
    if (operation === 'create') this.fileOperations.created++;
    if (operation === 'update') this.fileOperations.updated++;
    if (operation === 'delete') this.fileOperations.deleted++;
    if (operation === 'preserve') this.fileOperations.preserved++;

    // Skip output in quiet mode
    if (this.quiet) return;

    // Get icon for operation
    const icon = StatusIcons[operation] || '📝';

    // Format message
    let message = `  ${icon} ${filePath}`;

    // Add details if provided
    if (options.details) {
      message += chalk.gray(` (${options.details})`);
    }

    // Color based on operation
    if (operation === 'create') {
      console.log(chalk.green(message));
    } else if (operation === 'update') {
      console.log(chalk.cyan(message));
    } else if (operation === 'delete') {
      console.log(chalk.red(message));
    } else if (operation === 'preserve') {
      console.log(chalk.gray(message));
    } else {
      console.log(message);
    }

    // Show progress counter if total is known
    if (this.fileOperations.total > 0 && this.verbose) {
      const percent = Math.round((this.fileOperations.processed / this.fileOperations.total) * 100);
      console.log(chalk.gray(`    Progress: ${this.fileOperations.processed}/${this.fileOperations.total} (${percent}%)`));
    }
  }

  /**
   * Reports batch file operations
   * 
   * @param {string} operation - Operation type
   * @param {string[]} filePaths - Array of file paths
   * @param {Object} options - Additional options
   */
  reportBatchOperation(operation, filePaths, options = {}) {
    const icon = StatusIcons[operation] || '📝';
    const count = filePaths.length;

    // Update counters (always, even in quiet mode)
    this.fileOperations.processed += count;
    if (operation === 'create') this.fileOperations.created += count;
    if (operation === 'update') this.fileOperations.updated += count;
    if (operation === 'delete') this.fileOperations.deleted += count;
    if (operation === 'preserve') this.fileOperations.preserved += count;

    // Skip output in quiet mode
    if (this.quiet) return;

    // Show summary
    let message = `  ${icon} ${count} file(s)`;
    if (options.description) {
      message += ` ${options.description}`;
    }

    console.log(message);

    // Show individual files in verbose mode
    if (this.verbose && filePaths.length > 0) {
      filePaths.forEach(filePath => {
        console.log(chalk.gray(`    - ${filePath}`));
      });
    }
  }

  /**
   * Sets total file count for progress tracking
   * 
   * @param {number} total - Total number of files to process
   */
  setTotalFiles(total) {
    this.fileOperations.total = total;
  }

  /**
   * Reports backup creation
   * 
   * @param {Object} backup - Backup result
   */
  reportBackup(backup) {
    if (this.quiet) return;

    const icon = StatusIcons.backup;
    console.log(`${icon} Backup created: ${chalk.cyan(backup.id)}`);

    if (this.verbose) {
      console.log(chalk.gray(`  Location: ${backup.location}`));
      console.log(chalk.gray(`  Files: ${backup.filesCount}`));
      console.log(chalk.gray(`  Size: ${this._formatSize(backup.totalSize)}`));
    }
  }

  /**
   * Reports validation result
   * 
   * @param {Object} validation - Validation result
   */
  reportValidation(validation) {
    if (this.quiet) return;

    if (validation.success) {
      const message = `✅ Validation complete: ${validation.filesVerified} file(s) verified`;
      console.log(chalk.green(message));
    } else {
      const message = `❌ Validation failed: ${validation.error}`;
      console.log(chalk.red(message));
    }
  }

  /**
   * Reports warning message
   * 
   * @param {string} message - Warning message
   */
  reportWarning(message) {
    if (this.quiet) return;
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  /**
   * Reports error message
   * 
   * @param {string} message - Error message
   */
  reportError(message) {
    if (this.quiet) return;
    console.log(chalk.red(`❌ ${message}`));
  }

  /**
   * Reports informational message
   * 
   * @param {string} message - Info message
   */
  reportInfo(message) {
    if (this.quiet) return;
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  /**
   * Reports success message
   * 
   * @param {string} message - Success message
   */
  reportSuccess(message) {
    if (this.quiet) return;
    console.log(chalk.green(`✅ ${message}`));
  }

  /**
   * Displays adoption plan
   * 
   * @param {Object} plan - Adoption plan
   */
  displayPlan(plan) {
    if (this.quiet) return;

    console.log();
    console.log(chalk.blue('📋 Adoption Plan:'));
    console.log(`  Mode: ${chalk.cyan(this._getModeDisplayName(plan.mode))}`);
    console.log('  Actions:');

    if (plan.requiresBackup) {
      console.log('    - Backup existing files → .kiro/backups/adopt-{timestamp}/');
    }

    if (plan.changes.created.length > 0) {
      console.log(`    - Create ${plan.changes.created.length} new file(s)`);
    }

    if (plan.changes.updated.length > 0) {
      console.log(`    - Update ${plan.changes.updated.length} template file(s)`);
    }

    if (plan.changes.preserved.length > 0) {
      console.log(`    - Preserve ${plan.changes.preserved.length} user file(s)`);
    }

    console.log('    - Ensure environment consistency');
    console.log();
  }

  /**
   * Displays final summary
   * 
   * @param {Object} result - Orchestration result
   */
  displaySummary(result) {
    if (this.quiet) return;

    console.log();
    console.log(chalk.green('✅ Adoption completed successfully!'));
    console.log();

    console.log(chalk.blue('📊 Summary:'));
    console.log(`  Mode: ${this._getModeDisplayName(result.mode)}`);

    if (result.backup) {
      console.log(`  Backup: ${result.backup.id}`);
    }

    // Show operation counts
    const counts = [];
    if (this.fileOperations.created > 0) {
      counts.push(`${this.fileOperations.created} created`);
    }
    if (this.fileOperations.updated > 0) {
      counts.push(`${this.fileOperations.updated} updated`);
    }
    if (this.fileOperations.deleted > 0) {
      counts.push(`${this.fileOperations.deleted} deleted`);
    }
    if (this.fileOperations.preserved > 0) {
      counts.push(`${this.fileOperations.preserved} preserved`);
    }

    if (counts.length > 0) {
      console.log(`  Files: ${counts.join(', ')}`);
    }

    // Show timing in verbose mode
    if (this.verbose && this.totalStartTime) {
      const totalDuration = Date.now() - this.totalStartTime;
      console.log(chalk.gray(`  Duration: ${this._formatDuration(totalDuration)}`));
    }

    console.log();

    // Show detailed file lists
    if (result.changes.updated.length > 0) {
      console.log(chalk.blue('Updated files:'));
      result.changes.updated.forEach(file => {
        console.log(chalk.green(`  ✅ ${file}`));
      });
      console.log();
    }

    if (result.changes.created.length > 0 && this.verbose) {
      console.log(chalk.blue('Created files:'));
      result.changes.created.forEach(file => {
        console.log(chalk.green(`  ➕ ${file}`));
      });
      console.log();
    }

    if (result.changes.preserved.length > 0) {
      console.log(chalk.gray('Preserved files:'));
      result.changes.preserved.forEach(file => {
        console.log(chalk.gray(`  ⏭️  ${file}`));
      });
      console.log();
    }

    // Show backup info
    if (result.backup) {
      console.log(chalk.blue('💡 Your original files are safely backed up.'));
      console.log(chalk.gray(`   To restore: ${chalk.cyan(`kse rollback ${result.backup.id}`)}`));
      console.log();
    }

    // Show warnings
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`  ${warning}`));
      });
      console.log();
    }
  }

  /**
   * Displays error summary
   * 
   * @param {Object} result - Orchestration result with errors
   */
  displayErrorSummary(result) {
    if (this.quiet) return;

    console.log();
    console.log(chalk.red('❌ Adoption failed'));
    console.log();

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => {
        console.log(chalk.red(`  ${error}`));
      });
      console.log();
    }

    if (result.backup) {
      console.log(chalk.blue('📦 Backup available:'), result.backup.id);
      console.log(chalk.gray('  Run'), chalk.cyan('kse rollback'), chalk.gray('to restore'));
      console.log();
    }
  }

  /**
   * Ends progress reporting
   */
  end() {
    if (this.quiet) return;

    if (this.verbose && this.totalStartTime) {
      const totalDuration = Date.now() - this.totalStartTime;
      console.log();
      console.log(chalk.gray(`Total time: ${this._formatDuration(totalDuration)}`));
    }
  }

  /**
   * Formats duration in human-readable format
   * 
   * @param {number} ms - Duration in milliseconds
   * @returns {string}
   * @private
   */
  _formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Formats file size in human-readable format
   * 
   * @param {number} bytes - Size in bytes
   * @returns {string}
   * @private
   */
  _formatSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Gets display name for adoption mode
   * 
   * @param {string} mode - Adoption mode
   * @returns {string}
   * @private
   */
  _getModeDisplayName(mode) {
    const names = {
      'fresh': 'Fresh Adoption',
      'smart-adopt': 'Smart Adoption',
      'smart-update': 'Smart Update',
      'skip': 'Already Up-to-Date',
      'warning': 'Version Warning'
    };
    return names[mode] || mode;
  }

  /**
   * Creates a new line for spacing
   */
  newLine() {
    if (!this.quiet) {
      console.log();
    }
  }
}

// Export class and constants
module.exports = ProgressReporter;
module.exports.ProgressStage = ProgressStage;
module.exports.ProgressStatus = ProgressStatus;
module.exports.StatusIcons = StatusIcons;
