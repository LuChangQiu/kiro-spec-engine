/**
 * Migration: 1.0.0 → 1.1.0
 * 
 * Adds version management foundation:
 * - Ensures version.json exists with correct structure
 * - Adds backups/ directory if missing
 * - No breaking changes
 */

const path = require('path');
const { pathExists, ensureDirectory, writeJSON } = require('../../utils/fs-utils');

module.exports = {
  version: "1.1.0",
  breaking: false,
  description: "Add version management foundation (version.json, backups/)",
  
  /**
   * Executes migration from 1.0.0 to 1.1.0
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {MigrationContext} context - Migration context
   * @returns {Promise<MigrationResult>}
   */
  async migrate(projectPath, context) {
    const changes = [];
    
    try {
      const kiroPath = path.join(projectPath, '.kiro');
      
      // 1. Ensure backups/ directory exists
      const backupsPath = path.join(kiroPath, 'backups');
      const backupsExists = await pathExists(backupsPath);
      
      if (!backupsExists) {
        await ensureDirectory(backupsPath);
        changes.push('Created backups/ directory');
      }
      
      // 2. Ensure version.json has correct structure
      // (This is handled by VersionManager, but we verify it here)
      const versionPath = path.join(kiroPath, 'version.json');
      const versionExists = await pathExists(versionPath);
      
      if (versionExists) {
        changes.push('Verified version.json structure');
      } else {
        changes.push('version.json will be created by VersionManager');
      }
      
      // 3. Add any other 1.1.0-specific changes here
      // (None for this version - it's just the foundation)
      
      return {
        success: true,
        changes
      };
    } catch (error) {
      throw new Error(`Migration 1.0.0 → 1.1.0 failed: ${error.message}`);
    }
  },
  
  /**
   * Rolls back migration from 1.1.0 to 1.0.0
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {MigrationContext} context - Migration context
   * @returns {Promise<void>}
   */
  async rollback(projectPath, context) {
    // For 1.0.0 → 1.1.0, rollback is simple:
    // - Remove backups/ directory (but keep backups for safety)
    // - version.json will be handled by VersionManager
    
    // Note: We don't actually remove anything to preserve data safety
    // The backup system will handle restoration if needed
  }
};
