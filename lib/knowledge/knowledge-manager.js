/**
 * Knowledge Manager
 * Central coordinator for knowledge base operations
 */

const fs = require('fs-extra');
const path = require('path');
const EntryManager = require('./entry-manager');
const IndexManager = require('./index-manager');
const TemplateManager = require('./template-manager');

class KnowledgeManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.knowledgePath = path.join(projectRoot, '.kiro', 'knowledge');
    
    this.entryManager = new EntryManager(this.knowledgePath);
    this.indexManager = new IndexManager(this.knowledgePath);
    this.templateManager = new TemplateManager(this.knowledgePath);
  }
  
  /**
   * Initialize knowledge base
   */
  async initialize() {
    // Create directory structure
    await fs.ensureDir(this.knowledgePath);
    await fs.ensureDir(path.join(this.knowledgePath, 'patterns'));
    await fs.ensureDir(path.join(this.knowledgePath, 'lessons'));
    await fs.ensureDir(path.join(this.knowledgePath, 'workflows'));
    await fs.ensureDir(path.join(this.knowledgePath, 'checklists'));
    await fs.ensureDir(path.join(this.knowledgePath, 'references'));
    await fs.ensureDir(path.join(this.knowledgePath, '.templates'));
    await fs.ensureDir(path.join(this.knowledgePath, '.backups'));
    
    // Create README
    const readme = `# Knowledge Base

This directory contains your personal knowledge base for this project.

## Structure

- \`patterns/\` - Design patterns and architectural solutions
- \`lessons/\` - Lessons learned from experience
- \`workflows/\` - Custom workflows and processes
- \`checklists/\` - Checklists for common tasks
- \`references/\` - Reference materials and links

## Usage

\`\`\`bash
# Add new entry
sce knowledge add <type> "<title>"

# List all entries
sce knowledge list

# Search entries
sce knowledge search <keyword>

# Analyze knowledge base
sce knowledge analyze

# Integrate knowledge into project
sce knowledge integrate <id> --target <destination>
\`\`\`

## Learn More

See \`docs/knowledge-management-guide.md\` for complete documentation.
`;
    
    await fs.writeFile(path.join(this.knowledgePath, 'README.md'), readme, 'utf-8');
    
    // Initialize index
    await this.indexManager.load();
    await this.indexManager.save();
  }
  
  /**
   * Check if knowledge base is initialized
   * @returns {boolean}
   */
  async isInitialized() {
    return fs.pathExists(this.knowledgePath);
  }
  
  /**
   * Add new entry
   * @param {string} type - Entry type
   * @param {string} title - Entry title
   * @param {Object} options - Additional options
   * @returns {Object} - Created entry info
   */
  async addEntry(type, title, options = {}) {
    if (!await this.isInitialized()) {
      throw new Error('Knowledge base not initialized. Run: sce knowledge init');
    }
    
    // Validate type
    const validTypes = ['pattern', 'lesson', 'workflow', 'checklist', 'reference'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }
    
    // Get template
    const template = await this.templateManager.getTemplate(type);
    
    // Create entry
    const result = await this.entryManager.create(type, title, template, {
      tags: options.tags || [],
      category: options.category || null
    });
    
    // Update index
    const entryData = await this.entryManager.read(result.path);
    await this.indexManager.addEntry({
      ...entryData.metadata,
      file: result.file
    });
    
    return result;
  }
  
  /**
   * Get entry by ID
   * @param {string} id - Entry ID
   * @returns {Object} - Entry data
   */
  async getEntry(id) {
    const entry = await this.indexManager.findById(id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }
    
    const filePath = path.join(this.knowledgePath, entry.file);
    return this.entryManager.read(filePath);
  }
  
  /**
   * Update entry
   * @param {string} id - Entry ID
   * @param {Object} updates - Updates to apply
   */
  async updateEntry(id, updates) {
    const entry = await this.indexManager.findById(id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }
    
    const filePath = path.join(this.knowledgePath, entry.file);
    await this.entryManager.update(filePath, updates.content, updates.metadata);
    
    // Update index
    if (updates.metadata) {
      await this.indexManager.updateEntry(id, updates.metadata);
    }
  }
  
  /**
   * Delete entry
   * @param {string} id - Entry ID
   * @param {Object} options - Delete options
   */
  async deleteEntry(id, options = {}) {
    const entry = await this.indexManager.findById(id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }
    
    const filePath = path.join(this.knowledgePath, entry.file);
    await this.entryManager.delete(filePath, options.backup !== false);
    
    // Update index
    await this.indexManager.removeEntry(id);
    
    return {
      id,
      title: entry.title,
      deleted: true
    };
  }
  
  /**
   * List entries
   * @param {Object} filters - Filter options
   * @returns {Array} - Filtered entries
   */
  async listEntries(filters = {}) {
    await this.indexManager.load();
    
    let entries = this.indexManager.index.entries;
    
    // Apply filters
    if (filters.type) {
      entries = entries.filter(e => e.type === filters.type);
    }
    
    if (filters.tag) {
      entries = entries.filter(e => e.tags.includes(filters.tag));
    }
    
    if (filters.status) {
      entries = entries.filter(e => e.status === filters.status);
    }
    
    // Apply sorting
    if (filters.sort) {
      const [field, order = 'asc'] = filters.sort.split(':');
      entries.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'desc' ? -comparison : comparison;
      });
    }
    
    return entries;
  }
  
  /**
   * Search entries
   * @param {string} keyword - Search keyword
   * @param {Object} options - Search options
   * @returns {Array} - Search results
   */
  async search(keyword, options = {}) {
    // Search in index first
    const indexResults = await this.indexManager.search(keyword);
    
    if (!options.fullText) {
      return indexResults;
    }
    
    // Full-text search in files
    const results = [];
    const lowerKeyword = keyword.toLowerCase();
    
    for (const entry of indexResults) {
      const filePath = path.join(this.knowledgePath, entry.file);
      const data = await this.entryManager.read(filePath);
      
      if (data.content.toLowerCase().includes(lowerKeyword)) {
        // Extract context snippet
        const lines = data.content.split('\n');
        const matchingLines = lines.filter(line => 
          line.toLowerCase().includes(lowerKeyword)
        );
        
        results.push({
          ...entry,
          matches: matchingLines.slice(0, 3),
          score: matchingLines.length
        });
      }
    }
    
    // Sort by relevance
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  /**
   * Get statistics
   * @returns {Object} - Statistics
   */
  async getStats() {
    return this.indexManager.getStats();
  }
}

module.exports = KnowledgeManager;
