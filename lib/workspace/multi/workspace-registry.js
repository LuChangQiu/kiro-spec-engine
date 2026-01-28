const WorkspaceStateManager = require('./workspace-state-manager');

/**
 * WorkspaceRegistry - Facade for WorkspaceStateManager
 * 
 * Provides backward-compatible API for workspace registry operations.
 * All operations are delegated to WorkspaceStateManager which implements
 * the Data Atomicity Principle (single source of truth).
 * 
 * @deprecated This class is a compatibility layer. New code should use
 *             WorkspaceStateManager directly.
 */
class WorkspaceRegistry {
  /**
   * Create a new WorkspaceRegistry instance
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
   * @returns {string} Path to ~/.kse/workspace-state.json
   * @deprecated Use WorkspaceStateManager.getDefaultStatePath() instead
   */
  getDefaultConfigPath() {
    return this.stateManager.getDefaultStatePath();
  }

  /**
   * Load workspace registry from disk
   * 
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async load() {
    return await this.stateManager.load();
  }

  /**
   * Save workspace registry to disk
   * 
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    return await this.stateManager.save();
  }

  /**
   * Ensure registry is loaded before operations
   * 
   * @private
   */
  async ensureLoaded() {
    await this.stateManager.ensureLoaded();
  }

  /**
   * Validate that a path is a valid kse project directory
   * 
   * @param {string} workspacePath - Path to validate
   * @returns {Promise<boolean>} True if valid kse project
   */
  async validateWorkspacePath(workspacePath) {
    const fs = require('fs-extra');
    const path = require('path');
    
    try {
      // Check if path exists
      const exists = await fs.pathExists(workspacePath);
      if (!exists) {
        return false;
      }

      // Check if it's a directory
      const stats = await fs.stat(workspacePath);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check if .kiro directory exists
      const kiroPath = path.join(workspacePath, '.kiro');
      const kiroExists = await fs.pathExists(kiroPath);
      
      return kiroExists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new workspace entry
   * 
   * @param {string} name - Unique workspace name
   * @param {string} workspacePath - Path to workspace directory
   * @returns {Promise<Workspace>} Created workspace
   * @throws {Error} If name already exists or path is invalid
   */
  async createWorkspace(name, workspacePath) {
    return await this.stateManager.createWorkspace(name, workspacePath);
  }

  /**
   * Get a workspace by name
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<Workspace|null>} Workspace or null if not found
   */
  async getWorkspace(name) {
    return await this.stateManager.getWorkspace(name);
  }

  /**
   * List all registered workspaces
   * 
   * @returns {Promise<Array<Workspace>>} Array of workspaces
   */
  async listWorkspaces() {
    return await this.stateManager.listWorkspaces();
  }

  /**
   * Remove a workspace from the registry
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeWorkspace(name) {
    return await this.stateManager.removeWorkspace(name);
  }

  /**
   * Update the last accessed timestamp for a workspace
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if updated, false if not found
   */
  async updateLastAccessed(name) {
    await this.ensureLoaded();
    
    const workspace = await this.stateManager.getWorkspace(name);
    if (!workspace) {
      return false;
    }

    workspace.updateLastAccessed();
    await this.stateManager.save();

    return true;
  }

  /**
   * Find workspace that contains the given path
   * 
   * @param {string} targetPath - Path to search for
   * @returns {Promise<Workspace|null>} Workspace containing the path, or null
   */
  async findWorkspaceByPath(targetPath) {
    return await this.stateManager.findWorkspaceByPath(targetPath);
  }

  /**
   * Check if a workspace name exists
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if exists
   */
  async hasWorkspace(name) {
    return await this.stateManager.hasWorkspace(name);
  }

  /**
   * Get count of registered workspaces
   * 
   * @returns {Promise<number>} Number of workspaces
   */
  async count() {
    return await this.stateManager.count();
  }

  /**
   * Clear all workspaces (for testing purposes)
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    await this.stateManager.clear();
  }
}

module.exports = WorkspaceRegistry;
