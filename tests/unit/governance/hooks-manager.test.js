/**
 * Tests for HooksManager
 */

const fs = require('fs-extra');
const path = require('path');
const HooksManager = require('../../../lib/governance/hooks-manager');

describe('HooksManager', () => {
  let testDir;
  let manager;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '../../temp/hooks-test-' + Date.now());
    await fs.ensureDir(testDir);
    
    manager = new HooksManager(testDir);
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });
  
  describe('checkHooksInstalled', () => {
    test('should return not_git_repo when .git directory does not exist', async () => {
      const status = await manager.checkHooksInstalled();
      
      expect(status.installed).toBe(false);
      expect(status.reason).toBe('not_git_repo');
      expect(status.message).toContain('Not a Git repository');
    });
    
    test('should return no_hooks_dir when .git exists but hooks directory does not', async () => {
      await fs.ensureDir(path.join(testDir, '.git'));
      
      const status = await manager.checkHooksInstalled();
      
      expect(status.installed).toBe(false);
      expect(status.reason).toBe('no_hooks_dir');
      expect(status.message).toContain('hooks directory does not exist');
    });
    
    test('should return no_hook when hooks directory exists but pre-commit does not', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      const status = await manager.checkHooksInstalled();
      
      expect(status.installed).toBe(false);
      expect(status.reason).toBe('no_hook');
      expect(status.message).toContain('Pre-commit hook not installed');
    });
    
    test('should return other_hook when pre-commit exists but is not ours', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      await fs.writeFile(
        path.join(testDir, '.git/hooks/pre-commit'),
        '#!/bin/sh\necho "Other hook"'
      );
      
      const status = await manager.checkHooksInstalled();
      
      expect(status.installed).toBe(false);
      expect(status.reason).toBe('other_hook');
      expect(status.message).toContain('not ours');
      expect(status.hasExistingHook).toBe(true);
    });
    
    test('should return installed when our hook is present', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      await fs.writeFile(
        path.join(testDir, '.git/hooks/pre-commit'),
        '#!/bin/sh\n# BEGIN kiro-spec-engine document governance\necho "test"\n# END kiro-spec-engine document governance'
      );
      
      const status = await manager.checkHooksInstalled();
      
      expect(status.installed).toBe(true);
      expect(status.reason).toBe('installed');
      expect(status.message).toContain('installed');
    });
  });
  
  describe('installHooks', () => {
    test('should fail when not a Git repository', async () => {
      const result = await manager.installHooks();
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_git_repo');
      expect(result.message).toContain('Not a Git repository');
    });
    
    test('should create hooks directory if it does not exist', async () => {
      await fs.ensureDir(path.join(testDir, '.git'));
      
      const result = await manager.installHooks();
      
      expect(result.success).toBe(true);
      expect(await fs.pathExists(path.join(testDir, '.git/hooks'))).toBe(true);
    });
    
    test('should install hook when no pre-commit exists', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      const result = await manager.installHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('installed');
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit'))).toBe(true);
      
      const content = await fs.readFile(path.join(testDir, '.git/hooks/pre-commit'), 'utf8');
      expect(content).toContain('#!/bin/sh');
      expect(content).toContain('BEGIN kiro-spec-engine document governance');
      expect(content).toContain('END kiro-spec-engine document governance');
      expect(content).toContain('ValidationEngine');
    });
    
    test('should preserve existing hook when installing', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      const existingHook = '#!/bin/sh\necho "Existing hook"\nexit 0';
      await fs.writeFile(path.join(testDir, '.git/hooks/pre-commit'), existingHook);
      
      const result = await manager.installHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('installed_with_preservation');
      expect(result.backupCreated).toBe(true);
      
      // Check backup was created
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit.backup'))).toBe(true);
      const backup = await fs.readFile(path.join(testDir, '.git/hooks/pre-commit.backup'), 'utf8');
      expect(backup).toBe(existingHook);
      
      // Check combined hook
      const content = await fs.readFile(path.join(testDir, '.git/hooks/pre-commit'), 'utf8');
      expect(content).toContain('Existing hook');
      expect(content).toContain('BEGIN kiro-spec-engine document governance');
    });
    
    test('should not reinstall if already installed', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      // Install once
      await manager.installHooks();
      
      // Try to install again
      const result = await manager.installHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('already_installed');
      expect(result.message).toContain('already installed');
    });
    
    test('should make hook executable on Unix-like systems', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows
        return;
      }
      
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      await manager.installHooks();
      
      const stats = await fs.stat(path.join(testDir, '.git/hooks/pre-commit'));
      // Check if executable bit is set (0o755 = rwxr-xr-x)
      expect(stats.mode & 0o111).not.toBe(0);
    });
  });
  
  describe('uninstallHooks', () => {
    test('should succeed when hook is not installed', async () => {
      const result = await manager.uninstallHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('not_installed');
    });
    
    test('should fail when pre-commit exists but is not ours', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      await fs.writeFile(
        path.join(testDir, '.git/hooks/pre-commit'),
        '#!/bin/sh\necho "Other hook"'
      );
      
      const result = await manager.uninstallHooks();
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_our_hook');
      expect(result.message).toContain('not ours');
    });
    
    test('should remove hook file when only our hook exists', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      await manager.installHooks();
      
      const result = await manager.uninstallHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('removed');
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit'))).toBe(false);
    });
    
    test('should preserve other hooks when uninstalling', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      // Create existing hook
      const existingHook = '#!/bin/sh\necho "Existing hook"\nexit 0';
      await fs.writeFile(path.join(testDir, '.git/hooks/pre-commit'), existingHook);
      
      // Install our hook
      await manager.installHooks();
      
      // Uninstall our hook
      const result = await manager.uninstallHooks();
      
      expect(result.success).toBe(true);
      expect(result.reason).toBe('removed_preserved');
      expect(result.message).toContain('Other hooks preserved');
      
      // Check that existing hook is still there
      const content = await fs.readFile(path.join(testDir, '.git/hooks/pre-commit'), 'utf8');
      expect(content).toContain('Existing hook');
      expect(content).not.toContain('BEGIN kiro-spec-engine document governance');
    });
    
    test('should remove backup when removing hook completely', async () => {
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      // Create existing hook
      await fs.writeFile(
        path.join(testDir, '.git/hooks/pre-commit'),
        '#!/bin/sh\necho "test"'
      );
      
      // Install (creates backup)
      await manager.installHooks();
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit.backup'))).toBe(true);
      
      // Manually remove existing hook content to simulate only our hook remaining
      const hookPath = path.join(testDir, '.git/hooks/pre-commit');
      const content = await fs.readFile(hookPath, 'utf8');
      const ourHookOnly = content.substring(content.indexOf('# BEGIN'));
      await fs.writeFile(hookPath, '#!/bin/sh\n\n' + ourHookOnly);
      
      // Uninstall
      await manager.uninstallHooks();
      
      // Backup should be removed
      expect(await fs.pathExists(path.join(testDir, '.git/hooks/pre-commit.backup'))).toBe(false);
    });
  });
  
  describe('hook content generation', () => {
    test('should generate valid hook content', () => {
      const content = manager.generateHookContent();
      
      expect(content).toContain('BEGIN kiro-spec-engine document governance');
      expect(content).toContain('END kiro-spec-engine document governance');
      expect(content).toContain('node -e');
      expect(content).toContain('ValidationEngine');
      expect(content).toContain('kse doctor --docs');
      expect(content).toContain('kse cleanup');
      expect(content).toContain('kse validate --all');
    });
    
    test('should include error handling in hook content', () => {
      const content = manager.generateHookContent();
      
      expect(content).toContain('try');
      expect(content).toContain('catch');
      expect(content).toContain('process.exit(1)');
    });
  });
  
  describe('hook combination', () => {
    test('should combine hooks with proper formatting', () => {
      const existing = '#!/bin/sh\necho "test"';
      const our = 'echo "our hook"';
      
      const combined = manager.combineHooks(existing, our);
      
      expect(combined).toContain('#!/bin/sh');
      expect(combined).toContain('echo "test"');
      expect(combined).toContain('echo "our hook"');
    });
    
    test('should add shebang if missing', () => {
      const existing = 'echo "test"';
      const our = 'echo "our hook"';
      
      const combined = manager.combineHooks(existing, our);
      
      expect(combined).toMatch(/^#!\/bin\/sh/);
    });
  });
  
  describe('hook removal', () => {
    test('should remove our hook from combined content', () => {
      const content = `#!/bin/sh
echo "before"

# BEGIN kiro-spec-engine document governance
echo "our hook"
# END kiro-spec-engine document governance

echo "after"`;
      
      const result = manager.removeOurHook(content);
      
      expect(result).toContain('echo "before"');
      expect(result).toContain('echo "after"');
      expect(result).not.toContain('BEGIN kiro-spec-engine document governance');
      expect(result).not.toContain('our hook');
    });
    
    test('should handle hook at beginning', () => {
      const content = `#!/bin/sh

# BEGIN kiro-spec-engine document governance
echo "our hook"
# END kiro-spec-engine document governance

echo "after"`;
      
      const result = manager.removeOurHook(content);
      
      expect(result).toContain('echo "after"');
      expect(result).not.toContain('our hook');
    });
    
    test('should handle hook at end', () => {
      const content = `#!/bin/sh
echo "before"

# BEGIN kiro-spec-engine document governance
echo "our hook"
# END kiro-spec-engine document governance`;
      
      const result = manager.removeOurHook(content);
      
      expect(result).toContain('echo "before"');
      expect(result).not.toContain('our hook');
    });
    
    test('should return empty when only our hook exists', () => {
      const content = `# BEGIN kiro-spec-engine document governance
echo "our hook"
# END kiro-spec-engine document governance`;
      
      const result = manager.removeOurHook(content);
      
      expect(result.trim()).toBe('');
    });
  });
  
  describe('error handling', () => {
    test('should handle file system errors gracefully', async () => {
      // Create a read-only directory to trigger permission errors
      await fs.ensureDir(path.join(testDir, '.git/hooks'));
      
      // Mock fs.writeFile to throw an error
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValue(new Error('Permission denied'));
      
      const result = await manager.installHooks();
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('error');
      expect(result.error).toContain('Permission denied');
      
      // Restore original function
      fs.writeFile = originalWriteFile;
    });
  });
});
