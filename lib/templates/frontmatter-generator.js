/**
 * FrontmatterGenerator - Generates YAML frontmatter for template files
 */

const yaml = require('js-yaml');

class FrontmatterGenerator {
  constructor() {}

  /**
   * Generates YAML frontmatter
   * @param {Object} metadata - Template metadata
   * @returns {string} YAML frontmatter block
   */
  generateFrontmatter(metadata) {
    const frontmatterData = {
      name: metadata.name,
      category: metadata.category,
      description: metadata.description,
      tags: metadata.tags || [],
      author: metadata.author,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      version: metadata.version,
      kse_version: metadata.kse_version
    };

    // Add optional fields if present
    if (metadata.difficulty) {
      frontmatterData.difficulty = metadata.difficulty;
    }
    if (metadata.applicable_scenarios) {
      frontmatterData.applicable_scenarios = metadata.applicable_scenarios;
    }

    try {
      const yamlContent = yaml.dump(frontmatterData, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      return `---\n${yamlContent}---\n`;
    } catch (error) {
      throw new Error(`Failed to generate YAML frontmatter: ${error.message}`);
    }
  }

  /**
   * Adds frontmatter to file content
   * @param {string} content - Original content
   * @param {string} frontmatter - YAML frontmatter
   * @returns {string} Content with frontmatter
   */
  addFrontmatter(content, frontmatter) {
    // Remove existing frontmatter if present
    const withoutFrontmatter = this.removeFrontmatter(content);
    
    // Add new frontmatter
    return frontmatter + '\n' + withoutFrontmatter;
  }

  /**
   * Removes existing frontmatter from content
   * @param {string} content - Content with possible frontmatter
   * @returns {string} Content without frontmatter
   */
  removeFrontmatter(content) {
    // Check if content starts with frontmatter
    if (!content.trim().startsWith('---')) {
      return content;
    }

    // Find the closing ---
    const lines = content.split('\n');
    let endIndex = -1;
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      // No closing ---, return original content
      return content;
    }

    // Return content after frontmatter
    return lines.slice(endIndex + 1).join('\n').trim();
  }

  /**
   * Validates YAML syntax
   * @param {string} yamlContent - YAML content
   * @returns {Object} Validation result
   */
  validateYaml(yamlContent) {
    try {
      yaml.load(yamlContent);
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Formats array fields for YAML
   * @param {Array} items - Array items
   * @returns {string} Formatted YAML array
   */
  formatArrayField(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '[]';
    }

    return items.map(item => `  - ${item}`).join('\n');
  }
}

module.exports = FrontmatterGenerator;
