/**
 * Tests for FeedbackManager
 */

const FeedbackManager = require('../../../lib/operations/feedback-manager');
const {
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus
} = require('../../../lib/operations/models');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('FeedbackManager', () => {
  let feedbackManager;
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feedback-manager-test-'));
    feedbackManager = new FeedbackManager(tempDir);
  });
  
  afterEach(async () => {
    await fs.remove(tempDir);
  });
  
  describe('receiveFeedback', () => {
    it('should receive and classify feedback', async () => {
      const content = {
        title: 'System is down',
        description: 'Production system crashed with error',
        project: 'test-project',
        version: '1.0.0'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.SUPPORT_TICKET,
        content
      );
      
      expect(feedback.id).toBeTruthy();
      expect(feedback.channel).toBe(FeedbackChannel.SUPPORT_TICKET);
      expect(feedback.type).toBe(FeedbackType.BUG_REPORT);
      expect(feedback.severity).toBe(FeedbackSeverity.CRITICAL);
      expect(feedback.status).toBe(FeedbackStatus.ACKNOWLEDGED);
      expect(feedback.project).toBe('test-project');
      expect(feedback.version).toBe('1.0.0');
    });
    
    it('should throw error for invalid channel', async () => {
      const content = {
        title: 'Test',
        description: 'Test description',
        project: 'test-project'
      };
      
      await expect(
        feedbackManager.receiveFeedback('invalid_channel', content)
      ).rejects.toThrow('Invalid feedback channel');
    });
    
    it('should throw error for missing title', async () => {
      const content = {
        description: 'Test description',
        project: 'test-project'
      };
      
      await expect(
        feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, content)
      ).rejects.toThrow('Feedback must include title and description');
    });
    
    it('should throw error for missing project', async () => {
      const content = {
        title: 'Test',
        description: 'Test description'
      };
      
      await expect(
        feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, content)
      ).rejects.toThrow('Feedback must include project name');
    });
    
    it('should default version to unknown if not provided', async () => {
      const content = {
        title: 'Test',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      expect(feedback.version).toBe('unknown');
    });
  });
  
  describe('classifyFeedback', () => {
    it('should classify bug reports', () => {
      const feedback = {
        content: {
          title: 'Application crashes on startup',
          description: 'Error message appears when launching'
        },
        channel: FeedbackChannel.USER_REPORT
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.type).toBe(FeedbackType.BUG_REPORT);
      expect(classification.confidence).toBeGreaterThan(0.8);
    });
    
    it('should classify performance issues', () => {
      const feedback = {
        content: {
          title: 'Slow response times',
          description: 'API calls are timing out frequently'
        },
        channel: FeedbackChannel.MONITORING_ALERT
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.type).toBe(FeedbackType.PERFORMANCE_ISSUE);
      expect(classification.severity).toBe(FeedbackSeverity.HIGH);
    });
    
    it('should classify feature requests', () => {
      const feedback = {
        content: {
          title: 'Add dark mode',
          description: 'Request to add dark mode feature'
        },
        channel: FeedbackChannel.CUSTOMER_SURVEY
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.type).toBe(FeedbackType.FEATURE_REQUEST);
    });
    
    it('should classify critical severity', () => {
      const feedback = {
        content: {
          title: 'Production system down',
          description: 'Critical outage affecting all users'
        },
        channel: FeedbackChannel.MONITORING_ALERT
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.severity).toBe(FeedbackSeverity.CRITICAL);
    });
    
    it('should classify high severity', () => {
      const feedback = {
        content: {
          title: 'Important issue',
          description: 'High priority bug causing degraded performance'
        },
        channel: FeedbackChannel.SUPPORT_TICKET
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.severity).toBe(FeedbackSeverity.HIGH);
    });
    
    it('should classify low severity', () => {
      const feedback = {
        content: {
          title: 'Minor enhancement',
          description: 'Low priority UI improvement'
        },
        channel: FeedbackChannel.USER_REPORT
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.severity).toBe(FeedbackSeverity.LOW);
    });
    
    it('should default to operational concern for unclear feedback', () => {
      const feedback = {
        content: {
          title: 'General question',
          description: 'How does this work?'
        },
        channel: FeedbackChannel.USER_REPORT
      };
      
      const classification = feedbackManager.classifyFeedback(feedback);
      
      expect(classification.type).toBe(FeedbackType.OPERATIONAL_CONCERN);
    });
  });
  
  describe('routeFeedback', () => {
    it('should trigger critical response for critical feedback', async () => {
      // Create and save feedback first
      const content = {
        title: 'Critical system failure',
        description: 'Production system is down',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.MONITORING_ALERT,
        content
      );
      
      // Check that critical response was saved
      const responseFile = path.join(tempDir, '.sce/feedback/critical-responses.json');
      const exists = await fs.pathExists(responseFile);
      expect(exists).toBe(true);
      
      const data = await fs.readJSON(responseFile);
      expect(data.responses.length).toBeGreaterThan(0);
      const response = data.responses.find(r => r.feedbackId === feedback.id);
      expect(response).toBeTruthy();
      expect(response.type).toBe('critical_response');
    });
    
    it('should queue non-critical feedback for review', async () => {
      const feedback = {
        id: 'test-id',
        severity: FeedbackSeverity.MEDIUM,
        type: FeedbackType.FEATURE_REQUEST,
        project: 'test-project'
      };
      
      await feedbackManager.routeFeedback(feedback);
      
      // Check that routing was logged
      const logFile = path.join(tempDir, '.sce/feedback/routing-log.json');
      const exists = await fs.pathExists(logFile);
      expect(exists).toBe(true);
      
      const data = await fs.readJSON(logFile);
      expect(data.logs).toHaveLength(1);
      expect(data.logs[0].action).toBe('queued_for_review');
    });
  });
  
  describe('trackResolution', () => {
    it('should update feedback status', async () => {
      // Create feedback first
      const content = {
        title: 'Test issue',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      // Update status
      await feedbackManager.trackResolution(
        feedback.id,
        FeedbackStatus.INVESTIGATING
      );
      
      // Verify update
      const updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.status).toBe(FeedbackStatus.INVESTIGATING);
    });
    
    it('should add resolution description', async () => {
      const content = {
        title: 'Test issue',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      await feedbackManager.trackResolution(
        feedback.id,
        FeedbackStatus.RESOLVED,
        'Fixed in version 1.1.0'
      );
      
      const updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.status).toBe(FeedbackStatus.RESOLVED);
      expect(updated.resolution.description).toBe('Fixed in version 1.1.0');
    });
    
    it('should throw error for invalid status', async () => {
      const content = {
        title: 'Test issue',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      await expect(
        feedbackManager.trackResolution(feedback.id, 'invalid_status')
      ).rejects.toThrow('Invalid feedback status');
    });
    
    it('should throw error for non-existent feedback', async () => {
      await expect(
        feedbackManager.trackResolution('non-existent-id', FeedbackStatus.RESOLVED)
      ).rejects.toThrow('Feedback not found');
    });
  });
  
  describe('validateStateTransition', () => {
    it('should allow valid transitions from ACKNOWLEDGED', () => {
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.ACKNOWLEDGED,
          FeedbackStatus.INVESTIGATING
        );
      }).not.toThrow();
      
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.ACKNOWLEDGED,
          FeedbackStatus.RESOLVED
        );
      }).not.toThrow();
    });
    
    it('should allow valid transitions from INVESTIGATING', () => {
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.INVESTIGATING,
          FeedbackStatus.RESOLVED
        );
      }).not.toThrow();
    });
    
    it('should allow valid transitions from RESOLVED', () => {
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.RESOLVED,
          FeedbackStatus.VERIFIED
        );
      }).not.toThrow();
    });
    
    it('should reject invalid transitions', () => {
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.VERIFIED,
          FeedbackStatus.ACKNOWLEDGED
        );
      }).toThrow('Invalid state transition');
    });
    
    it('should allow same status (idempotent)', () => {
      expect(() => {
        feedbackManager.validateStateTransition(
          FeedbackStatus.INVESTIGATING,
          FeedbackStatus.INVESTIGATING
        );
      }).not.toThrow();
    });
  });
  
  describe('listFeedbacks', () => {
    beforeEach(async () => {
      // Create multiple feedbacks with non-critical content
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Minor issue',
        description: 'Small bug found',
        project: 'project-a',
        version: '1.0.0'
      });
      
      await feedbackManager.receiveFeedback(FeedbackChannel.SUPPORT_TICKET, {
        title: 'Performance question',
        description: 'How to improve performance',
        project: 'project-a',
        version: '1.0.0'
      });
      
      await feedbackManager.receiveFeedback(FeedbackChannel.CUSTOMER_SURVEY, {
        title: 'Feature request',
        description: 'Add new feature',
        project: 'project-b',
        version: '2.0.0'
      });
    });
    
    it('should list all feedbacks without filters', async () => {
      const feedbacks = await feedbackManager.listFeedbacks();
      expect(feedbacks).toHaveLength(3);
    });
    
    it('should filter by project', async () => {
      const feedbacks = await feedbackManager.listFeedbacks({ project: 'project-a' });
      expect(feedbacks).toHaveLength(2);
      expect(feedbacks.every(f => f.project === 'project-a')).toBe(true);
    });
    
    it('should filter by severity', async () => {
      const feedbacks = await feedbackManager.listFeedbacks({ severity: FeedbackSeverity.MEDIUM });
      expect(feedbacks.length).toBeGreaterThan(0);
      expect(feedbacks.every(f => f.severity === FeedbackSeverity.MEDIUM)).toBe(true);
    });
    
    it('should filter by status', async () => {
      const feedbacks = await feedbackManager.listFeedbacks({ status: FeedbackStatus.ACKNOWLEDGED });
      expect(feedbacks.length).toBeGreaterThanOrEqual(2);  // At least 2 should be acknowledged
    });
    
    it('should filter by type', async () => {
      const feedbacks = await feedbackManager.listFeedbacks({ type: FeedbackType.FEATURE_REQUEST });
      expect(feedbacks.length).toBeGreaterThan(0);
      expect(feedbacks.every(f => f.type === FeedbackType.FEATURE_REQUEST)).toBe(true);
    });
    
    it('should apply multiple filters', async () => {
      const feedbacks = await feedbackManager.listFeedbacks({
        project: 'project-a',
        status: FeedbackStatus.ACKNOWLEDGED
      });
      expect(feedbacks.length).toBeGreaterThanOrEqual(1);  // At least 1 should match
      expect(feedbacks.every(f => f.project === 'project-a')).toBe(true);
      expect(feedbacks.every(f => f.status === FeedbackStatus.ACKNOWLEDGED)).toBe(true);
    });
  });
  
  describe('linkToVersion', () => {
    it('should link feedback to version', async () => {
      const content = {
        title: 'Test issue',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      await feedbackManager.linkToVersion(feedback.id, '2.0.0');
      
      const updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.version).toBe('2.0.0');
    });
    
    it('should throw error for non-existent feedback', async () => {
      await expect(
        feedbackManager.linkToVersion('non-existent-id', '2.0.0')
      ).rejects.toThrow('Feedback not found');
    });
  });
  
  describe('persistence', () => {
    it('should persist feedbacks across instances', async () => {
      const content = {
        title: 'Test issue',
        description: 'Test description',
        project: 'test-project'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.USER_REPORT,
        content
      );
      
      // Create new instance
      const newManager = new FeedbackManager(tempDir);
      const loaded = await newManager.getFeedback(feedback.id);
      
      expect(loaded).toBeTruthy();
      expect(loaded.id).toBe(feedback.id);
      expect(loaded.content.title).toBe('Test issue');
    });
    
    it('should handle empty feedback file', async () => {
      const feedbacks = await feedbackManager.loadFeedbacks();
      expect(feedbacks).toEqual([]);
    });
  });
  
  describe('integration scenarios', () => {
    it('should handle complete feedback lifecycle', async () => {
      // 1. Receive feedback
      const content = {
        title: 'Critical bug in production',
        description: 'System crashes when processing large files',
        project: 'my-app',
        version: '1.0.0'
      };
      
      const feedback = await feedbackManager.receiveFeedback(
        FeedbackChannel.SUPPORT_TICKET,
        content
      );
      
      expect(feedback.status).toBe(FeedbackStatus.ACKNOWLEDGED);
      expect(feedback.severity).toBe(FeedbackSeverity.CRITICAL);
      
      // 2. Start investigating
      await feedbackManager.trackResolution(
        feedback.id,
        FeedbackStatus.INVESTIGATING
      );
      
      let updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.status).toBe(FeedbackStatus.INVESTIGATING);
      
      // 3. Resolve issue
      await feedbackManager.trackResolution(
        feedback.id,
        FeedbackStatus.RESOLVED,
        'Fixed memory leak in file processor'
      );
      
      updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.status).toBe(FeedbackStatus.RESOLVED);
      expect(updated.resolution.description).toBeTruthy();
      
      // 4. Verify fix
      await feedbackManager.trackResolution(
        feedback.id,
        FeedbackStatus.VERIFIED
      );
      
      updated = await feedbackManager.getFeedback(feedback.id);
      expect(updated.status).toBe(FeedbackStatus.VERIFIED);
    });
  });
});
