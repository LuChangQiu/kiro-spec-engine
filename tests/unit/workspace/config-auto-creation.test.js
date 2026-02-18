/**
 * Tests for WorkspaceStateManager auto-creation of configuration directory
 * 
 * Updated to test WorkspaceStateManager instead of legacy GlobalConfig/WorkspaceRegistry
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const WorkspaceStateManager = require('../../../lib/workspace/multi/workspace-state-manager');

describe('Configuration Directory Auto-Creation', () => {
  let tempDir;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `sce-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('WorkspaceStateManager', () => {
    it('should auto-create config directory on save', async () => {
      const statePath = path.join(tempDir, 'non-existent', 'workspace-state.json');
      const stateManager = new WorkspaceStateManager(statePath);

      // Directory should not exist yet
      const stateDir = path.dirname(statePath);
      expect(await fs.pathExists(stateDir)).toBe(false);

      // Create a valid sce project directory
      const projectDir = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      // Create workspace should trigger save and create directory
      await stateManager.createWorkspace('test-ws', projectDir);

      // Directory should now exist
      expect(await fs.pathExists(stateDir)).toBe(true);
      expect(await fs.pathExists(statePath)).toBe(true);
    });

    it('should auto-create nested directories', async () => {
      const statePath = path.join(tempDir, 'level1', 'level2', 'level3', 'workspace-state.json');
      const stateManager = new WorkspaceStateManager(statePath);

      // Create a valid sce project directory
      const projectDir = path.join(tempDir, 'test-project2');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      await stateManager.createWorkspace('test-ws', projectDir);

      // All nested directories should be created
      expect(await fs.pathExists(path.join(tempDir, 'level1'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'level1', 'level2'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'level1', 'level2', 'level3'))).toBe(true);
      expect(await fs.pathExists(statePath)).toBe(true);
    });

    it('should work when directory already exists', async () => {
      const stateDir = path.join(tempDir, 'existing');
      await fs.ensureDir(stateDir);

      const statePath = path.join(stateDir, 'workspace-state.json');
      const stateManager = new WorkspaceStateManager(statePath);

      // Create a valid sce project directory
      const projectDir = path.join(tempDir, 'test-project3');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      await stateManager.createWorkspace('test-ws', projectDir);

      expect(await fs.pathExists(statePath)).toBe(true);
    });

    it('should initialize default state on first use', async () => {
      const statePath = path.join(tempDir, 'new-state', 'workspace-state.json');
      const stateManager = new WorkspaceStateManager(statePath);

      // Load should work even if file doesn't exist
      await stateManager.load();

      // Should have empty workspaces and no active workspace
      const workspaces = await stateManager.listWorkspaces();
      expect(workspaces.length).toBe(0);
      
      const activeWorkspace = await stateManager.getActiveWorkspace();
      expect(activeWorkspace).toBeNull();

      // Save should create file with defaults
      await stateManager.save();
      expect(await fs.pathExists(statePath)).toBe(true);

      // Verify content
      const content = await fs.readFile(statePath, 'utf8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0');
      expect(data.workspaces).toEqual([]);
      // active_workspace can be null or undefined when no workspace is active
      expect(data.active_workspace == null).toBe(true);
    });
  });

  describe('Default paths', () => {
    it('WorkspaceStateManager should use ~/.kse/workspace-state.json by default', () => {
      const stateManager = new WorkspaceStateManager();
      const expectedPath = path.join(os.homedir(), '.kse', 'workspace-state.json');
      expect(stateManager.statePath).toBe(expectedPath);
    });
  });

  describe('Error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may not work on all systems
      // Skip on Windows where permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      const statePath = path.join(readOnlyDir, 'subdir', 'workspace-state.json');
      const stateManager = new WorkspaceStateManager(statePath);

      // Create a valid sce project directory
      const projectDir = path.join(tempDir, 'test-project4');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      await expect(stateManager.createWorkspace('test', projectDir)).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);
    });
  });
});
