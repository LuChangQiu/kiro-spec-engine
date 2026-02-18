/**
 * Tests for Adoption System
 */

const DetectionEngine = require('../../lib/adoption/detection-engine');
const VersionManager = require('../../lib/version/version-manager');
const { getAdoptionStrategy } = require('../../lib/adoption/adoption-strategy');

describe('Adoption System', () => {
  describe('DetectionEngine', () => {
    test('should create DetectionEngine instance', () => {
      const engine = new DetectionEngine();
      expect(engine).toBeDefined();
      expect(engine.kiroDir).toBe('.kiro');
    });

    test('should determine fresh adoption mode', () => {
      const engine = new DetectionEngine();
      const result = {
        hasKiroDir: false,
        hasVersionFile: false,
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      };
      
      const mode = engine.determineStrategy(result);
      expect(mode).toBe('fresh');
    });

    test('should determine partial adoption mode', () => {
      const engine = new DetectionEngine();
      const result = {
        hasKiroDir: true,
        hasVersionFile: false,
        hasSpecs: true,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      };
      
      const mode = engine.determineStrategy(result);
      expect(mode).toBe('partial');
    });

    test('should determine full adoption mode', () => {
      const engine = new DetectionEngine();
      const result = {
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      };
      
      const mode = engine.determineStrategy(result);
      expect(mode).toBe('full');
    });
  });

  describe('VersionManager', () => {
    test('should create VersionManager instance', () => {
      const manager = new VersionManager();
      expect(manager).toBeDefined();
      expect(manager.versionFileName).toBe('version.json');
    });

    test('should create valid version info', () => {
      const manager = new VersionManager();
      const versionInfo = manager.createVersionInfo('1.2.0');
      
      expect(versionInfo).toBeDefined();
      expect(versionInfo['sce-version']).toBe('1.2.0');
      expect(versionInfo['template-version']).toBe('1.2.0');
      expect(versionInfo['created']).toBeDefined();
      expect(versionInfo['last-upgraded']).toBeDefined();
      expect(versionInfo['upgrade-history']).toEqual([]);
    });

    test('should validate version info structure', () => {
      const manager = new VersionManager();
      const validInfo = {
        'sce-version': '1.0.0',
        'template-version': '1.0.0',
        'created': '2026-01-23T10:00:00Z',
        'last-upgraded': '2026-01-23T10:00:00Z',
        'upgrade-history': []
      };
      
      expect(manager.isValidVersionInfo(validInfo)).toBe(true);
    });

    test('should detect invalid version info', () => {
      const manager = new VersionManager();
      const invalidInfo = {
        'sce-version': '1.0.0'
        // Missing required fields
      };
      
      expect(manager.isValidVersionInfo(invalidInfo)).toBe(false);
    });

    test('should check if upgrade is needed', () => {
      const manager = new VersionManager();
      
      expect(manager.needsUpgrade('1.0.0', '1.2.0')).toBe(true);
      expect(manager.needsUpgrade('1.2.0', '1.0.0')).toBe(false);
      expect(manager.needsUpgrade('1.2.0', '1.2.0')).toBe(false);
    });

    test('should calculate upgrade path', () => {
      const manager = new VersionManager();
      const path = manager.calculateUpgradePath('1.0.0', '1.2.0');
      
      expect(path).toEqual(['1.0.0', '1.1.0', '1.2.0']);
    });

    test('should check compatibility', () => {
      const manager = new VersionManager();
      
      // Same version - always compatible
      const result1 = manager.checkCompatibility('1.0.0', '1.0.0');
      expect(result1.compatible).toBe(true);
      expect(result1.breaking).toBe(false);
      
      // Compatible versions
      const result2 = manager.checkCompatibility('1.0.0', '1.1.0');
      expect(result2.compatible).toBe(true);
    });

    test('should add upgrade history', () => {
      const manager = new VersionManager();
      const versionInfo = manager.createVersionInfo('1.0.0');
      
      const updated = manager.addUpgradeHistory(versionInfo, '1.0.0', '1.1.0', true);
      
      expect(updated['upgrade-history'].length).toBe(1);
      expect(updated['upgrade-history'][0].from).toBe('1.0.0');
      expect(updated['upgrade-history'][0].to).toBe('1.1.0');
      expect(updated['upgrade-history'][0].success).toBe(true);
      expect(updated['sce-version']).toBe('1.1.0');
    });
  });

  describe('AdoptionStrategy', () => {
    test('should get fresh adoption strategy', () => {
      const strategy = getAdoptionStrategy('fresh');
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('FreshAdoption');
    });

    test('should get partial adoption strategy', () => {
      const strategy = getAdoptionStrategy('partial');
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('PartialAdoption');
    });

    test('should get full adoption strategy', () => {
      const strategy = getAdoptionStrategy('full');
      expect(strategy).toBeDefined();
      expect(strategy.constructor.name).toBe('FullAdoption');
    });

    test('should throw error for unknown mode', () => {
      expect(() => getAdoptionStrategy('unknown')).toThrow();
    });
  });
});
