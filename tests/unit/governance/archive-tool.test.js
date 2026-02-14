/**
 * Unit tests for ArchiveTool
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const ArchiveTool = require('../../../lib/governance/archive-tool');

describe('ArchiveTool', () => {
  let testDir;
  let tool;
  let config;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-test-'));
    
    // Default config
    config = {
      rootAllowedFiles: ['README.md', 'README.zh.md', 'CHANGELOG.md', 'CONTRIBUTING.md'],
      specSubdirs: ['reports', 'scripts', 'tests', 'results', 'docs'],
      temporaryPatterns: ['*-SUMMARY.md', 'SESSION-*.md', '*-COMPLETE.md']
    };
    
    tool = new ArchiveTool(testDir, config);
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });
  
  describe('archive', () => {
    test('should move script files to scripts subdirectory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'analyze.js'), 'console.log("test");');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('scripts');
      expect(await fs.pathExists(path.join(specPath, 'scripts/analyze.js'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'analyze.js'))).toBe(false);
    });
    
    test('should move report files to reports subdirectory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'analysis-report.md'), '# Report');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('reports');
      expect(await fs.pathExists(path.join(specPath, 'reports/analysis-report.md'))).toBe(true);
    });
    
    test('should move test files to tests subdirectory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'feature.test.js'), 'test();');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('tests');
      expect(await fs.pathExists(path.join(specPath, 'tests/feature.test.js'))).toBe(true);
    });
    
    test('should move result files to results subdirectory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'test-results.json'), '{}');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('results');
      expect(await fs.pathExists(path.join(specPath, 'results/test-results.json'))).toBe(true);
    });
    
    test('should move documentation files to docs subdirectory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'notes.md'), '# Notes');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('docs');
      expect(await fs.pathExists(path.join(specPath, 'docs/notes.md'))).toBe(true);
    });
    
    test('should not move required files', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(0);
      expect(await fs.pathExists(path.join(specPath, 'requirements.md'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'design.md'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'tasks.md'))).toBe(true);
    });
    
    test('should handle multiple files', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      await fs.writeFile(path.join(specPath, 'report.md'), '# Report');
      await fs.writeFile(path.join(specPath, 'test.test.js'), 'test();');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(3);
      expect(await fs.pathExists(path.join(specPath, 'scripts/script.js'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'reports/report.md'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'tests/test.test.js'))).toBe(true);
    });
    
    test('should create subdirectories if they do not exist', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      
      // Verify scripts directory doesn't exist
      expect(await fs.pathExists(path.join(specPath, 'scripts'))).toBe(false);
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'scripts'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'scripts/script.js'))).toBe(true);
    });
    
    test('should handle non-existent Spec directory', async () => {
      const report = await tool.archive('non-existent-spec');
      
      expect(report.success).toBe(false);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].error).toContain('does not exist');
    });
    
    test('should handle file move errors gracefully', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      
      // Create target file to cause conflict
      await fs.ensureDir(path.join(specPath, 'scripts'));
      await fs.writeFile(path.join(specPath, 'scripts/script.js'), 'existing');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(false);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].error).toContain('already exists');
    });
  });
  
  describe('archive with dry run', () => {
    test('should preview moves without actually moving files', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      
      const report = await tool.archive('test-spec', { dryRun: true });
      
      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.movedFiles).toHaveLength(1);
      expect(report.movedFiles[0].to).toContain('scripts');
      
      // File should still be in original location
      expect(await fs.pathExists(path.join(specPath, 'script.js'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'scripts/script.js'))).toBe(false);
    });
    
    test('should show all files that would be moved', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      await fs.writeFile(path.join(specPath, 'report.md'), '# Report');
      await fs.writeFile(path.join(specPath, 'test.test.js'), 'test();');
      
      const report = await tool.archive('test-spec', { dryRun: true });
      
      expect(report.dryRun).toBe(true);
      expect(report.movedFiles).toHaveLength(3);
      
      // All files should still be in original location
      expect(await fs.pathExists(path.join(specPath, 'script.js'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'report.md'))).toBe(true);
      expect(await fs.pathExists(path.join(specPath, 'test.test.js'))).toBe(true);
    });
  });
  
  describe('determineTargetSubdir', () => {
    test('should classify JavaScript files as scripts', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'analyze.js'), 'console.log();');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('scripts');
    });
    
    test('should classify Python files as scripts', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'analyze.py'), 'print("test")');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('scripts');
    });
    
    test('should classify shell scripts as scripts', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'run.sh'), '#!/bin/bash');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('scripts');
    });
    
    test('should classify test files correctly', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'feature.test.js'), 'test();');
      await fs.writeFile(path.join(specPath, 'feature.spec.js'), 'describe();');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('tests');
      expect(artifacts[1].targetSubdir).toBe('tests');
    });
    
    test('should classify report files correctly', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'analysis-report.md'), '# Report');
      await fs.writeFile(path.join(specPath, 'summary.md'), '# Summary');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('reports');
      expect(artifacts[1].targetSubdir).toBe('reports');
    });
    
    test('should default to docs for unclassified files', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'notes.md'), '# Notes');
      await fs.writeFile(path.join(specPath, 'guide.txt'), 'Guide');
      
      const artifacts = await tool.identifyArtifacts(specPath);
      
      expect(artifacts[0].targetSubdir).toBe('docs');
      expect(artifacts[1].targetSubdir).toBe('docs');
    });

    test('should fallback to custom when preferred subdir is not allowed', () => {
      const constrainedTool = new ArchiveTool(testDir, {
        ...config,
        specSubdirs: ['reports', 'scripts', 'custom']
      });

      expect(constrainedTool.determineTargetSubdir('notes.md')).toBe('custom');
      expect(constrainedTool.determineTargetSubdir('feature.test.js')).toBe('custom');
      expect(constrainedTool.determineTargetSubdir('test-results.json')).toBe('custom');
    });

    test('should fallback to mapped subdirs when custom is unavailable', () => {
      const constrainedTool = new ArchiveTool(testDir, {
        ...config,
        specSubdirs: ['reports', 'scripts']
      });

      expect(constrainedTool.determineTargetSubdir('notes.md')).toBe('reports');
      expect(constrainedTool.determineTargetSubdir('feature.test.js')).toBe('scripts');
      expect(constrainedTool.determineTargetSubdir('test-results.json')).toBe('reports');
    });
  });
  
  describe('generateReport', () => {
    test('should include summary statistics', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      await fs.writeFile(path.join(specPath, 'script.js'), 'console.log();');
      await fs.writeFile(path.join(specPath, 'report.md'), '# Report');
      
      const report = await tool.archive('test-spec');
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalMoved).toBe(2);
      expect(report.summary.totalErrors).toBe(0);
    });
  });
  
  describe('edge cases', () => {
    test('should handle empty Spec directory', async () => {
      const specPath = path.join(testDir, '.kiro/specs/test-spec');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'tasks.md'), '# Tasks');
      
      const report = await tool.archive('test-spec');
      
      expect(report.success).toBe(true);
      expect(report.movedFiles).toHaveLength(0);
    });
  });
});
