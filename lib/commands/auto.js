/**
 * Autonomous Control CLI Commands
 */

const AutonomousEngine = require('../auto/autonomous-engine');
const { mergeConfigs, DEFAULT_CONFIG } = require('../auto/config-schema');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Register auto commands
 * @param {Object} program - Commander program
 */
function registerAutoCommands(program) {
  const auto = program
    .command('auto')
    .description('Autonomous execution control');
  
  // kse auto run
  auto
    .command('run <spec-name>')
    .description('Run Spec autonomously')
    .option('-m, --mode <mode>', 'Execution mode (conservative|balanced|aggressive)', 'balanced')
    .action(async (specName, options) => {
      try {
        console.log(chalk.blue(`Starting autonomous execution: ${specName}`));
        console.log(chalk.gray(`Mode: ${options.mode}`));
        
        const config = await loadConfig(options.mode);
        const engine = new AutonomousEngine(specName, config);
        
        await engine.initialize();
        await engine.start();
        await engine.executeTaskQueue();
        await engine.stop();
        
        const status = engine.getStatus();
        console.log(chalk.green('\n✓ Execution completed'));
        console.log(chalk.gray(`Tasks completed: ${status.queueStatus.completed}/${status.queueStatus.total}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse auto create
  auto
    .command('create <feature-description>')
    .description('Create and run Spec autonomously')
    .option('-n, --name <name>', 'Spec name')
    .option('-m, --mode <mode>', 'Execution mode', 'balanced')
    .action(async (description, options) => {
      try {
        const specName = options.name || generateSpecName(description);
        
        console.log(chalk.blue(`Creating Spec: ${specName}`));
        console.log(chalk.gray(`Description: ${description}`));
        
        const config = await loadConfig(options.mode);
        const engine = new AutonomousEngine(specName, config);
        
        await engine.initialize();
        await engine.start();
        
        const result = await engine.createSpecAutonomously(description);
        
        console.log(chalk.green('\n✓ Spec created'));
        console.log(chalk.gray(`Requirements: ${result.requirementsCreated ? '✓' : '✗'}`));
        console.log(chalk.gray(`Design: ${result.designCreated ? '✓' : '✗'}`));
        console.log(chalk.gray(`Tasks: ${result.tasksCreated ? '✓' : '✗'}`));
        
        await engine.stop();
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse auto status
  auto
    .command('status [spec-name]')
    .description('Show autonomous execution status')
    .action(async (specName) => {
      try {
        if (!specName) {
          // Show all active executions
          console.log(chalk.blue('Active autonomous executions:'));
          console.log(chalk.gray('(No active executions)'));
          return;
        }
        
        const config = await loadConfig();
        const engine = new AutonomousEngine(specName, config);
        
        await engine.initialize();
        const status = engine.getStatus();
        
        console.log(chalk.blue(`\nStatus: ${specName}`));
        console.log(chalk.gray(`Running: ${status.isRunning ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`Paused: ${status.isPaused ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`Current task: ${status.currentTask || 'None'}`));
        console.log(chalk.gray(`Progress: ${status.progress.overallProgress}%`));
        console.log(chalk.gray(`Tasks: ${status.queueStatus.completed}/${status.queueStatus.total}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse auto resume
  auto
    .command('resume [spec-name]')
    .description('Resume paused execution')
    .action(async (specName) => {
      try {
        if (!specName) {
          console.error(chalk.red('Error: Spec name required'));
          process.exit(1);
        }
        
        const config = await loadConfig();
        const engine = new AutonomousEngine(specName, config);
        
        await engine.initialize();
        await engine.resume();
        await engine.executeTaskQueue();
        await engine.stop();
        
        console.log(chalk.green('✓ Execution resumed and completed'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse auto stop
  auto
    .command('stop <spec-name>')
    .description('Stop autonomous execution')
    .action(async (specName) => {
      try {
        const config = await loadConfig();
        const engine = new AutonomousEngine(specName, config);
        
        await engine.initialize();
        await engine.stop();
        
        console.log(chalk.green('✓ Execution stopped'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse auto config
  auto
    .command('config')
    .description('Show/edit autonomous configuration')
    .option('--show', 'Show current configuration')
    .option('--mode <mode>', 'Set default mode')
    .action(async (options) => {
      try {
        const configPath = path.join(process.cwd(), '.kiro', 'auto', 'config.json');
        
        if (options.show) {
          const config = await loadConfig();
          console.log(chalk.blue('Current configuration:'));
          console.log(JSON.stringify(config, null, 2));
          return;
        }
        
        if (options.mode) {
          const config = await loadConfig();
          config.mode = options.mode;
          await fs.ensureDir(path.dirname(configPath));
          await fs.writeJson(configPath, config, { spaces: 2 });
          console.log(chalk.green(`✓ Mode set to: ${options.mode}`));
          return;
        }
        
        console.log(chalk.gray('Use --show to view configuration'));
        console.log(chalk.gray('Use --mode <mode> to set default mode'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

/**
 * Load configuration
 * @param {string} mode - Execution mode
 * @returns {Object} - Configuration
 */
async function loadConfig(mode) {
  const globalConfigPath = path.join(process.cwd(), '.kiro', 'auto', 'config.json');
  
  let globalConfig = {};
  if (await fs.pathExists(globalConfigPath)) {
    globalConfig = await fs.readJson(globalConfigPath);
  }
  
  if (mode) {
    globalConfig.mode = mode;
  }
  
  return mergeConfigs(globalConfig, {});
}

/**
 * Generate Spec name from description
 * @param {string} description - Feature description
 * @returns {string} - Spec name
 */
function generateSpecName(description) {
  const words = description.toLowerCase().split(/\s+/).slice(0, 3);
  const name = words.join('-').replace(/[^a-z0-9-]/g, '');
  const number = Math.floor(Math.random() * 1000);
  return `${number.toString().padStart(2, '0')}-00-${name}`;
}

module.exports = { registerAutoCommands };
