/**
 * Tests for FileDiff utility
 */

const FileDiff = require('../../../lib/utils/file-diff');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('FileDiff', () => {
  let fileDiff;
  let tempDir;
  
  beforeEach(async () => {
    fileDiff = new FileDiff();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-diff-test-'));
  });
  
  afterEach(async () => {
    await fs.remove(tempDir);
  });
  
  describe('calculateHash', () => {
    it('should calculate hash for existing file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'test content');
      
      const hash = await fileDiff.calculateHash(filePath);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(32); // MD5 hash length
    });
    
    it('should return null for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      
      const hash = await fileDiff.calculateHash(filePath);
      
      expect(hash).toBeNull();
    });
    
    it('should return same hash for identical content', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      const content = 'identical content';
      
      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);
      
      const hash1 = await fileDiff.calculateHash(file1);
      const hash2 = await fileDiff.calculateHash(file2);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should return different hash for different content', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content 1');
      await fs.writeFile(file2, 'content 2');
      
      const hash1 = await fileDiff.calculateHash(file1);
      const hash2 = await fileDiff.calculateHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
  
  describe('areFilesIdentical', () => {
    it('should return true for identical files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      const content = 'same content';
      
      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);
      
      const identical = await fileDiff.areFilesIdentical(file1, file2);
      
      expect(identical).toBe(true);
    });
    
    it('should return false for different files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content 1');
      await fs.writeFile(file2, 'content 2');
      
      const identical = await fileDiff.areFilesIdentical(file1, file2);
      
      expect(identical).toBe(false);
    });
    
    it('should return false if first file does not exist', async () => {
      const file1 = path.join(tempDir, 'nonexistent.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file2, 'content');
      
      const identical = await fileDiff.areFilesIdentical(file1, file2);
      
      expect(identical).toBe(false);
    });
    
    it('should return false if second file does not exist', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'nonexistent.txt');
      
      await fs.writeFile(file1, 'content');
      
      const identical = await fileDiff.areFilesIdentical(file1, file2);
      
      expect(identical).toBe(false);
    });
    
    it('should return false for files with different sizes', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'short');
      await fs.writeFile(file2, 'much longer content');
      
      const identical = await fileDiff.areFilesIdentical(file1, file2);
      
      expect(identical).toBe(false);
    });
  });
  
  describe('compareFiles', () => {
    it('should identify identical files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      const content = 'same content';
      
      await fs.writeFile(file1, content);
      await fs.writeFile(file2, content);
      
      const filePairs = [
        { source: file1, target: file2 }
      ];
      
      const results = await fileDiff.compareFiles(filePairs, tempDir);
      
      expect(results.identical.length).toBe(1);
      expect(results.different.length).toBe(0);
      expect(results.newFiles.length).toBe(0);
      expect(results.errors.length).toBe(0);
    });
    
    it('should identify different files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content 1');
      await fs.writeFile(file2, 'content 2');
      
      const filePairs = [
        { source: file1, target: file2 }
      ];
      
      const results = await fileDiff.compareFiles(filePairs, tempDir);
      
      expect(results.identical.length).toBe(0);
      expect(results.different.length).toBe(1);
      expect(results.newFiles.length).toBe(0);
      expect(results.errors.length).toBe(0);
    });
    
    it('should identify new files', async () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      
      await fs.writeFile(file1, 'content');
      // file2 does not exist
      
      const filePairs = [
        { source: file1, target: file2 }
      ];
      
      const results = await fileDiff.compareFiles(filePairs, tempDir);
      
      expect(results.identical.length).toBe(0);
      expect(results.different.length).toBe(0);
      expect(results.newFiles.length).toBe(1);
      expect(results.errors.length).toBe(0);
      expect(results.newFiles[0].reason).toBe('Target file does not exist');
    });
    
    it('should handle multiple file pairs', async () => {
      const identical1 = path.join(tempDir, 'identical1.txt');
      const identical2 = path.join(tempDir, 'identical2.txt');
      const different1 = path.join(tempDir, 'different1.txt');
      const different2 = path.join(tempDir, 'different2.txt');
      const new1 = path.join(tempDir, 'new1.txt');
      const new2 = path.join(tempDir, 'new2.txt');
      
      await fs.writeFile(identical1, 'same');
      await fs.writeFile(identical2, 'same');
      await fs.writeFile(different1, 'content 1');
      await fs.writeFile(different2, 'content 2');
      await fs.writeFile(new1, 'new content');
      
      const filePairs = [
        { source: identical1, target: identical2 },
        { source: different1, target: different2 },
        { source: new1, target: new2 }
      ];
      
      const results = await fileDiff.compareFiles(filePairs, tempDir);
      
      expect(results.identical.length).toBe(1);
      expect(results.different.length).toBe(1);
      expect(results.newFiles.length).toBe(1);
      expect(results.errors.length).toBe(0);
    });
    
    it('should handle relative paths', async () => {
      const subdir = path.join(tempDir, 'subdir');
      await fs.ensureDir(subdir);
      
      const file1 = path.join(subdir, 'file1.txt');
      const file2 = path.join(subdir, 'file2.txt');
      
      await fs.writeFile(file1, 'content');
      await fs.writeFile(file2, 'content');
      
      const filePairs = [
        { source: 'subdir/file1.txt', target: 'subdir/file2.txt' }
      ];
      
      const results = await fileDiff.compareFiles(filePairs, tempDir);
      
      expect(results.identical.length).toBe(1);
    });
  });
  
  describe('getSummary', () => {
    it('should generate correct summary', () => {
      const comparisonResults = {
        identical: [{ source: 'a', target: 'b' }, { source: 'c', target: 'd' }],
        different: [{ source: 'e', target: 'f' }],
        newFiles: [{ source: 'g', target: 'h' }],
        errors: []
      };
      
      const summary = fileDiff.getSummary(comparisonResults);
      
      expect(summary.total).toBe(4);
      expect(summary.identical).toBe(2);
      expect(summary.different).toBe(1);
      expect(summary.newFiles).toBe(1);
      expect(summary.errors).toBe(0);
      expect(summary.needsUpdate).toBe(true);
    });
    
    it('should indicate no update needed when all identical', () => {
      const comparisonResults = {
        identical: [{ source: 'a', target: 'b' }],
        different: [],
        newFiles: [],
        errors: []
      };
      
      const summary = fileDiff.getSummary(comparisonResults);
      
      expect(summary.needsUpdate).toBe(false);
    });
  });
  
  describe('getFilesNeedingUpdate', () => {
    it('should return files that need update', () => {
      const comparisonResults = {
        identical: [{ source: 'a', target: 'b' }],
        different: [{ source: 'c', target: 'd' }],
        newFiles: [{ source: 'e', target: 'f' }],
        errors: []
      };
      
      const filesNeedingUpdate = fileDiff.getFilesNeedingUpdate(comparisonResults);
      
      expect(filesNeedingUpdate.length).toBe(2);
      expect(filesNeedingUpdate[0].action).toBe('update');
      expect(filesNeedingUpdate[1].action).toBe('create');
    });
    
    it('should return empty array when no updates needed', () => {
      const comparisonResults = {
        identical: [{ source: 'a', target: 'b' }],
        different: [],
        newFiles: [],
        errors: []
      };
      
      const filesNeedingUpdate = fileDiff.getFilesNeedingUpdate(comparisonResults);
      
      expect(filesNeedingUpdate.length).toBe(0);
    });
  });
});
