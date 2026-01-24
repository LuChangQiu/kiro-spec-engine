/**
 * Unit Tests for FileScanner
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const FileScanner = require('../../../lib/governance/file-scanner');

describe('FileScanner', () => {
  let tempDir;
  let scanner;
  
  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-scanner-test-'));
    scanner = new FileScanner(tempDir);
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });
  
  describe('findMarkdownFiles', () => {
    it('should find markdown files in a directory', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'CHANGELOG.md'), '# Changes');
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'Not markdown');
      
      const files = await scanner.findMarkdownFiles(tempDir);
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.endsWith('README.md'))).toBe(true);
      expect(files.some(f => f.endsWith('CHANGELOG.md'))).toBe(true);
      expect(files.some(f => f.endsWith('test.txt'))).toBe(false);
    });
    
    it('should return empty array for non-existent directory', async () => {
      const files = await scanner.findMarkdownFiles(path.join(tempDir, 'nonexistent'));
      
      expect(files).toEqual([]);
    });
    
    it('should not include subdirectory files', async () => {
      // Create files in root
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      // Create subdirectory with file
      await fs.ensureDir(path.join(tempDir, 'subdir'));
      await fs.writeFile(path.join(tempDir, 'subdir', 'NESTED.md'), '# Nested');
      
      const files = await scanner.findMarkdownFiles(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('README.md');
      expect(files.some(f => f.includes('NESTED.md'))).toBe(false);
    });
    
    it('should return absolute paths', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      const files = await scanner.findMarkdownFiles(tempDir);
      
      expect(files[0]).toBe(path.join(tempDir, 'README.md'));
      expect(path.isAbsolute(files[0])).toBe(true);
    });
    
    it('should handle empty directory', async () => {
      const files = await scanner.findMarkdownFiles(tempDir);
      
      expect(files).toEqual([]);
    });
  });
  
  describe('findMarkdownFilesRecursive', () => {
    it('should find markdown files recursively', async () => {
      // Create files in root
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      // Create nested structure
      await fs.ensureDir(path.join(tempDir, 'docs'));
      await fs.writeFile(path.join(tempDir, 'docs', 'guide.md'), '# Guide');
      
      await fs.ensureDir(path.join(tempDir, 'docs', 'api'));
      await fs.writeFile(path.join(tempDir, 'docs', 'api', 'reference.md'), '# API');
      
      const files = await scanner.findMarkdownFilesRecursive(tempDir);
      
      expect(files).toHaveLength(3);
      expect(files.some(f => f.endsWith('README.md'))).toBe(true);
      expect(files.some(f => f.endsWith('guide.md'))).toBe(true);
      expect(files.some(f => f.endsWith('reference.md'))).toBe(true);
    });
    
    it('should exclude node_modules by default', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      await fs.ensureDir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'node_modules', 'package.md'), '# Package');
      
      const files = await scanner.findMarkdownFilesRecursive(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('README.md');
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });
    
    it('should exclude .git by default', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      await fs.ensureDir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'config.md'), '# Config');
      
      const files = await scanner.findMarkdownFilesRecursive(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('README.md');
      expect(files.some(f => f.includes('.git'))).toBe(false);
    });
    
    it('should exclude hidden directories', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      await fs.ensureDir(path.join(tempDir, '.hidden'));
      await fs.writeFile(path.join(tempDir, '.hidden', 'secret.md'), '# Secret');
      
      const files = await scanner.findMarkdownFilesRecursive(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('README.md');
      expect(files.some(f => f.includes('.hidden'))).toBe(false);
    });
    
    it('should respect custom exclude directories', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      
      await fs.ensureDir(path.join(tempDir, 'custom'));
      await fs.writeFile(path.join(tempDir, 'custom', 'file.md'), '# Custom');
      
      const files = await scanner.findMarkdownFilesRecursive(tempDir, {
        excludeDirs: ['custom']
      });
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('README.md');
      expect(files.some(f => f.includes('custom'))).toBe(false);
    });
    
    it('should return empty array for non-existent directory', async () => {
      const files = await scanner.findMarkdownFilesRecursive(path.join(tempDir, 'nonexistent'));
      
      expect(files).toEqual([]);
    });
  });
  
  describe('matchPatterns', () => {
    it('should match files against glob patterns', () => {
      const files = [
        '/path/to/README.md',
        '/path/to/SESSION-2024.md',
        '/path/to/TEMP-notes.md',
        '/path/to/guide.md'
      ];
      
      const patterns = ['SESSION-*.md', 'TEMP-*.md'];
      const matches = scanner.matchPatterns(files, patterns);
      
      expect(matches).toHaveLength(2);
      expect(matches.some(f => f.includes('SESSION-2024.md'))).toBe(true);
      expect(matches.some(f => f.includes('TEMP-notes.md'))).toBe(true);
      expect(matches.some(f => f.includes('README.md'))).toBe(false);
    });
    
    it('should match wildcard patterns', () => {
      const files = [
        '/path/to/PROJECT-SUMMARY.md',
        '/path/to/TASK-COMPLETE.md',
        '/path/to/README.md'
      ];
      
      const patterns = ['*-SUMMARY.md', '*-COMPLETE.md'];
      const matches = scanner.matchPatterns(files, patterns);
      
      expect(matches).toHaveLength(2);
      expect(matches.some(f => f.includes('PROJECT-SUMMARY.md'))).toBe(true);
      expect(matches.some(f => f.includes('TASK-COMPLETE.md'))).toBe(true);
    });
    
    it('should not add duplicate matches', () => {
      const files = ['/path/to/TEMP-file.md'];
      const patterns = ['TEMP-*.md', 'TEMP-*'];
      
      const matches = scanner.matchPatterns(files, patterns);
      
      expect(matches).toHaveLength(1);
    });
    
    it('should return empty array when no matches', () => {
      const files = ['/path/to/README.md', '/path/to/CHANGELOG.md'];
      const patterns = ['TEMP-*.md', 'SESSION-*.md'];
      
      const matches = scanner.matchPatterns(files, patterns);
      
      expect(matches).toEqual([]);
    });
    
    it('should be case-sensitive', () => {
      const files = ['/path/to/temp-file.md', '/path/to/TEMP-file.md'];
      const patterns = ['TEMP-*.md'];
      
      const matches = scanner.matchPatterns(files, patterns);
      
      expect(matches).toHaveLength(1);
      expect(matches[0]).toContain('TEMP-file.md');
    });
    
    it('should handle empty file list', () => {
      const matches = scanner.matchPatterns([], ['TEMP-*.md']);
      
      expect(matches).toEqual([]);
    });
    
    it('should handle empty pattern list', () => {
      const files = ['/path/to/README.md'];
      const matches = scanner.matchPatterns(files, []);
      
      expect(matches).toEqual([]);
    });
  });
  
  describe('matchesPattern', () => {
    it('should return true when file matches pattern', () => {
      const result = scanner.matchesPattern('/path/to/SESSION-2024.md', ['SESSION-*.md']);
      
      expect(result).toBe(true);
    });
    
    it('should return false when file does not match pattern', () => {
      const result = scanner.matchesPattern('/path/to/README.md', ['SESSION-*.md']);
      
      expect(result).toBe(false);
    });
    
    it('should check multiple patterns', () => {
      const patterns = ['SESSION-*.md', 'TEMP-*.md', '*-SUMMARY.md'];
      
      expect(scanner.matchesPattern('/path/to/SESSION-2024.md', patterns)).toBe(true);
      expect(scanner.matchesPattern('/path/to/TEMP-notes.md', patterns)).toBe(true);
      expect(scanner.matchesPattern('/path/to/PROJECT-SUMMARY.md', patterns)).toBe(true);
      expect(scanner.matchesPattern('/path/to/README.md', patterns)).toBe(false);
    });
    
    it('should be case-sensitive', () => {
      expect(scanner.matchesPattern('/path/to/temp-file.md', ['TEMP-*.md'])).toBe(false);
      expect(scanner.matchesPattern('/path/to/TEMP-file.md', ['TEMP-*.md'])).toBe(true);
    });
  });
  
  describe('findSpecDirectories', () => {
    it('should find all Spec directories', async () => {
      // Create Spec directories
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/01-00-feature-a'));
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/02-00-feature-b'));
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/03-00-feature-c'));
      
      const specs = await scanner.findSpecDirectories();
      
      expect(specs).toHaveLength(3);
      expect(specs.some(s => s.includes('01-00-feature-a'))).toBe(true);
      expect(specs.some(s => s.includes('02-00-feature-b'))).toBe(true);
      expect(specs.some(s => s.includes('03-00-feature-c'))).toBe(true);
    });
    
    it('should exclude hidden directories', async () => {
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/01-00-feature-a'));
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/.hidden'));
      
      const specs = await scanner.findSpecDirectories();
      
      expect(specs).toHaveLength(1);
      expect(specs[0]).toContain('01-00-feature-a');
      expect(specs.some(s => s.includes('.hidden'))).toBe(false);
    });
    
    it('should return empty array when .kiro/specs does not exist', async () => {
      const specs = await scanner.findSpecDirectories();
      
      expect(specs).toEqual([]);
    });
    
    it('should return empty array when .kiro/specs is empty', async () => {
      await fs.ensureDir(path.join(tempDir, '.kiro/specs'));
      
      const specs = await scanner.findSpecDirectories();
      
      expect(specs).toEqual([]);
    });
    
    it('should return absolute paths', async () => {
      await fs.ensureDir(path.join(tempDir, '.kiro/specs/01-00-feature-a'));
      
      const specs = await scanner.findSpecDirectories();
      
      expect(path.isAbsolute(specs[0])).toBe(true);
    });
  });
  
  describe('getSpecDirectory', () => {
    it('should return correct Spec directory path', () => {
      const specPath = scanner.getSpecDirectory('01-00-feature-a');
      
      expect(specPath).toBe(path.join(tempDir, '.kiro/specs/01-00-feature-a'));
    });
    
    it('should handle different Spec names', () => {
      const specPath1 = scanner.getSpecDirectory('01-00-feature-a');
      const specPath2 = scanner.getSpecDirectory('02-00-feature-b');
      
      expect(specPath1).not.toBe(specPath2);
      expect(specPath1).toContain('01-00-feature-a');
      expect(specPath2).toContain('02-00-feature-b');
    });
  });
  
  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, '# Test');
      
      const exists = await scanner.exists(filePath);
      
      expect(exists).toBe(true);
    });
    
    it('should return true for existing directory', async () => {
      const dirPath = path.join(tempDir, 'testdir');
      await fs.ensureDir(dirPath);
      
      const exists = await scanner.exists(dirPath);
      
      expect(exists).toBe(true);
    });
    
    it('should return false for non-existent path', async () => {
      const exists = await scanner.exists(path.join(tempDir, 'nonexistent'));
      
      expect(exists).toBe(false);
    });
  });
  
  describe('isDirectory', () => {
    it('should return true for directory', async () => {
      const dirPath = path.join(tempDir, 'testdir');
      await fs.ensureDir(dirPath);
      
      const isDir = await scanner.isDirectory(dirPath);
      
      expect(isDir).toBe(true);
    });
    
    it('should return false for file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, '# Test');
      
      const isDir = await scanner.isDirectory(filePath);
      
      expect(isDir).toBe(false);
    });
    
    it('should return false for non-existent path', async () => {
      const isDir = await scanner.isDirectory(path.join(tempDir, 'nonexistent'));
      
      expect(isDir).toBe(false);
    });
  });
  
  describe('isFile', () => {
    it('should return true for file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, '# Test');
      
      const isFile = await scanner.isFile(filePath);
      
      expect(isFile).toBe(true);
    });
    
    it('should return false for directory', async () => {
      const dirPath = path.join(tempDir, 'testdir');
      await fs.ensureDir(dirPath);
      
      const isFile = await scanner.isFile(dirPath);
      
      expect(isFile).toBe(false);
    });
    
    it('should return false for non-existent path', async () => {
      const isFile = await scanner.isFile(path.join(tempDir, 'nonexistent'));
      
      expect(isFile).toBe(false);
    });
  });
  
  describe('getFiles', () => {
    it('should return all files in directory', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'Test');
      await fs.writeFile(path.join(tempDir, 'file3.js'), 'console.log()');
      await fs.ensureDir(path.join(tempDir, 'subdir'));
      
      const files = await scanner.getFiles(tempDir);
      
      expect(files).toHaveLength(3);
      expect(files.some(f => f.endsWith('file1.md'))).toBe(true);
      expect(files.some(f => f.endsWith('file2.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('file3.js'))).toBe(true);
    });
    
    it('should not include subdirectories', async () => {
      await fs.writeFile(path.join(tempDir, 'file.md'), '# Test');
      await fs.ensureDir(path.join(tempDir, 'subdir'));
      
      const files = await scanner.getFiles(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('file.md');
    });
    
    it('should return empty array for empty directory', async () => {
      const files = await scanner.getFiles(tempDir);
      
      expect(files).toEqual([]);
    });
    
    it('should return empty array for non-existent directory', async () => {
      const files = await scanner.getFiles(path.join(tempDir, 'nonexistent'));
      
      expect(files).toEqual([]);
    });
  });
  
  describe('getSubdirectories', () => {
    it('should return all subdirectories', async () => {
      await fs.ensureDir(path.join(tempDir, 'dir1'));
      await fs.ensureDir(path.join(tempDir, 'dir2'));
      await fs.ensureDir(path.join(tempDir, 'dir3'));
      await fs.writeFile(path.join(tempDir, 'file.md'), '# Test');
      
      const dirs = await scanner.getSubdirectories(tempDir);
      
      expect(dirs).toHaveLength(3);
      expect(dirs.some(d => d.endsWith('dir1'))).toBe(true);
      expect(dirs.some(d => d.endsWith('dir2'))).toBe(true);
      expect(dirs.some(d => d.endsWith('dir3'))).toBe(true);
    });
    
    it('should not include files', async () => {
      await fs.ensureDir(path.join(tempDir, 'dir1'));
      await fs.writeFile(path.join(tempDir, 'file.md'), '# Test');
      
      const dirs = await scanner.getSubdirectories(tempDir);
      
      expect(dirs).toHaveLength(1);
      expect(dirs[0]).toContain('dir1');
    });
    
    it('should return empty array for empty directory', async () => {
      const dirs = await scanner.getSubdirectories(tempDir);
      
      expect(dirs).toEqual([]);
    });
    
    it('should return empty array for non-existent directory', async () => {
      const dirs = await scanner.getSubdirectories(path.join(tempDir, 'nonexistent'));
      
      expect(dirs).toEqual([]);
    });
  });
  
  describe('normalizePath', () => {
    it('should normalize path separators', () => {
      const normalized = scanner.normalizePath('path/to/file.md');
      
      // Should use platform-specific separator
      expect(normalized).toBe(path.normalize('path/to/file.md'));
    });
    
    it('should handle mixed separators', () => {
      const input = 'path\\to/file.md';
      const normalized = scanner.normalizePath(input);
      
      // Normalize should convert to platform-specific separators
      // On Windows: path\to\file.md, On Unix: path/to/file.md
      const expected = path.join('path', 'to', 'file.md');
      expect(normalized).toBe(expected);
    });
    
    it('should handle redundant separators', () => {
      const input = 'path//to///file.md';
      const normalized = scanner.normalizePath(input);
      
      // Should remove redundant separators
      const expected = path.join('path', 'to', 'file.md');
      expect(normalized).toBe(expected);
    });
  });
  
  describe('getRelativePath', () => {
    it('should return relative path from project root', () => {
      const absolutePath = path.join(tempDir, 'docs', 'guide.md');
      const relativePath = scanner.getRelativePath(absolutePath);
      
      expect(relativePath).toBe(path.join('docs', 'guide.md'));
    });
    
    it('should handle file in project root', () => {
      const absolutePath = path.join(tempDir, 'README.md');
      const relativePath = scanner.getRelativePath(absolutePath);
      
      expect(relativePath).toBe('README.md');
    });
    
    it('should handle nested paths', () => {
      const absolutePath = path.join(tempDir, 'a', 'b', 'c', 'file.md');
      const relativePath = scanner.getRelativePath(absolutePath);
      
      expect(relativePath).toBe(path.join('a', 'b', 'c', 'file.md'));
    });
  });
  
  describe('getAbsolutePath', () => {
    it('should return absolute path from relative path', () => {
      const relativePath = path.join('docs', 'guide.md');
      const absolutePath = scanner.getAbsolutePath(relativePath);
      
      expect(absolutePath).toBe(path.join(tempDir, 'docs', 'guide.md'));
    });
    
    it('should handle file in project root', () => {
      const absolutePath = scanner.getAbsolutePath('README.md');
      
      expect(absolutePath).toBe(path.join(tempDir, 'README.md'));
    });
    
    it('should handle nested paths', () => {
      const relativePath = path.join('a', 'b', 'c', 'file.md');
      const absolutePath = scanner.getAbsolutePath(relativePath);
      
      expect(absolutePath).toBe(path.join(tempDir, 'a', 'b', 'c', 'file.md'));
    });
  });
  
  describe('cross-platform path handling', () => {
    it('should use platform-specific path separator', () => {
      const specPath = scanner.getSpecDirectory('01-00-feature');
      
      // Path should use the correct separator for the platform
      if (process.platform === 'win32') {
        expect(specPath).toContain('\\');
      } else {
        expect(specPath).toContain('/');
      }
    });
    
    it('should handle paths consistently across methods', async () => {
      const relativePath = path.join('docs', 'guide.md');
      const absolutePath = scanner.getAbsolutePath(relativePath);
      const backToRelative = scanner.getRelativePath(absolutePath);
      
      expect(backToRelative).toBe(relativePath);
    });
  });
  
  describe('integration', () => {
    it('should support full workflow: scan, match, filter', async () => {
      // Create test structure
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(tempDir, 'SESSION-2024.md'), '# Session');
      await fs.writeFile(path.join(tempDir, 'TEMP-notes.md'), '# Temp');
      
      // Scan
      const allFiles = await scanner.findMarkdownFiles(tempDir);
      expect(allFiles).toHaveLength(3);
      
      // Match patterns
      const temporaryFiles = scanner.matchPatterns(allFiles, ['SESSION-*.md', 'TEMP-*.md']);
      expect(temporaryFiles).toHaveLength(2);
      
      // Filter
      const permanentFiles = allFiles.filter(f => !temporaryFiles.includes(f));
      expect(permanentFiles).toHaveLength(1);
      expect(permanentFiles[0]).toContain('README.md');
    });
    
    it('should support Spec directory scanning workflow', async () => {
      // Create Spec structure
      const specPath = path.join(tempDir, '.kiro/specs/01-00-test');
      await fs.ensureDir(specPath);
      await fs.writeFile(path.join(specPath, 'requirements.md'), '# Requirements');
      await fs.writeFile(path.join(specPath, 'design.md'), '# Design');
      await fs.writeFile(path.join(specPath, 'TEMP-notes.md'), '# Temp');
      
      // Find Specs
      const specs = await scanner.findSpecDirectories();
      expect(specs).toHaveLength(1);
      
      // Scan Spec directory
      const files = await scanner.findMarkdownFiles(specs[0]);
      expect(files).toHaveLength(3);
      
      // Find temporary files
      const tempFiles = scanner.matchPatterns(files, ['TEMP-*.md']);
      expect(tempFiles).toHaveLength(1);
    });
  });
});
