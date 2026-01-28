const path = require('path');
const os = require('os');
const { PathUtils } = require('../../../lib/workspace/multi');

describe('PathUtils', () => {
  describe('normalize', () => {
    it('should convert backslashes to forward slashes', () => {
      const input = 'C:\\Users\\test\\project';
      const result = PathUtils.normalize(input);
      expect(result).toMatch(/\//);
      expect(result).not.toMatch(/\\/);
    });

    it('should convert relative paths to absolute', () => {
      const input = './test/path';
      const result = PathUtils.normalize(input);
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should expand home directory (~)', () => {
      const input = '~/projects/test';
      const result = PathUtils.normalize(input);
      expect(result).toContain(os.homedir().replace(/\\/g, '/'));
      expect(result).not.toContain('~');
    });

    it('should handle already absolute paths', () => {
      const input = path.resolve('/absolute/path');
      const result = PathUtils.normalize(input);
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should throw error for empty string', () => {
      expect(() => PathUtils.normalize('')).toThrow('Path must be a non-empty string');
    });

    it('should throw error for null', () => {
      expect(() => PathUtils.normalize(null)).toThrow('Path must be a non-empty string');
    });

    it('should throw error for undefined', () => {
      expect(() => PathUtils.normalize(undefined)).toThrow('Path must be a non-empty string');
    });
  });

  describe('expandHome', () => {
    it('should expand ~/ to home directory', () => {
      const input = '~/test/path';
      const result = PathUtils.expandHome(input);
      expect(result).toContain(os.homedir());
      expect(result).not.toContain('~');
    });

    it('should expand ~\\ to home directory (Windows)', () => {
      const input = '~\\test\\path';
      const result = PathUtils.expandHome(input);
      expect(result).toContain(os.homedir());
      expect(result).not.toContain('~');
    });

    it('should expand ~ alone to home directory', () => {
      const result = PathUtils.expandHome('~');
      expect(result).toBe(os.homedir());
    });

    it('should not modify paths without ~', () => {
      const input = '/absolute/path';
      const result = PathUtils.expandHome(input);
      expect(result).toBe(input);
    });

    it('should handle null gracefully', () => {
      const result = PathUtils.expandHome(null);
      expect(result).toBeNull();
    });

    it('should handle undefined gracefully', () => {
      const result = PathUtils.expandHome(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('toPlatform', () => {
    it('should convert forward slashes to platform separators', () => {
      const input = 'C:/Users/test/project';
      const result = PathUtils.toPlatform(input);
      expect(result).toContain(path.sep);
    });

    it('should handle already platform-specific paths', () => {
      const input = path.join('test', 'path');
      const result = PathUtils.toPlatform(input);
      expect(result).toBe(input);
    });

    it('should handle null gracefully', () => {
      const result = PathUtils.toPlatform(null);
      expect(result).toBeNull();
    });
  });

  describe('isWithin', () => {
    it('should return true for exact match', () => {
      const parent = '/home/user/project';
      const child = '/home/user/project';
      expect(PathUtils.isWithin(child, parent)).toBe(true);
    });

    it('should return true for child path', () => {
      const parent = '/home/user/project';
      const child = '/home/user/project/subfolder';
      expect(PathUtils.isWithin(child, parent)).toBe(true);
    });

    it('should return false for sibling path', () => {
      const parent = '/home/user/project1';
      const child = '/home/user/project2';
      expect(PathUtils.isWithin(child, parent)).toBe(false);
    });

    it('should return false for parent path', () => {
      const parent = '/home/user/project/subfolder';
      const child = '/home/user/project';
      expect(PathUtils.isWithin(child, parent)).toBe(false);
    });

    it('should handle paths with ~ expansion', () => {
      const parent = '~/project';
      const child = '~/project/subfolder';
      expect(PathUtils.isWithin(child, parent)).toBe(true);
    });
  });

  describe('relative', () => {
    it('should compute relative path', () => {
      const from = '/home/user/project';
      const to = '/home/user/project/subfolder/file.txt';
      const result = PathUtils.relative(from, to);
      expect(result).toBe('subfolder/file.txt');
    });

    it('should use forward slashes in result', () => {
      const from = 'C:\\Users\\test';
      const to = 'C:\\Users\\test\\project\\file.txt';
      const result = PathUtils.relative(from, to);
      expect(result).toMatch(/\//);
      expect(result).not.toMatch(/\\/);
    });
  });

  describe('join', () => {
    it('should join path segments', () => {
      const result = PathUtils.join('home', 'user', 'project');
      expect(result).toBe('home/user/project');
    });

    it('should use forward slashes', () => {
      const result = PathUtils.join('C:', 'Users', 'test');
      expect(result).toMatch(/\//);
      expect(result).not.toMatch(/\\/);
    });
  });

  describe('dirname', () => {
    it('should return directory name', () => {
      const input = '/home/user/project/file.txt';
      const result = PathUtils.dirname(input);
      expect(result).toContain('project');
    });

    it('should use forward slashes', () => {
      // Use platform-appropriate paths
      const input = process.platform === 'win32'
        ? 'C:\\Users\\test\\file.txt'
        : '/home/test/file.txt';
      const result = PathUtils.dirname(input);
      
      // Result should use forward slashes
      expect(result).toMatch(/\//);
      expect(result).not.toMatch(/\\/);
    });
  });

  describe('basename', () => {
    it('should return base name', () => {
      const input = '/home/user/project/file.txt';
      const result = PathUtils.basename(input);
      expect(result).toBe('file.txt');
    });

    it('should remove extension when provided', () => {
      const input = '/home/user/project/file.txt';
      const result = PathUtils.basename(input, '.txt');
      expect(result).toBe('file');
    });
  });

  describe('extname', () => {
    it('should return file extension', () => {
      const input = '/home/user/project/file.txt';
      const result = PathUtils.extname(input);
      expect(result).toBe('.txt');
    });

    it('should return empty string for no extension', () => {
      const input = '/home/user/project/file';
      const result = PathUtils.extname(input);
      expect(result).toBe('');
    });
  });
});
