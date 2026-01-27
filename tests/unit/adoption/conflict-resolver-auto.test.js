/**
 * Unit Tests for Automatic Conflict Resolver
 * 
 * Tests the automatic conflict resolution functionality
 * that uses FileClassifier for smart resolution.
 */

const ConflictResolver = require('../../../lib/adoption/conflict-resolver');
const { FileCategory, ResolutionAction } = require('../../../lib/adoption/file-classifier');

describe('ConflictResolver - Automatic Resolution', () => {
  let resolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  describe('Constructor', () => {
    test('should initialize with FileClassifier', () => {
      expect(resolver.fileClassifier).toBeDefined();
      expect(resolver.diffViewer).toBeDefined();
    });
  });

  describe('resolveConflictAutomatic', () => {
    test('should resolve empty conflicts array', () => {
      const conflicts = [];
      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap).toEqual({});
      expect(result.summary.total).toBe(0);
      expect(result.summary.update).toBe(0);
      expect(result.summary.preserve).toBe(0);
      expect(result.summary.merge).toBe(0);
      expect(result.summary.skip).toBe(0);
    });

    test('should resolve single template file conflict', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['steering/CORE_PRINCIPLES.md']).toBe('overwrite');
      expect(result.summary.total).toBe(1);
      expect(result.summary.update).toBe(1);
      expect(result.summary.preserve).toBe(0);
    });

    test('should resolve single user content conflict', () => {
      const conflicts = [
        { path: 'specs/01-00-feature/requirements.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['specs/01-00-feature/requirements.md']).toBe('keep');
      expect(result.summary.total).toBe(1);
      expect(result.summary.preserve).toBe(1);
      expect(result.summary.update).toBe(0);
    });

    test('should resolve single config file conflict', () => {
      const conflicts = [
        { path: 'version.json' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['version.json']).toBe('merge');
      expect(result.summary.total).toBe(1);
      expect(result.summary.merge).toBe(1);
      expect(result.summary.update).toBe(0);
    });

    test('should resolve single generated file conflict', () => {
      const conflicts = [
        { path: 'backups/backup-20260127/file.txt' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['backups/backup-20260127/file.txt']).toBe('skip');
      expect(result.summary.total).toBe(1);
      expect(result.summary.skip).toBe(1);
      expect(result.summary.update).toBe(0);
    });

    test('should resolve multiple conflicts of different types', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },
        { path: 'steering/ENVIRONMENT.md' },
        { path: 'specs/01-00-feature/requirements.md' },
        { path: 'version.json' },
        { path: 'backups/backup-20260127/file.txt' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['steering/CORE_PRINCIPLES.md']).toBe('overwrite');
      expect(result.resolutionMap['steering/ENVIRONMENT.md']).toBe('overwrite');
      expect(result.resolutionMap['specs/01-00-feature/requirements.md']).toBe('keep');
      expect(result.resolutionMap['version.json']).toBe('merge');
      expect(result.resolutionMap['backups/backup-20260127/file.txt']).toBe('skip');

      expect(result.summary.total).toBe(5);
      expect(result.summary.update).toBe(2);
      expect(result.summary.preserve).toBe(1);
      expect(result.summary.merge).toBe(1);
      expect(result.summary.skip).toBe(1);
    });

    test('should handle CURRENT_CONTEXT.md as user content', () => {
      const conflicts = [
        { path: 'steering/CURRENT_CONTEXT.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['steering/CURRENT_CONTEXT.md']).toBe('keep');
      expect(result.summary.preserve).toBe(1);
    });

    test('should categorize files correctly in summary', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },
        { path: 'specs/01-00-feature/requirements.md' },
        { path: 'version.json' },
        { path: 'backups/backup-20260127/file.txt' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.summary.byCategory[FileCategory.TEMPLATE]).toHaveLength(1);
      expect(result.summary.byCategory[FileCategory.USER_CONTENT]).toHaveLength(1);
      expect(result.summary.byCategory[FileCategory.CONFIG]).toHaveLength(1);
      expect(result.summary.byCategory[FileCategory.GENERATED]).toHaveLength(1);
    });

    test('should include resolution details in category summary', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      const templateFiles = result.summary.byCategory[FileCategory.TEMPLATE];
      expect(templateFiles[0]).toMatchObject({
        path: 'steering/CORE_PRINCIPLES.md',
        action: ResolutionAction.UPDATE,
        resolution: 'overwrite',
        reason: expect.any(String)
      });
    });

    test('should handle paths with .kiro/ prefix', () => {
      const conflicts = [
        { path: '.kiro/steering/CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['.kiro/steering/CORE_PRINCIPLES.md']).toBe('overwrite');
      expect(result.summary.update).toBe(1);
    });

    test('should handle paths with backslashes', () => {
      const conflicts = [
        { path: 'steering\\CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['steering\\CORE_PRINCIPLES.md']).toBe('overwrite');
      expect(result.summary.update).toBe(1);
    });

    test('should handle unknown file types safely', () => {
      const conflicts = [
        { path: 'unknown/custom-file.txt' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      // Unknown files should be preserved for safety
      expect(result.resolutionMap['unknown/custom-file.txt']).toBe('keep');
      expect(result.summary.preserve).toBe(1);
    });
  });

  describe('Resolution Rules Application', () => {
    test('should apply UPDATE rule to all template files', () => {
      const templateFiles = [
        'steering/CORE_PRINCIPLES.md',
        'steering/ENVIRONMENT.md',
        'steering/RULES_GUIDE.md',
        'tools/ultrawork_enhancer.py',
        'README.md'
      ];

      const conflicts = templateFiles.map(path => ({ path }));
      const result = resolver.resolveConflictAutomatic(conflicts);

      templateFiles.forEach(path => {
        expect(result.resolutionMap[path]).toBe('overwrite');
      });

      expect(result.summary.update).toBe(templateFiles.length);
    });

    test('should apply PRESERVE rule to all user content', () => {
      const userFiles = [
        'specs/01-00-feature/requirements.md',
        'specs/01-00-feature/design.md',
        'specs/01-00-feature/tasks.md',
        'steering/CURRENT_CONTEXT.md'
      ];

      const conflicts = userFiles.map(path => ({ path }));
      const result = resolver.resolveConflictAutomatic(conflicts);

      userFiles.forEach(path => {
        expect(result.resolutionMap[path]).toBe('keep');
      });

      expect(result.summary.preserve).toBe(userFiles.length);
    });

    test('should apply MERGE rule to all config files', () => {
      const configFiles = [
        'version.json',
        'adoption-config.json'
      ];

      const conflicts = configFiles.map(path => ({ path }));
      const result = resolver.resolveConflictAutomatic(conflicts);

      configFiles.forEach(path => {
        expect(result.resolutionMap[path]).toBe('merge');
      });

      expect(result.summary.merge).toBe(configFiles.length);
    });

    test('should apply SKIP rule to all generated files', () => {
      const generatedFiles = [
        'backups/backup-20260127/file.txt',
        'logs/adoption.log',
        'node_modules/package/index.js'
      ];

      const conflicts = generatedFiles.map(path => ({ path }));
      const result = resolver.resolveConflictAutomatic(conflicts);

      generatedFiles.forEach(path => {
        expect(result.resolutionMap[path]).toBe('skip');
      });

      expect(result.summary.skip).toBe(generatedFiles.length);
    });
  });

  describe('Edge Cases', () => {
    test('should handle conflicts with additional properties', () => {
      const conflicts = [
        {
          path: 'steering/CORE_PRINCIPLES.md',
          templatePath: '/path/to/template',
          existingPath: '/path/to/existing',
          metadata: { size: 1024 }
        }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['steering/CORE_PRINCIPLES.md']).toBe('overwrite');
      expect(result.summary.total).toBe(1);
    });

    test('should handle large number of conflicts', () => {
      const conflicts = [];
      for (let i = 0; i < 100; i++) {
        conflicts.push({ path: `steering/file-${i}.md` });
      }

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.summary.total).toBe(100);
      expect(result.summary.update).toBe(100);
      expect(Object.keys(result.resolutionMap)).toHaveLength(100);
    });

    test('should handle conflicts with special characters in path', () => {
      const conflicts = [
        { path: 'specs/01-00-feature (copy)/requirements.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['specs/01-00-feature (copy)/requirements.md']).toBe('keep');
    });

    test('should handle conflicts with spaces in path', () => {
      const conflicts = [
        { path: 'specs/my feature/requirements.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['specs/my feature/requirements.md']).toBe('keep');
    });

    test('should handle deeply nested paths', () => {
      const conflicts = [
        { path: 'specs/01-00-feature/sub/deep/nested/file.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.resolutionMap['specs/01-00-feature/sub/deep/nested/file.md']).toBe('keep');
    });
  });

  describe('Summary Structure', () => {
    test('should return complete summary structure', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('update');
      expect(result.summary).toHaveProperty('preserve');
      expect(result.summary).toHaveProperty('merge');
      expect(result.summary).toHaveProperty('skip');
      expect(result.summary).toHaveProperty('byCategory');
      expect(result.summary.byCategory).toHaveProperty(FileCategory.TEMPLATE);
      expect(result.summary.byCategory).toHaveProperty(FileCategory.USER_CONTENT);
      expect(result.summary.byCategory).toHaveProperty(FileCategory.CONFIG);
      expect(result.summary.byCategory).toHaveProperty(FileCategory.GENERATED);
    });

    test('should initialize all category arrays', () => {
      const conflicts = [];
      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(Array.isArray(result.summary.byCategory[FileCategory.TEMPLATE])).toBe(true);
      expect(Array.isArray(result.summary.byCategory[FileCategory.USER_CONTENT])).toBe(true);
      expect(Array.isArray(result.summary.byCategory[FileCategory.CONFIG])).toBe(true);
      expect(Array.isArray(result.summary.byCategory[FileCategory.GENERATED])).toBe(true);
    });

    test('should track counts correctly for mixed conflicts', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },      // update
        { path: 'steering/ENVIRONMENT.md' },          // update
        { path: 'specs/01-00-feature/requirements.md' }, // preserve
        { path: 'specs/02-00-feature/design.md' },    // preserve
        { path: 'version.json' },                     // merge
        { path: 'backups/backup-20260127/file.txt' }  // skip
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      expect(result.summary.total).toBe(6);
      expect(result.summary.update).toBe(2);
      expect(result.summary.preserve).toBe(2);
      expect(result.summary.merge).toBe(1);
      expect(result.summary.skip).toBe(1);
    });
  });

  describe('Integration with FileClassifier', () => {
    test('should use FileClassifier for classification', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' }
      ];

      const classifySpy = jest.spyOn(resolver.fileClassifier, 'getResolutionRule');
      resolver.resolveConflictAutomatic(conflicts);

      expect(classifySpy).toHaveBeenCalledWith('steering/CORE_PRINCIPLES.md');
      classifySpy.mockRestore();
    });

    test('should respect FileClassifier special cases', () => {
      const conflicts = [
        { path: 'steering/CURRENT_CONTEXT.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      // CURRENT_CONTEXT.md should be preserved (special case)
      expect(result.resolutionMap['steering/CURRENT_CONTEXT.md']).toBe('keep');
      expect(result.summary.preserve).toBe(1);
    });

    test('should use FileClassifier resolution reasons', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);

      const templateFiles = result.summary.byCategory[FileCategory.TEMPLATE];
      expect(templateFiles[0].reason).toBeTruthy();
      expect(typeof templateFiles[0].reason).toBe('string');
    });
  });

  describe('Performance', () => {
    test('should handle 1000 conflicts efficiently', () => {
      const conflicts = [];
      for (let i = 0; i < 1000; i++) {
        conflicts.push({ path: `steering/file-${i}.md` });
      }

      const startTime = Date.now();
      const result = resolver.resolveConflictAutomatic(conflicts);
      const endTime = Date.now();

      expect(result.summary.total).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });

  describe('displayAutomaticResolutionSummary', () => {
    // Mock console.log to test display output
    let consoleLogSpy;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    test('should display summary without errors', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },
        { path: 'specs/01-00-feature/requirements.md' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);
      
      expect(() => {
        resolver.displayAutomaticResolutionSummary(result.summary);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('should display all action types', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },      // update
        { path: 'specs/01-00-feature/requirements.md' }, // preserve
        { path: 'version.json' },                     // merge
        { path: 'backups/backup-20260127/file.txt' }  // skip
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);
      resolver.displayAutomaticResolutionSummary(result.summary);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      expect(output).toContain('Update');
      expect(output).toContain('Preserve');
      expect(output).toContain('Merge');
      expect(output).toContain('Skip');
    });

    test('should display category sections', () => {
      const conflicts = [
        { path: 'steering/CORE_PRINCIPLES.md' },
        { path: 'specs/01-00-feature/requirements.md' },
        { path: 'version.json' },
        { path: 'backups/backup-20260127/file.txt' }
      ];

      const result = resolver.resolveConflictAutomatic(conflicts);
      resolver.displayAutomaticResolutionSummary(result.summary);

      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      expect(output).toContain('Template Files');
      expect(output).toContain('User Content');
      expect(output).toContain('Config Files');
      expect(output).toContain('Generated Files');
    });

    test('should handle empty summary', () => {
      const summary = {
        total: 0,
        update: 0,
        preserve: 0,
        merge: 0,
        skip: 0,
        byCategory: {
          [FileCategory.TEMPLATE]: [],
          [FileCategory.USER_CONTENT]: [],
          [FileCategory.CONFIG]: [],
          [FileCategory.GENERATED]: []
        }
      };

      expect(() => {
        resolver.displayAutomaticResolutionSummary(summary);
      }).not.toThrow();
    });
  });
});
