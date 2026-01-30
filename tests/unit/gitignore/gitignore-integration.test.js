/**
 * Tests for GitignoreIntegration
 * 
 * Tests integration with adopt, upgrade, and doctor flows
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const GitignoreIntegration = require('../../../lib/gitignore/gitignore-integration');

describe('GitignoreIntegration', () => {
  let testDir;
  let integration;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-gitignore-integration-'));
    integration = new GitignoreIntegration();
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await fs.remove(testDir);
    }
  });

  describe('integrateWithAdopt()', () => {
    test('should create .gitignore with layered rules when missing', async () => {
      const result = await integration.integrateWithAdopt(testDir);

      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
      expect(result.message).toContain('created');

      // Verify .gitignore was created
      const gitignorePath = path.join(testDir, '.gitignore');
      const exists = await fs.pathExists(gitignorePath);
      expect(exists).toBe(true);

      // Verify content has layered rules
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('.kiro/steering/CURRENT_CONTEXT.md');
      expect(content).toContain('.kiro/environments.json');
    });

    test('should update .gitignore when old pattern exists', async () => {
      // Create .gitignore with old pattern
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.kiro/\nnode_modules/\n');

      const result = await integration.integrateWithAdopt(testDir);

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(result.removed).toContain('.kiro/');

      // Verify old pattern was removed
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).not.toContain('.kiro/\n');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.kiro/steering/CURRENT_CONTEXT.md');
    });

    test('should skip when .gitignore is already compliant', async () => {
      // Create compliant .gitignore with all required rules
      const gitignorePath = path.join(testDir, '.gitignore');
      const compliantContent = `
# Personal state files (DO NOT commit)
.kiro/steering/CURRENT_CONTEXT.md
.kiro/contexts/.active
.kiro/contexts/*/CURRENT_CONTEXT.md

# Environment configuration (DO NOT commit)
.kiro/environments.json
.kiro/env-backups/

# Temporary files and backups (DO NOT commit)
.kiro/backups/
.kiro/logs/
.kiro/reports/

# Spec artifacts (COMMIT - but exclude temporary files)
.kiro/specs/**/SESSION-*.md
.kiro/specs/**/*-SUMMARY.md
.kiro/specs/**/*-COMPLETE.md
.kiro/specs/**/TEMP-*.md
.kiro/specs/**/WIP-*.md
.kiro/specs/**/MVP-*.md
`;
      await fs.writeFile(gitignorePath, compliantContent);

      const result = await integration.integrateWithAdopt(testDir);

      expect(result.success).toBe(true);
      expect(result.action).toBe('skipped');
    });
  });

  describe('integrateWithUpgrade()', () => {
    test('should fix .gitignore during upgrade', async () => {
      // Create .gitignore with old pattern
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.kiro/*\n');

      const result = await integration.integrateWithUpgrade(testDir);

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(result.removed).toContain('.kiro/*');
    });
  });

  describe('runDoctor()', () => {
    test('should provide detailed output for doctor command', async () => {
      // Create .gitignore with old pattern
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.kiro/\n');

      const result = await integration.runDoctor(testDir);

      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(result.message).toContain('updated');
    });
  });

  describe('checkAndFix()', () => {
    test('should create backup before modification', async () => {
      // Create .gitignore with old pattern
      const gitignorePath = path.join(testDir, '.gitignore');
      await fs.writeFile(gitignorePath, '.kiro/\nnode_modules/\n');

      const result = await integration.checkAndFix(testDir);

      expect(result.success).toBe(true);
      expect(result.backupId).toBeTruthy();

      // Verify backup was created
      const backupPath = path.join(testDir, '.kiro', 'backups', result.backupId);
      const backupExists = await fs.pathExists(backupPath);
      expect(backupExists).toBe(true);
    });

    test('should preserve user rules during transformation', async () => {
      // Create .gitignore with old pattern and user rules
      const gitignorePath = path.join(testDir, '.gitignore');
      const originalContent = `
.kiro/
node_modules/
*.log
dist/
.env
`;
      await fs.writeFile(gitignorePath, originalContent);

      const result = await integration.checkAndFix(testDir);

      expect(result.success).toBe(true);

      // Verify user rules were preserved
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('*.log');
      expect(content).toContain('dist/');
      expect(content).toContain('.env');
    });

    test('should handle errors gracefully', async () => {
      // Try to fix in non-existent directory
      const nonExistentDir = path.join(testDir, 'non-existent');

      const result = await integration.checkAndFix(nonExistentDir);

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });
});
