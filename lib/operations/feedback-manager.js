/**
 * Feedback Manager
 * 
 * Manages user feedback collection, classification, routing, and resolution tracking.
 * Integrates with operations specs to improve operational procedures based on feedback.
 */

const path = require('path');
const crypto = require('crypto');
const {
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus
} = require('./models');
const {
  pathExists,
  ensureDirectory,
  readJSON,
  writeJSON
} = require('../utils/fs-utils');

/**
 * Generate UUID v4
 * @returns {string} UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * FeedbackManager class
 */
class FeedbackManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.feedbackDir = path.join(projectPath, '.kiro/feedback');
    this.feedbackFile = path.join(this.feedbackDir, 'feedback.json');
  }

  /**
   * Receive feedback from a channel
   * 
   * @param {string} channel - Feedback channel (from FeedbackChannel enum)
   * @param {Object} content - Feedback content
   * @param {string} content.title - Feedback title
   * @param {string} content.description - Detailed description
   * @param {string} content.project - Project name
   * @param {string} content.version - Project version
   * @param {Object} content.metadata - Additional metadata
   * @returns {Promise<Object>} Created feedback object
   */
  async receiveFeedback(channel, content) {
    // Validate channel
    if (!Object.values(FeedbackChannel).includes(channel)) {
      throw new Error(`Invalid feedback channel: ${channel}`);
    }

    // Validate required content fields
    if (!content.title || !content.description) {
      throw new Error('Feedback must include title and description');
    }

    if (!content.project) {
      throw new Error('Feedback must include project name');
    }

    // Create feedback object
    const feedback = {
      id: generateUUID(),
      channel,
      type: null,  // Will be classified
      severity: null,  // Will be classified
      status: FeedbackStatus.ACKNOWLEDGED,
      project: content.project,
      version: content.version || 'unknown',
      content: {
        title: content.title,
        description: content.description,
        metadata: content.metadata || {}
      },
      classification: null,  // Will be set by classifier
      resolution: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Classify feedback
    const classification = this.classifyFeedback(feedback);
    feedback.type = classification.type;
    feedback.severity = classification.severity;
    feedback.classification = classification;

    // Save feedback
    await this.saveFeedback(feedback);

    // Route feedback based on severity
    await this.routeFeedback(feedback);

    return feedback;
  }

  /**
   * Classify feedback by type and severity
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Object} Classification result
   */
  classifyFeedback(feedback) {
    const content = feedback.content;
    const text = `${content.title} ${content.description}`.toLowerCase();

    // Classify type based on keywords
    let type = FeedbackType.OPERATIONAL_CONCERN;  // Default
    let confidence = 0.5;

    if (text.includes('bug') || text.includes('error') || text.includes('crash') || text.includes('fail')) {
      type = FeedbackType.BUG_REPORT;
      confidence = 0.9;
    } else if (text.includes('slow') || text.includes('performance') || text.includes('timeout') || text.includes('latency')) {
      type = FeedbackType.PERFORMANCE_ISSUE;
      confidence = 0.85;
    } else if (text.includes('feature') || text.includes('enhancement') || text.includes('request') || text.includes('add')) {
      type = FeedbackType.FEATURE_REQUEST;
      confidence = 0.8;
    }

    // Classify severity based on keywords and channel
    let severity = FeedbackSeverity.MEDIUM;  // Default

    if (text.includes('down') || text.includes('critical') || text.includes('urgent') || text.includes('production')) {
      severity = FeedbackSeverity.CRITICAL;
    } else if (text.includes('high priority') || text.includes('important') || text.includes('degraded')) {
      severity = FeedbackSeverity.HIGH;
    } else if (text.includes('minor') || text.includes('low priority') || text.includes('enhancement')) {
      severity = FeedbackSeverity.LOW;
    }

    // Monitoring alerts are typically high severity
    if (feedback.channel === FeedbackChannel.MONITORING_ALERT) {
      if (severity === FeedbackSeverity.MEDIUM) {
        severity = FeedbackSeverity.HIGH;
      }
    }

    return {
      type,
      severity,
      confidence,
      classifiedAt: new Date().toISOString()
    };
  }

  /**
   * Route feedback to appropriate handler
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Promise<void>}
   */
  async routeFeedback(feedback) {
    // Critical feedback triggers immediate response
    if (feedback.severity === FeedbackSeverity.CRITICAL) {
      await this.triggerCriticalResponse(feedback);
    }

    // Log routing action
    const routingLog = {
      feedbackId: feedback.id,
      severity: feedback.severity,
      type: feedback.type,
      action: feedback.severity === FeedbackSeverity.CRITICAL ? 'triggered_critical_response' : 'queued_for_review',
      timestamp: new Date().toISOString()
    };

    await this.logRoutingAction(routingLog);
  }

  /**
   * Trigger critical feedback response
   * 
   * @param {Object} feedback - Critical feedback object
   * @returns {Promise<void>}
   */
  async triggerCriticalResponse(feedback) {
    // Create response record
    const response = {
      feedbackId: feedback.id,
      type: 'critical_response',
      actions: [
        'Escalated to on-call team',
        'Triggered troubleshooting procedure',
        'Notified stakeholders'
      ],
      triggeredAt: new Date().toISOString()
    };

    // Save response
    await this.saveCriticalResponse(response);

    // Update feedback status (only if feedback is persisted)
    try {
      const existingFeedback = await this.getFeedback(feedback.id);
      if (existingFeedback) {
        await this.trackResolution(feedback.id, FeedbackStatus.INVESTIGATING);
      }
    } catch (error) {
      // Feedback not yet persisted, skip status update
    }
  }

  /**
   * Track feedback resolution
   * 
   * @param {string} feedbackId - Feedback ID
   * @param {string} status - New status (from FeedbackStatus enum)
   * @param {string} resolution - Resolution description (optional)
   * @returns {Promise<void>}
   */
  async trackResolution(feedbackId, status, resolution = null) {
    // Validate status
    if (!Object.values(FeedbackStatus).includes(status)) {
      throw new Error(`Invalid feedback status: ${status}`);
    }

    // Load feedback
    const feedbacks = await this.loadFeedbacks();
    const feedback = feedbacks.find(f => f.id === feedbackId);

    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Validate state transition
    this.validateStateTransition(feedback.status, status);

    // Update feedback
    feedback.status = status;
    feedback.updatedAt = new Date().toISOString();

    if (resolution) {
      feedback.resolution = {
        description: resolution,
        resolvedAt: new Date().toISOString()
      };
    }

    // Save updated feedback
    await this.saveFeedbacks(feedbacks);
  }

  /**
   * Validate feedback state transition
   * 
   * @param {string} currentStatus - Current status
   * @param {string} newStatus - New status
   * @throws {Error} If transition is invalid
   */
  validateStateTransition(currentStatus, newStatus) {
    const validTransitions = {
      [FeedbackStatus.ACKNOWLEDGED]: [FeedbackStatus.INVESTIGATING, FeedbackStatus.RESOLVED],
      [FeedbackStatus.INVESTIGATING]: [FeedbackStatus.RESOLVED, FeedbackStatus.ACKNOWLEDGED],
      [FeedbackStatus.RESOLVED]: [FeedbackStatus.VERIFIED, FeedbackStatus.INVESTIGATING],
      [FeedbackStatus.VERIFIED]: []  // Terminal state
    };

    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus) && currentStatus !== newStatus) {
      throw new Error(`Invalid state transition: ${currentStatus} -> ${newStatus}`);
    }
  }

  /**
   * Get feedback by ID
   * 
   * @param {string} feedbackId - Feedback ID
   * @returns {Promise<Object|null>} Feedback object or null
   */
  async getFeedback(feedbackId) {
    const feedbacks = await this.loadFeedbacks();
    return feedbacks.find(f => f.id === feedbackId) || null;
  }

  /**
   * List feedbacks with optional filters
   * 
   * @param {Object} filters - Filter criteria
   * @param {string} filters.project - Filter by project
   * @param {string} filters.severity - Filter by severity
   * @param {string} filters.status - Filter by status
   * @param {string} filters.type - Filter by type
   * @returns {Promise<Array>} Array of feedback objects
   */
  async listFeedbacks(filters = {}) {
    let feedbacks = await this.loadFeedbacks();

    // Apply filters
    if (filters.project) {
      feedbacks = feedbacks.filter(f => f.project === filters.project);
    }

    if (filters.severity) {
      feedbacks = feedbacks.filter(f => f.severity === filters.severity);
    }

    if (filters.status) {
      feedbacks = feedbacks.filter(f => f.status === filters.status);
    }

    if (filters.type) {
      feedbacks = feedbacks.filter(f => f.type === filters.type);
    }

    return feedbacks;
  }

  /**
   * Link feedback to project version
   * 
   * @param {string} feedbackId - Feedback ID
   * @param {string} version - Project version
   * @returns {Promise<void>}
   */
  async linkToVersion(feedbackId, version) {
    const feedbacks = await this.loadFeedbacks();
    const feedback = feedbacks.find(f => f.id === feedbackId);

    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    feedback.version = version;
    feedback.updatedAt = new Date().toISOString();

    await this.saveFeedbacks(feedbacks);
  }

  /**
   * Save feedback to storage
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Promise<void>}
   */
  async saveFeedback(feedback) {
    const feedbacks = await this.loadFeedbacks();
    feedbacks.push(feedback);
    await this.saveFeedbacks(feedbacks);
  }

  /**
   * Load all feedbacks from storage
   * 
   * @returns {Promise<Array>} Array of feedback objects
   */
  async loadFeedbacks() {
    await ensureDirectory(this.feedbackDir);

    const exists = await pathExists(this.feedbackFile);
    if (!exists) {
      return [];
    }

    try {
      const data = await readJSON(this.feedbackFile);
      return data.feedbacks || [];
    } catch (error) {
      console.warn(`Warning: Could not load feedbacks: ${error.message}`);
      return [];
    }
  }

  /**
   * Save feedbacks to storage
   * 
   * @param {Array} feedbacks - Array of feedback objects
   * @returns {Promise<void>}
   */
  async saveFeedbacks(feedbacks) {
    await ensureDirectory(this.feedbackDir);

    const data = {
      feedbacks,
      lastUpdated: new Date().toISOString()
    };

    await writeJSON(this.feedbackFile, data);
  }

  /**
   * Log routing action
   * 
   * @param {Object} routingLog - Routing log entry
   * @returns {Promise<void>}
   */
  async logRoutingAction(routingLog) {
    const logFile = path.join(this.feedbackDir, 'routing-log.json');
    await ensureDirectory(this.feedbackDir);

    let logs = [];
    const exists = await pathExists(logFile);
    if (exists) {
      try {
        const data = await readJSON(logFile);
        logs = data.logs || [];
      } catch (error) {
        // Ignore errors, start fresh
      }
    }

    logs.push(routingLog);

    await writeJSON(logFile, { logs, lastUpdated: new Date().toISOString() });
  }

  /**
   * Save critical response
   * 
   * @param {Object} response - Critical response object
   * @returns {Promise<void>}
   */
  async saveCriticalResponse(response) {
    const responseFile = path.join(this.feedbackDir, 'critical-responses.json');
    await ensureDirectory(this.feedbackDir);

    let responses = [];
    const exists = await pathExists(responseFile);
    if (exists) {
      try {
        const data = await readJSON(responseFile);
        responses = data.responses || [];
      } catch (error) {
        // Ignore errors, start fresh
      }
    }

    responses.push(response);

    await writeJSON(responseFile, { responses, lastUpdated: new Date().toISOString() });
  }

  /**
   * Generate feedback analytics
   * 
   * @param {string} project - Project name
   * @param {Object} timeRange - Time range for analytics
   * @param {string} timeRange.from - Start date (ISO)
   * @param {string} timeRange.to - End date (ISO)
   * @returns {Promise<Object>} FeedbackAnalytics object
   */
  async generateAnalytics(project, timeRange) {
    // Load all feedbacks for the project
    const allFeedbacks = await this.listFeedbacks({ project });

    // Filter by time range
    const fromDate = new Date(timeRange.from);
    const toDate = new Date(timeRange.to);

    const feedbacks = allFeedbacks.filter(f => {
      const createdAt = new Date(f.createdAt);
      return createdAt >= fromDate && createdAt <= toDate;
    });

    // Generate analytics components
    const commonIssues = this._analyzeCommonIssues(feedbacks);
    const resolutionTimes = this._calculateResolutionTimes(feedbacks);
    const satisfactionTrends = this._trackSatisfactionTrends(feedbacks, fromDate, toDate);
    const versionSpecificIssues = this._identifyVersionIssues(feedbacks);

    // Calculate status distribution
    const statusDistribution = {};
    Object.values(FeedbackStatus).forEach(status => {
      statusDistribution[status] = feedbacks.filter(f => f.status === status).length;
    });

    return {
      project,
      generatedAt: new Date().toISOString(),
      timeRange: {
        from: timeRange.from,
        to: timeRange.to
      },
      commonIssues,
      resolutionTimes,
      satisfactionTrends,
      versionSpecificIssues,
      totalFeedback: feedbacks.length,
      statusDistribution
    };
  }

  /**
   * Analyze common issue patterns
   * 
   * @param {Array} feedbacks - Array of feedback objects
   * @returns {Array} Array of IssuePattern objects
   * @private
   */
  _analyzeCommonIssues(feedbacks) {
    // Group feedbacks by type and severity
    const patterns = new Map();

    feedbacks.forEach(feedback => {
      const key = `${feedback.type}_${feedback.severity}`;
      
      if (!patterns.has(key)) {
        patterns.set(key, {
          pattern: `${feedback.type} with ${feedback.severity} severity`,
          occurrences: 0,
          type: feedback.type,
          severity: feedback.severity,
          affectedVersions: new Set(),
          firstSeen: feedback.createdAt,
          lastSeen: feedback.createdAt
        });
      }

      const pattern = patterns.get(key);
      pattern.occurrences++;
      pattern.affectedVersions.add(feedback.version);
      
      // Update first/last seen
      if (new Date(feedback.createdAt) < new Date(pattern.firstSeen)) {
        pattern.firstSeen = feedback.createdAt;
      }
      if (new Date(feedback.createdAt) > new Date(pattern.lastSeen)) {
        pattern.lastSeen = feedback.createdAt;
      }
    });

    // Convert to array and sort by occurrences
    const issuePatterns = Array.from(patterns.values())
      .map(p => ({
        ...p,
        affectedVersions: Array.from(p.affectedVersions)
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);  // Top 10 issues

    return issuePatterns;
  }

  /**
   * Calculate resolution time statistics
   * 
   * @param {Array} feedbacks - Array of feedback objects
   * @returns {Object} ResolutionTimeStats object
   * @private
   */
  _calculateResolutionTimes(feedbacks) {
    // Filter resolved feedbacks
    const resolvedFeedbacks = feedbacks.filter(f => 
      f.resolution && f.resolution.resolvedAt
    );

    if (resolvedFeedbacks.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        bySeverity: {},
        byType: {}
      };
    }

    // Calculate resolution times in hours
    const resolutionTimes = resolvedFeedbacks.map(f => {
      const created = new Date(f.createdAt);
      const resolved = new Date(f.resolution.resolvedAt);
      return (resolved - created) / (1000 * 60 * 60);  // Convert to hours
    });

    // Calculate statistics
    const sorted = resolutionTimes.sort((a, b) => a - b);
    const average = resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Calculate by severity
    const bySeverity = {};
    Object.values(FeedbackSeverity).forEach(severity => {
      const severityFeedbacks = resolvedFeedbacks.filter(f => f.severity === severity);
      if (severityFeedbacks.length > 0) {
        const times = severityFeedbacks.map(f => {
          const created = new Date(f.createdAt);
          const resolved = new Date(f.resolution.resolvedAt);
          return (resolved - created) / (1000 * 60 * 60);
        });
        bySeverity[severity] = times.reduce((sum, t) => sum + t, 0) / times.length;
      }
    });

    // Calculate by type
    const byType = {};
    Object.values(FeedbackType).forEach(type => {
      const typeFeedbacks = resolvedFeedbacks.filter(f => f.type === type);
      if (typeFeedbacks.length > 0) {
        const times = typeFeedbacks.map(f => {
          const created = new Date(f.createdAt);
          const resolved = new Date(f.resolution.resolvedAt);
          return (resolved - created) / (1000 * 60 * 60);
        });
        byType[type] = times.reduce((sum, t) => sum + t, 0) / times.length;
      }
    });

    return {
      average,
      median,
      min,
      max,
      bySeverity,
      byType
    };
  }

  /**
   * Track satisfaction trends over time
   * 
   * @param {Array} feedbacks - Array of feedback objects
   * @param {Date} fromDate - Start date
   * @param {Date} toDate - End date
   * @returns {Array} Array of SatisfactionTrend objects
   * @private
   */
  _trackSatisfactionTrends(feedbacks, fromDate, toDate) {
    // Group feedbacks by month
    const monthlyData = new Map();

    feedbacks.forEach(feedback => {
      const date = new Date(feedback.createdAt);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(period)) {
        monthlyData.set(period, {
          period,
          feedbacks: [],
          severityDistribution: {}
        });
      }

      monthlyData.get(period).feedbacks.push(feedback);
    });

    // Calculate trends for each period
    const trends = Array.from(monthlyData.values()).map(data => {
      const totalFeedback = data.feedbacks.length;
      const resolvedCount = data.feedbacks.filter(f => 
        f.status === FeedbackStatus.RESOLVED || f.status === FeedbackStatus.VERIFIED
      ).length;
      const resolutionRate = totalFeedback > 0 ? (resolvedCount / totalFeedback) * 100 : 0;

      // Calculate average resolution time for this period
      const resolvedFeedbacks = data.feedbacks.filter(f => 
        f.resolution && f.resolution.resolvedAt
      );
      let averageResolutionTime = 0;
      if (resolvedFeedbacks.length > 0) {
        const times = resolvedFeedbacks.map(f => {
          const created = new Date(f.createdAt);
          const resolved = new Date(f.resolution.resolvedAt);
          return (resolved - created) / (1000 * 60 * 60);
        });
        averageResolutionTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      }

      // Calculate severity distribution
      const severityDistribution = {};
      Object.values(FeedbackSeverity).forEach(severity => {
        severityDistribution[severity] = data.feedbacks.filter(f => f.severity === severity).length;
      });

      return {
        period: data.period,
        totalFeedback,
        resolvedCount,
        resolutionRate,
        averageResolutionTime,
        severityDistribution
      };
    });

    // Sort by period
    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Identify version-specific issues
   * 
   * @param {Array} feedbacks - Array of feedback objects
   * @returns {Array} Array of VersionIssue objects
   * @private
   */
  _identifyVersionIssues(feedbacks) {
    // Group feedbacks by version
    const versionData = new Map();

    feedbacks.forEach(feedback => {
      const version = feedback.version || 'unknown';

      if (!versionData.has(version)) {
        versionData.set(version, {
          version,
          feedbacks: []
        });
      }

      versionData.get(version).feedbacks.push(feedback);
    });

    // Analyze each version
    const versionIssues = Array.from(versionData.values()).map(data => {
      const feedbackCount = data.feedbacks.length;
      const criticalCount = data.feedbacks.filter(f => f.severity === FeedbackSeverity.CRITICAL).length;

      // Get top issues for this version
      const topIssues = this._analyzeCommonIssues(data.feedbacks).slice(0, 5);

      // Calculate average resolution time
      const resolvedFeedbacks = data.feedbacks.filter(f => 
        f.resolution && f.resolution.resolvedAt
      );
      let averageResolutionTime = 0;
      if (resolvedFeedbacks.length > 0) {
        const times = resolvedFeedbacks.map(f => {
          const created = new Date(f.createdAt);
          const resolved = new Date(f.resolution.resolvedAt);
          return (resolved - created) / (1000 * 60 * 60);
        });
        averageResolutionTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      }

      return {
        version: data.version,
        feedbackCount,
        topIssues,
        criticalCount,
        averageResolutionTime
      };
    });

    // Sort by feedback count (descending)
    return versionIssues.sort((a, b) => b.feedbackCount - a.feedbackCount);
  }

  /**
   * Generate automated response for feedback
   * 
   * @param {string} feedbackId - Feedback ID
   * @param {string} project - Project name
   * @param {string} environment - Security environment
   * @param {Object} permissionManager - PermissionManager instance (optional)
   * @returns {Promise<Object>} Response result
   */
  async generateAutomatedResponse(feedbackId, project, environment, permissionManager = null) {
    // Load feedback
    const feedback = await this.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Check if automated response is authorized
    if (permissionManager) {
      const takeoverLevel = await permissionManager.getTakeoverLevel(project, environment);
      const authorized = this._isAutomatedResponseAuthorized(feedback, takeoverLevel);

      if (!authorized) {
        return {
          success: false,
          reason: 'Automated response not authorized for current takeover level',
          takeoverLevel,
          requiresHumanReview: true
        };
      }
    }

    // Generate response based on feedback pattern
    const response = this._generateResponseContent(feedback);

    // Save automated response
    await this.saveAutomatedResponse({
      feedbackId,
      response,
      generatedAt: new Date().toISOString(),
      authorized: true,
      takeoverLevel: permissionManager ? await permissionManager.getTakeoverLevel(project, environment) : 'unknown'
    });

    return {
      success: true,
      response,
      requiresHumanReview: false
    };
  }

  /**
   * Check if automated response is authorized
   * 
   * @param {Object} feedback - Feedback object
   * @param {string} takeoverLevel - Current takeover level
   * @returns {boolean} True if authorized
   * @private
   */
  _isAutomatedResponseAuthorized(feedback, takeoverLevel) {
    const { TakeoverLevel } = require('./models');

    // Critical feedback always requires human review
    if (feedback.severity === FeedbackSeverity.CRITICAL) {
      return false;
    }

    // L1 and L2: No automation
    if (takeoverLevel === TakeoverLevel.L1_OBSERVATION || 
        takeoverLevel === TakeoverLevel.L2_SUGGESTION) {
      return false;
    }

    // L3+: Can automate non-critical feedback
    return true;
  }

  /**
   * Generate response content based on feedback pattern
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Object} Response content
   * @private
   */
  _generateResponseContent(feedback) {
    // Simple pattern-based response generation
    const responses = {
      [FeedbackType.BUG_REPORT]: {
        message: 'Thank you for reporting this issue. We have logged it and will investigate.',
        actions: ['Issue logged', 'Assigned to engineering team']
      },
      [FeedbackType.PERFORMANCE_ISSUE]: {
        message: 'We have received your performance report and are analyzing the metrics.',
        actions: ['Performance metrics collected', 'Analysis in progress']
      },
      [FeedbackType.FEATURE_REQUEST]: {
        message: 'Thank you for your feature suggestion. We have added it to our backlog.',
        actions: ['Feature request logged', 'Added to product backlog']
      },
      [FeedbackType.OPERATIONAL_CONCERN]: {
        message: 'Your operational concern has been noted and forwarded to the operations team.',
        actions: ['Concern logged', 'Operations team notified']
      }
    };

    const template = responses[feedback.type] || responses[FeedbackType.OPERATIONAL_CONCERN];

    return {
      message: template.message,
      actions: template.actions,
      feedbackId: feedback.id,
      type: 'automated'
    };
  }

  /**
   * Generate change proposal from feedback
   * 
   * @param {string} feedbackId - Feedback ID
   * @returns {Promise<Object>} Change proposal
   */
  async generateChangeProposal(feedbackId) {
    const feedback = await this.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Determine if feedback requires operational changes
    const requiresChange = this._requiresOperationalChange(feedback);

    if (!requiresChange) {
      return {
        required: false,
        reason: 'Feedback does not indicate need for operational changes'
      };
    }

    // Generate change proposal
    const proposal = {
      feedbackId: feedback.id,
      proposalType: this._determineChangeType(feedback),
      description: `Operational change proposed based on feedback: ${feedback.content.title}`,
      impactAssessment: this._assessChangeImpact(feedback),
      recommendedActions: this._recommendActions(feedback),
      priority: feedback.severity,
      createdAt: new Date().toISOString()
    };

    // Save proposal
    await this.saveChangeProposal(proposal);

    return {
      required: true,
      proposal
    };
  }

  /**
   * Check if feedback requires operational change
   * 
   * @param {Object} feedback - Feedback object
   * @returns {boolean} True if change required
   * @private
   */
  _requiresOperationalChange(feedback) {
    // Recurring issues or high severity issues typically require changes
    return feedback.severity === FeedbackSeverity.CRITICAL ||
           feedback.severity === FeedbackSeverity.HIGH;
  }

  /**
   * Determine type of operational change needed
   * 
   * @param {Object} feedback - Feedback object
   * @returns {string} Change type
   * @private
   */
  _determineChangeType(feedback) {
    if (feedback.type === FeedbackType.PERFORMANCE_ISSUE) {
      return 'performance_optimization';
    } else if (feedback.type === FeedbackType.BUG_REPORT) {
      return 'bug_fix';
    } else {
      return 'operational_improvement';
    }
  }

  /**
   * Assess impact of proposed change
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Object} Impact assessment
   * @private
   */
  _assessChangeImpact(feedback) {
    return {
      severity: feedback.severity,
      affectedComponents: ['operations'],
      estimatedEffort: feedback.severity === FeedbackSeverity.CRITICAL ? 'high' : 'medium',
      riskLevel: feedback.severity === FeedbackSeverity.CRITICAL ? 'high' : 'low'
    };
  }

  /**
   * Recommend actions for feedback
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Array} Recommended actions
   * @private
   */
  _recommendActions(feedback) {
    const actions = [];

    if (feedback.type === FeedbackType.PERFORMANCE_ISSUE) {
      actions.push('Review performance metrics');
      actions.push('Optimize slow operations');
      actions.push('Update monitoring thresholds');
    } else if (feedback.type === FeedbackType.BUG_REPORT) {
      actions.push('Investigate root cause');
      actions.push('Implement fix');
      actions.push('Add regression test');
    } else {
      actions.push('Review operational procedures');
      actions.push('Update documentation');
    }

    return actions;
  }

  /**
   * Notify stakeholders about feedback
   * 
   * @param {string} feedbackId - Feedback ID
   * @param {Array} stakeholders - List of stakeholder emails
   * @returns {Promise<Object>} Notification result
   */
  async notifyStakeholders(feedbackId, stakeholders = []) {
    const feedback = await this.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error(`Feedback not found: ${feedbackId}`);
    }

    // Determine if notification is required
    const requiresNotification = this._requiresStakeholderNotification(feedback);

    if (!requiresNotification) {
      return {
        sent: false,
        reason: 'Feedback does not require stakeholder notification'
      };
    }

    // Generate notification
    const notification = {
      feedbackId: feedback.id,
      subject: `[${feedback.severity.toUpperCase()}] Feedback requires attention: ${feedback.content.title}`,
      body: this._generateNotificationBody(feedback),
      recipients: stakeholders.length > 0 ? stakeholders : this._getDefaultStakeholders(feedback),
      sentAt: new Date().toISOString()
    };

    // Save notification record
    await this.saveNotification(notification);

    return {
      sent: true,
      notification
    };
  }

  /**
   * Check if feedback requires stakeholder notification
   * 
   * @param {Object} feedback - Feedback object
   * @returns {boolean} True if notification required
   * @private
   */
  _requiresStakeholderNotification(feedback) {
    // Critical and high severity feedback requires notification
    return feedback.severity === FeedbackSeverity.CRITICAL ||
           feedback.severity === FeedbackSeverity.HIGH;
  }

  /**
   * Generate notification body
   * 
   * @param {Object} feedback - Feedback object
   * @returns {string} Notification body
   * @private
   */
  _generateNotificationBody(feedback) {
    return `
Feedback ID: ${feedback.id}
Severity: ${feedback.severity}
Type: ${feedback.type}
Project: ${feedback.project}
Version: ${feedback.version}

Title: ${feedback.content.title}
Description: ${feedback.content.description}

Status: ${feedback.status}
Created: ${feedback.createdAt}

This feedback requires human attention. Please review and take appropriate action.
    `.trim();
  }

  /**
   * Get default stakeholders for feedback
   * 
   * @param {Object} feedback - Feedback object
   * @returns {Array} List of stakeholder emails
   * @private
   */
  _getDefaultStakeholders(feedback) {
    // In a real system, this would query a stakeholder registry
    // For now, return placeholder
    return ['operations-team@example.com'];
  }

  /**
   * Save automated response
   * 
   * @param {Object} response - Automated response object
   * @returns {Promise<void>}
   */
  async saveAutomatedResponse(response) {
    const responseFile = path.join(this.feedbackDir, 'automated-responses.json');
    await ensureDirectory(this.feedbackDir);

    let responses = [];
    const exists = await pathExists(responseFile);
    if (exists) {
      try {
        const data = await readJSON(responseFile);
        responses = data.responses || [];
      } catch (error) {
        // Ignore errors, start fresh
      }
    }

    responses.push(response);

    await writeJSON(responseFile, { responses, lastUpdated: new Date().toISOString() });
  }

  /**
   * Save change proposal
   * 
   * @param {Object} proposal - Change proposal object
   * @returns {Promise<void>}
   */
  async saveChangeProposal(proposal) {
    const proposalFile = path.join(this.feedbackDir, 'change-proposals.json');
    await ensureDirectory(this.feedbackDir);

    let proposals = [];
    const exists = await pathExists(proposalFile);
    if (exists) {
      try {
        const data = await readJSON(proposalFile);
        proposals = data.proposals || [];
      } catch (error) {
        // Ignore errors, start fresh
      }
    }

    proposals.push(proposal);

    await writeJSON(proposalFile, { proposals, lastUpdated: new Date().toISOString() });
  }

  /**
   * Save notification record
   * 
   * @param {Object} notification - Notification object
   * @returns {Promise<void>}
   */
  async saveNotification(notification) {
    const notificationFile = path.join(this.feedbackDir, 'notifications.json');
    await ensureDirectory(this.feedbackDir);

    let notifications = [];
    const exists = await pathExists(notificationFile);
    if (exists) {
      try {
        const data = await readJSON(notificationFile);
        notifications = data.notifications || [];
      } catch (error) {
        // Ignore errors, start fresh
      }
    }

    notifications.push(notification);

    await writeJSON(notificationFile, { notifications, lastUpdated: new Date().toISOString() });
  }
}

module.exports = FeedbackManager;

