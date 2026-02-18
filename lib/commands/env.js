const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const EnvironmentManager = require('../environment/environment-manager');

/**
 * Environment CLI
 * 
 * Command-line interface for environment management operations.
 */
class EnvironmentCLI {
  /**
   * Handle env command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleCommand(args) {
    const subcommand = args[0];

    try {
      switch (subcommand) {
        case 'list':
          return await this.handleList(args.slice(1));
        case 'switch':
          return await this.handleSwitch(args.slice(1));
        case 'info':
          return await this.handleInfo(args.slice(1));
        case 'register':
          return await this.handleRegister(args.slice(1));
        case 'unregister':
          return await this.handleUnregister(args.slice(1));
        case 'rollback':
          return await this.handleRollback(args.slice(1));
        case 'verify':
          return await this.handleVerify(args.slice(1));
        case 'run':
          return await this.handleRun(args.slice(1));
        default:
          this.displayHelp();
          return 1;
      }
    } catch (error) {
      this.displayError(error);
      return 1;
    }
  }

  /**
   * Handle list command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleList(args) {
    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    const environments = await manager.listEnvironments();

    if (environments.length === 0) {
      console.log(chalk.yellow('\nNo environments registered.'));
      console.log(chalk.gray('\nTo register an environment, create a configuration file and run:'));
      console.log(chalk.gray('  sce env register <config-file>'));
      console.log();
      return 0;
    }

    console.log(chalk.bold('\nRegistered Environments:\n'));

    for (const env of environments) {
      const prefix = env.isActive ? chalk.green('● ') : chalk.gray('○ ');
      const name = env.isActive ? chalk.green.bold(env.name) : chalk.white(env.name);
      const status = env.isActive ? chalk.green(' (active)') : '';
      
      console.log(`${prefix}${name}${status}`);
      console.log(chalk.gray(`  ${env.description}`));
      console.log(chalk.gray(`  Config files: ${env.configFilesCount}`));
      if (env.hasVerification) {
        console.log(chalk.gray(`  Verification: enabled`));
      }
      console.log();
    }

    return 0;
  }

  /**
   * Handle switch command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleSwitch(args) {
    const environmentName = args[0];

    if (!environmentName) {
      console.log(chalk.red('\nError: Environment name is required'));
      console.log(chalk.gray('\nUsage: sce env switch <name>'));
      console.log();
      return 1;
    }

    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    console.log(chalk.gray(`\nSwitching to environment: ${environmentName}...`));

    const result = await manager.switchEnvironment(environmentName);

    if (result.success) {
      console.log(chalk.green('\n✓ Environment switched successfully!'));
      console.log();
      console.log(chalk.gray(`  Previous: ${result.previous_environment || 'none'}`));
      console.log(chalk.gray(`  Current:  ${result.new_environment}`));
      console.log(chalk.gray(`  Files copied: ${result.files_copied}`));
      if (result.backup_created) {
        console.log(chalk.gray(`  Backup created: ${result.backup_location}`));
      }
      console.log();
      return 0;
    } else {
      console.log(chalk.red('\n✗ Environment switch failed:'));
      for (const error of result.errors) {
        console.log(chalk.red(`  ${error}`));
      }
      console.log();
      return 1;
    }
  }

  /**
   * Handle info command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleInfo(args) {
    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    try {
      const env = await manager.getActiveEnvironment();

      console.log(chalk.bold('\nActive Environment:\n'));
      console.log(chalk.green.bold(`  ${env.name}`));
      console.log(chalk.gray(`  ${env.description}`));
      console.log();

      console.log(chalk.bold('Configuration Files:'));
      for (const mapping of env.config_files) {
        console.log(chalk.gray(`  ${mapping.source} → ${mapping.target}`));
      }
      console.log();

      if (env.verification) {
        console.log(chalk.bold('Verification:'));
        console.log(chalk.gray(`  Command: ${env.verification.command}`));
        console.log(chalk.gray(`  Expected: ${env.verification.expected_output}`));
        console.log();
      }

      return 0;
    } catch (error) {
      if (error.message.includes('No active environment')) {
        console.log(chalk.yellow('\nNo active environment.'));
        console.log(chalk.gray('\nTo activate an environment, run:'));
        console.log(chalk.gray('  sce env switch <name>'));
        console.log();
        return 0;
      }
      throw error;
    }
  }

  /**
   * Handle register command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleRegister(args) {
    const configFile = args[0];

    if (!configFile) {
      console.log(chalk.red('\nError: Configuration file is required'));
      console.log(chalk.gray('\nUsage: sce env register <config-file>'));
      console.log();
      return 1;
    }

    const projectRoot = process.cwd();
    const configPath = path.resolve(projectRoot, configFile);

    if (!await fs.pathExists(configPath)) {
      console.log(chalk.red(`\nError: Configuration file not found: ${configFile}`));
      console.log();
      return 1;
    }

    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);

      const manager = new EnvironmentManager(projectRoot);
      const result = await manager.registerEnvironment(config);

      console.log(chalk.green(`\n✓ ${result.message}`));
      console.log();
      return 0;
    } catch (error) {
      if (error.name === 'SyntaxError') {
        console.log(chalk.red('\nError: Invalid JSON in configuration file'));
        console.log(chalk.red(`  ${error.message}`));
        console.log();
        return 1;
      }
      throw error;
    }
  }

  /**
   * Handle unregister command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleUnregister(args) {
    const environmentName = args[0];
    const force = args.includes('--force') || args.includes('-f');

    if (!environmentName) {
      console.log(chalk.red('\nError: Environment name is required'));
      console.log(chalk.gray('\nUsage: sce env unregister <name> [--force]'));
      console.log();
      return 1;
    }

    if (!force) {
      console.log(chalk.yellow(`\nAre you sure you want to unregister "${environmentName}"?`));
      console.log(chalk.gray('This action cannot be undone.'));
      console.log(chalk.gray('\nUse --force to skip this confirmation.'));
      console.log();
      return 1;
    }

    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    const result = await manager.unregisterEnvironment(environmentName);

    console.log(chalk.green(`\n✓ ${result.message}`));
    console.log();
    return 0;
  }

  /**
   * Handle rollback command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleRollback(args) {
    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    console.log(chalk.gray('\nRestoring from backup...'));

    try {
      const result = await manager.rollbackEnvironment();

      console.log(chalk.green('\n✓ Rollback successful!'));
      console.log();
      console.log(chalk.gray(`  Environment: ${result.environment_name}`));
      console.log(chalk.gray(`  Files restored: ${result.files_restored}`));
      console.log(chalk.gray(`  Backup timestamp: ${result.backup_timestamp}`));
      console.log();
      return 0;
    } catch (error) {
      console.log(chalk.red('\n✗ Rollback failed:'));
      console.log(chalk.red(`  ${error.message}`));
      console.log();
      return 1;
    }
  }

  /**
   * Handle verify command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleVerify(args) {
    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    console.log(chalk.gray('\nVerifying environment configuration...'));

    try {
      const result = await manager.verifyEnvironment();

      if (result.success) {
        console.log(chalk.green('\n✓ Environment verification passed!'));
        console.log();
        console.log(chalk.gray(`  Environment: ${result.environment_name}`));
        if (result.command) {
          console.log(chalk.gray(`  Command: ${result.command}`));
          console.log(chalk.gray(`  Expected: ${result.expected_output}`));
          console.log(chalk.gray(`  Actual: ${result.actual_output}`));
        } else {
          console.log(chalk.gray('  No verification rules configured'));
        }
        console.log();
        return 0;
      } else {
        console.log(chalk.red('\n✗ Environment verification failed!'));
        console.log();
        console.log(chalk.gray(`  Environment: ${result.environment_name}`));
        console.log(chalk.gray(`  Command: ${result.command}`));
        console.log(chalk.red(`  Expected: ${result.expected_output}`));
        console.log(chalk.red(`  Actual: ${result.actual_output}`));
        if (result.error) {
          console.log(chalk.red(`  Error: ${result.error}`));
        }
        console.log();
        return 1;
      }
    } catch (error) {
      console.log(chalk.red('\n✗ Verification failed:'));
      console.log(chalk.red(`  ${error.message}`));
      console.log();
      return 1;
    }
  }

  /**
   * Handle run command
   * @param {Array} args - Command arguments
   * @returns {Promise<number>} Exit code
   */
  static async handleRun(args) {
    const command = args.join(' ');

    if (!command) {
      console.log(chalk.red('\nError: Command is required'));
      console.log(chalk.gray('\nUsage: sce env run "<command>"'));
      console.log();
      return 1;
    }

    const projectRoot = process.cwd();
    const manager = new EnvironmentManager(projectRoot);

    try {
      const env = await manager.getActiveEnvironment();
      console.log(chalk.gray(`\nRunning command in environment: ${env.name}`));
      console.log(chalk.gray(`Command: ${command}\n`));

      const result = await manager.runInEnvironment(command);

      if (result.output) {
        console.log(result.output);
      }

      if (result.success) {
        console.log(chalk.green(`\n✓ Command completed successfully (exit code: ${result.exit_code})`));
        console.log();
        return 0;
      } else {
        console.log(chalk.red(`\n✗ Command failed (exit code: ${result.exit_code})`));
        if (result.error) {
          console.log(chalk.red(`Error: ${result.error}`));
        }
        console.log();
        return 1;
      }
    } catch (error) {
      console.log(chalk.red('\n✗ Command execution failed:'));
      console.log(chalk.red(`  ${error.message}`));
      console.log();
      return 1;
    }
  }

  /**
   * Display help message
   */
  static displayHelp() {
    console.log(chalk.bold('\nEnvironment Management Commands:\n'));
    console.log(chalk.white('  sce env list') + chalk.gray('                    List all environments'));
    console.log(chalk.white('  sce env switch <name>') + chalk.gray('          Switch to environment'));
    console.log(chalk.white('  sce env info') + chalk.gray('                    Show active environment details'));
    console.log(chalk.white('  sce env register <config-file>') + chalk.gray(' Register new environment'));
    console.log(chalk.white('  sce env unregister <name>') + chalk.gray('      Remove environment'));
    console.log(chalk.white('  sce env rollback') + chalk.gray('               Restore from backup'));
    console.log(chalk.white('  sce env verify') + chalk.gray('                 Verify environment configuration'));
    console.log(chalk.white('  sce env run "<command>"') + chalk.gray('        Run command in environment'));
    console.log();
  }

  /**
   * Display error message
   * @param {Error} error - Error object
   */
  static displayError(error) {
    console.log(chalk.red('\n✗ Error:'));
    console.log(chalk.red(`  ${error.message}`));
    console.log();
  }

  /**
   * Display success message
   * @param {string} message - Success message
   * @param {Object} details - Optional details object
   */
  static displaySuccess(message, details = {}) {
    console.log(chalk.green(`\n✓ ${message}`));
    if (Object.keys(details).length > 0) {
      console.log();
      for (const [key, value] of Object.entries(details)) {
        console.log(chalk.gray(`  ${key}: ${value}`));
      }
    }
    console.log();
  }
}

module.exports = EnvironmentCLI;
