/**
 * Unit Tests for Multi-Workspace Management Commands
 * 
 * Tests the CLI command handlers for workspace management.
 */

const workspaceMultiCommands = require('../../../lib/commands/workspace-multi');
const WorkspaceRegistry = require('../../../lib/workspace/multi/workspace-registry');
const GlobalConfig = require('../../../lib/workspace/multi/global-config');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock console methods
let consoleLogSpy;
let consoleErrorSpy;
let processExitSpy;

describe('Multi-Workspace Commands', () => {
  let testDir;
  let configPath;
  let workspacesPath;
  let testWorkspacePath;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `kse-test-${Date.now()}`);
    await fs.ensureDir(testDir);

    // Set up test paths
    configPath = path.join(testDir, 'config.json');
    workspacesPath = path.join(testDir, 'workspaces.json');

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
      // Mock registry
      const mockRegistry = {
        createWorkspace: jest.fn().mockResolvedValue({
          name: 'test-workspace',
          path: testWorkspacePath,
          createdAt: new Date(),
          lastAccessed: new Date()
        })
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'createWorkspace')
        .mockImplementation(mockRegistry.createWorkspace);

      await workspaceMultiCommands.createWorkspace('test-workspace', {
        path: testWorkspacePath
      });

      expect(mockRegistry.createWorkspace).toHaveBeenCalledWith(
        'test-workspace',
        testWorkspacePath
      );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('should use current directory when no path provided', async () => {
      const currentDir = process.cwd();
      
      const mockRegistry = {
        createWorkspace: jest.fn().mockResolvedValue({
          name: 'test-workspace',
          path: currentDir,
          createdAt: new Date(),
          lastAccessed: new Date()
        })
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'createWorkspace')
        .mockImplementation(mockRegistry.createWorkspace);

      await workspaceMultiCommands.createWorkspace('test-workspace', {});

      expect(mockRegistry.createWorkspace).toHaveBeenCalledWith(
        'test-workspace',
        currentDir
      );
    });

    test('should handle creation errors', async () => {
      jest.spyOn(WorkspaceRegistry.prototype, 'createWorkspace')
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
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour ago

      const mockWorkspaces = [
        {
          name: 'workspace-1',
          path: '/path/to/workspace-1',
          createdAt: earlier,
          lastAccessed: earlier
        },
        {
          name: 'workspace-2',
          path: '/path/to/workspace-2',
          createdAt: now,
          lastAccessed: now
        }
      ];

      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue(mockWorkspaces);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue('workspace-2');

      await workspaceMultiCommands.listWorkspaces({});

      expect(consoleLogSpy).toHaveBeenCalled();
      // Verify workspace-2 appears before workspace-1 (sorted by last accessed)
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const workspace2Index = calls.findIndex(c => c.includes('workspace-2'));
      const workspace1Index = calls.findIndex(c => c.includes('workspace-1'));
      expect(workspace2Index).toBeLessThan(workspace1Index);
    });

    test('should show message when no workspaces registered', async () => {
      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await workspaceMultiCommands.listWorkspaces({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No workspaces registered')
      );
    });

    test('should indicate active workspace', async () => {
      const mockWorkspaces = [
        {
          name: 'active-workspace',
          path: '/path/to/active',
          createdAt: new Date(),
          lastAccessed: new Date()
        }
      ];

      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue(mockWorkspaces);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue('active-workspace');

      await workspaceMultiCommands.listWorkspaces({});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasActiveIndicator = calls.some(c => c.includes('Active'));
      expect(hasActiveIndicator).toBe(true);
    });
  });

  describe('switchWorkspace', () => {
    test('should switch to existing workspace', async () => {
      const mockWorkspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(GlobalConfig.prototype, 'setActiveWorkspace')
        .mockResolvedValue();
      jest.spyOn(WorkspaceRegistry.prototype, 'updateLastAccessed')
        .mockResolvedValue(true);

      await workspaceMultiCommands.switchWorkspace('test-workspace', {});

      // Check that success message was logged
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasSuccessMessage = calls.some(c => 
        c.includes('✅') && c.includes('test-workspace')
      );
      expect(hasSuccessMessage).toBe(true);
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(null);
      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await expect(async () => {
        await workspaceMultiCommands.switchWorkspace('non-existent', {});
      }).rejects.toThrow('process.exit(1)');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        expect.stringContaining('does not exist')
      );
    });
  });

  describe('removeWorkspace', () => {
    test('should require confirmation without --force', async () => {
      const mockWorkspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);

      await workspaceMultiCommands.removeWorkspace('test-workspace', {
        force: false
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('To confirm')
      );
    });

    test('should remove workspace with --force', async () => {
      const mockWorkspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(WorkspaceRegistry.prototype, 'removeWorkspace')
        .mockResolvedValue(true);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.removeWorkspace('test-workspace', {
        force: true
      });

      // Check that success message was logged
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasSuccessMessage = calls.some(c => 
        c.includes('✅') && c.includes('test-workspace')
      );
      expect(hasSuccessMessage).toBe(true);
    });

    test('should clear active workspace if removing active one', async () => {
      const mockWorkspace = {
        name: 'active-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(WorkspaceRegistry.prototype, 'removeWorkspace')
        .mockResolvedValue(true);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue('active-workspace');
      const clearSpy = jest.spyOn(GlobalConfig.prototype, 'clearActiveWorkspace')
        .mockResolvedValue();

      await workspaceMultiCommands.removeWorkspace('active-workspace', {
        force: true
      });

      expect(clearSpy).toHaveBeenCalled();
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(null);
      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await expect(async () => {
        await workspaceMultiCommands.removeWorkspace('non-existent', {
          force: true
        });
      }).rejects.toThrow('process.exit(1)');

      // Check that error message was logged
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasErrorMessage = calls.some(c => 
        c.includes('❌') && c.includes('non-existent')
      );
      expect(hasErrorMessage).toBe(true);
    });
  });

  describe('infoWorkspace', () => {
    test('should display info for specified workspace', async () => {
      const mockWorkspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace('test-workspace', {});

      // Check that workspace name was displayed
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasNameDisplay = calls.some(c => c.includes('Name:'));
      expect(hasNameDisplay).toBe(true);
    });

    test('should use active workspace when no name provided', async () => {
      const mockWorkspace = {
        name: 'active-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue('active-workspace');

      await workspaceMultiCommands.infoWorkspace(null, {});

      // Check that workspace name was displayed
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasNameDisplay = calls.some(c => c.includes('Name:'));
      expect(hasNameDisplay).toBe(true);
    });

    test('should show message when no active workspace and no name provided', async () => {
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace(null, {});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active workspace')
      );
    });

    test('should count Specs in workspace', async () => {
      // Create some test Spec directories
      const specsPath = path.join(testWorkspacePath, '.kiro', 'specs');
      await fs.ensureDir(path.join(specsPath, 'spec-1'));
      await fs.ensureDir(path.join(specsPath, 'spec-2'));
      await fs.writeFile(path.join(specsPath, 'not-a-spec.txt'), 'test');

      const mockWorkspace = {
        name: 'test-workspace',
        path: testWorkspacePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        getPlatformPath: () => testWorkspacePath
      };

      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(mockWorkspace);
      jest.spyOn(GlobalConfig.prototype, 'getActiveWorkspace')
        .mockResolvedValue(null);

      await workspaceMultiCommands.infoWorkspace('test-workspace', {});

      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const specsLine = calls.find(c => c.includes('Specs:'));
      expect(specsLine).toContain('2'); // Should count 2 directories
    });

    test('should handle non-existent workspace', async () => {
      jest.spyOn(WorkspaceRegistry.prototype, 'getWorkspace')
        .mockResolvedValue(null);
      jest.spyOn(WorkspaceRegistry.prototype, 'listWorkspaces')
        .mockResolvedValue([]);

      await expect(async () => {
        await workspaceMultiCommands.infoWorkspace('non-existent', {});
      }).rejects.toThrow('process.exit(1)');

      // Check that error message was logged
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const hasErrorMessage = calls.some(c => 
        c.includes('❌') && c.includes('non-existent')
      );
      expect(hasErrorMessage).toBe(true);
    });
  });
});
