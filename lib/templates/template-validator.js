/**
 * TemplateValidator - Validates template structure and content
 * 
 * Validates YAML frontmatter, file structure, and template completeness.
 */

const fs = require('fs-extra');
const path = require('path');
const { ValidationError } = require('./template-error');

class TemplateValidator {
  constructor() {
    this.requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
    this.requiredFrontmatterFields = [
      'name', 'category', 'description', 'difficulty', 
      'tags', 'applicable_scenarios', 'author', 
      'created_at', 'updated_at', 'version'
    ];
  }

  /**
   * Validates a template directory
   * 
   * @param {string} templatePath - Path to template directory
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplate(templatePath) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Check if directory exists
    if (!await fs.pathExists(templatePath)) {
      result.valid = false;
      result.errors.push('Template directory does not exist');
      return result;
    }

    // Validate file structure
    const structureResult = await this.validateStructure(templatePath);
    result.errors.push(...structureResult.errors);
    result.warnings.push(...structureResult.warnings);

    if (structureResult.errors.length > 0) {
      result.valid = false;
    }

    // Validate frontmatter in each file
    for (const file of this.requiredFiles) {
      const filePath = path.join(templatePath, file);
      
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        const frontmatterResult = this.validateFrontmatter(content, file);
        
        result.errors.push(...frontmatterResult.errors);
        result.warnings.push(...frontmatterResult.warnings);
        
        if (frontmatterResult.errors.length > 0) {
          result.valid = false;
        }
      }
    }

    return result;
  }

  /**
   * Validates template file structure
   * 
   * @param {string} templatePath - Path to template directory
   * @returns {Promise<Object>} Validation result
   */
  async validateStructure(templatePath) {
    const result = {
      errors: [],
      warnings: []
    };

    // Check for required files
    for (const file of this.requiredFiles) {
      const filePath = path.join(templatePath, file);
      
      if (!await fs.pathExists(filePath)) {
        result.errors.push(`Missing required file: ${file}`);
      } else {
        // Validate file content structure
        const content = await fs.readFile(filePath, 'utf8');
        const contentResult = this.validateContent(content, file);
        result.errors.push(...contentResult.errors);
        result.warnings.push(...contentResult.warnings);
      }
    }

    return result;
  }

  /**
   * Validates Spec document content structure
   * 
   * @param {string} content - File content
   * @param {string} filename - File name
   * @returns {Object} Validation result
   */
  validateContent(content, filename) {
    const result = {
      errors: [],
      warnings: []
    };

    // Normalize line endings and remove frontmatter for content validation
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const contentWithoutFrontmatter = normalizedContent.replace(/^---\n[\s\S]*?\n---\n/, '');

    // Validate based on file type
    if (filename === 'requirements.md') {
      this._validateRequirementsStructure(contentWithoutFrontmatter, result);
    } else if (filename === 'design.md') {
      this._validateDesignStructure(contentWithoutFrontmatter, result);
    } else if (filename === 'tasks.md') {
      this._validateTasksStructure(contentWithoutFrontmatter, result);
    }

    return result;
  }

  /**
   * Validates requirements.md structure
   * 
   * @param {string} content - Content without frontmatter
   * @param {Object} result - Result object to populate
   * @private
   */
  _validateRequirementsStructure(content, result) {
    const requiredSections = [
      '# Requirements Document',
      '## Introduction',
      '## Glossary'
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        result.warnings.push(`requirements.md: Missing section "${section}"`);
      }
    }

    // Check for at least one requirement
    if (!content.includes('### Requirement')) {
      result.warnings.push('requirements.md: No requirements found');
    }
  }

  /**
   * Validates design.md structure
   * 
   * @param {string} content - Content without frontmatter
   * @param {Object} result - Result object to populate
   * @private
   */
  _validateDesignStructure(content, result) {
    const requiredSections = [
      '# Design Document',
      '## Overview',
      '## Architecture'
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        result.warnings.push(`design.md: Missing section "${section}"`);
      }
    }
  }

  /**
   * Validates tasks.md structure
   * 
   * @param {string} content - Content without frontmatter
   * @param {Object} result - Result object to populate
   * @private
   */
  _validateTasksStructure(content, result) {
    const requiredSections = [
      '# Implementation Plan',
      '## Overview',
      '## Tasks'
    ];

    for (const section of requiredSections) {
      if (!content.includes(section)) {
        result.warnings.push(`tasks.md: Missing section "${section}"`);
      }
    }

    // Check for at least one task
    if (!content.match(/^- \[ \]/m)) {
      result.warnings.push('tasks.md: No tasks found');
    }
  }

  /**
   * Validates YAML frontmatter
   * 
   * @param {string} content - File content
   * @param {string} filename - File name (for error messages)
   * @returns {Object} Validation result
   */
  validateFrontmatter(content, filename = 'file') {
    const result = {
      errors: [],
      warnings: []
    };

    // Extract frontmatter
    const frontmatter = this.extractFrontmatter(content);
    
    if (!frontmatter) {
      result.errors.push(`${filename}: Missing YAML frontmatter`);
      return result;
    }

    // Parse YAML
    let metadata;
    try {
      metadata = this.parseYaml(frontmatter);
    } catch (error) {
      result.errors.push(`${filename}: Invalid YAML syntax - ${error.message}`);
      return result;
    }

    // Validate required fields
    for (const field of this.requiredFrontmatterFields) {
      if (!metadata[field]) {
        result.errors.push(`${filename}: Missing required field "${field}"`);
      }
    }

    // Validate field types
    if (metadata.tags && !Array.isArray(metadata.tags)) {
      result.errors.push(`${filename}: Field "tags" must be an array`);
    }

    if (metadata.applicable_scenarios && !Array.isArray(metadata.applicable_scenarios)) {
      result.errors.push(`${filename}: Field "applicable_scenarios" must be an array`);
    }

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (metadata.difficulty && !validDifficulties.includes(metadata.difficulty)) {
      result.errors.push(`${filename}: Invalid difficulty "${metadata.difficulty}"`);
    }

    return result;
  }

  /**
   * Extracts YAML frontmatter from content
   * 
   * @param {string} content - File content
   * @returns {string|null} Frontmatter content or null
   */
  extractFrontmatter(content) {
    // Normalize line endings to \n for consistent matching
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const match = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
    return match ? match[1] : null;
  }

  /**
   * Parses YAML content (simple implementation)
   * 
   * @param {string} yaml - YAML content
   * @returns {Object} Parsed object
   */
  parseYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let currentKey = null;
    let currentArray = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Array item
      if (trimmed.startsWith('- ')) {
        if (currentArray) {
          currentArray.push(trimmed.substring(2).trim());
        }
        continue;
      }

      // Key-value pair
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();

        if (value === '') {
          // Start of array or empty value
          currentKey = key;
          currentArray = [];
          result[key] = currentArray;
        } else {
          // Simple value - check if it's an inline array
          if (value.startsWith('[') && value.endsWith(']')) {
            // Inline array format: [item1, item2, item3]
            const arrayContent = value.substring(1, value.length - 1);
            result[key] = arrayContent.split(',').map(item => item.trim());
          } else {
            // Simple string value
            result[key] = value;
          }
          currentKey = null;
          currentArray = null;
        }
      }
    }

    return result;
  }

  /**
   * Generates validation report
   * 
   * @param {Object} validationResult - Validation result
   * @returns {string} Formatted report
   */
  generateValidationReport(validationResult) {
    let report = '';

    if (validationResult.valid) {
      report += '✅ Template validation passed\n';
    } else {
      report += '❌ Template validation failed\n\n';
      
      if (validationResult.errors.length > 0) {
        report += 'Errors:\n';
        validationResult.errors.forEach((error, index) => {
          report += `  ${index + 1}. ${error}\n`;
        });
        report += '\n';
      }
    }

    if (validationResult.warnings.length > 0) {
      report += 'Warnings:\n';
      validationResult.warnings.forEach((warning, index) => {
        report += `  ${index + 1}. ${warning}\n`;
      });
    }

    return report;
  }
}

module.exports = TemplateValidator;
