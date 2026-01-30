const fs = require('fs-extra');
const path = require('path');

/**
 * Environment Registry
 * 
 * Manages persistent storage of environment configurations.
 * Handles loading, saving, and validating the environments.json file.
 */
class EnvironmentRegistry {
  /**
   * Load registry from disk
   * @param {string} registryPath - Path to environments.json
   * @returns {Object} Registry data
   * @throws {Error} If registry is corrupted or invalid
   */
  static async load(registryPath) {
    try {
      if (!await fs.pathExists(registryPath)) {
        return this.initialize();
      }

      const content = await fs.readFile(registryPath, 'utf8');
      const data = JSON.parse(content);
      
      this.validate(data);
      return data;
    } catch (error) {
      if (error.name === 'SyntaxError') {
        throw new Error(`Registry file is corrupted: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Save registry to disk
   * @param {string} registryPath - Path to environments.json
   * @param {Object} registryData - Registry data to save
   * @throws {Error} If save operation fails
   */
  static async save(registryPath, registryData) {
    this.validate(registryData);
    
    const dir = path.dirname(registryPath);
    await fs.ensureDir(dir);
    
    await fs.writeFile(
      registryPath,
      JSON.stringify(registryData, null, 2),
      'utf8'
    );
  }

  /**
   * Validate registry structure
   * @param {Object} registryData - Registry data to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails with details
   */
  static validate(registryData) {
    if (!registryData || typeof registryData !== 'object') {
      throw new Error('Registry data must be an object');
    }

    if (!registryData.version) {
      throw new Error('Registry must have a version field');
    }

    if (!Array.isArray(registryData.environments)) {
      throw new Error('Registry must have an environments array');
    }

    // Validate each environment
    const names = new Set();
    for (const env of registryData.environments) {
      this.validateEnvironment(env);
      
      if (names.has(env.name)) {
        throw new Error(`Duplicate environment name: ${env.name}`);
      }
      names.add(env.name);
    }

    // Validate active_environment if present
    if (registryData.active_environment) {
      const activeExists = registryData.environments.some(
        env => env.name === registryData.active_environment
      );
      if (!activeExists) {
        throw new Error(
          `Active environment "${registryData.active_environment}" not found in registry`
        );
      }
    }

    return true;
  }

  /**
   * Validate a single environment configuration
   * @param {Object} env - Environment configuration
   * @throws {Error} If validation fails
   */
  static validateEnvironment(env) {
    if (!env.name || typeof env.name !== 'string') {
      throw new Error('Environment must have a name (string)');
    }

    if (!/^[a-z0-9-]+$/.test(env.name)) {
      throw new Error(
        `Environment name must be kebab-case (lowercase, numbers, hyphens): ${env.name}`
      );
    }

    if (!env.description || typeof env.description !== 'string') {
      throw new Error(`Environment "${env.name}" must have a description`);
    }

    if (!Array.isArray(env.config_files) || env.config_files.length === 0) {
      throw new Error(
        `Environment "${env.name}" must have at least one config file mapping`
      );
    }

    // Validate config file mappings
    for (const mapping of env.config_files) {
      if (!mapping.source || typeof mapping.source !== 'string') {
        throw new Error(
          `Environment "${env.name}" has invalid config file mapping: missing source`
        );
      }
      if (!mapping.target || typeof mapping.target !== 'string') {
        throw new Error(
          `Environment "${env.name}" has invalid config file mapping: missing target`
        );
      }
    }

    // Validate verification rules if present
    if (env.verification) {
      if (!env.verification.command || typeof env.verification.command !== 'string') {
        throw new Error(
          `Environment "${env.name}" has invalid verification: missing command`
        );
      }
      if (!env.verification.expected_output || typeof env.verification.expected_output !== 'string') {
        throw new Error(
          `Environment "${env.name}" has invalid verification: missing expected_output`
        );
      }
    }
  }

  /**
   * Initialize empty registry
   * @returns {Object} Empty registry structure
   */
  static initialize() {
    return {
      version: '1.0',
      environments: [],
      active_environment: null
    };
  }
}

module.exports = EnvironmentRegistry;
