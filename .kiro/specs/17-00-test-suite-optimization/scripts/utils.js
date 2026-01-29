/**
 * Shared utility functions for test suite optimization
 */

const fs = require('fs-extra');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Read and parse a JavaScript file into an AST
 * @param {string} filePath - Path to the JavaScript file
 * @returns {Promise<Object>} Parsed AST
 */
async function parseJavaScriptFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    return ast;
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
}

/**
 * Find all JavaScript files in a directory
 * @param {string} dirPath - Directory path
 * @param {Object} options - Options
 * @param {boolean} options.recursive - Search recursively
 * @param {string[]} options.exclude - Directories to exclude
 * @returns {Promise<string[]>} Array of file paths
 */
async function findJavaScriptFiles(dirPath, options = {}) {
  const { recursive = true, exclude = ['node_modules', '.git', 'coverage'] } = options;
  const files = [];

  async function scan(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (recursive && !exclude.includes(entry.name)) {
          await scan(fullPath);
        }
      } else if (entry.isFile() && /\.js$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Extract test cases from a test file AST
 * @param {Object} ast - Parsed AST
 * @returns {Array} Array of test case information
 */
function extractTestCases(ast) {
  const testCases = [];
  
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      
      // Match it(), test(), describe()
      if (callee.type === 'Identifier' && 
          ['it', 'test', 'describe'].includes(callee.name)) {
        const args = path.node.arguments;
        if (args.length > 0 && args[0].type === 'StringLiteral') {
          testCases.push({
            type: callee.name,
            name: args[0].value,
            loc: path.node.loc
          });
        }
      }
    }
  });
  
  return testCases;
}

/**
 * Count assertions in a test file AST
 * @param {Object} ast - Parsed AST
 * @returns {number} Number of assertions
 */
function countAssertions(ast) {
  let count = 0;
  
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      
      // Match expect().xxx() pattern
      if (callee.type === 'MemberExpression' &&
          callee.object.type === 'CallExpression' &&
          callee.object.callee.name === 'expect') {
        count++;
      }
    }
  });
  
  return count;
}

/**
 * Load configuration from file
 * @param {string} configPath - Path to config file
 * @returns {Promise<Object>} Configuration object
 */
async function loadConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
  }
}

/**
 * Normalize path to use forward slashes
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * Get relative path from project root
 * @param {string} filePath - Absolute file path
 * @param {string} rootPath - Project root path
 * @returns {string} Relative path
 */
function getRelativePath(filePath, rootPath) {
  return normalizePath(path.relative(rootPath, filePath));
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Write JSON file with formatting
 * @param {string} filePath - File path
 * @param {Object} data - Data to write
 * @returns {Promise<void>}
 */
async function writeJsonFile(filePath, data) {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * Calculate percentage
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
function calculatePercentage(part, total) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 100) / 100;
}

module.exports = {
  parseJavaScriptFile,
  findJavaScriptFiles,
  extractTestCases,
  countAssertions,
  loadConfig,
  normalizePath,
  getRelativePath,
  ensureDir,
  writeJsonFile,
  calculatePercentage
};
