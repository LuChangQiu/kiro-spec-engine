/**
 * Data Models for Operations Module
 * 
 * Defines core data structures and enums
 */

/**
 * Takeover Level Enum
 * Defines the degree of AI autonomy in executing operations
 */
const TakeoverLevel = {
  L1_OBSERVATION: 'L1_OBSERVATION',
  L2_SUGGESTION: 'L2_SUGGESTION',
  L3_SEMI_AUTO: 'L3_SEMI_AUTO',
  L4_AUTO: 'L4_AUTO',
  L5_FULLY_AUTONOMOUS: 'L5_FULLY_AUTONOMOUS'
};

/**
 * Security Environment Enum
 * Deployment environment classification
 */
const SecurityEnvironment = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  PRE_PRODUCTION: 'pre-production',
  PRODUCTION: 'production'
};

/**
 * Feedback Channel Enum
 * Methods by which user feedback enters the system
 */
const FeedbackChannel = {
  SUPPORT_TICKET: 'support_ticket',
  MONITORING_ALERT: 'monitoring_alert',
  USER_REPORT: 'user_report',
  API_ENDPOINT: 'api_endpoint',
  CUSTOMER_SURVEY: 'customer_survey'
};

/**
 * Feedback Type Enum
 * Classification of feedback content
 */
const FeedbackType = {
  BUG_REPORT: 'bug_report',
  PERFORMANCE_ISSUE: 'performance_issue',
  FEATURE_REQUEST: 'feature_request',
  OPERATIONAL_CONCERN: 'operational_concern'
};

/**
 * Feedback Severity Enum
 * Priority level of feedback
 */
const FeedbackSeverity = {
  CRITICAL: 'critical',    // System down
  HIGH: 'high',            // Degraded performance
  MEDIUM: 'medium',        // Usability issue
  LOW: 'low'               // Enhancement
};

/**
 * Feedback Status Enum
 * Resolution lifecycle states
 */
const FeedbackStatus = {
  ACKNOWLEDGED: 'acknowledged',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  VERIFIED: 'verified'
};

/**
 * Operation Type Enum
 * Types of operations that can be performed
 */
const OperationType = {
  DEPLOYMENT: 'deployment',
  CONFIGURATION_CHANGE: 'configuration_change',
  DATA_MIGRATION: 'data_migration',
  ROLLBACK: 'rollback',
  MONITORING_UPDATE: 'monitoring_update',
  TROUBLESHOOTING: 'troubleshooting',
  FEEDBACK_RESPONSE: 'feedback_response',
  PERMISSION_CHANGE: 'permission_change'
};

/**
 * Document Type Enum
 * Types of operations spec documents
 */
const DocumentType = {
  DEPLOYMENT: 'deployment',
  MONITORING: 'monitoring',
  OPERATIONS: 'operations',
  TROUBLESHOOTING: 'troubleshooting',
  ROLLBACK: 'rollback',
  CHANGE_IMPACT: 'change-impact',
  MIGRATION_PLAN: 'migration-plan',
  FEEDBACK_RESPONSE: 'feedback-response',
  TOOLS: 'tools'  // AI-driven tools configuration
};

module.exports = {
  TakeoverLevel,
  SecurityEnvironment,
  FeedbackChannel,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  OperationType,
  DocumentType
};

/**
 * @typedef {Object} IssuePattern
 * @property {string} pattern - Description of the issue pattern
 * @property {number} occurrences - Number of times this pattern occurred
 * @property {FeedbackType} type - Type of feedback
 * @property {FeedbackSeverity} severity - Severity level
 * @property {string[]} affectedVersions - Versions where this pattern appears
 * @property {string} firstSeen - ISO timestamp of first occurrence
 * @property {string} lastSeen - ISO timestamp of last occurrence
 */

/**
 * @typedef {Object} ResolutionTimeStats
 * @property {number} average - Average resolution time in hours
 * @property {number} median - Median resolution time in hours
 * @property {number} min - Minimum resolution time in hours
 * @property {number} max - Maximum resolution time in hours
 * @property {Object.<FeedbackSeverity, number>} bySeverity - Average resolution time by severity
 * @property {Object.<FeedbackType, number>} byType - Average resolution time by type
 */

/**
 * @typedef {Object} SatisfactionTrend
 * @property {string} period - Time period (e.g., "2026-01", "2026-W04")
 * @property {number} totalFeedback - Total feedback items in period
 * @property {number} resolvedCount - Number of resolved items
 * @property {number} resolutionRate - Percentage of resolved items
 * @property {number} averageResolutionTime - Average time to resolve in hours
 * @property {Object.<FeedbackSeverity, number>} severityDistribution - Count by severity
 */

/**
 * @typedef {Object} VersionIssue
 * @property {string} version - Project version
 * @property {number} feedbackCount - Total feedback for this version
 * @property {IssuePattern[]} topIssues - Most common issues in this version
 * @property {number} criticalCount - Number of critical issues
 * @property {number} averageResolutionTime - Average resolution time in hours
 */

/**
 * @typedef {Object} FeedbackAnalytics
 * @property {string} project - Project name
 * @property {string} generatedAt - ISO timestamp of analytics generation
 * @property {Object} timeRange - Time range for analytics
 * @property {string} timeRange.from - Start date (ISO)
 * @property {string} timeRange.to - End date (ISO)
 * @property {IssuePattern[]} commonIssues - Most common issue patterns
 * @property {ResolutionTimeStats} resolutionTimes - Resolution time statistics
 * @property {SatisfactionTrend[]} satisfactionTrends - Satisfaction trends over time
 * @property {VersionIssue[]} versionSpecificIssues - Issues by version
 * @property {number} totalFeedback - Total feedback items analyzed
 * @property {Object.<FeedbackStatus, number>} statusDistribution - Count by status
 */
