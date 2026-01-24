/**
 * File Scanner
 * 
 * Utility for scanning directories and detecting files based on patterns
 */

const fs = require('fs-extra');
const path = require('path');
const { minimatch } = require('minimatch');

class FileScanner {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }
  
  /**
   * Find all markdown files in a directory (non-recursive)
   * 
   * @param {string} dirPath - Directory path to scan
   * @returns {Promise<string[]>} - Array of absolute file paths
   */
  async findMarkdownFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const mdFiles = [];
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          mdFiles.push(path.join(dirPath, entry.name));
        }
      }
      
      return mdFiles;
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      return [];
    }
  }
  
  /**
   * Find all markdown files in a directory recursively
   * 
   * @param {string} dirPath - Directory path to scan
   * @param {Object} options - Scan options
   * @param {string[]} options.excludeDirs - Directory names to exclude (e.g., ['node_modules', '.git'])
   * @returns {Promise<string[]>} - Array of absolute file paths
   */
  async findMarkdownFilesRecursive(dirPath, options = {}) {
    const excludeDirs = options.excludeDirs || ['node_modules', '.git'];
    const mdFiles = [];
    
    try {
      await this._scanRecursive(dirPath, mdFiles, excludeDirs);
      return mdFiles;
    } catch (error) {
      // If directory doesn't exist or can't be read, return empty array
      return [];
    }
  }
  
  /**
   * Internal recursive scanning helper
   * 
   * @private
   */
  async _scanRecursive(dirPath, results, excludeDirs) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await this._scanRecursive(fullPath, results, excludeDirs);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
      return;
    }
  }
  
  /**
   * Match files against glob patterns
   * 
   * @param {string[]} filePaths - Array of file paths to check
   * @param {string[]} patterns - Array of glob patterns (e.g., ['*-SUMMARY.md', 'TEMP-*.md'])
   * @returns {string[]} - Array of matching file paths
   */
  matchPatterns(filePaths, patterns) {
    const matches = [];
    
    for (const filePath of filePaths) {
      const basename = path.basename(filePath);
      
      for (const pattern of patterns) {
        if (minimatch(basename, pattern, { nocase: false })) {
          matches.push(filePath);
          break; // Don't add the same file multiple times
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Check if a file matches any of the given patterns
   * 
   * @param {string} filePath - File path to check
   * @param {string[]} patterns - Array of glob patterns
   * @returns {boolean} - True if file matches any pattern
   */
  matchesPattern(filePath, patterns) {
    const basename = path.basename(filePath);
    
    for (const pattern of patterns) {
      if (minimatch(basename, pattern, { nocase: false })) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Find all Spec directories in the project
   * 
   * @returns {Promise<string[]>} - Array of Spec directory paths
   */
  async findSpecDirectories() {
    const specsPath = path.join(this.projectPath, '.kiro/specs');
    
    try {
      const entries = await fs.readdir(specsPath, { withFileTypes: true });
      const specDirs = [];
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          specDirs.push(path.join(specsPath, entry.name));
        }
      }
      
      return specDirs;
    } catch (error) {
      // If .kiro/specs doesn't exist, return empty array
      return [];
    }
  }
  
  /**
   * Get Spec directory by name
   * 
   * @param {string} specName - Spec name
   * @returns {string} - Spec directory path
   */
  getSpecDirectory(specName) {
    return path.join(this.projectPath, '.kiro/specs', specName);
  }
  
  /**
   * Check if a path exists
   * 
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} - True if path exists
   */
  async exists(filePath) {
    return await fs.pathExists(filePath);
  }
  
  /**
   * Check if a path is a directory
   * 
   * @param {string} dirPath - Path to check
   * @returns {Promise<boolean>} - True if path is a directory
   */
  async isDirectory(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if a path is a file
   * 
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} - True if path is a file
   */
  async isFile(filePath) {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get all files in a directory (non-recursive)
   * 
   * @param {string} dirPath - Directory path
   * @returns {Promise<string[]>} - Array of file paths
   */
  async getFiles(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = [];
      
      for (const entry of entries) {
        if (entry.isFile()) {
          files.push(path.join(dirPath, entry.name));
        }
      }
      
      return files;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get all subdirectories in a directory (non-recursive)
   * 
   * @param {string} dirPath - Directory path
   * @returns {Promise<string[]>} - Array of subdirectory paths
   */
  async getSubdirectories(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const dirs = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirs.push(path.join(dirPath, entry.name));
        }
      }
      
      return dirs;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Normalize path for cross-platform compatibility
   * 
   * @param {string} filePath - Path to normalize
   * @returns {string} - Normalized path
   */
  normalizePath(filePath) {
    // First replace all backslashes with forward slashes for consistency
    // Then use path.normalize to get platform-specific separators
    return path.normalize(filePath.replace(/\\/g, '/'));
  }
  
  /**
   * Get relative path from project root
   * 
   * @param {string} filePath - Absolute file path
   * @returns {string} - Relative path from project root
   */
  getRelativePath(filePath) {
    return path.relative(this.projectPath, filePath);
  }
  
  /**
   * Get absolute path from relative path
   * 
   * @param {string} relativePath - Relative path from project root
   * @returns {string} - Absolute path
   */
  getAbsolutePath(relativePath) {
    return path.join(this.projectPath, relativePath);
  }
}

module.exports = FileScanner;
