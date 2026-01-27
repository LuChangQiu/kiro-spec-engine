/**
 * Unit Tests for Operations Models
 * 
 * Tests data models and enums
 */

const {
  TakeoverLevel,
  SecurityEnvironment,
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  OperationType,
  DocumentType
} = require('../../../lib/operations/models');

describe('Operations Models', () => {
  describe('TakeoverLevel', () => {
    test('should have all 5 levels defined', () => {
      expect(TakeoverLevel.L1_OBSERVATION).toBe('L1_OBSERVATION');
      expect(TakeoverLevel.L2_SUGGESTION).toBe('L2_SUGGESTION');
      expect(TakeoverLevel.L3_SEMI_AUTO).toBe('L3_SEMI_AUTO');
      expect(TakeoverLevel.L4_AUTO).toBe('L4_AUTO');
      expect(TakeoverLevel.L5_FULLY_AUTONOMOUS).toBe('L5_FULLY_AUTONOMOUS');
    });
    
    test('should have exactly 5 levels', () => {
      const levels = Object.keys(TakeoverLevel);
      expect(levels).toHaveLength(5);
    });
  });
  
  describe('SecurityEnvironment', () => {
    test('should have all 4 environments defined', () => {
      expect(SecurityEnvironment.DEVELOPMENT).toBe('development');
      expect(SecurityEnvironment.TEST).toBe('test');
      expect(SecurityEnvironment.PRE_PRODUCTION).toBe('pre-production');
      expect(SecurityEnvironment.PRODUCTION).toBe('production');
    });
    
    test('should have exactly 4 environments', () => {
      const environments = Object.keys(SecurityEnvironment);
      expect(environments).toHaveLength(4);
    });
  });
  
  describe('FeedbackChannel', () => {
    test('should have all 5 channels defined', () => {
      expect(FeedbackChannel.SUPPORT_TICKET).toBe('support_ticket');
      expect(FeedbackChannel.MONITORING_ALERT).toBe('monitoring_alert');
      expect(FeedbackChannel.USER_REPORT).toBe('user_report');
      expect(FeedbackChannel.API_ENDPOINT).toBe('api_endpoint');
      expect(FeedbackChannel.CUSTOMER_SURVEY).toBe('customer_survey');
    });
    
    test('should have exactly 5 channels', () => {
      const channels = Object.keys(FeedbackChannel);
      expect(channels).toHaveLength(5);
    });
  });
  
  describe('FeedbackType', () => {
    test('should have all 4 types defined', () => {
      expect(FeedbackType.BUG_REPORT).toBe('bug_report');
      expect(FeedbackType.PERFORMANCE_ISSUE).toBe('performance_issue');
      expect(FeedbackType.FEATURE_REQUEST).toBe('feature_request');
      expect(FeedbackType.OPERATIONAL_CONCERN).toBe('operational_concern');
    });
    
    test('should have exactly 4 types', () => {
      const types = Object.keys(FeedbackType);
      expect(types).toHaveLength(4);
    });
  });
  
  describe('FeedbackSeverity', () => {
    test('should have all 4 severity levels defined', () => {
      expect(FeedbackSeverity.CRITICAL).toBe('critical');
      expect(FeedbackSeverity.HIGH).toBe('high');
      expect(FeedbackSeverity.MEDIUM).toBe('medium');
      expect(FeedbackSeverity.LOW).toBe('low');
    });
    
    test('should have exactly 4 severity levels', () => {
      const severities = Object.keys(FeedbackSeverity);
      expect(severities).toHaveLength(4);
    });
  });
  
  describe('FeedbackStatus', () => {
    test('should have all 4 status states defined', () => {
      expect(FeedbackStatus.ACKNOWLEDGED).toBe('acknowledged');
      expect(FeedbackStatus.INVESTIGATING).toBe('investigating');
      expect(FeedbackStatus.RESOLVED).toBe('resolved');
      expect(FeedbackStatus.VERIFIED).toBe('verified');
    });
    
    test('should have exactly 4 status states', () => {
      const statuses = Object.keys(FeedbackStatus);
      expect(statuses).toHaveLength(4);
    });
  });
  
  describe('OperationType', () => {
    test('should have all operation types defined', () => {
      expect(OperationType.DEPLOYMENT).toBe('deployment');
      expect(OperationType.CONFIGURATION_CHANGE).toBe('configuration_change');
      expect(OperationType.DATA_MIGRATION).toBe('data_migration');
      expect(OperationType.ROLLBACK).toBe('rollback');
      expect(OperationType.MONITORING_UPDATE).toBe('monitoring_update');
      expect(OperationType.TROUBLESHOOTING).toBe('troubleshooting');
      expect(OperationType.FEEDBACK_RESPONSE).toBe('feedback_response');
      expect(OperationType.PERMISSION_CHANGE).toBe('permission_change');
    });
    
    test('should have at least 8 operation types', () => {
      const types = Object.keys(OperationType);
      expect(types.length).toBeGreaterThanOrEqual(8);
    });
  });
  
  describe('DocumentType', () => {
    test('should have all 9 document types defined', () => {
      expect(DocumentType.DEPLOYMENT).toBe('deployment');
      expect(DocumentType.MONITORING).toBe('monitoring');
      expect(DocumentType.OPERATIONS).toBe('operations');
      expect(DocumentType.TROUBLESHOOTING).toBe('troubleshooting');
      expect(DocumentType.ROLLBACK).toBe('rollback');
      expect(DocumentType.CHANGE_IMPACT).toBe('change-impact');
      expect(DocumentType.MIGRATION_PLAN).toBe('migration-plan');
      expect(DocumentType.FEEDBACK_RESPONSE).toBe('feedback-response');
      expect(DocumentType.TOOLS).toBe('tools');
    });
    
    test('should have exactly 9 document types', () => {
      const types = Object.keys(DocumentType);
      expect(types).toHaveLength(9);
    });
  });
});
