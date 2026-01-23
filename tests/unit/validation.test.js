/**
 * Tests for Validation System
 */

const {
  validateProjectStructure,
  validateVersionFile,
  validateDependencies,
  validateProject
} = require('../../lib/utils/validation');

describe('Validation System', () => {
  describe('validateVersionFile', () => {
    test('should detect missing version.json', async () => {
      const result = await validateVersionFile('/nonexistent/path');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('version.json not found');
    });
  });

  describe('validateDependencies', () => {
    test('should check Node.js version', async () => {
      const result = await validateDependencies(process.cwd());
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      
      // Node.js version should be 16+ (current environment)
      const nodeVersion = process.version;
      const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (nodeMajor >= 16) {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('validateProject', () => {
    test('should combine all validation results', async () => {
      const result = await validateProject('/nonexistent/path');
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
