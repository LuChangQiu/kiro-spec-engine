/**
 * Entry Manager
 * Handles knowledge entry file operations
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

class EntryManager {
  constructor(knowledgePath) {
    this.knowledgePath = knowledgePath;
  }
  
  /**
   * Create new entry
   * @param {string} type - Entry type
   * @param {string} title - Entry title
   * @param {string} content - Entry content
   * @param {Object} metadata - Entry metadata
   * @returns {Object} - Created entry info
   */
  async create(type, title, content, metadata) {
    const id = this.generateId();
    const filename = this.generateFilename(type, title);
    const filePath = path.join(this.knowledgePath, `${type}s`, filename);
    
    const fullMetadata = {
      id,
      type,
      title,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tags: metadata.tags || [],
      category: metadata.category || null,
      status: 'active',
      integration: null,
      ...metadata
    };
    
    const fileContent = this.serializeFrontmatter(fullMetadata, content);
    
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, fileContent, 'utf-8');
    
    return {
      id,
      file: path.relative(this.knowledgePath, filePath),
      path: filePath
    };
  }
  
  /**
   * Read entry
   * @param {string} filePath - Entry file path
   * @returns {Object} - Entry data
   */
  async read(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseFrontmatter(content);
  }
  
  /**
   * Update entry
   * @param {string} filePath - Entry file path
   * @param {string} content - New content
   * @param {Object} metadata - Updated metadata
   */
  async update(filePath, content, metadata) {
    const existing = await this.read(filePath);
    
    const updatedMetadata = {
      ...existing.metadata,
      ...metadata,
      updated: new Date().toISOString()
    };
    
    const fileContent = this.serializeFrontmatter(updatedMetadata, content || existing.content);
    await fs.writeFile(filePath, fileContent, 'utf-8');
  }
  
  /**
   * Delete entry
   * @param {string} filePath - Entry file path
   * @param {boolean} backup - Create backup before deletion
   */
  async delete(filePath, backup = true) {
    if (backup) {
      const backupDir = path.join(this.knowledgePath, '.backups');
      await fs.ensureDir(backupDir);
      
      const timestamp = Date.now();
      const basename = path.basename(filePath);
      const backupPath = path.join(backupDir, `${timestamp}-${basename}`);
      
      await fs.copy(filePath, backupPath);
    }
    
    await fs.remove(filePath);
  }
  
  /**
   * Check if entry exists
   * @param {string} filePath - Entry file path
   * @returns {boolean}
   */
  async exists(filePath) {
    return fs.pathExists(filePath);
  }
  
  /**
   * Parse frontmatter from content
   * @param {string} content - File content
   * @returns {Object} - Parsed data
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!match) {
      throw new Error('Invalid entry format: missing frontmatter');
    }
    
    const [, frontmatter, body] = match;
    
    try {
      const metadata = yaml.load(frontmatter);
      return {
        metadata,
        content: body.trim()
      };
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error.message}`);
    }
  }
  
  /**
   * Serialize frontmatter and content
   * @param {Object} metadata - Entry metadata
   * @param {string} content - Entry content
   * @returns {string} - Serialized content
   */
  serializeFrontmatter(metadata, content) {
    const frontmatter = yaml.dump(metadata, {
      indent: 2,
      lineWidth: -1
    });
    
    return `---\n${frontmatter}---\n\n${content}`;
  }
  
  /**
   * Validate entry structure
   * @param {string} filePath - Entry file path
   * @returns {Object} - Validation result
   */
  async validate(filePath) {
    try {
      const data = await this.read(filePath);
      const { metadata } = data;
      
      const errors = [];
      
      if (!metadata.id) errors.push('Missing id');
      if (!metadata.type) errors.push('Missing type');
      if (!metadata.title) errors.push('Missing title');
      if (!metadata.created) errors.push('Missing created date');
      if (!metadata.updated) errors.push('Missing updated date');
      if (!metadata.status) errors.push('Missing status');
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }
  
  /**
   * Generate unique ID
   * @returns {string} - Unique ID
   */
  generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `kb-${timestamp}-${random}`;
  }
  
  /**
   * Generate filename from title
   * @param {string} type - Entry type
   * @param {string} title - Entry title
   * @returns {string} - Kebab-case filename
   */
  generateFilename(type, title) {
    const kebab = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    return `${kebab}.md`;
  }
}

module.exports = EntryManager;
