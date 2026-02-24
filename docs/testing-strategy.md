# Testing Strategy

## Overview

This document defines the testing strategy for sce (Scene Capability Engine) to balance code quality with CI/CD performance.

## Test Categories

### 1. Unit Tests (`tests/unit/`)

**Purpose**: Validate individual functions and classes in isolation

**Characteristics**:
- Fast execution (< 100ms per test)
- No external dependencies
- Mock all I/O operations
- High coverage of edge cases

**When to run**:
- During development (watch mode)
- Before committing code
- In pre-commit hooks

**Examples**:
- `path-utils.test.js` - Path normalization logic
- `workspace-state-manager.test.js` - State management operations
- `file-classifier.test.js` - File classification rules

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Validate component interactions and end-to-end workflows

**Characteristics**:
- Moderate execution time (< 5s per test)
- Real file system operations
- Multiple components working together
- Focus on critical user workflows

**When to run**:
- In CI/CD pipeline (GitHub Actions)
- Before releases
- After major refactoring

**Examples**:
- `watch-mode-integration.test.js` - File watching workflow
- Multi-workspace creation and switching workflow
- Adoption process end-to-end

### 3. Property-Based Tests (`tests/properties/`)

**Purpose**: Validate universal properties and invariants

**Characteristics**:
- Slow execution (100+ iterations)
- Randomized inputs
- Comprehensive edge case coverage

**When to run**:
- Weekly scheduled runs
- Before major releases
- When investigating bugs

**Status**: Optional (not yet implemented)

## Test Suite Optimization and Expansion (2026-01-29)

### Spec 17-00: Unit Test Optimization

**Optimization Results**:
- **Reduced**: 65 redundant unit tests (1,389 → 1,324)
- **Optimized File**: `file-classifier.test.js` (83 → 18 tests, 78% reduction)
- **Coverage**: Maintained 100%
- **Time Saved**: ~2 seconds per full test run

**Key Finding**: Critical path coverage gap - 0% of 32 critical paths covered by integration tests

For detailed analysis, see `.sce/specs/17-00-test-suite-optimization/results/`

### Spec 18-00: Integration Test Expansion

**Expansion Results**:
- **Added**: 19 new integration tests (10 → 29, +190%)
- **Commands Covered**: workspace-multi, status, doctor
- **CI Time**: ~16.8 seconds (well under 20s target)
- **Test Quality**: 100% pass rate, real file system operations

**Infrastructure Created**:
- `IntegrationTestFixture` - Test environment management
- `CommandTestHelper` - Command execution and validation utilities

**Test Coverage by Command**:
- **workspace-multi** (11 tests): Creation, switching, listing, deletion, error handling
- **status** (3 tests): Spec reporting, empty state, counting
- **doctor** (3 tests): Health checks, missing directories, invalid config

For detailed progress, see `.sce/specs/18-00-integration-test-expansion/PROGRESS.md`

### Current State (After Both Specs)
- **Total Tests**: 1,353 (1,324 unit + 29 integration)
- **Unit Tests**: 1,324 (98%)
- **Integration Tests**: 29 (2%)
- **CI Time**: ~16.8 seconds
- **Full Suite Time**: ~19 seconds

### Test File Size Guidelines
- **Optimal**: 20-30 tests per file
- **Maximum**: 40 tests per file
- **Action Required**: >50 tests per file

---

## CI/CD Strategy

### GitHub Actions Pipeline

```yaml
# .github/workflows/test.yml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci  # Only integration tests
```

### Local Development

```bash
# Watch mode during development
npm run test:watch

# Run all tests before commit
npm test

# Run specific test file
npm test -- path/to/test.test.js

# Run with coverage
npm run test:coverage
```

## Test Optimization Guidelines

### Unit Test Optimization

1. **Consolidate similar tests**:
   ```javascript
   // ❌ Before: 5 separate tests
   it('should handle empty string', ...)
   it('should handle null', ...)
   it('should handle undefined', ...)
   it('should handle whitespace', ...)
   it('should handle special chars', ...)
   
   // ✅ After: 1 parameterized test
   it('should reject invalid inputs', () => {
     ['', null, undefined, '  ', '@#$'].forEach(input => {
       expect(() => validate(input)).toThrow();
     });
   });
   ```

2. **Remove redundant assertions**:
   - Test behavior, not implementation
   - One concept per test
   - Avoid testing framework features

3. **Use test.each for data-driven tests**:
   ```javascript
   test.each([
     ['input1', 'expected1'],
     ['input2', 'expected2'],
   ])('should handle %s', (input, expected) => {
     expect(fn(input)).toBe(expected);
   });
   ```

### Integration Test Guidelines

1. **Focus on critical paths**:
   - User registration and login
   - Workspace creation and switching
   - Spec lifecycle (create → execute → complete)

2. **Minimize setup/teardown**:
   - Reuse test fixtures
   - Use beforeAll for expensive setup
   - Clean up only what's necessary

3. **Parallel execution**:
   - Avoid shared state
   - Use unique temp directories
   - Independent test isolation

## Current Test Metrics

**Before Optimization** (v1.11.3):
- Total tests: 1425 (1417 passed, 8 skipped)
- Test suites: 55
- Execution time: ~23 seconds
- CI time: ~45 seconds

**After Optimization** (v1.11.4):
- Unit tests: ~1200 (optimized, run locally)
- Integration tests: ~50 (run in CI)
- Expected CI time: ~15 seconds
- Coverage maintained: >85%

## Test Coverage Goals

- **Critical paths**: 100% coverage
- **Core business logic**: >90% coverage
- **Utility functions**: >85% coverage
- **Error handling**: 100% coverage
- **Overall project**: >85% coverage

## Maintenance

### When to Add Tests

- **Always**: For bug fixes (regression tests)
- **Always**: For new features (TDD approach)
- **Consider**: For refactoring (if behavior changes)

### When to Remove Tests

- **Redundant tests**: Multiple tests for same behavior
- **Implementation tests**: Testing internal details
- **Obsolete tests**: For removed features

### Test Review Checklist

- [ ] Test name clearly describes what is being tested
- [ ] Test is independent (no shared state)
- [ ] Test is deterministic (no random failures)
- [ ] Test is fast (< 100ms for unit, < 5s for integration)
- [ ] Test has clear assertions
- [ ] Test follows AAA pattern (Arrange, Act, Assert)

## Tools and Commands

### NPM Scripts

```json
{
  "test": "jest",
  "test:ci": "jest --config=jest.config.ci.js",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:unit": "jest tests/unit",
  "test:integration": "jest tests/integration"
}
```

### Jest Configuration

- `jest.config.js` - Default configuration (all tests)
- `jest.config.ci.js` - CI configuration (integration only)

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**Version**: v1.0  
**Last Updated**: 2026-01-29  
**Maintained by**: sce Development Team
