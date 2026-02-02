const fs = require('fs').promises;
const path = require('path');

/**
 * IntegrationManager handles cross-Spec integration testing
 */
class IntegrationManager {
  constructor(workspaceRoot, metadataManager) {
    this.workspaceRoot = workspaceRoot;
    this.metadataManager = metadataManager;
    this.specsDir = path.join(workspaceRoot, '.kiro', 'specs');
  }

  /**
   * Discover integration tests for a spec
   * @param {string} specName - Name of the spec
   * @returns {Promise<Array<string>>} List of test file paths
   */
  async discoverTests(specName) {
    const testsDir = path.join(this.specsDir, specName, 'integration-tests');
    
    try {
      const files = await fs.readdir(testsDir);
      return files
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(testsDir, f));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Run a single integration test
   * @param {string} testPath - Path to test file
   * @returns {Promise<Object>} Test result
   */
  async runTest(testPath) {
    try {
      // Load test module
      const test = require(testPath);
      
      // Validate test structure
      if (!test.name || !test.specs || !test.test) {
        return {
          success: false,
          error: 'Invalid test structure: must have name, specs, and test function'
        };
      }

      // Validate dependencies
      const validation = await this.validateTestDependencies(test);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          blocked: true
        };
      }

      // Run setup if provided
      if (test.setup) {
        await test.setup();
      }

      // Run test
      await test.test();
      
      // Run teardown if provided
      if (test.teardown) {
        await test.teardown();
      }

      return {
        success: true,
        name: test.name,
        specs: test.specs
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Run all integration tests for specified specs
   * @param {Array<string>} specNames - Specs to test
   * @returns {Promise<Object>} Test results
   */
  async runAllTests(specNames) {
    const results = [];
    
    for (const specName of specNames) {
      const tests = await this.discoverTests(specName);
      
      for (const testPath of tests) {
        const result = await this.runTest(testPath);
        results.push({
          spec: specName,
          testPath,
          ...result
        });
      }
    }

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.blocked).length;
    const blocked = results.filter(r => r.blocked).length;

    return {
      total: results.length,
      passed,
      failed,
      blocked,
      results
    };
  }

  /**
   * Generate integration test report
   * @param {Object} results - Test results from runAllTests
   * @returns {string} Formatted report
   */
  generateReport(results) {
    const lines = [];
    
    lines.push('Integration Test Report');
    lines.push('======================');
    lines.push('');
    lines.push(`Total: ${results.total}`);
    lines.push(`Passed: ${results.passed}`);
    lines.push(`Failed: ${results.failed}`);
    lines.push(`Blocked: ${results.blocked}`);
    lines.push('');

    if (results.failed > 0) {
      lines.push('Failed Tests:');
      lines.push('-------------');
      for (const result of results.results) {
        if (!result.success && !result.blocked) {
          lines.push(`  ${result.name || path.basename(result.testPath)}`);
          lines.push(`    Spec: ${result.spec}`);
          lines.push(`    Error: ${result.error}`);
          lines.push('');
        }
      }
    }

    if (results.blocked > 0) {
      lines.push('Blocked Tests:');
      lines.push('--------------');
      for (const result of results.results) {
        if (result.blocked) {
          lines.push(`  ${result.name || path.basename(result.testPath)}`);
          lines.push(`    Reason: ${result.error}`);
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate that all required specs for a test are available
   * @param {Object} test - Test definition
   * @returns {Promise<Object>} Validation result
   */
  async validateTestDependencies(test) {
    if (!test.specs || !Array.isArray(test.specs)) {
      return {
        valid: false,
        error: 'Test must specify required specs'
      };
    }

    const missing = [];
    
    for (const specName of test.specs) {
      const metadata = await this.metadataManager.readMetadata(specName);
      if (!metadata) {
        missing.push(specName);
      }
    }

    if (missing.length > 0) {
      return {
        valid: false,
        error: `Missing required specs: ${missing.join(', ')}`
      };
    }

    return { valid: true };
  }
}

module.exports = IntegrationManager;
