/**
 * Unit Tests for File Classifier
 */

const { FileClassifier, FileCategory, ResolutionAction } = require('../../../lib/adoption/file-classifier');

describe('FileClassifier', () => {
  let classifier;

  beforeEach(() => {
    classifier = new FileClassifier();
  });

  describe('FileCategory Constants', () => {
    test('should have all required categories', () => {
      expect(FileCategory.TEMPLATE).toBe('template');
      expect(FileCategory.USER_CONTENT).toBe('user-content');
      expect(FileCategory.CONFIG).toBe('config');
      expect(FileCategory.GENERATED).toBe('generated');
    });
  });

  describe('ResolutionAction Constants', () => {
    test('should have all required actions', () => {
      expect(ResolutionAction.PRESERVE).toBe('preserve');
      expect(ResolutionAction.UPDATE).toBe('update');
      expect(ResolutionAction.MERGE).toBe('merge');
      expect(ResolutionAction.SKIP).toBe('skip');
    });
  });

  describe('normalizePath', () => {
    test('should normalize forward slashes', () => {
      expect(classifier.normalizePath('steering/CORE_PRINCIPLES.md'))
        .toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should convert backslashes to forward slashes', () => {
      expect(classifier.normalizePath('steering\\CORE_PRINCIPLES.md'))
        .toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should remove leading .kiro/', () => {
      expect(classifier.normalizePath('.kiro/steering/CORE_PRINCIPLES.md'))
        .toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should remove leading slash', () => {
      expect(classifier.normalizePath('/steering/CORE_PRINCIPLES.md'))
        .toBe('steering/CORE_PRINCIPLES.md');
    });

    test('should handle empty string', () => {
      expect(classifier.normalizePath('')).toBe('');
    });

    test('should handle null', () => {
      expect(classifier.normalizePath(null)).toBe('');
    });

    test('should handle undefined', () => {
      expect(classifier.normalizePath(undefined)).toBe('');
    });

    test('should handle mixed slashes', () => {
      expect(classifier.normalizePath('.kiro\\steering/CORE_PRINCIPLES.md'))
        .toBe('steering/CORE_PRINCIPLES.md');
    });
  });

  describe('classifyFile - Template Files', () => {
    test('should classify CORE_PRINCIPLES.md as template', () => {
      expect(classifier.classifyFile('steering/CORE_PRINCIPLES.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify ENVIRONMENT.md as template', () => {
      expect(classifier.classifyFile('steering/ENVIRONMENT.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify RULES_GUIDE.md as template', () => {
      expect(classifier.classifyFile('steering/RULES_GUIDE.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify ultrawork_enhancer.py as template', () => {
      expect(classifier.classifyFile('tools/ultrawork_enhancer.py'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify README.md as template', () => {
      expect(classifier.classifyFile('README.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify files in steering/ directory as template', () => {
      expect(classifier.classifyFile('steering/new-file.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should classify files in tools/ directory as template', () => {
      expect(classifier.classifyFile('tools/new-tool.py'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should handle template files with .kiro/ prefix', () => {
      expect(classifier.classifyFile('.kiro/steering/CORE_PRINCIPLES.md'))
        .toBe(FileCategory.TEMPLATE);
    });

    test('should handle template files with backslashes', () => {
      expect(classifier.classifyFile('steering\\CORE_PRINCIPLES.md'))
        .toBe(FileCategory.TEMPLATE);
    });
  });

  describe('classifyFile - User Content', () => {
    test('should classify CURRENT_CONTEXT.md as user content (special case)', () => {
      expect(classifier.classifyFile('steering/CURRENT_CONTEXT.md'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should classify files in specs/ as user content', () => {
      expect(classifier.classifyFile('specs/01-00-feature/requirements.md'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should classify spec design files as user content', () => {
      expect(classifier.classifyFile('specs/01-00-feature/design.md'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should classify spec tasks files as user content', () => {
      expect(classifier.classifyFile('specs/01-00-feature/tasks.md'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should classify custom files as user content', () => {
      expect(classifier.classifyFile('custom/my-file.txt'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should classify unknown files as user content (safe default)', () => {
      expect(classifier.classifyFile('unknown-file.txt'))
        .toBe(FileCategory.USER_CONTENT);
    });

    test('should handle CURRENT_CONTEXT.md with .kiro/ prefix', () => {
      expect(classifier.classifyFile('.kiro/steering/CURRENT_CONTEXT.md'))
        .toBe(FileCategory.USER_CONTENT);
    });
  });

  describe('classifyFile - Config Files', () => {
    test('should classify version.json as config', () => {
      expect(classifier.classifyFile('version.json'))
        .toBe(FileCategory.CONFIG);
    });

    test('should classify adoption-config.json as config', () => {
      expect(classifier.classifyFile('adoption-config.json'))
        .toBe(FileCategory.CONFIG);
    });

    test('should handle config files with .kiro/ prefix', () => {
      expect(classifier.classifyFile('.kiro/version.json'))
        .toBe(FileCategory.CONFIG);
    });

    test('should handle config files with path prefix', () => {
      expect(classifier.classifyFile('some/path/version.json'))
        .toBe(FileCategory.CONFIG);
    });
  });

  describe('classifyFile - Generated Files', () => {
    test('should classify files in backups/ as generated', () => {
      expect(classifier.classifyFile('backups/backup-20260127/file.txt'))
        .toBe(FileCategory.GENERATED);
    });

    test('should classify files in logs/ as generated', () => {
      expect(classifier.classifyFile('logs/adoption.log'))
        .toBe(FileCategory.GENERATED);
    });

    test('should classify files in node_modules/ as generated', () => {
      expect(classifier.classifyFile('node_modules/package/index.js'))
        .toBe(FileCategory.GENERATED);
    });

    test('should classify files in .git/ as generated', () => {
      expect(classifier.classifyFile('.git/config'))
        .toBe(FileCategory.GENERATED);
    });
  });

  describe('getResolutionRule - Template Files', () => {
    test('should return UPDATE rule for template files', () => {
      const rule = classifier.getResolutionRule('steering/CORE_PRINCIPLES.md');

      expect(rule.category).toBe(FileCategory.TEMPLATE);
      expect(rule.action).toBe(ResolutionAction.UPDATE);
      expect(rule.requiresBackup).toBe(true);
      expect(rule.reason).toContain('Template file');
    });

    test('should require backup for template files', () => {
      const rule = classifier.getResolutionRule('tools/ultrawork_enhancer.py');

      expect(rule.requiresBackup).toBe(true);
    });
  });

  describe('getResolutionRule - User Content', () => {
    test('should return PRESERVE rule for user content', () => {
      const rule = classifier.getResolutionRule('specs/01-00-feature/requirements.md');

      expect(rule.category).toBe(FileCategory.USER_CONTENT);
      expect(rule.action).toBe(ResolutionAction.PRESERVE);
      expect(rule.requiresBackup).toBe(false);
      expect(rule.reason).toContain('User content');
    });

    test('should return PRESERVE rule for CURRENT_CONTEXT.md', () => {
      const rule = classifier.getResolutionRule('steering/CURRENT_CONTEXT.md');

      expect(rule.category).toBe(FileCategory.USER_CONTENT);
      expect(rule.action).toBe(ResolutionAction.PRESERVE);
      expect(rule.requiresBackup).toBe(false);
      expect(rule.reason).toContain('User-specific');
    });

    test('should not require backup for user content', () => {
      const rule = classifier.getResolutionRule('specs/my-spec/design.md');

      expect(rule.requiresBackup).toBe(false);
    });
  });

  describe('getResolutionRule - Config Files', () => {
    test('should return MERGE rule for config files', () => {
      const rule = classifier.getResolutionRule('version.json');

      expect(rule.category).toBe(FileCategory.CONFIG);
      expect(rule.action).toBe(ResolutionAction.MERGE);
      expect(rule.requiresBackup).toBe(true);
      expect(rule.reason).toContain('Config file');
    });

    test('should require backup for config files', () => {
      const rule = classifier.getResolutionRule('adoption-config.json');

      expect(rule.requiresBackup).toBe(true);
    });
  });

  describe('getResolutionRule - Generated Files', () => {
    test('should return SKIP rule for generated files', () => {
      const rule = classifier.getResolutionRule('backups/backup-20260127/file.txt');

      expect(rule.category).toBe(FileCategory.GENERATED);
      expect(rule.action).toBe(ResolutionAction.SKIP);
      expect(rule.requiresBackup).toBe(false);
      expect(rule.reason).toContain('Generated file');
    });

    test('should not require backup for generated files', () => {
      const rule = classifier.getResolutionRule('logs/adoption.log');

      expect(rule.requiresBackup).toBe(false);
    });
  });

  describe('classifyFiles', () => {
    test('should classify multiple files at once', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'version.json',
        'backups/backup-20260127/file.txt'
      ];

      const result = classifier.classifyFiles(files);

      expect(result['steering/CORE_PRINCIPLES.md']).toBe(FileCategory.TEMPLATE);
      expect(result['specs/01-00-feature/requirements.md']).toBe(FileCategory.USER_CONTENT);
      expect(result['version.json']).toBe(FileCategory.CONFIG);
      expect(result['backups/backup-20260127/file.txt']).toBe(FileCategory.GENERATED);
    });

    test('should handle empty array', () => {
      const result = classifier.classifyFiles([]);

      expect(result).toEqual({});
    });

    test('should handle single file', () => {
      const result = classifier.classifyFiles(['steering/CORE_PRINCIPLES.md']);

      expect(result['steering/CORE_PRINCIPLES.md']).toBe(FileCategory.TEMPLATE);
    });
  });

  describe('getResolutionRules', () => {
    test('should get resolution rules for multiple files', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'version.json'
      ];

      const result = classifier.getResolutionRules(files);

      expect(result['steering/CORE_PRINCIPLES.md'].action).toBe(ResolutionAction.UPDATE);
      expect(result['specs/01-00-feature/requirements.md'].action).toBe(ResolutionAction.PRESERVE);
      expect(result['version.json'].action).toBe(ResolutionAction.MERGE);
    });

    test('should handle empty array', () => {
      const result = classifier.getResolutionRules([]);

      expect(result).toEqual({});
    });
  });

  describe('getFilesByCategory', () => {
    test('should filter files by TEMPLATE category', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'tools/ultrawork_enhancer.py',
        'version.json'
      ];

      const templates = classifier.getFilesByCategory(files, FileCategory.TEMPLATE);

      expect(templates).toHaveLength(2);
      expect(templates).toContain('steering/CORE_PRINCIPLES.md');
      expect(templates).toContain('tools/ultrawork_enhancer.py');
    });

    test('should filter files by USER_CONTENT category', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'steering/CURRENT_CONTEXT.md'
      ];

      const userContent = classifier.getFilesByCategory(files, FileCategory.USER_CONTENT);

      expect(userContent).toHaveLength(2);
      expect(userContent).toContain('specs/01-00-feature/requirements.md');
      expect(userContent).toContain('steering/CURRENT_CONTEXT.md');
    });

    test('should filter files by CONFIG category', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'version.json',
        'adoption-config.json'
      ];

      const configs = classifier.getFilesByCategory(files, FileCategory.CONFIG);

      expect(configs).toHaveLength(2);
      expect(configs).toContain('version.json');
      expect(configs).toContain('adoption-config.json');
    });

    test('should filter files by GENERATED category', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'backups/backup-20260127/file.txt',
        'logs/adoption.log'
      ];

      const generated = classifier.getFilesByCategory(files, FileCategory.GENERATED);

      expect(generated).toHaveLength(2);
      expect(generated).toContain('backups/backup-20260127/file.txt');
      expect(generated).toContain('logs/adoption.log');
    });

    test('should return empty array when no files match', () => {
      const files = ['steering/CORE_PRINCIPLES.md'];

      const configs = classifier.getFilesByCategory(files, FileCategory.CONFIG);

      expect(configs).toHaveLength(0);
    });
  });

  describe('getFilesByAction', () => {
    test('should filter files by UPDATE action', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'tools/ultrawork_enhancer.py'
      ];

      const updateFiles = classifier.getFilesByAction(files, ResolutionAction.UPDATE);

      expect(updateFiles).toHaveLength(2);
      expect(updateFiles).toContain('steering/CORE_PRINCIPLES.md');
      expect(updateFiles).toContain('tools/ultrawork_enhancer.py');
    });

    test('should filter files by PRESERVE action', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'specs/01-00-feature/requirements.md',
        'steering/CURRENT_CONTEXT.md'
      ];

      const preserveFiles = classifier.getFilesByAction(files, ResolutionAction.PRESERVE);

      expect(preserveFiles).toHaveLength(2);
      expect(preserveFiles).toContain('specs/01-00-feature/requirements.md');
      expect(preserveFiles).toContain('steering/CURRENT_CONTEXT.md');
    });

    test('should filter files by MERGE action', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'version.json',
        'adoption-config.json'
      ];

      const mergeFiles = classifier.getFilesByAction(files, ResolutionAction.MERGE);

      expect(mergeFiles).toHaveLength(2);
      expect(mergeFiles).toContain('version.json');
      expect(mergeFiles).toContain('adoption-config.json');
    });

    test('should filter files by SKIP action', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'backups/backup-20260127/file.txt',
        'logs/adoption.log'
      ];

      const skipFiles = classifier.getFilesByAction(files, ResolutionAction.SKIP);

      expect(skipFiles).toHaveLength(2);
      expect(skipFiles).toContain('backups/backup-20260127/file.txt');
      expect(skipFiles).toContain('logs/adoption.log');
    });
  });

  describe('requiresBackup', () => {
    test('should return true for template files', () => {
      expect(classifier.requiresBackup('steering/CORE_PRINCIPLES.md')).toBe(true);
    });

    test('should return false for user content', () => {
      expect(classifier.requiresBackup('specs/01-00-feature/requirements.md')).toBe(false);
    });

    test('should return true for config files', () => {
      expect(classifier.requiresBackup('version.json')).toBe(true);
    });

    test('should return false for generated files', () => {
      expect(classifier.requiresBackup('backups/backup-20260127/file.txt')).toBe(false);
    });

    test('should return false for CURRENT_CONTEXT.md', () => {
      expect(classifier.requiresBackup('steering/CURRENT_CONTEXT.md')).toBe(false);
    });
  });

  describe('getFilesRequiringBackup', () => {
    test('should get all files requiring backup', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',        // template - backup
        'specs/01-00-feature/requirements.md', // user content - no backup
        'version.json',                        // config - backup
        'backups/backup-20260127/file.txt',   // generated - no backup
        'tools/ultrawork_enhancer.py'         // template - backup
      ];

      const backupFiles = classifier.getFilesRequiringBackup(files);

      expect(backupFiles).toHaveLength(3);
      expect(backupFiles).toContain('steering/CORE_PRINCIPLES.md');
      expect(backupFiles).toContain('version.json');
      expect(backupFiles).toContain('tools/ultrawork_enhancer.py');
    });

    test('should return empty array when no files require backup', () => {
      const files = [
        'specs/01-00-feature/requirements.md',
        'backups/backup-20260127/file.txt'
      ];

      const backupFiles = classifier.getFilesRequiringBackup(files);

      expect(backupFiles).toHaveLength(0);
    });

    test('should handle empty array', () => {
      const backupFiles = classifier.getFilesRequiringBackup([]);

      expect(backupFiles).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle files with special characters', () => {
      const category = classifier.classifyFile('specs/01-00-feature with spaces/requirements.md');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle very long file paths', () => {
      const longPath = 'specs/' + 'a'.repeat(200) + '/requirements.md';
      const category = classifier.classifyFile(longPath);

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle files with multiple dots', () => {
      const category = classifier.classifyFile('specs/01-00-feature/file.test.backup.md');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle files with no extension', () => {
      const category = classifier.classifyFile('specs/01-00-feature/README');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle deeply nested paths', () => {
      const category = classifier.classifyFile('specs/a/b/c/d/e/f/file.md');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle paths with trailing slashes', () => {
      const category = classifier.classifyFile('specs/01-00-feature/');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle relative paths with ../', () => {
      const category = classifier.classifyFile('../specs/01-00-feature/requirements.md');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });

    test('should handle absolute paths', () => {
      const category = classifier.classifyFile('/home/user/.kiro/specs/01-00-feature/requirements.md');

      expect(category).toBe(FileCategory.USER_CONTENT);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete adoption scenario', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'steering/ENVIRONMENT.md',
        'steering/RULES_GUIDE.md',
        'steering/CURRENT_CONTEXT.md',
        'tools/ultrawork_enhancer.py',
        'README.md',
        'specs/01-00-feature/requirements.md',
        'specs/01-00-feature/design.md',
        'specs/01-00-feature/tasks.md',
        'version.json',
        'adoption-config.json',
        'backups/backup-20260127/file.txt',
        'logs/adoption.log'
      ];

      const rules = classifier.getResolutionRules(files);

      // Template files should be updated
      expect(rules['steering/CORE_PRINCIPLES.md'].action).toBe(ResolutionAction.UPDATE);
      expect(rules['steering/ENVIRONMENT.md'].action).toBe(ResolutionAction.UPDATE);
      expect(rules['tools/ultrawork_enhancer.py'].action).toBe(ResolutionAction.UPDATE);

      // User content should be preserved
      expect(rules['steering/CURRENT_CONTEXT.md'].action).toBe(ResolutionAction.PRESERVE);
      expect(rules['specs/01-00-feature/requirements.md'].action).toBe(ResolutionAction.PRESERVE);

      // Config files should be merged
      expect(rules['version.json'].action).toBe(ResolutionAction.MERGE);
      expect(rules['adoption-config.json'].action).toBe(ResolutionAction.MERGE);

      // Generated files should be skipped
      expect(rules['backups/backup-20260127/file.txt'].action).toBe(ResolutionAction.SKIP);
      expect(rules['logs/adoption.log'].action).toBe(ResolutionAction.SKIP);
    });

    test('should correctly identify files requiring backup', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'steering/CURRENT_CONTEXT.md',
        'specs/01-00-feature/requirements.md',
        'version.json',
        'backups/backup-20260127/file.txt'
      ];

      const backupFiles = classifier.getFilesRequiringBackup(files);

      expect(backupFiles).toHaveLength(2);
      expect(backupFiles).toContain('steering/CORE_PRINCIPLES.md');
      expect(backupFiles).toContain('version.json');
      expect(backupFiles).not.toContain('steering/CURRENT_CONTEXT.md');
      expect(backupFiles).not.toContain('specs/01-00-feature/requirements.md');
      expect(backupFiles).not.toContain('backups/backup-20260127/file.txt');
    });

    test('should group files by category correctly', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'steering/CURRENT_CONTEXT.md',
        'specs/01-00-feature/requirements.md',
        'version.json',
        'backups/backup-20260127/file.txt'
      ];

      const templates = classifier.getFilesByCategory(files, FileCategory.TEMPLATE);
      const userContent = classifier.getFilesByCategory(files, FileCategory.USER_CONTENT);
      const configs = classifier.getFilesByCategory(files, FileCategory.CONFIG);
      const generated = classifier.getFilesByCategory(files, FileCategory.GENERATED);

      expect(templates).toHaveLength(1);
      expect(userContent).toHaveLength(2);
      expect(configs).toHaveLength(1);
      expect(generated).toHaveLength(1);
    });

    test('should group files by action correctly', () => {
      const files = [
        'steering/CORE_PRINCIPLES.md',
        'steering/CURRENT_CONTEXT.md',
        'specs/01-00-feature/requirements.md',
        'version.json',
        'backups/backup-20260127/file.txt'
      ];

      const updateFiles = classifier.getFilesByAction(files, ResolutionAction.UPDATE);
      const preserveFiles = classifier.getFilesByAction(files, ResolutionAction.PRESERVE);
      const mergeFiles = classifier.getFilesByAction(files, ResolutionAction.MERGE);
      const skipFiles = classifier.getFilesByAction(files, ResolutionAction.SKIP);

      expect(updateFiles).toHaveLength(1);
      expect(preserveFiles).toHaveLength(2);
      expect(mergeFiles).toHaveLength(1);
      expect(skipFiles).toHaveLength(1);
    });
  });

  describe('Special Cases', () => {
    test('should always preserve CURRENT_CONTEXT.md regardless of location', () => {
      const paths = [
        'steering/CURRENT_CONTEXT.md',
        '.kiro/steering/CURRENT_CONTEXT.md',
        'steering\\CURRENT_CONTEXT.md'
      ];

      paths.forEach(path => {
        const rule = classifier.getResolutionRule(path);
        expect(rule.action).toBe(ResolutionAction.PRESERVE);
        expect(rule.requiresBackup).toBe(false);
      });
    });

    test('should treat unknown files as user content for safety', () => {
      const unknownFiles = [
        'random-file.txt',
        'my-custom-script.sh',
        'data.csv'
      ];

      unknownFiles.forEach(file => {
        const category = classifier.classifyFile(file);
        expect(category).toBe(FileCategory.USER_CONTENT);

        const rule = classifier.getResolutionRule(file);
        expect(rule.action).toBe(ResolutionAction.PRESERVE);
      });
    });

    test('should handle case-sensitive file names', () => {
      // File names are case-sensitive
      expect(classifier.classifyFile('steering/CORE_PRINCIPLES.md'))
        .toBe(FileCategory.TEMPLATE);
      
      expect(classifier.classifyFile('steering/core_principles.md'))
        .toBe(FileCategory.TEMPLATE); // Still in steering/ directory
    });

    test('should handle files with similar names', () => {
      expect(classifier.classifyFile('version.json'))
        .toBe(FileCategory.CONFIG);
      
      expect(classifier.classifyFile('version-backup.json'))
        .toBe(FileCategory.USER_CONTENT); // Not exact match
    });
  });

  describe('Performance', () => {
    test('should handle large number of files efficiently', () => {
      const files = [];
      for (let i = 0; i < 1000; i++) {
        files.push(`specs/spec-${i}/requirements.md`);
      }

      const startTime = Date.now();
      const result = classifier.classifyFiles(files);
      const endTime = Date.now();

      expect(Object.keys(result)).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should handle repeated classifications efficiently', () => {
      const file = 'steering/CORE_PRINCIPLES.md';

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        classifier.classifyFile(file);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});
