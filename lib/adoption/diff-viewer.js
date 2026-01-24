/**
 * Diff Viewer
 * 
 * Displays file differences in a user-friendly format for conflict review.
 * Shows metadata comparison and text diffs for files during adoption.
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const { pathExists } = require('../utils/fs-utils');

/**
 * DiffViewer class for displaying file comparisons
 */
class DiffViewer {
  /**
   * Gets file metadata for comparison
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<FileMetadata>}
   */
  async getFileMetadata(filePath) {
    const exists = await pathExists(filePath);
    
    if (!exists) {
      return {
        path: filePath,
        size: 0,
        sizeFormatted: '0 B',
        modified: null,
        modifiedFormatted: 'N/A',
        isText: false,
        isBinary: false,
        exists: false
      };
    }
    
    const stats = await fs.stat(filePath);
    const size = stats.size;
    const modified = stats.mtime.toISOString();
    
    // Format size
    const sizeFormatted = this.formatSize(size);
    
    // Format date
    const modifiedFormatted = this.formatDate(stats.mtime);
    
    // Detect if file is text or binary
    const isText = await this.isTextFile(filePath);
    const isBinary = !isText;
    
    return {
      path: filePath,
      size,
      sizeFormatted,
      modified,
      modifiedFormatted,
      isText,
      isBinary,
      exists: true
    };
  }

  /**
   * Formats file size in human-readable format
   * 
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Formats date in human-readable format
   * 
   * @param {Date} date - Date object
   * @returns {string}
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Detects if a file is text or binary
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  async isTextFile(filePath) {
    try {
      // Read first 8KB to detect binary content
      const buffer = Buffer.alloc(8192);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fd.read(buffer, 0, 8192, 0);
      await fd.close();
      
      // Check for null bytes (common in binary files)
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      // If we can't read it, assume binary
      return false;
    }
  }

  /**
   * Displays a summary diff between existing and template files
   * 
   * @param {string} existingPath - Path to existing file
   * @param {string} templatePath - Path to template file
   * @returns {Promise<void>}
   */
  async showDiff(existingPath, templatePath) {
    console.log();
    console.log(chalk.blue('═══════════════════════════════════════════════════════'));
    console.log(chalk.blue('Comparing:'), chalk.cyan(path.basename(existingPath)));
    console.log(chalk.blue('═══════════════════════════════════════════════════════'));
    console.log();
    
    // Get metadata for both files
    const existingMeta = await this.getFileMetadata(existingPath);
    const templateMeta = await this.getFileMetadata(templatePath);
    
    // Display metadata comparison
    console.log(chalk.yellow('Existing File:'));
    console.log(`  Size: ${existingMeta.sizeFormatted}`);
    console.log(`  Modified: ${existingMeta.modifiedFormatted}`);
    console.log();
    
    console.log(chalk.green('Template File:'));
    console.log(`  Size: ${templateMeta.sizeFormatted}`);
    console.log(`  Modified: ${templateMeta.modifiedFormatted}`);
    console.log();
    
    // Show diff content if both are text files
    if (existingMeta.isText && templateMeta.isText) {
      await this.showLineDiff(existingPath, templatePath, 10);
    } else if (existingMeta.isBinary || templateMeta.isBinary) {
      console.log(chalk.gray('⚠️  Binary file - detailed diff not available'));
      console.log(chalk.gray('   Open files in an editor to compare'));
    }
    
    console.log();
    console.log(chalk.blue('═══════════════════════════════════════════════════════'));
    console.log();
  }

  /**
   * Displays first N lines of differences
   * 
   * @param {string} existingPath - Path to existing file
   * @param {string} templatePath - Path to template file
   * @param {number} maxLines - Maximum lines to show (default: 10)
   * @returns {Promise<void>}
   */
  async showLineDiff(existingPath, templatePath, maxLines = 10) {
    try {
      const existingContent = await fs.readFile(existingPath, 'utf-8');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      
      const existingLines = existingContent.split('\n');
      const templateLines = templateContent.split('\n');
      
      console.log(chalk.blue('First differences:'));
      console.log();
      
      let diffsShown = 0;
      const maxLineNum = Math.max(existingLines.length, templateLines.length);
      
      for (let i = 0; i < maxLineNum && diffsShown < maxLines; i++) {
        const existingLine = existingLines[i] || '';
        const templateLine = templateLines[i] || '';
        
        if (existingLine !== templateLine) {
          console.log(chalk.gray(`  Line ${i + 1}:`));
          
          if (existingLine) {
            console.log(chalk.red(`    - ${existingLine.substring(0, 80)}`));
          }
          
          if (templateLine) {
            console.log(chalk.green(`    + ${templateLine.substring(0, 80)}`));
          }
          
          console.log();
          diffsShown++;
        }
      }
      
      if (diffsShown === 0) {
        console.log(chalk.gray('  No differences found in first 10 lines'));
        console.log();
      } else if (diffsShown >= maxLines) {
        console.log(chalk.gray(`  ... (showing first ${maxLines} differences)`));
        console.log();
      }
      
      console.log(chalk.gray('[Note: Full diff available by opening files in editor]'));
    } catch (error) {
      console.log(chalk.red('⚠️  Unable to generate diff'));
      console.log(chalk.gray(`   ${error.message}`));
    }
  }
}

module.exports = DiffViewer;
