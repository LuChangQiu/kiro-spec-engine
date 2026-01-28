/**
 * Unit Tests for WorkspaceContextResolver
 * 
 * Tests workspace context resolution logic and priority handling.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { 
  WorkspaceContextResolver, 
  WorkspaceRegistry, 
  GlobalConfig,
  Workspace 
} = require('../../../lib/workspace/multi');

describe('WorkspaceContextResolver', () => {
  let testDir;
  let registryPath;
  let configPath;
  let registry;
  let config;
  let resolver;
  let workspace1Dir;
  let workspace2Dir;
  let workspace3Dir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `kse-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Set up config paths
    registryPath = path.join(testDir, 'workspaces.json');
    configPath = path.join(testDir, 'config.json');

    // Create test workspace directories
    workspace1Dir = path.join(testDir, 'workspace-1');
    workspace2Dir = path.join(testDir, 'workspace-2');
    workspace3Dir = path.join(testDir, 'workspace-3');

    await fs.ensureDir(path.join(workspace1Dir, '.kiro'));
    await fs.ensureDir(path.join(workspace2Dir, '.kiro'));
    await fs.ensureDir(path.join(workspace3Dir, '.kiro'));

    // Initialize registry and config
    registry = new WorkspaceRegistry(registryPath);
    config = new GlobalConfig(configPath);
    resolver = new WorkspaceContextResolver(registry, config);

    // Register test workspaces
    await registry.createWorkspace('workspace-1', workspace1Dir);
    await registry.createWorkspace('workspace-2', workspace2Dir);
    await registry.createWorkspace('workspace-3', workspace3Dir);
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(testDir);
  });

  describe('resolveWorkspace', () => {
    test('should resolve explicit workspace parameter (priority 1)', async () => {
      const workspace = await resolver.resolveWorkspace('workspace-2');
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-2');
    });

    test('should throw error for non-existent explicit workspace', async () => {
      await expect(async () => {
        await resolver.resolveWorkspace('non-existent');
      }).rejects.toThrow('does not exist');
    });

    test('should resolve from current directory (priority 2)', async () => {
      const workspace = await resolver.resolveWorkspace(null, workspace1Dir);
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-1');
    });

    test('should resolve from active workspace (priority 3)', async () => {
      await config.setActiveWorkspace('workspace-3');
      
      const workspace = await resolver.resolveWorkspace();
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-3');
    });

    test('should return null when no context available', async () => {
      const nonWorkspaceDir = path.join(testDir, 'non-workspace');
      await fs.ensureDir(nonWorkspaceDir);
      
      const workspace = await resolver.resolveWorkspace(null, nonWorkspaceDir);
      
      expect(workspace).toBeNull();
    });

    test('should prioritize explicit parameter over current directory', async () => {
      const workspace = await resolver.resolveWorkspace('workspace-2', workspace1Dir);
      
      expect(workspace.name).toBe('workspace-2');
    });

    test('should prioritize current directory over active workspace', async () => {
      await config.setActiveWorkspace('workspace-3');
      
      const workspace = await resolver.resolveWorkspace(null, workspace1Dir);
      
      expect(workspace.name).toBe('workspace-1');
    });
  });

  describe('detectWorkspaceFromPath', () => {
    test('should detect workspace from exact path', async () => {
      const workspace = await resolver.detectWorkspaceFromPath(workspace1Dir);
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-1');
    });

    test('should detect workspace from subdirectory', async () => {
      const subdir = path.join(workspace1Dir, 'subdir');
      await fs.ensureDir(subdir);
      
      const workspace = await resolver.detectWorkspaceFromPath(subdir);
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-1');
    });

    test('should return null for non-workspace path', async () => {
      const nonWorkspaceDir = path.join(testDir, 'non-workspace');
      await fs.ensureDir(nonWorkspaceDir);
      
      const workspace = await resolver.detectWorkspaceFromPath(nonWorkspaceDir);
      
      expect(workspace).toBeNull();
    });
  });

  describe('isValidKseDirectory', () => {
    test('should return true for valid kse directory', async () => {
      const isValid = await resolver.isValidKseDirectory(workspace1Dir);
      
      expect(isValid).toBe(true);
    });

    test('should return false for directory without .kiro', async () => {
      const nonKseDir = path.join(testDir, 'non-kse');
      await fs.ensureDir(nonKseDir);
      
      const isValid = await resolver.isValidKseDirectory(nonKseDir);
      
      expect(isValid).toBe(false);
    });

    test('should return false for non-existent directory', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent');
      
      const isValid = await resolver.isValidKseDirectory(nonExistentDir);
      
      expect(isValid).toBe(false);
    });
  });

  describe('getActiveWorkspace', () => {
    test('should return active workspace when set', async () => {
      await config.setActiveWorkspace('workspace-2');
      
      const workspace = await resolver.getActiveWorkspace();
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-2');
    });

    test('should return null when no active workspace', async () => {
      const workspace = await resolver.getActiveWorkspace();
      
      expect(workspace).toBeNull();
    });

    test('should clear active workspace if it no longer exists', async () => {
      await config.setActiveWorkspace('workspace-2');
      await registry.removeWorkspace('workspace-2');
      
      const workspace = await resolver.getActiveWorkspace();
      
      expect(workspace).toBeNull();
      
      const activeWorkspaceName = await config.getActiveWorkspace();
      expect(activeWorkspaceName).toBeNull();
    });
  });

  describe('setActiveWorkspace', () => {
    test('should set active workspace', async () => {
      await resolver.setActiveWorkspace('workspace-1');
      
      const activeWorkspaceName = await config.getActiveWorkspace();
      expect(activeWorkspaceName).toBe('workspace-1');
    });

    test('should update last accessed timestamp', async () => {
      const workspaceBefore = await registry.getWorkspace('workspace-1');
      const lastAccessedBefore = workspaceBefore.lastAccessed;
      
      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await resolver.setActiveWorkspace('workspace-1');
      
      const workspaceAfter = await registry.getWorkspace('workspace-1');
      expect(workspaceAfter.lastAccessed.getTime()).toBeGreaterThan(lastAccessedBefore.getTime());
    });

    test('should throw error for non-existent workspace', async () => {
      await expect(async () => {
        await resolver.setActiveWorkspace('non-existent');
      }).rejects.toThrow('does not exist');
    });
  });

  describe('clearActiveWorkspace', () => {
    test('should clear active workspace', async () => {
      await config.setActiveWorkspace('workspace-1');
      
      await resolver.clearActiveWorkspace();
      
      const activeWorkspaceName = await config.getActiveWorkspace();
      expect(activeWorkspaceName).toBeNull();
    });
  });

  describe('shouldPromptForRegistration', () => {
    test('should return true for unregistered kse directory', async () => {
      const newKseDir = path.join(testDir, 'new-kse');
      await fs.ensureDir(path.join(newKseDir, '.kiro'));
      
      const shouldPrompt = await resolver.shouldPromptForRegistration(newKseDir);
      
      expect(shouldPrompt).toBe(true);
    });

    test('should return false for registered workspace', async () => {
      const shouldPrompt = await resolver.shouldPromptForRegistration(workspace1Dir);
      
      expect(shouldPrompt).toBe(false);
    });

    test('should return false for non-kse directory', async () => {
      const nonKseDir = path.join(testDir, 'non-kse');
      await fs.ensureDir(nonKseDir);
      
      const shouldPrompt = await resolver.shouldPromptForRegistration(nonKseDir);
      
      expect(shouldPrompt).toBe(false);
    });
  });

  describe('resolveWorkspaceOrError', () => {
    test('should resolve workspace successfully', async () => {
      await config.setActiveWorkspace('workspace-1');
      
      const workspace = await resolver.resolveWorkspaceOrError();
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('workspace-1');
    });

    test('should throw helpful error for unregistered kse directory', async () => {
      const newKseDir = path.join(testDir, 'new-kse');
      await fs.ensureDir(path.join(newKseDir, '.kiro'));
      
      await expect(async () => {
        await resolver.resolveWorkspaceOrError(null, newKseDir);
      }).rejects.toThrow('not registered as a workspace');
    });

    test('should throw helpful error when no workspaces registered', async () => {
      // Clear all workspaces
      await registry.removeWorkspace('workspace-1');
      await registry.removeWorkspace('workspace-2');
      await registry.removeWorkspace('workspace-3');
      
      const nonKseDir = path.join(testDir, 'non-kse');
      await fs.ensureDir(nonKseDir);
      
      await expect(async () => {
        await resolver.resolveWorkspaceOrError(null, nonKseDir);
      }).rejects.toThrow('No workspaces are registered');
    });

    test('should throw helpful error with available workspaces', async () => {
      const nonKseDir = path.join(testDir, 'non-kse');
      await fs.ensureDir(nonKseDir);
      
      await expect(async () => {
        await resolver.resolveWorkspaceOrError(null, nonKseDir);
      }).rejects.toThrow('Available workspaces');
    });
  });
});
