const readline = require('readline');
const RepoManager = require('../repo-manager');
const ConfigManager = require('../config-manager');
const OutputFormatter = require('../output-formatter');

/**
 * InitHandler - Handles repository initialization command
 * 
 * Scans the project directory for Git repositories and creates
 * the project-repos.json configuration file.
 */
class InitHandler {
  /**
   * Create a new InitHandler
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.repoManager = new RepoManager(projectRoot);
    this.configManager = new ConfigManager(projectRoot);
    this.formatter = new OutputFormatter();
  }

  /**
   * Execute repository initialization
   * @param {Object} options - Initialization options
   * @param {boolean} options.yes - Skip confirmation prompts
   * @param {number} options.maxDepth - Maximum scan depth
   * @param {string[]} options.exclude - Directories to exclude
   * @returns {Promise<Object>} Initialization result
   */
  async execute(options = {}) {
    const { yes = false, maxDepth = 3, exclude = ['.kiro'] } = options;

    // Check if configuration already exists
    const configExists = await this.configManager.configExists();
    
    if (configExists && !yes) {
      const shouldOverwrite = await this.confirmOverwrite();
      if (!shouldOverwrite) {
        console.log(this.formatter.info('Initialization cancelled'));
        return { cancelled: true, discovered: [] };
      }
    }

    // Scan for repositories
    const progress = this.formatter.createProgress('Scanning for Git repositories...');
    progress.start();

    let discovered;
    try {
      discovered = await this.repoManager.discoverRepositories(this.projectRoot, {
        maxDepth,
        exclude
      });
      progress.succeed(`Found ${discovered.length} Git ${discovered.length === 1 ? 'repository' : 'repositories'}`);
    } catch (error) {
      progress.fail('Failed to scan for repositories');
      throw error;
    }

    if (discovered.length === 0) {
      console.log(this.formatter.warning('No Git repositories found in the project directory'));
      return { cancelled: false, discovered: [] };
    }

    // Create configuration
    const config = {
      version: '1.0',
      repositories: discovered.map(repo => ({
        name: repo.name,
        path: repo.path,
        remote: repo.remote,
        defaultBranch: repo.branch
      }))
    };

    // Save configuration
    try {
      await this.configManager.saveConfig(config);
    } catch (error) {
      console.log(this.formatter.error(`Failed to save configuration: ${error.message}`));
      throw error;
    }

    // Display summary
    this.displaySummary({ discovered, configPath: this.configManager.getConfigPath() });

    return { cancelled: false, discovered };
  }

  /**
   * Prompt user for confirmation if config exists
   * @returns {Promise<boolean>} True if user confirms overwrite
   */
  async confirmOverwrite() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(
        this.formatter.warning('Configuration file already exists. Overwrite? (y/N): '),
        (answer) => {
          rl.close();
          const normalized = answer.trim().toLowerCase();
          resolve(normalized === 'y' || normalized === 'yes');
        }
      );
    });
  }

  /**
   * Display initialization summary
   * @param {Object} result - Initialization result
   * @param {Array} result.discovered - Discovered repositories
   * @param {string} result.configPath - Configuration file path
   */
  displaySummary(result) {
    const { discovered, configPath } = result;

    console.log('\n' + this.formatter.success('Repository configuration initialized'));
    console.log(this.formatter.info(`Configuration saved to: ${configPath}`));
    console.log('\nDiscovered repositories:');

    // Display table of discovered repositories
    const tableData = discovered.map(repo => [
      repo.name,
      repo.path,
      repo.branch,
      repo.hasRemote ? '✓' : '✗'
    ]);

    const table = this.formatter.formatTable([], {
      head: ['Name', 'Path', 'Branch', 'Has Remote'],
      rows: tableData
    });

    console.log(table);

    // Display warnings for repos without remotes
    const reposWithoutRemotes = discovered.filter(r => !r.hasRemote);
    if (reposWithoutRemotes.length > 0) {
      console.log('\n' + this.formatter.warning(
        `${reposWithoutRemotes.length} ${reposWithoutRemotes.length === 1 ? 'repository' : 'repositories'} without remote URLs:`
      ));
      reposWithoutRemotes.forEach(repo => {
        console.log(`  - ${repo.name} (${repo.path})`);
      });
    }

    console.log('\nNext steps:');
    console.log('  • Run "kse repo status" to view repository status');
    console.log('  • Run "kse repo health" to check repository health');
    console.log('  • Run "kse repo exec <command>" to execute commands across all repos');
  }
}

module.exports = InitHandler;
