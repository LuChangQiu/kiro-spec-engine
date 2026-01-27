/**
 * Strategy Selector
 * 
 * Automatically detects project state and selects the optimal adoption mode.
 * Extracted from SmartOrchestrator to provide a focused, testable component.
 * 
 * Responsibilities:
 * - Detect current project state
 * - Analyze version compatibility
 * - Select optimal adoption mode
 * - Return comprehensive project state information
 */

const path = require('path');
const fs = require('fs-extra');
const VersionManager = require('../version/version-manager');

/**
 * Adoption modes
 */
const AdoptionMode = {
  FRESH: 'fresh',              // No .kiro/ directory - create new
  SKIP: 'skip',                // Already at latest version - no action
  SMART_UPDATE: 'smart-update', // Older version - update templates only
  WARNING: 'warning',          // Newer version - warn user
  SMART_ADOPT: 'smart-adopt'   // No version info - full adoption with backup
};

/**
 * Project state information
 */
class ProjectState {
  constructor(data = {}) {
    this.hasKiroDir = data.hasKiroDir !== undefined ? data.hasKiroDir : false;
    this.hasVersionFile = data.hasVersionFile !== undefined ? data.hasVersionFile : false;
    this.currentVersion = data.currentVersion !== undefined ? data.currentVersion : null;
    this.targetVersion = data.targetVersion !== undefined ? data.targetVersion : null;
    this.hasSpecs = data.hasSpecs !== undefined ? data.hasSpecs : false;
    this.hasSteering = data.hasSteering !== undefined ? data.hasSteering : false;
    this.hasTools = data.hasTools !== undefined ? data.hasTools : false;
    this.conflicts = data.conflicts || [];
    this.versionComparison = data.versionComparison !== undefined ? data.versionComparison : null;
  }
}

/**
 * Strategy Selector
 * Detects project state and selects optimal adoption mode
 */
class StrategySelector {
  constructor(dependencies = {}) {
    // Support dependency injection for testing
    this.versionManager = dependencies.versionManager || new VersionManager();
    this.fs = dependencies.fs || fs;
  }

  /**
   * Detects the current project state
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<ProjectState>} - Comprehensive project state
   */
  async detectProjectState(projectPath) {
    const kiroPath = path.join(projectPath, '.kiro');
    const versionPath = path.join(kiroPath, 'version.json');
    const specsPath = path.join(kiroPath, 'specs');
    const steeringPath = path.join(kiroPath, 'steering');
    const toolsPath = path.join(kiroPath, 'tools');

    // Get target version from package.json
    const packageJson = require('../../package.json');
    const targetVersion = packageJson.version;

    // Check directory existence
    const hasKiroDir = await this.fs.pathExists(kiroPath);
    const hasVersionFile = hasKiroDir && await this.fs.pathExists(versionPath);
    const hasSpecs = hasKiroDir && await this.fs.pathExists(specsPath);
    const hasSteering = hasKiroDir && await this.fs.pathExists(steeringPath);
    const hasTools = hasKiroDir && await this.fs.pathExists(toolsPath);

    // Read current version if available
    let currentVersion = null;
    let versionComparison = null;

    if (hasVersionFile) {
      try {
        const versionInfo = await this.versionManager.readVersion(projectPath);
        currentVersion = versionInfo['kse-version'] || null;

        // Compare versions if we have both
        if (currentVersion && targetVersion) {
          versionComparison = this.versionManager.compareVersions(
            currentVersion,
            targetVersion
          );
        }
      } catch (error) {
        // Version file exists but is corrupted - treat as no version
        currentVersion = null;
        versionComparison = null;
      }
    }

    // Detect potential conflicts (files that exist and might be overwritten)
    const conflicts = [];
    if (hasKiroDir) {
      const templateFiles = [
        'steering/CORE_PRINCIPLES.md',
        'steering/ENVIRONMENT.md',
        'steering/RULES_GUIDE.md',
        'tools/ultrawork_enhancer.py',
        'README.md'
      ];

      for (const templateFile of templateFiles) {
        const filePath = path.join(kiroPath, templateFile);
        if (await this.fs.pathExists(filePath)) {
          conflicts.push(templateFile);
        }
      }
    }

    return new ProjectState({
      hasKiroDir,
      hasVersionFile,
      currentVersion,
      targetVersion,
      hasSpecs,
      hasSteering,
      hasTools,
      conflicts,
      versionComparison
    });
  }

  /**
   * Selects the optimal adoption mode based on project state
   * 
   * @param {ProjectState} state - Project state from detectProjectState()
   * @returns {string} - Adoption mode (one of AdoptionMode values)
   */
  selectMode(state) {
    // No .kiro/ directory - fresh adoption
    if (!state.hasKiroDir) {
      return AdoptionMode.FRESH;
    }

    // Has .kiro/ but no version file or no current version - smart adopt
    if (!state.hasVersionFile || !state.currentVersion) {
      return AdoptionMode.SMART_ADOPT;
    }

    // Has version file and current version - check version comparison
    // Version comparison can be null if comparison failed
    if (state.versionComparison === null || state.versionComparison === undefined) {
      // Version comparison failed - default to smart adopt
      return AdoptionMode.SMART_ADOPT;
    }

    if (state.versionComparison === 0) {
      // Same version - skip
      return AdoptionMode.SKIP;
    } else if (state.versionComparison < 0) {
      // Current version is older - smart update
      return AdoptionMode.SMART_UPDATE;
    } else {
      // Current version is newer - warning
      return AdoptionMode.WARNING;
    }
  }

  /**
   * Detects project state and selects mode in one call
   * Convenience method that combines detectProjectState() and selectMode()
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<{state: ProjectState, mode: string}>}
   */
  async detectAndSelect(projectPath) {
    const state = await this.detectProjectState(projectPath);
    const mode = this.selectMode(state);

    return { state, mode };
  }

  /**
   * Gets a human-readable description of the selected mode
   * 
   * @param {string} mode - Adoption mode
   * @returns {string} - Human-readable description
   */
  getModeDescription(mode) {
    const descriptions = {
      [AdoptionMode.FRESH]: 'Fresh Adoption - Creating new .kiro/ structure',
      [AdoptionMode.SKIP]: 'Already Up-to-Date - No changes needed',
      [AdoptionMode.SMART_UPDATE]: 'Smart Update - Updating template files to latest version',
      [AdoptionMode.WARNING]: 'Version Warning - Project version is newer than KSE version',
      [AdoptionMode.SMART_ADOPT]: 'Smart Adoption - Adopting existing .kiro/ directory'
    };

    return descriptions[mode] || `Unknown mode: ${mode}`;
  }

  /**
   * Validates that a mode is valid
   * 
   * @param {string} mode - Mode to validate
   * @returns {boolean} - True if valid
   */
  isValidMode(mode) {
    return Object.values(AdoptionMode).includes(mode);
  }
}

// Export class and constants
module.exports = StrategySelector;
module.exports.AdoptionMode = AdoptionMode;
module.exports.ProjectState = ProjectState;
