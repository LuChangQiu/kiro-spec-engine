/**
 * Tests for Doctor Command
 * 
 * Tests the integration of document governance diagnostics with the doctor command
 */

const doctorCommand = require('../../../lib/commands/doctor');
const DiagnosticEngine = require('../../../lib/governance/diagnostic-engine');
const ConfigManager = require('../../../lib/governance/config-manager');
const fs = require('fs-extra');
const path = require('path');

// Mock chalk to avoid color codes in test output
jest.mock('chalk', () => {
  const mockChalk = (str) => str;
  mockChalk.red = (str) => str;
  mockChalk.green = (str) => str;
  mockChalk.yellow = (str) => str;
  mockChalk.blue = (str) => str;
  mockChalk.cyan = (str) => str;
  mockChalk.gray = (str) => str;
  mockChalk.bold = (str) => str;
  mockChalk.bold.cyan = (str) => str;
  return mockChalk;
});

// Mock python-checker
jest.mock('../../../lib/python-checker', () => ({
  checkPython: jest.fn(() => ({
    available: true,
    version: '3.9.0'
  })),
  getInstallInstructions: jest.fn(() => 'Install Python instructions')
}));

// Mock i18n
jest.mock('../../../lib/i18n', () => ({
  getI18n: jest.fn(() => ({
    t: jest.fn((key) => {
      const translations = {
        'cli.commands.doctor.title': 'System Diagnostics',
        'cli.commands.doctor.checking': 'Checking system requirements...',
        'cli.commands.doctor.nodejs': 'Node.js',
        'cli.commands.doctor.python': 'Python',
        'cli.commands.doctor.python_note': 'Python is optional',
        'cli.commands.doctor.all_good': 'All systems operational',
        'cli.commands.doctor.ready': 'Ready to use',
        'cli.commands.doctor.python_missing': 'Python not found',
        'cli.commands.doctor.basic_features': 'Basic features available',
        'cli.commands.doctor.ultrawork_unavailable': 'Ultrawork features unavailable',
        'python.install_header': 'How to install Python:'
      };
      return translations[key] || key;
    })
  }))
}));

describe('Doctor Command', () => {
  let testDir;
  let originalCwd;
  let consoleLogSpy;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '../../temp/doctor-test');
    await fs.ensureDir(testDir);
    
    // Save original cwd and change to test directory
    originalCwd = process.cwd();
    process.chdir(testDir);
    
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);
    
    // Clean up test directory
    await fs.remove(testDir);
    
    // Restore console.log
    consoleLogSpy.mockRestore();
  });
  
  describe('Basic doctor command (without --docs flag)', () => {
    test('should run successfully with compliant project', async () => {
      // Setup: Create compliant project structure
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project');
      
      // Execute
      await doctorCommand();
      
      // Verify: Should show Node.js, Python, and document compliance
      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Check that basic checks were performed
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Node.js');
      expect(output).toContain('Document Compliance');
    });
    
    test('should show brief compliance status when violations exist', async () => {
      // Setup: Create project with violations
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, 'TEMP-FILE.md'), 'temporary');
      
      // Execute
      await doctorCommand();
      
      // Verify: Should show brief violation summary
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Document Compliance');
      expect(output).toContain('sce doctor --docs');
    });
    
    test('should handle missing .sce directory gracefully', async () => {
      // Setup: No .sce directory
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Execute
      await doctorCommand();
      
      // Verify: Should not crash
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
  
  describe('Doctor command with --docs flag', () => {
    test('should show detailed diagnostics for compliant project', async () => {
      // Setup: Create compliant project
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/requirements.md'), '# Requirements');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/design.md'), '# Design');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/tasks.md'), '# Tasks');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should show detailed compliance message
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Document Governance Diagnostic');
      expect(output).toContain('Project is compliant');
    });
    
    test('should show detailed violations when they exist', async () => {
      // Setup: Create project with violations
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, 'TEMP-FILE.md'), 'temporary');
      await fs.writeFile(path.join(testDir, 'SESSION-NOTES.md'), 'notes');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should show detailed violation information
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Document Governance Diagnostic');
      expect(output).toContain('violation(s)');
      expect(output).toContain('TEMP-FILE.md');
      expect(output).toContain('SESSION-NOTES.md');
    });
    
    test('should show recommendations for fixing violations', async () => {
      // Setup: Create project with misplaced artifacts
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/requirements.md'), '# Requirements');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/design.md'), '# Design');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/tasks.md'), '# Tasks');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/report.md'), 'report');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should show recommendations
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Recommended Actions');
      expect(output).toContain('sce docs archive');
    });
    
    test('should group violations by type', async () => {
      // Setup: Create project with multiple violation types
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, 'TEMP-FILE.md'), 'temporary'); // root violation
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/requirements.md'), '# Requirements');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/design.md'), '# Design');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/tasks.md'), '# Tasks');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/artifact.js'), 'code'); // misplaced artifact
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should show grouped violations
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Root Violation');
      expect(output).toContain('Misplaced Artifact');
    });
  });
  
  describe('Integration with existing doctor checks', () => {
    test('should maintain existing formatting style', async () => {
      // Setup: Create compliant project
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Execute
      await doctorCommand();
      
      // Verify: Should use consistent formatting
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      
      // Check for separator lines (existing pattern)
      expect(output).toContain('─'.repeat(60));
      
      // Check for checkmarks and icons (existing pattern)
      expect(output).toMatch(/[✓✅]/);
    });
    
    test('should include document compliance between system checks and summary', async () => {
      // Setup
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Execute
      await doctorCommand();
      
      // Verify: Document compliance should appear after system checks
      const calls = consoleLogSpy.mock.calls.map(call => call.join(' '));
      const output = calls.join('\n');
      
      // Find positions
      const nodeJsIndex = output.indexOf('Node.js');
      const docComplianceIndex = output.indexOf('Document Compliance');
      const summaryIndex = output.indexOf('operational');
      
      // Verify order
      expect(nodeJsIndex).toBeGreaterThan(-1);
      expect(docComplianceIndex).toBeGreaterThan(nodeJsIndex);
      expect(summaryIndex).toBeGreaterThan(docComplianceIndex);
    });
  });
  
  describe('Error handling', () => {
    test('should handle diagnostic engine errors gracefully', async () => {
      // Setup: Create invalid project structure that might cause errors
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Mock DiagnosticEngine to throw error
      const originalScan = DiagnosticEngine.prototype.scan;
      DiagnosticEngine.prototype.scan = jest.fn().mockRejectedValue(new Error('Scan failed'));
      
      // Execute
      await doctorCommand();
      
      // Verify: Should not crash and show warning
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Document compliance check failed');
      
      // Restore
      DiagnosticEngine.prototype.scan = originalScan;
    });
    
    test('should continue with other checks if document check fails', async () => {
      // Setup
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Mock DiagnosticEngine to throw error
      const originalScan = DiagnosticEngine.prototype.scan;
      DiagnosticEngine.prototype.scan = jest.fn().mockRejectedValue(new Error('Scan failed'));
      
      // Execute
      await doctorCommand();
      
      // Verify: Should still show Node.js and Python checks
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Node.js');
      expect(output).toContain('Python');
      
      // Restore
      DiagnosticEngine.prototype.scan = originalScan;
    });
  });
  
  describe('Configuration integration', () => {
    test('should use custom configuration if available', async () => {
      // Setup: Create custom configuration
      await fs.ensureDir(path.join(testDir, '.sce/config'));
      await fs.writeJson(path.join(testDir, '.sce/config/docs.json'), {
        rootAllowedFiles: ['README.md', 'CUSTOM.md'],
        specSubdirs: ['reports', 'scripts', 'tests', 'results', 'docs'],
        temporaryPatterns: ['*-SUMMARY.md', 'SESSION-*.md']
      });
      
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, 'CUSTOM.md'), '# Custom');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: CUSTOM.md should not be flagged as violation
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Project is compliant');
    });
    
    test('should use default configuration if config file missing', async () => {
      // Setup: No config file
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      
      // Execute
      await doctorCommand();
      
      // Verify: Should work with defaults
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Document Compliance');
    });
  });
  
  describe('Output formatting', () => {
    test('should use relative paths in violation output', async () => {
      // Setup: Create violation in subdirectory
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, '.sce/specs/test-spec/TEMP-FILE.md'), 'temp');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should show relative path
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('.sce');
      expect(output).toContain('test-spec');
      expect(output).toContain('TEMP-FILE.md');
    });
    
    test('should format violation types in human-readable format', async () => {
      // Setup: Create various violations
      await fs.ensureDir(path.join(testDir, '.sce/specs/test-spec'));
      await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
      await fs.writeFile(path.join(testDir, 'TEMP-FILE.md'), 'temp');
      
      // Execute
      await doctorCommand({ docs: true });
      
      // Verify: Should format type names properly
      const output = consoleLogSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(output).toContain('Root Violation'); // Not "root_violation"
    });
  });
});
