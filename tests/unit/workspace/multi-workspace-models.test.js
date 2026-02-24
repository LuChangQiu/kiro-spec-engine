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
  describe('Core Functionality', () => {
    it('should create workspace with required fields and normalize paths', () => {
      const inputPath = process.platform === 'win32' 
        ? 'C:\\Users\\test\\project' 
        : '/home/test/project';
      const workspace = new Workspace('test-project', inputPath);
      
      expect(workspace.name).toBe('test-project');
      expect(workspace.path).not.toContain('\\');
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.lastAccessed).toBeInstanceOf(Date);
      expect(path.isAbsolute(workspace.path)).toBe(true);
    });

    it('should handle path operations correctly', () => {
      const workspace = new Workspace('test', '/home/user/project');
      
      expect(workspace.containsPath('/home/user/project/subdir')).toBe(true);
      expect(workspace.containsPath('/home/user/other')).toBe(false);
      
      const platformPath = workspace.getPlatformPath();
      if (process.platform === 'win32') {
        expect(platformPath).toContain('\\');
      }
    });
  });

  describe('Serialization', () => {
    it('should round-trip serialize and deserialize', () => {
      const original = new Workspace('test', '/home/user/project');
      const dict = original.toDict();
      const restored = Workspace.fromDict(dict);
      
      expect(restored.name).toBe(original.name);
      expect(restored.path).toBe(original.path);
      expect(restored.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(typeof dict.createdAt).toBe('string');
    });
  });
});

describe('WorkspaceRegistry', () => {
  let tempDir;
  let registry;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-test-'));
    const configPath = path.join(tempDir, 'workspaces.json');
    registry = new WorkspaceRegistry(configPath);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('CRUD Operations', () => {
    it('should create, retrieve, and remove workspaces', async () => {
      await registry.load();
      expect(await registry.count()).toBe(0);
      
      // Create
      const projectPath = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectPath, '.sce'));
      const workspace = await registry.createWorkspace('test', projectPath);
      
      expect(workspace.name).toBe('test');
      expect(await registry.hasWorkspace('test')).toBe(true);
      
      // Retrieve
      const retrieved = await registry.getWorkspace('test');
      expect(retrieved.name).toBe('test');
      
      // Remove
      await registry.removeWorkspace('test');
      expect(await registry.hasWorkspace('test')).toBe(false);
    });

    it('should reject invalid inputs', async () => {
      await expect(registry.createWorkspace('', '/path')).rejects.toThrow('cannot be empty');
      await expect(registry.createWorkspace('test', '/nonexistent')).rejects.toThrow('not a valid sce project');
      
      const projectPath = path.join(tempDir, 'project');
      await fs.ensureDir(path.join(projectPath, '.sce'));
      await registry.createWorkspace('test', projectPath);
      await expect(registry.createWorkspace('test', projectPath)).rejects.toThrow('already exists');
    });

    it('should persist changes to disk', async () => {
      const projectPath = path.join(tempDir, 'project');
      await fs.ensureDir(path.join(projectPath, '.sce'));
      await registry.createWorkspace('test', projectPath);
      
      const newRegistry = new WorkspaceRegistry(registry.configPath);
      await newRegistry.load();
      expect(await newRegistry.getWorkspace('test')).not.toBeNull();
    });
  });

  describe('Path Operations', () => {
    it('should validate workspace paths', async () => {
      const validPath = path.join(tempDir, 'valid');
      await fs.ensureDir(path.join(validPath, '.sce'));
      expect(await registry.validateWorkspacePath(validPath)).toBe(true);
      
      const invalidPath = path.join(tempDir, 'invalid');
      await fs.ensureDir(invalidPath);
      expect(await registry.validateWorkspacePath(invalidPath)).toBe(false);
    });

    it('should find workspace by path', async () => {
      const projectPath = path.join(tempDir, 'project');
      await fs.ensureDir(path.join(projectPath, '.sce'));
      await registry.createWorkspace('test', projectPath);
      
      const subPath = path.join(projectPath, 'subdir', 'file.txt');
      const workspace = await registry.findWorkspaceByPath(subPath);
      expect(workspace.name).toBe('test');
    });
  });
});

describe('GlobalConfig', () => {
  let tempDir;
  let config;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-test-'));
    const configPath = path.join(tempDir, 'config.json');
    config = new GlobalConfig(configPath);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Active Workspace and Preferences', () => {
    it('should manage active workspace', async () => {
      await config.load();
      expect(await config.getActiveWorkspace()).toBeNull();
      
      await config.setActiveWorkspace('test-workspace');
      expect(await config.getActiveWorkspace()).toBe('test-workspace');
      
      await config.clearActiveWorkspace();
      expect(await config.getActiveWorkspace()).toBeNull();
    });

    it('should manage preferences', async () => {
      await config.load();
      
      const prefs = await config.getPreferences();
      expect(prefs.autoDetectWorkspace).toBe(true);
      
      await config.setPreference('autoDetectWorkspace', false);
      expect(await config.getPreference('autoDetectWorkspace')).toBe(false);
    });

    it('should persist changes to disk', async () => {
      await config.setActiveWorkspace('test');
      await config.setPreference('autoDetectWorkspace', false);
      
      const newConfig = new GlobalConfig(config.configPath);
      await newConfig.load();
      
      expect(await newConfig.getActiveWorkspace()).toBe('test');
      expect(await newConfig.getPreference('autoDetectWorkspace')).toBe(false);
    });

    it('should reset to defaults', async () => {
      await config.setActiveWorkspace('test');
      await config.setPreference('autoDetectWorkspace', false);
      await config.reset();
      
      expect(await config.getActiveWorkspace()).toBeNull();
      const prefs = await config.getPreferences();
      expect(prefs.autoDetectWorkspace).toBe(true);
    });
  });
});
