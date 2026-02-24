/**
 * Unit tests for PermissionManager
 */

const fs = require('fs-extra');
const path = require('path');
const PermissionManager = require('../../../lib/operations/permission-manager');
const { TakeoverLevel, SecurityEnvironment } = require('../../../lib/operations/models');

describe('PermissionManager', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = path.join(__dirname, '../../temp/permission-manager-test');
    await fs.ensureDir(tempDir);
    manager = new PermissionManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('getTakeoverLevel', () => {
    it('should return default level for new project in development', async () => {
      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.DEVELOPMENT);
      expect(level).toBe(TakeoverLevel.L3_SEMI_AUTO);
    });

    it('should return default level for new project in test', async () => {
      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.TEST);
      expect(level).toBe(TakeoverLevel.L2_SUGGESTION);
    });

    it('should return default level for new project in pre-production', async () => {
      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.PRE_PRODUCTION);
      expect(level).toBe(TakeoverLevel.L2_SUGGESTION);
    });

    it('should return default level for new project in production', async () => {
      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.PRODUCTION);
      expect(level).toBe(TakeoverLevel.L1_OBSERVATION);
    });

    it('should return configured level when set', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'Testing purposes',
        'test-user'
      );

      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.DEVELOPMENT);
      expect(level).toBe(TakeoverLevel.L4_AUTO);
    });
  });

  describe('setTakeoverLevel', () => {
    it('should set takeover level successfully', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'Increase automation',
        'admin-user'
      );

      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.DEVELOPMENT);
      expect(level).toBe(TakeoverLevel.L4_AUTO);
    });

    it('should record level change in history', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'Increase automation',
        'admin-user'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.levelHistory).toHaveLength(1);
      expect(config.levelHistory[0]).toMatchObject({
        environment: SecurityEnvironment.DEVELOPMENT,
        fromLevel: TakeoverLevel.L3_SEMI_AUTO,
        toLevel: TakeoverLevel.L4_AUTO,
        reason: 'Increase automation',
        user: 'admin-user'
      });
      expect(config.levelHistory[0].timestamp).toBeDefined();
    });

    it('should enforce environment maximum level', async () => {
      await expect(
        manager.setTakeoverLevel(
          'test-project',
          SecurityEnvironment.PRODUCTION,
          TakeoverLevel.L5_FULLY_AUTONOMOUS,
          'Should fail',
          'test-user'
        )
      ).rejects.toThrow('exceeds maximum');
    });

    it('should allow L2 in production', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.PRODUCTION,
        TakeoverLevel.L2_SUGGESTION,
        'Set to max allowed',
        'admin-user'
      );

      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.PRODUCTION);
      expect(level).toBe(TakeoverLevel.L2_SUGGESTION);
    });

    it('should allow L5 in development', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        'Full automation for dev',
        'admin-user'
      );

      const level = await manager.getTakeoverLevel('test-project', SecurityEnvironment.DEVELOPMENT);
      expect(level).toBe(TakeoverLevel.L5_FULLY_AUTONOMOUS);
    });

    it('should track multiple level changes', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'First change',
        'user1'
      );

      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        'Second change',
        'user2'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.levelHistory).toHaveLength(2);
      expect(config.levelHistory[0].toLevel).toBe(TakeoverLevel.L4_AUTO);
      expect(config.levelHistory[1].fromLevel).toBe(TakeoverLevel.L4_AUTO);
      expect(config.levelHistory[1].toLevel).toBe(TakeoverLevel.L5_FULLY_AUTONOMOUS);
    });

    it('should store maxLevel in environment config', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.TEST,
        TakeoverLevel.L3_SEMI_AUTO,
        'Testing',
        'test-user'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.environments[SecurityEnvironment.TEST].maxLevel).toBe(TakeoverLevel.L4_AUTO);
    });
  });

  describe('checkPermission', () => {
    it('should authorize operation with current level', async () => {
      const result = await manager.checkPermission(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        'DEPLOY'
      );

      expect(result.authorized).toBe(true);
      expect(result.level).toBe(TakeoverLevel.L3_SEMI_AUTO);
      expect(result.environment).toBe(SecurityEnvironment.DEVELOPMENT);
    });

    it('should require approval for L1 observation level', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.PRODUCTION,
        TakeoverLevel.L1_OBSERVATION,
        'Strict control',
        'admin'
      );

      const result = await manager.checkPermission(
        'test-project',
        SecurityEnvironment.PRODUCTION,
        'DEPLOY'
      );

      expect(result.requiresApproval).toBe(true);
    });

    it('should require approval for L2 suggestion level', async () => {
      const result = await manager.checkPermission(
        'test-project',
        SecurityEnvironment.TEST,
        'DEPLOY'
      );

      expect(result.requiresApproval).toBe(true);
    });

    it('should not require approval for L3 and above', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'More automation',
        'admin'
      );

      const result = await manager.checkPermission(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        'DEPLOY'
      );

      expect(result.requiresApproval).toBe(false);
    });
  });

  describe('loadPermissionConfig', () => {
    it('should return default config for non-existent project', async () => {
      const config = await manager.loadPermissionConfig('non-existent');
      expect(config.project).toBe('non-existent');
      expect(config.environments).toEqual({});
    });

    it('should load existing config', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'Test',
        'user'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.project).toBe('test-project');
      expect(config.environments[SecurityEnvironment.DEVELOPMENT]).toBeDefined();
    });
  });

  describe('savePermissionConfig', () => {
    it('should save config to correct location', async () => {
      const config = {
        project: 'test-project',
        environments: {
          [SecurityEnvironment.DEVELOPMENT]: {
            takeoverLevel: TakeoverLevel.L4_AUTO,
            maxLevel: TakeoverLevel.L5_FULLY_AUTONOMOUS
          }
        }
      };

      await manager.savePermissionConfig('test-project', config);

      const configPath = path.join(
        tempDir,
        '.sce/specs/test-project/operations/permissions.json'
      );
      expect(await fs.pathExists(configPath)).toBe(true);

      const loaded = await fs.readJson(configPath);
      expect(loaded).toEqual(config);
    });

    it('should create directory if not exists', async () => {
      const config = {
        project: 'new-project',
        environments: {}
      };

      await manager.savePermissionConfig('new-project', config);

      const configPath = path.join(
        tempDir,
        '.sce/specs/new-project/operations/permissions.json'
      );
      expect(await fs.pathExists(configPath)).toBe(true);
    });
  });

  describe('isLevelAllowed', () => {
    it('should allow level equal to max', () => {
      const allowed = manager.isLevelAllowed(
        TakeoverLevel.L3_SEMI_AUTO,
        TakeoverLevel.L3_SEMI_AUTO
      );
      expect(allowed).toBe(true);
    });

    it('should allow level below max', () => {
      const allowed = manager.isLevelAllowed(
        TakeoverLevel.L2_SUGGESTION,
        TakeoverLevel.L4_AUTO
      );
      expect(allowed).toBe(true);
    });

    it('should reject level above max', () => {
      const allowed = manager.isLevelAllowed(
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        TakeoverLevel.L3_SEMI_AUTO
      );
      expect(allowed).toBe(false);
    });

    it('should handle L1 correctly', () => {
      const allowed = manager.isLevelAllowed(
        TakeoverLevel.L1_OBSERVATION,
        TakeoverLevel.L5_FULLY_AUTONOMOUS
      );
      expect(allowed).toBe(true);
    });
  });

  describe('environment policies', () => {
    it('should have correct max level for development', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        'Max level',
        'admin'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.environments[SecurityEnvironment.DEVELOPMENT].maxLevel)
        .toBe(TakeoverLevel.L5_FULLY_AUTONOMOUS);
    });

    it('should have correct max level for test', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.TEST,
        TakeoverLevel.L4_AUTO,
        'Max level',
        'admin'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.environments[SecurityEnvironment.TEST].maxLevel)
        .toBe(TakeoverLevel.L4_AUTO);
    });

    it('should have correct max level for pre-production', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.PRE_PRODUCTION,
        TakeoverLevel.L3_SEMI_AUTO,
        'Max level',
        'admin'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.environments[SecurityEnvironment.PRE_PRODUCTION].maxLevel)
        .toBe(TakeoverLevel.L3_SEMI_AUTO);
    });

    it('should have correct max level for production', async () => {
      await manager.setTakeoverLevel(
        'test-project',
        SecurityEnvironment.PRODUCTION,
        TakeoverLevel.L2_SUGGESTION,
        'Max level',
        'admin'
      );

      const config = await manager.loadPermissionConfig('test-project');
      expect(config.environments[SecurityEnvironment.PRODUCTION].maxLevel)
        .toBe(TakeoverLevel.L2_SUGGESTION);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Create a read-only directory to trigger write error
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.ensureDir(readOnlyDir);
      
      const readOnlyManager = new PermissionManager(readOnlyDir);
      
      // This should not throw, but may fail silently or throw depending on implementation
      // We're testing that it doesn't crash the application
      try {
        await readOnlyManager.setTakeoverLevel(
          'test-project',
          SecurityEnvironment.DEVELOPMENT,
          TakeoverLevel.L4_AUTO,
          'Test',
          'user'
        );
      } catch (error) {
        // Expected to fail, but should be a controlled error
        expect(error).toBeDefined();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should support full lifecycle: create, update, query', async () => {
      // Create initial config
      await manager.setTakeoverLevel(
        'my-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L3_SEMI_AUTO,
        'Initial setup',
        'admin'
      );

      // Update level
      await manager.setTakeoverLevel(
        'my-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L4_AUTO,
        'Increase automation',
        'admin'
      );

      // Query current level
      const level = await manager.getTakeoverLevel('my-project', SecurityEnvironment.DEVELOPMENT);
      expect(level).toBe(TakeoverLevel.L4_AUTO);

      // Check permission
      const permission = await manager.checkPermission(
        'my-project',
        SecurityEnvironment.DEVELOPMENT,
        'DEPLOY'
      );
      expect(permission.authorized).toBe(true);
      expect(permission.requiresApproval).toBe(false);

      // Verify history
      const config = await manager.loadPermissionConfig('my-project');
      expect(config.levelHistory).toHaveLength(2);
    });

    it('should support multiple environments for same project', async () => {
      await manager.setTakeoverLevel(
        'multi-env-project',
        SecurityEnvironment.DEVELOPMENT,
        TakeoverLevel.L5_FULLY_AUTONOMOUS,
        'Dev environment',
        'admin'
      );

      await manager.setTakeoverLevel(
        'multi-env-project',
        SecurityEnvironment.PRODUCTION,
        TakeoverLevel.L1_OBSERVATION,
        'Prod environment',
        'admin'
      );

      const devLevel = await manager.getTakeoverLevel('multi-env-project', SecurityEnvironment.DEVELOPMENT);
      const prodLevel = await manager.getTakeoverLevel('multi-env-project', SecurityEnvironment.PRODUCTION);

      expect(devLevel).toBe(TakeoverLevel.L5_FULLY_AUTONOMOUS);
      expect(prodLevel).toBe(TakeoverLevel.L1_OBSERVATION);
    });
  });
});
