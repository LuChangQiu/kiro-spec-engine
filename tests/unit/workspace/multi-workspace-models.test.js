/**
 * Unit tests for multi-workspace management data models
 * 
 * Tests Workspace, WorkspaceRegistry, and GlobalConfig classes
 * Validates serialization, deserialization, and basic operations
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { Workspace, WorkspaceRegistry, GlobalConfig } = require('../../../lib/workspace/multi');

describe('Workspace Data Model', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create a workspace with required fields', () => {
      const workspace = new Workspace('test-project', '/home/user/projects/test');
      
      expect(workspace.name).toBe('test-project');
      expect(workspace.path).toBe('/home/user/projects/test');
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.lastAccessed).toBeInstanceOf(Date);
    });

    it('should normalize paths with forward slashes', () => {
      const workspace = new Workspace('test', 'C:\\Users\\test\\project');
      
      expect(workspace.path).toBe('C:/Users/test/project');
      expect(workspace.path).not.toContain('\\');
    });

    it('should convert relative paths to absolute', () => {
      const workspace = new Workspace('test', './relative/path');
      
      expect(path.isAbsolute(workspace.path)).toBe(true);
    });

    it('should accept custom timestamps', () => {
      const created = new Date('2024-01-01T00:00:00Z');
      const accessed = new Date('2024-01-02T00:00:00Z');
      
      const workspace = new Workspace('test', '/path', created, accessed);
      
      expect(workspace.createdAt).toEqual(created);
      expect(workspace.lastAccessed).toEqual(accessed);
    });
  });

  describe('Path Operations', () => {
    it('should return platform-specific path', () => {
      const workspace = new Workspace('test', '/home/user/project');
      const platformPath = workspace.getPlatformPath();
      
      // On Windows, should have backslashes; on Unix, forward slashes
      if (process.platform === 'win32') {
        expect(platformPath).toContain('\\');
      } else {
        expect(platformPath).toBe('/home/user/project');
      }
    });

    it('should detect if path is contained in workspace', () => {
      const workspace = new Workspace('test', '/home/user/project');
      
      expect(workspace.containsPath('/home/user/project')).toBe(true);
      expect(workspace.containsPath('/home/user/project/subdir')).toBe(true);
      expect(workspace.containsPath('/home/user/other')).toBe(false);
    });

    it('should handle Windows paths in containsPath', () => {
      const workspace = new Workspace('test', 'C:/Users/test/project');
      
      expect(workspace.containsPath('C:\\Users\\test\\project')).toBe(true);
      expect(workspace.containsPath('C:\\Users\\test\\project\\subdir')).toBe(true);
    });
  });

  describe('Serialization', () => {
    it('should serialize to dictionary', () => {
      const workspace = new Workspace('test', '/home/user/project');
      const dict = workspace.toDict();
      
      expect(dict).toHaveProperty('name', 'test');
      expect(dict).toHaveProperty('path', '/home/user/project');
      expect(dict).toHaveProperty('createdAt');
      expect(dict).toHaveProperty('lastAccessed');
      expect(typeof dict.createdAt).toBe('string');
      expect(typeof dict.lastAccessed).toBe('string');
    });

    it('should deserialize from dictionary', () => {
      const dict = {
        name: 'test',
        path: '/home/user/project',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastAccessed: '2024-01-02T00:00:00.000Z'
      };
      
      const workspace = Workspace.fromDict(dict);
      
      expect(workspace.name).toBe('test');
      expect(workspace.path).toBe('/home/user/project');
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.lastAccessed).toBeInstanceOf(Date);
    });

    it('should round-trip serialize and deserialize', () => {
      const original = new Workspace('test', '/home/user/project');
      const dict = original.toDict();
      const restored = Workspace.fromDict(dict);
      
      expect(restored.name).toBe(original.name);
      expect(restored.path).toBe(original.path);
      expect(restored.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(restored.lastAccessed.getTime()).toBe(original.lastAccessed.getTime());
    });
  });

  describe('Timestamp Management', () => {
    it('should update last accessed timestamp', () => {
      const workspace = new Workspace('test', '/path');
      const originalTime = workspace.lastAccessed.getTime();
      
      // Wait a bit to ensure time difference
      setTimeout(() => {
        workspace.updateLastAccessed();
        expect(workspace.lastAccessed.getTime()).toBeGreaterThan(originalTime);
      }, 10);
    });
  });

  describe('String Representation', () => {
    it('should provide readable string representation', () => {
      const workspace = new Workspace('test-project', '/home/user/project');
      const str = workspace.toString();
      
      expect(str).toContain('test-project');
      expect(str).toContain('/home/user/project');
    });
  });
});

describe('WorkspaceRegistry', () => {
  let tempDir;
  let registry;

  beforeEach(async () => {
    // Create temporary directory for test config
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-test-'));
    const configPath = path.join(tempDir, 'workspaces.json');
    registry = new WorkspaceRegistry(configPath);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('Initialization', () => {
    it('should initialize with empty registry', async () => {
      await registry.load();
      const workspaces = await registry.listWorkspaces();
      
      expect(workspaces).toEqual([]);
      expect(await registry.count()).toBe(0);
    });

    it('should use default config path if not specified', () => {
      const defaultRegistry = new WorkspaceRegistry();
      const homeDir = os.homedir();
      // Updated: Now uses workspace-state.json (single source of truth)
      const expectedPath = path.join(homeDir, '.kse', 'workspace-state.json');
      
      expect(defaultRegistry.configPath).toBe(expectedPath);
    });
  });

  describe('Workspace Creation', () => {
    it('should reject empty workspace name', async () => {
      await expect(registry.createWorkspace('', '/path')).rejects.toThrow('cannot be empty');
    });

    it('should reject invalid workspace path', async () => {
      await expect(registry.createWorkspace('test', '/nonexistent/path')).rejects.toThrow('not a valid kse project');
    });

    it('should create workspace with valid path', async () => {
      // Create a mock kse project directory
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      
      const workspace = await registry.createWorkspace('test', projectPath);
      
      expect(workspace).toBeInstanceOf(Workspace);
      expect(workspace.name).toBe('test');
      expect(workspace.path).toContain('test-project');
    });

    it('should reject duplicate workspace names', async () => {
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      
      await registry.createWorkspace('test', projectPath);
      
      await expect(registry.createWorkspace('test', projectPath)).rejects.toThrow('already exists');
    });

    it('should persist workspace to disk', async () => {
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      
      await registry.createWorkspace('test', projectPath);
      
      // Verify file was created
      const configExists = await fs.pathExists(registry.configPath);
      expect(configExists).toBe(true);
      
      // Verify content
      const content = await fs.readFile(registry.configPath, 'utf8');
      const data = JSON.parse(content);
      expect(data.workspaces).toHaveLength(1);
      expect(data.workspaces[0].name).toBe('test');
    });
  });

  describe('Workspace Retrieval', () => {
    beforeEach(async () => {
      // Create test workspaces
      const project1 = path.join(tempDir, 'project1');
      const project2 = path.join(tempDir, 'project2');
      await fs.ensureDir(path.join(project1, '.kiro'));
      await fs.ensureDir(path.join(project2, '.kiro'));
      
      await registry.createWorkspace('proj1', project1);
      await registry.createWorkspace('proj2', project2);
    });

    it('should get workspace by name', async () => {
      const workspace = await registry.getWorkspace('proj1');
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('proj1');
    });

    it('should return null for non-existent workspace', async () => {
      const workspace = await registry.getWorkspace('nonexistent');
      
      expect(workspace).toBeNull();
    });

    it('should list all workspaces', async () => {
      const workspaces = await registry.listWorkspaces();
      
      expect(workspaces).toHaveLength(2);
      expect(workspaces.map(w => w.name)).toContain('proj1');
      expect(workspaces.map(w => w.name)).toContain('proj2');
    });

    it('should check if workspace exists', async () => {
      expect(await registry.hasWorkspace('proj1')).toBe(true);
      expect(await registry.hasWorkspace('nonexistent')).toBe(false);
    });

    it('should find workspace by path', async () => {
      const project1 = path.join(tempDir, 'project1');
      const subPath = path.join(project1, 'subdir', 'file.txt');
      
      const workspace = await registry.findWorkspaceByPath(subPath);
      
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('proj1');
    });
  });

  describe('Workspace Removal', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      await registry.createWorkspace('test', projectPath);
    });

    it('should remove workspace from registry', async () => {
      const removed = await registry.removeWorkspace('test');
      
      expect(removed).toBe(true);
      expect(await registry.hasWorkspace('test')).toBe(false);
      expect(await registry.count()).toBe(0);
    });

    it('should return false for non-existent workspace', async () => {
      const removed = await registry.removeWorkspace('nonexistent');
      
      expect(removed).toBe(false);
    });

    it('should persist removal to disk', async () => {
      await registry.removeWorkspace('test');
      
      const content = await fs.readFile(registry.configPath, 'utf8');
      const data = JSON.parse(content);
      expect(data.workspaces).toHaveLength(0);
    });
  });

  describe('Timestamp Updates', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      await registry.createWorkspace('test', projectPath);
    });

    it('should update last accessed timestamp', async () => {
      const workspace = await registry.getWorkspace('test');
      const originalTime = workspace.lastAccessed.getTime();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await registry.updateLastAccessed('test');
      
      const updated = await registry.getWorkspace('test');
      expect(updated.lastAccessed.getTime()).toBeGreaterThan(originalTime);
    });

    it('should return false for non-existent workspace', async () => {
      const result = await registry.updateLastAccessed('nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('Persistence and Loading', () => {
    it('should load existing configuration', async () => {
      // Create a workspace
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      await registry.createWorkspace('test', projectPath);
      
      // Create new registry instance and load
      const newRegistry = new WorkspaceRegistry(registry.configPath);
      await newRegistry.load();
      
      const workspace = await newRegistry.getWorkspace('test');
      expect(workspace).not.toBeNull();
      expect(workspace.name).toBe('test');
    });

    it('should handle corrupted configuration file', async () => {
      // Write invalid JSON
      await fs.writeFile(registry.configPath, 'invalid json{', 'utf8');
      
      await expect(registry.load()).rejects.toThrow('corrupted');
    });
  });

  describe('Path Validation', () => {
    it('should validate existing kse project', async () => {
      const projectPath = path.join(tempDir, 'valid-project');
      await fs.ensureDir(path.join(projectPath, '.kiro'));
      
      const isValid = await registry.validateWorkspacePath(projectPath);
      
      expect(isValid).toBe(true);
    });

    it('should reject non-existent path', async () => {
      const isValid = await registry.validateWorkspacePath('/nonexistent/path');
      
      expect(isValid).toBe(false);
    });

    it('should reject path without .kiro directory', async () => {
      const projectPath = path.join(tempDir, 'invalid-project');
      await fs.ensureDir(projectPath);
      
      const isValid = await registry.validateWorkspacePath(projectPath);
      
      expect(isValid).toBe(false);
    });

    it('should reject file path (not directory)', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      await fs.writeFile(filePath, 'content', 'utf8');
      
      const isValid = await registry.validateWorkspacePath(filePath);
      
      expect(isValid).toBe(false);
    });
  });
});

describe('GlobalConfig', () => {
  let tempDir;
  let config;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-test-'));
    const configPath = path.join(tempDir, 'config.json');
    config = new GlobalConfig(configPath);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Initialization', () => {
    it('should initialize with default values', async () => {
      await config.load();
      
      expect(await config.getActiveWorkspace()).toBeNull();
      const prefs = await config.getPreferences();
      expect(prefs.autoDetectWorkspace).toBe(true);
      expect(prefs.confirmDestructiveOperations).toBe(true);
    });

    it('should use default config path if not specified', () => {
      const defaultConfig = new GlobalConfig();
      const homeDir = os.homedir();
      // Updated: Now uses workspace-state.json (single source of truth)
      const expectedPath = path.join(homeDir, '.kse', 'workspace-state.json');
      
      expect(defaultConfig.configPath).toBe(expectedPath);
    });
  });

  describe('Active Workspace Management', () => {
    it('should set active workspace', async () => {
      await config.setActiveWorkspace('test-workspace');
      
      expect(await config.getActiveWorkspace()).toBe('test-workspace');
    });

    it('should clear active workspace', async () => {
      await config.setActiveWorkspace('test-workspace');
      await config.clearActiveWorkspace();
      
      expect(await config.getActiveWorkspace()).toBeNull();
    });

    it('should persist active workspace to disk', async () => {
      await config.setActiveWorkspace('test-workspace');
      
      const content = await fs.readFile(config.configPath, 'utf8');
      const data = JSON.parse(content);
      // Updated: New format uses activeWorkspace (camelCase)
      expect(data.activeWorkspace).toBe('test-workspace');
    });
  });

  describe('Preferences Management', () => {
    it('should get preference value', async () => {
      await config.load();
      
      const autoDetect = await config.getPreference('autoDetectWorkspace');
      expect(autoDetect).toBe(true);
    });

    it('should set preference value', async () => {
      await config.setPreference('autoDetectWorkspace', false);
      
      const value = await config.getPreference('autoDetectWorkspace');
      expect(value).toBe(false);
    });

    it('should get all preferences', async () => {
      await config.load();
      
      const prefs = await config.getPreferences();
      expect(prefs).toHaveProperty('autoDetectWorkspace');
      expect(prefs).toHaveProperty('confirmDestructiveOperations');
    });

    it('should persist preferences to disk', async () => {
      await config.setPreference('autoDetectWorkspace', false);
      
      const content = await fs.readFile(config.configPath, 'utf8');
      const data = JSON.parse(content);
      // Updated: New format uses camelCase
      expect(data.preferences.autoDetectWorkspace).toBe(false);
    });
  });

  describe('Persistence and Loading', () => {
    it('should load existing configuration', async () => {
      await config.setActiveWorkspace('test');
      await config.setPreference('autoDetectWorkspace', false);
      
      // Create new config instance and load
      const newConfig = new GlobalConfig(config.configPath);
      await newConfig.load();
      
      expect(await newConfig.getActiveWorkspace()).toBe('test');
      expect(await newConfig.getPreference('autoDetectWorkspace')).toBe(false);
    });

    it('should handle corrupted configuration file', async () => {
      await fs.writeFile(config.configPath, 'invalid json{', 'utf8');
      
      await expect(config.load()).rejects.toThrow('corrupted');
    });

    it('should create config directory if missing', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'config.json');
      const nestedConfig = new GlobalConfig(nestedPath);
      
      await nestedConfig.setActiveWorkspace('test');
      
      const exists = await fs.pathExists(nestedPath);
      expect(exists).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to default values', async () => {
      await config.setActiveWorkspace('test');
      await config.setPreference('autoDetectWorkspace', false);
      
      await config.reset();
      
      expect(await config.getActiveWorkspace()).toBeNull();
      const prefs = await config.getPreferences();
      expect(prefs.autoDetectWorkspace).toBe(true);
      expect(prefs.confirmDestructiveOperations).toBe(true);
    });
  });
});
