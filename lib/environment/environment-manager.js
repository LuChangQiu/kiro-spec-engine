const fs = require('fs-extra');
const path = require('path');
const EnvironmentRegistry = require('./environment-registry');
const BackupSystem = require('./backup-system');

/**
 * Environment Manager
 * 
 * Core logic for environment operations including registration,
 * switching, listing, and managing active environment.
 */
class EnvironmentManager {
  /**
   * Create a new Environment Manager
   * @param {string} projectRoot - Project root directory
   * @param {string} [workspaceContext] - Optional workspace context
   */
  constructor(projectRoot, workspaceContext = null) {
    this.projectRoot = projectRoot;
    this.workspaceContext = workspaceContext;
    this.registryPath = this.resolveRegistryPath();
    this.backupSystem = new BackupSystem(projectRoot);
  }

  /**
   * Resolve registry path based on workspace context
   * @returns {string} Path to environments.json
   */
  resolveRegistryPath() {
    if (this.workspaceContext) {
      return path.join(
        this.projectRoot,
        '.sce',
        'workspaces',
        this.workspaceContext,
        'environments.json'
      );
    }
    return path.join(this.projectRoot, '.sce', 'environments.json');
  }

  /**
   * Register new environment
   * @param {Object} environmentConfig - Environment configuration
   * @returns {Object} Registration result
   * @throws {Error} If registration fails
   */
  async registerEnvironment(environmentConfig) {
    // Validate environment configuration
    EnvironmentRegistry.validateEnvironment(environmentConfig);

    // Load existing registry
    const registry = await EnvironmentRegistry.load(this.registryPath);

    // Check for duplicate name
    const exists = registry.environments.some(
      env => env.name === environmentConfig.name
    );
    if (exists) {
      throw new Error(
        `Environment "${environmentConfig.name}" already exists`
      );
    }

    // Validate source files exist
    for (const mapping of environmentConfig.config_files) {
      const sourcePath = path.join(this.projectRoot, mapping.source);
      if (!await fs.pathExists(sourcePath)) {
        throw new Error(
          `Source file does not exist: ${mapping.source}`
        );
      }
    }

    // Add environment to registry
    registry.environments.push(environmentConfig);

    // Save registry
    await EnvironmentRegistry.save(this.registryPath, registry);

    return {
      success: true,
      environment: environmentConfig.name,
      message: `Environment "${environmentConfig.name}" registered successfully`
    };
  }

  /**
   * List all registered environments
   * @returns {Array} Array of environment objects with metadata
   */
  async listEnvironments() {
    const registry = await EnvironmentRegistry.load(this.registryPath);
    return registry.environments.map(env => ({
      name: env.name,
      description: env.description,
      isActive: env.name === registry.active_environment,
      configFilesCount: env.config_files.length,
      hasVerification: !!env.verification
    }));
  }

  /**
   * Get active environment details
   * @returns {Object} Active environment configuration
   * @throws {Error} If no environment is active
   */
  async getActiveEnvironment() {
    const registry = await EnvironmentRegistry.load(this.registryPath);
    
    if (!registry.active_environment) {
      throw new Error('No active environment. Use "sce env switch <name>" to activate one.');
    }

    const env = registry.environments.find(
      e => e.name === registry.active_environment
    );

    if (!env) {
      throw new Error(
        `Active environment "${registry.active_environment}" not found in registry`
      );
    }

    return env;
  }

  /**
   * Set active environment
   * @param {string} environmentName - Name of environment to activate
   * @throws {Error} If environment doesn't exist
   */
  async setActiveEnvironment(environmentName) {
    const registry = await EnvironmentRegistry.load(this.registryPath);

    const env = registry.environments.find(e => e.name === environmentName);
    if (!env) {
      throw new Error(`Environment "${environmentName}" not found`);
    }

    registry.active_environment = environmentName;
    await EnvironmentRegistry.save(this.registryPath, registry);
  }

  /**
   * Switch to specified environment (basic implementation)
   * @param {string} environmentName - Name of environment to switch to
   * @param {Object} options - Switch options
   * @returns {Object} Switch result with status and details
   * @throws {Error} If switch operation fails
   */
  async switchEnvironment(environmentName, options = {}) {
    try {
      const registry = await EnvironmentRegistry.load(this.registryPath);

      // Find environment
      const env = registry.environments.find(e => e.name === environmentName);
      if (!env) {
        throw new Error(`Environment "${environmentName}" not found`);
      }

      const previousEnvironment = registry.active_environment;
      const copiedFiles = [];
      let backupMetadata = null;

      // Create backup unless skipBackup option is set
      if (!options.skipBackup) {
        const targetFiles = env.config_files.map(m => m.target);
        backupMetadata = await this.backupSystem.createBackup(targetFiles, environmentName);
      }

      // Copy each config file
      for (const mapping of env.config_files) {
        const sourcePath = path.join(this.projectRoot, mapping.source);
        const targetPath = path.join(this.projectRoot, mapping.target);

        // Validate source exists
        if (!await fs.pathExists(sourcePath)) {
          throw new Error(`Source file does not exist: ${mapping.source}`);
        }

        // Create target directory if needed
        const targetDir = path.dirname(targetPath);
        await fs.ensureDir(targetDir);

        // Copy file
        await fs.copy(sourcePath, targetPath, { overwrite: true });
        copiedFiles.push(mapping.target);
      }

      // Update active environment
      registry.active_environment = environmentName;
      await EnvironmentRegistry.save(this.registryPath, registry);

      return {
        success: true,
        previous_environment: previousEnvironment,
        new_environment: environmentName,
        files_copied: copiedFiles.length,
        backup_created: !!backupMetadata,
        backup_location: backupMetadata ? backupMetadata.backup_directory : null,
        errors: []
      };
    } catch (error) {
      // If error occurs, system remains in previous state
      return {
        success: false,
        previous_environment: null,
        new_environment: null,
        files_copied: 0,
        backup_created: false,
        backup_location: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Rollback to previous environment using backup
   * @returns {Object} Rollback result
   * @throws {Error} If rollback fails
   */
  async rollbackEnvironment() {
    const result = await this.backupSystem.restoreBackup();
    
    // Update active environment to match restored backup
    const registry = await EnvironmentRegistry.load(this.registryPath);
    registry.active_environment = result.environment_name;
    await EnvironmentRegistry.save(this.registryPath, registry);

    return result;
  }

  /**
   * Unregister environment
   * @param {string} environmentName - Name of environment to remove
   * @throws {Error} If environment is active or doesn't exist
   */
  async unregisterEnvironment(environmentName) {
    const registry = await EnvironmentRegistry.load(this.registryPath);

    // Check if environment exists
    const envIndex = registry.environments.findIndex(
      e => e.name === environmentName
    );
    if (envIndex === -1) {
      throw new Error(`Environment "${environmentName}" not found`);
    }

    // Prevent unregistering active environment
    if (registry.active_environment === environmentName) {
      throw new Error(
        `Cannot unregister active environment "${environmentName}". ` +
        'Switch to another environment first.'
      );
    }

    // Remove environment
    registry.environments.splice(envIndex, 1);
    await EnvironmentRegistry.save(this.registryPath, registry);

    return {
      success: true,
      message: `Environment "${environmentName}" unregistered successfully`
    };
  }

  /**
   * Verify current environment configuration
   * @returns {Object} Verification result with status and output
   * @throws {Error} If verification command fails
   */
  async verifyEnvironment() {
    const env = await this.getActiveEnvironment();

    // If no verification rules, return success
    if (!env.verification) {
      return {
        success: true,
        environment_name: env.name,
        command: null,
        expected_output: null,
        actual_output: null,
        exit_code: 0,
        error: null
      };
    }

    const { command, expected_output } = env.verification;

    try {
      // Execute verification command
      const { execSync } = require('child_process');
      const actualOutput = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      }).trim();

      // Check if output matches expected pattern
      const success = actualOutput.includes(expected_output);

      return {
        success,
        environment_name: env.name,
        command,
        expected_output,
        actual_output: actualOutput,
        exit_code: 0,
        error: success ? null : 'Output does not match expected pattern'
      };
    } catch (error) {
      return {
        success: false,
        environment_name: env.name,
        command,
        expected_output,
        actual_output: error.stdout ? error.stdout.toString().trim() : '',
        exit_code: error.status || 1,
        error: error.message
      };
    }
  }

  /**
   * Run command in environment context
   * @param {string} command - Command to execute
   * @param {string} environmentName - Optional environment name (defaults to active)
   * @returns {Object} Command execution result
   * @throws {Error} If command execution fails
   */
  async runInEnvironment(command, environmentName = null) {
    // If environment name specified, ensure it's active
    if (environmentName) {
      const currentEnv = await this.getActiveEnvironment();
      if (currentEnv.name !== environmentName) {
        // Switch to specified environment
        const switchResult = await this.switchEnvironment(environmentName);
        if (!switchResult.success) {
          throw new Error(
            `Failed to switch to environment "${environmentName}": ${switchResult.errors.join(', ')}`
          );
        }
      }
    }

    const env = await this.getActiveEnvironment();

    try {
      // Execute command
      const { execSync } = require('child_process');
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      return {
        success: true,
        environment_name: env.name,
        command,
        output: output.trim(),
        exit_code: 0,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        environment_name: env.name,
        command,
        output: error.stdout ? error.stdout.toString().trim() : '',
        exit_code: error.status || 1,
        error: error.message
      };
    }
  }
}

module.exports = EnvironmentManager;
