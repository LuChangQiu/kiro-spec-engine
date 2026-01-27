/**
 * Operations Spec Validator
 * 
 * Validates operations spec completeness and structure
 */

const fs = require('fs-extra');
const path = require('path');
const { DocumentType } = require('./models');

// Required sections for each document type
const REQUIRED_SECTIONS = {
  [DocumentType.DEPLOYMENT]: [
    'Prerequisites',
    'Deployment Steps',
    'Environment Variables',
    'Health Checks',
    'Rollback Procedure'
  ],
  [DocumentType.MONITORING]: [
    'Metrics',
    'Thresholds',
    'Alert Rules',
    'Response Procedures'
  ],
  [DocumentType.OPERATIONS]: [
    'Daily Tasks',
    'Maintenance Procedures',
    'Backup Procedures'
  ],
  [DocumentType.TROUBLESHOOTING]: [
    'Common Issues',
    'Diagnostic Commands',
    'Resolution Steps'
  ],
  [DocumentType.ROLLBACK]: [
    'Rollback Triggers',
    'Rollback Steps',
    'Data Recovery Procedures'
  ],
  [DocumentType.CHANGE_IMPACT]: [
    'Change Classification',
    'Affected Systems',
    'Risk Assessment'
  ],
  [DocumentType.MIGRATION_PLAN]: [
    'Migration Strategy',
    'Data Mapping',
    'Validation Steps',
    'Rollback Plan'
  ],
  [DocumentType.FEEDBACK_RESPONSE]: [
    'Feedback Classification Rules',
    'Response Procedures',
    'Escalation Paths',
    'Resolution Tracking'
  ]
};

class OperationsValidator {
  /**
   * Validate operations spec directory structure
   * 
   * @param {string} operationsPath - Path to operations directory
   * @returns {Promise<Object>} Validation result
   */
  async validateStructure(operationsPath) {
    const errors = [];
    const warnings = [];
    const missingDocuments = [];
    const presentDocuments = [];
    
    // Check if operations directory exists
    const exists = await fs.pathExists(operationsPath);
    if (!exists) {
      errors.push({
        type: 'missing_directory',
        message: `Operations directory not found: ${operationsPath}`
      });
      
      return {
        valid: false,
        errors,
        warnings,
        missingDocuments: Object.values(DocumentType),
        presentDocuments: []
      };
    }
    
    // Check for all required documents
    const documentTypes = Object.values(DocumentType);
    
    for (const docType of documentTypes) {
      // tools.yaml is a YAML file, others are markdown
      const fileName = docType === DocumentType.TOOLS ? `${docType}.yaml` : `${docType}.md`;
      const docPath = path.join(operationsPath, fileName);
      const docExists = await fs.pathExists(docPath);
      
      if (docExists) {
        presentDocuments.push(docType);
      } else {
        missingDocuments.push(docType);
        errors.push({
          type: 'missing_document',
          documentType: docType,
          message: `Required document missing: ${fileName}`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missingDocuments,
      presentDocuments,
      totalRequired: documentTypes.length,
      totalPresent: presentDocuments.length
    };
  }
  
  /**
   * Validate document content (sections)
   * 
   * @param {string} documentPath - Path to document file
   * @param {string} documentType - Type of document
   * @returns {Promise<Object>} Validation result
   */
  async validateDocumentContent(documentPath, documentType) {
    const errors = [];
    const warnings = [];
    
    // Check if document exists
    const exists = await fs.pathExists(documentPath);
    if (!exists) {
      errors.push({
        type: 'file_not_found',
        message: `Document not found: ${documentPath}`
      });
      
      return {
        valid: false,
        errors,
        warnings,
        missingSections: REQUIRED_SECTIONS[documentType] || [],
        presentSections: []
      };
    }
    
    // Read document content
    const content = await fs.readFile(documentPath, 'utf8');
    
    // Get required sections for this document type
    const requiredSections = REQUIRED_SECTIONS[documentType];
    if (!requiredSections) {
      warnings.push({
        type: 'unknown_document_type',
        message: `No validation rules for document type: ${documentType}`
      });
      
      return {
        valid: true,
        errors,
        warnings,
        missingSections: [],
        presentSections: []
      };
    }
    
    // Parse sections from markdown
    const sections = this.parseSections(content);
    const missingSections = [];
    const presentSections = [];
    
    // Check for required sections
    for (const requiredSection of requiredSections) {
      const found = sections.some(section => 
        section.toLowerCase().includes(requiredSection.toLowerCase())
      );
      
      if (found) {
        presentSections.push(requiredSection);
      } else {
        missingSections.push(requiredSection);
        errors.push({
          type: 'missing_section',
          section: requiredSection,
          message: `Required section missing: ${requiredSection}`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missingSections,
      presentSections,
      totalRequired: requiredSections.length,
      totalPresent: presentSections.length
    };
  }
  
  /**
   * Validate complete operations spec
   * 
   * @param {string} operationsPath - Path to operations directory
   * @returns {Promise<Object>} Complete validation result
   */
  async validateComplete(operationsPath) {
    // First validate structure
    const structureResult = await this.validateStructure(operationsPath);
    
    if (!structureResult.valid) {
      return {
        valid: false,
        structureValid: false,
        contentValid: false,
        structure: structureResult,
        content: {}
      };
    }
    
    // Then validate content of each document
    const contentResults = {};
    let allContentValid = true;
    
    for (const docType of structureResult.presentDocuments) {
      const docPath = path.join(operationsPath, `${docType}.md`);
      const contentResult = await this.validateDocumentContent(docPath, docType);
      
      contentResults[docType] = contentResult;
      
      if (!contentResult.valid) {
        allContentValid = false;
      }
    }
    
    return {
      valid: structureResult.valid && allContentValid,
      structureValid: structureResult.valid,
      contentValid: allContentValid,
      structure: structureResult,
      content: contentResults
    };
  }
  
  /**
   * Parse markdown sections (## headers)
   * 
   * @param {string} content - Markdown content
   * @returns {string[]} Array of section titles
   */
  parseSections(content) {
    const sections = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Match ## Section Title
      const match = line.match(/^##\s+(.+)$/);
      if (match) {
        sections.push(match[1].trim());
      }
    }
    
    return sections;
  }
  
  /**
   * Get required sections for a document type
   * 
   * @param {string} documentType - Type of document
   * @returns {string[]} Array of required section names
   */
  getRequiredSections(documentType) {
    return REQUIRED_SECTIONS[documentType] || [];
  }
}

module.exports = OperationsValidator;
