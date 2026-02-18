/**
 * GitignoreTransformer - Transforms .gitignore to use layered strategy
 * 
 * Removes old blanket exclusion patterns and adds layered exclusion rules
 * while preserving user customizations.
 */

const LAYERED_RULES_TEMPLATE = require('./layered-rules-template');

/**
 * @typedef {Object} TransformResult
 * @property {string} content - New .gitignore content
 * @property {string[]} added - Rules added
 * @property {string[]} removed - Rules removed
 * @property {string[]} preserved - User rules preserved
 */

class GitignoreTransformer {
  constructor() {
    // Old patterns to remove
    this.OLD_PATTERNS = [
      /^\.kiro\/?\s*$/,
      /^\.kiro\/\*\s*$/,
      /^\.kiro\/\*\*\s*$/
    ];
  }

  /**
   * Applies layered strategy to .gitignore
   * 
   * @param {string} currentContent - Current .gitignore content (or empty)
   * @param {Object} status - Detection status
   * @returns {TransformResult}
   */
  transform(currentContent, status) {
    const result = {
      content: '',
      added: [],
      removed: [],
      preserved: []
    };
    
    if (status.strategy === 'skip') {
      // Already compliant, no changes needed
      result.content = currentContent;
      return result;
    }
    
    if (status.strategy === 'add') {
      // Missing .gitignore, create new one
      result.content = LAYERED_RULES_TEMPLATE;
      result.added = this.extractRulePatterns(LAYERED_RULES_TEMPLATE);
      return result;
    }
    
    if (status.strategy === 'update') {
      // Remove old patterns and add layered rules
      const cleaned = this.removeOldPatterns(currentContent, result);
      result.content = this.addLayeredRules(cleaned);
      result.added = this.extractRulePatterns(LAYERED_RULES_TEMPLATE);
      
      // Track preserved rules
      const lines = currentContent.split(/\r?\n/);
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !this.isOldPattern(trimmed)) {
          if (!trimmed.includes('.kiro')) {
            result.preserved.push(trimmed);
          }
        }
      });
    }
    
    return result;
  }

  /**
   * Removes old blanket exclusion patterns
   * 
   * @param {string} content - .gitignore content
   * @param {TransformResult} result - Result object to track removed patterns
   * @returns {string} - Content with old patterns removed
   */
  removeOldPatterns(content, result) {
    // Detect line ending style
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    
    const lines = content.split(/\r?\n/);
    const filtered = [];
    let inManagedSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Track sce-managed section
      if (trimmed.includes('sce - DO NOT EDIT THIS SECTION')) {
        inManagedSection = true;
        continue; // Skip managed section start
      } else if (trimmed.includes('End of sce-managed section')) {
        inManagedSection = false;
        continue; // Skip managed section end
      }
      
      // Skip lines in managed section
      if (inManagedSection) {
        continue;
      }
      
      // Check if line is old pattern
      if (this.isOldPattern(trimmed)) {
        result.removed.push(trimmed);
        continue; // Skip old pattern
      }
      
      // Preserve line
      filtered.push(line);
    }
    
    return filtered.join(lineEnding);
  }

  /**
   * Checks if pattern is an old blanket exclusion
   * 
   * @param {string} pattern - Pattern to check
   * @returns {boolean}
   */
  isOldPattern(pattern) {
    for (const regex of this.OLD_PATTERNS) {
      if (regex.test(pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Adds layered exclusion rules
   * 
   * @param {string} content - .gitignore content
   * @returns {string} - Content with layered rules added
   */
  addLayeredRules(content) {
    // Detect line ending style from existing content
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    
    // Ensure content ends with newline
    let result = content.trim();
    
    if (result) {
      result += lineEnding + lineEnding;
    }
    
    // Convert template to match line ending style
    const template = LAYERED_RULES_TEMPLATE.replace(/\n/g, lineEnding);
    
    // Add layered rules section
    result += template;
    
    return result;
  }

  /**
   * Generates layered rules section
   * 
   * @returns {string}
   */
  generateLayeredSection() {
    return LAYERED_RULES_TEMPLATE;
  }

  /**
   * Extracts rule patterns from template (for reporting)
   * 
   * @param {string} template - Template content
   * @returns {string[]} - Rule patterns
   */
  extractRulePatterns(template) {
    const lines = template.split(/\r?\n/);
    const patterns = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('=')) {
        patterns.push(trimmed);
      }
    }
    
    return patterns;
  }
}

module.exports = GitignoreTransformer;
