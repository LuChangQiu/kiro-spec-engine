# Integration Tests

This directory contains end-to-end integration tests for the Scene Capability Engine (sce).

## Overview

Integration tests validate complete workflows using real file system operations and multiple components working together. Unlike unit tests which test individual functions in isolation, integration tests ensure that different parts of the system work correctly together.

## Test Organization

```
tests/integration/
├── workspace-integration.test.js    # Workspace management, status, doctor
├── watch-mode-integration.test.js   # File watching and automation
└── README.md                        # This file
```

## Test Infrastructure

### IntegrationTestFixture

Located in `tests/fixtures/integration-test-fixture.js`

Provides test environment setup and teardown:
- Creates isolated test directories
- Manages .kiro directory structure
- Provides helper methods for common operations
- Ensures proper cleanup after tests

**Example Usage**:
```javascript
const fixture = new IntegrationTestFixture('my-test');
await fixture.setup();

// Create a spec
await fixture.createSpec('01-00-feature', {
  requirements: '# Requirements\n...',
  design: '# Design\n...',
  tasks: '# Tasks\n...'
});

// Cleanup
await fixture.cleanup();
```

### CommandTestHelper

Located in `tests/helpers/command-test-helper.js`

Provides utilities for command execution and validation:
- Execute commands in test environment
- Capture stdout/stderr
- Validate output patterns
- Handle timeouts and errors

**Example Usage**:
```javascript
const helper = new CommandTestHelper(fixture);

const result = await helper.executeCommand('workspace-multi', ['list']);
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('workspace-name');
```

## Writing Integration Tests

### Basic Pattern

```javascript
describe('Feature Integration', () => {
  let fixture;
  let helper;

  beforeEach(async () => {
    fixture = new IntegrationTestFixture(`test-${Date.now()}`);
    await fixture.setup();
    helper = new CommandTestHelper(fixture);
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  test('should perform end-to-end workflow', async () => {
    // Arrange: Set up test data
    await fixture.createSpec('test-spec', {
      requirements: '# Test Requirements'
    });

    // Act: Execute the workflow
    const result = await helper.executeCommand('command', ['args']);

    // Assert: Verify results
    expect(result.exitCode).toBe(0);
    expect(await fixture.fileExists('.kiro/output.txt')).toBe(true);
  });
});
```

### Best Practices

1. **Test Isolation**
   - Use unique fixture names (include timestamp)
   - Create new fixtures for each test
   - Clean up in afterEach

2. **Real Operations**
   - Use real file system operations (no mocks)
   - Test actual command execution
   - Verify side effects (files created, state changed)

3. **Clear Assertions**
   - Use descriptive test names
   - Test one workflow per test
   - Include both success and error cases

4. **Performance**
   - Keep tests under 5 seconds each
   - Use efficient setup/teardown
   - Avoid unnecessary delays

5. **Error Handling**
   - Test error conditions
   - Verify error messages
   - Ensure graceful cleanup on failure

## Test Patterns

### Testing Workspace Operations

```javascript
test('should create and register workspace', async () => {
  const workspaceName = 'test-workspace';
  const workspacePath = await createValidWorkspaceDir('ws');

  const workspace = await stateManager.createWorkspace(workspaceName, workspacePath);

  expect(workspace.name).toBe(workspaceName);
  expect(path.normalize(workspace.path)).toBe(path.normalize(workspacePath));
});
```

### Testing Command Output

```javascript
test('should display status correctly', async () => {
  await fixture.createSpec('01-00-test', {
    requirements: '# Requirements'
  });

  const specs = await fixture.getSpecs();
  expect(specs).toContain('01-00-test');
});
```

### Testing Error Conditions

```javascript
test('should reject invalid input', async () => {
  await expect(
    stateManager.switchWorkspace('non-existent')
  ).rejects.toThrow(/does not exist/i);
});
```

## Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/integration/workspace-integration.test.js

# Run with coverage
npm test -- tests/integration --coverage

# Run in watch mode (not recommended for integration tests)
npm test -- tests/integration --watch
```

## Performance Targets

- **Individual Test**: < 2 seconds
- **Test Suite**: < 5 seconds per file
- **Total Integration Tests**: < 20 seconds
- **Current Performance**: ~16.8 seconds ✅

## Debugging

### Enable Verbose Output

Set environment variable:
```bash
DEBUG=true npm test -- tests/integration
```

### Inspect Test Fixtures

Test fixtures are created in `tests/fixtures/integration-test/`:
- Each test creates a unique directory
- Directories are cleaned up after tests
- On failure, inspect the directory before cleanup

### Common Issues

1. **Path Separator Issues**
   - Use `path.normalize()` for cross-platform compatibility
   - Use `path.join()` instead of string concatenation

2. **Test Isolation**
   - Ensure each test uses unique fixtures
   - Don't share state between tests
   - Clean up properly in afterEach

3. **Timing Issues**
   - Use appropriate timeouts for long operations
   - Add small delays when testing timestamp-dependent behavior
   - Don't rely on exact timing

## Coverage

### Current Coverage (2026-01-29)

**Commands Tested**:
- ✅ workspace-multi (11 tests)
- ✅ status (3 tests)
- ✅ doctor (3 tests)
- ✅ watch (10 tests)

**Total**: 29 integration tests

**Commands Needing Tests**:
- adopt, upgrade, rollback
- task, context, prompt
- workflows, docs, ops

### Adding New Tests

When adding tests for new commands:

1. **Follow Existing Patterns**
   - Use IntegrationTestFixture
   - Use CommandTestHelper
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Test Critical Paths**
   - Happy path (success case)
   - Common error cases
   - Edge cases

3. **Keep Tests Focused**
   - One workflow per test
   - Clear test names
   - Minimal setup

4. **Maintain Performance**
   - Keep tests fast
   - Avoid unnecessary operations
   - Use efficient assertions

## References

- [Testing Strategy](../../docs/testing-strategy.md)
- [Spec 17-00: Test Suite Optimization](../../.kiro/specs/17-00-test-suite-optimization/)
- [Spec 18-00: Integration Test Expansion](../../.kiro/specs/18-00-integration-test-expansion/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---

**Last Updated**: 2026-01-29  
**Maintained by**: sce Development Team

