/**
 * Index Manager
 * Manages knowledge base index for fast lookups
 */

const fs = require('fs-extra');
const path = require('path');

class IndexManager {
  constructor(knowledgePath) {
    this.knowledgePath = knowledgePath;
    this.indexPath = path.join(knowledgePath, 'index.json');
    this.index = null;
  }
  
  /**
   * Load index from file
   * @returns {Object} - Index data
   */
  async load() {
    if (this.index) {
      return this.index;
    }
    
    if (await fs.pathExists(this.indexPath)) {
      try {
        this.index = await fs.readJson(this.indexPath);
        return this.index;
      } catch (error) {
        throw new Error(`Failed to load index: ${error.message}`);
      }
    }
    
    // Initialize empty index
    this.index = {
      version: '1.0.0',
      entries: [],
      stats: {
        totalEntries: 0,
        byType: {},
        byStatus: {},
        byTag: {}
      },
      lastUpdated: new Date().toISOString()
    };
    
    return this.index;
  }
  
  /**
   * Save index to file
   */
  async save() {
    if (!this.index) {
      throw new Error('Index not loaded');
    }
    
    this.index.lastUpdated = new Date().toISOString();
    await fs.writeJson(this.indexPath, this.index, { spaces: 2 });
  }
  
  /**
   * Add entry to index
   * @param {Object} metadata - Entry metadata
   */
  async addEntry(metadata) {
    await this.load();
    
    const entry = {
      id: metadata.id,
      type: metadata.type,
      title: metadata.title,
      file: metadata.file,
      created: metadata.created,
      updated: metadata.updated,
      tags: metadata.tags || [],
      category: metadata.category || null,
      status: metadata.status || 'active',
      integration: metadata.integration || null
    };
    
    this.index.entries.push(entry);
    this._updateStats();
    await this.save();
  }
  
  /**
   * Update entry in index
   * @param {string} id - Entry ID
   * @param {Object} updates - Updates to apply
   */
  async updateEntry(id, updates) {
    await this.load();
    
    const entry = this.index.entries.find(e => e.id === id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }
    
    Object.assign(entry, updates);
    entry.updated = new Date().toISOString();
    
    this._updateStats();
    await this.save();
  }
  
  /**
   * Remove entry from index
   * @param {string} id - Entry ID
   */
  async removeEntry(id) {
    await this.load();
    
    const index = this.index.entries.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Entry not found: ${id}`);
    }
    
    this.index.entries.splice(index, 1);
    this._updateStats();
    await this.save();
  }
  
  /**
   * Find entry by ID
   * @param {string} id - Entry ID
   * @returns {Object|null} - Entry or null
   */
  async findById(id) {
    await this.load();
    return this.index.entries.find(e => e.id === id) || null;
  }
  
  /**
   * Find entries by type
   * @param {string} type - Entry type
   * @returns {Array} - Matching entries
   */
  async findByType(type) {
    await this.load();
    return this.index.entries.filter(e => e.type === type);
  }
  
  /**
   * Find entries by tag
   * @param {string} tag - Tag name
   * @returns {Array} - Matching entries
   */
  async findByTag(tag) {
    await this.load();
    return this.index.entries.filter(e => e.tags.includes(tag));
  }
  
  /**
   * Search entries by keyword
   * @param {string} keyword - Search keyword
   * @returns {Array} - Matching entries
   */
  async search(keyword) {
    await this.load();
    
    const lowerKeyword = keyword.toLowerCase();
    
    return this.index.entries.filter(entry => {
      return (
        entry.title.toLowerCase().includes(lowerKeyword) ||
        entry.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)) ||
        (entry.category && entry.category.toLowerCase().includes(lowerKeyword))
      );
    });
  }
  
  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  async getStats() {
    await this.load();
    return this.index.stats;
  }
  
  /**
   * Rebuild index from files
   */
  async rebuild() {
    const EntryManager = require('./entry-manager');
    const entryManager = new EntryManager(this.knowledgePath);
    
    this.index = {
      version: '1.0.0',
      entries: [],
      stats: {
        totalEntries: 0,
        byType: {},
        byStatus: {},
        byTag: {}
      },
      lastUpdated: new Date().toISOString()
    };
    
    const types = ['pattern', 'lesson', 'workflow', 'checklist', 'reference'];
    
    for (const type of types) {
      const typeDir = path.join(this.knowledgePath, `${type}s`);
      
      if (await fs.pathExists(typeDir)) {
        const files = await fs.readdir(typeDir);
        
        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(typeDir, file);
            
            try {
              const data = await entryManager.read(filePath);
              const { metadata } = data;
              
              await this.addEntry({
                ...metadata,
                file: path.relative(this.knowledgePath, filePath)
              });
            } catch (error) {
              console.warn(`Failed to read ${file}: ${error.message}`);
            }
          }
        }
      }
    }
    
    await this.save();
  }
  
  /**
   * Update statistics
   * @private
   */
  _updateStats() {
    const stats = {
      totalEntries: this.index.entries.length,
      byType: {},
      byStatus: {},
      byTag: {}
    };
    
    for (const entry of this.index.entries) {
      // Count by type
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      
      // Count by status
      stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
      
      // Count by tag
      for (const tag of entry.tags) {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      }
    }
    
    this.index.stats = stats;
  }
}

module.exports = IndexManager;
