/**
 * Template Loader
 * 
 * Loads operations spec templates from the template library
 */

const fs = require('fs-extra');
const path = require('path');
const { DocumentType } = require('./models');

class TemplateLoader {
  constructor(templateBasePath = null) {
    // Default to package template directory
    this.templateBasePath = templateBasePath || path.join(__dirname, '../../template/.kiro/templates/operations');
  }
  
  /**
   * Load a template for a specific document type
   * 
   * @param {string} documentType - Type of document (from DocumentType enum)
   * @param {string} templateName - Template name (default: 'default')
   * @returns {Promise<string>} Template content
   */
  async loadTemplate(documentType, templateName = 'default') {
    // Validate document type
    const validTypes = Object.values(DocumentType);
    if (!validTypes.includes(documentType)) {
      throw new Error(`Invalid document type: ${documentType}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // tools.yaml is a YAML file, others are markdown
    const fileName = documentType === DocumentType.TOOLS ? `${documentType}.yaml` : `${documentType}.md`;
    
    // Build template path
    const templatePath = path.join(
      this.templateBasePath,
      templateName,
      fileName
    );
    
    // Check if template exists
    const exists = await fs.pathExists(templatePath);
    if (!exists) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    // Load template content
    const content = await fs.readFile(templatePath, 'utf8');
    return content;
  }
  
  /**
   * Load all templates for a template set
   * 
   * @param {string} templateName - Template name (default: 'default')
   * @returns {Promise<Object>} Map of document type to template content
   */
  async loadAllTemplates(templateName = 'default') {
    const templates = {};
    const documentTypes = Object.values(DocumentType);
    
    for (const docType of documentTypes) {
      try {
        templates[docType] = await this.loadTemplate(docType, templateName);
      } catch (error) {
        // If a template is missing, include error message
        templates[docType] = null;
        console.warn(`Warning: Could not load template for ${docType}: ${error.message}`);
      }
    }
    
    return templates;
  }
  
  /**
   * List available template sets
   * 
   * @returns {Promise<string[]>} Array of template set names
   */
  async listTemplateSets() {
    const exists = await fs.pathExists(this.templateBasePath);
    if (!exists) {
      return [];
    }
    
    const entries = await fs.readdir(this.templateBasePath, { withFileTypes: true });
    const templateSets = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    return templateSets;
  }
  
  /**
   * Check if a template set is complete (has all 9 document types)
   * 
   * @param {string} templateName - Template name to check
   * @returns {Promise<Object>} Completeness report
   */
  async checkTemplateCompleteness(templateName = 'default') {
    const documentTypes = Object.values(DocumentType);
    const missing = [];
    const present = [];
    
    for (const docType of documentTypes) {
      // tools.yaml is a YAML file, others are markdown
      const fileName = docType === DocumentType.TOOLS ? `${docType}.yaml` : `${docType}.md`;
      const templatePath = path.join(
        this.templateBasePath,
        templateName,
        fileName
      );
      
      const exists = await fs.pathExists(templatePath);
      if (exists) {
        present.push(docType);
      } else {
        missing.push(docType);
      }
    }
    
    return {
      complete: missing.length === 0,
      total: documentTypes.length,
      present: present.length,
      missing: missing.length,
      presentTypes: present,
      missingTypes: missing
    };
  }
  
  /**
   * Get the file name for a document type
   * 
   * @param {string} documentType - Type of document
   * @returns {string} File name (e.g., 'deployment.md')
   */
  getFileName(documentType) {
    return `${documentType}.md`;
  }
}

module.exports = TemplateLoader;
