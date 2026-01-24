/**
 * Unit tests for Reporter
 */

const Reporter = require('../../../lib/governance/reporter');

describe('Reporter', () => {
  let reporter;
  let consoleLogSpy;
  
  beforeEach(() => {
    reporter = new Reporter();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
  });
  
  describe('displayDiagnostic', () => {
    test('should display compliant message when no violations', () => {
      const report = {
        compliant: true,
        violations: [],
        summary: { totalViolations: 0 },
        recommendations: []
      };
      
      reporter.displayDiagnostic(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('compliant');
    });
    
    test('should display violations when found', () => {
      const report = {
        compliant: false,
        violations: [
          {
            type: 'root_violation',
            path: '/test/TEMP-file.md',
            description: 'Unexpected file',
            severity: 'error',
            recommendation: 'Delete file'
          }
        ],
        summary: {
          totalViolations: 1,
          bySeverity: { error: 1, warning: 0, info: 0 }
        },
        recommendations: ['Run cleanup']
      };
      
      reporter.displayDiagnostic(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('violation');
      expect(output).toContain('TEMP-file.md');
    });
    
    test('should group violations by type', () => {
      const report = {
        compliant: false,
        violations: [
          {
            type: 'root_violation',
            path: '/test/file1.md',
            description: 'File 1',
            severity: 'error',
            recommendation: 'Fix 1'
          },
          {
            type: 'root_violation',
            path: '/test/file2.md',
            description: 'File 2',
            severity: 'error',
            recommendation: 'Fix 2'
          },
          {
            type: 'missing_required_file',
            path: '/test/spec/design.md',
            description: 'Missing file',
            severity: 'error',
            recommendation: 'Create file'
          }
        ],
        summary: {
          totalViolations: 3,
          bySeverity: { error: 3, warning: 0, info: 0 }
        },
        recommendations: []
      };
      
      reporter.displayDiagnostic(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Root Violation');
      expect(output).toContain('Missing Required File');
    });
    
    test('should display recommendations', () => {
      const report = {
        compliant: false,
        violations: [
          {
            type: 'root_violation',
            path: '/test/file.md',
            description: 'File',
            severity: 'error',
            recommendation: 'Fix'
          }
        ],
        summary: { totalViolations: 1 },
        recommendations: ['Run cleanup', 'Run validate']
      };
      
      reporter.displayDiagnostic(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Run cleanup');
      expect(output).toContain('Run validate');
    });
  });
  
  describe('displayCleanup', () => {
    test('should display no files message when nothing to clean', () => {
      const report = {
        success: true,
        deletedFiles: [],
        errors: [],
        summary: { totalDeleted: 0, totalErrors: 0 }
      };
      
      reporter.displayCleanup(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No files');
    });
    
    test('should display deleted files', () => {
      const report = {
        success: true,
        deletedFiles: ['/test/file1.md', '/test/file2.md'],
        errors: [],
        summary: { totalDeleted: 2, totalErrors: 0 }
      };
      
      reporter.displayCleanup(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('file1.md');
      expect(output).toContain('file2.md');
      expect(output).toContain('Deleted 2');
    });
    
    test('should display dry run message', () => {
      const report = {
        success: true,
        deletedFiles: ['/test/file.md'],
        errors: [],
        summary: { totalDeleted: 1, totalErrors: 0 },
        dryRun: true
      };
      
      reporter.displayCleanup(report, true);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Dry Run');
      expect(output).toContain('Would delete');
    });
    
    test('should display errors', () => {
      const report = {
        success: false,
        deletedFiles: ['/test/file1.md'],
        errors: [
          { path: '/test/file2.md', error: 'Permission denied' }
        ],
        summary: { totalDeleted: 1, totalErrors: 1 }
      };
      
      reporter.displayCleanup(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('error');
      expect(output).toContain('Permission denied');
    });
  });
  
  describe('displayValidation', () => {
    test('should display passed message when valid', () => {
      const report = {
        valid: true,
        errors: [],
        warnings: [],
        summary: { totalErrors: 0, totalWarnings: 0 }
      };
      
      reporter.displayValidation(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('passed');
      expect(output).toContain('compliant');
    });
    
    test('should display errors', () => {
      const report = {
        valid: false,
        errors: [
          {
            type: 'missing_required_file',
            path: '/test/spec/design.md',
            message: 'Missing file',
            recommendation: 'Create file'
          }
        ],
        warnings: [],
        summary: { totalErrors: 1, totalWarnings: 0 }
      };
      
      reporter.displayValidation(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('error');
      expect(output).toContain('design.md');
      expect(output).toContain('Missing file');
    });
    
    test('should display warnings', () => {
      const report = {
        valid: true,
        errors: [],
        warnings: [
          {
            type: 'misplaced_artifact',
            path: '/test/spec/file.md',
            message: 'Misplaced file',
            recommendation: 'Move file'
          }
        ],
        summary: { totalErrors: 0, totalWarnings: 1 }
      };
      
      reporter.displayValidation(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('warning');
      expect(output).toContain('file.md');
    });
    
    test('should display summary', () => {
      const report = {
        valid: false,
        errors: [
          {
            type: 'error',
            path: '/test/file.md',
            message: 'Error',
            recommendation: 'Fix'
          }
        ],
        warnings: [
          {
            type: 'warning',
            path: '/test/file2.md',
            message: 'Warning',
            recommendation: 'Fix'
          }
        ],
        summary: { totalErrors: 1, totalWarnings: 1 }
      };
      
      reporter.displayValidation(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Summary');
      expect(output).toContain('Errors: 1');
      expect(output).toContain('Warnings: 1');
    });
  });
  
  describe('displayArchive', () => {
    test('should display no files message when nothing to archive', () => {
      const report = {
        success: true,
        movedFiles: [],
        errors: [],
        summary: { totalMoved: 0, totalErrors: 0 }
      };
      
      reporter.displayArchive(report);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No files');
    });
    
    test('should display moved files', () => {
      const report = {
        success: true,
        movedFiles: [
          { from: '/test/spec/file.js', to: '/test/spec/scripts/file.js' }
        ],
        errors: [],
        summary: { totalMoved: 1, totalErrors: 0 }
      };
      
      reporter.displayArchive(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('file.js');
      expect(output).toContain('Moved 1');
    });
    
    test('should display dry run message', () => {
      const report = {
        success: true,
        movedFiles: [
          { from: '/test/file.js', to: '/test/scripts/file.js' }
        ],
        errors: [],
        summary: { totalMoved: 1, totalErrors: 0 },
        dryRun: true
      };
      
      reporter.displayArchive(report, true);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Dry Run');
      expect(output).toContain('Would move');
    });
    
    test('should display errors', () => {
      const report = {
        success: false,
        movedFiles: [],
        errors: [
          { path: '/test/file.js', error: 'Target exists' }
        ],
        summary: { totalMoved: 0, totalErrors: 1 }
      };
      
      reporter.displayArchive(report);
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('error');
      expect(output).toContain('Target exists');
    });
  });
  
  describe('utility methods', () => {
    test('displayError should display error message', () => {
      reporter.displayError('Test error');
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Error');
      expect(output).toContain('Test error');
    });
    
    test('displaySuccess should display success message', () => {
      reporter.displaySuccess('Test success');
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Test success');
    });
    
    test('displayInfo should display info message', () => {
      reporter.displayInfo('Test info');
      
      const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Test info');
    });
  });
  
  describe('helper methods', () => {
    test('groupBy should group array by property', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 }
      ];
      
      const grouped = reporter.groupBy(items, 'type');
      
      expect(grouped.a).toHaveLength(2);
      expect(grouped.b).toHaveLength(1);
    });
    
    test('formatType should format violation type', () => {
      expect(reporter.formatType('root_violation')).toBe('Root Violation');
      expect(reporter.formatType('missing_required_file')).toBe('Missing Required File');
      expect(reporter.formatType('misplaced_artifact')).toBe('Misplaced Artifact');
    });
  });
});
