/**
 * Unit tests for GitignoreDetector
 */

const fs = require('fs-extra');
const path = require('path');
const GitignoreDetector = require('../../../lib/gitignore/gitignore-detector');

describe('GitignoreDetector', () => {
  let detector;
  let testDir;

  beforeEach(async () => {
    detector = new GitignoreDetector();
    testDir = path.join(__dirname, '../../temp/gitignore-detector-test');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('exists()', () => {
    test('should return false when .gitignore does not exist', async () => {
      const exists = await detector.exists(testDir);
      expect(exists).toBe(false);
    });

    test('should return true when .gitignore exists', async () => {
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/', 'utf8');
      
      const exists = await detector.exists(testDir);
      expect(exists).toBe(true);
    });
  });

  describe('parseGitignore()', () => {
    test('should parse empty content', () => {
      const rules = detector.parseGitignore('');
      expect(rules).toEqual([]);
    });

    test('should parse exclusion rules', () => {
      const content = 'node_modules/\n.env\n*.log';
      const rules = detector.parseGitignore(content);
      
      expect(rules).toHaveLength(3);
      expect(rules[0]).toMatchObject({
        pattern: 'node_modules/',
        type: 'exclusion',
        line: 1
      });
    });

    test('should parse comments', () => {
      const content = '# This is a comment\nnode_modules/';
      const rules = detector.parseGitignore(content);
      
      expect(rules).toHaveLength(2);
      expect(rules[0]).toMatchObject({
        pattern: '# This is a comment',
        type: 'comment',
        line: 1
      });
    });

    test('should parse negation rules', () => {
      const content = '*.log\n!important.log';
      const rules = detector.parseGitignore(content);
      
      expect(rules).toHaveLength(2);
      expect(rules[1]).toMatchObject({
        pattern: '!important.log',
        type: 'negation',
        line: 2
      });
    });

    test('should identify .sce-related rules', () => {
      const content = '.sce/\nnode_modules/';
      const rules = detector.parseGitignore(content);
      
      expect(rules[0].isKiroRelated).toBe(true);
      expect(rules[1].isKiroRelated).toBe(false);
    });

    test('should handle different line endings', () => {
      const contentCRLF = 'node_modules/\r\n.env';
      const contentLF = 'node_modules/\n.env';
      
      const rulesCRLF = detector.parseGitignore(contentCRLF);
      const rulesLF = detector.parseGitignore(contentLF);
      
      expect(rulesCRLF).toHaveLength(2);
      expect(rulesLF).toHaveLength(2);
    });
  });

  describe('findOldPatterns()', () => {
    test('should detect .sce/ pattern', () => {
      const rules = detector.parseGitignore('.sce/');
      const oldPatterns = detector.findOldPatterns(rules);
      
      expect(oldPatterns).toContain('.sce/');
    });

    test('should detect .sce/* pattern', () => {
      const rules = detector.parseGitignore('.sce/*');
      const oldPatterns = detector.findOldPatterns(rules);
      
      expect(oldPatterns).toContain('.sce/*');
    });

    test('should detect .sce/** pattern', () => {
      const rules = detector.parseGitignore('.sce/**');
      const oldPatterns = detector.findOldPatterns(rules);
      
      expect(oldPatterns).toContain('.sce/**');
    });

    test('should not detect layered rules as old patterns', () => {
      const content = '.sce/backups/\n.sce/logs/';
      const rules = detector.parseGitignore(content);
      const oldPatterns = detector.findOldPatterns(rules);
      
      expect(oldPatterns).toHaveLength(0);
    });
  });

  describe('findMissingRules()', () => {
    test('should find all missing rules in empty .gitignore', () => {
      const rules = detector.parseGitignore('');
      const missing = detector.findMissingRules(rules);
      
      expect(missing.length).toBeGreaterThan(0);
      expect(missing).toContain('.sce/steering/CURRENT_CONTEXT.md');
    });

    test('should find no missing rules when all present', () => {
      const content = `
.sce/steering/CURRENT_CONTEXT.md
.sce/contexts/.active
.sce/environments.json
.sce/backups/
.sce/logs/
.sce/reports/
      `.trim();
      
      const rules = detector.parseGitignore(content);
      const missing = detector.findMissingRules(rules);
      
      expect(missing).toHaveLength(0);
    });
  });

  describe('analyzeGitignore()', () => {
    test('should return missing status when .gitignore does not exist', async () => {
      const status = await detector.analyzeGitignore(testDir);
      
      expect(status.exists).toBe(false);
      expect(status.status).toBe('missing');
      expect(status.strategy).toBe('add');
    });

    test('should return old-pattern status when blanket exclusion found', async () => {
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.sce/', 'utf8');
      
      const status = await detector.analyzeGitignore(testDir);
      
      expect(status.exists).toBe(true);
      expect(status.status).toBe('old-pattern');
      expect(status.strategy).toBe('update');
      expect(status.oldPatterns).toContain('.sce/');
    });

    test('should return incomplete status when some rules missing', async () => {
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.sce/backups/', 'utf8');
      
      const status = await detector.analyzeGitignore(testDir);
      
      expect(status.exists).toBe(true);
      expect(status.status).toBe('incomplete');
      expect(status.strategy).toBe('update');
      expect(status.missingRules.length).toBeGreaterThan(0);
    });

    test('should return compliant status when all rules present', async () => {
      const content = `
.sce/steering/CURRENT_CONTEXT.md
.sce/contexts/.active
.sce/environments.json
.sce/backups/
.sce/logs/
.sce/reports/
      `.trim();
      
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, content, 'utf8');
      
      const status = await detector.analyzeGitignore(testDir);
      
      expect(status.exists).toBe(true);
      expect(status.status).toBe('compliant');
      expect(status.strategy).toBe('skip');
    });
  });
});
