const RepoManager = require('../repo-manager');
const ConfigManager = require('../config-manager');
const OutputFormatter = require('../output-formatter');

/**
 * HealthHandler - Handles repository health check command
 * 
 * Performs comprehensive health checks on all configured repositories
 * including path validation, Git repository verification, remote
 * reachability, and branch existence.
 */
class HealthHandler {
  /**
   * Create a new HealthHandler
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.repoManager = new RepoManager(projectRoot);
    this.configManager = new ConfigManager(projectRoot);
    this.formatter = new OutputFormatter();
  }

  /**
   * Execute health check
   * @param {Object} options - Health check options
   * @returns {Promise<void>}
   */
  async execute(options = {}) {
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

    // Perform health checks
    const progress = this.formatter.createProgress('Performing health checks...');
    progress.start();

    let results;
    try {
      results = await this.repoManager.checkAllReposHealth(config.repositories);
      progress.stop();
    } catch (error) {
      progress.fail('Failed to perform health checks');
      throw error;
    }

    // Display results
    this.displayResults(results);

    // Display summary
    this.displaySummary(results);
  }

  /**
   * Display health check results
   * @param {Array<Object>} results - Array of health check results
   */
  displayResults(results) {
    console.log('\n' + this.formatter.info('Health Check Results'));
    console.log('='.repeat(80));

    results.forEach((result, index) => {
      if (index > 0) {
        console.log('\n' + '-'.repeat(80));
      }

      console.log(`\n${this.formatter.info('Repository:')} ${result.name} (${result.path})`);

      // Overall health status
      if (result.healthy) {
        console.log(this.formatter.success('Status: Healthy ✓'));
      } else {
        console.log(this.formatter.error('Status: Unhealthy ✗'));
      }

      // Display individual checks
      console.log('\nChecks:');
      console.log(`  Path exists: ${this._formatCheckResult(result.checks.pathExists)}`);
      console.log(`  Is Git repository: ${this._formatCheckResult(result.checks.isGitRepo)}`);
      
      if (result.checks.remoteReachable !== null) {
        console.log(`  Remote reachable: ${this._formatCheckResult(result.checks.remoteReachable)}`);
      }
      
      if (result.checks.branchExists !== null) {
        console.log(`  Branch exists: ${this._formatCheckResult(result.checks.branchExists)}`);
      }

      // Display errors
      if (result.errors.length > 0) {
        console.log('\n' + this.formatter.error('Errors:'));
        result.errors.forEach(error => {
          console.log(`  ${this.formatter.error('•')} ${error}`);
        });
      }

      // Display warnings
      if (result.warnings.length > 0) {
        console.log('\n' + this.formatter.warning('Warnings:'));
        result.warnings.forEach(warning => {
          console.log(`  ${this.formatter.warning('•')} ${warning}`);
        });
      }
    });

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Display health summary
   * @param {Array<Object>} results - Array of health check results
   */
  displaySummary(results) {
    const healthyCount = results.filter(r => r.healthy).length;
    const unhealthyCount = results.filter(r => !r.healthy).length;
    const totalCount = results.length;

    console.log('\n' + this.formatter.info('Overall Health Summary'));
    console.log(`  Total repositories: ${totalCount}`);
    console.log(`  ${this.formatter.success(`Healthy: ${healthyCount}`)}`);
    
    if (unhealthyCount > 0) {
      console.log(`  ${this.formatter.error(`Unhealthy: ${unhealthyCount}`)}`);
      
      // List unhealthy repositories
      const unhealthyRepos = results.filter(r => !r.healthy);
      console.log('\nUnhealthy repositories:');
      unhealthyRepos.forEach(result => {
        const mainError = result.errors.length > 0 ? result.errors[0] : 'Unknown error';
        console.log(`  - ${result.name} (${result.path}): ${mainError}`);
      });
    } else {
      console.log('\n' + this.formatter.success('All repositories are healthy! 🎉'));
    }

    // Display warning summary
    const reposWithWarnings = results.filter(r => r.warnings.length > 0);
    if (reposWithWarnings.length > 0) {
      console.log('\n' + this.formatter.warning(`${reposWithWarnings.length} ${reposWithWarnings.length === 1 ? 'repository has' : 'repositories have'} warnings:`));
      reposWithWarnings.forEach(result => {
        console.log(`  - ${result.name}: ${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`);
      });
    }
  }

  /**
   * Format check result as colored string
   * @private
   * @param {boolean} passed - Whether the check passed
   * @returns {string} Formatted check result
   */
  _formatCheckResult(passed) {
    return passed 
      ? this.formatter.success('✓ Pass')
      : this.formatter.error('✗ Fail');
  }
}

module.exports = HealthHandler;
