/**
 * Unit Tests for Feedback Analytics
 */

const path = require('path');
const fs = require('fs').promises;
const FeedbackManager = require('../../../lib/operations/feedback-manager');
const {
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus
} = require('../../../lib/operations/models');

describe('FeedbackManager - Analytics', () => {
  let tempDir;
  let feedbackManager;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = path.join(__dirname, '../../temp', `feedback-analytics-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    feedbackManager = new FeedbackManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateAnalytics', () => {
    it('should generate analytics for empty feedback list', async () => {
      const timeRange = {
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-31T23:59:59Z'
      };

      const analytics = await feedbackManager.generateAnalytics('test-project', timeRange);

      expect(analytics).toBeDefined();
      expect(analytics.project).toBe('test-project');
      expect(analytics.totalFeedback).toBe(0);
      expect(analytics.commonIssues).toEqual([]);
      expect(analytics.resolutionTimes.average).toBe(0);
      expect(analytics.satisfactionTrends).toEqual([]);
      expect(analytics.versionSpecificIssues).toEqual([]);
    });

    it('should generate analytics with feedback data', async () => {
      // Create test feedbacks
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug in login',
        description: 'Login fails with error',
        project: 'test-project',
        version: '1.0.0'
      });

      await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Performance degraded',
        description: 'Slow response times',
        project: 'test-project',
        version: '1.0.0'
      });

      const timeRange = {
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T23:59:59Z'
      };

      const analytics = await feedbackManager.generateAnalytics('test-project', timeRange);

      expect(analytics.totalFeedback).toBe(2);
      expect(analytics.commonIssues.length).toBeGreaterThan(0);
      expect(analytics.versionSpecificIssues.length).toBeGreaterThan(0);
    });

    it('should filter feedbacks by time range', async () => {
      // Create feedback outside time range
      const oldFeedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Old bug',
        description: 'Old issue',
        project: 'test-project',
        version: '1.0.0'
      });

      // Manually set old date
      const feedbacks = await feedbackManager.loadFeedbacks();
      feedbacks[0].createdAt = '2025-01-01T00:00:00Z';
      await feedbackManager.saveFeedbacks(feedbacks);

      // Create feedback in time range
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'New bug',
        description: 'New issue',
        project: 'test-project',
        version: '1.0.0'
      });

      const timeRange = {
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T23:59:59Z'
      };

      const analytics = await feedbackManager.generateAnalytics('test-project', timeRange);

      expect(analytics.totalFeedback).toBe(1);
    });

    it('should include all required analytics components', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Test feedback',
        description: 'Test description',
        project: 'test-project',
        version: '1.0.0'
      });

      const timeRange = {
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T23:59:59Z'
      };

      const analytics = await feedbackManager.generateAnalytics('test-project', timeRange);

      expect(analytics).toHaveProperty('project');
      expect(analytics).toHaveProperty('generatedAt');
      expect(analytics).toHaveProperty('timeRange');
      expect(analytics).toHaveProperty('commonIssues');
      expect(analytics).toHaveProperty('resolutionTimes');
      expect(analytics).toHaveProperty('satisfactionTrends');
      expect(analytics).toHaveProperty('versionSpecificIssues');
      expect(analytics).toHaveProperty('totalFeedback');
      expect(analytics).toHaveProperty('statusDistribution');
    });
  });

  describe('_analyzeCommonIssues', () => {
    it('should identify common issue patterns', async () => {
      // Create multiple feedbacks with same pattern
      for (let i = 0; i < 3; i++) {
        await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
          title: 'Bug in feature',
          description: 'Feature fails',
          project: 'test-project',
          version: '1.0.0'
        });
      }

      const feedbacks = await feedbackManager.loadFeedbacks();
      const commonIssues = feedbackManager._analyzeCommonIssues(feedbacks);

      expect(commonIssues.length).toBeGreaterThan(0);
      expect(commonIssues[0].occurrences).toBe(3);
      expect(commonIssues[0]).toHaveProperty('pattern');
      expect(commonIssues[0]).toHaveProperty('type');
      expect(commonIssues[0]).toHaveProperty('severity');
      expect(commonIssues[0]).toHaveProperty('affectedVersions');
    });

    it('should sort issues by occurrence count', async () => {
      // Create 3 bug reports
      for (let i = 0; i < 3; i++) {
        await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
          title: 'Bug report',
          description: 'Bug description',
          project: 'test-project',
          version: '1.0.0'
        });
      }

      // Create 1 performance issue
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Performance issue',
        description: 'Slow performance',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const commonIssues = feedbackManager._analyzeCommonIssues(feedbacks);

      expect(commonIssues[0].occurrences).toBeGreaterThanOrEqual(commonIssues[1].occurrences);
    });

    it('should track affected versions', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug in v1',
        project: 'test-project',
        version: '1.0.0'
      });

      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug in v2',
        project: 'test-project',
        version: '2.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const commonIssues = feedbackManager._analyzeCommonIssues(feedbacks);

      expect(commonIssues[0].affectedVersions).toContain('1.0.0');
      expect(commonIssues[0].affectedVersions).toContain('2.0.0');
    });

    it('should limit to top 10 issues', async () => {
      // Create 15 different issue patterns
      for (let i = 0; i < 15; i++) {
        await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
          title: `Issue ${i}`,
          description: i % 2 === 0 ? 'Bug' : 'Performance slow',
          project: 'test-project',
          version: '1.0.0'
        });
      }

      const feedbacks = await feedbackManager.loadFeedbacks();
      const commonIssues = feedbackManager._analyzeCommonIssues(feedbacks);

      expect(commonIssues.length).toBeLessThanOrEqual(10);
    });
  });

  describe('_calculateResolutionTimes', () => {
    it('should return zero stats for no resolved feedbacks', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Unresolved bug',
        description: 'Not yet resolved',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const stats = feedbackManager._calculateResolutionTimes(feedbacks);

      expect(stats.average).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
    });

    it('should calculate resolution time statistics', async () => {
      const feedback = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      // Resolve feedback
      await feedbackManager.trackResolution(feedback.id, FeedbackStatus.RESOLVED, 'Fixed');

      const feedbacks = await feedbackManager.loadFeedbacks();
      const stats = feedbackManager._calculateResolutionTimes(feedbacks);

      expect(stats.average).toBeGreaterThan(0);
      expect(stats.median).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
    });

    it('should calculate stats by severity', async () => {
      // Create critical feedback
      const critical = await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Critical issue',
        description: 'System down',
        project: 'test-project',
        version: '1.0.0'
      });

      await feedbackManager.trackResolution(critical.id, FeedbackStatus.RESOLVED, 'Fixed');

      const feedbacks = await feedbackManager.loadFeedbacks();
      const stats = feedbackManager._calculateResolutionTimes(feedbacks);

      expect(stats.bySeverity).toBeDefined();
      expect(Object.keys(stats.bySeverity).length).toBeGreaterThan(0);
    });

    it('should calculate stats by type', async () => {
      const bug = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug report',
        description: 'Bug in feature',
        project: 'test-project',
        version: '1.0.0'
      });

      await feedbackManager.trackResolution(bug.id, FeedbackStatus.RESOLVED, 'Fixed');

      const feedbacks = await feedbackManager.loadFeedbacks();
      const stats = feedbackManager._calculateResolutionTimes(feedbacks);

      expect(stats.byType).toBeDefined();
      expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
    });
  });

  describe('_trackSatisfactionTrends', () => {
    it('should group feedbacks by month', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Feedback 1',
        description: 'Description 1',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-12-31');
      const trends = feedbackManager._trackSatisfactionTrends(feedbacks, fromDate, toDate);

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]).toHaveProperty('period');
      expect(trends[0]).toHaveProperty('totalFeedback');
      expect(trends[0]).toHaveProperty('resolvedCount');
      expect(trends[0]).toHaveProperty('resolutionRate');
    });

    it('should calculate resolution rate', async () => {
      const feedback1 = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Feedback 1',
        description: 'Description 1',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedback2 = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Feedback 2',
        description: 'Description 2',
        project: 'test-project',
        version: '1.0.0'
      });

      // Resolve one feedback
      await feedbackManager.trackResolution(feedback1.id, FeedbackStatus.RESOLVED, 'Fixed');

      const feedbacks = await feedbackManager.loadFeedbacks();
      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-12-31');
      const trends = feedbackManager._trackSatisfactionTrends(feedbacks, fromDate, toDate);

      expect(trends[0].totalFeedback).toBe(2);
      expect(trends[0].resolvedCount).toBe(1);
      expect(trends[0].resolutionRate).toBe(50);
    });

    it('should include severity distribution', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-12-31');
      const trends = feedbackManager._trackSatisfactionTrends(feedbacks, fromDate, toDate);

      expect(trends[0]).toHaveProperty('severityDistribution');
      expect(typeof trends[0].severityDistribution).toBe('object');
    });

    it('should sort trends by period', async () => {
      // Create feedbacks in different months
      const feedback1 = await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Feedback 1',
        description: 'Description 1',
        project: 'test-project',
        version: '1.0.0'
      });

      // Manually set different months
      const feedbacks = await feedbackManager.loadFeedbacks();
      feedbacks[0].createdAt = '2026-01-15T00:00:00Z';
      await feedbackManager.saveFeedbacks(feedbacks);

      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Feedback 2',
        description: 'Description 2',
        project: 'test-project',
        version: '1.0.0'
      });

      const allFeedbacks = await feedbackManager.loadFeedbacks();
      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-12-31');
      const trends = feedbackManager._trackSatisfactionTrends(allFeedbacks, fromDate, toDate);

      if (trends.length > 1) {
        expect(trends[0].period <= trends[1].period).toBe(true);
      }
    });
  });

  describe('_identifyVersionIssues', () => {
    it('should group feedbacks by version', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug in v1',
        description: 'Bug description',
        project: 'test-project',
        version: '1.0.0'
      });

      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug in v2',
        description: 'Bug description',
        project: 'test-project',
        version: '2.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const versionIssues = feedbackManager._identifyVersionIssues(feedbacks);

      expect(versionIssues.length).toBe(2);
      expect(versionIssues.some(v => v.version === '1.0.0')).toBe(true);
      expect(versionIssues.some(v => v.version === '2.0.0')).toBe(true);
    });

    it('should count critical issues per version', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.MONITORING_ALERT, {
        title: 'Critical bug',
        description: 'System down',
        project: 'test-project',
        version: '1.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const versionIssues = feedbackManager._identifyVersionIssues(feedbacks);

      expect(versionIssues[0].criticalCount).toBeGreaterThan(0);
    });

    it('should include top issues per version', async () => {
      for (let i = 0; i < 3; i++) {
        await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
          title: 'Bug',
          description: 'Bug description',
          project: 'test-project',
          version: '1.0.0'
        });
      }

      const feedbacks = await feedbackManager.loadFeedbacks();
      const versionIssues = feedbackManager._identifyVersionIssues(feedbacks);

      expect(versionIssues[0].topIssues).toBeDefined();
      expect(Array.isArray(versionIssues[0].topIssues)).toBe(true);
    });

    it('should sort versions by feedback count', async () => {
      // Create 3 feedbacks for v1
      for (let i = 0; i < 3; i++) {
        await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
          title: 'Bug',
          description: 'Bug description',
          project: 'test-project',
          version: '1.0.0'
        });
      }

      // Create 1 feedback for v2
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug description',
        project: 'test-project',
        version: '2.0.0'
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const versionIssues = feedbackManager._identifyVersionIssues(feedbacks);

      expect(versionIssues[0].feedbackCount).toBeGreaterThanOrEqual(versionIssues[1].feedbackCount);
    });

    it('should handle unknown versions', async () => {
      await feedbackManager.receiveFeedback(FeedbackChannel.USER_REPORT, {
        title: 'Bug',
        description: 'Bug description',
        project: 'test-project'
        // No version specified
      });

      const feedbacks = await feedbackManager.loadFeedbacks();
      const versionIssues = feedbackManager._identifyVersionIssues(feedbacks);

      expect(versionIssues.some(v => v.version === 'unknown')).toBe(true);
    });
  });

  describe('Integration - Full Analytics Workflow', () => {
    it('should generate complete analytics from multiple feedbacks', async () => {
      // Create diverse feedback data
      const feedbacks = [
        {
          channel: FeedbackChannel.USER_REPORT,
          content: {
            title: 'Login bug',
            description: 'Login fails with error',
            project: 'test-project',
            version: '1.0.0'
          }
        },
        {
          channel: FeedbackChannel.MONITORING_ALERT,
          content: {
            title: 'Performance issue',
            description: 'Slow response times',
            project: 'test-project',
            version: '1.0.0'
          }
        },
        {
          channel: FeedbackChannel.SUPPORT_TICKET,
          content: {
            title: 'Feature request',
            description: 'Add new feature',
            project: 'test-project',
            version: '1.1.0'
          }
        }
      ];

      // Create feedbacks
      const createdFeedbacks = [];
      for (const fb of feedbacks) {
        const created = await feedbackManager.receiveFeedback(fb.channel, fb.content);
        createdFeedbacks.push(created);
      }

      // Resolve some feedbacks
      await feedbackManager.trackResolution(createdFeedbacks[0].id, FeedbackStatus.RESOLVED, 'Fixed login');
      await feedbackManager.trackResolution(createdFeedbacks[1].id, FeedbackStatus.INVESTIGATING);

      // Generate analytics
      const timeRange = {
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T23:59:59Z'
      };

      const analytics = await feedbackManager.generateAnalytics('test-project', timeRange);

      // Verify analytics completeness
      expect(analytics.totalFeedback).toBe(3);
      expect(analytics.commonIssues.length).toBeGreaterThan(0);
      expect(analytics.versionSpecificIssues.length).toBe(2);  // Two versions
      expect(analytics.satisfactionTrends.length).toBeGreaterThan(0);
      expect(analytics.statusDistribution[FeedbackStatus.RESOLVED]).toBe(1);
      expect(analytics.statusDistribution[FeedbackStatus.INVESTIGATING]).toBe(1);
      expect(analytics.statusDistribution[FeedbackStatus.ACKNOWLEDGED]).toBe(1);
    });
  });
});
