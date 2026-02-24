/**
 * Template Sync System
 * 
 * Automatically synchronizes template files with project files.
 * Detects content differences and updates only changed files.
 * Preserves user-specific files like CURRENT_CONTEXT.md.
 */

const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const { pathExists } = require('../utils/fs-utils');
const { FileClassifier, FileCategory } = require('./file-classifier');

/**
 * Template Sync System
 * 
 * Compares template files with project files and synchronizes
 * only the files that have changed.
 */
class TemplateSync {
  constructor() {
    this.fileClassifier = new FileClassifier();
    
    // Template files to sync (relative to .sce/)
    this.templateFiles = [
      'steering/CORE_PRINCIPLES.md',
      'steering/ENVIRONMENT.md',
      'steering/RULES_GUIDE.md',
      'tools/ultrawork_enhancer.py',
      'README.md',
      'ultrawork-application-guide.md',
      'ultrawork-integration-summary.md',
      'sisyphus-deep-dive.md'
    ];
    
    // Files to always preserve (never sync)
    this.preserveFiles = [
      'steering/CURRENT_CONTEXT.md'
    ];
  }

  /**
   * Detect differences between template and project files
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {string} templatePath - Absolute path to template directory
   * @returns {Promise<SyncReport>} Sync report with differences
   */
  async detectTemplateDifferences(projectPath, templatePath) {
    const differences = {
      missing: [],      // Files that don't exist in project
      different: [],    // Files with different content
      identical: [],    // Files with identical content
      preserved: [],    // Files that should be preserved
      errors: []        // Files that couldn't be compared
    };

    const kiroPath = path.join(projectPath, '.sce');

    for (const templateFile of this.templateFiles) {
      try {
        // Check if file should be preserved
        if (this.shouldPreserve(templateFile)) {
          differences.preserved.push({
            path: templateFile,
            reason: 'User-specific file'
          });
          continue;
        }

        const projectFilePath = path.join(kiroPath, templateFile);
        const templateFilePath = path.join(templatePath, templateFile);

        // Check if template file exists
        const templateExists = await pathExists(templateFilePath);
        if (!templateExists) {
          differences.errors.push({
            path: templateFile,
            error: 'Template file not found'
          });
          continue;
        }

        // Check if project file exists
        const projectExists = await pathExists(projectFilePath);
        if (!projectExists) {
          differences.missing.push({
            path: templateFile,
            templatePath: templateFilePath,
            projectPath: projectFilePath
          });
          continue;
        }

        // Compare file contents
        const isDifferent = await this.compareFiles(projectFilePath, templateFilePath);
        
        if (isDifferent) {
          differences.different.push({
            path: templateFile,
            templatePath: templateFilePath,
            projectPath: projectFilePath
          });
        } else {
          differences.identical.push({
            path: templateFile
          });
        }
      } catch (error) {
        differences.errors.push({
          path: templateFile,
          error: error.message
        });
      }
    }

    return {
      differences,
      summary: {
        total: this.templateFiles.length,
        missing: differences.missing.length,
        different: differences.different.length,
        identical: differences.identical.length,
        preserved: differences.preserved.length,
        errors: differences.errors.length,
        needsSync: differences.missing.length + differences.different.length
      }
    };
  }

  /**
   * Compare two files for differences
   * 
   * @param {string} file1Path - Path to first file
   * @param {string} file2Path - Path to second file
   * @returns {Promise<boolean>} True if files are different
   */
  async compareFiles(file1Path, file2Path) {
    try {
      // Check if either file is binary
      const isBinary1 = await this.isBinaryFile(file1Path);
      const isBinary2 = await this.isBinaryFile(file2Path);

      if (isBinary1 || isBinary2) {
        // For binary files, compare file sizes and hashes
        return await this.compareBinaryFiles(file1Path, file2Path);
      } else {
        // For text files, compare content hashes
        return await this.compareTextFiles(file1Path, file2Path);
      }
    } catch (error) {
      throw new Error(`Failed to compare files: ${error.message}`);
    }
  }

  /**
   * Compare text files by content hash
   * 
   * @param {string} file1Path - Path to first file
   * @param {string} file2Path - Path to second file
   * @returns {Promise<boolean>} True if files are different
   */
  async compareTextFiles(file1Path, file2Path) {
    try {
      const content1 = await fs.readFile(file1Path, 'utf8');
      const content2 = await fs.readFile(file2Path, 'utf8');

      // Normalize line endings for comparison
      const normalized1 = this.normalizeLineEndings(content1);
      const normalized2 = this.normalizeLineEndings(content2);

      // Compare hashes
      const hash1 = this.calculateHash(normalized1);
      const hash2 = this.calculateHash(normalized2);

      return hash1 !== hash2;
    } catch (error) {
      throw new Error(`Failed to compare text files: ${error.message}`);
    }
  }

  /**
   * Compare binary files by size and hash
   * 
   * @param {string} file1Path - Path to first file
   * @param {string} file2Path - Path to second file
   * @returns {Promise<boolean>} True if files are different
   */
  async compareBinaryFiles(file1Path, file2Path) {
    try {
      // Compare file sizes first (quick check)
      const stats1 = await fs.stat(file1Path);
      const stats2 = await fs.stat(file2Path);

      if (stats1.size !== stats2.size) {
        return true; // Different sizes = different files
      }

      // Compare content hashes
      const content1 = await fs.readFile(file1Path);
      const content2 = await fs.readFile(file2Path);

      const hash1 = this.calculateHash(content1);
      const hash2 = this.calculateHash(content2);

      return hash1 !== hash2;
    } catch (error) {
      throw new Error(`Failed to compare binary files: ${error.message}`);
    }
  }

  /**
   * Check if a file is binary
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if file is binary
   */
  async isBinaryFile(filePath) {
    try {
      // Check file extension first
      const ext = path.extname(filePath).toLowerCase();
      const textExtensions = ['.md', '.txt', '.json', '.js', '.py', '.yml', '.yaml', '.xml', '.html', '.css'];
      
      if (textExtensions.includes(ext)) {
        return false;
      }

      // For unknown extensions, read first few bytes
      const buffer = Buffer.alloc(512);
      const fd = await fs.open(filePath, 'r');
      
      try {
        const { bytesRead } = await fs.read(fd, buffer, 0, 512, 0);
        
        // Check for null bytes (common in binary files)
        for (let i = 0; i < bytesRead; i++) {
          if (buffer[i] === 0) {
            return true;
          }
        }
        
        return false;
      } finally {
        await fs.close(fd);
      }
    } catch (error) {
      // If we can't determine, assume text
      return false;
    }
  }

  /**
   * Normalize line endings to LF
   * 
   * @param {string} content - File content
   * @returns {string} Normalized content
   */
  normalizeLineEndings(content) {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /**
   * Calculate SHA-256 hash of content
   * 
   * @param {string|Buffer} content - Content to hash
   * @returns {string} Hex hash
   */
  calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a file should be preserved
   * 
   * @param {string} filePath - File path relative to .sce/
   * @returns {boolean} True if file should be preserved
   */
  shouldPreserve(filePath) {
    const normalized = this.normalizeFilePath(filePath);
    return this.preserveFiles.some(preserve => 
      normalized === preserve || normalized.endsWith('/' + preserve)
    );
  }

  /**
   * Normalize file path
   * 
   * @param {string} filePath - File path
   * @returns {string} Normalized path
   */
  normalizeFilePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Synchronize templates to project
   * 
   * @param {string} projectPath - Absolute path to project root
   * @param {string} templatePath - Absolute path to template directory
   * @param {Object} options - Sync options
   * @param {boolean} options.dryRun - Preview without executing
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<SyncResult>} Sync result
   */
  async syncTemplates(projectPath, templatePath, options = {}) {
    const { dryRun = false, onProgress = null } = options;

    // Detect differences first
    const report = await this.detectTemplateDifferences(projectPath, templatePath);

    if (dryRun) {
      return {
        dryRun: true,
        report,
        synced: [],
        errors: []
      };
    }

    const synced = [];
    const errors = [];
    const kiroPath = path.join(projectPath, '.sce');

    // Sync missing files
    for (const missing of report.differences.missing) {
      try {
        if (onProgress) {
          onProgress({
            type: 'create',
            file: missing.path,
            status: 'in-progress'
          });
        }

        // Ensure directory exists
        const targetDir = path.dirname(missing.projectPath);
        await fs.ensureDir(targetDir);

        // Copy file
        await fs.copy(missing.templatePath, missing.projectPath);

        synced.push({
          path: missing.path,
          action: 'created'
        });

        if (onProgress) {
          onProgress({
            type: 'create',
            file: missing.path,
            status: 'complete'
          });
        }
      } catch (error) {
        errors.push({
          path: missing.path,
          error: error.message
        });

        if (onProgress) {
          onProgress({
            type: 'create',
            file: missing.path,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    // Sync different files
    for (const different of report.differences.different) {
      try {
        if (onProgress) {
          onProgress({
            type: 'update',
            file: different.path,
            status: 'in-progress'
          });
        }

        // Ensure directory exists
        const targetDir = path.dirname(different.projectPath);
        await fs.ensureDir(targetDir);

        // Copy file (overwrite)
        await fs.copy(different.templatePath, different.projectPath);

        synced.push({
          path: different.path,
          action: 'updated'
        });

        if (onProgress) {
          onProgress({
            type: 'update',
            file: different.path,
            status: 'complete'
          });
        }
      } catch (error) {
        errors.push({
          path: different.path,
          error: error.message
        });

        if (onProgress) {
          onProgress({
            type: 'update',
            file: different.path,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    return {
      dryRun: false,
      report,
      synced,
      errors,
      summary: {
        total: synced.length + errors.length,
        synced: synced.length,
        errors: errors.length,
        created: synced.filter(s => s.action === 'created').length,
        updated: synced.filter(s => s.action === 'updated').length
      }
    };
  }

  /**
   * Get sync report summary as formatted string
   * 
   * @param {SyncReport} report - Sync report
   * @returns {string} Formatted summary
   */
  formatSyncReport(report) {
    const lines = [];

    lines.push('Template Sync Report:');
    lines.push(`  Total templates: ${report.summary.total}`);
    lines.push(`  Needs sync: ${report.summary.needsSync}`);
    lines.push(`    Missing: ${report.summary.missing}`);
    lines.push(`    Different: ${report.summary.different}`);
    lines.push(`  Up-to-date: ${report.summary.identical}`);
    lines.push(`  Preserved: ${report.summary.preserved}`);
    
    if (report.summary.errors > 0) {
      lines.push(`  Errors: ${report.summary.errors}`);
    }

    if (report.differences.missing.length > 0) {
      lines.push('');
      lines.push('Missing files:');
      report.differences.missing.forEach(file => {
        lines.push(`  - ${file.path}`);
      });
    }

    if (report.differences.different.length > 0) {
      lines.push('');
      lines.push('Different files:');
      report.differences.different.forEach(file => {
        lines.push(`  - ${file.path}`);
      });
    }

    if (report.differences.preserved.length > 0) {
      lines.push('');
      lines.push('Preserved files:');
      report.differences.preserved.forEach(file => {
        lines.push(`  - ${file.path} (${file.reason})`);
      });
    }

    if (report.differences.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      report.differences.errors.forEach(file => {
        lines.push(`  - ${file.path}: ${file.error}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Get sync result summary as formatted string
   * 
   * @param {SyncResult} result - Sync result
   * @returns {string} Formatted summary
   */
  formatSyncResult(result) {
    const lines = [];

    if (result.dryRun) {
      lines.push('Dry Run - No changes made');
      lines.push('');
      lines.push(this.formatSyncReport(result.report));
      return lines.join('\n');
    }

    lines.push('Template Sync Complete:');
    lines.push(`  Total: ${result.summary.total}`);
    lines.push(`  Synced: ${result.summary.synced}`);
    lines.push(`    Created: ${result.summary.created}`);
    lines.push(`    Updated: ${result.summary.updated}`);
    
    if (result.summary.errors > 0) {
      lines.push(`  Errors: ${result.summary.errors}`);
    }

    if (result.synced.length > 0) {
      lines.push('');
      lines.push('Synced files:');
      result.synced.forEach(file => {
        const icon = file.action === 'created' ? '✨' : '📝';
        lines.push(`  ${icon} ${file.path} (${file.action})`);
      });
    }

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      result.errors.forEach(file => {
        lines.push(`  ❌ ${file.path}: ${file.error}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Get list of template files
   * 
   * @returns {string[]} Template file paths
   */
  getTemplateFiles() {
    return [...this.templateFiles];
  }

  /**
   * Get list of preserved files
   * 
   * @returns {string[]} Preserved file paths
   */
  getPreservedFiles() {
    return [...this.preserveFiles];
  }

  /**
   * Add template file to sync list
   * 
   * @param {string} filePath - File path relative to .sce/
   */
  addTemplateFile(filePath) {
    const normalized = this.normalizeFilePath(filePath);
    if (!this.templateFiles.includes(normalized)) {
      this.templateFiles.push(normalized);
    }
  }

  /**
   * Remove template file from sync list
   * 
   * @param {string} filePath - File path relative to .sce/
   */
  removeTemplateFile(filePath) {
    const normalized = this.normalizeFilePath(filePath);
    const index = this.templateFiles.indexOf(normalized);
    if (index !== -1) {
      this.templateFiles.splice(index, 1);
    }
  }

  /**
   * Add file to preserve list
   * 
   * @param {string} filePath - File path relative to .sce/
   */
  addPreservedFile(filePath) {
    const normalized = this.normalizeFilePath(filePath);
    if (!this.preserveFiles.includes(normalized)) {
      this.preserveFiles.push(normalized);
    }
  }

  /**
   * Remove file from preserve list
   * 
   * @param {string} filePath - File path relative to .sce/
   */
  removePreservedFile(filePath) {
    const normalized = this.normalizeFilePath(filePath);
    const index = this.preserveFiles.indexOf(normalized);
    if (index !== -1) {
      this.preserveFiles.splice(index, 1);
    }
  }
}

module.exports = TemplateSync;
