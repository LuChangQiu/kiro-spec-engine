/**
 * SpecReader - Reads and validates Spec files from .kiro/specs/ directory
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class SpecReader {
  constructor() {
    this.specsDir = '.kiro/specs';
  }

  /**
   * Finds a Spec by identifier (number or name)
   * @param {string} identifier - Spec number (e.g., '23-00') or name
   * @returns {Promise<Object>} Spec information
   */
  async findSpec(identifier) {
    const normalizedId = identifier.toLowerCase().trim();
    
    try {
      const entries = await fs.readdir(this.specsDir, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      // Try exact match first
      let matchedDir = specDirs.find(dir => {
        const dirName = dir.name.toLowerCase();
        return dirName === normalizedId || 
               dirName.startsWith(`${normalizedId}-`) ||
               dirName.includes(`-${normalizedId}`);
      });
      
      // If no exact match, try partial match
      if (!matchedDir) {
        matchedDir = specDirs.find(dir => 
          dir.name.toLowerCase().includes(normalizedId)
        );
      }
      
      if (!matchedDir) {
        throw new Error(`Spec not found: ${identifier}`);
      }
      
      const specPath = path.join(this.specsDir, matchedDir.name);
      return {
        name: matchedDir.name,
        path: specPath,
        number: this.extractSpecNumber(matchedDir.name),
        kebabName: this.extractKebabName(matchedDir.name)
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Specs directory not found: ${this.specsDir}`);
      }
      throw error;
    }
  }

  /**
   * Validates that all required files exist
   * @param {string} specPath - Path to Spec directory
   * @returns {Promise<Object>} Validation result
   */
  async validateSpecStructure(specPath) {
    const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
    const missingFiles = [];
    const existingFiles = [];
    
    for (const file of requiredFiles) {
      const filePath = path.join(specPath, file);
      try {
        await fs.access(filePath);
        existingFiles.push(file);
      } catch {
        missingFiles.push(file);
      }
    }
    
    return {
      valid: missingFiles.length === 0,
      missingFiles,
      existingFiles
    };
  }

  /**
   * Reads all Spec files
   * @param {string} specPath - Path to Spec directory
   * @returns {Promise<Object>} File contents
   */
  async readSpecFiles(specPath) {
    const files = ['requirements.md', 'design.md', 'tasks.md'];
    const contents = {};
    
    for (const file of files) {
      const filePath = path.join(specPath, file);
      try {
        contents[file] = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        contents[file] = null;
      }
    }
    
    return contents;
  }

  /**
   * Extracts Spec metadata (name, number, dates)
   * @param {string} specPath - Path to Spec directory
   * @param {Object} fileContents - File contents
   * @returns {Object} Extracted metadata
   */
  extractSpecMetadata(specPath, fileContents) {
    const specName = path.basename(specPath);
    const specNumber = this.extractSpecNumber(specName);
    const kebabName = this.extractKebabName(specName);
    const titleName = this.kebabToTitle(kebabName);
    
    // Extract dates from file stats
    const dates = this.extractDates(specPath);
    
    // Extract author from git config or content
    const author = this.extractAuthor(fileContents);
    
    return {
      specNumber,
      specName: kebabName,
      specNameTitle: titleName,
      specPath,
      fullDirName: specName,
      author,
      dates
    };
  }

  /**
   * Extracts Spec number from directory name
   * @param {string} dirName - Directory name
   * @returns {string} Spec number
   */
  extractSpecNumber(dirName) {
    const match = dirName.match(/^(\d+-\d+)/);
    return match ? match[1] : '';
  }

  /**
   * Extracts kebab-case name from directory name
   * @param {string} dirName - Directory name
   * @returns {string} Kebab-case name
   */
  extractKebabName(dirName) {
    // Remove spec number prefix
    const withoutNumber = dirName.replace(/^\d+-\d+-/, '');
    return withoutNumber;
  }

  /**
   * Converts kebab-case to Title Case
   * @param {string} kebabStr - Kebab-case string
   * @returns {string} Title case string
   */
  kebabToTitle(kebabStr) {
    return kebabStr
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Extracts dates from file system
   * @param {string} specPath - Path to Spec directory
   * @returns {Object} Dates
   */
  extractDates(specPath) {
    try {
      const stats = require('fs').statSync(specPath);
      return {
        created: stats.birthtime.toISOString().split('T')[0],
        modified: stats.mtime.toISOString().split('T')[0]
      };
    } catch {
      const today = new Date().toISOString().split('T')[0];
      return {
        created: today,
        modified: today
      };
    }
  }

  /**
   * Extracts author from git config or content
   * @param {Object} fileContents - File contents
   * @returns {string} Author name
   */
  extractAuthor(fileContents) {
    // Try git config first
    try {
      const gitUser = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      if (gitUser) return gitUser;
    } catch {
      // Git not available or not configured
    }
    
    // Try to find author in content
    const allContent = Object.values(fileContents).join('\n');
    const authorMatch = allContent.match(/(?:Author|Created by|Written by):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (authorMatch) {
      return authorMatch[1];
    }
    
    return 'Unknown';
  }
}

module.exports = SpecReader;
