/**
 * Execution Logger
 * 
 * Tracks governance tool executions for metrics and reporting
 */

const fs = require('fs-extra');
const path = require('path');

class ExecutionLogger {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.logDir = path.join(projectPath, '.kiro', 'logs');
    this.logFile = path.join(this.logDir, 'governance-history.json');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxRotatedLogs = 5;
  }
  
  /**
   * Log a governance tool execution
   * 
   * @param {string} tool - Tool name (diagnostic, cleanup, validation, archive)
   * @param {string} operation - Operation performed
   * @param {Object} results - Operation results
   * @returns {Promise<void>}
   */
  async logExecution(tool, operation, results) {
    try {
      // Ensure log directory exists
      await fs.ensureDir(this.logDir);
      
      // Check if log rotation is needed
      await this.rotateLogIfNeeded();
      
      // Create log entry
      const entry = {
        timestamp: new Date().toISOString(),
        tool,
        operation,
        results: this.sanitizeResults(results)
      };
      
      // Read existing log or create new array
      let logEntries = [];
      if (await fs.pathExists(this.logFile)) {
        try {
          const content = await fs.readFile(this.logFile, 'utf8');
          logEntries = JSON.parse(content);
          
          // Ensure it's an array
          if (!Array.isArray(logEntries)) {
            logEntries = [];
          }
        } catch (error) {
          // If log file is corrupted, start fresh
          console.warn('Log file corrupted, starting fresh');
          logEntries = [];
        }
      }
      
      // Append new entry
      logEntries.push(entry);
      
      // Write back to file
      await fs.writeFile(this.logFile, JSON.stringify(logEntries, null, 2), 'utf8');
    } catch (error) {
      // Log errors should not break the main operation
      console.error('Failed to log execution:', error.message);
    }
  }
  
  /**
   * Get execution history
   * 
   * @param {Object} options - Filter options
   * @param {string} options.tool - Filter by tool name
   * @param {Date} options.since - Filter by date
   * @param {number} options.limit - Limit number of entries
   * @returns {Promise<Array>}
   */
  async getHistory(options = {}) {
    try {
      // Check if log file exists
      if (!await fs.pathExists(this.logFile)) {
        return [];
      }
      
      // Read log file
      const content = await fs.readFile(this.logFile, 'utf8');
      let entries = JSON.parse(content);
      
      // Ensure it's an array
      if (!Array.isArray(entries)) {
        return [];
      }
      
      // Apply filters
      if (options.tool) {
        entries = entries.filter(entry => entry.tool === options.tool);
      }
      
      if (options.since) {
        const sinceTime = options.since.getTime();
        entries = entries.filter(entry => {
          const entryTime = new Date(entry.timestamp).getTime();
          return entryTime >= sinceTime;
        });
      }
      
      // Apply limit
      if (options.limit && options.limit > 0) {
        entries = entries.slice(-options.limit);
      }
      
      return entries;
    } catch (error) {
      console.error('Failed to read execution history:', error.message);
      return [];
    }
  }
  
  /**
   * Rotate log file if it exceeds max size
   * 
   * @returns {Promise<void>}
   */
  async rotateLogIfNeeded() {
    try {
      // Check if log file exists
      if (!await fs.pathExists(this.logFile)) {
        return;
      }
      
      // Check file size
      const stats = await fs.stat(this.logFile);
      
      if (stats.size < this.maxLogSize) {
        return;
      }
      
      // Rotate logs
      await this.rotateLog();
    } catch (error) {
      console.error('Failed to check log size:', error.message);
    }
  }
  
  /**
   * Rotate log file
   * 
   * @returns {Promise<void>}
   */
  async rotateLog() {
    try {
      // Remove oldest rotated log if we have max number
      const oldestLog = path.join(this.logDir, `governance-history.${this.maxRotatedLogs}.json`);
      if (await fs.pathExists(oldestLog)) {
        await fs.remove(oldestLog);
      }
      
      // Shift existing rotated logs
      for (let i = this.maxRotatedLogs - 1; i >= 1; i--) {
        const currentLog = path.join(this.logDir, `governance-history.${i}.json`);
        const nextLog = path.join(this.logDir, `governance-history.${i + 1}.json`);
        
        if (await fs.pathExists(currentLog)) {
          await fs.move(currentLog, nextLog, { overwrite: true });
        }
      }
      
      // Rotate current log to .1
      const rotatedLog = path.join(this.logDir, 'governance-history.1.json');
      await fs.move(this.logFile, rotatedLog, { overwrite: true });
      
      // Create new empty log
      await fs.writeFile(this.logFile, '[]', 'utf8');
    } catch (error) {
      console.error('Failed to rotate log:', error.message);
    }
  }
  
  /**
   * Sanitize results for logging (remove sensitive data, limit size)
   * 
   * @param {Object} results - Operation results
   * @returns {Object}
   */
  sanitizeResults(results) {
    // Create a shallow copy
    const sanitized = { ...results };
    
    // Limit array sizes to prevent huge logs
    const maxArraySize = 100;
    
    if (Array.isArray(sanitized.violations) && sanitized.violations.length > maxArraySize) {
      sanitized.violations = sanitized.violations.slice(0, maxArraySize);
      sanitized.violationsTruncated = true;
    }
    
    if (Array.isArray(sanitized.deletedFiles) && sanitized.deletedFiles.length > maxArraySize) {
      sanitized.deletedFiles = sanitized.deletedFiles.slice(0, maxArraySize);
      sanitized.deletedFilesTruncated = true;
    }
    
    if (Array.isArray(sanitized.movedFiles) && sanitized.movedFiles.length > maxArraySize) {
      sanitized.movedFiles = sanitized.movedFiles.slice(0, maxArraySize);
      sanitized.movedFilesTruncated = true;
    }
    
    if (Array.isArray(sanitized.errors) && sanitized.errors.length > maxArraySize) {
      sanitized.errors = sanitized.errors.slice(0, maxArraySize);
      sanitized.errorsTruncated = true;
    }
    
    return sanitized;
  }
  
  /**
   * Clear all logs (for testing or reset)
   * 
   * @returns {Promise<void>}
   */
  async clearLogs() {
    try {
      // Remove main log file
      if (await fs.pathExists(this.logFile)) {
        await fs.remove(this.logFile);
      }
      
      // Remove rotated logs
      for (let i = 1; i <= this.maxRotatedLogs; i++) {
        const rotatedLog = path.join(this.logDir, `governance-history.${i}.json`);
        if (await fs.pathExists(rotatedLog)) {
          await fs.remove(rotatedLog);
        }
      }
    } catch (error) {
      console.error('Failed to clear logs:', error.message);
    }
  }
}

module.exports = ExecutionLogger;
