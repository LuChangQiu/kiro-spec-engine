/**
 * Repository Management Command Group
 * 
 * Manages multiple Git subrepositories within a single project
 */

const chalk = require('chalk');
const InitHandler = require('../repo/handlers/init-handler');
const StatusHandler = require('../repo/handlers/status-handler');
const ExecHandler = require('../repo/handlers/exec-handler');
const HealthHandler = require('../repo/handlers/health-handler');

/**
 * Initialize repository configuration
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.yes - Skip confirmation prompts
 * @param {number} options.maxDepth - Maximum scan depth
 * @param {string} options.exclude - Comma-separated paths to exclude
 * @param {boolean} options.nested - Enable nested repository scanning (default: true)
 * @returns {Promise<void>}
 */
async function initRepo(options = {}) {
  const projectPath = process.cwd();
  const handler = new InitHandler(projectPath);
  
  console.log(chalk.red('🔥') + ' Initializing Repository Configuration');
  console.log();
  
  try {
    await handler.execute({
      skipConfirmation: options.yes,
      maxDepth: options.maxDepth,
      exclude: options.exclude ? options.exclude.split(',').map(p => p.trim()) : [],
      nested: options.nested !== false // Default to true, false only if --no-nested is used
    });
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Display repository status
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.verbose - Show detailed status
 * @returns {Promise<void>}
 */
async function statusRepo(options = {}) {
  const projectPath = process.cwd();
  const handler = new StatusHandler(projectPath);
  
  console.log(chalk.red('🔥') + ' Repository Status');
  console.log();
  
  try {
    await handler.execute({
      verbose: options.verbose
    });
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Execute command across repositories
 * 
 * @param {string} command - Git command to execute
 * @param {Object} options - Command options
 * @param {boolean} options.dryRun - Show commands without executing
 * @returns {Promise<void>}
 */
async function execRepo(command, options = {}) {
  const projectPath = process.cwd();
  const handler = new ExecHandler(projectPath);
  
  console.log(chalk.red('🔥') + ' Executing Command Across Repositories');
  console.log();
  
  try {
    await handler.execute(command, {
      dryRun: options.dryRun
    });
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Check repository health
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function healthRepo(options = {}) {
  const projectPath = process.cwd();
  const handler = new HealthHandler(projectPath);
  
  console.log(chalk.red('🔥') + ' Repository Health Check');
  console.log();
  
  try {
    await handler.execute(options);
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  initRepo,
  statusRepo,
  execRepo,
  healthRepo
};
