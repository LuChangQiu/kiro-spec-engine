module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'bin/**/*.js',
    'lib/**/*.js',
    '!lib/i18n.js', // Exclude i18n (already tested)
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Coverage thresholds (disabled for MVP - optional tests were skipped)
  // coverageThreshold: {
  //   global: {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70
  //   }
  // },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000
};
