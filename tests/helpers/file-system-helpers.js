/**
 * File System Helpers
 * 
 * Provides utilities for handling file system operations in tests,
 * ensuring proper synchronization and avoiding timing-related issues.
 */

const fs = require('fs-extra');
const path = require('path');
const { waitForCondition } = require('./async-wait-helpers');

/**
 * Wait for a file to change (modification time)
 * 
 * @param {string} filePath - Path to the file to monitor
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait (default: 5000)
 * @param {number} options.interval - Check interval (default: 100)
 * @returns {Promise<Object>} - Resolves with new file stats
 * 
 * @example
 * await waitForFileChange('./test-file.txt', { timeout: 3000 });
 */
async function waitForFileChange(filePath, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;

  // Get initial stats
  let initialStats;
  try {
    initialStats = await fs.stat(filePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Wait for modification time to change
  await waitForCondition(
    async () => {
      try {
        const currentStats = await fs.stat(filePath);
        return currentStats.mtimeMs !== initialStats.mtimeMs;
      } catch (error) {
        return false;
      }
    },
    {
      timeout,
      interval,
      message: `File "${filePath}" did not change within ${timeout}ms`
    }
  );

  return fs.stat(filePath);
}

/**
 * Wait for a file to exist
 * 
 * @param {string} filePath - Path to the file
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait (default: 5000)
 * @param {number} options.interval - Check interval (default: 100)
 * @returns {Promise<boolean>} - Resolves when file exists
 * 
 * @example
 * await waitForFileExists('./new-file.txt', { timeout: 2000 });
 */
async function waitForFileExists(filePath, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;

  return waitForCondition(
    async () => {
      try {
        await fs.access(filePath);
        return true;
      } catch (error) {
        return false;
      }
    },
    {
      timeout,
      interval,
      message: `File "${filePath}" did not appear within ${timeout}ms`
    }
  );
}

/**
 * Wait for a file to be deleted
 * 
 * @param {string} filePath - Path to the file
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait (default: 5000)
 * @param {number} options.interval - Check interval (default: 100)
 * @returns {Promise<boolean>} - Resolves when file is deleted
 * 
 * @example
 * await waitForFileDeleted('./temp-file.txt', { timeout: 2000 });
 */
async function waitForFileDeleted(filePath, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;

  return waitForCondition(
    async () => {
      try {
        await fs.access(filePath);
        return false; // File still exists
      } catch (error) {
        return true; // File doesn't exist (deleted)
      }
    },
    {
      timeout,
      interval,
      message: `File "${filePath}" was not deleted within ${timeout}ms`
    }
  );
}

/**
 * Wait for file content to match a condition
 * 
 * @param {string} filePath - Path to the file
 * @param {Function} predicate - Function that receives file content and returns boolean
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait (default: 5000)
 * @param {number} options.interval - Check interval (default: 100)
 * @param {string} options.encoding - File encoding (default: 'utf-8')
 * @returns {Promise<string>} - Resolves with file content when condition is met
 * 
 * @example
 * await waitForFileContent('./log.txt', content => content.includes('SUCCESS'));
 */
async function waitForFileContent(filePath, predicate, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const encoding = options.encoding || 'utf-8';

  let lastContent = '';

  await waitForCondition(
    async () => {
      try {
        lastContent = await fs.readFile(filePath, encoding);
        return predicate(lastContent);
      } catch (error) {
        return false;
      }
    },
    {
      timeout,
      interval,
      message: `File content condition not met within ${timeout}ms`
    }
  );

  return lastContent;
}

/**
 * Ensure file system operations have completed
 * 
 * Adds a small delay to ensure file system events have propagated.
 * Useful after file operations before making assertions.
 * 
 * @param {number} delay - Delay in milliseconds (default: 100)
 * @returns {Promise<void>}
 * 
 * @example
 * await fs.writeFile('./test.txt', 'content');
 * await ensureFileSystemSync();
 * // Now safe to check file system state
 */
async function ensureFileSystemSync(delay = 100) {
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Create a temporary directory for test isolation
 * 
 * @param {string} prefix - Prefix for temp directory name (default: 'test-')
 * @returns {Promise<string>} - Path to created temp directory
 * 
 * @example
 * const tempDir = await createTempDir('my-test-');
 * // Use tempDir for test operations
 * await fs.remove(tempDir); // Clean up
 */
async function createTempDir(prefix = 'test-') {
  const tempDir = path.join(
    require('os').tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).substring(7)}`
  );
  
  await fs.ensureDir(tempDir);
  return tempDir;
}

/**
 * Clean up a temporary directory
 * 
 * @param {string} dirPath - Path to directory to remove
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum cleanup attempts (default: 3)
 * @param {number} options.retryDelay - Delay between retries (default: 100)
 * @returns {Promise<void>}
 * 
 * @example
 * await cleanupTempDir(tempDir);
 */
async function cleanupTempDir(dirPath, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 100;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.remove(dirPath);
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // Log warning but don't fail test
        console.warn(`Warning: Could not clean up temp directory: ${dirPath}`);
      }
    }
  }
}

/**
 * Wait for directory to contain a specific number of files
 * 
 * @param {string} dirPath - Path to directory
 * @param {number} expectedCount - Expected number of files
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Maximum time to wait (default: 5000)
 * @param {number} options.interval - Check interval (default: 100)
 * @param {boolean} options.recursive - Count files recursively (default: false)
 * @returns {Promise<Array<string>>} - Resolves with array of file paths
 * 
 * @example
 * await waitForFileCount('./output', 5, { timeout: 3000 });
 */
async function waitForFileCount(dirPath, expectedCount, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const recursive = options.recursive || false;

  let files = [];

  await waitForCondition(
    async () => {
      try {
        if (recursive) {
          files = await getAllFiles(dirPath);
        } else {
          const entries = await fs.readdir(dirPath);
          files = [];
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
              files.push(fullPath);
            }
          }
        }
        return files.length === expectedCount;
      } catch (error) {
        return false;
      }
    },
    {
      timeout,
      interval,
      message: `Directory "${dirPath}" did not contain ${expectedCount} files within ${timeout}ms`
    }
  );

  return files;
}

/**
 * Get all files in a directory recursively
 * 
 * @param {string} dirPath - Path to directory
 * @returns {Promise<Array<string>>} - Array of file paths
 */
async function getAllFiles(dirPath) {
  const files = [];
  
  async function scan(dir) {
    const entries = await fs.readdir(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await scan(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  await scan(dirPath);
  return files;
}

/**
 * Copy file with retry logic for flaky file systems
 * 
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @param {Object} options - Configuration options
 * @returns {Promise<void>}
 * 
 * @example
 * await copyFileWithRetry('./source.txt', './dest.txt');
 */
async function copyFileWithRetry(src, dest, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 100;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.copy(src, dest);
      await ensureFileSystemSync();
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
}

module.exports = {
  waitForFileChange,
  waitForFileExists,
  waitForFileDeleted,
  waitForFileContent,
  ensureFileSystemSync,
  createTempDir,
  cleanupTempDir,
  waitForFileCount,
  getAllFiles,
  copyFileWithRetry
};
