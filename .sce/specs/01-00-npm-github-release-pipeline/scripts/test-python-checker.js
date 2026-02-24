#!/usr/bin/env node

/**
 * Manual test script for Python checker module
 * 
 * This script tests the Python checker functionality to verify:
 * - Python detection works correctly
 * - Version parsing works correctly
 * - OS-specific installation instructions are provided
 * - Error messages are properly localized
 */

const path = require('path');
// Navigate from .sce/specs/01-00-npm-github-release-pipeline/scripts/ to root lib/
const pythonChecker = require(path.join(__dirname, '../../../../lib/python-checker'));
const chalk = require('chalk');

console.log(chalk.blue('=== Python Checker Module Test ===\n'));

// Test 1: Check Python availability
console.log(chalk.yellow('Test 1: Check Python availability'));
const status = pythonChecker.checkPython();
console.log('Result:', JSON.stringify(status, null, 2));
console.log();

// Test 2: Parse version strings
console.log(chalk.yellow('Test 2: Parse version strings'));
const testVersions = [
  'Python 3.10.0',
  'Python 3.8.5',
  'Python 3.7.9',
  'Python 2.7.18',
  'Invalid version string',
  null,
  ''
];

testVersions.forEach(version => {
  const parsed = pythonChecker.parseVersion(version);
  console.log(`Input: "${version}"`);
  console.log(`Parsed:`, parsed);
  console.log();
});

// Test 3: Get installation instructions
console.log(chalk.yellow('Test 3: Get installation instructions'));
const instructions = pythonChecker.getInstallInstructions();
console.log('Platform:', process.platform);
console.log('Instructions:');
console.log(instructions);
console.log();

// Test 4: Get error message
console.log(chalk.yellow('Test 4: Get error message'));
const errorMessage = pythonChecker.getErrorMessage();
if (errorMessage) {
  console.log('Error message:');
  console.log(errorMessage);
} else {
  console.log(chalk.green('No error - Python is available!'));
}
console.log();

// Test 5: Version requirement checking
console.log(chalk.yellow('Test 5: Version requirement checking'));
const testCases = [
  { major: 3, minor: 8, expected: true },
  { major: 3, minor: 9, expected: true },
  { major: 3, minor: 10, expected: true },
  { major: 3, minor: 7, expected: false },
  { major: 2, minor: 7, expected: false },
  { major: 4, minor: 0, expected: true }
];

testCases.forEach(({ major, minor, expected }) => {
  const result = pythonChecker.meetsVersionRequirement(major, minor);
  const status = result === expected ? chalk.green('✓') : chalk.red('✗');
  console.log(`${status} Python ${major}.${minor} - Expected: ${expected}, Got: ${result}`);
});
console.log();

console.log(chalk.blue('=== Test Complete ==='));
