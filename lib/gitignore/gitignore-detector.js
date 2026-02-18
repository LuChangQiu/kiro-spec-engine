/**
 * GitignoreDetector - Analyzes .gitignore status
 * 
 * Detects .gitignore file existence, parses content, identifies old patterns,
 * and determines the appropriate fix strategy.
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * @typedef {Object} GitignoreRule
 * @property {string} pattern - Rule pattern (e.g., '.kiro/backups/')
 * @property {string} type - 'exclusion' | 'negation' | 'comment'
 * @property {number} line - Line number in file
 * @property {boolean} isKiroRelated - Rule relates to .kiro/
 * @property {boolean} isManaged - Rule is in sce-managed section
 */

/**
 * @typedef {Object} GitignoreStatus
 * @property {boolean} exists - .gitignore file exists
 * @property {string} status - 'missing' | 'old-pattern' | 'incomplete' | 'compliant'
 * @property {string} strategy - 'add' | 'update' | 'skip'
 * @property {string[]} oldPatterns - Old patterns found
 * @property {string[]} missingRules - Missing layered rules
 * @property {string} content - Current .gitignore content
 */

class GitignoreDetector {
  constructor() {
    // Old patterns that indicate blanket exclusion
    this.OLD_PATTERNS = [
      /^\.kiro\/?\s*$/,           // .kiro/ or .kiro
      /^\.kiro\/\*\s*$/,          // .kiro/*
      /^\.kiro\/\*\*\s*$/         // .kiro/**
    ];
    
    // Required layered rules (key patterns to check)
    this.REQUIRED_RULES = [
      '.kiro/steering/CURRENT_CONTEXT.md',
      '.kiro/contexts/.active',
      '.kiro/environments.json',
      '.kiro/backups/',
      '.kiro/logs/',
      '.kiro/reports/'
    ];
  }

  /**
   * Analyzes .gitignore status
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<GitignoreStatus>}
   */
  async analyzeGitignore(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    
    // Check if .gitignore exists
    const fileExists = await this.exists(projectPath);
    
    if (!fileExists) {
      return {
        exists: false,
        status: 'missing',
        strategy: 'add',
        oldPatterns: [],
        missingRules: [...this.REQUIRED_RULES],
        content: ''
      };
    }
    
    // Read and parse .gitignore
    const content = await fs.readFile(gitignorePath, 'utf8');
    const rules = this.parseGitignore(content);
    
    // Check for old patterns
    const oldPatterns = this.findOldPatterns(rules);
    const hasOld = oldPatterns.length > 0;
    
    // Check for layered strategy
    const missingRules = this.findMissingRules(rules);
    const hasLayered = missingRules.length === 0;
    
    // Determine status and strategy
    let status, strategy;
    
    if (hasOld) {
      status = 'old-pattern';
      strategy = 'update';
    } else if (!hasLayered) {
      status = 'incomplete';
      strategy = 'update';
    } else {
      status = 'compliant';
      strategy = 'skip';
    }
    
    return {
      exists: true,
      status,
      strategy,
      oldPatterns,
      missingRules,
      content
    };
  }

  /**
   * Checks if .gitignore exists
   * 
   * @param {string} projectPath - Project root path
   * @returns {Promise<boolean>}
   */
  async exists(projectPath) {
    const gitignorePath = path.join(projectPath, '.gitignore');
    return await fs.pathExists(gitignorePath);
  }

  /**
   * Parses .gitignore content into rules
   * 
   * @param {string} content - .gitignore file content
   * @returns {GitignoreRule[]}
   */
  parseGitignore(content) {
    const lines = content.split(/\r?\n/);
    const rules = [];
    let inManagedSection = false;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Track sce-managed section
      if (trimmed.includes('sce - DO NOT EDIT THIS SECTION')) {
        inManagedSection = true;
      } else if (trimmed.includes('End of sce-managed section')) {
        inManagedSection = false;
      }
      
      // Determine rule type
      let type = 'exclusion';
      let pattern = trimmed;
      
      if (trimmed.startsWith('#')) {
        type = 'comment';
      } else if (trimmed.startsWith('!')) {
        type = 'negation';
        pattern = trimmed.substring(1);
      } else if (trimmed === '') {
        return; // Skip blank lines
      }
      
      // Check if .kiro-related
      const isKiroRelated = pattern.includes('.kiro');
      
      rules.push({
        pattern: trimmed,
        type,
        line: index + 1,
        isKiroRelated,
        isManaged: inManagedSection
      });
    });
    
    return rules;
  }

  /**
   * Finds old blanket exclusion patterns
   * 
   * @param {GitignoreRule[]} rules - Parsed rules
   * @returns {string[]} - Old patterns found
   */
  findOldPatterns(rules) {
    const oldPatterns = [];
    
    for (const rule of rules) {
      if (rule.type === 'exclusion' && rule.isKiroRelated) {
        for (const pattern of this.OLD_PATTERNS) {
          if (pattern.test(rule.pattern)) {
            oldPatterns.push(rule.pattern);
            break;
          }
        }
      }
    }
    
    return oldPatterns;
  }

  /**
   * Finds missing layered rules
   * 
   * @param {GitignoreRule[]} rules - Parsed rules
   * @returns {string[]} - Missing rules
   */
  findMissingRules(rules) {
    const existingPatterns = rules
      .filter(r => r.type === 'exclusion')
      .map(r => r.pattern);
    
    const missing = [];
    
    for (const required of this.REQUIRED_RULES) {
      const found = existingPatterns.some(pattern => 
        pattern.includes(required) || required.includes(pattern)
      );
      
      if (!found) {
        missing.push(required);
      }
    }
    
    return missing;
  }

  /**
   * Detects if .gitignore has old pattern
   * 
   * @param {GitignoreRule[]} rules - Parsed rules
   * @returns {boolean}
   */
  hasOldPattern(rules) {
    return this.findOldPatterns(rules).length > 0;
  }

  /**
   * Checks if layered strategy is present
   * 
   * @param {GitignoreRule[]} rules - Parsed rules
   * @returns {boolean}
   */
  hasLayeredStrategy(rules) {
    return this.findMissingRules(rules).length === 0;
  }
}

module.exports = GitignoreDetector;
