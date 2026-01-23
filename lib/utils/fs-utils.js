/**
 * File System Utilities
 * 
 * Provides safe, atomic file operations for the adoption/upgrade system.
 * Implements path validation, atomic writes, and error handling.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * Validates that a file path is within the project directory
 * Prevents path traversal attacks
 * 
 * @param {string} projectPath - Absolute path to project root
 * @param {string} filePath - Relative or absolute file path to validate
 * @returns {string} - Validated absolute path
 * @throws {Error} - If path traversal is detected
 */
function validatePath(projectPath, filePath) {
  const resolvedProject = path.resolve(projectPath);
  const resolvedFile = path.resolve(projectPath, filePath);
  
  if (!resolvedFile.startsWith(resolvedProject)) {
    throw new Error(`Path traversal detected: ${filePath} is outside project directory`);
  }
  
  return resolvedFile;
}

/**
 * Atomically writes content to a file
 * Uses temp file + rename for atomicity
 * 
 * @param {string} filePath - Absolute path to target file
 * @param {string} content - Content to write
 * @returns {Promise<void>}
 */
async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf8');
    
    // Atomic rename (on most systems)
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    throw new Error(`Failed to write file atomically: ${error.message}`);
  }
}

/**
 * Safely copies a file with error handling
 * Creates parent directories if needed
 * 
 * @param {string} sourcePath - Absolute path to source file
 * @param {string} destPath - Absolute path to destination file
 * @param {Object} options - Copy options
 * @param {boolean} options.overwrite - Whether to overwrite existing file (default: false)
 * @returns {Promise<void>}
 */
async function safeCopy(sourcePath, destPath, options = {}) {
  const { overwrite = false } = options;
  
  try {
    // Check if source exists
    const sourceExists = await fs.pathExists(sourcePath);
    if (!sourceExists) {
      throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    
    // Check if destination exists
    const destExists = await fs.pathExists(destPath);
    if (destExists && !overwrite) {
      throw new Error(`Destination file already exists: ${destPath}`);
    }
    
    // Ensure parent directory exists
    const parentDir = path.dirname(destPath);
    await fs.ensureDir(parentDir);
    
    // Copy file
    await fs.copy(sourcePath, destPath, { overwrite });
  } catch (error) {
    throw new Error(`Failed to copy file: ${error.message}`);
  }
}

/**
 * Recursively creates a directory
 * Safe to call even if directory already exists
 * 
 * @param {string} dirPath - Absolute path to directory
 * @returns {Promise<void>}
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    throw new Error(`Failed to create directory: ${error.message}`);
  }
}

/**
 * Recursively copies a directory
 * 
 * @param {string} sourceDir - Absolute path to source directory
 * @param {string} destDir - Absolute path to destination directory
 * @param {Object} options - Copy options
 * @param {boolean} options.overwrite - Whether to overwrite existing files (default: false)
 * @param {Function} options.filter - Filter function (path) => boolean
 * @returns {Promise<void>}
 */
async function copyDirectory(sourceDir, destDir, options = {}) {
  const { overwrite = false, filter = null } = options;
  
  try {
    await fs.copy(sourceDir, destDir, {
      overwrite,
      filter: filter || (() => true)
    });
  } catch (error) {
    throw new Error(`Failed to copy directory: ${error.message}`);
  }
}

/**
 * Checks if a path exists
 * 
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  return fs.pathExists(filePath);
}

/**
 * Reads a JSON file safely
 * 
 * @param {string} filePath - Absolute path to JSON file
 * @returns {Promise<Object>} - Parsed JSON object
 * @throws {Error} - If file doesn't exist or JSON is invalid
 */
async function readJSON(filePath) {
  try {
    return await fs.readJSON(filePath);
  } catch (error) {
    throw new Error(`Failed to read JSON file: ${error.message}`);
  }
}

/**
 * Writes a JSON file atomically
 * 
 * @param {string} filePath - Absolute path to JSON file
 * @param {Object} data - Data to write
 * @param {Object} options - Write options
 * @param {number} options.spaces - Number of spaces for indentation (default: 2)
 * @returns {Promise<void>}
 */
async function writeJSON(filePath, data, options = {}) {
  const { spaces = 2 } = options;
  const content = JSON.stringify(data, null, spaces);
  await atomicWrite(filePath, content);
}

/**
 * Removes a file or directory
 * 
 * @param {string} targetPath - Path to remove
 * @returns {Promise<void>}
 */
async function remove(targetPath) {
  try {
    await fs.remove(targetPath);
  } catch (error) {
    throw new Error(`Failed to remove path: ${error.message}`);
  }
}

/**
 * Gets file stats
 * 
 * @param {string} filePath - Path to file
 * @returns {Promise<fs.Stats>}
 */
async function getStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
}

/**
 * Lists files in a directory
 * 
 * @param {string} dirPath - Path to directory
 * @returns {Promise<string[]>} - Array of file names
 */
async function listFiles(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    throw new Error(`Failed to list directory: ${error.message}`);
  }
}

/**
 * Recursively lists all files in a directory
 * 
 * @param {string} dirPath - Path to directory
 * @param {string[]} fileList - Accumulator for recursive calls
 * @returns {Promise<string[]>} - Array of absolute file paths
 */
async function listFilesRecursive(dirPath, fileList = []) {
  const files = await fs.readdir(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      await listFilesRecursive(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Calculates total size of a directory
 * 
 * @param {string} dirPath - Path to directory
 * @returns {Promise<number>} - Total size in bytes
 */
async function getDirectorySize(dirPath) {
  const files = await listFilesRecursive(dirPath);
  let totalSize = 0;
  
  for (const file of files) {
    const stats = await fs.stat(file);
    totalSize += stats.size;
  }
  
  return totalSize;
}

module.exports = {
  validatePath,
  atomicWrite,
  safeCopy,
  ensureDirectory,
  copyDirectory,
  pathExists,
  readJSON,
  writeJSON,
  remove,
  getStats,
  listFiles,
  listFilesRecursive,
  getDirectorySize
};
