const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { GlobalConfig, WorkspaceRegistry } = require('../../../lib/workspace/multi');

describe('Configuration Directory Auto-Creation', () => {
  let tempDir;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `kse-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('GlobalConfig', () => {
    it('should auto-create config directory on save', async () => {
      const configPath = path.join(tempDir, 'non-existent', 'config.json');
      const config = new GlobalConfig(configPath);

      // Directory should not exist yet
      const configDir = path.dirname(configPath);
      expect(await fs.pathExists(configDir)).toBe(false);

      // Save should create the directory
      await config.setActiveWorkspace('test-workspace');

      // Directory should now exist
      expect(await fs.pathExists(configDir)).toBe(true);
      expect(await fs.pathExists(configPath)).toBe(true);
    });

    it('should auto-create nested directories', async () => {
      const configPath = path.join(tempDir, 'level1', 'level2', 'level3', 'config.json');
      const config = new GlobalConfig(configPath);

      await config.setActiveWorkspace('test-workspace');

      // All nested directories should be created
      expect(await fs.pathExists(path.join(tempDir, 'level1'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'level1', 'level2'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'level1', 'level2', 'level3'))).toBe(true);
      expect(await fs.pathExists(configPath)).toBe(true);
    });

    it('should work when directory already exists', async () => {
      const configDir = path.join(tempDir, 'existing');
      await fs.ensureDir(configDir);

      const configPath = path.join(configDir, 'config.json');
      const config = new GlobalConfig(configPath);

      await config.setActiveWorkspace('test-workspace');

      expect(await fs.pathExists(configPath)).toBe(true);
    });

    it('should initialize default config on first use', async () => {
      const configPath = path.join(tempDir, 'new-config', 'config.json');
      const config = new GlobalConfig(configPath);

      // Load should work even if file doesn't exist
      await config.load();
      expect(config.loaded).toBe(true);
      expect(config.activeWorkspace).toBeNull();

      // Save should create file with defaults
      await config.save();
      expect(await fs.pathExists(configPath)).toBe(true);

      // Verify content
      const content = await fs.readFile(configPath, 'utf8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0');
      expect(data.active_workspace).toBeNull();
      expect(data.preferences).toBeDefined();
    });
  });

  describe('WorkspaceRegistry', () => {
    it('should auto-create config directory on save', async () => {
      const registryPath = path.join(tempDir, 'non-existent', 'workspaces.json');
      const registry = new WorkspaceRegistry(registryPath);

      // Directory should not exist yet
      const registryDir = path.dirname(registryPath);
      expect(await fs.pathExists(registryDir)).toBe(false);

      // Create a valid kse project directory
      const projectDir = path.join(tempDir, 'test-project');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      // Create workspace should trigger save and create directory
      await registry.createWorkspace('test-ws', projectDir);

      // Directory should now exist
      expect(await fs.pathExists(registryDir)).toBe(true);
      expect(await fs.pathExists(registryPath)).toBe(true);
    });

    it('should auto-create nested directories', async () => {
      const registryPath = path.join(tempDir, 'level1', 'level2', 'workspaces.json');
      const registry = new WorkspaceRegistry(registryPath);

      // Create a valid kse project directory
      const projectDir = path.join(tempDir, 'test-project2');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      await registry.createWorkspace('test-ws', projectDir);

      // All nested directories should be created
      expect(await fs.pathExists(path.join(tempDir, 'level1'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, 'level1', 'level2'))).toBe(true);
      expect(await fs.pathExists(registryPath)).toBe(true);
    });

    it('should work when directory already exists', async () => {
      const registryDir = path.join(tempDir, 'existing');
      await fs.ensureDir(registryDir);

      const registryPath = path.join(registryDir, 'workspaces.json');
      const registry = new WorkspaceRegistry(registryPath);

      // Create a valid kse project directory
      const projectDir = path.join(tempDir, 'test-project3');
      await fs.ensureDir(path.join(projectDir, '.kiro'));

      await registry.createWorkspace('test-ws', projectDir);

      expect(await fs.pathExists(registryPath)).toBe(true);
    });

    it('should initialize empty registry on first use', async () => {
      const registryPath = path.join(tempDir, 'new-registry', 'workspaces.json');
      const registry = new WorkspaceRegistry(registryPath);

      // Load should work even if file doesn't exist
      await registry.load();
      expect(registry.loaded).toBe(true);
      expect(registry.workspaces.size).toBe(0);

      // Save should create file with empty registry
      await registry.save();
      expect(await fs.pathExists(registryPath)).toBe(true);

      // Verify content
      const content = await fs.readFile(registryPath, 'utf8');
      const data = JSON.parse(content);
      expect(data.version).toBe('1.0');
      expect(data.workspaces).toEqual([]);
    });
  });

  describe('Default paths', () => {
    it('GlobalConfig should use ~/.kse/config.json by default', () => {
      const config = new GlobalConfig();
      const expectedPath = path.join(os.homedir(), '.kse', 'config.json');
      expect(config.configPath).toBe(expectedPath);
    });

    it('WorkspaceRegistry should use ~/.kse/workspaces.json by default', () => {
      const registry = new WorkspaceRegistry();
      const expectedPath = path.join(os.homedir(), '.kse', 'workspaces.json');
      expect(registry.configPath).toBe(expectedPath);
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

      const configPath = path.join(readOnlyDir, 'subdir', 'config.json');
      const config = new GlobalConfig(configPath);

      await expect(config.setActiveWorkspace('test')).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(readOnlyDir, 0o755);
    });
  });
});
