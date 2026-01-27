/**
 * Unit Tests for Template Loader
 * 
 * Tests template loading functionality
 */

const path = require('path');
const TemplateLoader = require('../../../lib/operations/template-loader');
const { DocumentType } = require('../../../lib/operations/models');

describe('TemplateLoader', () => {
  let loader;
  
  beforeEach(() => {
    loader = new TemplateLoader();
  });
  
  describe('loadTemplate', () => {
    test('should load deployment template', async () => {
      const content = await loader.loadTemplate(DocumentType.DEPLOYMENT);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Deployment Specification');
      expect(content).toContain('## Prerequisites');
      expect(content).toContain('## Deployment Steps');
      expect(content).toContain('## Environment Variables');
      expect(content).toContain('## Health Checks');
      expect(content).toContain('## Rollback Procedure');
    });
    
    test('should load monitoring template', async () => {
      const content = await loader.loadTemplate(DocumentType.MONITORING);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Monitoring Specification');
      expect(content).toContain('## Metrics');
      expect(content).toContain('## Thresholds');
      expect(content).toContain('## Alert Rules');
      expect(content).toContain('## Response Procedures');
    });
    
    test('should load operations template', async () => {
      const content = await loader.loadTemplate(DocumentType.OPERATIONS);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Daily Operations Specification');
      expect(content).toContain('## Daily Tasks');
      expect(content).toContain('## Maintenance Procedures');
      expect(content).toContain('## Backup Procedures');
    });
    
    test('should load troubleshooting template', async () => {
      const content = await loader.loadTemplate(DocumentType.TROUBLESHOOTING);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Troubleshooting Guide');
      expect(content).toContain('## Common Issues');
      expect(content).toContain('## Diagnostic Commands');
      expect(content).toContain('## Resolution Steps');
    });
    
    test('should load rollback template', async () => {
      const content = await loader.loadTemplate(DocumentType.ROLLBACK);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Rollback Procedures');
      expect(content).toContain('## Rollback Triggers');
      expect(content).toContain('## Rollback Steps');
      expect(content).toContain('## Data Recovery Procedures');
    });
    
    test('should load change-impact template', async () => {
      const content = await loader.loadTemplate(DocumentType.CHANGE_IMPACT);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Change Impact Assessment');
      expect(content).toContain('## Change Classification');
      expect(content).toContain('## Affected Systems');
      expect(content).toContain('## Risk Assessment');
    });
    
    test('should load migration-plan template', async () => {
      const content = await loader.loadTemplate(DocumentType.MIGRATION_PLAN);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Data Migration Plan');
      expect(content).toContain('## Migration Strategy');
      expect(content).toContain('## Data Mapping');
      expect(content).toContain('## Validation Steps');
      expect(content).toContain('## Rollback Plan');
    });
    
    test('should load feedback-response template', async () => {
      const content = await loader.loadTemplate(DocumentType.FEEDBACK_RESPONSE);
      
      expect(content).toBeTruthy();
      expect(content).toContain('# Feedback Response Procedures');
      expect(content).toContain('## Feedback Classification Rules');
      expect(content).toContain('## Response Procedures');
      expect(content).toContain('## Escalation Paths');
      expect(content).toContain('## Resolution Tracking');
    });
    
    test('should load tools template (YAML)', async () => {
      const content = await loader.loadTemplate(DocumentType.TOOLS);
      
      expect(content).toBeTruthy();
      expect(content).toContain('version:');
      expect(content).toContain('tools:');
      expect(content).toContain('database_backup:');
    });
    
    test('should throw error for invalid document type', async () => {
      await expect(loader.loadTemplate('invalid-type'))
        .rejects.toThrow('Invalid document type');
    });
    
    test('should throw error for non-existent template', async () => {
      await expect(loader.loadTemplate(DocumentType.DEPLOYMENT, 'non-existent'))
        .rejects.toThrow('Template not found');
    });
  });
  
  describe('loadAllTemplates', () => {
    test('should load all 9 templates', async () => {
      const templates = await loader.loadAllTemplates();
      
      expect(Object.keys(templates)).toHaveLength(9);
      expect(templates[DocumentType.DEPLOYMENT]).toBeTruthy();
      expect(templates[DocumentType.MONITORING]).toBeTruthy();
      expect(templates[DocumentType.OPERATIONS]).toBeTruthy();
      expect(templates[DocumentType.TROUBLESHOOTING]).toBeTruthy();
      expect(templates[DocumentType.ROLLBACK]).toBeTruthy();
      expect(templates[DocumentType.CHANGE_IMPACT]).toBeTruthy();
      expect(templates[DocumentType.MIGRATION_PLAN]).toBeTruthy();
      expect(templates[DocumentType.FEEDBACK_RESPONSE]).toBeTruthy();
      // TOOLS is a YAML file, not a markdown template, so it may not be loaded by loadTemplate
      // We'll check if it exists or is null
      expect(templates).toHaveProperty(DocumentType.TOOLS);
    });
    
    test('should handle missing templates gracefully', async () => {
      const templates = await loader.loadAllTemplates('non-existent');
      
      expect(Object.keys(templates)).toHaveLength(9);
      // All should be null since template set doesn't exist
      Object.values(templates).forEach(template => {
        expect(template).toBeNull();
      });
    });
  });
  
  describe('listTemplateSets', () => {
    test('should list available template sets', async () => {
      const sets = await loader.listTemplateSets();
      
      expect(sets).toContain('default');
      expect(Array.isArray(sets)).toBe(true);
    });
  });
  
  describe('checkTemplateCompleteness', () => {
    test('should report default template as complete', async () => {
      const report = await loader.checkTemplateCompleteness('default');
      
      expect(report.complete).toBe(true);
      expect(report.total).toBe(9);
      expect(report.present).toBe(9);
      expect(report.missing).toBe(0);
      expect(report.presentTypes).toHaveLength(9);
      expect(report.missingTypes).toHaveLength(0);
    });
    
    test('should report non-existent template as incomplete', async () => {
      const report = await loader.checkTemplateCompleteness('non-existent');
      
      expect(report.complete).toBe(false);
      expect(report.total).toBe(9);
      expect(report.present).toBe(0);
      expect(report.missing).toBe(9);
      expect(report.missingTypes).toHaveLength(9);
    });
  });
  
  describe('getFileName', () => {
    test('should return correct file name for document type', () => {
      expect(loader.getFileName(DocumentType.DEPLOYMENT)).toBe('deployment.md');
      expect(loader.getFileName(DocumentType.MONITORING)).toBe('monitoring.md');
      expect(loader.getFileName(DocumentType.OPERATIONS)).toBe('operations.md');
      expect(loader.getFileName(DocumentType.TROUBLESHOOTING)).toBe('troubleshooting.md');
      expect(loader.getFileName(DocumentType.ROLLBACK)).toBe('rollback.md');
      expect(loader.getFileName(DocumentType.CHANGE_IMPACT)).toBe('change-impact.md');
      expect(loader.getFileName(DocumentType.MIGRATION_PLAN)).toBe('migration-plan.md');
      expect(loader.getFileName(DocumentType.FEEDBACK_RESPONSE)).toBe('feedback-response.md');
    });
  });
});
