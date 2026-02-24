/**
 * Tests for document governance stats and report commands
 */

const fs = require('fs-extra');
const path = require('path');
const docsCommand = require('../../../lib/commands/docs');
const ExecutionLogger = require('../../../lib/governance/execution-logger');

describe('Document Governance - Stats and Report', () => {
  let testDir;
  let originalCwd;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(__dirname, '../../temp', `test-${Date.now()}`);
    await fs.ensureDir(testDir);
    
    // Save original cwd and change to test directory
    originalCwd = process.cwd();
    process.chdir(testDir);
    
    // Create .sce directory structure
    await fs.ensureDir(path.join(testDir, '.sce', 'logs'));
    await fs.ensureDir(path.join(testDir, '.sce', 'reports'));
    await fs.ensureDir(path.join(testDir, '.sce', 'config'));
  });
  
  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);
    
    // Clean up test directory
    await fs.remove(testDir);
  });
  
  describe('stats command', () => {
    test('should display message when no history exists', async () => {
      const exitCode = await docsCommand('stats', {});
      
      expect(exitCode).toBe(0);
    });
    
    test('should display statistics from execution history', async () => {
      // Create sample execution history
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        compliant: false,
        violations: [
          { type: 'root_violation', path: '/test.md' },
          { type: 'spec_violation', path: '/spec/test.md' }
        ],
        summary: { totalViolations: 2 }
      });
      
      await logger.logExecution('cleanup', 'delete', {
        success: true,
        deletedFiles: ['/test.md'],
        errors: [],
        summary: { totalDeleted: 1 }
      });
      
      await logger.logExecution('archive', 'move', {
        success: true,
        movedFiles: [{ from: '/spec/script.js', to: '/spec/scripts/script.js' }],
        errors: [],
        summary: { totalMoved: 1 }
      });
      
      const exitCode = await docsCommand('stats', {});
      
      expect(exitCode).toBe(0);
    });
    
    test('should calculate statistics correctly', async () => {
      const logger = new ExecutionLogger(testDir);
      
      // Add multiple executions
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test1.md' },
          { type: 'root_violation', path: '/test2.md' },
          { type: 'spec_violation', path: '/spec/test.md' }
        ]
      });
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test3.md' }
        ]
      });
      
      await logger.logExecution('cleanup', 'delete', {
        deletedFiles: ['/test1.md', '/test2.md']
      });
      
      const history = await logger.getHistory();
      
      expect(history.length).toBe(3);
      
      // Verify we can calculate stats from this history
      const exitCode = await docsCommand('stats', {});
      expect(exitCode).toBe(0);
    });
  });
  
  describe('report command', () => {
    test('should display message when no history exists', async () => {
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
    });
    
    test('should generate markdown report from execution history', async () => {
      // Create sample execution history
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        compliant: false,
        violations: [
          { type: 'root_violation', path: '/test.md' },
          { type: 'spec_violation', path: '/spec/test.md' }
        ],
        summary: { totalViolations: 2 }
      });
      
      await logger.logExecution('cleanup', 'delete', {
        success: true,
        deletedFiles: ['/test.md'],
        errors: [],
        summary: { totalDeleted: 1 }
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Verify report file was created
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      
      const reportFiles = files.filter(f => f.startsWith('document-compliance-'));
      expect(reportFiles.length).toBeGreaterThan(0);
      
      // Verify report content
      const reportPath = path.join(reportsDir, reportFiles[0]);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      
      expect(reportContent).toContain('# Document Compliance Report');
      expect(reportContent).toContain('## Summary');
      expect(reportContent).toContain('Total Executions:');
      expect(reportContent).toContain('Total Violations Found:');
      expect(reportContent).toContain('Total Cleanup Actions:');
    });
    
    test('should include violations by type in report', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test1.md' },
          { type: 'root_violation', path: '/test2.md' },
          { type: 'spec_violation', path: '/spec/test.md' },
          { type: 'misplaced_artifact', path: '/spec/script.js' }
        ]
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Read report
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      const reportPath = path.join(reportsDir, files[0]);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      
      expect(reportContent).toContain('## Violations by Type');
      expect(reportContent).toContain('root_violation');
      expect(reportContent).toContain('spec_violation');
      expect(reportContent).toContain('misplaced_artifact');
    });
    
    test('should include violations over time in report', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test1.md' }
        ]
      });
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test2.md' },
          { type: 'root_violation', path: '/test3.md' }
        ]
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Read report
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      const reportPath = path.join(reportsDir, files[0]);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      
      expect(reportContent).toContain('## Violations Over Time');
    });
    
    test('should include cleanup actions over time in report', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('cleanup', 'delete', {
        deletedFiles: ['/test1.md', '/test2.md']
      });
      
      await logger.logExecution('cleanup', 'delete', {
        deletedFiles: ['/test3.md']
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Read report
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      const reportPath = path.join(reportsDir, files[0]);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      
      expect(reportContent).toContain('## Cleanup Actions Over Time');
    });
    
    test('should include recent executions in report', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [{ type: 'root_violation', path: '/test.md' }]
      });
      
      await logger.logExecution('cleanup', 'delete', {
        deletedFiles: ['/test.md']
      });
      
      await logger.logExecution('validation', 'validate', {
        valid: true,
        errors: [],
        warnings: []
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Read report
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      const reportPath = path.join(reportsDir, files[0]);
      const reportContent = await fs.readFile(reportPath, 'utf8');
      
      expect(reportContent).toContain('## Recent Executions');
      expect(reportContent).toContain('diagnostic');
      expect(reportContent).toContain('cleanup');
      expect(reportContent).toContain('validation');
    });
    
    test('should save report with timestamp in filename', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: []
      });
      
      const exitCode = await docsCommand('report', {});
      
      expect(exitCode).toBe(0);
      
      // Verify filename format
      const reportsDir = path.join(testDir, '.sce', 'reports');
      const files = await fs.readdir(reportsDir);
      
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^document-compliance-\d{4}-\d{2}-\d{2}\.md$/);
    });
  });
  
  describe('statistics calculation', () => {
    test('should count total executions correctly', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', { violations: [] });
      await logger.logExecution('cleanup', 'delete', { deletedFiles: [] });
      await logger.logExecution('validation', 'validate', { valid: true });
      
      const history = await logger.getHistory();
      
      expect(history.length).toBe(3);
    });
    
    test('should count violations by type correctly', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('diagnostic', 'scan', {
        violations: [
          { type: 'root_violation', path: '/test1.md' },
          { type: 'root_violation', path: '/test2.md' },
          { type: 'spec_violation', path: '/spec/test.md' }
        ]
      });
      
      const history = await logger.getHistory();
      const entry = history[0];
      
      expect(entry.results.violations.length).toBe(3);
      
      const rootViolations = entry.results.violations.filter(v => v.type === 'root_violation');
      expect(rootViolations.length).toBe(2);
      
      const specViolations = entry.results.violations.filter(v => v.type === 'spec_violation');
      expect(specViolations.length).toBe(1);
    });
    
    test('should track cleanup actions correctly', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('cleanup', 'delete', {
        deletedFiles: ['/test1.md', '/test2.md', '/test3.md']
      });
      
      // Poll for file to be written and readable (CI timing issue)
      let history = [];
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        history = await logger.getHistory();
        if (history.length > 0) {
          break;
        }
        attempts++;
      }
      
      const entry = history[0];
      
      expect(entry).toBeDefined();
      expect(entry.results).toBeDefined();
      expect(entry.results.deletedFiles.length).toBe(3);
    });
    
    test('should track archive actions correctly', async () => {
      const logger = new ExecutionLogger(testDir);
      
      await logger.logExecution('archive', 'move', {
        movedFiles: [
          { from: '/spec/script.js', to: '/spec/scripts/script.js' },
          { from: '/spec/report.md', to: '/spec/reports/report.md' }
        ]
      });
      
      const history = await logger.getHistory();
      const entry = history[0];
      
      expect(entry.results.movedFiles.length).toBe(2);
    });
  });
});
