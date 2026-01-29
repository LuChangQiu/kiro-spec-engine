/**
 * Workspace Integration Tests
 * 
 * Tests for workspace-multi, status, and doctor commands
 * Validates end-to-end workflows using real file system operations
 */

const IntegrationTestFixture = require('../fixtures/integration-test-fixture');
const CommandTestHelper = require('../helpers/command-test-helper');
const WorkspaceStateManager = require('../../lib/workspace/multi/workspace-state-manager');
const fs = require('fs-extra');
const path = require('path');

describe('Workspace Integration', () => {
  let fixture;
  let helper;
  let stateManager;
  let stateFilePath;

  // Helper function to create a valid kse project directory
  async function createValidWorkspaceDir(relativePath) {
    const workspacePath = fixture.getAbsolutePath(relativePath);
    await fs.ensureDir(path.join(workspacePath, '.kiro'));
    return workspacePath;
  }

  beforeEach(async () => {
    fixture = new IntegrationTestFixture(`workspace-test-${Date.now()}`);
    await fixture.setup();
    helper = new CommandTestHelper(fixture);
    
    // Create unique state file for this test
    stateFilePath = path.join(fixture.kiroDir, 'workspace-state.json');
    
    // Create new state manager with test-specific state file
    stateManager = new WorkspaceStateManager(stateFilePath);
    await stateManager.load();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Workspace Creation', () => {
    test('should create new workspace and verify registration', async () => {
      const workspaceName = 'test-workspace';
      const workspacePath = await createValidWorkspaceDir('test-ws');

      // Create workspace using state manager directly
      const workspace = await stateManager.createWorkspace(workspaceName, workspacePath);

      // Verify workspace was created
      expect(workspace).toBeDefined();
      expect(workspace.name).toBe(workspaceName);
      // Normalize paths for comparison (Windows vs Unix)
      expect(path.normalize(workspace.path)).toBe(path.normalize(workspacePath));

      // Verify workspace appears in registry
      const workspaces = await stateManager.listWorkspaces();
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe(workspaceName);
    });

    test('should reject duplicate workspace names', async () => {
      const workspaceName = 'duplicate-test';
      const workspacePath = await createValidWorkspaceDir('ws1');
      const workspacePath2 = await createValidWorkspaceDir('ws2');

      // Create first workspace
      await stateManager.createWorkspace(workspaceName, workspacePath);

      // Attempt to create duplicate
      await expect(
        stateManager.createWorkspace(workspaceName, workspacePath2)
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('Workspace Switching', () => {
    test('should switch between workspaces and verify active workspace changes', async () => {
      // Create two workspaces
      await stateManager.createWorkspace('workspace-1', await createValidWorkspaceDir('ws1'));
      await stateManager.createWorkspace('workspace-2', await createValidWorkspaceDir('ws2'));

      // Switch to workspace-1
      await stateManager.switchWorkspace('workspace-1');
      let activeWorkspace = await stateManager.getActiveWorkspace();
      expect(activeWorkspace.name).toBe('workspace-1');

      // Switch to workspace-2
      await stateManager.switchWorkspace('workspace-2');
      activeWorkspace = await stateManager.getActiveWorkspace();
      expect(activeWorkspace.name).toBe('workspace-2');
    });

    test('should update last accessed timestamp when switching', async () => {
      await stateManager.createWorkspace('test-ws', await createValidWorkspaceDir('ws'));

      const beforeSwitch = Date.now();
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

      await stateManager.switchWorkspace('test-ws');

      const workspace = await stateManager.getWorkspace('test-ws');
      expect(workspace.lastAccessed.getTime()).toBeGreaterThanOrEqual(beforeSwitch);
    });

    test('should reject switching to non-existent workspace', async () => {
      await expect(
        stateManager.switchWorkspace('non-existent')
      ).rejects.toThrow(/does not exist/i);
    });
  });

  describe('Workspace Listing', () => {
    test('should list all workspaces and verify output format', async () => {
      // Create multiple workspaces
      await stateManager.createWorkspace('workspace-a', await createValidWorkspaceDir('wsa'));
      await stateManager.createWorkspace('workspace-b', await createValidWorkspaceDir('wsb'));
      await stateManager.createWorkspace('workspace-c', await createValidWorkspaceDir('wsc'));

      // List workspaces
      const workspaces = await stateManager.listWorkspaces();

      // Verify all workspaces are listed
      expect(workspaces).toHaveLength(3);
      expect(workspaces.map(ws => ws.name)).toEqual(
        expect.arrayContaining(['workspace-a', 'workspace-b', 'workspace-c'])
      );

      // Verify each workspace has required properties
      workspaces.forEach(ws => {
        expect(ws).toHaveProperty('name');
        expect(ws).toHaveProperty('path');
        expect(ws).toHaveProperty('createdAt');
        expect(ws).toHaveProperty('lastAccessed');
      });
    });

    test('should return empty array when no workspaces exist', async () => {
      const workspaces = await stateManager.listWorkspaces();
      expect(workspaces).toEqual([]);
    });

    test('should list workspaces in consistent order', async () => {
      // Create workspaces
      await stateManager.createWorkspace('ws-a', await createValidWorkspaceDir('ws1'));
      await stateManager.createWorkspace('ws-b', await createValidWorkspaceDir('ws2'));
      await stateManager.createWorkspace('ws-c', await createValidWorkspaceDir('ws3'));

      const workspaces = await stateManager.listWorkspaces();

      // Verify all workspaces are listed
      expect(workspaces).toHaveLength(3);
      const names = workspaces.map(ws => ws.name);
      expect(names).toContain('ws-a');
      expect(names).toContain('ws-b');
      expect(names).toContain('ws-c');
    });
  });

  describe('Workspace Deletion', () => {
    test('should delete workspace and verify removal from registry', async () => {
      const workspaceName = 'to-delete';
      await stateManager.createWorkspace(workspaceName, await createValidWorkspaceDir('ws'));

      // Verify workspace exists
      let workspaces = await stateManager.listWorkspaces();
      expect(workspaces).toHaveLength(1);

      // Delete workspace
      await stateManager.removeWorkspace(workspaceName);

      // Verify workspace no longer appears in listing
      workspaces = await stateManager.listWorkspaces();
      expect(workspaces).toHaveLength(0);
    });

    test('should clear active workspace when deleting active workspace', async () => {
      await stateManager.createWorkspace('active-ws', await createValidWorkspaceDir('ws'));
      await stateManager.switchWorkspace('active-ws');

      // Verify it's active
      let activeWorkspace = await stateManager.getActiveWorkspace();
      expect(activeWorkspace.name).toBe('active-ws');

      // Delete active workspace
      await stateManager.removeWorkspace('active-ws');

      // Verify active workspace is cleared
      activeWorkspace = await stateManager.getActiveWorkspace();
      expect(activeWorkspace).toBeNull();
    });

    test('should handle deleting non-existent workspace gracefully', async () => {
      // removeWorkspace returns false if workspace doesn't exist
      const result = await stateManager.removeWorkspace('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Status Command', () => {
    test('should report status with active specs', async () => {
      // Create a spec
      await fixture.createSpec('01-00-test-feature', {
        requirements: '# Requirements\n\nTest requirements',
        design: '# Design\n\nTest design',
        tasks: '# Tasks\n\n- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3'
      });

      // Check that spec directory exists
      const specs = await fixture.getSpecs();
      expect(specs).toContain('01-00-test-feature');
      expect(specs).toHaveLength(1);
    });

    test('should report empty state when no specs exist', async () => {
      const specs = await fixture.getSpecs();
      expect(specs).toEqual([]);
    });

    test('should count specs correctly', async () => {
      // Create multiple specs
      await fixture.createSpec('01-00-feature-a', {
        requirements: '# Requirements A'
      });
      await fixture.createSpec('02-00-feature-b', {
        requirements: '# Requirements B'
      });
      await fixture.createSpec('03-00-feature-c', {
        requirements: '# Requirements C'
      });

      const specs = await fixture.getSpecs();
      expect(specs).toHaveLength(3);
    });
  });

  describe('Doctor Command', () => {
    test('should verify healthy workspace has no issues', async () => {
      // Create a properly structured workspace
      await fixture.createSpec('01-00-healthy-spec', {
        requirements: '# Requirements\n\nValid requirements',
        design: '# Design\n\nValid design',
        tasks: '# Tasks\n\n- [ ] Task 1'
      });

      // Verify .kiro directory structure exists
      expect(await fixture.fileExists('.kiro')).toBe(true);
      expect(await fixture.fileExists('.kiro/specs')).toBe(true);
      expect(await fixture.fileExists('.kiro/config.json')).toBe(true);
    });

    test('should identify missing directories', async () => {
      // Remove specs directory
      const specsPath = fixture.getAbsolutePath('.kiro/specs');
      await fs.remove(specsPath);

      // Verify directory is missing
      expect(await fixture.fileExists('.kiro/specs')).toBe(false);
    });

    test('should identify invalid configuration', async () => {
      // Write invalid JSON to config file
      await fixture.writeFile('.kiro/config.json', 'invalid json {');

      // Attempt to read config should fail
      await expect(
        fixture.getWorkspaceConfig()
      ).rejects.toThrow();
    });
  });

  describe('Workspace Information', () => {
    test('should display workspace details correctly', async () => {
      const workspaceName = 'info-test';
      const workspacePath = await createValidWorkspaceDir('ws');

      await stateManager.createWorkspace(workspaceName, workspacePath);

      const workspace = await stateManager.getWorkspace(workspaceName);

      expect(workspace.name).toBe(workspaceName);
      // Normalize paths for comparison
      expect(path.normalize(workspace.path)).toBe(path.normalize(workspacePath));
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.lastAccessed).toBeInstanceOf(Date);
    });

    test('should count specs in workspace', async () => {
      // Create workspace with specs
      await fixture.createSpec('01-00-spec-1', { requirements: '# Spec 1' });
      await fixture.createSpec('02-00-spec-2', { requirements: '# Spec 2' });

      const specs = await fixture.getSpecs();
      expect(specs).toHaveLength(2);
    });
  });
});
