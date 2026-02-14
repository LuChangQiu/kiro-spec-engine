/**
 * Jest Configuration for CI/CD Pipeline
 * 
 * Optimized for fast feedback in CI environment:
 * - Runs only integration tests
 * - Skips slow unit tests
 * - Parallel execution
 * - Minimal output
 */

module.exports = {
  ...require('./jest.config.js'),
  
  // Run only integration tests in CI
  testMatch: [
    '**/tests/integration/**/*.test.js'
  ],
  
  // Maximize parallelization
  maxWorkers: '100%',
  
  // Minimal output for CI logs
  verbose: false,
  
  // Fail fast on first error
  bail: 1,
  
  // Shorter timeout for CI
  testTimeout: 10000,
  
  // Coverage not needed in CI (run separately)
  collectCoverage: false
};
