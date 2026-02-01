const path = require('path');

/**
 * PathResolver handles cross-platform path resolution and validation
 * for repository paths. It ensures consistent path handling across
 * Windows, Linux, and Mac platforms.
 */
class PathResolver {
  /**
   * Resolve repository path relative to project root
   * @param {string} repoPath - The repository path (relative or absolute)
   * @param {string} projectRoot - The project root directory
   * @returns {string} Resolved absolute path
   */
  resolvePath(repoPath, projectRoot) {
    if (!repoPath) {
      throw new Error('Repository path cannot be empty');
    }
    if (!projectRoot) {
      throw new Error('Project root cannot be empty');
    }

    // If path is absolute, return normalized version
    if (this.isAbsolute(repoPath)) {
      return this.normalizePath(path.resolve(repoPath));
    }

    // Resolve relative path against project root
    return this.normalizePath(path.resolve(projectRoot, repoPath));
  }

  /**
   * Normalize path to use forward slashes consistently
   * @param {string} pathStr - The path to normalize
   * @returns {string} Normalized path with forward slashes
   */
  normalizePath(pathStr) {
    if (!pathStr) {
      return pathStr;
    }

    // Normalize the path first (resolves . and ..)
    let normalized = path.normalize(pathStr);

    // Convert backslashes to forward slashes
    normalized = normalized.replace(/\\/g, '/');

    // Handle Windows drive letters - keep them uppercase
    if (this._isWindowsPath(normalized)) {
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    // Remove trailing slashes (except for root paths)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      // Don't remove trailing slash from root paths like '/' or 'C:/'
      if (!(normalized.length === 3 && this._isWindowsPath(normalized))) {
        normalized = normalized.slice(0, -1);
      }
    }

    return normalized;
  }

  /**
   * Check if path is absolute
   * @param {string} pathStr - The path to check
   * @returns {boolean} True if path is absolute
   */
  isAbsolute(pathStr) {
    if (!pathStr) {
      return false;
    }
    
    // Check for Windows absolute paths (C:/ or C:\)
    if (this._isWindowsPath(pathStr)) {
      return true;
    }
    
    // Check for Unix absolute paths (starts with /)
    return path.isAbsolute(pathStr);
  }

  /**
   * Convert absolute path to relative path
   * @param {string} absolutePath - The absolute path
   * @param {string} basePath - The base path to make it relative to
   * @returns {string} Relative path
   */
  toRelative(absolutePath, basePath) {
    if (!absolutePath || !basePath) {
      throw new Error('Both absolutePath and basePath are required');
    }

    const relativePath = path.relative(basePath, absolutePath);
    return this.normalizePath(relativePath);
  }

  /**
   * Validate that paths don't overlap or nest within each other
   * @param {string[]} paths - Array of absolute paths to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validateNoOverlap(paths) {
    const errors = [];

    if (!Array.isArray(paths)) {
      return { valid: false, errors: ['Paths must be an array'] };
    }

    if (paths.length === 0) {
      return { valid: true, errors: [] };
    }

    // Normalize all paths for comparison
    const normalizedPaths = paths.map(p => this.normalizePath(p));

    // Check for duplicates
    const seen = new Set();
    for (let i = 0; i < normalizedPaths.length; i++) {
      const p = normalizedPaths[i];
      if (seen.has(p)) {
        errors.push(`Duplicate path found: ${paths[i]}`);
      }
      seen.add(p);
    }

    // Check for overlapping/nested paths
    for (let i = 0; i < normalizedPaths.length; i++) {
      for (let j = i + 1; j < normalizedPaths.length; j++) {
        const path1 = normalizedPaths[i];
        const path2 = normalizedPaths[j];

        // Check if path2 is nested within path1
        if (this._isNestedPath(path2, path1)) {
          errors.push(`Path "${paths[j]}" is nested within "${paths[i]}"`);
        }
        // Check if path1 is nested within path2
        else if (this._isNestedPath(path1, path2)) {
          errors.push(`Path "${paths[i]}" is nested within "${paths[j]}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a path is nested within another path
   * @private
   * @param {string} childPath - The potential child path
   * @param {string} parentPath - The potential parent path
   * @returns {boolean} True if childPath is nested within parentPath
   */
  _isNestedPath(childPath, parentPath) {
    // Ensure paths end with separator for accurate comparison
    const normalizedParent = parentPath.endsWith('/') ? parentPath : parentPath + '/';
    return childPath.startsWith(normalizedParent);
  }

  /**
   * Check if path is a Windows path (has drive letter)
   * @private
   * @param {string} pathStr - The path to check
   * @returns {boolean} True if path is a Windows path
   */
  _isWindowsPath(pathStr) {
    // Check for drive letter pattern: C:/ or C:\
    return /^[a-zA-Z]:/.test(pathStr);
  }
}

module.exports = PathResolver;
