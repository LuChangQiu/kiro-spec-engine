/**
 * PathUtils - Cross-platform path handling utilities
 * 
 * Provides utilities for normalizing and converting paths across platforms.
 * Implements the data atomicity principle by ensuring paths are stored
 * in a consistent format and converted at runtime.
 */

const path = require('path');
const os = require('os');

class PathUtils {
  /**
   * Normalize path to use forward slashes for storage
   * 
   * All paths are stored with forward slashes for cross-platform compatibility.
   * This ensures the configuration files are portable across Windows, Linux, and Mac.
   * 
   * @param {string} inputPath - Path to normalize
   * @returns {string} Normalized path with forward slashes
   */
  static normalize(inputPath) {
    if (!inputPath || typeof inputPath !== 'string' || inputPath.trim().length === 0) {
      throw new Error('Path must be a non-empty string');
    }

    // Expand home directory first
    const expandedPath = this.expandHome(inputPath);

    // Convert to absolute path if not already
    const absolutePath = path.isAbsolute(expandedPath) 
      ? expandedPath 
      : path.resolve(expandedPath);
    
    // Replace backslashes with forward slashes for storage
    return absolutePath.replace(/\\/g, '/');
  }

  /**
   * Convert stored path to platform-specific format for runtime use
   * 
   * @param {string} storedPath - Path with forward slashes (from storage)
   * @returns {string} Platform-specific path
   */
  static toPlatform(storedPath) {
    if (storedPath === null) {
      return null;
    }
    
    if (!storedPath) {
      return '';
    }

    // Convert forward slashes to platform-specific separators
    return storedPath.split('/').join(path.sep);
  }

  /**
   * Expand home directory (~) to absolute path
   * 
   * @param {string} inputPath - Path that may contain ~
   * @returns {string} Expanded absolute path
   */
  static expandHome(inputPath) {
    if (inputPath === null) {
      return null;
    }
    
    if (inputPath === undefined) {
      return undefined;
    }
    
    if (!inputPath) {
      return '';
    }

    if (inputPath.startsWith('~/') || inputPath.startsWith('~\\') || inputPath === '~') {
      return path.join(os.homedir(), inputPath.slice(2));
    }

    return inputPath;
  }

  /**
   * Get the default kse configuration directory
   * 
   * @returns {string} Path to ~/.kse directory
   */
  static getConfigDir() {
    return path.join(os.homedir(), '.kse');
  }

  /**
   * Get the default workspace state file path
   * 
   * @returns {string} Path to ~/.kse/workspace-state.json
   */
  static getWorkspaceStatePath() {
    return path.join(this.getConfigDir(), 'workspace-state.json');
  }

  /**
   * Check if a path is within another path
   * 
   * @param {string} childPath - Path to check
   * @param {string} parentPath - Parent path
   * @returns {boolean} True if childPath is within parentPath
   */
  static isWithin(childPath, parentPath) {
    const normalizedChild = this.normalize(childPath);
    const normalizedParent = this.normalize(parentPath);
    
    return normalizedChild === normalizedParent || 
           normalizedChild.startsWith(normalizedParent + '/');
  }

  /**
   * Get relative path from parent to child
   * 
   * @param {string} from - Parent path
   * @param {string} to - Child path
   * @returns {string} Relative path with forward slashes
   */
  static relative(from, to) {
    const relativePath = path.relative(from, to);
    return relativePath.replace(/\\/g, '/');
  }

  /**
   * Join path segments
   * 
   * @param {...string} segments - Path segments to join
   * @returns {string} Joined path with forward slashes
   */
  static join(...segments) {
    const joinedPath = path.join(...segments);
    return joinedPath.replace(/\\/g, '/');
  }

  /**
   * Get directory name from path
   * 
   * @param {string} filePath - File path
   * @returns {string} Directory name with forward slashes
   */
  static dirname(filePath) {
    const dirPath = path.dirname(filePath);
    return dirPath.replace(/\\/g, '/');
  }

  /**
   * Get base name from path
   * 
   * @param {string} filePath - File path
   * @param {string} ext - Optional extension to remove
   * @returns {string} Base name
   */
  static basename(filePath, ext) {
    return path.basename(filePath, ext);
  }

  /**
   * Get file extension from path
   * 
   * @param {string} filePath - File path
   * @returns {string} File extension (including the dot)
   */
  static extname(filePath) {
    return path.extname(filePath);
  }
}

module.exports = PathUtils;
