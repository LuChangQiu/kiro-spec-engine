/**
 * TemplateManager - Main template management class
 * 
 * Coordinates all template operations: sources, discovery, download, caching, and application.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const GitHandler = require('./git-handler');
const CacheManager = require('./cache-manager');
const RegistryParser = require('./registry-parser');
const TemplateValidator = require('./template-validator');
const TemplateApplicator = require('./template-applicator');
const { ValidationError, NetworkError } = require('./template-error');

class TemplateManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(os.homedir(), '.kse', 'templates');
    
    // Initialize components
    this.gitHandler = new GitHandler();
    this.cacheManager = new CacheManager(this.cacheDir);
    this.registryParser = new RegistryParser();
    this.validator = new TemplateValidator();
    this.applicator = new TemplateApplicator();
    
    // Sources configuration file
    this.sourcesFile = path.join(this.cacheDir, '.sources.json');
    
    // Default official source
    this.officialSource = {
      name: 'official',
      type: 'official',
      url: 'https://github.com/heguangyong/scene-capability-engine-templates.git',
      branch: 'main',
      enabled: true
    };
  }

  /**
   * Gets all configured sources
   * 
   * @returns {Promise<Object[]>} Array of source configurations
   */
  async getSources() {
    if (!await fs.pathExists(this.sourcesFile)) {
      // Return default official source
      return [this.officialSource];
    }

    try {
      const sources = await fs.readJson(this.sourcesFile);
      return sources.sources || [this.officialSource];
    } catch (error) {
      return [this.officialSource];
    }
  }

  /**
   * Saves sources configuration
   * 
   * @param {Object[]} sources - Array of source configurations
   * @returns {Promise<void>}
   */
  async saveSources(sources) {
    await this.cacheManager.ensureCacheDir();
    await fs.writeJson(this.sourcesFile, { sources }, { spaces: 2 });
  }

  /**
   * Adds a custom template source
   * 
   * @param {string} name - Source name
   * @param {string} gitUrl - Git repository URL
   * @param {Object} options - Source options
   * @returns {Promise<Object>} Result
   */
  async addSource(name, gitUrl, options = {}) {
    const { branch = 'main' } = options;

    // Validate name
    if (!name || !/^[a-z0-9-]+$/.test(name)) {
      throw new ValidationError(
        'Invalid source name. Use lowercase letters, numbers, and hyphens only.',
        { name }
      );
    }

    // Check if source already exists
    const sources = await this.getSources();
    if (sources.some(s => s.name === name)) {
      throw new ValidationError(
        'Source already exists',
        { name }
      );
    }

    // Add new source
    const newSource = {
      name,
      type: 'custom',
      url: gitUrl,
      branch,
      enabled: true
    };

    sources.push(newSource);
    await this.saveSources(sources);

    return {
      success: true,
      source: newSource,
      message: `Source "${name}" added successfully`
    };
  }

  /**
   * Removes a template source
   * 
   * @param {string} name - Source name
   * @param {Object} options - Options
   * @param {boolean} options.clearCache - Clear cached templates
   * @returns {Promise<Object>} Result
   */
  async removeSource(name, options = {}) {
    const { clearCache = false } = options;

    // Cannot remove official source
    if (name === 'official') {
      throw new ValidationError(
        'Cannot remove official source',
        { name }
      );
    }

    const sources = await this.getSources();
    const index = sources.findIndex(s => s.name === name);

    if (index === -1) {
      throw new ValidationError(
        'Source not found',
        { name }
      );
    }

    // Remove source
    sources.splice(index, 1);
    await this.saveSources(sources);

    // Clear cache if requested
    if (clearCache) {
      await this.cacheManager.clearCache(name);
    }

    return {
      success: true,
      message: `Source "${name}" removed successfully`
    };
  }

  /**
   * Lists all template sources
   * 
   * @returns {Promise<Object[]>} Array of sources with status
   */
  async listSources() {
    const sources = await this.getSources();
    const result = [];

    for (const source of sources) {
      const cached = await this.cacheManager.cacheExists(source.name);
      const metadata = await this.cacheManager.getSourceMetadata(source.name);

      result.push({
        ...source,
        cached,
        lastUpdated: metadata ? metadata.last_updated : null,
        templateCount: metadata ? metadata.template_count : null
      });
    }

    return result;
  }

  /**
   * Enables or disables a source
   * 
   * @param {string} name - Source name
   * @param {boolean} enabled - Enable or disable
   * @returns {Promise<void>}
   */
  async setSourceEnabled(name, enabled) {
    const sources = await this.getSources();
    const source = sources.find(s => s.name === name);

    if (!source) {
      throw new ValidationError(
        'Source not found',
        { name }
      );
    }

    source.enabled = enabled;
    await this.saveSources(sources);
  }

  /**
   * Gets a specific source by name
   * 
   * @param {string} name - Source name
   * @returns {Promise<Object|null>} Source or null
   */
  async getSource(name) {
    const sources = await this.getSources();
    return sources.find(s => s.name === name) || null;
  }

  /**
   * Lists all templates from all enabled sources
   * 
   * @param {Object} options - List options
   * @param {string} options.category - Filter by category
   * @param {string} options.source - Filter by source
   * @returns {Promise<Object[]>} Array of templates
   */
  async listTemplates(options = {}) {
    const { category = null, source = null } = options;

    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);
    
    // Filter by source if specified
    const targetSources = source 
      ? enabledSources.filter(s => s.name === source)
      : enabledSources;

    const allTemplates = [];

    for (const src of targetSources) {
      // Check if source is cached
      if (!await this.cacheManager.cacheExists(src.name)) {
        continue;
      }

      // Parse registry
      const registryPath = path.join(
        this.cacheManager.getSourceCachePath(src.name),
        'template-registry.json'
      );

      if (!await fs.pathExists(registryPath)) {
        continue;
      }

      try {
        const registry = await this.registryParser.parseRegistry(registryPath);
        const index = this.registryParser.buildIndex(registry);

        // Get templates
        let templates = category
          ? this.registryParser.getTemplatesByCategory(index, category)
          : index.all;

        // Add source information
        templates = templates.map(t => ({
          ...t,
          source: src.name
        }));

        allTemplates.push(...templates);
      } catch (error) {
        // Skip sources with invalid registries
        continue;
      }
    }

    return allTemplates;
  }

  /**
   * Searches templates across all enabled sources
   * 
   * @param {string} keyword - Search keyword
   * @param {Object} filters - Search filters
   * @returns {Promise<Object[]>} Array of matching templates
   */
  async searchTemplates(keyword, filters = {}) {
    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);

    const allResults = [];

    for (const src of enabledSources) {
      if (!await this.cacheManager.cacheExists(src.name)) {
        continue;
      }

      const registryPath = path.join(
        this.cacheManager.getSourceCachePath(src.name),
        'template-registry.json'
      );

      if (!await fs.pathExists(registryPath)) {
        continue;
      }

      try {
        const registry = await this.registryParser.parseRegistry(registryPath);
        const index = this.registryParser.buildIndex(registry);

        const results = this.registryParser.searchTemplates(index, keyword, filters);

        // Add source information
        const resultsWithSource = results.map(t => ({
          ...t,
          source: src.name
        }));

        allResults.push(...resultsWithSource);
      } catch (error) {
        continue;
      }
    }

    return allResults;
  }

  /**
   * Shows detailed information about a template
   * 
   * @param {string} templatePath - Template path (e.g., 'web-features/rest-api' or 'official:web-features/rest-api')
   * @returns {Promise<Object>} Template details
   */
  async showTemplate(templatePath) {
    // Parse template path
    const { sourceName, templateId } = this._parseTemplatePath(templatePath);

    // Get source
    const source = await this.getSource(sourceName);
    if (!source) {
      throw new ValidationError(
        'Source not found',
        { source: sourceName }
      );
    }

    // Check cache
    if (!await this.cacheManager.cacheExists(sourceName)) {
      throw new ValidationError(
        'Source not cached. Run update first.',
        { source: sourceName }
      );
    }

    // Parse registry
    const registryPath = path.join(
      this.cacheManager.getSourceCachePath(sourceName),
      'template-registry.json'
    );

    const registry = await this.registryParser.parseRegistry(registryPath);
    const index = this.registryParser.buildIndex(registry);

    // Find template
    const template = this.registryParser.getTemplateById(index, templateId);

    if (!template) {
      throw new ValidationError(
        'Template not found',
        { templateId, source: sourceName }
      );
    }

    return {
      ...template,
      source: sourceName
    };
  }

  /**
   * Gets all categories from all enabled sources
   * 
   * @returns {Promise<string[]>} Array of unique categories
   */
  async getCategories() {
    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);

    const allCategories = new Set();

    for (const src of enabledSources) {
      if (!await this.cacheManager.cacheExists(src.name)) {
        continue;
      }

      const registryPath = path.join(
        this.cacheManager.getSourceCachePath(src.name),
        'template-registry.json'
      );

      if (!await fs.pathExists(registryPath)) {
        continue;
      }

      try {
        const registry = await this.registryParser.parseRegistry(registryPath);
        const index = this.registryParser.buildIndex(registry);
        const categories = this.registryParser.getCategories(index);

        categories.forEach(cat => allCategories.add(cat));
      } catch (error) {
        continue;
      }
    }

    return Array.from(allCategories).sort();
  }

  /**
   * Parses template path to extract source and template ID
   * 
   * @param {string} templatePath - Template path
   * @returns {Object} Parsed path
   * @private
   */
  _parseTemplatePath(templatePath) {
    // Format: 'source:category/template' or 'category/template'
    if (templatePath.includes(':')) {
      const [sourceName, templateId] = templatePath.split(':', 2);
      return { sourceName, templateId };
    } else {
      return { sourceName: 'official', templateId: templatePath };
    }
  }

  /**
   * Downloads templates from a source
   * 
   * @param {string} sourceName - Source name (default: 'official')
   * @returns {Promise<Object>} Download result
   */
  async downloadTemplates(sourceName = 'official') {
    const source = await this.getSource(sourceName);
    
    if (!source) {
      throw new ValidationError(
        'Source not found',
        { source: sourceName }
      );
    }

    const targetPath = this.cacheManager.getSourceCachePath(sourceName);

    // Check if already cached
    if (await this.cacheManager.cacheExists(sourceName)) {
      throw new ValidationError(
        'Templates already cached. Use update to refresh.',
        { source: sourceName }
      );
    }

    // Clone repository
    try {
      await this.gitHandler.cloneRepository(source.url, targetPath, {
        shallow: true,
        branch: source.branch
      });
    } catch (error) {
      throw new NetworkError(
        'Failed to download templates',
        {
          source: sourceName,
          url: source.url,
          error: error.message
        }
      );
    }

    // Validate repository structure
    const validation = await this.gitHandler.validateRepository(targetPath);
    if (!validation.valid) {
      // Clean up invalid download
      await fs.remove(targetPath);
      
      throw new ValidationError(
        'Downloaded repository is invalid',
        {
          source: sourceName,
          errors: validation.errors
        }
      );
    }

    // Count templates
    const registryPath = path.join(targetPath, 'template-registry.json');
    const registry = await this.registryParser.parseRegistry(registryPath);
    const templateCount = registry.templates.length;

    // Update cache metadata
    await this.cacheManager.updateMetadata(sourceName, {
      version: await this.gitHandler.getCurrentCommit(targetPath),
      template_count: templateCount,
      size_bytes: await this.cacheManager.getCacheSize(sourceName)
    });

    return {
      success: true,
      source: sourceName,
      templateCount,
      message: `Downloaded ${templateCount} templates from ${sourceName}`
    };
  }

  /**
   * Updates templates from a source
   * 
   * @param {string} sourceName - Source name (null = all sources)
   * @param {string} version - Specific version to checkout (optional)
   * @returns {Promise<Object>} Update result
   */
  async updateTemplates(sourceName = null, version = null) {
    if (sourceName) {
      return await this._updateSingleSource(sourceName, version);
    } else {
      return await this._updateAllSources();
    }
  }

  /**
   * Updates a single source
   * 
   * @param {string} sourceName - Source name
   * @param {string} version - Specific version (optional)
   * @returns {Promise<Object>} Update result
   * @private
   */
  async _updateSingleSource(sourceName, version = null) {
    const source = await this.getSource(sourceName);
    
    if (!source) {
      throw new ValidationError(
        'Source not found',
        { source: sourceName }
      );
    }

    const targetPath = this.cacheManager.getSourceCachePath(sourceName);

    // If not cached, download instead
    if (!await this.cacheManager.cacheExists(sourceName)) {
      return await this.downloadTemplates(sourceName);
    }

    // Get old template list
    const oldRegistryPath = path.join(targetPath, 'template-registry.json');
    const oldRegistry = await this.registryParser.parseRegistry(oldRegistryPath);
    const oldTemplates = new Map(
      oldRegistry.templates.map(t => [t.id, t])
    );

    // Pull updates
    try {
      await this.gitHandler.pullUpdates(targetPath);
      
      // Checkout specific version if requested
      if (version) {
        await this.gitHandler.checkoutVersion(targetPath, version);
      }
    } catch (error) {
      throw new NetworkError(
        'Failed to update templates',
        {
          source: sourceName,
          error: error.message
        }
      );
    }

    // Get new template list
    const newRegistry = await this.registryParser.parseRegistry(oldRegistryPath);
    const newTemplates = new Map(
      newRegistry.templates.map(t => [t.id, t])
    );

    // Detect changes
    const changes = {
      added: 0,
      modified: 0,
      deleted: 0,
      details: {
        added: [],
        modified: [],
        deleted: []
      }
    };

    // Find added and modified templates
    for (const [id, newTemplate] of newTemplates) {
      if (!oldTemplates.has(id)) {
        changes.added++;
        changes.details.added.push(id);
      } else {
        const oldTemplate = oldTemplates.get(id);
        // Check if template was modified (compare updated_at or version)
        if (oldTemplate.updated_at !== newTemplate.updated_at ||
            oldTemplate.version !== newTemplate.version) {
          changes.modified++;
          changes.details.modified.push(id);
        }
      }
    }

    // Find deleted templates
    for (const [id] of oldTemplates) {
      if (!newTemplates.has(id)) {
        changes.deleted++;
        changes.details.deleted.push(id);
      }
    }

    // Update cache metadata
    await this.cacheManager.updateMetadata(sourceName, {
      version: await this.gitHandler.getCurrentCommit(targetPath),
      template_count: newTemplates.size,
      size_bytes: await this.cacheManager.getCacheSize(sourceName)
    });

    return {
      success: true,
      source: sourceName,
      changes,
      message: `Updated ${sourceName}: ${changes.added} added, ${changes.modified} modified, ${changes.deleted} deleted`
    };
  }

  /**
   * Updates all enabled sources
   * 
   * @returns {Promise<Object>} Update result
   * @private
   */
  async _updateAllSources() {
    const sources = await this.getSources();
    const enabledSources = sources.filter(s => s.enabled);

    const results = [];
    const errors = [];

    for (const source of enabledSources) {
      try {
        const result = await this._updateSingleSource(source.name);
        results.push(result);
      } catch (error) {
        errors.push({
          source: source.name,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      message: `Updated ${results.length} source(s), ${errors.length} error(s)`
    };
  }

  /**
   * Ensures templates are cached (downloads if needed)
   * 
   * @param {string} sourceName - Source name
   * @returns {Promise<void>}
   */
  async ensureCached(sourceName) {
    if (!await this.cacheManager.cacheExists(sourceName)) {
      await this.downloadTemplates(sourceName);
    }
  }

  /**
   * Applies a template to create a new Spec
   * 
   * @param {string} specName - Spec name
   * @param {string} templatePath - Template path
   * @param {Object} options - Application options
   * @returns {Promise<Object>} Application result
   */
  async applyTemplate(specName, templatePath, options = {}) {
    const { force = false, variables = {} } = options;

    // Parse template path
    const { sourceName, templateId } = this._parseTemplatePath(templatePath);

    // Ensure source is cached
    await this.ensureCached(sourceName);

    // Get template details
    const template = await this.showTemplate(templatePath);

    // Get template directory path
    const sourcePath = this.cacheManager.getSourceCachePath(sourceName);
    const templateDir = path.join(sourcePath, templateId);

    // Validate template
    const validation = await this.validator.validateTemplate(templateDir);
    if (!validation.valid) {
      throw new ValidationError(
        'Template validation failed',
        {
          template: templateId,
          errors: validation.errors
        }
      );
    }

    // Determine target directory
    const targetDir = path.join(process.cwd(), '.kiro', 'specs', specName);

    // Apply template
    const result = await this.applicator.applyTemplate(
      specName,
      templateDir,
      targetDir,
      { force, variables }
    );

    return {
      ...result,
      template: template.name,
      source: sourceName,
      specPath: targetDir
    };
  }

  /**
   * Gets cache status
   * 
   * @returns {Promise<Object>} Cache status
   */
  async getCacheStatus() {
    const stats = await this.cacheManager.getStatistics();
    const sources = await this.listSources();

    return {
      ...stats,
      sources: sources.map(s => ({
        name: s.name,
        type: s.type,
        enabled: s.enabled,
        cached: s.cached,
        lastUpdated: s.lastUpdated,
        templateCount: s.templateCount
      }))
    };
  }

  /**
   * Clears cache
   * 
   * @param {string} sourceName - Source name (null = all)
   * @returns {Promise<Object>} Result
   */
  async clearCache(sourceName = null) {
    if (sourceName) {
      await this.cacheManager.clearCache(sourceName);
      return {
        success: true,
        message: `Cache cleared for ${sourceName}`
      };
    } else {
      await this.cacheManager.clearAllCache();
      return {
        success: true,
        message: 'All cache cleared'
      };
    }
  }
}

module.exports = TemplateManager;
