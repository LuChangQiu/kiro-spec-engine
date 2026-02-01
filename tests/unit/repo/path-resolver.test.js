const PathResolver = require('../../../lib/repo/path-resolver');
const path = require('path');

describe('PathResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new PathResolver();
  });

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      const result = resolver.normalizePath('C:\\Users\\test\\repo');
      expect(result).toBe('C:/Users/test/repo');
    });

    it('should handle paths with mixed separators', () => {
      const result = resolver.normalizePath('C:\\Users/test\\repo');
      expect(result).toBe('C:/Users/test/repo');
    });

    it('should uppercase Windows drive letters', () => {
      const result = resolver.normalizePath('c:/users/test');
      expect(result).toBe('C:/users/test');
    });

    it('should handle Unix paths without modification', () => {
      const result = resolver.normalizePath('/home/user/repo');
      expect(result).toBe('/home/user/repo');
    });

    it('should resolve . and .. in paths', () => {
      const result = resolver.normalizePath('/home/user/./repo/../project');
      expect(result).toBe('/home/user/project');
    });

    it('should handle empty string', () => {
      const result = resolver.normalizePath('');
      expect(result).toBe('');
    });

    it('should handle null', () => {
      const result = resolver.normalizePath(null);
      expect(result).toBeNull();
    });
  });

  describe('isAbsolute', () => {
    it('should return true for Windows absolute paths', () => {
      expect(resolver.isAbsolute('C:/Users/test')).toBe(true);
      expect(resolver.isAbsolute('D:\\Projects')).toBe(true);
    });

    it('should return true for Unix absolute paths', () => {
      expect(resolver.isAbsolute('/home/user')).toBe(true);
      expect(resolver.isAbsolute('/var/www')).toBe(true);
    });

    it('should return false for relative paths', () => {
      expect(resolver.isAbsolute('repo/subdir')).toBe(false);
      expect(resolver.isAbsolute('./repo')).toBe(false);
      expect(resolver.isAbsolute('../repo')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(resolver.isAbsolute('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(resolver.isAbsolute(null)).toBe(false);
    });
  });

  describe('resolvePath', () => {
    const projectRoot = process.platform === 'win32' ? 'C:/projects/main' : '/home/user/projects/main';

    it('should resolve relative paths against project root', () => {
      const result = resolver.resolvePath('repo1', projectRoot);
      const expected = resolver.normalizePath(path.join(projectRoot, 'repo1'));
      expect(result).toBe(expected);
    });

    it('should handle nested relative paths', () => {
      const result = resolver.resolvePath('subdir/repo1', projectRoot);
      const expected = resolver.normalizePath(path.join(projectRoot, 'subdir/repo1'));
      expect(result).toBe(expected);
    });

    it('should handle .. in relative paths', () => {
      const result = resolver.resolvePath('../other-project', projectRoot);
      const expected = resolver.normalizePath(path.resolve(projectRoot, '../other-project'));
      expect(result).toBe(expected);
    });

    it('should return normalized absolute paths unchanged', () => {
      const absolutePath = process.platform === 'win32' ? 'D:/external/repo' : '/external/repo';
      const result = resolver.resolvePath(absolutePath, projectRoot);
      expect(result).toBe(resolver.normalizePath(absolutePath));
    });

    it('should throw error for empty repository path', () => {
      expect(() => resolver.resolvePath('', projectRoot)).toThrow('Repository path cannot be empty');
    });

    it('should throw error for empty project root', () => {
      expect(() => resolver.resolvePath('repo1', '')).toThrow('Project root cannot be empty');
    });
  });

  describe('toRelative', () => {
    it('should convert absolute path to relative', () => {
      const basePath = process.platform === 'win32' ? 'C:/projects/main' : '/home/user/projects/main';
      const absolutePath = process.platform === 'win32' ? 'C:/projects/main/repo1' : '/home/user/projects/main/repo1';
      const result = resolver.toRelative(absolutePath, basePath);
      expect(result).toBe('repo1');
    });

    it('should handle paths with common parent', () => {
      const basePath = process.platform === 'win32' ? 'C:/projects/main' : '/home/user/projects/main';
      const absolutePath = process.platform === 'win32' ? 'C:/projects/other' : '/home/user/projects/other';
      const result = resolver.toRelative(absolutePath, basePath);
      expect(result).toBe('../other');
    });

    it('should throw error for missing absolutePath', () => {
      expect(() => resolver.toRelative('', '/base')).toThrow('Both absolutePath and basePath are required');
    });

    it('should throw error for missing basePath', () => {
      expect(() => resolver.toRelative('/absolute', '')).toThrow('Both absolutePath and basePath are required');
    });
  });

  describe('validateNoOverlap', () => {
    it('should return valid for non-overlapping paths', () => {
      const paths = [
        '/home/user/repo1',
        '/home/user/repo2',
        '/home/user/repo3'
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate paths', () => {
      const paths = [
        '/home/user/repo1',
        '/home/user/repo2',
        '/home/user/repo1'
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate path found: /home/user/repo1');
    });

    it('should detect nested paths', () => {
      const paths = [
        '/home/user/projects',
        '/home/user/projects/repo1'
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nested within');
    });

    it('should detect nested paths regardless of order', () => {
      const paths = [
        '/home/user/projects/repo1',
        '/home/user/projects'
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nested within');
    });

    it('should handle paths with different separators', () => {
      const paths = [
        'C:/Users/test/repo1',
        'C:\\Users\\test\\repo2'
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(true);
    });

    it('should return valid for empty array', () => {
      const result = resolver.validateNoOverlap([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for non-array input', () => {
      const result = resolver.validateNoOverlap('not-an-array');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Paths must be an array');
    });

    it('should detect multiple errors at once', () => {
      const paths = [
        '/home/user/repo1',
        '/home/user/repo1',  // duplicate
        '/home/user/repo1/nested'  // nested
      ];
      const result = resolver.validateNoOverlap(paths);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Windows-specific path handling', () => {
    it('should handle Windows drive letters correctly', () => {
      const result = resolver.normalizePath('c:\\Users\\test\\repo');
      expect(result).toBe('C:/Users/test/repo');
    });

    it('should handle UNC paths', () => {
      const result = resolver.normalizePath('\\\\server\\share\\folder');
      expect(result).toContain('//server/share/folder');
    });

    it('should detect Windows absolute paths', () => {
      expect(resolver.isAbsolute('C:/Users')).toBe(true);
      expect(resolver.isAbsolute('D:\\Projects')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with trailing slashes', () => {
      const result = resolver.normalizePath('/home/user/repo/');
      expect(result).toBe('/home/user/repo');
    });

    it('should handle paths with multiple consecutive slashes', () => {
      const result = resolver.normalizePath('/home//user///repo');
      expect(result).toBe('/home/user/repo');
    });

    it('should handle single dot path', () => {
      const projectRoot = process.platform === 'win32' ? 'C:/projects/main' : '/home/user/project';
      const result = resolver.resolvePath('.', projectRoot);
      expect(result).toBe(resolver.normalizePath(projectRoot));
    });

    it('should handle double dot path', () => {
      const projectRoot = process.platform === 'win32' ? 'C:/projects/main' : '/home/user/project';
      const parentPath = process.platform === 'win32' ? 'C:/projects' : '/home/user';
      const result = resolver.resolvePath('..', projectRoot);
      expect(result).toBe(resolver.normalizePath(parentPath));
    });
  });
});
