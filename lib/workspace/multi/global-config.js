const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * GlobalConfig - Manages global kse configuration
 * 
 * Handles persistence of global settings including the active workspace.
 * Configuration is stored in ~/.kse/config.json.
 */
class GlobalConfig {
  /**
   * Create a new GlobalConfig instance
   * 
   * @param {string} configPath - Path to config.json (optional, defaults to ~/.kse/config.json)
   */
  constructor(configPath = null) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.version = '1.0';
    this.activeWorkspace = null;
    this.preferences = {
      autoDetectWorkspace: true,
      confirmDestructiveOperations: true
    };
    this.loaded = false;
  }

  /**
   * Get the default configuration file path
   * 
   * @returns {string} Path to ~/.kse/config.json
   */
  getDefaultConfigPath() {
    const homeDir = os.homedir();
    return path.join(homeDir, '.kse', 'config.json');
  }

  /**
   * Load configuration from disk
   * 
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async load() {
    try {
      const exists = await fs.pathExists(this.configPath);
      
      if (!exists) {
        // Initialize with defaults
        this.activeWorkspace = null;
        this.preferences = {
          autoDetectWorkspace: true,
          confirmDestructiveOperations: true
        };
        this.loaded = true;
        return true;
      }

      const content = await fs.readFile(this.configPath, 'utf8');
      const data = JSON.parse(content);

      // Validate version
      if (data.version !== this.version) {
        console.warn(`Warning: Config version mismatch. Expected ${this.version}, got ${data.version}`);
      }

      // Load settings
      this.activeWorkspace = data.active_workspace || null;
      this.preferences = {
        autoDetectWorkspace: data.preferences?.auto_detect_workspace ?? true,
        confirmDestructiveOperations: data.preferences?.confirm_destructive_operations ?? true
      };

      this.loaded = true;
      return true;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Configuration file is corrupted: ${this.configPath}. ` +
                       `Please backup and delete the file, then try again.`);
      }
      throw error;
    }
  }

  /**
   * Save configuration to disk
   * 
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.ensureDir(configDir);

      const data = {
        version: this.version,
        active_workspace: this.activeWorkspace,
        preferences: {
          auto_detect_workspace: this.preferences.autoDetectWorkspace,
          confirm_destructive_operations: this.preferences.confirmDestructiveOperations
        }
      };

      // Write to file with pretty formatting
      await fs.writeFile(this.configPath, JSON.stringify(data, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      throw new Error(`Failed to save global configuration: ${error.message}`);
    }
  }

  /**
   * Ensure config is loaded before operations
   * 
   * @private
   */
  async ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Get the active workspace name
   * 
   * @returns {Promise<string|null>} Active workspace name or null
   */
  async getActiveWorkspace() {
    await this.ensureLoaded();
    return this.activeWorkspace;
  }

  /**
   * Set the active workspace
   * 
   * @param {string|null} name - Workspace name or null to clear
   * @returns {Promise<void>}
   */
  async setActiveWorkspace(name) {
    await this.ensureLoaded();
    this.activeWorkspace = name;
    await this.save();
  }

  /**
   * Clear the active workspace
   * 
   * @returns {Promise<void>}
   */
  async clearActiveWorkspace() {
    await this.setActiveWorkspace(null);
  }

  /**
   * Get a preference value
   * 
   * @param {string} key - Preference key (camelCase)
   * @returns {Promise<any>} Preference value
   */
  async getPreference(key) {
    await this.ensureLoaded();
    return this.preferences[key];
  }

  /**
   * Set a preference value
   * 
   * @param {string} key - Preference key (camelCase)
   * @param {any} value - Preference value
   * @returns {Promise<void>}
   */
  async setPreference(key, value) {
    await this.ensureLoaded();
    this.preferences[key] = value;
    await this.save();
  }

  /**
   * Get all preferences
   * 
   * @returns {Promise<Object>} All preferences
   */
  async getPreferences() {
    await this.ensureLoaded();
    return { ...this.preferences };
  }

  /**
   * Reset configuration to defaults
   * 
   * @returns {Promise<void>}
   */
  async reset() {
    this.activeWorkspace = null;
    this.preferences = {
      autoDetectWorkspace: true,
      confirmDestructiveOperations: true
    };
    await this.save();
  }
}

module.exports = GlobalConfig;
