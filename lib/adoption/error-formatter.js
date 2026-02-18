/**
 * Error Formatter
 * 
 * Provides clear, actionable error messages for adoption process.
 * Transforms technical errors into user-friendly messages with solutions.
 * 
 * Core Principles:
 * - Clear problem descriptions (non-technical language)
 * - List possible causes
 * - Provide actionable solutions
 * - Include help references
 * - Consistent formatting
 */

const chalk = require('chalk');

/**
 * Error categories for adoption process
 */
const ErrorCategory = {
  BACKUP: 'backup',
  PERMISSION: 'permission',
  DISK_SPACE: 'disk_space',
  FILE_SYSTEM: 'file_system',
  VERSION: 'version',
  VALIDATION: 'validation',
  NETWORK: 'network',
  CONFIGURATION: 'configuration',
  UNKNOWN: 'unknown'
};

/**
 * Error Formatter for adoption errors
 */
class ErrorFormatter {
  /**
   * Formats an error with clear explanation and solutions
   * 
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context about the error
   * @param {string} context.operation - Operation that failed (e.g., 'backup', 'file copy')
   * @param {string} context.filePath - File path related to error (if applicable)
   * @param {string} context.category - Error category (optional, will be auto-detected)
   * @returns {string} Formatted error message
   */
  static format(error, context = {}) {
    // Handle null or undefined context
    const ctx = context || {};
    
    const errorMessage = error instanceof Error ? error.message : error;
    const category = ctx.category || this._detectCategory(errorMessage, ctx);
    
    const template = this._getTemplate(category);
    const formatted = this._applyTemplate(template, errorMessage, ctx);
    
    return formatted;
  }

  /**
   * Detects error category from error message and context
   * 
   * @param {string} errorMessage - Error message
   * @param {Object} context - Error context
   * @returns {string} Error category
   * @private
   */
  static _detectCategory(errorMessage, context) {
    const message = errorMessage.toLowerCase();
    
    // Backup errors
    if (message.includes('backup') || context.operation === 'backup') {
      return ErrorCategory.BACKUP;
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('eacces') || 
        message.includes('eperm') || message.includes('access denied')) {
      return ErrorCategory.PERMISSION;
    }
    
    // Disk space errors
    if (message.includes('enospc') || message.includes('disk') || 
        message.includes('space') || message.includes('quota')) {
      return ErrorCategory.DISK_SPACE;
    }
    
    // File system errors
    if (message.includes('enoent') || message.includes('not found') ||
        message.includes('eexist') || message.includes('already exists') ||
        message.includes('file') || message.includes('directory')) {
      return ErrorCategory.FILE_SYSTEM;
    }
    
    // Version errors
    if (message.includes('version') || context.operation === 'version') {
      return ErrorCategory.VERSION;
    }
    
    // Configuration errors (check before validation to prioritize config)
    if (message.includes('config') || message.includes('setting')) {
      return ErrorCategory.CONFIGURATION;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') ||
        message.includes('corrupt')) {
      return ErrorCategory.VALIDATION;
    }
    
    // Network errors
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('econnrefused') || message.includes('enotfound')) {
      return ErrorCategory.NETWORK;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Gets error template for category
   * 
   * @param {string} category - Error category
   * @returns {ErrorTemplate} Error template
   * @private
   */
  static _getTemplate(category) {
    const templates = {
      [ErrorCategory.BACKUP]: {
        title: 'Backup Creation Failed',
        problem: 'Unable to create backup of existing files before making changes',
        causes: [
          'Insufficient disk space',
          'Permission denied for .kiro/backups/ directory',
          'File system error or corruption',
          'Another process is accessing the files'
        ],
        solutions: [
          'Free up disk space (need at least 50MB)',
          'Check file permissions: Run with appropriate permissions',
          'Close other programs that might be accessing the files',
          'Try running the command again',
          'If problem persists, run: sce doctor'
        ]
      },
      
      [ErrorCategory.PERMISSION]: {
        title: 'Permission Denied',
        problem: 'Unable to access or modify files due to insufficient permissions',
        causes: [
          'Files are owned by another user',
          'Directory permissions are too restrictive',
          'Files are read-only',
          'Running in a protected directory'
        ],
        solutions: [
          'Check file ownership and permissions',
          'Run with appropriate permissions if needed',
          'Make sure you have write access to the project directory',
          'Check if files are marked as read-only',
          'Try: chmod -R u+w .kiro/ (on Unix-like systems)'
        ]
      },
      
      [ErrorCategory.DISK_SPACE]: {
        title: 'Insufficient Disk Space',
        problem: 'Not enough free disk space to complete the operation',
        causes: [
          'Disk is full or nearly full',
          'Disk quota exceeded',
          'Large backup files taking up space'
        ],
        solutions: [
          'Free up disk space by deleting unnecessary files',
          'Clean up old backups: sce backup clean --old',
          'Move project to a drive with more space',
          'Check disk usage: df -h (Unix) or dir (Windows)'
        ]
      },
      
      [ErrorCategory.FILE_SYSTEM]: {
        title: 'File System Error',
        problem: 'Unable to read or write files',
        causes: [
          'File or directory not found',
          'File already exists',
          'Path is too long',
          'Invalid file name characters',
          'File system corruption'
        ],
        solutions: [
          'Verify the project path is correct',
          'Check if files exist: ls -la .kiro/ (Unix) or dir .kiro (Windows)',
          'Ensure file names are valid for your operating system',
          'Try running file system check/repair tools',
          'If problem persists, run: sce doctor'
        ]
      },
      
      [ErrorCategory.VERSION]: {
        title: 'Version Mismatch',
        problem: 'Project version is incompatible with current sce version',
        causes: [
          'Project was created with a newer version of sce',
          'Version information is missing or corrupted',
          'Incompatible version format'
        ],
        solutions: [
          'Update sce to the latest version: npm install -g scene-capability-engine',
          'Check project version: sce version --project',
          'If downgrading, use: sce adopt --force (with caution)',
          'Backup your project before proceeding'
        ]
      },
      
      [ErrorCategory.VALIDATION]: {
        title: 'Validation Failed',
        problem: 'Files or configuration failed validation checks',
        causes: [
          'Corrupted files',
          'Invalid configuration format',
          'Missing required files',
          'Inconsistent project structure'
        ],
        solutions: [
          'Run project diagnostics: sce doctor',
          'Check for corrupted files',
          'Restore from backup if available: sce rollback <backup-id>',
          'Re-initialize project: sce adopt --force',
          'Contact support if issue persists'
        ]
      },
      
      [ErrorCategory.NETWORK]: {
        title: 'Network Error',
        problem: 'Unable to connect to required services',
        causes: [
          'No internet connection',
          'Firewall blocking connection',
          'Service is temporarily unavailable',
          'Proxy configuration issues'
        ],
        solutions: [
          'Check your internet connection',
          'Verify firewall settings',
          'Try again in a few minutes',
          'Check proxy configuration if behind a corporate firewall',
          'Use offline mode if available'
        ]
      },
      
      [ErrorCategory.CONFIGURATION]: {
        title: 'Configuration Error',
        problem: 'Invalid or missing configuration',
        causes: [
          'Configuration file is missing',
          'Configuration format is invalid',
          'Required settings are missing',
          'Configuration values are out of range'
        ],
        solutions: [
          'Check configuration file: .kiro/adoption-config.json',
          'Restore default configuration: sce config reset',
          'Validate configuration: sce config validate',
          'Refer to documentation for valid configuration options'
        ]
      },
      
      [ErrorCategory.UNKNOWN]: {
        title: 'Unexpected Error',
        problem: 'An unexpected error occurred',
        causes: [
          'Unknown or rare error condition',
          'Bug in the software',
          'Unusual system configuration'
        ],
        solutions: [
          'Try running the command again',
          'Run diagnostics: sce doctor',
          'Check the error details below',
          'Report this issue if it persists',
          'Include error details when reporting'
        ]
      }
    };
    
    return templates[category] || templates[ErrorCategory.UNKNOWN];
  }

  /**
   * Applies template to create formatted error message
   * 
   * @param {ErrorTemplate} template - Error template
   * @param {string} errorMessage - Original error message
   * @param {Object} context - Error context
   * @returns {string} Formatted error message
   * @private
   */
  static _applyTemplate(template, errorMessage, context) {
    const lines = [];
    
    // Header
    lines.push('');
    lines.push(chalk.red('❌ Error: ' + template.title));
    lines.push('');
    
    // Problem description
    lines.push(chalk.bold('Problem:'));
    lines.push('  ' + template.problem);
    lines.push('');
    
    // Technical details (if verbose or helpful)
    if (context.verbose || this._shouldShowDetails(errorMessage)) {
      lines.push(chalk.gray('Details:'));
      lines.push(chalk.gray('  ' + errorMessage));
      lines.push('');
    }
    
    // File path (if applicable)
    if (context.filePath) {
      lines.push(chalk.gray('File:'));
      lines.push(chalk.gray('  ' + context.filePath));
      lines.push('');
    }
    
    // Possible causes
    lines.push(chalk.bold('Possible causes:'));
    template.causes.forEach(cause => {
      lines.push('  • ' + cause);
    });
    lines.push('');
    
    // Solutions
    lines.push(chalk.bold('Solutions:'));
    template.solutions.forEach((solution, index) => {
      lines.push(`  ${index + 1}. ${solution}`);
    });
    lines.push('');
    
    // Help reference
    lines.push(chalk.blue('💡 Need help?'));
    lines.push(chalk.blue('   Run: sce doctor'));
    lines.push(chalk.blue('   Docs: https://github.com/SCE-ai/scene-capability-engine#troubleshooting'));
    lines.push('');
    
    return lines.join('\n');
  }

  /**
   * Determines if technical details should be shown
   * 
   * @param {string} errorMessage - Error message
   * @returns {boolean}
   * @private
   */
  static _shouldShowDetails(errorMessage) {
    // Show details if message contains useful technical info
    const usefulPatterns = [
      /ENOENT.*no such file/i,
      /EACCES.*permission denied/i,
      /ENOSPC.*no space/i,
      /at line \d+/i,
      /expected.*but got/i
    ];
    
    return usefulPatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Formats a simple error message (without full template)
   * 
   * @param {string} message - Error message
   * @returns {string} Formatted error
   */
  static formatSimple(message) {
    return chalk.red('❌ ' + message);
  }

  /**
   * Formats a warning message
   * 
   * @param {string} message - Warning message
   * @returns {string} Formatted warning
   */
  static formatWarning(message) {
    return chalk.yellow('⚠️  ' + message);
  }

  /**
   * Formats a success message
   * 
   * @param {string} message - Success message
   * @returns {string} Formatted success
   */
  static formatSuccess(message) {
    return chalk.green('✅ ' + message);
  }

  /**
   * Formats an info message
   * 
   * @param {string} message - Info message
   * @returns {string} Formatted info
   */
  static formatInfo(message) {
    return chalk.blue('ℹ️  ' + message);
  }

  /**
   * Creates a formatted error for backup failures
   * 
   * @param {Error} error - Backup error
   * @param {Object} context - Additional context
   * @returns {string} Formatted error
   */
  static formatBackupError(error, context = {}) {
    return this.format(error, {
      ...context,
      category: ErrorCategory.BACKUP,
      operation: 'backup'
    });
  }

  /**
   * Creates a formatted error for permission issues
   * 
   * @param {Error} error - Permission error
   * @param {Object} context - Additional context
   * @returns {string} Formatted error
   */
  static formatPermissionError(error, context = {}) {
    return this.format(error, {
      ...context,
      category: ErrorCategory.PERMISSION,
      operation: 'permission'
    });
  }

  /**
   * Creates a formatted error for validation failures
   * 
   * @param {Error} error - Validation error
   * @param {Object} context - Additional context
   * @returns {string} Formatted error
   */
  static formatValidationError(error, context = {}) {
    return this.format(error, {
      ...context,
      category: ErrorCategory.VALIDATION,
      operation: 'validation'
    });
  }

  /**
   * Creates a formatted error for orchestration failures
   * 
   * @param {Error} error - Orchestration error
   * @param {Object} context - Additional context
   * @returns {Object} Formatted error object with message
   */
  static formatOrchestrationError(error, context = {}) {
    const formatted = this.format(error, {
      ...context,
      category: ErrorCategory.UNKNOWN,
      operation: 'orchestration'
    });
    
    return {
      message: formatted,
      category: ErrorCategory.UNKNOWN
    };
  }

  /**
   * Formats multiple errors into a summary
   * 
   * @param {Array<Error|string>} errors - Array of errors
   * @param {string} title - Summary title
   * @returns {string} Formatted error summary
   */
  static formatMultiple(errors, title = 'Multiple Errors Occurred') {
    const lines = [];
    
    lines.push('');
    lines.push(chalk.red('❌ ' + title));
    lines.push('');
    
    errors.forEach((error, index) => {
      const message = error instanceof Error ? error.message : error;
      lines.push(`  ${index + 1}. ${message}`);
    });
    
    lines.push('');
    lines.push(chalk.blue('💡 Run: sce doctor for detailed diagnostics'));
    lines.push('');
    
    return lines.join('\n');
  }
}

/**
 * @typedef {Object} ErrorTemplate
 * @property {string} title - Error title
 * @property {string} problem - Clear problem description
 * @property {string[]} causes - List of possible causes
 * @property {string[]} solutions - List of actionable solutions
 */

module.exports = ErrorFormatter;
module.exports.ErrorCategory = ErrorCategory;
