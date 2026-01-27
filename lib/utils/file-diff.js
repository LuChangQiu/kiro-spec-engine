/**
 * File Diff Utility
 * 
 * Provides file comparison and diff detection functionality
 */

const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');

class FileDiff {
  /**
   * Calculate file hash
   * 
   * @param {string} filePath - Path to file
   * @param {string} algorithm - Hash algorithm (default: 'md5')
   * @returns {Promise<string>} File hash
   */
  async calculateHash(filePath, algorithm = 'md5') {
    if (!await fs.pathExists(filePath)) {
      return null;
    }
    
    const content = await fs.readFile(filePath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  }
  
  /**
   * Compare two files by content
   * 
   * @param {string} file1Path - Path to first file
   * @param {string} file2Path - Path to second file
   * @returns {Promise<boolean>} True if files are identical
   */
  async areFilesIdentical(file1Path, file2Path) {
    // Check if both files exist
    const file1Exists = await fs.pathExists(file1Path);
    const file2Exists = await fs.pathExists(file2Path);
    
    if (!file1Exists || !file2Exists) {
      return false;
    }
    
    // Compare file sizes first (quick check)
    const stat1 = await fs.stat(file1Path);
    const stat2 = await fs.stat(file2Path);
    
    if (stat1.size !== stat2.size) {
      return false;
    }
    
    // Compare content hashes
    const hash1 = await this.calculateHash(file1Path);
    const hash2 = await this.calculateHash(file2Path);
    
    return hash1 === hash2;
  }
  
  /**
   * Compare multiple file pairs
   * 
   * @param {Array<{source: string, target: string}>} filePairs - Array of file pairs to compare
   * @param {string} projectRoot - Project root path
   * @returns {Promise<Object>} Comparison results
   */
  async compareFiles(filePairs, projectRoot) {
    const results = {
      identical: [],      // Files with same content
      different: [],      // Files with different content
      newFiles: [],       // Files that don't exist in target
      errors: []          // Files that couldn't be compared
    };
    
    for (const pair of filePairs) {
      try {
        const sourcePath = path.isAbsolute(pair.source) 
          ? pair.source 
          : path.join(projectRoot, pair.source);
        const targetPath = path.isAbsolute(pair.target)
          ? pair.target
          : path.join(projectRoot, pair.target);
        
        const targetExists = await fs.pathExists(targetPath);
        
        if (!targetExists) {
          results.newFiles.push({
            source: pair.source,
            target: pair.target,
            reason: 'Target file does not exist'
          });
          continue;
        }
        
        const identical = await this.areFilesIdentical(sourcePath, targetPath);
        
        if (identical) {
          results.identical.push({
            source: pair.source,
            target: pair.target
          });
        } else {
          results.different.push({
            source: pair.source,
            target: pair.target
          });
        }
      } catch (error) {
        results.errors.push({
          source: pair.source,
          target: pair.target,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get file change summary
   * 
   * @param {Object} comparisonResults - Results from compareFiles
   * @returns {Object} Summary statistics
   */
  getSummary(comparisonResults) {
    return {
      total: comparisonResults.identical.length + 
             comparisonResults.different.length + 
             comparisonResults.newFiles.length,
      identical: comparisonResults.identical.length,
      different: comparisonResults.different.length,
      newFiles: comparisonResults.newFiles.length,
      errors: comparisonResults.errors.length,
      needsUpdate: comparisonResults.different.length + comparisonResults.newFiles.length > 0
    };
  }
  
  /**
   * Filter files that need update
   * 
   * @param {Object} comparisonResults - Results from compareFiles
   * @returns {Array} Files that need to be updated
   */
  getFilesNeedingUpdate(comparisonResults) {
    return [
      ...comparisonResults.different.map(f => ({ ...f, action: 'update' })),
      ...comparisonResults.newFiles.map(f => ({ ...f, action: 'create' }))
    ];
  }
  
  /**
   * Check if steering files have changed
   * 
   * @param {string} projectRoot - Project root path
   * @param {string} templateRoot - Template root path
   * @returns {Promise<Object>} Steering files comparison
   */
  async compareSteeringFiles(projectRoot, templateRoot) {
    const steeringFiles = [
      '.kiro/steering/CORE_PRINCIPLES.md',
      '.kiro/steering/ENVIRONMENT.md',
      '.kiro/steering/CURRENT_CONTEXT.md',
      '.kiro/steering/RULES_GUIDE.md',
      '.kiro/specs/SPEC_WORKFLOW_GUIDE.md',
      '.kiro/README.md'
    ];
    
    const filePairs = steeringFiles.map(file => ({
      source: path.join(templateRoot, file),
      target: path.join(projectRoot, file)
    }));
    
    return await this.compareFiles(filePairs, projectRoot);
  }
}

module.exports = FileDiff;
