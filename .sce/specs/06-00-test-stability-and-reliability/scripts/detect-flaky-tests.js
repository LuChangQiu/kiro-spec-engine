#!/usr/bin/env node

/**
 * Flaky Test Detection Script
 * 
 * Executes the test suite multiple times to identify tests that fail intermittently.
 * Generates detailed reports with failure patterns and root cause analysis.
 * 
 * Usage:
 *   node detect-flaky-tests.js [options]
 * 
 * Options:
 *   --runs <number>       Number of test runs (default: 20)
 *   --output <directory>  Output directory for reports (default: ../reports)
 *   --command <string>    Test command to execute (default: npm test)
 */

const FlakyTestDetector = require('./flaky-test-detector');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    runs: 20,
    output: path.join(__dirname, '../reports'),
    command: 'npm test'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--runs':
        options.runs = parseInt(args[++i], 10);
        if (isNaN(options.runs) || options.runs < 1) {
          console.error('Error: --runs must be a positive number');
          process.exit(1);
        }
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--command':
        options.command = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Flaky Test Detection Script

Executes the test suite multiple times to identify tests that fail intermittently.

Usage:
  node detect-flaky-tests.js [options]

Options:
  --runs <number>       Number of test runs (default: 20)
  --output <directory>  Output directory for reports (default: ../reports)
  --command <string>    Test command to execute (default: npm test)
  --help, -h            Show this help message

Examples:
  node detect-flaky-tests.js
  node detect-flaky-tests.js --runs 50
  node detect-flaky-tests.js --runs 10 --output ./my-reports
  node detect-flaky-tests.js --command "npm test -- --testPathPattern=unit"
`);
}

// Main execution
async function main() {
  const options = parseArgs();

  console.log('Flaky Test Detection');
  console.log('='.repeat(60));
  console.log(`Runs: ${options.runs}`);
  console.log(`Output: ${options.output}`);
  console.log(`Command: ${options.command}`);
  console.log('='.repeat(60));
  console.log('');

  const detector = new FlakyTestDetector({
    runs: options.runs,
    testCommand: options.command
  });

  try {
    // Run detection
    await detector.detectFlakyTests();

    // Generate reports
    const analysis = detector.generateReport(options.output);

    // Exit with appropriate code
    if (analysis.flakyTests.length > 0) {
      console.log(`\n⚠️  Found ${analysis.flakyTests.length} flaky test(s)`);
      console.log('Review the reports for details and recommendations.');
      process.exit(1);
    } else {
      console.log('\n✅ No flaky tests detected!');
      console.log('All tests passed consistently across all runs.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error during flaky test detection:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
