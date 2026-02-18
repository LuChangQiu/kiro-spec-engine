/**
 * Adoption Logger
 * 
 * Provides detailed logging for debugging and troubleshooting adoption process.
 * Logs internal operations not shown in progress display.
 * 
 * Core Responsibilities:
 * - Log all operations when verbose mode is enabled
 * - Include timestamps and operation details
 * - Write logs to file for later review
 * - Support different log levels (info, debug, verbose)
 * - Don't clutter normal output
 */

const fs = require('fs');
const path = require('path');

/**
 * Log levels
 */
const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

/**
 * Log level names
 */
const LogLevelNames = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
  4: 'VERBOSE'
};

/**
 * Adoption Logger for detailed operation logging
 */
class AdoptionLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.level = this._parseLogLevel(options.level || 'info');
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole || false;
    this.logFilePath = options.logFilePath || null;
    this.logBuffer = [];
    this.maxBufferSize = options.maxBufferSize || 1000;
    this.startTime = Date.now();
  }

  /**
   * Parses log level from string or number
   * 
   * @param {string|number} level - Log level
   * @returns {number}
   * @private
   */
  _parseLogLevel(level) {
    if (typeof level === 'number') {
      return level;
    }

    const levelMap = {
      'error': 0,  // LogLevel.ERROR
      'warn': 1,   // LogLevel.WARN
      'info': 2,   // LogLevel.INFO
      'debug': 3,  // LogLevel.DEBUG
      'verbose': 4 // LogLevel.VERBOSE
    };

    return levelMap[level.toLowerCase()] !== undefined ? levelMap[level.toLowerCase()] : 2; // Default to INFO
  }

  /**
   * Initializes log file
   * 
   * @param {string} projectPath - Project path
   * @param {string} adoptionId - Adoption ID (timestamp)
   */
  initialize(projectPath, adoptionId) {
    if (!this.logToFile) return;

    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(projectPath, '.kiro', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Set log file path
      this.logFilePath = path.join(logsDir, `adopt-${adoptionId}.log`);

      // Write header
      const header = [
        '='.repeat(80),
        `Scene Capability Engine - Adoption Log`,
        `Adoption ID: ${adoptionId}`,
        `Start Time: ${new Date().toISOString()}`,
        `Log Level: ${LogLevelNames[this.level]}`,
        '='.repeat(80),
        ''
      ].join('\n');

      fs.writeFileSync(this.logFilePath, header, 'utf8');

      this.info('Logger initialized', { logFile: this.logFilePath });
    } catch (error) {
      // Silently fail - logging is not critical
      this.logToFile = false;
      this.logFilePath = null;
    }
  }

  /**
   * Logs a message at specified level
   * 
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @private
   */
  _log(level, message, data = null) {
    if (!this.enabled || level > this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;
    const levelName = LogLevelNames[level];

    // Format log entry
    const logEntry = {
      timestamp,
      elapsed,
      level: levelName,
      message,
      data
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Format for output
    const formattedMessage = this._formatLogEntry(logEntry);

    // Write to console if enabled
    if (this.logToConsole) {
      console.log(formattedMessage);
    }

    // Write to file if enabled
    if (this.logToFile && this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formattedMessage + '\n', 'utf8');
      } catch (error) {
        // Silently fail - logging is not critical
      }
    }
  }

  /**
   * Formats log entry for output
   * 
   * @param {Object} entry - Log entry
   * @returns {string}
   * @private
   */
  _formatLogEntry(entry) {
    const parts = [
      `[${entry.timestamp}]`,
      `[+${this._formatElapsed(entry.elapsed)}]`,
      `[${entry.level}]`,
      entry.message
    ];

    if (entry.data) {
      parts.push(JSON.stringify(entry.data, null, 2));
    }

    return parts.join(' ');
  }

  /**
   * Formats elapsed time
   * 
   * @param {number} ms - Milliseconds
   * @returns {string}
   * @private
   */
  _formatElapsed(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(2);
      return `${minutes}m${seconds}s`;
    }
  }

  /**
   * Logs error message
   * 
   * @param {string} message - Error message
   * @param {Object} data - Additional data
   */
  error(message, data = null) {
    this._log(LogLevel.ERROR, message, data);
  }

  /**
   * Logs warning message
   * 
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = null) {
    this._log(LogLevel.WARN, message, data);
  }

  /**
   * Logs info message
   * 
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = null) {
    this._log(LogLevel.INFO, message, data);
  }

  /**
   * Logs debug message
   * 
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = null) {
    this._log(LogLevel.DEBUG, message, data);
  }

  /**
   * Logs verbose message
   * 
   * @param {string} message - Verbose message
   * @param {Object} data - Additional data
   */
  verbose(message, data = null) {
    this._log(LogLevel.VERBOSE, message, data);
  }

  /**
   * Logs operation start
   * 
   * @param {string} operation - Operation name
   * @param {Object} params - Operation parameters
   */
  startOperation(operation, params = null) {
    this.info(`Starting operation: ${operation}`, params);
  }

  /**
   * Logs operation end
   * 
   * @param {string} operation - Operation name
   * @param {Object} result - Operation result
   */
  endOperation(operation, result = null) {
    this.info(`Completed operation: ${operation}`, result);
  }

  /**
   * Logs operation error
   * 
   * @param {string} operation - Operation name
   * @param {Error} error - Error object
   */
  operationError(operation, error) {
    this.error(`Operation failed: ${operation}`, {
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Logs file operation
   * 
   * @param {string} operation - Operation type (create, update, delete, preserve)
   * @param {string} filePath - File path
   * @param {Object} details - Additional details
   */
  fileOperation(operation, filePath, details = null) {
    this.debug(`File ${operation}: ${filePath}`, details);
  }

  /**
   * Logs detection result
   * 
   * @param {Object} state - Project state
   */
  detectionResult(state) {
    this.info('Project state detected', {
      hasKiroDir: state.hasKiroDir,
      hasVersionFile: state.hasVersionFile,
      currentVersion: state.currentVersion,
      targetVersion: state.targetVersion,
      conflictsCount: state.conflicts ? state.conflicts.length : 0
    });
  }

  /**
   * Logs strategy selection
   * 
   * @param {string} mode - Selected mode
   * @param {string} reason - Selection reason
   */
  strategySelected(mode, reason) {
    this.info('Strategy selected', { mode, reason });
  }

  /**
   * Logs conflict resolution
   * 
   * @param {string} filePath - File path
   * @param {string} resolution - Resolution action
   * @param {string} reason - Resolution reason
   */
  conflictResolved(filePath, resolution, reason) {
    this.debug('Conflict resolved', { filePath, resolution, reason });
  }

  /**
   * Logs backup creation
   * 
   * @param {Object} backup - Backup result
   */
  backupCreated(backup) {
    this.info('Backup created', {
      id: backup.id,
      location: backup.location,
      filesCount: backup.filesCount,
      totalSize: backup.totalSize
    });
  }

  /**
   * Logs validation result
   * 
   * @param {Object} validation - Validation result
   */
  validationResult(validation) {
    if (validation.success) {
      this.info('Validation successful', {
        filesVerified: validation.filesVerified
      });
    } else {
      this.error('Validation failed', {
        error: validation.error
      });
    }
  }

  /**
   * Logs adoption plan
   * 
   * @param {Object} plan - Adoption plan
   */
  adoptionPlan(plan) {
    this.info('Adoption plan created', {
      mode: plan.mode,
      requiresBackup: plan.requiresBackup,
      changesCount: {
        created: plan.changes.created.length,
        updated: plan.changes.updated.length,
        deleted: plan.changes.deleted ? plan.changes.deleted.length : 0,
        preserved: plan.changes.preserved.length
      }
    });
  }

  /**
   * Logs adoption result
   * 
   * @param {Object} result - Adoption result
   */
  adoptionResult(result) {
    if (result.success) {
      this.info('Adoption completed successfully', {
        mode: result.mode,
        backupId: result.backup ? result.backup.id : null,
        changesCount: {
          created: result.changes.created.length,
          updated: result.changes.updated.length,
          deleted: result.changes.deleted ? result.changes.deleted.length : 0,
          preserved: result.changes.preserved.length
        }
      });
    } else {
      this.error('Adoption failed', {
        errors: result.errors
      });
    }
  }

  /**
   * Flushes log buffer to file
   */
  flush() {
    if (!this.logToFile || !this.logFilePath) return;

    try {
      // Write footer
      const footer = [
        '',
        '='.repeat(80),
        `End Time: ${new Date().toISOString()}`,
        `Total Duration: ${this._formatElapsed(Date.now() - this.startTime)}`,
        `Total Log Entries: ${this.logBuffer.length}`,
        '='.repeat(80)
      ].join('\n');

      fs.appendFileSync(this.logFilePath, footer + '\n', 'utf8');
    } catch (error) {
      // Silently fail - logging is not critical
    }
  }

  /**
   * Gets log file path
   * 
   * @returns {string|null}
   */
  getLogFilePath() {
    return this.logFilePath;
  }

  /**
   * Gets log buffer
   * 
   * @returns {Array}
   */
  getLogBuffer() {
    return this.logBuffer;
  }

  /**
   * Clears log buffer
   */
  clearBuffer() {
    this.logBuffer = [];
  }

  /**
   * Enables logging
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disables logging
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Sets log level
   * 
   * @param {string|number} level - Log level
   */
  setLevel(level) {
    this.level = this._parseLogLevel(level);
  }
}

// Export class and constants
module.exports = AdoptionLogger;
module.exports.LogLevel = LogLevel;
module.exports.LogLevelNames = LogLevelNames;
