/**
 * Audit Logger
 * 
 * Logs all AI operations with tamper-evident storage
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class AuditLogger {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.auditPath = path.join(projectRoot, '.kiro/audit');
  }
  
  /**
   * Log an operation
   * 
   * @param {Object} entry - Audit entry
   * @returns {Promise<string>} Entry ID
   */
  async logOperation(entry) {
    await fs.ensureDir(this.auditPath);
    
    // Generate entry ID
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    // Create full entry
    const fullEntry = {
      id,
      timestamp: new Date().toISOString(),
      ...entry
    };
    
    // Calculate checksum for tamper-evidence
    const checksum = this.calculateChecksum(fullEntry);
    fullEntry.checksum = checksum;
    
    // Write to log file (append)
    const logFile = path.join(this.auditPath, 'operations.jsonl');
    await fs.appendFile(
      logFile,
      JSON.stringify(fullEntry) + '\n',
      'utf8'
    );
    
    return id;
  }
  
  /**
   * Query audit logs
   * 
   * @param {Object} query - Query parameters
   * @returns {Promise<Array>} Matching entries
   */
  async queryLogs(query = {}) {
    const logFile = path.join(this.auditPath, 'operations.jsonl');
    
    if (!await fs.pathExists(logFile)) {
      return [];
    }
    
    // Read all entries
    const content = await fs.readFile(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    const entries = lines.map(line => JSON.parse(line));
    
    // Filter by query
    return entries.filter(entry => {
      if (query.projectName && entry.project !== query.projectName) return false;
      if (query.operationType && entry.operationType !== query.operationType) return false;
      if (query.outcome && entry.outcome !== query.outcome) return false;
      if (query.environment && entry.securityEnvironment !== query.environment) return false;
      
      if (query.fromDate) {
        const entryDate = new Date(entry.timestamp);
        const fromDate = new Date(query.fromDate);
        if (entryDate < fromDate) return false;
      }
      
      if (query.toDate) {
        const entryDate = new Date(entry.timestamp);
        const toDate = new Date(query.toDate);
        if (entryDate > toDate) return false;
      }
      
      return true;
    });
  }
  
  /**
   * Generate audit summary
   * 
   * @param {string} project - Project name
   * @param {Object} timeRange - Time range {from, to}
   * @returns {Promise<Object>} Audit summary
   */
  async generateSummary(project, timeRange = {}) {
    const entries = await this.queryLogs({
      projectName: project,
      fromDate: timeRange.from,
      toDate: timeRange.to
    });
    
    const summary = {
      project,
      timeRange,
      totalOperations: entries.length,
      successCount: entries.filter(e => e.outcome === 'success').length,
      failureCount: entries.filter(e => e.outcome === 'failure').length,
      operationsByType: {},
      operationsByLevel: {}
    };
    
    summary.successRate = summary.totalOperations > 0
      ? (summary.successCount / summary.totalOperations * 100).toFixed(2) + '%'
      : '0%';
    
    // Count by type
    entries.forEach(entry => {
      const type = entry.operationType || 'unknown';
      summary.operationsByType[type] = (summary.operationsByType[type] || 0) + 1;
      
      const level = entry.takeoverLevel || 'unknown';
      summary.operationsByLevel[level] = (summary.operationsByLevel[level] || 0) + 1;
    });
    
    return summary;
  }
  
  /**
   * Export audit logs
   * 
   * @param {Object} query - Query parameters
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<string>} Exported data
   */
  async exportLogs(query = {}, format = 'json') {
    const entries = await this.queryLogs(query);
    
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }
    
    if (format === 'csv') {
      if (entries.length === 0) return '';
      
      // CSV header
      const headers = Object.keys(entries[0]);
      let csv = headers.join(',') + '\n';
      
      // CSV rows
      entries.forEach(entry => {
        const row = headers.map(h => {
          const value = entry[h];
          return typeof value === 'string' ? `"${value}"` : value;
        });
        csv += row.join(',') + '\n';
      });
      
      return csv;
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }
  
  /**
   * Calculate checksum for tamper-evidence
   * 
   * @param {Object} entry - Audit entry
   * @returns {string} SHA-256 checksum
   */
  calculateChecksum(entry) {
    const data = JSON.stringify(entry);
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Verify entry integrity
   * 
   * @param {Object} entry - Audit entry with checksum
   * @returns {boolean} Whether entry is valid
   */
  verifyEntry(entry) {
    const { checksum, ...entryWithoutChecksum } = entry;
    const calculatedChecksum = this.calculateChecksum(entryWithoutChecksum);
    return checksum === calculatedChecksum;
  }
  
  /**
   * Flag anomalies in operations
   * 
   * @param {string} project - Project name
   * @param {Object} threshold - Anomaly thresholds
   * @returns {Promise<Array>} Detected anomalies
   */
  async flagAnomalies(project, threshold = {}) {
    const entries = await this.queryLogs({ projectName: project });
    
    if (entries.length === 0) {
      return [];
    }
    
    const anomalies = [];
    
    // Default thresholds
    const thresholds = {
      errorRatePercent: threshold.errorRatePercent || 10,
      operationCountPerHour: threshold.operationCountPerHour || 100,
      unusualOperationType: threshold.unusualOperationType || true,
      ...threshold
    };
    
    // Calculate baseline metrics
    const totalOps = entries.length;
    const failedOps = entries.filter(e => e.outcome === 'failure').length;
    const errorRate = (failedOps / totalOps) * 100;
    
    // Anomaly 1: High error rate
    if (errorRate > thresholds.errorRatePercent) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 'high',
        message: `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${thresholds.errorRatePercent}%`,
        metric: errorRate,
        threshold: thresholds.errorRatePercent,
        affectedOperations: failedOps
      });
    }
    
    // Anomaly 2: Unusual operation frequency
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentOps = entries.filter(e => new Date(e.timestamp) > oneHourAgo);
    
    if (recentOps.length > thresholds.operationCountPerHour) {
      anomalies.push({
        type: 'high_operation_frequency',
        severity: 'medium',
        message: `${recentOps.length} operations in last hour exceeds threshold ${thresholds.operationCountPerHour}`,
        metric: recentOps.length,
        threshold: thresholds.operationCountPerHour,
        timeWindow: '1 hour'
      });
    }
    
    // Anomaly 3: Unusual operation types
    if (thresholds.unusualOperationType) {
      const operationTypes = {};
      entries.forEach(e => {
        const type = e.operationType || 'unknown';
        operationTypes[type] = (operationTypes[type] || 0) + 1;
      });
      
      // Flag operation types that appear only once or twice (potentially unusual)
      Object.entries(operationTypes).forEach(([type, count]) => {
        if (count <= 2 && totalOps > 10) {
          anomalies.push({
            type: 'unusual_operation_type',
            severity: 'low',
            message: `Operation type '${type}' appears only ${count} time(s)`,
            operationType: type,
            occurrences: count
          });
        }
      });
    }
    
    // Anomaly 4: Repeated failures of same operation
    const failuresByType = {};
    entries.filter(e => e.outcome === 'failure').forEach(e => {
      const type = e.operationType || 'unknown';
      failuresByType[type] = (failuresByType[type] || 0) + 1;
    });
    
    Object.entries(failuresByType).forEach(([type, count]) => {
      if (count >= 3) {
        anomalies.push({
          type: 'repeated_failures',
          severity: 'high',
          message: `Operation type '${type}' failed ${count} times`,
          operationType: type,
          failureCount: count
        });
      }
    });
    
    return anomalies;
  }
}

module.exports = AuditLogger;
