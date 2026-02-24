/**
 * Summary Generator
 * 
 * Generates comprehensive adoption summaries with rollback instructions.
 * Aggregates data from the adoption process and formats it into structured summaries.
 * 
 * Core Responsibilities:
 * - Aggregate adoption process data
 * - Generate structured summary objects
 * - Provide rollback instructions
 * - Suggest next steps
 * - Analyze adoption results
 * 
 * Requirements Traceability:
 * - FR-2.3.2: Result summary
 * 
 * Design Traceability:
 * - Summary Generator component
 * - Summary structure and display specifications
 */

const path = require('path');
const chalk = require('chalk');

/**
 * Summary Generator for adoption process
 */
class SummaryGenerator {
  constructor() {
    // Summary data will be built up during adoption
    this.summaryData = {
      mode: null,
      backup: null,
      changes: {
        created: [],
        updated: [],
        deleted: [],
        preserved: []
      },
      warnings: [],
      errors: [],
      metadata: {
        startTime: null,
        endTime: null,
        duration: null
      }
    };
  }

  /**
   * Starts summary generation (records start time)
   */
  start() {
    this.summaryData.metadata.startTime = Date.now();
  }

  /**
   * Sets the adoption mode
   * 
   * @param {string} mode - Adoption mode (fresh, smart-adopt, smart-update, skip, warning)
   */
  setMode(mode) {
    this.summaryData.mode = mode;
  }

  /**
   * Sets backup information
   * 
   * @param {Object} backup - Backup result
   * @param {string} backup.id - Backup ID
   * @param {string} backup.location - Backup location
   * @param {number} backup.filesCount - Number of files backed up
   * @param {number} backup.totalSize - Total size in bytes
   */
  setBackup(backup) {
    this.summaryData.backup = {
      id: backup.id,
      location: backup.location,
      filesCount: backup.filesCount || backup.filesBackedUp?.length || 0,
      totalSize: backup.totalSize || 0
    };
  }

  /**
   * Adds a file change to the summary
   * 
   * @param {string} operation - Operation type: 'create', 'update', 'delete', 'preserve'
   * @param {string} filePath - File path
   */
  addFileChange(operation, filePath) {
    const normalizedPath = this._normalizePath(filePath);
    
    switch (operation) {
      case 'create':
        if (!this.summaryData.changes.created.includes(normalizedPath)) {
          this.summaryData.changes.created.push(normalizedPath);
        }
        break;
      case 'update':
        if (!this.summaryData.changes.updated.includes(normalizedPath)) {
          this.summaryData.changes.updated.push(normalizedPath);
        }
        break;
      case 'delete':
        if (!this.summaryData.changes.deleted.includes(normalizedPath)) {
          this.summaryData.changes.deleted.push(normalizedPath);
        }
        break;
      case 'preserve':
        if (!this.summaryData.changes.preserved.includes(normalizedPath)) {
          this.summaryData.changes.preserved.push(normalizedPath);
        }
        break;
    }
  }

  /**
   * Adds multiple file changes at once
   * 
   * @param {string} operation - Operation type
   * @param {string[]} filePaths - Array of file paths
   */
  addFileChanges(operation, filePaths) {
    filePaths.forEach(filePath => {
      this.addFileChange(operation, filePath);
    });
  }

  /**
   * Adds a warning to the summary
   * 
   * @param {string} warning - Warning message
   */
  addWarning(warning) {
    if (!this.summaryData.warnings.includes(warning)) {
      this.summaryData.warnings.push(warning);
    }
  }

  /**
   * Adds an error to the summary
   * 
   * @param {string} error - Error message
   */
  addError(error) {
    if (!this.summaryData.errors.includes(error)) {
      this.summaryData.errors.push(error);
    }
  }

  /**
   * Completes summary generation (records end time)
   */
  complete() {
    this.summaryData.metadata.endTime = Date.now();
    if (this.summaryData.metadata.startTime) {
      this.summaryData.metadata.duration = 
        this.summaryData.metadata.endTime - this.summaryData.metadata.startTime;
    }
  }

  /**
   * Generates a comprehensive summary object
   * 
   * @returns {Object} Complete adoption summary
   */
  generateSummary() {
    const summary = {
      mode: this.summaryData.mode,
      backup: this.summaryData.backup,
      changes: {
        created: [...this.summaryData.changes.created],
        updated: [...this.summaryData.changes.updated],
        deleted: [...this.summaryData.changes.deleted],
        preserved: [...this.summaryData.changes.preserved],
        total: this._getTotalChanges()
      },
      statistics: this._generateStatistics(),
      rollback: this._generateRollbackInfo(),
      nextSteps: this._generateNextSteps(),
      warnings: [...this.summaryData.warnings],
      errors: [...this.summaryData.errors],
      metadata: {
        ...this.summaryData.metadata,
        success: this.summaryData.errors.length === 0
      }
    };

    return summary;
  }

  /**
   * Generates a text-based summary for display
   * 
   * @param {Object} options - Display options
   * @param {boolean} options.verbose - Show detailed information
   * @param {boolean} options.color - Use colored output
   * @returns {string} Formatted summary text
   */
  generateTextSummary(options = {}) {
    const { verbose = false, color = true } = options;
    const summary = this.generateSummary();
    const lines = [];

    // Header
    if (summary.metadata.success) {
      lines.push(color ? chalk.green('✅ Adoption completed successfully!') : '✅ Adoption completed successfully!');
    } else {
      lines.push(color ? chalk.red('❌ Adoption failed') : '❌ Adoption failed');
    }
    lines.push('');

    // Summary section
    lines.push(color ? chalk.blue('📊 Summary:') : '📊 Summary:');
    lines.push(`  Mode: ${this._getModeDisplayName(summary.mode)}`);
    
    if (summary.backup) {
      lines.push(`  Backup: ${summary.backup.id}`);
    }

    // Individual file counts (for compatibility with tests)
    if (summary.changes.updated.length > 0) {
      lines.push(`  Updated: ${summary.changes.updated.length} file(s)`);
    }
    if (summary.changes.created.length > 0) {
      lines.push(`  Created: ${summary.changes.created.length} file(s)`);
    }
    if (summary.changes.deleted.length > 0) {
      lines.push(`  Deleted: ${summary.changes.deleted.length} file(s)`);
    }
    if (summary.changes.preserved.length > 0) {
      lines.push(`  Preserved: ${summary.changes.preserved.length} file(s)`);
    }

    // Duration in verbose mode
    if (verbose && summary.metadata.duration) {
      lines.push(`  Duration: ${this._formatDuration(summary.metadata.duration)}`);
    }

    lines.push('');

    // Updated files
    if (summary.changes.updated.length > 0) {
      lines.push(color ? chalk.blue('Updated files:') : 'Updated files:');
      summary.changes.updated.forEach(file => {
        lines.push(color ? chalk.green(`  ✅ ${file}`) : `  ✅ ${file}`);
      });
      lines.push('');
    }

    // Created files (verbose mode)
    if (verbose && summary.changes.created.length > 0) {
      lines.push(color ? chalk.blue('Created files:') : 'Created files:');
      summary.changes.created.forEach(file => {
        lines.push(color ? chalk.green(`  ➕ ${file}`) : `  ➕ ${file}`);
      });
      lines.push('');
    }

    // Preserved files
    if (summary.changes.preserved.length > 0) {
      lines.push(color ? chalk.gray('Preserved files:') : 'Preserved files:');
      summary.changes.preserved.forEach(file => {
        lines.push(color ? chalk.gray(`  ⏭️  ${file}`) : `  ⏭️  ${file}`);
      });
      lines.push('');
    }

    // Rollback info
    if (summary.rollback && summary.rollback.available) {
      lines.push(color ? chalk.blue('💡 Your original files are safely backed up.') : '💡 Your original files are safely backed up.');
      const cmd = color ? chalk.cyan(summary.rollback.command) : summary.rollback.command;
      lines.push(color ? chalk.gray(`   To restore: ${cmd}`) : `   To restore: ${cmd}`);
      lines.push('');
    }

    // Warnings
    if (summary.warnings.length > 0) {
      lines.push(color ? chalk.yellow('⚠️  Warnings:') : '⚠️  Warnings:');
      summary.warnings.forEach(warning => {
        lines.push(color ? chalk.yellow(`  ${warning}`) : `  ${warning}`);
      });
      lines.push('');
    }

    // Errors
    if (summary.errors.length > 0) {
      lines.push(color ? chalk.red('❌ Errors:') : '❌ Errors:');
      summary.errors.forEach(error => {
        lines.push(color ? chalk.red(`  ${error}`) : `  ${error}`);
      });
      lines.push('');
    }

    // Next steps
    if (summary.nextSteps.length > 0) {
      lines.push(color ? chalk.blue('📋 Next steps:') : '📋 Next steps:');
      summary.nextSteps.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${step}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Resets the summary generator for a new adoption
   */
  reset() {
    this.summaryData = {
      mode: null,
      backup: null,
      changes: {
        created: [],
        updated: [],
        deleted: [],
        preserved: []
      },
      warnings: [],
      errors: [],
      metadata: {
        startTime: null,
        endTime: null,
        duration: null
      }
    };
  }

  /**
   * Generates statistics about the adoption
   * 
   * @returns {Object} Statistics object
   * @private
   */
  _generateStatistics() {
    return {
      totalFiles: this._getTotalChanges(),
      filesCreated: this.summaryData.changes.created.length,
      filesUpdated: this.summaryData.changes.updated.length,
      filesDeleted: this.summaryData.changes.deleted.length,
      filesPreserved: this.summaryData.changes.preserved.length,
      hasBackup: !!this.summaryData.backup,
      hasWarnings: this.summaryData.warnings.length > 0,
      hasErrors: this.summaryData.errors.length > 0
    };
  }

  /**
   * Generates rollback information
   * 
   * @returns {Object} Rollback info
   * @private
   */
  _generateRollbackInfo() {
    if (!this.summaryData.backup) {
      return {
        available: false,
        command: null,
        description: 'No backup available'
      };
    }

    return {
      available: true,
      command: `sce rollback ${this.summaryData.backup.id}`,
      description: 'Restore all files from backup',
      backupId: this.summaryData.backup.id,
      backupLocation: this.summaryData.backup.location
    };
  }

  /**
   * Generates suggested next steps based on adoption results
   * 
   * @returns {string[]} Array of next step suggestions
   * @private
   */
  _generateNextSteps() {
    const steps = [];
    const mode = this.summaryData.mode;
    const hasErrors = this.summaryData.errors.length > 0;

    if (hasErrors) {
      steps.push('Review error messages above');
      steps.push('Check log files for detailed error information');
      if (this.summaryData.backup) {
        steps.push(`Run 'sce rollback ${this.summaryData.backup.id}' to restore if needed`);
      }
      return steps;
    }

    // Mode-specific suggestions
    switch (mode) {
      case 'fresh':
        steps.push('Review the created .sce/ structure');
        steps.push('Customize CURRENT_CONTEXT.md for your project');
        steps.push('Start creating your first spec with: sce spec create');
        break;

      case 'smart-update':
        steps.push('Review updated template files');
        steps.push('Check if CURRENT_CONTEXT.md needs updates');
        steps.push('Continue working on your specs');
        break;

      case 'smart-adopt':
        steps.push('Review the adoption changes');
        steps.push('Verify your specs are intact');
        steps.push('Update CURRENT_CONTEXT.md if needed');
        break;

      case 'skip':
        steps.push('Your project is already up-to-date');
        steps.push('Continue working on your specs');
        break;

      default:
        steps.push('Review the changes made');
        steps.push('Continue working on your project');
    }

    // Add general suggestions
    if (this.summaryData.warnings.length > 0) {
      steps.push('Review warnings above and address if needed');
    }

    return steps;
  }

  /**
   * Gets total number of file changes
   * 
   * @returns {number} Total changes
   * @private
   */
  _getTotalChanges() {
    return this.summaryData.changes.created.length +
           this.summaryData.changes.updated.length +
           this.summaryData.changes.deleted.length;
  }

  /**
   * Normalizes file path for consistent display
   * 
   * @param {string} filePath - File path
   * @returns {string} Normalized path
   * @private
   */
  _normalizePath(filePath) {
    // Convert to forward slashes for consistency
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Gets display name for adoption mode
   * 
   * @param {string} mode - Adoption mode
   * @returns {string} Display name
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
   * Formats duration in human-readable format
   * 
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
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
}

module.exports = SummaryGenerator;
