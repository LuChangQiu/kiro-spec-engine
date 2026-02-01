const RepoManager = require('../repo-manager');
const ConfigManager = require('../config-manager');
const OutputFormatter = require('../output-formatter');

/**
 * ExecHandler - Handles batch command execution across repositories
 * 
 * Executes Git commands across all configured repositories with
 * support for dry-run mode and detailed result reporting.
 */
class ExecHandler {
  /**
   * Create a new ExecHandler
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.repoManager = new RepoManager(projectRoot);
    this.configManager = new ConfigManager(projectRoot);
    this.formatter = new OutputFormatter();
  }

  /**
   * Execute command across repositories
   * @param {string} command - Git command to execute (without 'git' prefix)
   * @param {Object} options - Execution options
   * @param {boolean} options.dryRun - Show commands without executing
   * @returns {Promise<void>}
   */
  async execute(command, options = {}) {
    const { dryRun = false } = options;

    if (!command || command.trim().length === 0) {
      console.log(this.formatter.error('Command is required'));
      throw new Error('Command is required');
    }

    // Load configuration
    let config;
    try {
      config = await this.configManager.loadConfig();
    } catch (error) {
      console.log(this.formatter.error(error.message));
      throw error;
    }

    if (config.repositories.length === 0) {
      console.log(this.formatter.warning('No repositories configured'));
      return;
    }

    // Dry-run mode: just display what would be executed
    if (dryRun) {
      console.log(this.formatter.info('Dry-run mode: Commands that would be executed:'));
      console.log('');
      config.repositories.forEach(repo => {
        console.log(`${this.formatter.info('Repository:')} ${repo.name} (${repo.path})`);
        console.log(`  Command: git ${command}`);
        console.log('');
      });
      return;
    }

    // Execute command in all repositories
    const progress = this.formatter.createProgress('Executing command...');
    progress.start();

    let results;
    try {
      results = await this.repoManager.execInAllRepos(config.repositories, command);
      progress.stop();
    } catch (error) {
      progress.fail('Failed to execute command');
      throw error;
    }

    // Display results
    this.displayResults(results);

    // Display summary
    this.displaySummary(results);
  }

  /**
   * Display execution results
   * @param {Array<Object>} results - Array of execution results
   */
  displayResults(results) {
    console.log('\n' + this.formatter.info('Execution Results'));
    console.log('='.repeat(80));

    results.forEach((result, index) => {
      if (index > 0) {
        console.log('\n' + '-'.repeat(80));
      }

      console.log(`\n${this.formatter.info('Repository:')} ${result.name} (${result.path})`);
      console.log(`${this.formatter.info('Command:')} git ${result.command}`);

      if (result.success) {
        console.log(this.formatter.success('Status: Success'));
        if (result.output && result.output.length > 0) {
          console.log('\nOutput:');
          console.log(result.output);
        } else {
          console.log(this.formatter.info('(No output)'));
        }
      } else {
        console.log(this.formatter.error(`Status: Failed (exit code: ${result.exitCode})`));
        if (result.error) {
          console.log('\nError:');
          console.log(this.formatter.error(result.error));
        }
      }
    });

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Display execution summary
   * @param {Array<Object>} results - Array of execution results
   */
  displaySummary(results) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalCount = results.length;

    console.log('\n' + this.formatter.info('Summary'));
    console.log(`  Total repositories: ${totalCount}`);
    console.log(`  ${this.formatter.success(`Successful: ${successCount}`)}`);
    
    if (failureCount > 0) {
      console.log(`  ${this.formatter.error(`Failed: ${failureCount}`)}`);
      
      // List failed repositories
      const failedRepos = results.filter(r => !r.success);
      console.log('\nFailed repositories:');
      failedRepos.forEach(result => {
        console.log(`  - ${result.name} (${result.path}): ${result.error}`);
      });
    }

    // Display exit codes for failed commands
    const failedWithExitCodes = results.filter(r => !r.success && r.exitCode !== 0);
    if (failedWithExitCodes.length > 0) {
      console.log('\nExit codes:');
      failedWithExitCodes.forEach(result => {
        console.log(`  - ${result.name}: ${result.exitCode}`);
      });
    }
  }
}

module.exports = ExecHandler;
