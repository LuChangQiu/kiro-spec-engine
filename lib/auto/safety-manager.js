/**
 * Safety Manager
 * Enforces safety boundaries and validates operations
 */

class SafetyManager {
  constructor(config = {}) {
    this.config = config.safety || {};
    this.auditLog = [];
  }
  
  /**
   * Check if operation is allowed
   * @param {string} operation - Operation type
   * @param {Object} context - Operation context
   * @returns {Object} - { allowed: boolean, reason: string }
   */
  async checkOperation(operation, context = {}) {
    // Check blocked operations
    if (this.config.blockedOperations?.includes(operation)) {
      return {
        allowed: false,
        reason: `Operation '${operation}' is blocked by configuration`
      };
    }
    
    // Check allowed operations (if whitelist exists)
    if (this.config.allowedOperations?.length > 0) {
      if (!this.config.allowedOperations.includes(operation)) {
        return {
          allowed: false,
          reason: `Operation '${operation}' is not in allowed list`
        };
      }
    }
    
    // Check specific safety rules
    const checks = [
      this.checkProductionAccess(operation, context),
      this.checkWorkspaceBoundary(operation, context),
      this.checkExternalAccess(operation, context),
      this.checkDestructiveOperation(operation, context)
    ];
    
    for (const check of checks) {
      if (!check.allowed) {
        return check;
      }
    }
    
    return { allowed: true, reason: 'Operation permitted' };
  }
  
  /**
   * Check production environment access
   * @param {string} operation - Operation type
   * @param {Object} context - Context
   * @returns {Object} - Check result
   */
  checkProductionAccess(operation, context) {
    if (context.environment === 'production' || context.isProduction) {
      if (this.config.requireProductionConfirmation !== false) {
        return {
          allowed: false,
          reason: 'Production environment access requires user confirmation',
          requiresConfirmation: true
        };
      }
    }
    return { allowed: true };
  }
  
  /**
   * Check workspace boundary
   * @param {string} operation - Operation type
   * @param {Object} context - Context
   * @returns {Object} - Check result
   */
  checkWorkspaceBoundary(operation, context) {
    if (context.filePath) {
      const path = require('path');
      const workspace = process.cwd();
      const absolutePath = path.resolve(context.filePath);
      
      if (!absolutePath.startsWith(workspace)) {
        return {
          allowed: false,
          reason: `File '${context.filePath}' is outside workspace boundary`,
          requiresConfirmation: true
        };
      }
    }
    return { allowed: true };
  }
  
  /**
   * Check external system access
   * @param {string} operation - Operation type
   * @param {Object} context - Context
   * @returns {Object} - Check result
   */
  checkExternalAccess(operation, context) {
    const externalOps = ['api-call', 'network-request', 'external-service'];
    
    if (externalOps.includes(operation)) {
      if (this.config.requireExternalResourceConfirmation !== false) {
        return {
          allowed: false,
          reason: 'External system access requires user confirmation',
          requiresConfirmation: true
        };
      }
    }
    return { allowed: true };
  }
  
  /**
   * Check destructive operation
   * @param {string} operation - Operation type
   * @param {Object} context - Context
   * @returns {Object} - Check result
   */
  checkDestructiveOperation(operation, context) {
    const destructiveOps = ['delete-file', 'drop-database', 'clear-data'];
    
    if (destructiveOps.includes(operation)) {
      if (this.config.requireDestructiveOperationConfirmation !== false) {
        return {
          allowed: false,
          reason: 'Destructive operation requires user confirmation',
          requiresConfirmation: true
        };
      }
    }
    return { allowed: true };
  }
  
  /**
   * Request user confirmation
   * @param {Object} check - Check result
   * @returns {boolean} - User response
   */
  async requestUserConfirmation(check) {
    // In real implementation, this would prompt user
    console.log(`⚠️  Safety check: ${check.reason}`);
    console.log('   Waiting for user confirmation...');
    
    // For now, return false (deny by default)
    return false;
  }
  
  /**
   * Log operation to audit log
   * @param {string} operation - Operation type
   * @param {Object} context - Context
   * @param {boolean} allowed - Whether allowed
   */
  logOperation(operation, context, allowed) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      operation,
      context,
      allowed,
      user: process.env.USER || 'unknown'
    });
  }
  
  /**
   * Get audit log
   * @returns {Array} - Audit log entries
   */
  getAuditLog() {
    return this.auditLog;
  }
  
  /**
   * Export audit log
   * @param {string} outputPath - Output file path
   */
  async exportAuditLog(outputPath) {
    const fs = require('fs-extra');
    await fs.writeJson(outputPath, this.auditLog, { spaces: 2 });
  }
}

module.exports = SafetyManager;
