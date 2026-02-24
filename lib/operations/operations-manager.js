/**
 * Operations Manager
 * 
 * Manages operations specs lifecycle
 */

const fs = require('fs-extra');
const path = require('path');
const TemplateLoader = require('./template-loader');
const OperationsValidator = require('./operations-validator');
const { DocumentType } = require('./models');

class OperationsManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.templateLoader = new TemplateLoader();
    this.validator = new OperationsValidator();
  }
  
  /**
   * Create operations spec from template
   * 
   * @param {string} projectName - Project name
   * @param {string} version - Project version
   * @param {string} templateName - Template to use (default: 'default')
   * @returns {Promise<string>} Path to created operations directory
   */
  async createOperationsSpec(projectName, version = '1.0.0', templateName = 'default') {
    const operationsPath = path.join(
      this.projectRoot,
      '.sce/specs',
      projectName,
      'operations'
    );
    
    // Create operations directory
    await fs.ensureDir(operationsPath);
    
    // Load all templates
    const templates = await this.templateLoader.loadAllTemplates(templateName);
    
    // Write each template to file
    const documentTypes = Object.values(DocumentType);
    
    for (const docType of documentTypes) {
      const template = templates[docType];
      if (template) {
        const fileName = docType === DocumentType.TOOLS ? 'tools.yaml' : `${docType}.md`;
        const filePath = path.join(operationsPath, fileName);
        await fs.writeFile(filePath, template, 'utf8');
      }
    }
    
    // Create version metadata file
    const metadata = {
      project: projectName,
      version: version,
      created: new Date().toISOString(),
      template: templateName
    };
    
    await fs.writeFile(
      path.join(operationsPath, '.metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    
    return operationsPath;
  }
  
  /**
   * Load operations spec
   * 
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Operations spec object
   */
  async loadOperationsSpec(projectName) {
    const operationsPath = path.join(
      this.projectRoot,
      '.sce/specs',
      projectName,
      'operations'
    );
    
    // Check if operations directory exists
    const exists = await fs.pathExists(operationsPath);
    if (!exists) {
      throw new Error(`Operations spec not found for project: ${projectName}`);
    }
    
    // Load metadata
    const metadataPath = path.join(operationsPath, '.metadata.json');
    let metadata = {};
    if (await fs.pathExists(metadataPath)) {
      try {
        metadata = await fs.readJson(metadataPath);
      } catch (error) {
        // If metadata is corrupted, use empty object
        console.warn(`Warning: Could not parse metadata file: ${error.message}`);
        metadata = {};
      }
    }
    
    return {
      project: projectName,
      path: operationsPath,
      metadata
    };
  }
  
  /**
   * Validate operations spec
   * 
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Validation result
   */
  async validateOperationsSpec(projectName) {
    const spec = await this.loadOperationsSpec(projectName);
    return await this.validator.validateComplete(spec.path);
  }
  
  /**
   * List all operations specs
   * 
   * @returns {Promise<string[]>} Array of project names with operations specs
   */
  async listOperationsSpecs() {
    const specsPath = path.join(this.projectRoot, '.sce/specs');
    
    const exists = await fs.pathExists(specsPath);
    if (!exists) {
      return [];
    }
    
    const entries = await fs.readdir(specsPath, { withFileTypes: true });
    const projects = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const operationsPath = path.join(specsPath, entry.name, 'operations');
        if (await fs.pathExists(operationsPath)) {
          projects.push(entry.name);
        }
      }
    }
    
    return projects;
  }
}

module.exports = OperationsManager;
