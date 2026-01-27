/**
 * Unit Tests: Template Sync System
 * 
 * Tests the automatic template file synchronization system.
 */

const path = require('path');
const fs = require('fs-extra');
const TemplateSync = require('../../../lib/adoption/template-sync');

describe('TemplateSync', () => {
  let templateSync;
  let testDir;
  let projectPath;
  let templatePath;

  beforeEach(async () => {
    templateSync = new TemplateSync();
    
    // Create temporary test directories
    testDir = path.join(__dirname, '../../temp/template-sync-test');
    projectPath = path.join(testDir, 'project');
    templatePath = path.join(testDir, 'template');
    
    await fs.ensureDir(projectPath);
    await fs.ensureDir(templatePath);
    await fs.ensureDir(path.join(projectPath, '.kiro'));
  });

  afterEach(async () => {
    // Clean up test directories
    await fs.remove(testDir);
  });

  describe('detectTemplateDifferences', () => {
    test('should detect missing files', async () => {
      // Create template file but not project file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Core principles content'
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      expect(report.summary.missing).toBe(1);
      expect(report.differences.missing).toHaveLength(1);
      expect(report.differences.missing[0].path).toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should detect different files', async () => {
      // Create template and project files with different content
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Template content'
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md'),
        'Project content'
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      expect(report.summary.different).toBe(1);
      expect(report.differences.different).toHaveLength(1);
      expect(report.differences.different[0].path).toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should detect identical files', async () => {
      // Create template and project files with identical content
      const content = 'Identical content';
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        content
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md'),
        content
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      expect(report.summary.identical).toBe(1);
      expect(report.differences.identical).toHaveLength(1);
      expect(report.differences.identical[0].path).toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should preserve CURRENT_CONTEXT.md', async () => {
      // Add CURRENT_CONTEXT.md to template files list for this test
      templateSync.addTemplateFile('steering/CURRENT_CONTEXT.md');
      
      // Create CURRENT_CONTEXT.md in both locations
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CURRENT_CONTEXT.md'),
        'Template context'
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CURRENT_CONTEXT.md'),
        'User context'
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      expect(report.summary.preserved).toBe(1);
      expect(report.differences.preserved).toHaveLength(1);
      expect(report.differences.preserved[0].path).toBe('steering/CURRENT_CONTEXT.md');
      expect(report.differences.preserved[0].reason).toBe('User-specific file');
      
      // Clean up
      templateSync.removeTemplateFile('steering/CURRENT_CONTEXT.md');
    });

    test('should handle template file not found', async () => {
      // Don't create any template files
      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      // All template files should be in errors
      expect(report.summary.errors).toBeGreaterThan(0);
      expect(report.differences.errors.length).toBeGreaterThan(0);
    });

    test('should provide accurate summary', async () => {
      // Create mix of scenarios
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      // Missing file
      await fs.writeFile(
        path.join(templatePath, 'steering/ENVIRONMENT.md'),
        'Environment content'
      );
      
      // Different file
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Template principles'
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md'),
        'Project principles'
      );
      
      // Identical file
      const rulesContent = 'Rules content';
      await fs.writeFile(
        path.join(templatePath, 'steering/RULES_GUIDE.md'),
        rulesContent
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/RULES_GUIDE.md'),
        rulesContent
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

      expect(report.summary.missing).toBe(1);
      expect(report.summary.different).toBe(1);
      expect(report.summary.identical).toBe(1);
      expect(report.summary.needsSync).toBe(2); // missing + different
    });
  });

  describe('compareFiles', () => {
    test('should detect different text files', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      
      await fs.writeFile(file1, 'Content 1');
      await fs.writeFile(file2, 'Content 2');

      const isDifferent = await templateSync.compareFiles(file1, file2);
      expect(isDifferent).toBe(true);
    });

    test('should detect identical text files', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      const content = 'Same content';
      
      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);

      const isDifferent = await templateSync.compareFiles(file1, file2);
      expect(isDifferent).toBe(false);
    });

    test('should normalize line endings when comparing', async () => {
      const file1 = path.join(testDir, 'file1.txt');
      const file2 = path.join(testDir, 'file2.txt');
      
      await fs.writeFile(file1, 'Line 1\nLine 2\n');
      await fs.writeFile(file2, 'Line 1\r\nLine 2\r\n');

      const isDifferent = await templateSync.compareFiles(file1, file2);
      expect(isDifferent).toBe(false); // Should be identical after normalization
    });

    test('should handle binary files', async () => {
      const file1 = path.join(testDir, 'file1.bin');
      const file2 = path.join(testDir, 'file2.bin');
      
      // Create binary content
      const buffer1 = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const buffer2 = Buffer.from([0x00, 0x01, 0x02, 0x04]);
      
      await fs.writeFile(file1, buffer1);
      await fs.writeFile(file2, buffer2);

      const isDifferent = await templateSync.compareFiles(file1, file2);
      expect(isDifferent).toBe(true);
    });
  });

  describe('isBinaryFile', () => {
    test('should identify text files by extension', async () => {
      const textFile = path.join(testDir, 'test.md');
      await fs.writeFile(textFile, 'Text content');

      const isBinary = await templateSync.isBinaryFile(textFile);
      expect(isBinary).toBe(false);
    });

    test('should identify Python files as text', async () => {
      const pyFile = path.join(testDir, 'test.py');
      await fs.writeFile(pyFile, 'print("Hello")');

      const isBinary = await templateSync.isBinaryFile(pyFile);
      expect(isBinary).toBe(false);
    });

    test('should detect binary files by null bytes', async () => {
      const binFile = path.join(testDir, 'test.bin');
      const buffer = Buffer.from([0x00, 0x01, 0x02]);
      await fs.writeFile(binFile, buffer);

      const isBinary = await templateSync.isBinaryFile(binFile);
      expect(isBinary).toBe(true);
    });
  });

  describe('shouldPreserve', () => {
    test('should preserve CURRENT_CONTEXT.md', () => {
      expect(templateSync.shouldPreserve('steering/CURRENT_CONTEXT.md')).toBe(true);
    });

    test('should not preserve other steering files', () => {
      expect(templateSync.shouldPreserve('steering/CORE_PRINCIPLES.md')).toBe(false);
      expect(templateSync.shouldPreserve('steering/ENVIRONMENT.md')).toBe(false);
    });

    test('should handle paths with backslashes', () => {
      expect(templateSync.shouldPreserve('steering\\CURRENT_CONTEXT.md')).toBe(true);
    });
  });

  describe('syncTemplates', () => {
    test('should sync missing files', async () => {
      // Create template file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Core principles'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath);

      expect(result.summary.synced).toBe(1);
      expect(result.summary.created).toBe(1);
      expect(result.synced[0].action).toBe('created');
      
      // Verify file was created
      const projectFile = path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md');
      const exists = await fs.pathExists(projectFile);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(projectFile, 'utf8');
      expect(content).toBe('Core principles');
    });

    test('should update different files', async () => {
      // Create template and project files with different content
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'New content'
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md'),
        'Old content'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath);

      expect(result.summary.synced).toBe(1);
      expect(result.summary.updated).toBe(1);
      expect(result.synced[0].action).toBe('updated');
      
      // Verify file was updated
      const projectFile = path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md');
      const content = await fs.readFile(projectFile, 'utf8');
      expect(content).toBe('New content');
    });

    test('should not sync identical files', async () => {
      // Create identical files
      const content = 'Same content';
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        content
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md'),
        content
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath);

      expect(result.summary.synced).toBe(0);
      expect(result.synced).toHaveLength(0);
    });

    test('should preserve CURRENT_CONTEXT.md', async () => {
      // Create CURRENT_CONTEXT.md in both locations
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.ensureDir(path.join(projectPath, '.kiro/steering'));
      
      await fs.writeFile(
        path.join(templatePath, 'steering/CURRENT_CONTEXT.md'),
        'Template context'
      );
      await fs.writeFile(
        path.join(projectPath, '.kiro/steering/CURRENT_CONTEXT.md'),
        'User context'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath);

      // Should not sync preserved file
      expect(result.synced.find(s => s.path === 'steering/CURRENT_CONTEXT.md')).toBeUndefined();
      
      // Verify user content was preserved
      const projectFile = path.join(projectPath, '.kiro/steering/CURRENT_CONTEXT.md');
      const content = await fs.readFile(projectFile, 'utf8');
      expect(content).toBe('User context');
    });

    test('should support dry-run mode', async () => {
      // Create template file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Core principles'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.synced).toHaveLength(0);
      expect(result.report.summary.needsSync).toBe(1);
      
      // Verify file was NOT created
      const projectFile = path.join(projectPath, '.kiro/steering/CORE_PRINCIPLES.md');
      const exists = await fs.pathExists(projectFile);
      expect(exists).toBe(false);
    });

    test('should call progress callback', async () => {
      // Create template file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Core principles'
      );

      const progressCalls = [];
      const onProgress = (update) => {
        progressCalls.push(update);
      };

      await templateSync.syncTemplates(projectPath, templatePath, { onProgress });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].type).toBe('create');
      expect(progressCalls[0].file).toBe('steering/CORE_PRINCIPLES.md');
      expect(progressCalls[0].status).toBe('in-progress');
      
      const lastCall = progressCalls[progressCalls.length - 1];
      expect(lastCall.status).toBe('complete');
    });

    test('should handle sync errors gracefully', async () => {
      // Create template file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Core principles'
      );

      // Mock fs.copy to throw an error
      const originalCopy = fs.copy;
      fs.copy = jest.fn().mockRejectedValue(new Error('Mock copy error'));

      const result = await templateSync.syncTemplates(projectPath, templatePath);

      // Should have errors but not throw
      expect(result.summary.errors).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Mock copy error');

      // Restore original function
      fs.copy = originalCopy;
    });
  });

  describe('formatSyncReport', () => {
    test('should format sync report correctly', async () => {
      // Create test scenario
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Principles'
      );

      const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);
      const formatted = templateSync.formatSyncReport(report);

      expect(formatted).toContain('Template Sync Report:');
      expect(formatted).toContain('Total templates:');
      expect(formatted).toContain('Needs sync:');
      expect(formatted).toContain('Missing files:');
    });
  });

  describe('formatSyncResult', () => {
    test('should format sync result correctly', async () => {
      // Create template file
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Principles'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath);
      const formatted = templateSync.formatSyncResult(result);

      expect(formatted).toContain('Template Sync Complete:');
      expect(formatted).toContain('Synced:');
      expect(formatted).toContain('Created:');
    });

    test('should format dry-run result correctly', async () => {
      await fs.ensureDir(path.join(templatePath, 'steering'));
      await fs.writeFile(
        path.join(templatePath, 'steering/CORE_PRINCIPLES.md'),
        'Principles'
      );

      const result = await templateSync.syncTemplates(projectPath, templatePath, { dryRun: true });
      const formatted = templateSync.formatSyncResult(result);

      expect(formatted).toContain('Dry Run - No changes made');
    });
  });

  describe('template file management', () => {
    test('should get template files list', () => {
      const files = templateSync.getTemplateFiles();
      
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files).toContain('steering/CORE_PRINCIPLES.md');
    });

    test('should get preserved files list', () => {
      const files = templateSync.getPreservedFiles();
      
      expect(Array.isArray(files)).toBe(true);
      expect(files).toContain('steering/CURRENT_CONTEXT.md');
    });

    test('should add template file', () => {
      const initialCount = templateSync.getTemplateFiles().length;
      
      templateSync.addTemplateFile('custom/template.md');
      
      const files = templateSync.getTemplateFiles();
      expect(files.length).toBe(initialCount + 1);
      expect(files).toContain('custom/template.md');
    });

    test('should not add duplicate template file', () => {
      const initialCount = templateSync.getTemplateFiles().length;
      
      templateSync.addTemplateFile('steering/CORE_PRINCIPLES.md');
      
      const files = templateSync.getTemplateFiles();
      expect(files.length).toBe(initialCount); // No change
    });

    test('should remove template file', () => {
      templateSync.addTemplateFile('custom/template.md');
      const initialCount = templateSync.getTemplateFiles().length;
      
      templateSync.removeTemplateFile('custom/template.md');
      
      const files = templateSync.getTemplateFiles();
      expect(files.length).toBe(initialCount - 1);
      expect(files).not.toContain('custom/template.md');
    });

    test('should add preserved file', () => {
      const initialCount = templateSync.getPreservedFiles().length;
      
      templateSync.addPreservedFile('custom/preserve.md');
      
      const files = templateSync.getPreservedFiles();
      expect(files.length).toBe(initialCount + 1);
      expect(files).toContain('custom/preserve.md');
    });

    test('should remove preserved file', () => {
      templateSync.addPreservedFile('custom/preserve.md');
      const initialCount = templateSync.getPreservedFiles().length;
      
      templateSync.removePreservedFile('custom/preserve.md');
      
      const files = templateSync.getPreservedFiles();
      expect(files.length).toBe(initialCount - 1);
      expect(files).not.toContain('custom/preserve.md');
    });
  });

  describe('normalizeLineEndings', () => {
    test('should normalize CRLF to LF', () => {
      const input = 'Line 1\r\nLine 2\r\n';
      const expected = 'Line 1\nLine 2\n';
      
      const result = templateSync.normalizeLineEndings(input);
      expect(result).toBe(expected);
    });

    test('should normalize CR to LF', () => {
      const input = 'Line 1\rLine 2\r';
      const expected = 'Line 1\nLine 2\n';
      
      const result = templateSync.normalizeLineEndings(input);
      expect(result).toBe(expected);
    });

    test('should leave LF unchanged', () => {
      const input = 'Line 1\nLine 2\n';
      
      const result = templateSync.normalizeLineEndings(input);
      expect(result).toBe(input);
    });
  });

  describe('calculateHash', () => {
    test('should calculate consistent hash for same content', () => {
      const content = 'Test content';
      
      const hash1 = templateSync.calculateHash(content);
      const hash2 = templateSync.calculateHash(content);
      
      expect(hash1).toBe(hash2);
    });

    test('should calculate different hash for different content', () => {
      const content1 = 'Content 1';
      const content2 = 'Content 2';
      
      const hash1 = templateSync.calculateHash(content1);
      const hash2 = templateSync.calculateHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle Buffer input', () => {
      const buffer = Buffer.from('Test content');
      
      const hash = templateSync.calculateHash(buffer);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });
  });
});
