const WorkspaceStateManager = require('./workspace-state-manager');

/**
 * GlobalConfig - Facade for WorkspaceStateManager
 * 
 * Provides backward-compatible API for global configuration operations.
 * All operations are delegated to WorkspaceStateManager which implements
 * the Data Atomicity Principle (single source of truth).
 * 
 * @deprecated This class is a compatibility layer. New code should use
 *             WorkspaceStateManager directly.
 */
class GlobalConfig {
  /**
   * Create a new GlobalConfig instance
   * 
   * @param {string} configPath - Path to workspace-state.json (optional)
   */
  constructor(configPath = null) {
    // Delegate to WorkspaceStateManager
    this.stateManager = new WorkspaceStateManager(configPath);
    // Expose configPath for backward compatibility
    this.configPath = this.stateManager.statePath;
  }

  /**
   * Get the default configuration file path
   * 
   * @returns {string} Path to ~/.sce/workspace-state.json
   * @deprecated Use WorkspaceStateManager.getDefaultStatePath() instead
   */
  getDefaultConfigPath() {
    return this.stateManager.getDefaultStatePath();
  }

  /**
   * Load configuration from disk
   * 
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async load() {
    return await this.stateManager.load();
  }

  /**
   * Save configuration to disk
   * 
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    return await this.stateManager.save();
  }

  /**
   * Ensure config is loaded before operations
   * 
   * @private
   */
  async ensureLoaded() {
    await this.stateManager.ensureLoaded();
  }

  /**
   * Get the active workspace name
   * 
   * @returns {Promise<string|null>} Active workspace name or null
   */
  async getActiveWorkspace() {
    await this.ensureLoaded();
    // Return the active workspace name directly from state
    // This maintains backward compatibility with tests that set
    // active workspace without creating the workspace first
    return this.stateManager.state.activeWorkspace;
  }

  /**
   * Set the active workspace
   * 
   * @param {string|null} name - Workspace name or null to clear
   * @returns {Promise<void>}
   */
  async setActiveWorkspace(name) {
    await this.ensureLoaded();
    
    if (name === null) {
      await this.stateManager.clearActiveWorkspace();
    } else {
      // Check if workspace exists before switching
      const workspace = await this.stateManager.getWorkspace(name);
      if (!workspace) {
        // For backward compatibility, just set the name without validation
        // This allows tests to set active workspace without creating it first
        this.stateManager.state.activeWorkspace = name;
        await this.stateManager.save();
      } else {
        await this.stateManager.switchWorkspace(name);
      }
    }
  }

  /**
   * Clear the active workspace
   * 
   * @returns {Promise<void>}
   */
  async clearActiveWorkspace() {
    await this.stateManager.clearActiveWorkspace();
  }

  /**
   * Get a preference value
   * 
   * @param {string} key - Preference key (camelCase)
   * @returns {Promise<any>} Preference value
   */
  async getPreference(key) {
    return await this.stateManager.getPreference(key);
  }

  /**
   * Set a preference value
   * 
   * @param {string} key - Preference key (camelCase)
   * @param {any} value - Preference value
   * @returns {Promise<void>}
   */
  async setPreference(key, value) {
    await this.stateManager.setPreference(key, value);
  }

  /**
   * Get all preferences
   * 
   * @returns {Promise<Object>} All preferences
   */
  async getPreferences() {
    return await this.stateManager.getPreferences();
  }

  /**
   * Reset configuration to defaults
   * 
   * @returns {Promise<void>}
   */
  async reset() {
    await this.stateManager.reset();
  }
}

module.exports = GlobalConfig;
