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
   * @param {boolean} options.nested - Enable nested repository scanning (default: true)
   * @returns {Promise<Object>} Initialization result
   */
  async execute(options = {}) {
    const { yes = false, maxDepth = 3, exclude = ['.kiro'], nested = true } = options;

    // Check if configuration already exists
    const configExists = await this.configManager.configExists();
    
    if (configExists && !yes) {
      const shouldOverwrite = await this.confirmOverwrite();
      if (!shouldOverwrite) {
        console.log(this.formatter.info('Initialization cancelled'));
        return { cancelled: true, discovered: [], nestedMode: nested };
      }
    }

    // Scan for repositories
    const scanMode = nested ? 'nested' : 'non-nested';
    const progress = this.formatter.createProgress(`Scanning for Git repositories (${scanMode} mode)...`);
    progress.start();

    let discovered;
    try {
      discovered = await this.repoManager.discoverRepositories(this.projectRoot, {
        maxDepth,
        exclude,
        nested
      });
      progress.succeed(`Found ${discovered.length} Git ${discovered.length === 1 ? 'repository' : 'repositories'} (${scanMode} scanning)`);
    } catch (error) {
      progress.fail('Failed to scan for repositories');
      throw error;
    }

    if (discovered.length === 0) {
      console.log(this.formatter.warning('No Git repositories found in the project directory'));
      return { cancelled: false, discovered: [], nestedMode: nested };
    }

    // Create configuration
    const config = {
      version: '1.0',
      repositories: discovered.map(repo => ({
        name: repo.name,
        path: repo.path,
        remote: repo.remote,
        defaultBranch: repo.branch,
        parent: repo.parent || null // Include parent field
      })),
      settings: {
        nestedMode: nested // Store nested mode setting
      }
    };

    // Save configuration
    try {
      await this.configManager.saveConfig(config);
    } catch (error) {
      console.log(this.formatter.error(`Failed to save configuration: ${error.message}`));
      
      // Display detailed validation errors if available
      if (error.details && error.details.errors && Array.isArray(error.details.errors)) {
        console.log(this.formatter.error('\nValidation errors:'));
        error.details.errors.forEach((err, index) => {
          console.log(this.formatter.error(`  ${index + 1}. ${err}`));
        });
      }
      
      throw error;
    }

    // Display summary
    this.displaySummary({ discovered, configPath: this.configManager.getConfigPath(), nestedMode: nested });

    return { cancelled: false, discovered, nestedMode: nested };
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
   * @param {boolean} result.nestedMode - Whether nested scanning was enabled
   */
  displaySummary(result) {
    const { discovered, configPath, nestedMode } = result;

    console.log('\n' + this.formatter.success('Repository configuration initialized'));
    console.log(this.formatter.info(`Configuration saved to: ${configPath}`));
    console.log(this.formatter.info(`Scan mode: ${nestedMode ? 'nested' : 'non-nested'}`));
    console.log('\nDiscovered repositories:');

    // Display table of discovered repositories with parent column
    const hasNestedRepos = discovered.some(r => r.parent);
    const headers = hasNestedRepos 
      ? ['Name', 'Path', 'Branch', 'Has Remote', 'Parent']
      : ['Name', 'Path', 'Branch', 'Has Remote'];

    const tableData = discovered.map(repo => {
      const row = [
        repo.name,
        repo.path,
        repo.branch,
        repo.hasRemote ? '✓' : '✗'
      ];
      if (hasNestedRepos) {
        row.push(repo.parent || '');
      }
      return row;
    });

    const table = this.formatter.formatTable([], {
      head: headers,
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

    // Display nested repository info
    if (hasNestedRepos) {
      const nestedRepos = discovered.filter(r => r.parent);
      console.log('\n' + this.formatter.info(
        `Found ${nestedRepos.length} nested ${nestedRepos.length === 1 ? 'repository' : 'repositories'}`
      ));
    }

    console.log('\nNext steps:');
    console.log('  • Run "sce repo status" to view repository status');
    console.log('  • Run "sce repo health" to check repository health');
    console.log('  • Run "sce repo exec <command>" to execute commands across all repos');
  }
}

module.exports = InitHandler;
