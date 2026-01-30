/**
 * CacheManager - Manages local template cache
 * 
 * Handles cache directory structure, metadata storage, and cache operations.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { FileSystemError } = require('./template-error');

class CacheManager {
  constructor(cacheDir = null) {
    // Default cache directory: ~/.kse/templates/
    this.cacheDir = cacheDir || path.join(os.homedir(), '.kse', 'templates');
    this.metadataFile = path.join(this.cacheDir, '.cache-metadata.json');
    this.sourcesFile = path.join(this.cacheDir, '.sources.json');
  }

  /**
   * Gets the cache directory path
   * 
   * @returns {string} Cache directory path
   */
  getCacheDir() {
    return this.cacheDir;
  }

  /**
   * Gets the cache path for a specific source
   * 
   * @param {string} sourceName - Source name (e.g., 'official')
   * @returns {string} Source cache path
   */
  getSourceCachePath(sourceName) {
    return path.join(this.cacheDir, sourceName);
  }

  /**
   * Ensures cache directory exists
   * 
   * @returns {Promise<void>}
   */
  async ensureCacheDir() {
    try {
      await fs.ensureDir(this.cacheDir);
    } catch (error) {
      throw new FileSystemError(
        'Failed to create cache directory',
        {
          path: this.cacheDir,
          error: error.message
        }
      );
    }
  }

  /**
   * Checks if cache exists for a source
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<boolean>}
   */
  async cacheExists(sourceName) {
    const sourcePath = this.getSourceCachePath(sourceName);
    return await fs.pathExists(sourcePath);
  }

  /**
   * Gets cache metadata
   * 
   * @returns {Promise<Object>} Cache metadata
   */
  async getMetadata() {
    if (!await fs.pathExists(this.metadataFile)) {
      return {
        sources: {},
        last_check: null
      };
    }

    try {
      const metadata = await fs.readJson(this.metadataFile);
      return metadata;
    } catch (error) {
      // If metadata is corrupted, return empty metadata
      return {
        sources: {},
        last_check: null
      };
    }
  }

  /**
   * Updates cache metadata for a source
   * 
   * @param {string} sourceName - Source name
   * @param {Object} sourceMetadata - Source metadata
   * @returns {Promise<void>}
   */
  async updateMetadata(sourceName, sourceMetadata) {
    await this.ensureCacheDir();

    const metadata = await this.getMetadata();
    
    metadata.sources[sourceName] = {
      ...sourceMetadata,
      last_updated: new Date().toISOString()
    };
    
    metadata.last_check = new Date().toISOString();

    try {
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });
    } catch (error) {
      throw new FileSystemError(
        'Failed to update cache metadata',
        {
          path: this.metadataFile,
          error: error.message
        }
      );
    }
  }

  /**
   * Gets metadata for a specific source
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<Object|null>} Source metadata or null
   */
  async getSourceMetadata(sourceName) {
    const metadata = await this.getMetadata();
    return metadata.sources[sourceName] || null;
  }

  /**
   * Calculates cache size for a source
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<number>} Size in bytes
   */
  async getCacheSize(sourceName) {
    const sourcePath = this.getSourceCachePath(sourceName);
    
    if (!await fs.pathExists(sourcePath)) {
      return 0;
    }

    return await this._calculateDirectorySize(sourcePath);
  }

  /**
   * Calculates total cache size
   * 
   * @returns {Promise<number>} Total size in bytes
   */
  async getTotalCacheSize() {
    if (!await fs.pathExists(this.cacheDir)) {
      return 0;
    }

    return await this._calculateDirectorySize(this.cacheDir);
  }

  /**
   * Helper: Recursively calculates directory size
   * 
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} Size in bytes
   * @private
   */
  async _calculateDirectorySize(dirPath) {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          totalSize += await this._calculateDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors for individual files
    }

    return totalSize;
  }

  /**
   * Gets cache information
   * 
   * @param {string} sourceName - Source name (optional)
   * @returns {Promise<Object>} Cache info
   */
  async getCacheInfo(sourceName = null) {
    if (sourceName) {
      // Get info for specific source
      const exists = await this.cacheExists(sourceName);
      const metadata = await this.getSourceMetadata(sourceName);
      const size = await this.getCacheSize(sourceName);

      return {
        source: sourceName,
        exists,
        size,
        metadata
      };
    } else {
      // Get info for all sources
      const metadata = await this.getMetadata();
      const totalSize = await getTotalCacheSize();

      return {
        cacheDir: this.cacheDir,
        totalSize,
        sources: metadata.sources,
        lastCheck: metadata.last_check
      };
    }
  }

  /**
   * Formats size in human-readable format
   * 
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Checks if cache is stale
   * 
   * @param {string} sourceName - Source name
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   * @returns {Promise<boolean>} True if cache is stale
   */
  async isStale(sourceName, maxAge = 7 * 24 * 60 * 60 * 1000) {
    const metadata = await this.getSourceMetadata(sourceName);
    
    if (!metadata || !metadata.last_updated) {
      return true;
    }

    const lastUpdated = new Date(metadata.last_updated);
    const now = new Date();
    const age = now - lastUpdated;

    return age > maxAge;
  }

  /**
   * Validates cache integrity
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<Object>} Validation result
   */
  async validateCache(sourceName) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check if cache exists
    if (!await this.cacheExists(sourceName)) {
      result.valid = false;
      result.errors.push('Cache does not exist');
      return result;
    }

    const sourcePath = this.getSourceCachePath(sourceName);

    // Check if template-registry.json exists
    const registryPath = path.join(sourcePath, 'template-registry.json');
    if (!await fs.pathExists(registryPath)) {
      result.valid = false;
      result.errors.push('Missing template-registry.json');
    }

    // Check if .git directory exists (for Git-based sources)
    const gitPath = path.join(sourcePath, '.git');
    if (!await fs.pathExists(gitPath)) {
      result.warnings.push('Not a Git repository (may be a manual cache)');
    }

    // Check metadata consistency
    const metadata = await this.getSourceMetadata(sourceName);
    if (!metadata) {
      result.warnings.push('Missing cache metadata');
    }

    return result;
  }

  /**
   * Clears cache for a specific source
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<void>}
   */
  async clearCache(sourceName) {
    const sourcePath = this.getSourceCachePath(sourceName);

    if (!await fs.pathExists(sourcePath)) {
      return; // Already cleared
    }

    try {
      await fs.remove(sourcePath);
    } catch (error) {
      throw new FileSystemError(
        'Failed to clear cache',
        {
          source: sourceName,
          path: sourcePath,
          error: error.message
        }
      );
    }

    // Remove from metadata
    const metadata = await this.getMetadata();
    if (metadata.sources[sourceName]) {
      delete metadata.sources[sourceName];
      await fs.writeJson(this.metadataFile, metadata, { spaces: 2 });
    }
  }

  /**
   * Clears all cache
   * 
   * @returns {Promise<void>}
   */
  async clearAllCache() {
    if (!await fs.pathExists(this.cacheDir)) {
      return; // Already cleared
    }

    try {
      await fs.remove(this.cacheDir);
    } catch (error) {
      throw new FileSystemError(
        'Failed to clear all cache',
        {
          path: this.cacheDir,
          error: error.message
        }
      );
    }
  }

  /**
   * Lists all cached sources
   * 
   * @returns {Promise<string[]>} Array of source names
   */
  async listCachedSources() {
    if (!await fs.pathExists(this.cacheDir)) {
      return [];
    }

    try {
      const items = await fs.readdir(this.cacheDir);
      const sources = [];

      for (const item of items) {
        // Skip metadata files
        if (item.startsWith('.')) {
          continue;
        }

        const itemPath = path.join(this.cacheDir, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          sources.push(item);
        }
      }

      return sources;
    } catch (error) {
      throw new FileSystemError(
        'Failed to list cached sources',
        {
          path: this.cacheDir,
          error: error.message
        }
      );
    }
  }

  /**
   * Gets cache statistics
   * 
   * @returns {Promise<Object>} Cache statistics
   */
  async getStatistics() {
    const sources = await this.listCachedSources();
    const metadata = await this.getMetadata();
    const totalSize = await this.getTotalCacheSize();

    const stats = {
      totalSources: sources.length,
      totalSize,
      totalSizeFormatted: this.formatSize(totalSize),
      sources: {}
    };

    for (const source of sources) {
      const size = await this.getCacheSize(source);
      const sourceMeta = metadata.sources[source];

      stats.sources[source] = {
        size,
        sizeFormatted: this.formatSize(size),
        lastUpdated: sourceMeta ? sourceMeta.last_updated : null,
        templateCount: sourceMeta ? sourceMeta.template_count : null
      };
    }

    return stats;
  }
}

module.exports = CacheManager;
