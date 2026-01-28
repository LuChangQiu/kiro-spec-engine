const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Workspace = require('./workspace');

/**
 * WorkspaceRegistry - Manages the global registry of kse workspaces
 * 
 * Handles CRUD operations on workspace entries and persists them to
 * ~/.kse/workspaces.json. Validates workspace paths and ensures data integrity.
 */
class WorkspaceRegistry {
  /**
   * Create a new WorkspaceRegistry instance
   * 
   * @param {string} configPath - Path to workspaces.json (optional, defaults to ~/.kse/workspaces.json)
   */
  constructor(configPath = null) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.workspaces = new Map(); // name -> Workspace
    this.version = '1.0';
    this.loaded = false;
  }

  /**
   * Get the default configuration file path
   * 
   * @returns {string} Path to ~/.kse/workspaces.json
   */
  getDefaultConfigPath() {
    const homeDir = os.homedir();
    return path.join(homeDir, '.kse', 'workspaces.json');
  }

  /**
   * Load workspace registry from disk
   * 
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async load() {
    try {
      const exists = await fs.pathExists(this.configPath);
      
      if (!exists) {
        // Initialize with empty registry
        this.workspaces = new Map();
        this.loaded = true;
        return true;
      }

      const content = await fs.readFile(this.configPath, 'utf8');
      const data = JSON.parse(content);

      // Validate version
      if (data.version !== this.version) {
        console.warn(`Warning: Config version mismatch. Expected ${this.version}, got ${data.version}`);
      }

      // Load workspaces
      this.workspaces = new Map();
      if (data.workspaces && Array.isArray(data.workspaces)) {
        for (const workspaceData of data.workspaces) {
          const workspace = Workspace.fromDict(workspaceData);
          this.workspaces.set(workspace.name, workspace);
        }
      }

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
   * Save workspace registry to disk
   * 
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      await fs.ensureDir(configDir);

      // Serialize workspaces
      const workspacesArray = Array.from(this.workspaces.values()).map(ws => ws.toDict());

      const data = {
        version: this.version,
        workspaces: workspacesArray
      };

      // Write to file with pretty formatting
      await fs.writeFile(this.configPath, JSON.stringify(data, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      throw new Error(`Failed to save workspace registry: ${error.message}`);
    }
  }

  /**
   * Ensure registry is loaded before operations
   * 
   * @private
   */
  async ensureLoaded() {
    if (!this.loaded) {
      await this.load();
    }
  }

  /**
   * Validate that a path is a valid kse project directory
   * 
   * @param {string} workspacePath - Path to validate
   * @returns {Promise<boolean>} True if valid kse project
   */
  async validateWorkspacePath(workspacePath) {
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
    await this.ensureLoaded();

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Workspace name cannot be empty');
    }

    // Check for duplicate name
    if (this.workspaces.has(name)) {
      throw new Error(`Workspace "${name}" already exists`);
    }

    // Validate path
    const isValid = await this.validateWorkspacePath(workspacePath);
    if (!isValid) {
      throw new Error(`Path "${workspacePath}" is not a valid kse project directory. ` +
                     `Ensure it exists and contains a .kiro/ directory.`);
    }

    // Create workspace
    const workspace = new Workspace(name, workspacePath);
    this.workspaces.set(name, workspace);

    // Save to disk
    await this.save();

    return workspace;
  }

  /**
   * Get a workspace by name
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<Workspace|null>} Workspace or null if not found
   */
  async getWorkspace(name) {
    await this.ensureLoaded();
    return this.workspaces.get(name) || null;
  }

  /**
   * List all registered workspaces
   * 
   * @returns {Promise<Array<Workspace>>} Array of workspaces
   */
  async listWorkspaces() {
    await this.ensureLoaded();
    return Array.from(this.workspaces.values());
  }

  /**
   * Remove a workspace from the registry
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if removed, false if not found
   */
  async removeWorkspace(name) {
    await this.ensureLoaded();

    if (!this.workspaces.has(name)) {
      return false;
    }

    this.workspaces.delete(name);
    await this.save();

    return true;
  }

  /**
   * Update the last accessed timestamp for a workspace
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if updated, false if not found
   */
  async updateLastAccessed(name) {
    await this.ensureLoaded();

    const workspace = this.workspaces.get(name);
    if (!workspace) {
      return false;
    }

    workspace.updateLastAccessed();
    await this.save();

    return true;
  }

  /**
   * Find workspace that contains the given path
   * 
   * @param {string} targetPath - Path to search for
   * @returns {Promise<Workspace|null>} Workspace containing the path, or null
   */
  async findWorkspaceByPath(targetPath) {
    await this.ensureLoaded();

    const absolutePath = path.isAbsolute(targetPath) 
      ? targetPath 
      : path.resolve(targetPath);

    for (const workspace of this.workspaces.values()) {
      if (workspace.containsPath(absolutePath)) {
        return workspace;
      }
    }

    return null;
  }

  /**
   * Check if a workspace name exists
   * 
   * @param {string} name - Workspace name
   * @returns {Promise<boolean>} True if exists
   */
  async hasWorkspace(name) {
    await this.ensureLoaded();
    return this.workspaces.has(name);
  }

  /**
   * Get count of registered workspaces
   * 
   * @returns {Promise<number>} Number of workspaces
   */
  async count() {
    await this.ensureLoaded();
    return this.workspaces.size;
  }

  /**
   * Clear all workspaces (for testing purposes)
   * 
   * @returns {Promise<void>}
   */
  async clear() {
    await this.ensureLoaded();
    this.workspaces.clear();
    await this.save();
  }
}

module.exports = WorkspaceRegistry;
