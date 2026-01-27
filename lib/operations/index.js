/**
 * Operations Module
 * 
 * Core module for DevOps integration foundation
 * Provides operations spec management, permission control, feedback handling, and audit logging
 */

module.exports = {
  // Core managers
  OperationsManager: require('./operations-manager'),
  PermissionManager: require('./permission-manager'),
  FeedbackManager: require('./feedback-manager'),
  AuditLogger: require('./audit-logger'),
  
  // Template system
  TemplateLoader: require('./template-loader'),
  
  // Validation
  OperationsValidator: require('./operations-validator'),
  
  // Data models
  models: require('./models')
};
