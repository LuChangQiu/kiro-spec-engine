/**
 * Archive Tool
 * 
 * Organizes Spec artifacts into proper subdirectories
 */

const fs = require('fs-extra');
const path = require('path');
const FileScanner = require('./file-scanner');

class ArchiveTool {
  constructor(projectPath, config) {
    this.projectPath = projectPath;
    this.config = config;
    this.scanner = new FileScanner(projectPath);
    this.movedFiles = [];
    this.errors = [];
  }
  
  /**
   * Archive artifacts in a Spec directory
   * 
   * @param {string} specName - Spec name
   * @param {Object} options - Archive options
   * @param {boolean} options.dryRun - Preview without moving
   * @returns {Promise<ArchiveReport>}
   */
  async archive(specName, options = {}) {
    const specPath = this.scanner.getSpecDirectory(specName);
    
    // Check if Spec directory exists
    if (!await this.scanner.exists(specPath)) {
      this.errors.push({
        path: specPath,
        error: `Spec directory does not exist: ${specName}`
      });
      return this.generateReport();
    }
    
    const artifacts = await this.identifyArtifacts(specPath);
    
    if (options.dryRun) {
      return this.generateDryRunReport(artifacts);
    }
    
    for (const artifact of artifacts) {
      await this.moveArtifact(artifact);
    }
    
    return this.generateReport();
  }
  
  /**
   * Identify artifacts to archive
   * 
   * @param {string} specPath - Path to Spec directory
   * @returns {Promise<Artifact[]>}
   */
  async identifyArtifacts(specPath) {
    const artifacts = [];
    const files = await this.scanner.getFiles(specPath);
    const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
    
    for (const filePath of files) {
      const basename = path.basename(filePath);
      
      // Skip required files
      if (requiredFiles.includes(basename)) {
        continue;
      }
      
      const targetSubdir = this.determineTargetSubdir(basename);
      artifacts.push({
        sourcePath: filePath,
        targetSubdir: targetSubdir,
        filename: basename
      });
    }
    
    return artifacts;
  }
  
  /**
   * Determine target subdirectory for a file
   * 
   * @param {string} filename - File name
   * @returns {string}
   */
  determineTargetSubdir(filename) {
    const lower = filename.toLowerCase();
    
    // Results - check for result keywords FIRST (before test patterns)
    // This ensures "test-results.json" goes to results, not tests
    if (lower.includes('result') || lower.includes('output')) {
      return 'results';
    }
    
    // Tests - check for test patterns (test files, not result files)
    if (lower.endsWith('.test.js') || lower.endsWith('.spec.js') || 
        lower.includes('.test.') || lower.includes('.spec.') ||
        (lower.includes('test') && (lower.endsWith('.js') || lower.endsWith('.py')))) {
      return 'tests';
    }
    
    // Scripts - check for script extensions and keywords
    if (lower.endsWith('.js') || lower.endsWith('.py') || 
        lower.endsWith('.sh') || lower.endsWith('.bat') ||
        lower.includes('script')) {
      return 'scripts';
    }
    
    // Reports - check for report keywords
    if (lower.includes('report') || lower.includes('analysis') || 
        lower.includes('summary') || lower.includes('diagnostic')) {
      return 'reports';
    }
    
    // Data files
    if (lower.includes('data')) {
      return 'results';
    }
    
    // Default to docs for markdown and other documentation files
    return 'docs';
  }
  
  /**
   * Move an artifact to its target subdirectory
   * 
   * @param {Artifact} artifact - Artifact to move
   * @returns {Promise<void>}
   */
  async moveArtifact(artifact) {
    try {
      const targetDir = path.join(
        path.dirname(artifact.sourcePath),
        artifact.targetSubdir
      );
      
      // Ensure target directory exists
      await fs.ensureDir(targetDir);
      
      const targetPath = path.join(targetDir, artifact.filename);
      
      // Check if target file already exists
      if (await fs.pathExists(targetPath)) {
        this.errors.push({
          path: artifact.sourcePath,
          error: `Target file already exists: ${targetPath}`
        });
        return;
      }
      
      await fs.move(artifact.sourcePath, targetPath);
      
      this.movedFiles.push({
        from: artifact.sourcePath,
        to: targetPath
      });
    } catch (error) {
      this.errors.push({
        path: artifact.sourcePath,
        error: error.message
      });
    }
  }
  
  /**
   * Generate dry run report
   * 
   * @param {Artifact[]} artifacts - Artifacts that would be moved
   * @returns {ArchiveReport}
   */
  generateDryRunReport(artifacts) {
    const movedFiles = artifacts.map(artifact => ({
      from: artifact.sourcePath,
      to: path.join(
        path.dirname(artifact.sourcePath),
        artifact.targetSubdir,
        artifact.filename
      )
    }));
    
    return {
      success: true,
      movedFiles: movedFiles,
      errors: [],
      summary: {
        totalMoved: movedFiles.length,
        totalErrors: 0
      },
      dryRun: true
    };
  }
  
  /**
   * Generate archive report
   * 
   * @returns {ArchiveReport}
   */
  generateReport() {
    return {
      success: this.errors.length === 0,
      movedFiles: this.movedFiles,
      errors: this.errors,
      summary: {
        totalMoved: this.movedFiles.length,
        totalErrors: this.errors.length
      },
      dryRun: false
    };
  }
}

/**
 * @typedef {Object} Artifact
 * @property {string} sourcePath - Current file path
 * @property {string} targetSubdir - Target subdirectory name
 * @property {string} filename - File name
 */

/**
 * @typedef {Object} ArchiveReport
 * @property {boolean} success - Whether archiving succeeded
 * @property {Object[]} movedFiles - Files that were moved
 * @property {Object[]} errors - Errors encountered
 * @property {Object} summary - Summary statistics
 * @property {boolean} dryRun - Whether this was a dry run
 */

module.exports = ArchiveTool;
