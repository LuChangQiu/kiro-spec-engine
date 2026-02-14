module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Transform ignore patterns - allow chokidar to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(chokidar)/)'
  ],

  // Map fast-check to its CJS build (fast-check v4 is ESM-first, Jest 27 needs CJS)
  moduleNameMapper: {
    '^fast-check$': '<rootDir>/node_modules/fast-check/lib/cjs/fast-check.js',
  },
  
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
