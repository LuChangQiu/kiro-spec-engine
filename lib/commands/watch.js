/**
 * Watch Command Group
 * 
 * Manages watch mode for automated file monitoring and command execution
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const WatchManager = require('../watch/watch-manager');

/**
 * Start watch mode
 * 
 * @param {Object} options - Command options
 * @param {string} options.config - Custom config file path
 * @param {string} options.patterns - Override patterns (comma-separated)
 * @returns {Promise<void>}
 */
async function startWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = options.config || path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Starting Watch Mode');
  console.log();
  
  try {
    const watchManager = new WatchManager({ configPath });
    
    // Load configuration
    await watchManager.loadConfig();
    
    // Override patterns if specified
    if (options.patterns) {
      const patterns = options.patterns.split(',').map(p => p.trim());
      watchManager.config.patterns = patterns;
      console.log('Using custom patterns:', chalk.cyan(patterns.join(', ')));
      console.log();
    }
    
    // Start watch mode
    await watchManager.start();
    
    console.log(chalk.green('✅ Watch mode started'));
    console.log();
    console.log('Watching patterns:');
    for (const pattern of watchManager.config.patterns) {
      console.log(`  ${chalk.gray('•')} ${pattern}`);
    }
    console.log();
    console.log('Actions configured:');
    const actionCount = Object.keys(watchManager.config.actions || {}).length;
    console.log(`  ${chalk.cyan(actionCount)} action(s)`);
    console.log();
    console.log('Commands:');
    console.log(`  ${chalk.cyan('kse watch status')} - Check status`);
    console.log(`  ${chalk.cyan('kse watch logs')} - View logs`);
    console.log(`  ${chalk.cyan('kse watch stop')} - Stop watch mode`);
    console.log();
    console.log(chalk.gray('Press Ctrl+C to stop'));
    
    // Keep process running
    process.on('SIGINT', async () => {
      console.log();
      console.log('Stopping watch mode...');
      await watchManager.stop();
      console.log(chalk.green('✅ Watch mode stopped'));
      process.exit(0);
    });
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Stop watch mode
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function stopWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Stopping Watch Mode');
  console.log();
  
  try {
    const watchManager = new WatchManager({ configPath });
    await watchManager.stop();
    
    console.log(chalk.green('✅ Watch mode stopped'));
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Show watch mode status
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function statusWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Watch Mode Status');
  console.log();
  
  try {
    const watchManager = new WatchManager({ configPath });
    const status = watchManager.getStatus();
    
    // Running status
    const runningStatus = status.running ? chalk.green('Running') : chalk.gray('Stopped');
    console.log(`Status: ${runningStatus}`);
    console.log();
    
    if (status.running) {
      // Patterns
      console.log('Watching patterns:');
      for (const pattern of status.patterns || []) {
        console.log(`  ${chalk.gray('•')} ${pattern}`);
      }
      console.log();
      
      // Actions
      console.log('Actions:');
      const actionCount = Object.keys(status.actions || {}).length;
      console.log(`  ${chalk.cyan(actionCount)} action(s) configured`);
      console.log();
      
      // Recent activity
      if (status.recentActivity && status.recentActivity.length > 0) {
        console.log('Recent activity:');
        for (const activity of status.recentActivity.slice(0, 5)) {
          const time = new Date(activity.timestamp).toLocaleTimeString();
          const result = activity.result === 'success' ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${result} ${chalk.gray(time)} ${activity.file}`);
        }
        console.log();
      }
      
      // Error count
      if (status.errorCount > 0) {
        console.log(chalk.yellow(`⚠️  ${status.errorCount} error(s) occurred`));
        console.log(`Run ${chalk.cyan('kse watch logs')} to view details`);
        console.log();
      }
    } else {
      console.log(chalk.gray('Watch mode is not running'));
      console.log();
      console.log(`Run ${chalk.cyan('kse watch start')} to start`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Display execution logs
 * 
 * @param {Object} options - Command options
 * @param {number} options.tail - Number of lines to show
 * @param {boolean} options.follow - Follow mode (tail -f)
 * @returns {Promise<void>}
 */
async function logsWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Watch Mode Logs');
  console.log();
  
  try {
    const watchManager = new WatchManager({ configPath });
    const lines = options.tail || 50;
    const logs = await watchManager.getLogs(lines);
    
    if (logs.length === 0) {
      console.log(chalk.gray('No logs found'));
      return;
    }
    
    console.log(`Showing last ${chalk.cyan(logs.length)} log entries:`);
    console.log();
    
    for (const log of logs) {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const level = formatLogLevel(log.level);
      console.log(`${chalk.gray(time)} ${level} ${log.message}`);
      
      if (log.error) {
        console.log(`  ${chalk.red('Error:')} ${log.error}`);
      }
    }
    
    if (options.follow) {
      console.log();
      console.log(chalk.gray('Following logs... (Press Ctrl+C to stop)'));
      // TODO: Implement follow mode with file watching
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Display automation metrics
 * 
 * @param {Object} options - Command options
 * @param {string} options.format - Output format (text/json)
 * @returns {Promise<void>}
 */
async function metricsWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Watch Mode Metrics');
  console.log();
  
  try {
    const watchManager = new WatchManager({ configPath });
    const metrics = watchManager.getMetrics();
    
    if (options.format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }
    
    // Text format
    console.log('Execution Statistics:');
    console.log(`  Total executions: ${chalk.cyan(metrics.totalExecutions || 0)}`);
    console.log(`  Successful: ${chalk.green(metrics.successfulExecutions || 0)}`);
    console.log(`  Failed: ${chalk.red(metrics.failedExecutions || 0)}`);
    console.log(`  Success rate: ${chalk.cyan(((metrics.successRate || 0) * 100).toFixed(1))}%`);
    console.log();
    
    console.log('Performance:');
    console.log(`  Average duration: ${chalk.cyan((metrics.averageDuration || 0).toFixed(0))}ms`);
    console.log(`  Time saved: ${chalk.cyan(formatTimeSaved(metrics.timeSaved || 0))}`);
    console.log();
    
    if (metrics.byAction && Object.keys(metrics.byAction).length > 0) {
      console.log('By Action:');
      for (const [action, count] of Object.entries(metrics.byAction)) {
        console.log(`  ${action}: ${chalk.cyan(count)}`);
      }
      console.log();
    }
    
    if (metrics.errors && metrics.errors.length > 0) {
      console.log(chalk.yellow(`Recent Errors (${metrics.errors.length}):`));
      for (const error of metrics.errors.slice(0, 5)) {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`  ${chalk.gray(time)} ${error.message}`);
      }
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Initialize watch configuration
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.force - Overwrite existing config
 * @returns {Promise<void>}
 */
async function initWatch(options = {}) {
  const projectPath = process.cwd();
  const configPath = path.join(projectPath, '.kiro/watch-config.json');
  
  console.log(chalk.red('🔥') + ' Initialize Watch Configuration');
  console.log();
  
  try {
    // Check if config already exists
    if (await fs.pathExists(configPath) && !options.force) {
      console.log(chalk.yellow('⚠️  Configuration already exists'));
      console.log();
      console.log(`Path: ${chalk.gray(configPath)}`);
      console.log();
      console.log(`Use ${chalk.cyan('--force')} to overwrite`);
      return;
    }
    
    // Create default configuration
    const defaultConfig = {
      enabled: true,
      patterns: [
        '**/tasks.md',
        '**/.kiro/specs/*/requirements.md',
        '**/.kiro/specs/*/design.md'
      ],
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/coverage/**'
      ],
      actions: {
        '**/tasks.md': {
          command: 'kse workspace sync',
          debounce: 2000,
          description: 'Sync workspace when tasks are updated'
        }
      },
      debounce: {
        default: 2000
      },
      logging: {
        enabled: true,
        level: 'info',
        maxSize: '10MB',
        rotation: true
      },
      retry: {
        enabled: true,
        maxAttempts: 3,
        backoff: 'exponential'
      }
    };
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));
    
    // Write configuration
    await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
    
    console.log(chalk.green('✅ Configuration created'));
    console.log();
    console.log(`Path: ${chalk.gray(configPath)}`);
    console.log();
    console.log('Default patterns:');
    for (const pattern of defaultConfig.patterns) {
      console.log(`  ${chalk.gray('•')} ${pattern}`);
    }
    console.log();
    console.log('Next steps:');
    console.log(`  1. Edit config: ${chalk.cyan(configPath)}`);
    console.log(`  2. Start watch: ${chalk.cyan('kse watch start')}`);
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Format log level with color
 * 
 * @param {string} level - Log level
 * @returns {string} Formatted level
 */
function formatLogLevel(level) {
  const levels = {
    debug: chalk.gray('[DEBUG]'),
    info: chalk.blue('[INFO]'),
    warn: chalk.yellow('[WARN]'),
    error: chalk.red('[ERROR]')
  };
  return levels[level] || chalk.gray(`[${level.toUpperCase()}]`);
}

/**
 * Format time saved in human-readable format
 * 
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time
 */
function formatTimeSaved(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else {
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

module.exports = {
  startWatch,
  stopWatch,
  statusWatch,
  logsWatch,
  metricsWatch,
  initWatch
};
