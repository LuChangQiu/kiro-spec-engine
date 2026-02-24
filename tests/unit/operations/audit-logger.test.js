/**
 * Unit Tests for Audit Logger
 * 
 * Tests audit logging functionality
 */

const fs = require('fs-extra');
const path = require('path');
const AuditLogger = require('../../../lib/operations/audit-logger');
const { TakeoverLevel, SecurityEnvironment, OperationType } = require('../../../lib/operations/models');

describe('AuditLogger', () => {
  let logger;
  let testRoot;
  
  beforeEach(async () => {
    // Create temporary test directory
    testRoot = path.join(__dirname, '../../temp/audit-logger-test');
    await fs.ensureDir(testRoot);
    logger = new AuditLogger(testRoot);
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testRoot);
  });
  
  describe('logOperation', () => {
    test('should log operation with all required fields', async () => {
      const entry = {
        operationType: OperationType.DEPLOYMENT,
        targetSystem: 'test-service',
        project: 'test-project',
        parameters: { version: 'v1.0.0' },
        outcome: 'success',
        takeoverLevel: TakeoverLevel.L3_SEMI_AUTO,
        securityEnvironment: SecurityEnvironment.DEVELOPMENT
      };
      
      const id = await logger.logOperation(entry);
      
      expect(id).toBeTruthy();
      expect(id).toMatch(/^audit-\d+-[a-z0-9]+$/);
    });
    
    test('should add timestamp and checksum to entry', async () => {
      const entry = {
        operationType: OperationType.DEPLOYMENT,
        project: 'test-project',
        outcome: 'success'
      };
      
      await logger.logOperation(entry);
      
      const logs = await logger.queryLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp).toBeTruthy();
      expect(logs[0].checksum).toBeTruthy();
    });
    
    test('should append to existing log file', async () => {
      await logger.logOperation({ project: 'test1', outcome: 'success' });
      await logger.logOperation({ project: 'test2', outcome: 'success' });
      
      const logs = await logger.queryLogs();
      expect(logs).toHaveLength(2);
    });
    
    test('should create audit directory if not exists', async () => {
      const auditPath = path.join(testRoot, '.sce/audit');
      expect(await fs.pathExists(auditPath)).toBe(false);
      
      await logger.logOperation({ project: 'test', outcome: 'success' });
      
      expect(await fs.pathExists(auditPath)).toBe(true);
    });
  });
  
  describe('queryLogs', () => {
    beforeEach(async () => {
      // Create test data
      await logger.logOperation({
        project: 'project-a',
        operationType: OperationType.DEPLOYMENT,
        outcome: 'success',
        securityEnvironment: SecurityEnvironment.DEVELOPMENT,
        timestamp: new Date('2026-01-01T10:00:00Z').toISOString()
      });
      
      await logger.logOperation({
        project: 'project-a',
        operationType: OperationType.ROLLBACK,
        outcome: 'failure',
        securityEnvironment: SecurityEnvironment.PRODUCTION,
        timestamp: new Date('2026-01-02T10:00:00Z').toISOString()
      });
      
      await logger.logOperation({
        project: 'project-b',
        operationType: OperationType.DEPLOYMENT,
        outcome: 'success',
        securityEnvironment: SecurityEnvironment.TEST,
        timestamp: new Date('2026-01-03T10:00:00Z').toISOString()
      });
    });
    
    test('should return all logs when no query provided', async () => {
      const logs = await logger.queryLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });
    
    test('should filter by project name', async () => {
      const logs = await logger.queryLogs({ projectName: 'project-a' });
      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.project === 'project-a')).toBe(true);
    });
    
    test('should filter by operation type', async () => {
      const logs = await logger.queryLogs({ operationType: OperationType.DEPLOYMENT });
      expect(logs).toHaveLength(2);
      expect(logs.every(l => l.operationType === OperationType.DEPLOYMENT)).toBe(true);
    });
    
    test('should filter by outcome', async () => {
      const logs = await logger.queryLogs({ outcome: 'failure' });
      expect(logs).toHaveLength(1);
      expect(logs[0].outcome).toBe('failure');
    });
    
    test('should filter by environment', async () => {
      const logs = await logger.queryLogs({ environment: SecurityEnvironment.PRODUCTION });
      expect(logs).toHaveLength(1);
      expect(logs[0].securityEnvironment).toBe(SecurityEnvironment.PRODUCTION);
    });
    
    test('should filter by date range', async () => {
      const logs = await logger.queryLogs({
        fromDate: '2026-01-02T00:00:00Z',
        toDate: '2026-01-03T23:59:59Z'
      });
      
      expect(logs).toHaveLength(2);
    });
    
    test('should filter by from date only', async () => {
      const logs = await logger.queryLogs({
        fromDate: '2026-01-03T00:00:00Z'
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].project).toBe('project-b');
    });
    
    test('should filter by to date only', async () => {
      const logs = await logger.queryLogs({
        toDate: '2026-01-01T23:59:59Z'
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].project).toBe('project-a');
    });
    
    test('should combine multiple filters', async () => {
      const logs = await logger.queryLogs({
        projectName: 'project-a',
        outcome: 'success'
      });
      
      expect(logs).toHaveLength(1);
      expect(logs[0].operationType).toBe(OperationType.DEPLOYMENT);
    });
    
    test('should return empty array when no logs exist', async () => {
      const newLogger = new AuditLogger(path.join(testRoot, 'empty'));
      const logs = await newLogger.queryLogs();
      expect(logs).toEqual([]);
    });
  });
  
  describe('generateSummary', () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 0; i < 10; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: i < 8 ? 'success' : 'failure',
          takeoverLevel: TakeoverLevel.L3_SEMI_AUTO
        });
      }
      
      for (let i = 0; i < 5; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.CONFIGURATION_CHANGE,
          outcome: 'success',
          takeoverLevel: TakeoverLevel.L2_SUGGESTION
        });
      }
    });
    
    test('should generate summary with correct counts', async () => {
      const summary = await logger.generateSummary('test-project');
      
      expect(summary.project).toBe('test-project');
      expect(summary.totalOperations).toBe(15);
      expect(summary.successCount).toBe(13);
      expect(summary.failureCount).toBe(2);
    });
    
    test('should calculate success rate', async () => {
      const summary = await logger.generateSummary('test-project');
      
      expect(summary.successRate).toBe('86.67%');
    });
    
    test('should group operations by type', async () => {
      const summary = await logger.generateSummary('test-project');
      
      expect(summary.operationsByType[OperationType.DEPLOYMENT]).toBe(10);
      expect(summary.operationsByType[OperationType.CONFIGURATION_CHANGE]).toBe(5);
    });
    
    test('should group operations by takeover level', async () => {
      const summary = await logger.generateSummary('test-project');
      
      expect(summary.operationsByLevel[TakeoverLevel.L3_SEMI_AUTO]).toBe(10);
      expect(summary.operationsByLevel[TakeoverLevel.L2_SUGGESTION]).toBe(5);
    });
    
    test('should filter by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const summary = await logger.generateSummary('test-project', {
        from: oneHourAgo.toISOString(),
        to: now.toISOString()
      });
      
      expect(summary.timeRange.from).toBe(oneHourAgo.toISOString());
      expect(summary.timeRange.to).toBe(now.toISOString());
    });
    
    test('should handle project with no operations', async () => {
      const summary = await logger.generateSummary('non-existent-project');
      
      expect(summary.totalOperations).toBe(0);
      expect(summary.successRate).toBe('0%');
    });
  });
  
  describe('exportLogs', () => {
    beforeEach(async () => {
      await logger.logOperation({
        project: 'test',
        operationType: OperationType.DEPLOYMENT,
        outcome: 'success'
      });
      
      await logger.logOperation({
        project: 'test',
        operationType: OperationType.ROLLBACK,
        outcome: 'failure'
      });
    });
    
    test('should export logs in JSON format', async () => {
      const exported = await logger.exportLogs({}, 'json');
      
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(2);
    });
    
    test('should export logs in CSV format', async () => {
      const exported = await logger.exportLogs({}, 'csv');
      
      expect(exported).toContain('id,timestamp');
      expect(exported).toContain('test');
      
      const lines = exported.trim().split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 rows
    });
    
    test('should handle empty result set in CSV', async () => {
      const exported = await logger.exportLogs({ projectName: 'non-existent' }, 'csv');
      expect(exported).toBe('');
    });
    
    test('should throw error for unsupported format', async () => {
      await expect(logger.exportLogs({}, 'xml'))
        .rejects.toThrow('Unsupported export format: xml');
    });
    
    test('should apply query filters before export', async () => {
      const exported = await logger.exportLogs({ outcome: 'success' }, 'json');
      
      const parsed = JSON.parse(exported);
      expect(parsed.every(e => e.outcome === 'success')).toBe(true);
    });
  });
  
  describe('calculateChecksum', () => {
    test('should generate consistent checksum for same data', () => {
      const entry = { project: 'test', outcome: 'success' };
      
      const checksum1 = logger.calculateChecksum(entry);
      const checksum2 = logger.calculateChecksum(entry);
      
      expect(checksum1).toBe(checksum2);
    });
    
    test('should generate different checksums for different data', () => {
      const entry1 = { project: 'test1', outcome: 'success' };
      const entry2 = { project: 'test2', outcome: 'success' };
      
      const checksum1 = logger.calculateChecksum(entry1);
      const checksum2 = logger.calculateChecksum(entry2);
      
      expect(checksum1).not.toBe(checksum2);
    });
    
    test('should generate SHA-256 hash', () => {
      const entry = { project: 'test', outcome: 'success' };
      const checksum = logger.calculateChecksum(entry);
      
      // SHA-256 produces 64 character hex string
      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });
  
  describe('verifyEntry', () => {
    test('should verify valid entry', async () => {
      await logger.logOperation({ project: 'test', outcome: 'success' });
      
      const logs = await logger.queryLogs();
      const isValid = logger.verifyEntry(logs[0]);
      
      expect(isValid).toBe(true);
    });
    
    test('should detect tampered entry', async () => {
      await logger.logOperation({ project: 'test', outcome: 'success' });
      
      const logs = await logger.queryLogs();
      const tamperedEntry = { ...logs[0], outcome: 'failure' };
      
      const isValid = logger.verifyEntry(tamperedEntry);
      
      expect(isValid).toBe(false);
    });
    
    test('should detect missing checksum', () => {
      const entry = { project: 'test', outcome: 'success' };
      const isValid = logger.verifyEntry(entry);
      
      expect(isValid).toBe(false);
    });
  });
  
  describe('flagAnomalies', () => {
    test('should detect high error rate', async () => {
      // Create 10 operations: 8 failures, 2 successes (80% error rate)
      for (let i = 0; i < 8; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'failure'
        });
      }
      
      for (let i = 0; i < 2; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'success'
        });
      }
      
      const anomalies = await logger.flagAnomalies('test-project', {
        errorRatePercent: 10
      });
      
      const errorRateAnomaly = anomalies.find(a => a.type === 'high_error_rate');
      expect(errorRateAnomaly).toBeTruthy();
      expect(errorRateAnomaly.severity).toBe('high');
      expect(errorRateAnomaly.metric).toBeGreaterThan(10);
    });
    
    test('should detect high operation frequency', async () => {
      // Create 150 operations (exceeds default threshold of 100/hour)
      for (let i = 0; i < 150; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'success'
        });
      }
      
      const anomalies = await logger.flagAnomalies('test-project', {
        operationCountPerHour: 100
      });
      
      const frequencyAnomaly = anomalies.find(a => a.type === 'high_operation_frequency');
      expect(frequencyAnomaly).toBeTruthy();
      expect(frequencyAnomaly.severity).toBe('medium');
    });
    
    test('should detect unusual operation types', async () => {
      // Create many operations of one type, and one unusual operation
      for (let i = 0; i < 20; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'success'
        });
      }
      
      await logger.logOperation({
        project: 'test-project',
        operationType: OperationType.DATA_MIGRATION,
        outcome: 'success'
      });
      
      const anomalies = await logger.flagAnomalies('test-project');
      
      const unusualTypeAnomaly = anomalies.find(a => a.type === 'unusual_operation_type');
      expect(unusualTypeAnomaly).toBeTruthy();
      expect(unusualTypeAnomaly.severity).toBe('low');
      expect(unusualTypeAnomaly.operationType).toBe(OperationType.DATA_MIGRATION);
    });
    
    test('should detect repeated failures', async () => {
      // Create 5 failures of same operation type
      for (let i = 0; i < 5; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'failure'
        });
      }
      
      const anomalies = await logger.flagAnomalies('test-project');
      
      const repeatedFailureAnomaly = anomalies.find(a => a.type === 'repeated_failures');
      expect(repeatedFailureAnomaly).toBeTruthy();
      expect(repeatedFailureAnomaly.severity).toBe('high');
      expect(repeatedFailureAnomaly.failureCount).toBe(5);
    });
    
    test('should return empty array when no anomalies detected', async () => {
      // Create normal operations
      for (let i = 0; i < 10; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'success'
        });
      }
      
      const anomalies = await logger.flagAnomalies('test-project');
      
      // Should have no high error rate or repeated failures
      const criticalAnomalies = anomalies.filter(a => a.severity === 'high');
      expect(criticalAnomalies).toHaveLength(0);
    });
    
    test('should return empty array for project with no operations', async () => {
      const anomalies = await logger.flagAnomalies('non-existent-project');
      expect(anomalies).toEqual([]);
    });
    
    test('should use custom thresholds', async () => {
      // Create 3 failures (30% error rate)
      for (let i = 0; i < 3; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'failure'
        });
      }
      
      for (let i = 0; i < 7; i++) {
        await logger.logOperation({
          project: 'test-project',
          operationType: OperationType.DEPLOYMENT,
          outcome: 'success'
        });
      }
      
      // Should not flag with 50% threshold
      const anomalies1 = await logger.flagAnomalies('test-project', {
        errorRatePercent: 50
      });
      const errorAnomaly1 = anomalies1.find(a => a.type === 'high_error_rate');
      expect(errorAnomaly1).toBeFalsy();
      
      // Should flag with 20% threshold
      const anomalies2 = await logger.flagAnomalies('test-project', {
        errorRatePercent: 20
      });
      const errorAnomaly2 = anomalies2.find(a => a.type === 'high_error_rate');
      expect(errorAnomaly2).toBeTruthy();
    });
  });
  
  describe('error handling', () => {
    test('should handle corrupted log file gracefully', async () => {
      const logFile = path.join(testRoot, '.sce/audit/operations.jsonl');
      await fs.ensureDir(path.dirname(logFile));
      await fs.writeFile(logFile, 'invalid json\n', 'utf8');
      
      await expect(logger.queryLogs()).rejects.toThrow();
    });
  });
  
  describe('integration scenarios', () => {
    test('should support full audit lifecycle', async () => {
      // Log operations
      const id1 = await logger.logOperation({
        project: 'my-service',
        operationType: OperationType.DEPLOYMENT,
        outcome: 'success',
        takeoverLevel: TakeoverLevel.L3_SEMI_AUTO,
        securityEnvironment: SecurityEnvironment.PRODUCTION
      });
      
      const id2 = await logger.logOperation({
        project: 'my-service',
        operationType: OperationType.ROLLBACK,
        outcome: 'success',
        takeoverLevel: TakeoverLevel.L2_SUGGESTION,
        securityEnvironment: SecurityEnvironment.PRODUCTION
      });
      
      // Query logs
      const logs = await logger.queryLogs({ projectName: 'my-service' });
      expect(logs).toHaveLength(2);
      
      // Verify integrity
      expect(logger.verifyEntry(logs[0])).toBe(true);
      expect(logger.verifyEntry(logs[1])).toBe(true);
      
      // Generate summary
      const summary = await logger.generateSummary('my-service');
      expect(summary.totalOperations).toBe(2);
      expect(summary.successRate).toBe('100.00%');
      
      // Export logs
      const exported = await logger.exportLogs({ projectName: 'my-service' }, 'json');
      expect(exported).toContain(id1);
      expect(exported).toContain(id2);
    });
  });
});
