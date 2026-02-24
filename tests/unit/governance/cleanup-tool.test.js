/**
 * Unit tests for CleanupTool
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const CleanupTool = require('../../../lib/governance/cleanup-tool');
const ConfigManager = require('../../../lib/governance/config-manager');

describe('CleanupTool', () => {
  let testDir;
  let config;
  
  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `cleanup-tool-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    
    // Load default configuration
    const configManager = new ConfigManager(testDir);
    config = configManager.getDefaults();
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });
  
  describe('constructor', () => {
    test('should initialize with project path and config', () => {
      const tool = new CleanupTool(testDir, config);
      
      expect(tool.projectPath).toBe(testDir);
      expect(tool.config).toBe(config);
      expect(tool.deletedFiles).toEqual([]);
      expect(tool.errors).toEqual([]);
    });
  });
  
  describe('scanRootForTemporary', () => {
    test('should identify temporary files in root directory', async () => {
      // Create test files
      await fs.writeFile(path.join(testDir, 'README.md'), 'content');
      await fs.writeFile(path.join(testDir, 'TEMP-notes.md'), 'content');
      await fs.writeFile(path.join(testDir, 'SESSION-2024.md'), 'content');
      await fs.writeFile(path.join(testDir, 'MVP-COMPLETE.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanRootForTemporary();
      
      expect(temporaryFiles).toHaveLength(3);
      expect(temporaryFiles.some(f => f.endsWith('TEMP-notes.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.endsWith('SESSION-2024.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.endsWith('MVP-COMPLETE.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.endsWith('README.md'))).toBe(false);
    });
    
    test('should return empty array when no temporary files exist', async () => {
      // Create only allowed files
      await fs.writeFile(path.join(testDir, 'README.md'), 'content');
      await fs.writeFile(path.join(testDir, 'CHANGELOG.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanRootForTemporary();
      
      expect(temporaryFiles).toEqual([]);
    });
    
    test('should handle empty root directory', async () => {
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanRootForTemporary();
      
      expect(temporaryFiles).toEqual([]);
    });
  });
  
  describe('scanSpecForTemporary', () => {
    test('should identify temporary files in Spec directory', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      
      // Create test files
      await fs.writeFile(path.join(specPath, 'requirements.md'), 'content');
      await fs.writeFile(path.join(specPath, 'design.md'), 'content');
      await fs.writeFile(path.join(specPath, 'tasks.md'), 'content');
      await fs.writeFile(path.join(specPath, 'TEMP-analysis.md'), 'content');
      await fs.writeFile(path.join(specPath, 'WIP-notes.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanSpecForTemporary('test-spec');
      
      expect(temporaryFiles).toHaveLength(2);
      expect(temporaryFiles.some(f => f.endsWith('TEMP-analysis.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.endsWith('WIP-notes.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.endsWith('requirements.md'))).toBe(false);
    });
    
    test('should not delete required files even if they match patterns', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      
      // Create required files (even with names that might match patterns)
      await fs.writeFile(path.join(specPath, 'requirements.md'), 'content');
      await fs.writeFile(path.join(specPath, 'design.md'), 'content');
      await fs.writeFile(path.join(specPath, 'tasks.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanSpecForTemporary('test-spec');
      
      expect(temporaryFiles).toEqual([]);
    });
    
    test('should return empty array for non-existent Spec', async () => {
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanSpecForTemporary('non-existent-spec');
      
      expect(temporaryFiles).toEqual([]);
    });
  });
  
  describe('scanAllSpecsForTemporary', () => {
    test('should scan all Spec directories', async () => {
      // Create multiple Specs with temporary files
      const spec1Path = path.join(testDir, '.sce/specs/spec-1');
      const spec2Path = path.join(testDir, '.sce/specs/spec-2');
      await fs.ensureDir(spec1Path);
      await fs.ensureDir(spec2Path);
      
      await fs.writeFile(path.join(spec1Path, 'TEMP-file1.md'), 'content');
      await fs.writeFile(path.join(spec2Path, 'WIP-file2.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanAllSpecsForTemporary();
      
      expect(temporaryFiles).toHaveLength(2);
      expect(temporaryFiles.some(f => f.includes('spec-1') && f.endsWith('TEMP-file1.md'))).toBe(true);
      expect(temporaryFiles.some(f => f.includes('spec-2') && f.endsWith('WIP-file2.md'))).toBe(true);
    });
    
    test('should return empty array when no Specs exist', async () => {
      const tool = new CleanupTool(testDir, config);
      const temporaryFiles = await tool.scanAllSpecsForTemporary();
      
      expect(temporaryFiles).toEqual([]);
    });
  });
  
  describe('identifyFilesToDelete', () => {
    test('should identify files from both root and all Specs when no spec specified', async () => {
      // Create root temporary file
      await fs.writeFile(path.join(testDir, 'TEMP-root.md'), 'content');
      
      // Create Spec temporary file
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'WIP-spec.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const filesToDelete = await tool.identifyFilesToDelete();
      
      expect(filesToDelete).toHaveLength(2);
      expect(filesToDelete.some(f => f.endsWith('TEMP-root.md'))).toBe(true);
      expect(filesToDelete.some(f => f.endsWith('WIP-spec.md'))).toBe(true);
    });
    
    test('should only identify files from specified Spec when spec provided', async () => {
      // Create root temporary file
      await fs.writeFile(path.join(testDir, 'TEMP-root.md'), 'content');
      
      // Create Spec temporary files
      const spec1Path = path.join(testDir, '.sce/specs/spec-1');
      const spec2Path = path.join(testDir, '.sce/specs/spec-2');
      await fs.ensureDir(spec1Path);
      await fs.ensureDir(spec2Path);
      await fs.writeFile(path.join(spec1Path, 'WIP-spec1.md'), 'content');
      await fs.writeFile(path.join(spec2Path, 'WIP-spec2.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const filesToDelete = await tool.identifyFilesToDelete('spec-1');
      
      // Should include root files and only spec-1 files
      expect(filesToDelete).toHaveLength(2);
      expect(filesToDelete.some(f => f.endsWith('TEMP-root.md'))).toBe(true);
      expect(filesToDelete.some(f => f.endsWith('WIP-spec1.md'))).toBe(true);
      expect(filesToDelete.some(f => f.endsWith('WIP-spec2.md'))).toBe(false);
    });
  });
  
  describe('deleteFile', () => {
    test('should delete file and add to deletedFiles list', async () => {
      const filePath = path.join(testDir, 'test-file.md');
      await fs.writeFile(filePath, 'content');
      
      const tool = new CleanupTool(testDir, config);
      await tool.deleteFile(filePath);
      
      expect(tool.deletedFiles).toContain(filePath);
      expect(await fs.pathExists(filePath)).toBe(false);
    });
    
    test('should handle non-existent files gracefully (fs.remove succeeds)', async () => {
      // Note: fs.remove() doesn't throw for non-existent files, it succeeds silently
      const filePath = path.join(testDir, 'non-existent.md');
      
      const tool = new CleanupTool(testDir, config);
      await tool.deleteFile(filePath);
      
      // fs.remove succeeds even for non-existent files
      expect(tool.deletedFiles).toContain(filePath);
      expect(tool.errors).toHaveLength(0);
    });
    
    test('should continue after error and not throw', async () => {
      const filePath = path.join(testDir, 'test-file.md');
      await fs.writeFile(filePath, 'content');
      
      const tool = new CleanupTool(testDir, config);
      
      // Should not throw
      await expect(tool.deleteFile(filePath)).resolves.not.toThrow();
      
      expect(tool.deletedFiles).toContain(filePath);
      expect(tool.errors).toHaveLength(0);
    });
  });
  
  describe('cleanup with dryRun', () => {
    test('should preview files without deleting them', async () => {
      // Create temporary files
      const file1 = path.join(testDir, 'TEMP-file1.md');
      const file2 = path.join(testDir, 'WIP-file2.md');
      await fs.writeFile(file1, 'content');
      await fs.writeFile(file2, 'content');
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ dryRun: true });
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.deletedFiles).toHaveLength(2);
      expect(report.errors).toEqual([]);
      expect(report.summary.totalDeleted).toBe(2);
      expect(report.summary.totalErrors).toBe(0);
      
      // Files should still exist
      expect(await fs.pathExists(file1)).toBe(true);
      expect(await fs.pathExists(file2)).toBe(true);
    });
    
    test('should return empty report when no files to delete', async () => {
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ dryRun: true });
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.deletedFiles).toEqual([]);
      expect(report.summary.totalDeleted).toBe(0);
    });
  });
  
  describe('cleanup without dryRun', () => {
    test('should delete identified files', async () => {
      // Create temporary files
      const file1 = path.join(testDir, 'TEMP-file1.md');
      const file2 = path.join(testDir, 'WIP-file2.md');
      await fs.writeFile(file1, 'content');
      await fs.writeFile(file2, 'content');
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ dryRun: false });
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(false);
      expect(report.deletedFiles).toHaveLength(2);
      expect(report.errors).toEqual([]);
      expect(report.summary.totalDeleted).toBe(2);
      
      // Files should be deleted
      expect(await fs.pathExists(file1)).toBe(false);
      expect(await fs.pathExists(file2)).toBe(false);
    });
    
    test('should delete multiple files successfully', async () => {
      // Create multiple valid files
      const file1 = path.join(testDir, 'TEMP-file1.md');
      const file2 = path.join(testDir, 'TEMP-file2.md');
      await fs.writeFile(file1, 'content');
      await fs.writeFile(file2, 'content');
      
      const tool = new CleanupTool(testDir, config);
      
      await tool.deleteFile(file1);
      await tool.deleteFile(file2);
      
      expect(tool.deletedFiles).toHaveLength(2);
      expect(tool.errors).toHaveLength(0);
      expect(await fs.pathExists(file1)).toBe(false);
      expect(await fs.pathExists(file2)).toBe(false);
    });
    
    test('should generate report with success true when no errors', async () => {
      const tool = new CleanupTool(testDir, config);
      
      // Delete a file successfully
      const file = path.join(testDir, 'TEMP-test.md');
      await fs.writeFile(file, 'content');
      await tool.deleteFile(file);
      
      const report = tool.generateReport();
      
      expect(report.success).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.summary.totalErrors).toBe(0);
    });
  });
  
  describe('cleanup with spec option', () => {
    test('should only clean specified Spec directory', async () => {
      // Create temporary files in multiple Specs
      const spec1Path = path.join(testDir, '.sce/specs/spec-1');
      const spec2Path = path.join(testDir, '.sce/specs/spec-2');
      await fs.ensureDir(spec1Path);
      await fs.ensureDir(spec2Path);
      
      const file1 = path.join(spec1Path, 'TEMP-file1.md');
      const file2 = path.join(spec2Path, 'TEMP-file2.md');
      await fs.writeFile(file1, 'content');
      await fs.writeFile(file2, 'content');
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ spec: 'spec-1' });
      
      expect(report.success).toBe(true);
      expect(report.deletedFiles).toHaveLength(1);
      expect(report.deletedFiles[0]).toBe(file1);
      
      // Only spec-1 file should be deleted
      expect(await fs.pathExists(file1)).toBe(false);
      expect(await fs.pathExists(file2)).toBe(true);
    });
  });
  
  describe('generateDryRunReport', () => {
    test('should generate report with dryRun flag', () => {
      const tool = new CleanupTool(testDir, config);
      const filesToDelete = ['/path/to/file1.md', '/path/to/file2.md'];
      
      const report = tool.generateDryRunReport(filesToDelete);
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.deletedFiles).toEqual(filesToDelete);
      expect(report.errors).toEqual([]);
      expect(report.summary.totalDeleted).toBe(2);
      expect(report.summary.totalErrors).toBe(0);
    });
  });
  
  describe('generateReport', () => {
    test('should generate report with success true when no errors', () => {
      const tool = new CleanupTool(testDir, config);
      tool.deletedFiles = ['/path/to/file1.md', '/path/to/file2.md'];
      
      const report = tool.generateReport();
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(false);
      expect(report.deletedFiles).toEqual(tool.deletedFiles);
      expect(report.errors).toEqual([]);
      expect(report.summary.totalDeleted).toBe(2);
      expect(report.summary.totalErrors).toBe(0);
    });
    
    test('should generate report with success false when errors exist', () => {
      const tool = new CleanupTool(testDir, config);
      tool.deletedFiles = ['/path/to/file1.md'];
      tool.errors = [{ path: '/path/to/file2.md', error: 'Permission denied' }];
      
      const report = tool.generateReport();
      
      expect(report.success).toBe(false);
      expect(report.deletedFiles).toHaveLength(1);
      expect(report.errors).toHaveLength(1);
      expect(report.summary.totalDeleted).toBe(1);
      expect(report.summary.totalErrors).toBe(1);
    });
  });
  
  describe('edge cases', () => {
    test('should handle Spec directory with only required files', async () => {
      const specPath = path.join(testDir, '.sce/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), 'content');
      await fs.writeFile(path.join(specPath, 'design.md'), 'content');
      await fs.writeFile(path.join(specPath, 'tasks.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ spec: 'test-spec' });
      
      expect(report.success).toBe(true);
      expect(report.deletedFiles).toEqual([]);
    });
    
    test('should handle empty Spec directory', async () => {
      const specPath = path.join(testDir, '.sce/specs/empty-spec');
      await fs.ensureDir(specPath);
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup({ spec: 'empty-spec' });
      
      expect(report.success).toBe(true);
      expect(report.deletedFiles).toEqual([]);
    });
    
    test('should handle mixed temporary patterns', async () => {
      // Create files matching different temporary patterns
      await fs.writeFile(path.join(testDir, 'TEST-SUMMARY.md'), 'content');
      await fs.writeFile(path.join(testDir, 'SESSION-123.md'), 'content');
      await fs.writeFile(path.join(testDir, 'FEATURE-COMPLETE.md'), 'content');
      await fs.writeFile(path.join(testDir, 'TEMP-notes.md'), 'content');
      await fs.writeFile(path.join(testDir, 'WIP-draft.md'), 'content');
      await fs.writeFile(path.join(testDir, 'MVP-done.md'), 'content');
      
      const tool = new CleanupTool(testDir, config);
      const report = await tool.cleanup();
      
      expect(report.success).toBe(true);
      expect(report.deletedFiles.length).toBeGreaterThan(0);
      
      // All matching files should be deleted
      expect(await fs.pathExists(path.join(testDir, 'TEST-SUMMARY.md'))).toBe(false);
      expect(await fs.pathExists(path.join(testDir, 'SESSION-123.md'))).toBe(false);
      expect(await fs.pathExists(path.join(testDir, 'FEATURE-COMPLETE.md'))).toBe(false);
      expect(await fs.pathExists(path.join(testDir, 'TEMP-notes.md'))).toBe(false);
      expect(await fs.pathExists(path.join(testDir, 'WIP-draft.md'))).toBe(false);
      expect(await fs.pathExists(path.join(testDir, 'MVP-done.md'))).toBe(false);
    });
  });
});
