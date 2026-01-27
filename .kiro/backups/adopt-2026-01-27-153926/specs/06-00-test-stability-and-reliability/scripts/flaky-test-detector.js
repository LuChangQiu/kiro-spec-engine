const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

/**
 * FlakyTestDetector - Systematically identifies tests that fail intermittently
 * 
 * Executes the test suite multiple times and tracks which tests fail in each run.
 * Generates detailed reports of flaky tests with failure patterns and frequencies.
 */
class FlakyTestDetector {
  constructor(options = {}) {
    this.runs = options.runs || 20;
    this.testCommand = options.testCommand || 'npm test -- --json --outputFile=test-results.json';
    this.results = [];
    this.flakyTests = new Map();
  }

  /**
   * Execute test suite multiple times and collect results
   */
  async detectFlakyTests() {
    console.log(`Starting flaky test detection with ${this.runs} runs...`);
    console.log('This may take several minutes...\n');

    for (let i = 1; i <= this.runs; i++) {
      console.log(`Run ${i}/${this.runs}...`);
      const result = await this.executeTestRun(i);
      this.results.push(result);
      
      // Track flaky tests
      if (result.failures && result.failures.length > 0) {
        result.failures.forEach(failure => {
          const key = `${failure.testFile}::${failure.testName}`;
          if (!this.flakyTests.has(key)) {
            this.flakyTests.set(key, {
              testName: failure.testName,
              testFile: failure.testFile,
              failures: [],
              totalRuns: 0
            });
          }
          const testData = this.flakyTests.get(key);
          testData.failures.push({
            run: i,
            errorMessage: failure.errorMessage,
            stackTrace: failure.stackTrace
          });
        });
      }

      // Update total runs for all tests we've seen
      this.flakyTests.forEach(testData => {
        testData.totalRuns = i;
      });
    }

    console.log('\nFlaky test detection complete!');
    return this.analyzeResults();
  }

  /**
   * Execute a single test run
   */
  async executeTestRun(runNumber) {
    const startTime = Date.now();
    
    try {
      // Run tests and capture output
      execSync(this.testCommand, {
        stdio: 'pipe',
        encoding: 'utf-8',
        cwd: process.cwd()
      });

      // If we get here, all tests passed
      return {
        run: runNumber,
        timestamp: new Date().toISOString(),
        success: true,
        totalTests: null, // Will be filled from JSON if available
        passedTests: null,
        failedTests: 0,
        failures: [],
        duration: Date.now() - startTime
      };
    } catch (error) {
      // Test run failed, parse the output
      const result = {
        run: runNumber,
        timestamp: new Date().toISOString(),
        success: false,
        failures: [],
        duration: Date.now() - startTime
      };

      // Try to parse Jest JSON output
      try {
        const jsonPath = path.join(process.cwd(), 'test-results.json');
        if (fs.existsSync(jsonPath)) {
          const testResults = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          result.totalTests = testResults.numTotalTests;
          result.passedTests = testResults.numPassedTests;
          result.failedTests = testResults.numFailedTests;

          // Extract failure details
          testResults.testResults.forEach(fileResult => {
            fileResult.assertionResults.forEach(testResult => {
              if (testResult.status === 'failed') {
                result.failures.push({
                  testName: testResult.fullName || testResult.title,
                  testFile: fileResult.name,
                  errorMessage: testResult.failureMessages ? testResult.failureMessages.join('\n') : 'Unknown error',
                  stackTrace: testResult.failureMessages ? testResult.failureMessages.join('\n') : ''
                });
              }
            });
          });

          // Clean up JSON file
          fs.removeSync(jsonPath);
        }
      } catch (parseError) {
        console.error(`Warning: Could not parse test results for run ${runNumber}`);
      }

      // Fallback: parse from stderr if JSON not available
      if (result.failures.length === 0 && error.stderr) {
        result.failures = this.parseFailuresFromOutput(error.stderr.toString());
      }

      return result;
    }
  }

  /**
   * Parse test failures from Jest output (fallback method)
   */
  parseFailuresFromOutput(output) {
    const failures = [];
    const lines = output.split('\n');
    
    let currentTest = null;
    let currentFile = null;
    
    for (const line of lines) {
      // Match test file
      const fileMatch = line.match(/FAIL\s+(.+\.test\.js)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
      }
      
      // Match test name
      const testMatch = line.match(/●\s+(.+)/);
      if (testMatch && currentFile) {
        currentTest = testMatch[1].trim();
      }
      
      // Match error message
      if (currentTest && line.includes('expect(')) {
        failures.push({
          testName: currentTest,
          testFile: currentFile,
          errorMessage: line.trim(),
          stackTrace: ''
        });
        currentTest = null;
      }
    }
    
    return failures;
  }

  /**
   * Analyze results and identify flaky tests
   */
  analyzeResults() {
    const analysis = {
      totalRuns: this.runs,
      successfulRuns: this.results.filter(r => r.success).length,
      failedRuns: this.results.filter(r => !r.success).length,
      flakyTests: []
    };

    // Process each flaky test
    this.flakyTests.forEach((testData, key) => {
      const failureCount = testData.failures.length;
      const passCount = testData.totalRuns - failureCount;
      
      // Only include tests that failed at least once but also passed at least once
      if (failureCount > 0 && passCount > 0) {
        analysis.flakyTests.push({
          testName: testData.testName,
          testFile: testData.testFile,
          totalRuns: testData.totalRuns,
          failures: failureCount,
          passes: passCount,
          failureRate: `${((failureCount / testData.totalRuns) * 100).toFixed(1)}%`,
          failurePattern: this.determineFailurePattern(testData.failures, testData.totalRuns),
          failureDetails: testData.failures,
          rootCauses: this.analyzeRootCauses(testData)
        });
      }
    });

    return analysis;
  }

  /**
   * Determine the pattern of failures (intermittent, clustered, etc.)
   */
  determineFailurePattern(failures, totalRuns) {
    if (failures.length === 0) return 'none';
    if (failures.length === totalRuns) return 'consistent';
    
    // Check if failures are clustered
    const runNumbers = failures.map(f => f.run).sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < runNumbers.length; i++) {
      maxGap = Math.max(maxGap, runNumbers[i] - runNumbers[i - 1]);
    }
    
    if (maxGap > totalRuns / 2) {
      return 'clustered';
    }
    
    return 'intermittent';
  }

  /**
   * Analyze root causes based on error messages and test file
   */
  analyzeRootCauses(testData) {
    const causes = [];
    const errorMessages = testData.failures.map(f => f.errorMessage).join(' ');
    
    // Check for timing issues
    if (errorMessages.includes('timeout') || errorMessages.includes('Timeout')) {
      causes.push({
        type: 'timing',
        description: 'Test timeout - operation took longer than expected',
        recommendation: 'Increase timeout values or use condition-based waiting'
      });
    }
    
    if (errorMessages.includes('debounce') || testData.testFile.includes('debounce')) {
      causes.push({
        type: 'timing',
        description: 'Debounce timing issue - fixed delay insufficient',
        recommendation: 'Use waitForDebounce() helper instead of setTimeout'
      });
    }
    
    if (testData.testFile.includes('file-watcher') || testData.testFile.includes('watch')) {
      causes.push({
        type: 'file-system',
        description: 'File system operation timing - events may not propagate immediately',
        recommendation: 'Increase wait times and use waitForFileSystemEvent() helper'
      });
    }
    
    if (errorMessages.includes('retry') || testData.testFile.includes('action-executor')) {
      causes.push({
        type: 'timing',
        description: 'Retry logic timing - insufficient time for retries to complete',
        recommendation: 'Increase retry timeouts and use waitForCondition() for verification'
      });
    }
    
    // Check for race conditions
    if (errorMessages.includes('Expected') && errorMessages.includes('Received')) {
      causes.push({
        type: 'race-condition',
        description: 'Assertion made before async operation completed',
        recommendation: 'Ensure all promises are properly awaited before assertions'
      });
    }
    
    // Default if no specific cause identified
    if (causes.length === 0) {
      causes.push({
        type: 'unknown',
        description: 'Root cause requires manual investigation',
        recommendation: 'Review test code for timing assumptions and async handling'
      });
    }
    
    return causes;
  }

  /**
   * Generate detailed report in multiple formats
   */
  generateReport(outputDir) {
    const analysis = this.analyzeResults();
    
    // Ensure output directory exists
    fs.ensureDirSync(outputDir);
    
    // Generate JSON report
    const jsonPath = path.join(outputDir, 'flaky-tests-report.json');
    fs.writeJsonSync(jsonPath, analysis, { spaces: 2 });
    console.log(`\nJSON report saved to: ${jsonPath}`);
    
    // Generate Markdown report
    const mdPath = path.join(outputDir, 'flaky-tests-report.md');
    const markdown = this.generateMarkdownReport(analysis);
    fs.writeFileSync(mdPath, markdown);
    console.log(`Markdown report saved to: ${mdPath}`);
    
    // Print summary to console
    this.printSummary(analysis);
    
    return analysis;
  }

  /**
   * Generate Markdown formatted report
   */
  generateMarkdownReport(analysis) {
    let md = '# Flaky Test Detection Report\n\n';
    md += `**Generated**: ${new Date().toISOString()}\n\n`;
    md += `**Total Runs**: ${analysis.totalRuns}\n`;
    md += `**Successful Runs**: ${analysis.successfulRuns}\n`;
    md += `**Failed Runs**: ${analysis.failedRuns}\n`;
    md += `**Flaky Tests Found**: ${analysis.flakyTests.length}\n\n`;
    
    if (analysis.flakyTests.length === 0) {
      md += '## ✅ No Flaky Tests Detected\n\n';
      md += 'All tests passed consistently across all runs.\n';
      return md;
    }
    
    md += '## Flaky Tests\n\n';
    
    analysis.flakyTests.forEach((test, index) => {
      md += `### ${index + 1}. ${test.testName}\n\n`;
      md += `**File**: \`${test.testFile}\`\n\n`;
      md += `**Statistics**:\n`;
      md += `- Total Runs: ${test.totalRuns}\n`;
      md += `- Failures: ${test.failures}\n`;
      md += `- Passes: ${test.passes}\n`;
      md += `- Failure Rate: ${test.failureRate}\n`;
      md += `- Pattern: ${test.failurePattern}\n\n`;
      
      md += `**Root Causes**:\n`;
      test.rootCauses.forEach(cause => {
        md += `- **${cause.type}**: ${cause.description}\n`;
        md += `  - *Recommendation*: ${cause.recommendation}\n`;
      });
      md += '\n';
      
      md += `**Failure Details**:\n`;
      test.failureDetails.slice(0, 3).forEach(failure => {
        md += `- Run ${failure.run}: ${failure.errorMessage.substring(0, 200)}...\n`;
      });
      if (test.failureDetails.length > 3) {
        md += `- ... and ${test.failureDetails.length - 3} more failures\n`;
      }
      md += '\n---\n\n';
    });
    
    return md;
  }

  /**
   * Print summary to console
   */
  printSummary(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('FLAKY TEST DETECTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Runs: ${analysis.totalRuns}`);
    console.log(`Successful Runs: ${analysis.successfulRuns}`);
    console.log(`Failed Runs: ${analysis.failedRuns}`);
    console.log(`Flaky Tests Found: ${analysis.flakyTests.length}`);
    console.log('='.repeat(60));
    
    if (analysis.flakyTests.length > 0) {
      console.log('\nFlaky Tests:');
      analysis.flakyTests.forEach((test, index) => {
        console.log(`\n${index + 1}. ${test.testName}`);
        console.log(`   File: ${test.testFile}`);
        console.log(`   Failure Rate: ${test.failureRate} (${test.failures}/${test.totalRuns})`);
        console.log(`   Pattern: ${test.failurePattern}`);
      });
    } else {
      console.log('\n✅ No flaky tests detected!');
    }
    console.log('\n');
  }
}

module.exports = FlakyTestDetector;
