/**
 * Unit Tests for Multi-Workspace Management Commands
 * 
 * Tests the CLI command handlers for workspace management.
 * Updated to use WorkspaceStateManager instead of WorkspaceRegistry/GlobalConfig.
 */

const workspaceMultiCommands = require('../../../lib/commands/workspace-multi');
const WorkspaceStateManager = require('../../../lib/workspace/multi/workspace-state-manager');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock console methods
let consoleLogSpy;
let consoleErrorSpy;
let processExitSpy;

describe('Multi-Workspace Commands', () => {
  let testDir;
  let testWorkspacePath;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `sce-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Create test workspace directory
    testWorkspacePath = path.join(testDir, 'test-workspace');
    await fs.ensureDir(testWorkspacePath);
    await fs.ensureDir(path.join(testWorkspacePath, '.kiro'));
    await fs.ensureDir(path.join(testWorkspacePath, '.kiro', 'specs'));

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    // Clean up
    await fs.remove(testDir);
    
    // Restore mocks
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('createWorkspace', () => {
    test('should create workspace with provided path', async () => {
      // Mock state manager
      const mockStateManager = {
        createWorkspace: jest.fn().mockResolvedValue({
          name: 'test-workspace',
          path: testWorkspacePath,
          createdAt: new Date(),
          lastAccessed: new Date()
        })
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'createWorkspace')
        .mockImplementation(mockStateManager.createWorkspace);

      await workspaceMultiCommands.createWorkspace('test-workspace', {
        path: testWorkspacePath
      });

      expect(mockStateManager.createWorkspace).toHaveBeenCalledWith(
        'test-workspace',
        testWorkspacePath
      );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('should use current directory when no path provided', async () => {
      const currentDir = process.cwd();
      
      const mockStateManager = {
        createWorkspace: jest.fn().mockResolvedValue({
          name: 'test-workspace',
          path: currentDir,
          createdAt: new Date(),
          lastAccessed: new Date()
        })
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'createWorkspace')
        .mockImplementation(mockStateManager.createWorkspace);

      await workspaceMultiCommands.createWorkspace('test-workspace', {});

      expect(mockStateManager.createWorkspace).toHaveBeenCalledWith(
        'test-workspace',
        currentDir
      );
    });

    test('should handle creation errors', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'createWorkspace')
        .mockRejectedValue(new Error('Workspace already exists'));

      await expect(async () => {
        await workspaceMultiCommands.createWorkspace('test-workspace', {
          path: testWorkspacePath
        });
      }).rejects.toThrow('process.exit(1)');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.stringContaining('Workspace already exists')
      );
    });
  });

  describe('listWorkspaces', () => {
    test('should list all workspaces sorted by last accessed', async () => {
      const workspace1 = {
        name: 'workspace-1',
        path: '/path/to/workspace-1',
        createdAt: new Date('2024-01-01'),
        lastAccessed: new Date('2024-01-01')
      };
      
      const workspace2 = {
        name: 'workspace-2',
        path: '/path/to/workspace-2',
        createdAt: new Date('2024-01-02'),
        lastAccessed: new Date('2024-01-02')
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'listWorkspaces')
        .mockResolvedValue([workspace1, workspace2]);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(workspace2);

      await workspaceMultiCommands.listWorkspaces({});

      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Check that workspace-2 appears before workspace-1 (sorted by last accessed)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const workspace2Index = calls.findIndex(c => c.includes('workspace-2'));
      const workspace1Index = calls.findIndex(c => c.includes('workspace-1'));
      expect(workspace2Index).toBeLessThan(workspace1Index);
    });

    test('should show message when no workspaces registered', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'listWorkspaces')
        .mockResolvedValue([]);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.listWorkspaces({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No workspaces registered')
      );
    });

    test('should indicate active workspace', async () => {
      const workspace1 = {
        name: 'workspace-1',
        path: '/path/to/workspace-1',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'listWorkspaces')
        .mockResolvedValue([workspace1]);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(workspace1);

      await workspaceMultiCommands.listWorkspaces({});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasActiveIndicator = calls.some(c => c.includes('Active'));
      expect(hasActiveIndicator).toBe(true);
    });
  });

  describe('switchWorkspace', () => {
    test('should switch to existing workspace', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'switchWorkspace')
        .mockResolvedValue(undefined);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);

      await workspaceMultiCommands.switchWorkspace('test-workspace', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
        expect.stringContaining('test-workspace')
      );
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'switchWorkspace')
        .mockRejectedValue(new Error('Workspace not found'));

      await expect(async () => {
        await workspaceMultiCommands.switchWorkspace('non-existent', {});
      }).rejects.toThrow('process.exit(1)');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.stringContaining('Workspace not found')
      );
    });
  });

  describe('removeWorkspace', () => {
    test('should require confirmation without --force', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);

      await workspaceMultiCommands.removeWorkspace('test-workspace', {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('--force')
      );
    });

    test('should remove workspace with --force', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'removeWorkspace')
        .mockResolvedValue(undefined);

      await workspaceMultiCommands.removeWorkspace('test-workspace', { force: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅'),
        expect.stringContaining('test-workspace')
      );
    });

    test('should clear active workspace if removing active one', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(workspace);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'removeWorkspace')
        .mockResolvedValue(undefined);

      await workspaceMultiCommands.removeWorkspace('test-workspace', { force: true });

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasActiveNote = calls.some(c => c.includes('active workspace'));
      expect(hasActiveNote).toBe(true);
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(null);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await expect(async () => {
        await workspaceMultiCommands.removeWorkspace('non-existent', { force: true });
      }).rejects.toThrow('process.exit(1)');

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasErrorMessage = calls.some(c => c.includes('❌') && c.includes('not found'));
      expect(hasErrorMessage).toBe(true);
    });
  });

  describe('infoWorkspace', () => {
    test('should display info for specified workspace', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace('test-workspace', {});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasNameDisplay = calls.some(c => c.includes('test-workspace'));
      expect(hasNameDisplay).toBe(true);
    });

    test('should use active workspace when no name provided', async () => {
      const workspace = {
        name: 'active-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(workspace);

      await workspaceMultiCommands.infoWorkspace(null, {});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasNameDisplay = calls.some(c => c.includes('Name:'));
      expect(hasNameDisplay).toBe(true);
    });

    test('should show message when no active workspace and no name provided', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace(null, {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
    });

    test('should count Specs in workspace', async () => {
      const workspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(workspace);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace('test-workspace', {});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasSpecCount = calls.some(c => c.includes('Specs:'));
      expect(hasSpecCount).toBe(true);
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceStateManager.prototype, 'getWorkspace')
        .mockResolvedValue(null);
      
      jest.spyOn(WorkspaceStateManager.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await expect(async () => {
        await workspaceMultiCommands.infoWorkspace('non-existent', {});
      }).rejects.toThrow('process.exit(1)');

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasErrorMessage = calls.some(c => c.includes('❌') && c.includes('not found'));
      expect(hasErrorMessage).toBe(true);
    });
  });
});
