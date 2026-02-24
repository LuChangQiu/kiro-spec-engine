/**
 * Tests for Status Command with Document Compliance Integration
 */

const statusCommand = require('../../../lib/commands/status');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../../lib/task/task-claimer');
jest.mock('../../../lib/workspace/workspace-manager');
jest.mock('../../../lib/governance/diagnostic-engine');
jest.mock('../../../lib/governance/config-manager');

const TaskClaimer = require('../../../lib/task/task-claimer');
const WorkspaceManager = require('../../../lib/workspace/workspace-manager');
const DiagnosticEngine = require('../../../lib/governance/diagnostic-engine');
const ConfigManager = require('../../../lib/governance/config-manager');

describe('Status Command - Document Compliance Integration', () => {
  let originalCwd;
  let originalLog;
  let logOutput;
  
  beforeEach(() => {
    // Save original process.cwd
    originalCwd = process.cwd;
    process.cwd = jest.fn(() => '/test/project');
    
    // Capture console.log output
    originalLog = console.log;
    logOutput = [];
    console.log = jest.fn((...args) => {
      logOutput.push(args.join(' '));
    });
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    fs.pathExists.mockResolvedValue(true);
    fs.readdir.mockResolvedValue([]);
    
    // Mock WorkspaceManager
    WorkspaceManager.mockImplementation(() => ({
      isMultiUserMode: jest.fn().mockResolvedValue(false),
      listWorkspaces: jest.fn().mockResolvedValue([])
    }));
    
    // Mock TaskClaimer
    TaskClaimer.mockImplementation(() => ({
      parseTasks: jest.fn().mockResolvedValue([])
    }));
    
    // Mock ConfigManager
    ConfigManager.mockImplementation(() => ({
      load: jest.fn().mockResolvedValue({
        rootAllowedFiles: ['README.md', 'README.zh.md', 'CHANGELOG.md', 'CONTRIBUTING.md'],
        specSubdirs: ['reports', 'scripts', 'tests', 'results', 'docs'],
        temporaryPatterns: ['*-SUMMARY.md', 'SESSION-*.md']
      }),
      config: {
        rootAllowedFiles: ['README.md', 'README.zh.md', 'CHANGELOG.md', 'CONTRIBUTING.md'],
        specSubdirs: ['reports', 'scripts', 'tests', 'results', 'docs'],
        temporaryPatterns: ['*-SUMMARY.md', 'SESSION-*.md']
      }
    }));
    
    // Mock DiagnosticEngine
    DiagnosticEngine.mockImplementation(() => ({
      scan: jest.fn().mockResolvedValue({
        compliant: true,
        violations: [],
        summary: {},
        recommendations: []
      })
    }));
  });
  
  afterEach(() => {
    process.cwd = originalCwd;
    console.log = originalLog;
  });
  
  describe('Document Compliance Display', () => {
    test('should display compliant status when no violations found', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock compliant diagnostic report
      DiagnosticEngine.mockImplementation(() => ({
        scan: jest.fn().mockResolvedValue({
          compliant: true,
          violations: [],
          summary: {},
          recommendations: []
        })
      }));
      
      await statusCommand({});
      
      // Verify document compliance section is displayed
      const output = logOutput.join('\n');
      expect(output).toContain('📄 Document Compliance');
      expect(output).toContain('✅ Compliant');
      expect(output).toContain('All documents follow lifecycle management rules');
    });
    
    test('should display violation count when violations found', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock non-compliant diagnostic report
      DiagnosticEngine.mockImplementation(() => ({
        scan: jest.fn().mockResolvedValue({
          compliant: false,
          violations: [
            {
              type: 'root_violation',
              path: '/test/project/TEMP.md',
              description: 'Temporary file in root',
              severity: 'error',
              recommendation: 'Delete or move to appropriate location'
            },
            {
              type: 'misplaced_artifact',
              path: '/test/project/.sce/specs/test-spec/report.md',
              description: 'Artifact not in subdirectory',
              severity: 'warning',
              recommendation: 'Move to reports/ subdirectory'
            }
          ],
          summary: { totalViolations: 2 },
          recommendations: ['Run sce cleanup', 'Run sce archive']
        })
      }));
      
      await statusCommand({});
      
      // Verify violation information is displayed
      const output = logOutput.join('\n');
      expect(output).toContain('📄 Document Compliance');
      expect(output).toContain('Non-Compliant');
      expect(output).toContain('error(s)');
      expect(output).toContain('warning(s)');
      expect(output).toContain('Root directory: 1');
      expect(output).toContain('Misplaced artifacts: 1');
    });
    
    test('should display quick fix commands when violations found', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock non-compliant diagnostic report
      DiagnosticEngine.mockImplementation(() => ({
        scan: jest.fn().mockResolvedValue({
          compliant: false,
          violations: [
            {
              type: 'temporary_document',
              path: '/test/project/TEMP.md',
              description: 'Temporary file',
              severity: 'error',
              recommendation: 'Delete'
            }
          ],
          summary: { totalViolations: 1 },
          recommendations: []
        })
      }));
      
      await statusCommand({});
      
      // Verify quick fix commands are displayed
      const output = logOutput.join('\n');
      expect(output).toContain('Quick Fix Commands:');
      expect(output).toContain('sce doctor --docs');
      expect(output).toContain('sce cleanup');
      expect(output).toContain('sce validate --all');
      expect(output).toContain('sce docs archive --spec <name>');
    });
    
    test('should handle multiple violation types correctly', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock diagnostic report with multiple violation types
      DiagnosticEngine.mockImplementation(() => ({
        scan: jest.fn().mockResolvedValue({
          compliant: false,
          violations: [
            {
              type: 'root_violation',
              path: '/test/project/TEMP.md',
              severity: 'error'
            },
            {
              type: 'root_violation',
              path: '/test/project/OLD.md',
              severity: 'error'
            },
            {
              type: 'missing_file',
              path: '/test/project/.sce/specs/test/requirements.md',
              severity: 'error'
            },
            {
              type: 'misplaced_artifact',
              path: '/test/project/.sce/specs/test/script.js',
              severity: 'warning'
            },
            {
              type: 'temporary_document',
              path: '/test/project/.sce/specs/test/SESSION.md',
              severity: 'warning'
            }
          ],
          summary: { totalViolations: 5 },
          recommendations: []
        })
      }));
      
      await statusCommand({});
      
      // Verify all violation types are counted
      const output = logOutput.join('\n');
      expect(output).toContain('error(s)');
      expect(output).toContain('warning(s)');
      expect(output).toContain('Root directory: 2');
      expect(output).toContain('Missing files: 1');
      expect(output).toContain('Misplaced artifacts: 1');
      expect(output).toContain('Temporary documents: 1');
    });
    
    test('should gracefully handle governance component errors', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock DiagnosticEngine to throw error
      DiagnosticEngine.mockImplementation(() => ({
        scan: jest.fn().mockRejectedValue(new Error('Scan failed'))
      }));
      
      // Should not throw, should complete successfully
      await expect(statusCommand({})).resolves.not.toThrow();
      
      // Verify status command still works
      const output = logOutput.join('\n');
      expect(output).toContain('SCE Project Status');
    });
    
    test('should skip compliance check if governance not available', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      // Mock module not found error
      const moduleError = new Error('Cannot find module');
      moduleError.code = 'MODULE_NOT_FOUND';
      
      DiagnosticEngine.mockImplementation(() => {
        throw moduleError;
      });
      
      // Should not throw, should complete successfully
      await expect(statusCommand({})).resolves.not.toThrow();
      
      // Verify status command still works
      const output = logOutput.join('\n');
      expect(output).toContain('SCE Project Status');
      // Should not show compliance section
      expect(output).not.toContain('📄 Document Compliance');
    });
  });
  
  describe('Integration with Existing Status Features', () => {
    test('should display compliance section after project info and before specs', async () => {
      // Setup: Project with .sce directory and specs
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        if (p.includes('tasks.md')) return true;
        return false;
      });
      
      fs.readdir.mockImplementation(async (p) => {
        if (p.includes('specs')) {
          return [
            { name: 'test-spec', isDirectory: () => true }
          ];
        }
        return [];
      });
      
      const parseTasks = jest.fn().mockResolvedValue([
        { status: 'completed', taskId: '1', title: 'Task 1' }
      ]);

      TaskClaimer.mockImplementation(() => ({
        parseTasks
      }));
      
      await statusCommand({});

      expect(parseTasks).toHaveBeenCalledTimes(1);
      expect(parseTasks.mock.calls[0][0]).toContain('test-spec');
      expect(parseTasks.mock.calls[0][0]).toContain('tasks.md');
      expect(parseTasks.mock.calls[0][1]).toEqual({ preferStatusMarkers: true });
      
      const output = logOutput.join('\n');
      
      // Find positions of key sections
      const projectInfoPos = output.indexOf('📊 Project Information');
      const compliancePos = output.indexOf('📄 Document Compliance');
      const specsPos = output.indexOf('📁 Specs');
      
      // Verify order: Project Info -> Compliance -> Specs
      expect(projectInfoPos).toBeGreaterThan(-1);
      expect(compliancePos).toBeGreaterThan(projectInfoPos);
      expect(specsPos).toBeGreaterThan(compliancePos);
    });
    
    test('should work with verbose flag', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      await statusCommand({ verbose: true });
      
      // Verify command completes successfully
      const output = logOutput.join('\n');
      expect(output).toContain('SCE Project Status');
      expect(output).toContain('📄 Document Compliance');
    });
    
    test('should work with team flag', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      await statusCommand({ team: true });
      
      // Verify command completes successfully
      const output = logOutput.join('\n');
      expect(output).toContain('SCE Project Status');
      expect(output).toContain('📄 Document Compliance');
    });
  });
  
  describe('ConfigManager and DiagnosticEngine Integration', () => {
    test('should initialize ConfigManager with project path', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      await statusCommand({});
      
      // Verify ConfigManager was initialized with correct path
      expect(ConfigManager).toHaveBeenCalledWith('/test/project');
    });
    
    test('should load configuration before running diagnostics', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      const mockLoad = jest.fn().mockResolvedValue({});
      ConfigManager.mockImplementation(() => ({
        load: mockLoad,
        config: {}
      }));
      
      await statusCommand({});
      
      // Verify load was called
      expect(mockLoad).toHaveBeenCalled();
    });
    
    test('should pass configuration to DiagnosticEngine', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      const mockConfig = {
        rootAllowedFiles: ['README.md'],
        specSubdirs: ['reports']
      };
      
      ConfigManager.mockImplementation(() => ({
        load: jest.fn().mockResolvedValue(mockConfig),
        config: mockConfig
      }));
      
      await statusCommand({});
      
      // Verify DiagnosticEngine was initialized with config
      expect(DiagnosticEngine).toHaveBeenCalledWith('/test/project', mockConfig);
    });
    
    test('should call scan method on DiagnosticEngine', async () => {
      // Setup: Project with .sce directory
      fs.pathExists.mockImplementation(async (p) => {
        if (p.includes('.sce')) return true;
        if (p.includes('specs')) return true;
        return false;
      });
      
      fs.readdir.mockResolvedValue([]);
      
      const mockScan = jest.fn().mockResolvedValue({
        compliant: true,
        violations: [],
        summary: {},
        recommendations: []
      });
      
      DiagnosticEngine.mockImplementation(() => ({
        scan: mockScan
      }));
      
      await statusCommand({});
      
      // Verify scan was called
      expect(mockScan).toHaveBeenCalled();
    });
  });
});
