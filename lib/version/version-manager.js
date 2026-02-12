/**
 * Version Manager
 * 
 * Manages version tracking, compatibility checking, and upgrade path calculation
 * for the kiro-spec-engine project adoption and upgrade system.
 */

const path = require('path');
const semver = require('semver');
const { readJSON, writeJSON, pathExists } = require('../utils/fs-utils');

/**
 * Compatibility matrix defining which versions can work together
 * Format: { version: { compatible: [versions], breaking: boolean } }
 */
const COMPATIBILITY_MATRIX = {
  '1.0.0': { compatible: ['1.0.0', '1.1.0', '1.2.0'], breaking: false },
  '1.1.0': { compatible: ['1.0.0', '1.1.0', '1.2.0'], breaking: false },
  '1.2.0': { compatible: ['1.0.0', '1.1.0', '1.2.0'], breaking: false },
  '2.0.0': { compatible: ['2.0.0'], breaking: true, migration: 'required' }
};

class VersionManager {
  constructor() {
    this.versionFileName = 'version.json';
  }

  /**
   * Gets the path to version.json in a project
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {string} - Absolute path to version.json
   */
  getVersionFilePath(projectPath) {
    return path.join(projectPath, '.kiro', this.versionFileName);
  }

  /**
   * Reads version information from project
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<VersionInfo|null>} - Version info or null if not found
   */
  async readVersion(projectPath) {
    const versionPath = this.getVersionFilePath(projectPath);
    
    try {
      const exists = await pathExists(versionPath);
      if (!exists) {
        return null;
      }
      
      const versionInfo = await readJSON(versionPath);
      
      // Validate structure
      if (!this.isValidVersionInfo(versionInfo)) {
        throw new Error('Invalid version.json structure');
      }
      
      return versionInfo;
    } catch (error) {
      throw new Error(`Failed to read version file: ${error.message}`);
    }
  }

  /**
   * Writes version information to project
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {VersionInfo} versionInfo - Version information to write
   * @returns {Promise<void>}
   */
  async writeVersion(projectPath, versionInfo) {
    const versionPath = this.getVersionFilePath(projectPath);
    
    try {
      // Validate structure before writing
      if (!this.isValidVersionInfo(versionInfo)) {
        throw new Error('Invalid version info structure');
      }
      
      await writeJSON(versionPath, versionInfo, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to write version file: ${error.message}`);
    }
  }

  /**
   * Creates initial version info for a new project
   * 
   * @param {string} kseVersion - Current kse version
   * @param {string} templateVersion - Template version (default: same as kse)
   * @returns {VersionInfo}
   */
  createVersionInfo(kseVersion, templateVersion = null) {
    const now = new Date().toISOString();
    
    return {
      'kse-version': kseVersion,
      'template-version': templateVersion || kseVersion,
      'created': now,
      'last-upgraded': now,
      'upgrade-history': []
    };
  }

  /**
   * Validates version info structure
   * 
   * @param {Object} versionInfo - Version info to validate
   * @returns {boolean}
   */
  isValidVersionInfo(versionInfo) {
    if (!versionInfo || typeof versionInfo !== 'object') {
      return false;
    }
    
    const requiredFields = [
      'kse-version',
      'template-version',
      'created',
      'last-upgraded',
      'upgrade-history'
    ];
    
    for (const field of requiredFields) {
      if (!(field in versionInfo)) {
        return false;
      }
    }
    
    // Validate upgrade-history is an array
    if (!Array.isArray(versionInfo['upgrade-history'])) {
      return false;
    }
    
    return true;
  }

  /**
   * Checks if upgrade is needed
   * 
   * @param {string} projectVersion - Current project version
   * @param {string} kseVersion - Installed kse version
   * @returns {boolean}
   */
  needsUpgrade(projectVersion, kseVersion) {
    if (!projectVersion || !kseVersion) {
      return false;
    }
    
    try {
      // Use semver for comparison
      return semver.lt(projectVersion, kseVersion);
    } catch (error) {
      // If semver comparison fails, do string comparison
      return projectVersion !== kseVersion;
    }
  }

  /**
   * Checks compatibility between versions
   * 
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {CompatibilityResult}
   */
  checkCompatibility(fromVersion, toVersion) {
    // If versions are the same, always compatible
    if (fromVersion === toVersion) {
      return {
        compatible: true,
        breaking: false,
        migration: 'none'
      };
    }
    
    // Check compatibility matrix first
    const fromInfo = COMPATIBILITY_MATRIX[fromVersion];
    
    if (fromInfo) {
      const isCompatible = fromInfo.compatible.includes(toVersion);
      return {
        compatible: isCompatible,
        breaking: !isCompatible || fromInfo.breaking,
        migration: !isCompatible ? 'required' : 'none'
      };
    }
    
    // Fallback: semver-based compatibility for versions not in matrix
    try {
      const fromMajor = semver.major(fromVersion);
      const toMajor = semver.major(toVersion);
      
      if (fromMajor === toMajor) {
        // Same major version — compatible, non-breaking
        return {
          compatible: true,
          breaking: false,
          migration: 'none'
        };
      }
      
      // Different major version — breaking change
      return {
        compatible: false,
        breaking: true,
        migration: 'required'
      };
    } catch (error) {
      // Invalid semver — assume incompatible
      return {
        compatible: false,
        breaking: true,
        migration: 'unknown',
        message: `Unknown source version: ${fromVersion}`
      };
    }
  }

  /**
   * Calculates upgrade path for version gap
   * Returns array of intermediate versions to upgrade through
   * 
   * @param {string} fromVersion - Current version
   * @param {string} toVersion - Target version
   * @returns {string[]} - Array of versions in upgrade order (including from and to)
   */
  calculateUpgradePath(fromVersion, toVersion) {
    // If same version, no upgrade needed
    if (fromVersion === toVersion) {
      return [fromVersion];
    }
    
    // Get all versions from compatibility matrix
    const allVersions = Object.keys(COMPATIBILITY_MATRIX).sort((a, b) => {
      try {
        return semver.compare(a, b);
      } catch (error) {
        return a.localeCompare(b);
      }
    });
    
    // Find indices
    const fromIndex = allVersions.indexOf(fromVersion);
    const toIndex = allVersions.indexOf(toVersion);
    
    // If both versions are in the matrix, use the matrix path
    if (fromIndex !== -1 && toIndex !== -1) {
      if (fromIndex > toIndex) {
        throw new Error('Cannot downgrade versions');
      }
      return allVersions.slice(fromIndex, toIndex + 1);
    }
    
    // Fallback: semver-based direct upgrade for versions not in matrix
    try {
      const from = semver.valid(fromVersion);
      const to = semver.valid(toVersion);
      
      if (!from) {
        throw new Error(`Unknown source version: ${fromVersion}`);
      }
      if (!to) {
        throw new Error(`Unknown target version: ${toVersion}`);
      }
      
      if (semver.gt(fromVersion, toVersion)) {
        throw new Error('Cannot downgrade versions');
      }
      
      // Direct upgrade path
      return [fromVersion, toVersion];
    } catch (error) {
      // Re-throw our own errors
      if (error.message.includes('Unknown') || error.message.includes('downgrade')) {
        throw error;
      }
      throw new Error(`Unknown source version: ${fromVersion}`);
    }
  }

  /**
   * Adds an upgrade entry to version history
   * 
   * @param {VersionInfo} versionInfo - Current version info
   * @param {string} fromVersion - Version upgraded from
   * @param {string} toVersion - Version upgraded to
   * @param {boolean} success - Whether upgrade succeeded
   * @param {string} error - Error message if failed
   * @returns {VersionInfo} - Updated version info
   */
  addUpgradeHistory(versionInfo, fromVersion, toVersion, success, error = null) {
    const entry = {
      from: fromVersion,
      to: toVersion,
      date: new Date().toISOString(),
      success
    };
    
    if (error) {
      entry.error = error;
    }
    
    versionInfo['upgrade-history'].push(entry);
    
    // Update version and last-upgraded if successful
    if (success) {
      versionInfo['kse-version'] = toVersion;
      versionInfo['template-version'] = toVersion;
      versionInfo['last-upgraded'] = entry.date;
    }
    
    return versionInfo;
  }

  /**
   * Gets the compatibility matrix
   * 
   * @returns {Object} - Compatibility matrix
   */
  getCompatibilityMatrix() {
    return { ...COMPATIBILITY_MATRIX };
  }
}

module.exports = VersionManager;
