/**
 * Operations Commands
 * 
 * CLI commands for DevOps integration foundation:
 * - kse ops init: Initialize operations specs
 * - kse ops validate: Validate operations specs
 * - kse ops audit: Query audit logs
 * - kse ops takeover: Manage takeover levels
 * - kse ops feedback: Manage user feedback
 */

const chalk = require('chalk');
const path = require('path');
const OperationsManager = require('../operations/operations-manager');
const PermissionManager = require('../operations/permission-manager');
const AuditLogger = require('../operations/audit-logger');
const FeedbackManager = require('../operations/feedback-manager');
const { SecurityEnvironment } = require('../operations/models');

/**
 * Initialize operations specs for a project
 * 
 * @param {string} projectName - Project name
 * @param {Object} options - Command options
 * @param {string} options.template - Template name (default: 'default')
 * @returns {Promise<void>}
 */
async function initCommand(projectName, options = {}) {
  const { template = 'default' } = options;
  const projectPath = process.cwd();

  console.log(chalk.blue('🚀 Initializing operations specs...'));
  console.log();

  try {
    const opsManager = new OperationsManager(projectPath);
    
    // Create operations spec
    await opsManager.createOperationsSpec(projectName, template);
    
    console.log(chalk.green('✅ Operations specs created successfully!'));
    console.log();
    console.log(chalk.gray(`Location: .kiro/specs/${projectName}/operations/`));
    console.log();
    console.log(chalk.yellow('Next steps:'));
    console.log('  1. Fill in the operations spec documents');
    console.log('  2. Run: kse ops validate ' + projectName);
    console.log('  3. Commit the operations specs with your code');
    
  } catch (error) {
    console.error(chalk.red('❌ Error initializing operations specs:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Validate operations specs
 * 
 * @param {string} projectName - Project name (optional, validates all if not specified)
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function validateCommand(projectName, options = {}) {
  const projectPath = process.cwd();

  console.log(chalk.blue('🔍 Validating operations specs...'));
  console.log();

  try {
    const opsManager = new OperationsManager(projectPath);
    
    if (projectName) {
      // Validate specific project
      const spec = await opsManager.loadOperationsSpec(projectName);
      const result = opsManager.validateOperationsSpec(spec);
      
      displayValidationResult(projectName, result);
      
      if (!result.valid) {
        process.exit(1);
      }
    } else {
      // Validate all projects
      const projects = await opsManager.listOperationsSpecs();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('No operations specs found.'));
        console.log(chalk.gray('Run: kse ops init <project-name> to create one'));
        return;
      }
      
      let allValid = true;
      for (const project of projects) {
        try {
          const spec = await opsManager.loadOperationsSpec(project);
          const result = opsManager.validateOperationsSpec(spec);
          displayValidationResult(project, result);
          
          if (!result.valid) {
            allValid = false;
          }
        } catch (error) {
          console.log(chalk.red(`❌ ${project}: ${error.message}`));
          allValid = false;
        }
      }
      
      if (!allValid) {
        process.exit(1);
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error validating operations specs:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Display validation result
 * 
 * @param {string} projectName - Project name
 * @param {Object} result - Validation result
 */
function displayValidationResult(projectName, result) {
  if (result.valid) {
    console.log(chalk.green(`✅ ${projectName}: Valid`));
  } else {
    console.log(chalk.red(`❌ ${projectName}: Invalid`));
    
    if (result.errors && result.errors.length > 0) {
      console.log(chalk.red('  Errors:'));
      result.errors.forEach(error => {
        console.log(chalk.red(`    - ${error}`));
      });
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('  Warnings:'));
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`    - ${warning}`));
      });
    }
  }
  console.log();
}

/**
 * Query audit logs
 * 
 * @param {Object} options - Command options
 * @param {string} options.project - Filter by project
 * @param {string} options.from - Start date
 * @param {string} options.to - End date
 * @param {string} options.type - Filter by operation type
 * @param {string} options.format - Output format (json/csv)
 * @returns {Promise<void>}
 */
async function auditCommand(options = {}) {
  const { project, from, to, type, format = 'json' } = options;
  const projectPath = process.cwd();

  console.log(chalk.blue('📋 Querying audit logs...'));
  console.log();

  try {
    const auditLogger = new AuditLogger(projectPath);
    
    // Build query
    const query = {};
    if (project) query.projectName = project;
    if (from) query.fromDate = new Date(from);
    if (to) query.toDate = new Date(to);
    if (type) query.operationType = type;
    
    // Query logs
    const logs = await auditLogger.queryLogs(query);
    
    if (logs.length === 0) {
      console.log(chalk.yellow('No audit logs found matching the criteria.'));
      return;
    }
    
    console.log(chalk.green(`Found ${logs.length} audit log entries`));
    console.log();
    
    if (format === 'json') {
      console.log(JSON.stringify(logs, null, 2));
    } else if (format === 'csv') {
      const csv = await auditLogger.exportLogs(query, 'csv');
      console.log(csv);
    } else {
      // Display summary
      logs.forEach(log => {
        console.log(chalk.cyan(`[${log.timestamp}] ${log.operationType}`));
        console.log(chalk.gray(`  Project: ${log.project}`));
        console.log(chalk.gray(`  Outcome: ${log.outcome}`));
        console.log(chalk.gray(`  Level: ${log.takeoverLevel}`));
        console.log();
      });
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error querying audit logs:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Manage takeover levels
 * 
 * @param {string} action - Action (get/set)
 * @param {string} projectName - Project name
 * @param {Object} options - Command options
 * @param {string} options.level - Takeover level (for set action)
 * @param {string} options.environment - Security environment
 * @param {string} options.reason - Reason for change (for set action)
 * @param {string} options.user - User making the change (for set action)
 * @returns {Promise<void>}
 */
async function takeoverCommand(action, projectName, options = {}) {
  const { level, environment = SecurityEnvironment.DEVELOPMENT, reason, user = 'cli-user' } = options;
  const projectPath = process.cwd();

  try {
    const permissionManager = new PermissionManager(projectPath);
    
    if (action === 'get') {
      // Get current takeover level
      const currentLevel = await permissionManager.getTakeoverLevel(projectName, environment);
      
      console.log(chalk.blue(`Takeover level for ${projectName} (${environment}):`));
      console.log(chalk.green(`  ${currentLevel}`));
      
    } else if (action === 'set') {
      // Set takeover level
      if (!level) {
        console.error(chalk.red('❌ Error: --level is required for set action'));
        console.log(chalk.gray('Usage: kse ops takeover set <project> --level <L1-L5> --reason <reason>'));
        process.exit(1);
      }
      
      if (!reason) {
        console.error(chalk.red('❌ Error: --reason is required for set action'));
        console.log(chalk.gray('Usage: kse ops takeover set <project> --level <L1-L5> --reason <reason>'));
        process.exit(1);
      }
      
      await permissionManager.setTakeoverLevel(projectName, environment, level, reason, user);
      
      console.log(chalk.green('✅ Takeover level updated successfully!'));
      console.log(chalk.gray(`  Project: ${projectName}`));
      console.log(chalk.gray(`  Environment: ${environment}`));
      console.log(chalk.gray(`  New Level: ${level}`));
      console.log(chalk.gray(`  Reason: ${reason}`));
      
    } else {
      console.error(chalk.red(`❌ Unknown action: ${action}`));
      console.log(chalk.gray('Valid actions: get, set'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error managing takeover level:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Manage user feedback
 * 
 * @param {string} action - Action (list/respond)
 * @param {Object} options - Command options
 * @param {string} options.project - Filter by project
 * @param {string} options.status - Filter by status
 * @param {string} options.severity - Filter by severity
 * @param {string} options.feedbackId - Feedback ID (for respond action)
 * @param {string} options.message - Response message (for respond action)
 * @returns {Promise<void>}
 */
async function feedbackCommand(action, options = {}) {
  const { project, status, severity, feedbackId, message } = options;
  const projectPath = process.cwd();

  try {
    const feedbackManager = new FeedbackManager(projectPath);
    
    if (action === 'list') {
      // List feedbacks
      const filters = {};
      if (project) filters.project = project;
      if (status) filters.status = status;
      if (severity) filters.severity = severity;
      
      const feedbacks = await feedbackManager.listFeedbacks(filters);
      
      if (feedbacks.length === 0) {
        console.log(chalk.yellow('No feedback found matching the criteria.'));
        return;
      }
      
      console.log(chalk.green(`Found ${feedbacks.length} feedback items`));
      console.log();
      
      feedbacks.forEach(fb => {
        console.log(chalk.cyan(`[${fb.id}] ${fb.content.title}`));
        console.log(chalk.gray(`  Project: ${fb.project} (${fb.version})`));
        console.log(chalk.gray(`  Type: ${fb.type} | Severity: ${fb.severity}`));
        console.log(chalk.gray(`  Status: ${fb.status}`));
        console.log(chalk.gray(`  Created: ${fb.createdAt}`));
        console.log();
      });
      
    } else if (action === 'respond') {
      // Respond to feedback
      if (!feedbackId) {
        console.error(chalk.red('❌ Error: --feedback-id is required for respond action'));
        console.log(chalk.gray('Usage: kse ops feedback respond --feedback-id <id> --message <message>'));
        process.exit(1);
      }
      
      if (!message) {
        console.error(chalk.red('❌ Error: --message is required for respond action'));
        console.log(chalk.gray('Usage: kse ops feedback respond --feedback-id <id> --message <message>'));
        process.exit(1);
      }
      
      await feedbackManager.trackResolution(feedbackId, 'resolved', message);
      
      console.log(chalk.green('✅ Feedback response recorded successfully!'));
      console.log(chalk.gray(`  Feedback ID: ${feedbackId}`));
      console.log(chalk.gray(`  Resolution: ${message}`));
      
    } else {
      console.error(chalk.red(`❌ Unknown action: ${action}`));
      console.log(chalk.gray('Valid actions: list, respond'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error managing feedback:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * Main ops command router
 * 
 * @param {string} subcommand - Subcommand (init/validate/audit/takeover/feedback)
 * @param {Array} args - Command arguments
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function opsCommand(subcommand, args = [], options = {}) {
  switch (subcommand) {
    case 'init':
      if (args.length === 0) {
        console.error(chalk.red('❌ Error: Project name is required'));
        console.log(chalk.gray('Usage: kse ops init <project-name> [--template <template-name>]'));
        process.exit(1);
      }
      await initCommand(args[0], options);
      break;
      
    case 'validate':
      await validateCommand(args[0], options);
      break;
      
    case 'audit':
      await auditCommand(options);
      break;
      
    case 'takeover':
      if (args.length < 2) {
        console.error(chalk.red('❌ Error: Action and project name are required'));
        console.log(chalk.gray('Usage: kse ops takeover <get|set> <project-name> [options]'));
        process.exit(1);
      }
      await takeoverCommand(args[0], args[1], options);
      break;
      
    case 'feedback':
      if (args.length === 0) {
        console.error(chalk.red('❌ Error: Action is required'));
        console.log(chalk.gray('Usage: kse ops feedback <list|respond> [options]'));
        process.exit(1);
      }
      await feedbackCommand(args[0], options);
      break;
      
    default:
      console.log(chalk.red('❌ Unknown ops subcommand'));
      console.log();
      console.log(chalk.blue('Available commands:'));
      console.log('  kse ops init <project-name>     - Initialize operations specs');
      console.log('  kse ops validate [project]      - Validate operations specs');
      console.log('  kse ops audit [options]         - Query audit logs');
      console.log('  kse ops takeover <action> <project> - Manage takeover levels');
      console.log('  kse ops feedback <action>       - Manage user feedback');
      process.exit(1);
  }
}

module.exports = opsCommand;
