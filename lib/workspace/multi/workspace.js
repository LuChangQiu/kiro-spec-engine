const PathUtils = require('./path-utils');

/**
 * Workspace - Data model for a registered kse project workspace
 * 
 * Represents a single workspace entry in the workspace registry.
 * Each workspace has a unique name, absolute path, and timestamps.
 */
class Workspace {
  /**
   * Create a new Workspace instance
   * 
   * @param {string} name - Unique workspace name
   * @param {string} workspacePath - Absolute path to the workspace directory
   * @param {Date|string} createdAt - Creation timestamp (optional, defaults to now)
   * @param {Date|string} lastAccessed - Last accessed timestamp (optional, defaults to now)
   */
  constructor(name, workspacePath, createdAt = null, lastAccessed = null) {
    this.name = name;
    this.path = PathUtils.normalize(workspacePath);
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.lastAccessed = lastAccessed ? new Date(lastAccessed) : new Date();
  }

  /**
   * Get platform-specific path for runtime use
   * 
   * @returns {string} Platform-specific path
   */
  getPlatformPath() {
    return PathUtils.toPlatform(this.path);
  }

  /**
   * Serialize workspace to JSON-compatible object
   * 
   * @returns {Object} Serialized workspace data
   */
  toDict() {
    return {
      name: this.name,
      path: this.path,
      createdAt: this.createdAt.toISOString(),
      lastAccessed: this.lastAccessed.toISOString()
    };
  }

  /**
   * Deserialize workspace from JSON-compatible object
   * 
   * @param {Object} data - Serialized workspace data
   * @returns {Workspace} Workspace instance
   */
  static fromDict(data) {
    return new Workspace(
      data.name,
      data.path,
      data.createdAt,
      data.lastAccessed
    );
  }

  /**
   * Update last accessed timestamp to current time
   */
  updateLastAccessed() {
    this.lastAccessed = new Date();
  }

  /**
   * Check if this workspace path matches or contains the given path
   * 
   * @param {string} targetPath - Path to check
   * @returns {boolean} True if targetPath is within this workspace
   */
  containsPath(targetPath) {
    return PathUtils.isWithin(targetPath, this.path);
  }

  /**
   * Get a string representation of the workspace
   * 
   * @returns {string} String representation
   */
  toString() {
    return `Workspace(name="${this.name}", path="${this.path}")`;
  }
}

module.exports = Workspace;
