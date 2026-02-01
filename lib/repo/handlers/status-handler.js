const RepoManager = require('../repo-manager');
const ConfigManager = require('../config-manager');
const OutputFormatter = require('../output-formatter');

/**
 * StatusHandler - Handles repository status command
 * 
 * Displays the Git status of all configured repositories in a
 * tabular format with optional verbose output.
 */
class StatusHandler {
  /**
   * Create a new StatusHandler
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.repoManager = new RepoManager(projectRoot);
    this.configManager = new ConfigManager(projectRoot);
    this.formatter = new OutputFormatter();
  }

  /**
   * Execute status command
   * @param {Object} options - Status options
   * @param {boolean} options.verbose - Show detailed file-level changes
   * @returns {Promise<void>}
   */
  async execute(options = {}) {
    const { verbose = false } = options;

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

    // Get status for all repositories
    const progress = this.formatter.createProgress('Checking repository status...');
    progress.start();

    let statuses;
    try {
      statuses = await this.repoManager.getAllRepoStatuses(config.repositories);
      progress.stop();
    } catch (error) {
      progress.fail('Failed to get repository status');
      throw error;
    }

    // Display status
    if (verbose) {
      this.formatVerboseStatus(statuses);
    } else {
      this.formatStatusTable(statuses);
    }

    // Display summary
    const cleanRepos = statuses.filter(s => s.isClean && !s.error).length;
    const dirtyRepos = statuses.filter(s => !s.isClean && !s.error).length;
    const errorRepos = statuses.filter(s => s.error).length;

    console.log('\nSummary:');
    console.log(`  Clean: ${cleanRepos}`);
    console.log(`  Modified: ${dirtyRepos}`);
    if (errorRepos > 0) {
      console.log(this.formatter.error(`  Errors: ${errorRepos}`));
    }
  }

  /**
   * Format status output as table
   * @param {Array<Object>} statuses - Array of repository statuses
   */
  formatStatusTable(statuses) {
    const tableData = statuses.map(status => {
      if (status.error) {
        return [
          status.name,
          status.path,
          this.formatter.error('ERROR'),
          status.error
        ];
      }

      const statusStr = status.isClean 
        ? this.formatter.success('Clean')
        : this.formatter.warning('Modified');

      let changes = '';
      if (!status.isClean) {
        const parts = [];
        if (status.modified > 0) parts.push(`M:${status.modified}`);
        if (status.added > 0) parts.push(`A:${status.added}`);
        if (status.deleted > 0) parts.push(`D:${status.deleted}`);
        if (status.ahead > 0) parts.push(`↑${status.ahead}`);
        if (status.behind > 0) parts.push(`↓${status.behind}`);
        changes = parts.join(' ');
      }

      return [
        status.name,
        status.path,
        status.branch || 'N/A',
        statusStr,
        changes
      ];
    });

    const table = this.formatter.formatTable([], {
      head: ['Name', 'Path', 'Branch', 'Status', 'Changes'],
      rows: tableData
    });

    console.log('\n' + table);
  }

  /**
   * Format verbose status output
   * @param {Array<Object>} statuses - Array of repository statuses
   */
  formatVerboseStatus(statuses) {
    console.log('\n' + this.formatter.info('Repository Status (Verbose)'));
    console.log('='.repeat(80));

    statuses.forEach((status, index) => {
      if (index > 0) {
        console.log('\n' + '-'.repeat(80));
      }

      console.log(`\n${this.formatter.info('Repository:')} ${status.name}`);
      console.log(`${this.formatter.info('Path:')} ${status.path}`);

      if (status.error) {
        console.log(`${this.formatter.error('Error:')} ${status.error}`);
        return;
      }

      console.log(`${this.formatter.info('Branch:')} ${status.branch}`);

      if (status.isClean) {
        console.log(this.formatter.success('Status: Clean - no changes'));
      } else {
        console.log(this.formatter.warning('Status: Modified'));
        
        if (status.modified > 0) {
          console.log(`  Modified files: ${status.modified}`);
        }
        if (status.added > 0) {
          console.log(`  Added files: ${status.added}`);
        }
        if (status.deleted > 0) {
          console.log(`  Deleted files: ${status.deleted}`);
        }
        if (status.ahead > 0) {
          console.log(`  Commits ahead: ${status.ahead}`);
        }
        if (status.behind > 0) {
          console.log(`  Commits behind: ${status.behind}`);
        }
      }
    });

    console.log('\n' + '='.repeat(80));
  }
}

module.exports = StatusHandler;
