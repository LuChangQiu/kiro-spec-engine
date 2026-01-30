/**
 * RegistryParser - Parses and validates template registry files
 * 
 * Handles JSON schema validation, registry parsing, indexing, and search.
 */

const fs = require('fs-extra');
const path = require('path');
const { ValidationError } = require('./template-error');

class RegistryParser {
  constructor() {
    this.registryCache = new Map();
  }

  /**
   * Parses a template registry file
   * 
   * @param {string} registryPath - Path to template-registry.json
   * @returns {Promise<Object>} Parsed registry
   */
  async parseRegistry(registryPath) {
    // Check cache
    if (this.registryCache.has(registryPath)) {
      return this.registryCache.get(registryPath);
    }

    // Read registry file
    if (!await fs.pathExists(registryPath)) {
      throw new ValidationError(
        'Registry file not found',
        { path: registryPath }
      );
    }

    let registry;
    try {
      registry = await fs.readJson(registryPath);
    } catch (error) {
      throw new ValidationError(
        'Failed to parse registry JSON',
        {
          path: registryPath,
          error: error.message
        }
      );
    }

    // Validate schema
    this.validateRegistrySchema(registry);

    // Cache parsed registry
    this.registryCache.set(registryPath, registry);

    return registry;
  }

  /**
   * Validates registry schema
   * 
   * @param {Object} registry - Registry object
   * @throws {ValidationError} If schema is invalid
   */
  validateRegistrySchema(registry) {
    const errors = [];

    // Check version field
    if (!registry.version) {
      errors.push('Missing required field: version');
    }

    // Check templates array
    if (!registry.templates) {
      errors.push('Missing required field: templates');
    } else if (!Array.isArray(registry.templates)) {
      errors.push('Field "templates" must be an array');
    } else {
      // Validate each template entry
      registry.templates.forEach((template, index) => {
        const templateErrors = this.validateTemplateEntry(template, index);
        errors.push(...templateErrors);
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        'Registry schema validation failed',
        {
          errors,
          errorCount: errors.length
        }
      );
    }
  }

  /**
   * Validates a single template entry
   * 
   * @param {Object} template - Template entry
   * @param {number} index - Template index
   * @returns {string[]} Array of error messages
   */
  validateTemplateEntry(template, index) {
    const errors = [];
    const prefix = `Template[${index}]`;

    // Required fields
    const requiredFields = [
      'id', 'name', 'category', 'description', 
      'difficulty', 'tags', 'applicable_scenarios', 'files'
    ];

    for (const field of requiredFields) {
      if (!template[field]) {
        errors.push(`${prefix}: Missing required field "${field}"`);
      }
    }

    // Validate field types
    if (template.tags && !Array.isArray(template.tags)) {
      errors.push(`${prefix}: Field "tags" must be an array`);
    }

    if (template.applicable_scenarios && !Array.isArray(template.applicable_scenarios)) {
      errors.push(`${prefix}: Field "applicable_scenarios" must be an array`);
    }

    if (template.files && !Array.isArray(template.files)) {
      errors.push(`${prefix}: Field "files" must be an array`);
    }

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (template.difficulty && !validDifficulties.includes(template.difficulty)) {
      errors.push(`${prefix}: Invalid difficulty "${template.difficulty}". Must be one of: ${validDifficulties.join(', ')}`);
    }

    // Validate files array
    if (template.files && Array.isArray(template.files)) {
      const requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
      for (const file of requiredFiles) {
        if (!template.files.includes(file)) {
          errors.push(`${prefix}: Missing required file "${file}" in files array`);
        }
      }
    }

    return errors;
  }

  /**
   * Builds searchable index from registry
   * 
   * @param {Object} registry - Parsed registry
   * @returns {Object} Indexed registry
   */
  buildIndex(registry) {
    const index = {
      byId: {},
      byCategory: {},
      byTag: {},
      byDifficulty: {},
      all: []
    };

    for (const template of registry.templates) {
      // Index by ID
      index.byId[template.id] = template;

      // Index by category
      if (!index.byCategory[template.category]) {
        index.byCategory[template.category] = [];
      }
      index.byCategory[template.category].push(template);

      // Index by tags
      for (const tag of template.tags || []) {
        if (!index.byTag[tag]) {
          index.byTag[tag] = [];
        }
        index.byTag[tag].push(template);
      }

      // Index by difficulty
      if (!index.byDifficulty[template.difficulty]) {
        index.byDifficulty[template.difficulty] = [];
      }
      index.byDifficulty[template.difficulty].push(template);

      // Add to all templates
      index.all.push(template);
    }

    return index;
  }

  /**
   * Merges multiple registries
   * 
   * @param {Object[]} registries - Array of registry objects
   * @returns {Object} Merged registry
   */
  mergeRegistries(registries) {
    const merged = {
      version: '1.0.0',
      templates: []
    };

    const seenIds = new Set();

    for (const registry of registries) {
      for (const template of registry.templates || []) {
        // Skip duplicates (first occurrence wins)
        if (seenIds.has(template.id)) {
          continue;
        }

        seenIds.add(template.id);
        merged.templates.push(template);
      }
    }

    return merged;
  }

  /**
   * Clears registry cache
   */
  clearCache() {
    this.registryCache.clear();
  }

  /**
   * Gets template by ID
   * 
   * @param {Object} index - Registry index
   * @param {string} templateId - Template ID
   * @returns {Object|null} Template or null
   */
  getTemplateById(index, templateId) {
    return index.byId[templateId] || null;
  }

  /**
   * Gets templates by category
   * 
   * @param {Object} index - Registry index
   * @param {string} category - Category name
   * @returns {Object[]} Array of templates
   */
  getTemplatesByCategory(index, category) {
    return index.byCategory[category] || [];
  }

  /**
   * Gets templates by tag
   * 
   * @param {Object} index - Registry index
   * @param {string} tag - Tag name
   * @returns {Object[]} Array of templates
   */
  getTemplatesByTag(index, tag) {
    return index.byTag[tag] || [];
  }

  /**
   * Gets templates by difficulty
   * 
   * @param {Object} index - Registry index
   * @param {string} difficulty - Difficulty level
   * @returns {Object[]} Array of templates
   */
  getTemplatesByDifficulty(index, difficulty) {
    return index.byDifficulty[difficulty] || [];
  }

  /**
   * Gets all categories
   * 
   * @param {Object} index - Registry index
   * @returns {string[]} Array of category names
   */
  getCategories(index) {
    return Object.keys(index.byCategory);
  }

  /**
   * Gets all tags
   * 
   * @param {Object} index - Registry index
   * @returns {string[]} Array of tag names
   */
  getTags(index) {
    return Object.keys(index.byTag);
  }

  /**
   * Searches templates by keyword
   * 
   * @param {Object} index - Registry index
   * @param {string} keyword - Search keyword
   * @param {Object} filters - Optional filters
   * @param {string} filters.category - Filter by category
   * @param {string} filters.difficulty - Filter by difficulty
   * @param {string[]} filters.tags - Filter by tags (any match)
   * @returns {Object[]} Array of matching templates
   */
  searchTemplates(index, keyword, filters = {}) {
    const keywordLower = keyword.toLowerCase();
    let results = [];

    // Search in all templates
    for (const template of index.all) {
      // Check if keyword matches
      const matchesKeyword = this._matchesKeyword(template, keywordLower);
      
      if (!matchesKeyword) {
        continue;
      }

      // Apply filters
      if (filters.category && template.category !== filters.category) {
        continue;
      }

      if (filters.difficulty && template.difficulty !== filters.difficulty) {
        continue;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          template.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          continue;
        }
      }

      results.push(template);
    }

    return results;
  }

  /**
   * Checks if template matches keyword
   * 
   * @param {Object} template - Template object
   * @param {string} keywordLower - Lowercase keyword
   * @returns {boolean} True if matches
   * @private
   */
  _matchesKeyword(template, keywordLower) {
    // Search in name
    if (template.name.toLowerCase().includes(keywordLower)) {
      return true;
    }

    // Search in description
    if (template.description.toLowerCase().includes(keywordLower)) {
      return true;
    }

    // Search in tags
    for (const tag of template.tags || []) {
      if (tag.toLowerCase().includes(keywordLower)) {
        return true;
      }
    }

    // Search in applicable scenarios
    for (const scenario of template.applicable_scenarios || []) {
      if (scenario.toLowerCase().includes(keywordLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Filters templates
   * 
   * @param {Object} index - Registry index
   * @param {Object} filters - Filters
   * @param {string} filters.category - Filter by category
   * @param {string} filters.difficulty - Filter by difficulty
   * @param {string[]} filters.tags - Filter by tags (any match)
   * @returns {Object[]} Array of matching templates
   */
  filterTemplates(index, filters = {}) {
    let results = [...index.all];

    // Filter by category
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }

    // Filter by difficulty
    if (filters.difficulty) {
      results = results.filter(t => t.difficulty === filters.difficulty);
    }

    // Filter by tags (any match)
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t => 
        filters.tags.some(tag => t.tags.includes(tag))
      );
    }

    return results;
  }

  /**
   * Sorts templates
   * 
   * @param {Object[]} templates - Array of templates
   * @param {string} sortBy - Sort field ('name', 'difficulty', 'created_at', 'updated_at')
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {Object[]} Sorted templates
   */
  sortTemplates(templates, sortBy = 'name', order = 'asc') {
    const sorted = [...templates];

    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        
        case 'difficulty':
          const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
          aVal = difficultyOrder[a.difficulty] || 0;
          bVal = difficultyOrder[b.difficulty] || 0;
          break;
        
        case 'created_at':
          aVal = new Date(a.created_at || 0);
          bVal = new Date(b.created_at || 0);
          break;
        
        case 'updated_at':
          aVal = new Date(a.updated_at || 0);
          bVal = new Date(b.updated_at || 0);
          break;
        
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  /**
   * Groups templates by category
   * 
   * @param {Object[]} templates - Array of templates
   * @returns {Object} Templates grouped by category
   */
  groupByCategory(templates) {
    const grouped = {};

    for (const template of templates) {
      if (!grouped[template.category]) {
        grouped[template.category] = [];
      }
      grouped[template.category].push(template);
    }

    return grouped;
  }

  /**
   * Gets template statistics
   * 
   * @param {Object} index - Registry index
   * @returns {Object} Statistics
   */
  getStatistics(index) {
    return {
      totalTemplates: index.all.length,
      categories: Object.keys(index.byCategory).length,
      tags: Object.keys(index.byTag).length,
      byCategory: Object.keys(index.byCategory).reduce((acc, cat) => {
        acc[cat] = index.byCategory[cat].length;
        return acc;
      }, {}),
      byDifficulty: Object.keys(index.byDifficulty).reduce((acc, diff) => {
        acc[diff] = index.byDifficulty[diff].length;
        return acc;
      }, {})
    };
  }
}

module.exports = RegistryParser;
