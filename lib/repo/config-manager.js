const fs = require('fs').promises;
const path = require('path');
const ConfigError = require('./errors/config-error');
const PathResolver = require('./path-resolver');

/**
 * ConfigManager - Manages the project-repos.json configuration file
 * 
 * Handles loading, saving, and validating repository configuration with
 * JSON schema validation and comprehensive error checking.
 */
class ConfigManager {
  /**
   * Create a new ConfigManager
   * @param {string} projectRoot - The project root directory
   */
  constructor(projectRoot) {
    if (!projectRoot) {
      throw new Error('Project root is required');
    }
    this.projectRoot = projectRoot;
    this.pathResolver = new PathResolver();
    this.configFileName = 'project-repos.json';
  }

  /**
   * Get the configuration file path
   * @returns {string} Absolute path to the configuration file
   */
  getConfigPath() {
    return path.join(this.projectRoot, '.kiro', this.configFileName);
  }

  /**
   * Check if configuration file exists
   * @returns {Promise<boolean>} True if configuration file exists
   */
  async configExists() {
    try {
      await fs.access(this.getConfigPath());
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load and validate configuration from disk
   * @returns {Promise<Object>} The loaded and validated configuration
   * @throws {ConfigError} If file is missing, invalid JSON, or validation fails
   */
  async loadConfig() {
    const configPath = this.getConfigPath();

    // Check if file exists
    if (!(await this.configExists())) {
      throw new ConfigError(
        'Configuration file not found. Run "kse repo init" to create it.',
        { path: configPath }
      );
    }

    // Read and parse JSON
    let configData;
    try {
      const fileContent = await fs.readFile(configPath, 'utf8');
      configData = JSON.parse(fileContent);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigError(
          'Configuration file contains invalid JSON',
          { path: configPath, parseError: error.message }
        );
      }
      throw new ConfigError(
        `Failed to read configuration file: ${error.message}`,
        { path: configPath }
      );
    }

    // Validate configuration
    const validation = this.validateConfig(configData);
    if (!validation.valid) {
      throw new ConfigError(
        'Configuration validation failed',
        { errors: validation.errors }
      );
    }

    return configData;
  }

  /**
   * Save configuration to disk
   * @param {Object} config - The configuration object to save
   * @returns {Promise<void>}
   * @throws {ConfigError} If validation fails or save fails
   */
  async saveConfig(config) {
    // Validate before saving
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new ConfigError(
        'Cannot save invalid configuration',
        { errors: validation.errors }
      );
    }

    const configPath = this.getConfigPath();

    try {
      // Ensure .kiro directory exists
      const kiroDir = path.dirname(configPath);
      await fs.mkdir(kiroDir, { recursive: true });

      // Write configuration with pretty formatting
      const jsonContent = JSON.stringify(config, null, 2);
      await fs.writeFile(configPath, jsonContent, 'utf8');
    } catch (error) {
      throw new ConfigError(
        `Failed to save configuration: ${error.message}`,
        { path: configPath }
      );
    }
  }

  /**
   * Validate configuration structure and content
   * @param {Object} config - The configuration object to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validateConfig(config) {
    const errors = [];

    // Check if config is an object
    if (!config || typeof config !== 'object') {
      return { valid: false, errors: ['Configuration must be an object'] };
    }

    // Validate version field
    if (!config.version) {
      errors.push('Missing required field: version');
    } else if (typeof config.version !== 'string') {
      errors.push('Field "version" must be a string');
    } else if (!this._isSupportedVersion(config.version)) {
      errors.push(
        `Unsupported configuration version: ${config.version}. ` +
        'Please upgrade to the latest version of kse.'
      );
    }

    // Validate repositories array
    if (!config.repositories) {
      errors.push('Missing required field: repositories');
      return { valid: false, errors }; // Can't continue without repositories
    }

    if (!Array.isArray(config.repositories)) {
      errors.push('Field "repositories" must be an array');
      return { valid: false, errors };
    }

    // Validate each repository
    const repoNames = new Set();
    const repoPaths = [];

    config.repositories.forEach((repo, index) => {
      const repoErrors = this._validateRepository(repo, index, config.repositories);
      errors.push(...repoErrors);

      // Collect names and paths for duplicate checking
      if (repo.name) {
        if (repoNames.has(repo.name)) {
          errors.push(`Duplicate repository name: "${repo.name}"`);
        }
        repoNames.add(repo.name);
      }

      if (repo.path) {
        repoPaths.push(repo.path);
      }
    });

    // Validate parent references
    const parentErrors = this._validateParentReferences(config.repositories);
    errors.push(...parentErrors);

    // Validate no duplicate or overlapping paths
    if (repoPaths.length > 0) {
      const pathValidation = this._validatePaths(repoPaths);
      errors.push(...pathValidation.errors);
    }

    // Validate optional groups field
    if (config.groups && typeof config.groups !== 'object') {
      errors.push('Field "groups" must be an object');
    }

    // Validate optional settings field
    if (config.settings && typeof config.settings !== 'object') {
      errors.push('Field "settings" must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single repository configuration
   * @private
   * @param {Object} repo - Repository configuration object
   * @param {number} index - Repository index in array
   * @param {Array<Object>} allRepos - All repositories (for parent validation)
   * @returns {string[]} Array of validation errors
   */
  _validateRepository(repo, index, allRepos = []) {
    const errors = [];
    const prefix = `Repository at index ${index}`;

    // Check if repo is an object
    if (!repo || typeof repo !== 'object') {
      return [`${prefix}: must be an object`];
    }

    // Validate required fields
    if (!repo.name) {
      errors.push(`${prefix}: missing required field "name"`);
    } else if (typeof repo.name !== 'string') {
      errors.push(`${prefix}: field "name" must be a string`);
    } else if (!this._isValidRepoName(repo.name)) {
      errors.push(
        `${prefix}: invalid repository name "${repo.name}". ` +
        'Names must contain only alphanumeric characters, hyphens, underscores, and dots.'
      );
    }

    if (!repo.path) {
      errors.push(`${prefix}: missing required field "path"`);
    } else if (typeof repo.path !== 'string') {
      errors.push(`${prefix}: field "path" must be a string`);
    }

    // Validate optional fields
    if (repo.remote !== undefined && repo.remote !== null && typeof repo.remote !== 'string') {
      errors.push(`${prefix}: field "remote" must be a string or null`);
    }

    if (repo.defaultBranch !== undefined && typeof repo.defaultBranch !== 'string') {
      errors.push(`${prefix}: field "defaultBranch" must be a string`);
    }

    if (repo.description !== undefined && typeof repo.description !== 'string') {
      errors.push(`${prefix}: field "description" must be a string`);
    }

    if (repo.tags !== undefined) {
      if (!Array.isArray(repo.tags)) {
        errors.push(`${prefix}: field "tags" must be an array`);
      } else if (!repo.tags.every(tag => typeof tag === 'string')) {
        errors.push(`${prefix}: all tags must be strings`);
      }
    }

    if (repo.group !== undefined && typeof repo.group !== 'string') {
      errors.push(`${prefix}: field "group" must be a string`);
    }

    // Validate parent field (NEW)
    if (repo.parent !== undefined && repo.parent !== null) {
      if (typeof repo.parent !== 'string') {
        errors.push(`${prefix}: field "parent" must be a string or null`);
      }
      // Note: Parent reference validation is done separately in _validateParentReferences
    }

    return errors;
  }

  /**
   * Normalize path for comparison
   * @private
   * @param {string} pathStr - Path to normalize
   * @returns {string} Normalized path
   */
  _normalizePath(pathStr) {
    if (!pathStr) return '';
    
    // Convert backslashes to forward slashes
    let normalized = pathStr.replace(/\\/g, '/');
    
    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');
    
    // Remove leading './'
    normalized = normalized.replace(/^\.\//, '');
    
    // Handle '.' as current directory
    if (normalized === '.') {
      normalized = '';
    }
    
    return normalized;
  }

  /**
   * Validate parent references in repositories
   * @private
   * @param {Array<Object>} repos - All repositories
   * @returns {string[]} Array of validation errors
   */
  _validateParentReferences(repos) {
    const errors = [];
    
    // Build a map of repository paths for O(1) lookup
    const pathMap = new Map();
    repos.forEach(repo => {
      if (repo.path) {
        const normalizedPath = this._normalizePath(repo.path);
        pathMap.set(normalizedPath, repo);
      }
    });

    // Check each repository's parent reference
    repos.forEach((repo, index) => {
      if (repo.parent) {
        // Check if parent path exists (using normalized paths)
        const normalizedParent = this._normalizePath(repo.parent);
        if (!pathMap.has(normalizedParent)) {
          errors.push(
            `Repository "${repo.name}" (index ${index}): ` +
            `parent path "${repo.parent}" does not reference an existing repository. ` +
            `Available paths: ${Array.from(pathMap.keys()).join(', ')}`
          );
        }
      }
    });

    // Detect circular parent references using depth-first search
    const visited = new Set();
    const recursionStack = new Set();

    const detectCycle = (repoPath, path = []) => {
      if (recursionStack.has(repoPath)) {
        // Found a cycle
        const cycleStart = path.indexOf(repoPath);
        const cycle = path.slice(cycleStart).concat(repoPath);
        errors.push(
          `Circular parent reference detected: ${cycle.join(' → ')}`
        );
        return true;
      }

      if (visited.has(repoPath)) {
        return false;
      }

      visited.add(repoPath);
      recursionStack.add(repoPath);
      path.push(repoPath);

      const repo = pathMap.get(repoPath);
      if (repo && repo.parent) {
        detectCycle(repo.parent, path);
      }

      path.pop();
      recursionStack.delete(repoPath);
      return false;
    };

    // Check for cycles starting from each repository
    repos.forEach(repo => {
      if (repo.path && !visited.has(repo.path)) {
        detectCycle(repo.path, []);
      }
    });

    return errors;
  }

  /**
   * Validate repository paths for duplicates and overlaps
   * @private
   * @param {string[]} paths - Array of repository paths
   * @returns {{errors: string[]}} Validation result
   */
  _validatePaths(paths) {
    const errors = [];

    // Resolve all paths to absolute for comparison
    const resolvedPaths = paths.map(p => {
      try {
        return this.pathResolver.resolvePath(p, this.projectRoot);
      } catch (error) {
        // If path resolution fails, return the original path
        // The error will be caught during actual operations
        return p;
      }
    });

    // Check for duplicates and overlaps
    const pathValidation = this.pathResolver.validateNoOverlap(resolvedPaths);
    
    if (!pathValidation.valid) {
      // Map resolved paths back to original paths in error messages
      pathValidation.errors.forEach(error => {
        errors.push(error);
      });
    }

    return { errors };
  }

  /**
   * Check if repository name is valid
   * @private
   * @param {string} name - Repository name to validate
   * @returns {boolean} True if name is valid
   */
  _isValidRepoName(name) {
    // Allow alphanumeric, hyphens, underscores, and dots
    // Must not start or end with special characters
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
    return validPattern.test(name);
  }

  /**
   * Check if configuration version is supported
   * @private
   * @param {string} version - Version string to check
   * @returns {boolean} True if version is supported
   */
  _isSupportedVersion(version) {
    // Currently only version 1.0 is supported
    const supportedVersions = ['1.0'];
    return supportedVersions.includes(version);
  }
}

module.exports = ConfigManager;
