/**
 * Unit Tests for Strategy Selector
 */

const StrategySelector = require('../../../lib/adoption/strategy-selector');
const { AdoptionMode, ProjectState } = require('../../../lib/adoption/strategy-selector');
const VersionManager = require('../../../lib/version/version-manager');

// Mock dependencies
jest.mock('../../../lib/version/version-manager');

describe('StrategySelector', () => {
  let selector;
  let mockVersionManager;
  let mockFs;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock version manager
    mockVersionManager = {
      compareVersions: jest.fn(),
      readVersion: jest.fn()
    };

    // Setup mock fs
    mockFs = {
      pathExists: jest.fn()
    };

    // Create selector with injected dependencies
    selector = new StrategySelector({
      versionManager: mockVersionManager,
      fs: mockFs
    });
  });

  describe('ProjectState', () => {
    test('should create ProjectState with default values', () => {
      const state = new ProjectState();

      expect(state.hasKiroDir).toBe(false);
      expect(state.hasVersionFile).toBe(false);
      expect(state.currentVersion).toBeNull();
      expect(state.targetVersion).toBeNull();
      expect(state.hasSpecs).toBe(false);
      expect(state.hasSteering).toBe(false);
      expect(state.hasTools).toBe(false);
      expect(state.conflicts).toEqual([]);
      expect(state.versionComparison).toBeNull();
    });

    test('should create ProjectState with provided values', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        hasTools: false,
        conflicts: ['steering/CORE_PRINCIPLES.md'],
        versionComparison: -1
      });

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(true);
      expect(state.currentVersion).toBe('1.0.0');
      expect(state.targetVersion).toBe('1.8.0');
      expect(state.hasSpecs).toBe(true);
      expect(state.hasSteering).toBe(true);
      expect(state.hasTools).toBe(false);
      expect(state.conflicts).toEqual(['steering/CORE_PRINCIPLES.md']);
      expect(state.versionComparison).toBe(-1);
    });
  });

  describe('detectProjectState', () => {
    test('should detect fresh project (no .kiro/ directory)', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const state = await selector.detectProjectState('/test/project');

      expect(state.hasKiroDir).toBe(false);
      expect(state.hasVersionFile).toBe(false);
      expect(state.currentVersion).toBeNull();
      expect(state.hasSpecs).toBe(false);
      expect(state.hasSteering).toBe(false);
      expect(state.hasTools).toBe(false);
      expect(state.conflicts).toEqual([]);
      expect(state.targetVersion).toBeDefined();
    });

    test('should detect existing .kiro/ without version file', async () => {
      mockFs.pathExists.mockImplementation(async (path) => {
        if (path.includes('.kiro') && !path.includes('version.json')) {
          return true;
        }
        return false;
      });

      const state = await selector.detectProjectState('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(false);
      expect(state.currentVersion).toBeNull();
      expect(state.versionComparison).toBeNull();
    });

    test('should detect existing .kiro/ with version file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        'kse-version': '1.0.0'
      });
      mockVersionManager.compareVersions.mockReturnValue(-1);

      const state = await selector.detectProjectState('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(true);
      expect(state.currentVersion).toBe('1.0.0');
      expect(state.versionComparison).toBe(-1);
    });

    test('should detect specs directory', async () => {
      mockFs.pathExists.mockImplementation(async (path) => {
        return path.includes('.kiro');
      });

      const state = await selector.detectProjectState('/test/project');

      expect(state.hasSpecs).toBe(true);
      expect(state.hasSteering).toBe(true);
      expect(state.hasTools).toBe(true);
    });

    test('should detect conflicts (existing template files)', async () => {
      mockFs.pathExists.mockImplementation(async (path) => {
        if (path.includes('.kiro')) {
          return true;
        }
        return false;
      });

      const state = await selector.detectProjectState('/test/project');

      expect(state.conflicts.length).toBeGreaterThan(0);
      expect(state.conflicts).toContain('steering/CORE_PRINCIPLES.md');
      expect(state.conflicts).toContain('steering/ENVIRONMENT.md');
    });

    test('should handle corrupted version file gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockRejectedValue(
        new Error('Invalid JSON')
      );

      const state = await selector.detectProjectState('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(true);
      expect(state.currentVersion).toBeNull();
      expect(state.versionComparison).toBeNull();
    });

    test('should handle missing kse-version field', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        // Missing 'kse-version' field
        'some-other-field': 'value'
      });

      const state = await selector.detectProjectState('/test/project');

      expect(state.currentVersion).toBeNull();
      expect(state.versionComparison).toBeNull();
    });
  });

  describe('selectMode', () => {
    test('should select FRESH mode when no .kiro/ directory', () => {
      const state = new ProjectState({
        hasKiroDir: false
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.FRESH);
    });

    test('should select SMART_ADOPT mode when .kiro/ exists but no version file', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: false
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.SMART_ADOPT);
    });

    test('should select SMART_ADOPT mode when version file exists but no version', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: null
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.SMART_ADOPT);
    });

    test('should select SKIP mode when versions are equal', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.8.0',  // Must have currentVersion
        targetVersion: '1.8.0',
        versionComparison: 0
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.SKIP);
    });

    test('should select SMART_UPDATE mode when current version is older', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        versionComparison: -1
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.SMART_UPDATE);
    });

    test('should select WARNING mode when current version is newer', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '2.0.0',
        targetVersion: '1.8.0',
        versionComparison: 1
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.WARNING);
    });

    test('should select SMART_ADOPT mode when version comparison is null', () => {
      const state = new ProjectState({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        versionComparison: null
      });

      const mode = selector.selectMode(state);

      expect(mode).toBe(AdoptionMode.SMART_ADOPT);
    });
  });

  describe('detectAndSelect', () => {
    test('should detect state and select mode in one call', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await selector.detectAndSelect('/test/project');

      expect(result.state).toBeInstanceOf(ProjectState);
      expect(result.mode).toBe(AdoptionMode.FRESH);
    });

    test('should return correct mode for existing project', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        'kse-version': '1.0.0'
      });
      mockVersionManager.compareVersions.mockReturnValue(-1);

      const result = await selector.detectAndSelect('/test/project');

      expect(result.state.hasKiroDir).toBe(true);
      expect(result.state.currentVersion).toBe('1.0.0');
      expect(result.mode).toBe(AdoptionMode.SMART_UPDATE);
    });
  });

  describe('getModeDescription', () => {
    test('should return description for FRESH mode', () => {
      const description = selector.getModeDescription(AdoptionMode.FRESH);
      expect(description).toContain('Fresh Adoption');
    });

    test('should return description for SKIP mode', () => {
      const description = selector.getModeDescription(AdoptionMode.SKIP);
      expect(description).toContain('Already Up-to-Date');
    });

    test('should return description for SMART_UPDATE mode', () => {
      const description = selector.getModeDescription(AdoptionMode.SMART_UPDATE);
      expect(description).toContain('Smart Update');
    });

    test('should return description for WARNING mode', () => {
      const description = selector.getModeDescription(AdoptionMode.WARNING);
      expect(description).toContain('Version Warning');
    });

    test('should return description for SMART_ADOPT mode', () => {
      const description = selector.getModeDescription(AdoptionMode.SMART_ADOPT);
      expect(description).toContain('Smart Adoption');
    });

    test('should handle unknown mode', () => {
      const description = selector.getModeDescription('unknown-mode');
      expect(description).toContain('Unknown mode');
    });
  });

  describe('isValidMode', () => {
    test('should validate FRESH mode', () => {
      expect(selector.isValidMode(AdoptionMode.FRESH)).toBe(true);
    });

    test('should validate SKIP mode', () => {
      expect(selector.isValidMode(AdoptionMode.SKIP)).toBe(true);
    });

    test('should validate SMART_UPDATE mode', () => {
      expect(selector.isValidMode(AdoptionMode.SMART_UPDATE)).toBe(true);
    });

    test('should validate WARNING mode', () => {
      expect(selector.isValidMode(AdoptionMode.WARNING)).toBe(true);
    });

    test('should validate SMART_ADOPT mode', () => {
      expect(selector.isValidMode(AdoptionMode.SMART_ADOPT)).toBe(true);
    });

    test('should reject invalid mode', () => {
      expect(selector.isValidMode('invalid-mode')).toBe(false);
    });

    test('should reject null', () => {
      expect(selector.isValidMode(null)).toBe(false);
    });

    test('should reject undefined', () => {
      expect(selector.isValidMode(undefined)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle project path with special characters', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const state = await selector.detectProjectState('/test/project with spaces');

      expect(state).toBeInstanceOf(ProjectState);
    });

    test('should handle very long project paths', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const longPath = '/test/' + 'a'.repeat(200);
      const state = await selector.detectProjectState(longPath);

      expect(state).toBeInstanceOf(ProjectState);
    });

    test('should handle concurrent detectProjectState calls', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const promises = [
        selector.detectProjectState('/test/project1'),
        selector.detectProjectState('/test/project2'),
        selector.detectProjectState('/test/project3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(state => {
        expect(state).toBeInstanceOf(ProjectState);
      });
    });

    test('should handle version comparison edge cases', () => {
      // Test with comparison = 0 (equal) - must have currentVersion
      let state = new ProjectState({ 
        hasKiroDir: true, 
        hasVersionFile: true, 
        currentVersion: '1.8.0',
        versionComparison: 0 
      });
      expect(selector.selectMode(state)).toBe(AdoptionMode.SKIP);

      // Test with comparison < 0 (older) - must have currentVersion
      state = new ProjectState({ 
        hasKiroDir: true, 
        hasVersionFile: true, 
        currentVersion: '1.0.0',
        versionComparison: -1 
      });
      expect(selector.selectMode(state)).toBe(AdoptionMode.SMART_UPDATE);

      // Test with comparison > 0 (newer) - must have currentVersion
      state = new ProjectState({ 
        hasKiroDir: true, 
        hasVersionFile: true, 
        currentVersion: '2.0.0',
        versionComparison: 1 
      });
      expect(selector.selectMode(state)).toBe(AdoptionMode.WARNING);

      // Test with comparison = null (failed) - even with currentVersion
      state = new ProjectState({ 
        hasKiroDir: true, 
        hasVersionFile: true, 
        currentVersion: '1.0.0',
        versionComparison: null 
      });
      expect(selector.selectMode(state)).toBe(AdoptionMode.SMART_ADOPT);

      // Test without currentVersion - should be SMART_ADOPT regardless of comparison
      state = new ProjectState({ 
        hasKiroDir: true, 
        hasVersionFile: true, 
        currentVersion: null,
        versionComparison: 0 
      });
      expect(selector.selectMode(state)).toBe(AdoptionMode.SMART_ADOPT);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete fresh adoption scenario', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const { state, mode } = await selector.detectAndSelect('/test/project');

      expect(state.hasKiroDir).toBe(false);
      expect(mode).toBe(AdoptionMode.FRESH);
      expect(selector.getModeDescription(mode)).toContain('Fresh Adoption');
      expect(selector.isValidMode(mode)).toBe(true);
    });

    test('should handle complete smart update scenario', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        'kse-version': '1.0.0'
      });
      mockVersionManager.compareVersions.mockReturnValue(-1);

      const { state, mode } = await selector.detectAndSelect('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(true);
      expect(state.currentVersion).toBe('1.0.0');
      expect(state.versionComparison).toBe(-1);
      expect(mode).toBe(AdoptionMode.SMART_UPDATE);
      expect(selector.getModeDescription(mode)).toContain('Smart Update');
      expect(selector.isValidMode(mode)).toBe(true);
    });

    test('should handle complete skip scenario', async () => {
      const packageJson = require('../../../package.json');
      
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        'kse-version': packageJson.version
      });
      mockVersionManager.compareVersions.mockReturnValue(0);

      const { state, mode } = await selector.detectAndSelect('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.currentVersion).toBe(packageJson.version);
      expect(state.versionComparison).toBe(0);
      expect(mode).toBe(AdoptionMode.SKIP);
      expect(selector.getModeDescription(mode)).toContain('Already Up-to-Date');
    });

    test('should handle complete smart adopt scenario', async () => {
      mockFs.pathExists.mockImplementation(async (path) => {
        // .kiro/ exists but version.json doesn't
        if (path.includes('version.json')) {
          return false;
        }
        return path.includes('.kiro');
      });

      const { state, mode } = await selector.detectAndSelect('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.hasVersionFile).toBe(false);
      expect(state.currentVersion).toBeNull();
      expect(mode).toBe(AdoptionMode.SMART_ADOPT);
      expect(selector.getModeDescription(mode)).toContain('Smart Adoption');
    });

    test('should handle complete warning scenario', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockVersionManager.readVersion.mockResolvedValue({
        'kse-version': '99.0.0'
      });
      mockVersionManager.compareVersions.mockReturnValue(1);

      const { state, mode } = await selector.detectAndSelect('/test/project');

      expect(state.hasKiroDir).toBe(true);
      expect(state.currentVersion).toBe('99.0.0');
      expect(state.versionComparison).toBe(1);
      expect(mode).toBe(AdoptionMode.WARNING);
      expect(selector.getModeDescription(mode)).toContain('Version Warning');
    });
  });
});
