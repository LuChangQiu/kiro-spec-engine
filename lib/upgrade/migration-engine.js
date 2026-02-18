/**
 * Migration Engine
 * 
 * Manages version upgrades by planning and executing migration scripts.
 * Handles incremental upgrades through intermediate versions.
 */

const path = require('path');
const { pathExists, readJSON } = require('../utils/fs-utils');
const VersionManager = require('../version/version-manager');
const GitignoreIntegration = require('../gitignore/gitignore-integration');

class MigrationEngine {
  constructor() {
    this.versionManager = new VersionManager();
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Plans upgrade from current to target version
   * 
   * @param {string} fromVersion - Current version
   * @param {string} toVersion - Target version
   * @returns {Promise<UpgradePlan>}
   */
  async planUpgrade(fromVersion, toVersion) {
    try {
      // Calculate upgrade path
      const upgradePath = this.versionManager.calculateUpgradePath(fromVersion, toVersion);
      
      // Build list of migrations needed
      const migrations = [];
      for (let i = 0; i < upgradePath.length - 1; i++) {
        const from = upgradePath[i];
        const to = upgradePath[i + 1];
        
        // Check if migration script exists
        const migrationScript = await this.findMigrationScript(from, to);
        
        // Check compatibility
        const compatibility = this.versionManager.checkCompatibility(from, to);
        
        migrations.push({
          from,
          to,
          breaking: compatibility.breaking,
          script: migrationScript,
          required: compatibility.migration === 'required'
        });
      }
      
      // Estimate time (rough estimate: 10 seconds per migration)
      const estimatedTime = migrations.length > 0 
        ? `${migrations.length * 10} seconds`
        : '< 5 seconds';
      
      return {
        fromVersion,
        toVersion,
        path: upgradePath,
        migrations,
        estimatedTime,
        backupRequired: true
      };
    } catch (error) {
      throw new Error(`Failed to plan upgrade: ${error.message}`);
    }
  }

  /**
   * Executes upgrade plan
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {UpgradePlan} plan - Upgrade plan from planUpgrade()
   * @param {Object} options - Upgrade options
   * @param {boolean} options.dryRun - If true, don't make changes
   * @param {Function} options.onProgress - Progress callback (step, total, message)
   * @returns {Promise<UpgradeResult>}
   */
  async executeUpgrade(projectPath, plan, options = {}) {
    const { dryRun = false, onProgress = null } = options;
    
    const migrationsExecuted = [];
    const errors = [];
    const warnings = [];
    
    try {
      // Read current version info
      const versionInfo = await this.versionManager.readVersion(projectPath);
      if (!versionInfo) {
        throw new Error('version.json not found');
      }
      
      // Verify starting version matches plan
      if (versionInfo['sce-version'] !== plan.fromVersion) {
        throw new Error(
          `Version mismatch: expected ${plan.fromVersion}, found ${versionInfo['sce-version']}`
        );
      }
      
      if (dryRun) {
        return {
          success: true,
          fromVersion: plan.fromVersion,
          toVersion: plan.toVersion,
          migrationsExecuted: plan.migrations.map(m => ({
            from: m.from,
            to: m.to,
            success: true,
            changes: ['(dry-run) No changes made'],
            error: null
          })),
          backupId: null,
          errors: [],
          warnings: ['Dry run - no changes made']
        };
      }
      
      // Execute migrations sequentially
      for (let i = 0; i < plan.migrations.length; i++) {
        const migration = plan.migrations[i];
        
        if (onProgress) {
          onProgress(i + 1, plan.migrations.length, `Migrating ${migration.from} → ${migration.to}`);
        }
        
        try {
          // Load migration script if it exists
          let migrationResult = {
            from: migration.from,
            to: migration.to,
            success: true,
            changes: [],
            error: null
          };
          
          if (migration.script) {
            // Execute migration script
            const script = await this.loadMigration(migration.from, migration.to);
            
            if (script) {
              const result = await script.migrate(projectPath, {
                fromVersion: migration.from,
                toVersion: migration.to,
                versionInfo
              });
              
              migrationResult.changes = result.changes || [];
            } else {
              migrationResult.changes.push('No migration script needed');
            }
          } else {
            migrationResult.changes.push('No migration script needed');
          }
          
          // Update version info
          this.versionManager.addUpgradeHistory(
            versionInfo,
            migration.from,
            migration.to,
            true
          );
          
          // Write updated version info
          await this.versionManager.writeVersion(projectPath, versionInfo);
          
          migrationsExecuted.push(migrationResult);
        } catch (error) {
          // Migration failed - record error and stop
          const migrationResult = {
            from: migration.from,
            to: migration.to,
            success: false,
            changes: [],
            error: error.message
          };
          
          migrationsExecuted.push(migrationResult);
          errors.push(`Migration ${migration.from} → ${migration.to} failed: ${error.message}`);
          
          // Add failed upgrade to history
          this.versionManager.addUpgradeHistory(
            versionInfo,
            migration.from,
            migration.to,
            false,
            error.message
          );
          await this.versionManager.writeVersion(projectPath, versionInfo);
          
          // Stop execution on first failure
          throw new Error(`Migration failed: ${error.message}`);
        }
      }
      
      // Fix .gitignore for team collaboration after successful upgrade
      try {
        const gitignoreIntegration = new GitignoreIntegration();
        const gitignoreResult = await gitignoreIntegration.integrateWithUpgrade(projectPath);
        
        if (gitignoreResult.success && gitignoreResult.action !== 'skipped') {
          warnings.push(gitignoreResult.message);
        } else if (!gitignoreResult.success) {
          warnings.push(`⚠️  .gitignore fix failed: ${gitignoreResult.message}`);
          warnings.push('You can fix this manually with: sce doctor --fix-gitignore');
        }
      } catch (gitignoreError) {
        // Don't block upgrade on .gitignore fix failure
        warnings.push(`⚠️  .gitignore check failed: ${gitignoreError.message}`);
        warnings.push('You can fix this manually with: sce doctor --fix-gitignore');
      }
      
      return {
        success: true,
        fromVersion: plan.fromVersion,
        toVersion: plan.toVersion,
        migrationsExecuted,
        backupId: null, // Backup ID should be set by caller
        errors,
        warnings
      };
    } catch (error) {
      return {
        success: false,
        fromVersion: plan.fromVersion,
        toVersion: plan.toVersion,
        migrationsExecuted,
        backupId: null,
        errors: [error.message, ...errors],
        warnings
      };
    }
  }

  /**
   * Loads migration script for version transition
   * 
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {Promise<MigrationScript|null>}
   */
  async loadMigration(fromVersion, toVersion) {
    try {
      const scriptPath = await this.findMigrationScript(fromVersion, toVersion);
      
      if (!scriptPath) {
        return null;
      }
      
      // Load the migration script
      const script = require(scriptPath);
      
      // Validate script interface
      if (!script.migrate || typeof script.migrate !== 'function') {
        throw new Error(`Invalid migration script: missing migrate() function`);
      }
      
      return script;
    } catch (error) {
      throw new Error(`Failed to load migration script: ${error.message}`);
    }
  }

  /**
   * Finds migration script file for version transition
   * 
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @returns {Promise<string|null>} - Absolute path to script or null if not found
   */
  async findMigrationScript(fromVersion, toVersion) {
    // Try different naming conventions
    const possibleNames = [
      `${fromVersion}-to-${toVersion}.js`,
      `${fromVersion}_to_${toVersion}.js`,
      `v${fromVersion}-to-v${toVersion}.js`
    ];
    
    for (const name of possibleNames) {
      const scriptPath = path.join(this.migrationsDir, name);
      const exists = await pathExists(scriptPath);
      
      if (exists) {
        return scriptPath;
      }
    }
    
    return null;
  }

  /**
   * Validates upgrade result
   * 
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<ValidationResult>}
   */
  async validate(projectPath) {
    const errors = [];
    const warnings = [];
    
    try {
      // Check if .kiro/ directory exists
      const kiroPath = path.join(projectPath, '.kiro');
      const kiroExists = await pathExists(kiroPath);
      
      if (!kiroExists) {
        errors.push('.kiro/ directory not found');
        return { success: false, errors, warnings };
      }
      
      // Check if version.json exists and is valid
      const versionInfo = await this.versionManager.readVersion(projectPath);
      
      if (!versionInfo) {
        errors.push('version.json not found or invalid');
        return { success: false, errors, warnings };
      }
      
      // Check required directories
      const requiredDirs = ['specs', 'steering', 'tools', 'backups'];
      
      for (const dir of requiredDirs) {
        const dirPath = path.join(kiroPath, dir);
        const exists = await pathExists(dirPath);
        
        if (!exists) {
          warnings.push(`${dir}/ directory not found`);
        }
      }
      
      // Check required steering files
      const requiredSteeringFiles = [
        'steering/CORE_PRINCIPLES.md',
        'steering/ENVIRONMENT.md',
        'steering/CURRENT_CONTEXT.md',
        'steering/RULES_GUIDE.md'
      ];
      
      for (const file of requiredSteeringFiles) {
        const filePath = path.join(kiroPath, file);
        const exists = await pathExists(filePath);
        
        if (!exists) {
          warnings.push(`${file} not found`);
        }
      }
      
      return {
        success: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      errors.push(`Validation failed: ${error.message}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * Gets available migrations
   * 
   * @returns {Promise<string[]>} - Array of migration script names
   */
  async getAvailableMigrations() {
    try {
      const exists = await pathExists(this.migrationsDir);
      
      if (!exists) {
        return [];
      }
      
      const fs = require('fs-extra');
      const files = await fs.readdir(this.migrationsDir);
      
      return files.filter(file => file.endsWith('.js'));
    } catch (error) {
      return [];
    }
  }
}

module.exports = MigrationEngine;
