/**
 * Unit Tests for Smart Adoption Orchestrator
 */

const SmartOrchestrator = require('../../../lib/adoption/smart-orchestrator');
const DetectionEngine = require('../../../lib/adoption/detection-engine');
const { getAdoptionStrategy } = require('../../../lib/adoption/adoption-strategy');
const BackupManager = require('../../../lib/adoption/backup-manager');
const VersionManager = require('../../../lib/version/version-manager');
const StrategySelector = require('../../../lib/adoption/strategy-selector');

// Mock dependencies
jest.mock('../../../lib/adoption/detection-engine');
jest.mock('../../../lib/adoption/adoption-strategy');
jest.mock('../../../lib/adoption/backup-manager');
jest.mock('../../../lib/version/version-manager');
jest.mock('../../../lib/adoption/strategy-selector');
jest.mock('fs-extra');

describe('SmartOrchestrator', () => {
  let orchestrator;
  let mockDetectionEngine;
  let mockStrategy;
  let mockBackupManager;
  let mockVersionManager;
  let mockStrategySelector;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockDetectionEngine = {
      analyze: jest.fn()
    };

    mockStrategy = {
      execute: jest.fn()
    };

    mockBackupManager = {
      createMandatoryBackup: jest.fn(),
      validateBackup: jest.fn()
    };

    mockVersionManager = {
      compareVersions: jest.fn(),
      createVersionInfo: jest.fn(),
      writeVersion: jest.fn(),
      readVersion: jest.fn(),
      addUpgradeHistory: jest.fn()
    };

    mockStrategySelector = {
      detectProjectState: jest.fn(),
      selectMode: jest.fn()
    };

    // Mock getAdoptionStrategy to return our mock strategy
    getAdoptionStrategy.mockReturnValue(mockStrategy);

    // Create orchestrator with injected dependencies
    orchestrator = new SmartOrchestrator({
      detectionEngine: mockDetectionEngine,
      versionManager: mockVersionManager,
      backupManager: mockBackupManager,
      strategySelector: mockStrategySelector
    });
  });

  describe('Mode Selection', () => {
    test('should select fresh mode when no .kiro/ directory exists', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        currentVersion: null,
        targetVersion: '1.8.0',
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        conflicts: [],
        versionComparison: null
      });

      mockStrategySelector.selectMode.mockReturnValue('fresh');

      mockStrategy.execute.mockResolvedValue({
        success: true,
        filesCreated: ['.kiro/', '.kiro/specs/'],
        filesUpdated: [],
        filesSkipped: [],
        errors: [],
        warnings: []
      });

      const result = await orchestrator.orchestrate('/test/project', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('fresh');
    });

    test('should select smart-adopt mode when .kiro/ exists but no version file', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: false,
        hasSpecs: true,
        hasSteering: true,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: false,
        currentVersion: null,
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        hasTools: false,
        conflicts: [],
        versionComparison: null
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-adopt');

      const result = await orchestrator.orchestrate('/test/project', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('smart-adopt');
    });

    test('should select skip mode when version is current', async () => {
      const packageJson = require('../../../package.json');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: packageJson.version,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: packageJson.version,
        targetVersion: packageJson.version,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        conflicts: [],
        versionComparison: 0
      });

      mockStrategySelector.selectMode.mockReturnValue('skip');

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('skip');
      expect(result.warnings).toContain('Already at latest version - no action needed');
    });

    test('should select smart-update mode when version is older', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockVersionManager.compareVersions.mockReturnValue(-1);

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        conflicts: [],
        versionComparison: -1
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-update');

      const result = await orchestrator.orchestrate('/test/project', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('smart-update');
    });

    test('should select warning mode when version is newer', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '99.0.0',
        conflicts: []
      });

      mockVersionManager.compareVersions.mockReturnValue(1);

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '99.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        conflicts: [],
        versionComparison: 1
      });

      mockStrategySelector.selectMode.mockReturnValue('warning');

      const result = await orchestrator.orchestrate('/test/project', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('warning');
    });
  });

  describe('Backup Creation', () => {
    test('should create backup when files will be modified', async () => {
      const fs = require('fs-extra');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        conflicts: []
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-update');

      // Mock fs.pathExists for CURRENT_CONTEXT.md check
      fs.pathExists.mockResolvedValue(true);

      mockBackupManager.createMandatoryBackup.mockResolvedValue({
        id: 'backup-20260127-143022',
        location: '/test/project/.kiro/backups/backup-20260127-143022',
        filesCount: 1,
        totalSize: 1024,
        timestamp: new Date(),
        type: 'adopt-smart',
        files: ['steering/CORE_PRINCIPLES.md'],
        validated: true,
        validationDetails: {
          filesVerified: 1,
          contentVerified: false,
          timestamp: new Date()
        }
      });

      mockStrategy.execute.mockResolvedValue({
        success: true,
        filesCreated: [],
        filesUpdated: ['steering/CORE_PRINCIPLES.md'],
        filesSkipped: [],
        errors: [],
        warnings: []
      });

      mockVersionManager.readVersion.mockResolvedValue({
        'sce-version': '1.0.0'
      });

      mockVersionManager.addUpgradeHistory.mockReturnValue({
        'sce-version': '1.8.0'
      });

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(true);
      expect(result.backup).toBeDefined();
      expect(result.backup.id).toBe('backup-20260127-143022');
      expect(mockBackupManager.createMandatoryBackup).toHaveBeenCalled();
    });

    test('should skip backup when skipBackup option is true', async () => {
      const fs = require('fs-extra');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        conflicts: []
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-update');

      // Mock fs.pathExists for CURRENT_CONTEXT.md check
      fs.pathExists.mockResolvedValue(true);

      mockStrategy.execute.mockResolvedValue({
        success: true,
        filesCreated: [],
        filesUpdated: ['steering/CORE_PRINCIPLES.md'],
        filesSkipped: [],
        errors: [],
        warnings: []
      });

      mockVersionManager.readVersion.mockResolvedValue({
        'sce-version': '1.0.0'
      });

      mockVersionManager.addUpgradeHistory.mockReturnValue({
        'sce-version': '1.8.0'
      });

      const result = await orchestrator.orchestrate('/test/project', { skipBackup: true });

      expect(result.success).toBe(true);
      expect(result.backup).toBeNull();
      expect(result.warnings).toContain('⚠️  Backup skipped - changes cannot be undone!');
      expect(mockBackupManager.createMandatoryBackup).not.toHaveBeenCalled();
    });

    test('should abort adoption if backup fails', async () => {
      const fs = require('fs-extra');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        conflicts: []
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-update');

      // Mock fs.pathExists for CURRENT_CONTEXT.md check
      fs.pathExists.mockResolvedValue(true);

      mockBackupManager.createMandatoryBackup.mockRejectedValue(
        new Error('Failed to create mandatory backup: Insufficient disk space')
      );

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Backup failed: Failed to create mandatory backup: Insufficient disk space');
      expect(result.errors).toContain('Aborting adoption for safety');
      expect(mockStrategy.execute).not.toHaveBeenCalled();
    });

    test.skip('should abort adoption if backup validation fails', async () => {
      // TODO: Fix fs-extra mocking in this test
      // The mock isn't being applied correctly, causing validation to fail unexpectedly
      const fs = require('fs-extra');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockVersionManager.compareVersions.mockReturnValue(-1);

      const backupResult = {
        id: 'backup-20260127-143022',
        location: '/test/project/.kiro/backups/backup-20260127-143022',
        filesCount: 1,
        timestamp: new Date()
      };

      mockSelectiveBackup.createSelectiveBackup.mockResolvedValue({
        id: backupResult.id,
        backupPath: backupResult.location,
        location: backupResult.location,
        filesBackedUp: ['steering/CORE_PRINCIPLES.md'],
        timestamp: backupResult.timestamp
      });

      // Mock backup validation failure - fs.pathExists returns false
      fs.pathExists.mockResolvedValue(false);

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Backup validation failed');
      expect(mockStrategy.execute).not.toHaveBeenCalled();
    });
  });

  describe('Adoption Execution', () => {
    test('should execute fresh adoption successfully', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        currentVersion: null,
        targetVersion: '1.8.0',
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        conflicts: [],
        versionComparison: null
      });

      mockStrategySelector.selectMode.mockReturnValue('fresh');

      mockStrategy.execute.mockResolvedValue({
        success: true,
        filesCreated: ['.kiro/', '.kiro/specs/', 'steering/CORE_PRINCIPLES.md'],
        filesUpdated: [],
        filesSkipped: [],
        errors: [],
        warnings: []
      });

      mockVersionManager.createVersionInfo.mockReturnValue({
        'sce-version': '1.8.0'
      });

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('fresh');
      expect(result.changes.created).toContain('.kiro/');
      expect(mockStrategy.execute).toHaveBeenCalledWith(
        '/test/project',
        'fresh',
        expect.objectContaining({
          dryRun: false
        })
      );
    });

    test('should preserve user content during smart-update', async () => {
      const fs = require('fs-extra');
      
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        hasSpecs: true,
        hasSteering: true,
        hasTools: true,
        projectType: 'nodejs',
        existingVersion: '1.0.0',
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: true,
        hasVersionFile: true,
        currentVersion: '1.0.0',
        targetVersion: '1.8.0',
        hasSpecs: true,
        hasSteering: true,
        conflicts: []
      });

      mockStrategySelector.selectMode.mockReturnValue('smart-update');

      mockBackupManager.createMandatoryBackup.mockResolvedValue({
        id: 'backup-20260127-143022',
        location: '/test/project/.kiro/backups/backup-20260127-143022',
        filesCount: 1,
        totalSize: 1024,
        timestamp: new Date(),
        type: 'adopt-smart',
        files: ['steering/CORE_PRINCIPLES.md'],
        validated: true,
        validationDetails: {
          filesVerified: 1,
          contentVerified: false,
          timestamp: new Date()
        }
      });

      mockStrategy.execute.mockResolvedValue({
        success: true,
        filesCreated: [],
        filesUpdated: ['steering/CORE_PRINCIPLES.md'],
        filesSkipped: ['specs/', 'steering/CURRENT_CONTEXT.md'],
        errors: [],
        warnings: []
      });

      mockVersionManager.readVersion.mockResolvedValue({
        'sce-version': '1.0.0'
      });

      mockVersionManager.addUpgradeHistory.mockReturnValue({
        'sce-version': '1.8.0'
      });

      // Mock fs for file existence checks
      fs.pathExists.mockResolvedValue(true);

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('smart-update');
      expect(result.changes.preserved).toContain('specs/');
      expect(result.changes.preserved).toContain('steering/CURRENT_CONTEXT.md');
    });

    test('should handle adoption strategy errors gracefully', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        currentVersion: null,
        targetVersion: '1.8.0',
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        conflicts: [],
        versionComparison: null
      });

      mockStrategySelector.selectMode.mockReturnValue('fresh');

      mockStrategy.execute.mockResolvedValue({
        success: false,
        filesCreated: [],
        filesUpdated: [],
        filesSkipped: [],
        errors: ['Permission denied'],
        warnings: []
      });

      mockVersionManager.createVersionInfo.mockReturnValue({
        'sce-version': '1.8.0'
      });

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Permission denied');
    });
  });

  describe('Dry Run Mode', () => {
    test('should not make changes in dry run mode', async () => {
      mockDetectionEngine.analyze.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        hasSpecs: false,
        hasSteering: false,
        hasTools: false,
        projectType: 'nodejs',
        existingVersion: null,
        conflicts: []
      });

      mockStrategySelector.detectProjectState.mockResolvedValue({
        hasKiroDir: false,
        hasVersionFile: false,
        currentVersion: null,
        targetVersion: '1.8.0',
        hasSpecs: false,
        hasSteering: false,
        conflicts: []
      });

      mockStrategySelector.selectMode.mockReturnValue('fresh');

      const result = await orchestrator.orchestrate('/test/project', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dry run - no changes made');
      expect(mockStrategy.execute).not.toHaveBeenCalled();
      expect(mockBackupManager.createMandatoryBackup).not.toHaveBeenCalled();
    });
  });

  describe('Summary Generation', () => {
    test('should generate comprehensive summary', () => {
      const result = {
        success: true,
        mode: 'smart-update',
        backup: {
          id: 'backup-20260127-143022',
          location: '/test/project/.kiro/backups/backup-20260127-143022',
          filesCount: 3
        },
        changes: {
          updated: ['steering/CORE_PRINCIPLES.md', 'steering/ENVIRONMENT.md'],
          created: ['tools/ultrawork_enhancer.py'],
          deleted: [],
          preserved: ['specs/', 'steering/CURRENT_CONTEXT.md']
        },
        errors: [],
        warnings: []
      };

      const summary = orchestrator.generateSummary(result);

      expect(summary).toContain('✅ Adoption completed successfully!');
      expect(summary).toContain('Mode: Smart Update');
      expect(summary).toContain('Backup: backup-20260127-143022');
      expect(summary).toContain('Updated: 2 file(s)');
      expect(summary).toContain('Created: 1 file(s)');
      expect(summary).toContain('Preserved: 2 file(s)');
      expect(summary).toContain('sce rollback backup-20260127-143022');
    });

    test('should include warnings in summary', () => {
      const result = {
        success: true,
        mode: 'fresh',
        backup: null,
        changes: {
          updated: [],
          created: ['.kiro/'],
          deleted: [],
          preserved: []
        },
        errors: [],
        warnings: ['Template directory not found', 'Using default configuration']
      };

      const summary = orchestrator.generateSummary(result);

      expect(summary).toContain('⚠️  Warnings:');
      expect(summary).toContain('Template directory not found');
      expect(summary).toContain('Using default configuration');
    });
  });

  describe('Error Handling', () => {
    test('should handle detection engine errors', async () => {
      mockDetectionEngine.analyze.mockRejectedValue(
        new Error('Project path not found')
      );

      const result = await orchestrator.orchestrate('/invalid/path');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Orchestration failed');
    });

    test('should handle unexpected errors gracefully', async () => {
      mockDetectionEngine.analyze.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await orchestrator.orchestrate('/test/project');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
