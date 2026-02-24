/**
 * Backup Manager
 * 
 * Manages mandatory backup creation and validation for adoption process.
 * Ensures all modifications are preceded by verified backups.
 * 
 * Core Responsibilities:
 * - Create selective backups of files to be modified
 * - Validate backup integrity (file count, size, content)
 * - Provide backup metadata for rollback
 * - Abort operations if backup fails
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const SelectiveBackup = require('../backup/selective-backup');

/**
 * Backup Manager for mandatory backup operations
 */
class BackupManager {
  constructor(dependencies = {}) {
    // Support dependency injection for testing
    this.selectiveBackup = dependencies.selectiveBackup || new SelectiveBackup();
  }

  /**
   * Creates mandatory backup before modifications
   * 
   * This method MUST be called before any file modifications during adoption.
   * If backup creation or validation fails, the adoption process MUST be aborted.
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {string[]} filesToModify - Relative paths of files to backup (from .sce/)
   * @param {Object} options - Backup options
   * @param {string} options.type - Backup type (default: 'adopt-smart')
   * @param {boolean} options.validateContent - Validate file content hashes (default: true)
   * @returns {Promise<BackupResult>}
   * @throws {Error} If backup creation or validation fails
   */
  async createMandatoryBackup(projectPath, filesToModify, options = {}) {
    const {
      type = 'adopt-smart',
      validateContent = true
    } = options;

    // Validate inputs
    if (!projectPath) {
      throw new Error('Project path is required');
    }

    if (!Array.isArray(filesToModify)) {
      throw new Error('filesToModify must be an array');
    }

    // If no files to modify, return null (no backup needed)
    if (filesToModify.length === 0) {
      return null;
    }

    try {
      // Create selective backup using existing system
      const backup = await this.selectiveBackup.createSelectiveBackup(
        projectPath,
        filesToModify,
        { type }
      );

      // Ensure backup has required properties
      if (!backup || !backup.id) {
        throw new Error('Backup creation returned invalid result');
      }

      // Transform to standardized BackupResult format
      const backupResult = {
        id: backup.id,
        location: backup.path || backup.backupPath,
        filesCount: backup.fileCount || (backup.files ? backup.files.length : 0),
        totalSize: backup.totalSize || 0,
        timestamp: backup.created ? new Date(backup.created) : new Date(),
        type: backup.type || type,
        files: backup.files || []
      };

      // Validate backup integrity
      const validation = await this.validateBackup(backupResult, {
        validateContent,
        originalPath: projectPath
      });

      if (!validation.success) {
        throw new Error(`Backup validation failed: ${validation.error}`);
      }

      // Add validation info to result
      backupResult.validated = true;
      backupResult.validationDetails = {
        filesVerified: validation.filesVerified,
        contentVerified: validation.contentVerified,
        timestamp: new Date()
      };

      return backupResult;

    } catch (error) {
      // Wrap error with context
      throw new Error(`Failed to create mandatory backup: ${error.message}`);
    }
  }

  /**
   * Validates backup integrity
   * 
   * Performs comprehensive validation of backup to ensure it can be used for rollback:
   * 1. Backup directory exists
   * 2. File count matches expected
   * 3. All files exist in backup
   * 4. File sizes match (optional)
   * 5. Content hashes match (optional)
   * 
   * @param {BackupResult} backup - Backup result to validate
   * @param {Object} options - Validation options
   * @param {boolean} options.validateContent - Validate file content hashes (default: false)
   * @param {string} options.originalPath - Original project path for content validation
   * @returns {Promise<ValidationResult>}
   */
  async validateBackup(backup, options = {}) {
    const {
      validateContent = false,
      originalPath = null
    } = options;

    // Handle null backup (no backup needed)
    if (!backup) {
      return {
        success: true,
        filesVerified: 0,
        contentVerified: false,
        message: 'No backup to validate'
      };
    }

    try {
      // Validation 1: Backup has required properties
      if (!backup.location) {
        return {
          success: false,
          error: 'Backup location not specified',
          filesVerified: 0,
          contentVerified: false
        };
      }

      // Validation 2: Backup directory exists
      const exists = await fs.pathExists(backup.location);
      if (!exists) {
        return {
          success: false,
          error: 'Backup directory not found',
          filesVerified: 0,
          contentVerified: false
        };
      }

      // Validation 3: Files subdirectory exists
      const filesDir = path.join(backup.location, 'files');
      const filesDirExists = await fs.pathExists(filesDir);
      if (!filesDirExists) {
        return {
          success: false,
          error: 'Backup files directory not found',
          filesVerified: 0,
          contentVerified: false
        };
      }

      // Validation 4: Verify file count
      const expectedCount = backup.filesCount || 0;
      const actualFiles = backup.files || [];
      
      if (actualFiles.length !== expectedCount) {
        return {
          success: false,
          error: `File count mismatch: expected ${expectedCount}, found ${actualFiles.length}`,
          filesVerified: 0,
          contentVerified: false
        };
      }

      // Validation 5: Verify each file exists in backup
      let filesVerified = 0;
      for (const filePath of actualFiles) {
        const backupFilePath = path.join(filesDir, filePath);
        const fileExists = await fs.pathExists(backupFilePath);
        
        if (!fileExists) {
          return {
            success: false,
            error: `File missing from backup: ${filePath}`,
            filesVerified,
            contentVerified: false
          };
        }
        
        filesVerified++;
      }

      // Validation 6: Optional content validation
      let contentVerified = false;
      if (validateContent && originalPath) {
        const contentValidation = await this._validateContent(
          originalPath,
          backup.location,
          actualFiles
        );
        
        if (!contentValidation.success) {
          return {
            success: false,
            error: contentValidation.error,
            filesVerified,
            contentVerified: false
          };
        }
        
        contentVerified = true;
      }

      // All validations passed
      return {
        success: true,
        filesVerified,
        contentVerified,
        message: `Backup validated: ${filesVerified} files verified`
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
        filesVerified: 0,
        contentVerified: false
      };
    }
  }

  /**
   * Validates backup content matches original files
   * 
   * @param {string} originalPath - Original project path
   * @param {string} backupPath - Backup directory path
   * @param {string[]} files - Files to validate
   * @returns {Promise<ContentValidationResult>}
   * @private
   */
  async _validateContent(originalPath, backupPath, files) {
    try {
      const filesDir = path.join(backupPath, 'files');
      
      for (const filePath of files) {
        const originalFilePath = path.join(originalPath, '.sce', filePath);
        const backupFilePath = path.join(filesDir, filePath);
        
        // Check if original file still exists
        const originalExists = await fs.pathExists(originalFilePath);
        if (!originalExists) {
          // Original file may have been deleted, skip validation
          continue;
        }
        
        // Compare file sizes
        const originalStats = await fs.stat(originalFilePath);
        const backupStats = await fs.stat(backupFilePath);
        
        if (originalStats.size !== backupStats.size) {
          return {
            success: false,
            error: `File size mismatch for ${filePath}: original ${originalStats.size}, backup ${backupStats.size}`
          };
        }
        
        // Compare content hashes for critical files
        if (this._isCriticalFile(filePath)) {
          const originalHash = await this._calculateFileHash(originalFilePath);
          const backupHash = await this._calculateFileHash(backupFilePath);
          
          if (originalHash !== backupHash) {
            return {
              success: false,
              error: `Content hash mismatch for ${filePath}`
            };
          }
        }
      }
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: `Content validation error: ${error.message}`
      };
    }
  }

  /**
   * Determines if a file is critical and requires hash validation
   * 
   * @param {string} filePath - File path
   * @returns {boolean}
   * @private
   */
  _isCriticalFile(filePath) {
    const criticalPatterns = [
      'steering/CORE_PRINCIPLES.md',
      'steering/ENVIRONMENT.md',
      'version.json',
      'adoption-config.json'
    ];
    
    return criticalPatterns.some(pattern => filePath.includes(pattern));
  }

  /**
   * Calculates SHA-256 hash of a file
   * 
   * @param {string} filePath - File path
   * @returns {Promise<string>} - Hex hash string
   * @private
   */
  async _calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Gets backup information
   * 
   * @param {string} projectPath - Project path
   * @param {string} backupId - Backup ID
   * @returns {Promise<BackupInfo>}
   */
  async getBackupInfo(projectPath, backupId) {
    const backupPath = path.join(projectPath, '.sce', 'backups', backupId);
    
    // Check if backup exists
    const exists = await fs.pathExists(backupPath);
    if (!exists) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    
    // Read metadata
    const metadataPath = path.join(backupPath, 'metadata.json');
    const metadataExists = await fs.pathExists(metadataPath);
    
    if (!metadataExists) {
      throw new Error(`Backup metadata not found: ${backupId}`);
    }
    
    const metadata = await fs.readJson(metadataPath);
    
    return {
      id: metadata.id || backupId,
      type: metadata.type,
      created: metadata.created,
      filesCount: metadata.fileCount || 0,
      totalSize: metadata.totalSize || 0,
      files: metadata.files || [],
      location: backupPath
    };
  }
}

/**
 * @typedef {Object} BackupResult
 * @property {string} id - Unique backup identifier
 * @property {string} location - Absolute path to backup directory
 * @property {number} filesCount - Number of files backed up
 * @property {number} totalSize - Total size of backed up files in bytes
 * @property {Date} timestamp - Backup creation timestamp
 * @property {string} type - Backup type (e.g., 'adopt-smart')
 * @property {string[]} files - List of backed up file paths
 * @property {boolean} validated - Whether backup has been validated
 * @property {Object} validationDetails - Validation details
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation succeeded
 * @property {number} filesVerified - Number of files verified
 * @property {boolean} contentVerified - Whether content was verified
 * @property {string} [error] - Error message if validation failed
 * @property {string} [message] - Success message if validation passed
 */

/**
 * @typedef {Object} ContentValidationResult
 * @property {boolean} success - Whether content validation succeeded
 * @property {string} [error] - Error message if validation failed
 */

/**
 * @typedef {Object} BackupInfo
 * @property {string} id - Backup identifier
 * @property {string} type - Backup type
 * @property {string} created - Creation timestamp (ISO string)
 * @property {number} filesCount - Number of files
 * @property {number} totalSize - Total size in bytes
 * @property {string[]} files - List of file paths
 * @property {string} location - Backup directory path
 */

module.exports = BackupManager;
