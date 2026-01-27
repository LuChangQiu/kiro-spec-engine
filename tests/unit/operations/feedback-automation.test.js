/**
 * Unit Tests for Feedback Automation Features
 */

const path = require('path');
const fs = require('fs').promises;
const FeedbackManager = require('../../../lib/operations/feedback-manager');
const PermissionManager = require('../../../lib/operations/permission-manager');
const {
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  TakeoverLevel,
  SecurityEnvironment
} = require('../../../lib/operations/models');

describe('FeedbackManager - Automation Features', () => {
  let tempDir;
  let feedbackManager;
  let permissionManager;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join(__dirname, '../../temp', `feedback-automation-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    feedbackManager = new FeedbackManager(tempDir);
    permissionManager = new PermissionManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateAutomatedResponse', () => {
    it('should generate automated response for non-critical feedback at L3+', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Minor bug',
        description: 'Small issue',
        project: 'test-project',
        version: '1.0.0'
      });

      // Set takeover level to L3
      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L3_SEMI_AUTO,
        'Test setup',
        'test-user'
      );

      const result = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response.message).toBeDefined();
      expect(result.requiresHumanReview).toBe(false);
    });

    it('should reject automated response for critical feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'System down',
        description: 'Critical outage',
        project: 'test-project',
        version: '1.0.0'
      });

      // Set takeover level to L5 (highest)
      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        'Test setup',
        'test-user'
      );

      const result = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      expect(result.success).toBe(false);
      expect(result.requiresHumanReview).toBe(true);
      expect(result.reason).toContain('not authorized');
    });

    it('should reject automated response at L1 level', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug report',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      // Explicitly set L1 level
      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L1_OBSERVATION,
        'Test setup',
        'test-user'
      );

      const result = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      expect(result.success).toBe(false);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should reject automated response at L2 level', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug report',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L2_SUGGESTION,
        'Test setup',
        'test-user'
      );

      const result = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      expect(result.success).toBe(false);
      expect(result.requiresHumanReview).toBe(true);
    });

    it('should work without permission manager', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug report',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT
      );

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
    });

    it('should throw error for non-existent feedback', async () => {
      await expect(
        feedbackManager.generateAutomatedResponse(
          'non-existent-id',
          'test-project',
          SecurityEnvironment.DEVELOPMENT
        )
      ).rejects.toThrow('Feedback not found');
    });

    it('should generate different responses for different feedback types', async () => {
      const bugFeedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      const perfFeedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Performance issue',
        description: 'Slow performance',
        project: 'test-project',
        version: '1.0.0'
      });

      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L3_SEMI_AUTO,
        'Test setup',
        'test-user'
      );

      const bugResult = await feedbackManager.generateAutomatedResponse(
        bugFeedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      const perfResult = await feedbackManager.generateAutomatedResponse(
        perfFeedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      expect(bugResult.response.message).not.toBe(perfResult.response.message);
    });
  });

  describe('generateChangeProposal', () => {
    it('should generate change proposal for high severity feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Performance degraded',
        description: 'Slow response times',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateChangeProposal(feedback.id);

      expect(result.required).toBe(true);
      expect(result.proposal).toBeDefined();
      expect(result.proposal.feedbackId).toBe(feedback.id);
      expect(result.proposal.impactAssessment).toBeDefined();
      expect(result.proposal.recommendedActions).toBeDefined();
    });

    it('should not generate proposal for low severity feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Minor enhancement',
        description: 'Low priority feature request',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateChangeProposal(feedback.id);

      expect(result.required).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should generate proposal for critical feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'System down',
        description: 'Critical outage',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateChangeProposal(feedback.id);

      expect(result.required).toBe(true);
      expect(result.proposal.priority).toBe(FeedbackSeverity.CRITICAL);
    });

    it('should determine correct change type for performance issues', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Performance issue',
        description: 'Slow performance',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateChangeProposal(feedback.id);

      if (result.required) {
        expect(result.proposal.proposalType).toBe('performance_optimization');
      }
    });

    it('should determine correct change type for bug reports', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Bug in feature',
        description: 'Feature fails',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.generateChangeProposal(feedback.id);

      if (result.required) {
        expect(result.proposal.proposalType).toBe('bug_fix');
      }
    });

    it('should throw error for non-existent feedback', async () => {
      await expect(
        feedbackManager.generateChangeProposal('non-existent-id')
      ).rejects.toThrow('Feedback not found');
    });
  });

  describe('notifyStakeholders', () => {
    it('should send notification for critical feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'System down',
        description: 'Critical outage',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.notifyStakeholders(feedback.id);

      expect(result.sent).toBe(true);
      expect(result.notification).toBeDefined();
      expect(result.notification.subject).toContain('CRITICAL');
      expect(result.notification.recipients).toBeDefined();
    });

    it('should send notification for high severity feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Performance degraded',
        description: 'Slow response times',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.notifyStakeholders(feedback.id);

      expect(result.sent).toBe(true);
      expect(result.notification.subject).toContain('HIGH');
    });

    it('should not send notification for low severity feedback', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Minor issue',
        description: 'Low priority',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.notifyStakeholders(feedback.id);

      expect(result.sent).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should use custom stakeholder list when provided', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'System down',
        description: 'Critical outage',
        project: 'test-project',
        version: '1.0.0'
      });

      const customStakeholders = ['user1@example.com', 'user2@example.com'];
      const result = await feedbackManager.notifyStakeholders(feedback.id, customStakeholders);

      expect(result.sent).toBe(true);
      expect(result.notification.recipients).toEqual(customStakeholders);
    });

    it('should use default stakeholders when none provided', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'System down',
        description: 'Critical outage',
        project: 'test-project',
        version: '1.0.0'
      });

      const result = await feedbackManager.notifyStakeholders(feedback.id);

      expect(result.sent).toBe(true);
      expect(result.notification.recipients.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent feedback', async () => {
      await expect(
        feedbackManager.notifyStakeholders('non-existent-id')
      ).rejects.toThrow('Feedback not found');
    });
  });

  describe('Integration - Full Automation Workflow', () => {
    it('should handle complete automation workflow', async () => {
      // Create high severity feedback
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Performance degraded',
        description: 'Slow response times',
        project: 'test-project',
        version: '1.0.0'
      });

      // Set appropriate takeover level
      await permissionManager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L3_SEMI_AUTO,
        'Test setup',
        'test-user'
      );

      // Generate automated response
      const responseResult = await feedbackManager.generateAutomatedResponse(
        feedback.id,
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        permissionManager
      );

      // Generate change proposal
      const proposalResult = await feedbackManager.generateChangeProposal(feedback.id);

      // Notify stakeholders
      const notificationResult = await feedbackManager.notifyStakeholders(feedback.id);

      // Verify all steps completed successfully
      expect(responseResult.success).toBe(true);
      expect(proposalResult.required).toBe(true);
      expect(notificationResult.sent).toBe(true);
    });
  });
});
