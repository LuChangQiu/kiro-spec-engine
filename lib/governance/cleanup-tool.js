/**
 * Cleanup Tool
 * 
 * Removes temporary and non-compliant documents
 */

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const FileScanner = require('./file-scanner');

class CleanupTool {
  constructor(projectPath, config) {
    this.projectPath = projectPath;
    this.config = config;
    this.scanner = new FileScanner(projectPath);
    this.deletedFiles = [];
    this.errors = [];
  }
  
  /**
   * Execute cleanup operation
   * 
   * @param {Object} options - Cleanup options
   * @param {boolean} options.dryRun - Preview without deleting
   * @param {boolean} options.interactive - Prompt for each file
   * @param {string} options.spec - Specific Spec to clean
   * @returns {Promise<CleanupReport>}
   */
  async cleanup(options = {}) {
    const filesToDelete = await this.identifyFilesToDelete(options.spec);
    
    if (options.dryRun) {
      return this.generateDryRunReport(filesToDelete);
    }
    
    for (const file of filesToDelete) {
      if (options.interactive) {
        const shouldDelete = await this.promptForConfirmation(file);
        if (!shouldDelete) continue;
      }
      
      await this.deleteFile(file);
    }
    
    return this.generateReport();
  }
  
  /**
   * Identify files to delete
   * 
   * @param {string} specName - Optional specific Spec
   * @returns {Promise<string[]>}
   */
  async identifyFilesToDelete(specName = null) {
    const files = [];
    
    // Scan root directory
    files.push(...await this.scanRootForTemporary());
    
    // Scan Spec directories
    if (specName) {
      files.push(...await this.scanSpecForTemporary(specName));
    } else {
      files.push(...await this.scanAllSpecsForTemporary());
    }
    
    return files;
  }
  
  /**
   * Scan root directory for temporary files
   * 
   * @returns {Promise<string[]>}
   */
  async scanRootForTemporary() {
    const temporaryFiles = [];
    const mdFiles = await this.scanner.findMarkdownFiles(this.projectPath);
    const allowedFiles = this.config.rootAllowedFiles || [];
    const temporaryPatterns = this.config.temporaryPatterns || [];
    
    for (const filePath of mdFiles) {
      const basename = path.basename(filePath);
      
      // If not in allowed list, check if it matches temporary patterns
      if (!allowedFiles.includes(basename)) {
        // Check if it matches any temporary pattern
        if (this.scanner.matchesPattern(filePath, temporaryPatterns)) {
          temporaryFiles.push(filePath);
        }
      }
    }
    
    return temporaryFiles;
  }
  
  /**
   * Scan a specific Spec directory for temporary files
   * 
   * @param {string} specName - Spec name
   * @returns {Promise<string[]>}
   */
  async scanSpecForTemporary(specName) {
    const temporaryFiles = [];
    const specPath = this.scanner.getSpecDirectory(specName);
    
    // Check if Spec directory exists
    if (!await this.scanner.exists(specPath)) {
      return temporaryFiles;
    }
    
    const mdFiles = await this.scanner.findMarkdownFiles(specPath);
    const temporaryPatterns = this.config.temporaryPatterns || [];
    const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
    
    for (const filePath of mdFiles) {
      const basename = path.basename(filePath);
      
      // Don't delete required files even if they match patterns
      if (requiredFiles.includes(basename)) {
        continue;
      }
      
      // Check if it matches any temporary pattern
      if (this.scanner.matchesPattern(filePath, temporaryPatterns)) {
        temporaryFiles.push(filePath);
      }
    }
    
    return temporaryFiles;
  }
  
  /**
   * Scan all Spec directories for temporary files
   * 
   * @returns {Promise<string[]>}
   */
  async scanAllSpecsForTemporary() {
    const temporaryFiles = [];
    const specDirs = await this.scanner.findSpecDirectories();
    
    for (const specDir of specDirs) {
      const specName = path.basename(specDir);
      const specTemporaryFiles = await this.scanSpecForTemporary(specName);
      temporaryFiles.push(...specTemporaryFiles);
    }
    
    return temporaryFiles;
  }
  
  /**
   * Prompt user for confirmation to delete a file
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  async promptForConfirmation(filePath) {
    const relativePath = this.scanner.getRelativePath(filePath);
    
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldDelete',
        message: `Delete ${relativePath}?`,
        default: false
      }
    ]);
    
    return answer.shouldDelete;
  }
  
  /**
   * Delete a file safely
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      await fs.remove(filePath);
      this.deletedFiles.push(filePath);
    } catch (error) {
      this.errors.push({ 
        path: filePath, 
        error: error.message 
      });
    }
  }
  
  /**
   * Generate dry run report
   * 
   * @param {string[]} filesToDelete - Files that would be deleted
   * @returns {CleanupReport}
   */
  generateDryRunReport(filesToDelete) {
    return {
      success: true,
      deletedFiles: filesToDelete,
      errors: [],
      summary: {
        totalDeleted: filesToDelete.length,
        totalErrors: 0
      },
      dryRun: true
    };
  }
  
  /**
   * Generate cleanup report
   * 
   * @returns {CleanupReport}
   */
  generateReport() {
    return {
      success: this.errors.length === 0,
      deletedFiles: this.deletedFiles,
      errors: this.errors,
      summary: {
        totalDeleted: this.deletedFiles.length,
        totalErrors: this.errors.length
      },
      dryRun: false
    };
  }
}

/**
 * @typedef {Object} CleanupReport
 * @property {boolean} success - Whether cleanup succeeded
 * @property {string[]} deletedFiles - Files that were deleted
 * @property {Object[]} errors - Errors encountered
 * @property {Object} summary - Summary statistics
 * @property {boolean} dryRun - Whether this was a dry run
 */

module.exports = CleanupTool;
