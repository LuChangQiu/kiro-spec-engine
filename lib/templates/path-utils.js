/**
 * Path Utilities
 * 
 * Platform-independent path handling utilities for template operations.
 */

const path = require('path');
const os = require('os');

/**
 * Normalize path to use forward slashes and resolve home directory
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized path
 */
function normalize(filePath) {
  if (!filePath) {
    throw new Error('Path cannot be empty');
  }
  
  // Expand home directory
  let normalized = expandHome(filePath);
  
  // Convert to absolute path if relative
  if (!path.isAbsolute(normalized)) {
    normalized = path.resolve(normalized);
  }
  
  // Convert backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');
  
  return normalized;
}

/**
 * Expand ~ to home directory
 * @param {string} filePath - Path that may contain ~
 * @returns {string} Path with ~ expanded
 */
function expandHome(filePath) {
  if (!filePath) return filePath;
  
  if (filePath === '~' || filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  
  return filePath;
}

/**
 * Get the default template cache directory
 * @returns {string} Path to cache directory
 */
function getDefaultCacheDir() {
  return normalize(path.join(os.homedir(), '.sce', 'templates'));
}

/**
 * Get the cache directory for a specific source
 * @param {string} sourceName - Name of the template source
 * @returns {string} Path to source cache directory
 */
function getSourceCacheDir(sourceName) {
  return normalize(path.join(getDefaultCacheDir(), sourceName));
}

/**
 * Get the path to cache metadata file
 * @returns {string} Path to metadata file
 */
function getCacheMetadataPath() {
  return normalize(path.join(getDefaultCacheDir(), '.cache-metadata.json'));
}

/**
 * Get the path to sources configuration file
 * @returns {string} Path to sources file
 */
function getSourcesConfigPath() {
  return normalize(path.join(getDefaultCacheDir(), '.sources.json'));
}

/**
 * Join path segments using forward slashes
 * @param {...string} segments - Path segments to join
 * @returns {string} Joined path
 */
function join(...segments) {
  return path.join(...segments).replace(/\\/g, '/');
}

/**
 * Get the directory name of a path
 * @param {string} filePath - File path
 * @returns {string} Directory name
 */
function dirname(filePath) {
  return path.dirname(filePath).replace(/\\/g, '/');
}

/**
 * Get the base name of a path
 * @param {string} filePath - File path
 * @param {string} ext - Optional extension to remove
 * @returns {string} Base name
 */
function basename(filePath, ext) {
  return path.basename(filePath, ext);
}

/**
 * Get the extension of a path
 * @param {string} filePath - File path
 * @returns {string} Extension (including dot)
 */
function extname(filePath) {
  return path.extname(filePath);
}

/**
 * Check if a path is within another path
 * @param {string} child - Child path
 * @param {string} parent - Parent path
 * @returns {boolean} True if child is within parent
 */
function isWithin(child, parent) {
  const childNorm = normalize(child);
  const parentNorm = normalize(parent);
  
  return childNorm.startsWith(parentNorm + '/') || childNorm === parentNorm;
}

module.exports = {
  normalize,
  expandHome,
  getDefaultCacheDir,
  getSourceCacheDir,
  getCacheMetadataPath,
  getSourcesConfigPath,
  join,
  dirname,
  basename,
  extname,
  isWithin
};
