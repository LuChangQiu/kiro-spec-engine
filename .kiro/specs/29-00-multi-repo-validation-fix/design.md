# Design Document

## Overview

This design addresses a critical bug in the multi-repository validation logic where valid, non-overlapping repository configurations are incorrectly rejected. The root cause is that the `_validatePaths()` method in ConfigManager doesn't distinguish between independent repositories (no overlap) and nested repositories (overlap exists), causing it to incorrectly apply strict validation to all multi-repository configurations.

The fix improves the validation logic to:
1. Detect whether paths actually overlap before applying strict validation
2. Allow independent repositories regardless of `nestedMode` setting
3. Only require `nestedMode: true` when paths actually overlap
4. Provide clear, actionable error messages

## Architecture

### Component Overview

The fix involves modifying the validation flow in ConfigManager:

```
ConfigManager.validateConfig()
  ↓
  _validatePaths(paths, nestedMode)
    ↓
    PathResolver.validateNoOverlap(paths)
      ↓
      Returns: { valid, errors }
    ↓
    Analyze errors to distinguish:
      - Duplicate paths (always invalid)
      - Nested paths (invalid only if nestedMode=false)
      - No overlap (always valid)
```

### Key Changes

1. **Enhanced `_validatePaths()` method**: Add logic to distinguish between duplicate and nested path errors
2. **Improved error messages**: Provide specific, actionable feedback
3. **Comprehensive test coverage**: Add tests for all multi-repository scenarios

## Components and Interfaces

### ConfigManager._validatePaths()

**Current Signature**:
```javascript
_validatePaths(paths, allowNested = false)
```

**Enhanced Logic**:
```javascript
_validatePaths(paths, allowNested = false) {
  const errors = [];
  
  // Resolve paths to absolute
  const resolvedPaths = paths.map(p => {
    try {
      return this.pathResolver.resolvePath(p, this.projectRoot);
    } catch (error) {
      return p;
    }
  });
  
  // Check for overlaps
  const pathValidation = this.pathResolver.validateNoOverlap(resolvedPaths);
  
  if (!pathValidation.valid) {
    // Categorize errors
    const duplicateErrors = [];
    const nestedErrors = [];
    
    pathValidation.errors.forEach(error => {
      if (error.includes('Duplicate path')) {
        duplicateErrors.push(error);
      } else if (error.includes('nested within')) {
        nestedErrors.push(error);
      }
    });
    
    // Always report duplicate paths
    errors.push(...duplicateErrors);
    
    // Report nested paths only if nestedMode is not enabled
    if (nestedErrors.length > 0 && !allowNested) {
      errors.push(...nestedErrors);
      errors.push(
        'Hint: Enable nestedMode in settings to allow nested repositories: ' +
        '{ "settings": { "nestedMode": true } }'
      );
    }
  }
  
  return { errors };
}
```

### Error Message Improvements

**Current Error Messages**:
- Generic: "Path X is nested within Y"
- No context or suggestions

**Enhanced Error Messages**:
- Specific: "Path 'backend/runtime/component/HiveMind' is nested within 'backend'"
- Actionable: "Hint: Enable nestedMode in settings to allow nested repositories"
- Grouped: Separate duplicate errors from nested errors

## Data Models

### Configuration Schema (Unchanged)

```javascript
{
  version: "1.0",
  repositories: [
    {
      name: string,
      path: string,
      remote: string | null,
      defaultBranch: string,
      parent: string | null,
      description: string,
      tags: string[],
      group: string
    }
  ],
  settings: {
    nestedMode: boolean  // Key field for this fix
  },
  groups: {
    [groupName]: {
      description: string
    }
  }
}
```

### Validation Flow

```
Input: config object
  ↓
1. Validate structure (version, repositories array)
  ↓
2. Validate each repository (required fields, types)
  ↓
3. Check for duplicate names
  ↓
4. Validate parent references
  ↓
5. Validate paths (ENHANCED)
   ├─ Resolve to absolute paths
   ├─ Check for duplicates (always invalid)
   ├─ Check for nesting (invalid only if nestedMode=false)
   └─ Return categorized errors
  ↓
Output: { valid: boolean, errors: string[] }
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Independent Repositories Always Valid

*For any* configuration with non-overlapping repository paths, validation should pass regardless of the `nestedMode` setting (true, false, or undefined).

**Validates: Requirements 1.1, 3.1, 3.4**

### Property 2: Nested Repositories Valid with nestedMode

*For any* configuration with overlapping repository paths where `nestedMode` is true, validation should pass.

**Validates: Requirements 1.2, 3.3, 4.2**

### Property 3: Nested Repositories Invalid without nestedMode

*For any* configuration with overlapping repository paths where `nestedMode` is false or undefined, validation should fail with an error indicating nested paths are not allowed.

**Validates: Requirements 1.3, 3.3, 4.2, 4.3**

### Property 4: Error Messages Specify Validation Rule

*For any* invalid configuration, the error message should clearly indicate which validation rule failed (e.g., "nested within", "duplicate path", "missing field").

**Validates: Requirements 2.1**

### Property 5: Nested Path Errors Show Conflicting Paths

*For any* configuration with overlapping paths, the error message should include both the child path and the parent path.

**Validates: Requirements 2.2**

### Property 6: Missing Field Errors List Fields

*For any* repository with missing required fields, the error message should list all missing fields.

**Validates: Requirements 2.3**

## Error Handling

### Error Categories

1. **Duplicate Path Errors**: Always invalid, regardless of nestedMode
   - Message: "Duplicate path found: {path}"
   - Action: Remove duplicate or rename path

2. **Nested Path Errors**: Invalid only when nestedMode is false/undefined
   - Message: "Path '{child}' is nested within '{parent}'"
   - Hint: "Enable nestedMode in settings to allow nested repositories"
   - Action: Either enable nestedMode or restructure paths

3. **Missing Field Errors**: Invalid repository configuration
   - Message: "Repository at index {i}: missing required field '{field}'"
   - Action: Add missing field

4. **Invalid Parent Reference**: Parent path doesn't exist
   - Message: "Repository '{name}': parent path '{parent}' does not reference an existing repository"
   - Action: Fix parent reference or remove it

### Error Message Format

```javascript
// Example error output for nested paths without nestedMode
{
  valid: false,
  errors: [
    "Path 'backend/runtime/component/HiveMind' is nested within 'backend'",
    "Hint: Enable nestedMode in settings to allow nested repositories: { \"settings\": { \"nestedMode\": true } }"
  ]
}
```

### Error Handling Flow

```
Validation Error Detected
  ↓
Categorize Error Type
  ├─ Duplicate Path → Always report
  ├─ Nested Path → Report only if nestedMode=false
  ├─ Missing Field → Always report
  └─ Invalid Parent → Always report
  ↓
Add Contextual Hints
  ├─ Nested Path → Suggest enabling nestedMode
  ├─ Invalid Parent → Show available paths
  └─ Missing Field → List required fields
  ↓
Return Grouped Errors
```

## Testing Strategy

### Dual Testing Approach

This fix requires both unit tests and property-based tests:

**Unit Tests**: Verify specific examples and edge cases
- Test user-reported configurations (4 test cases from requirements)
- Test backward compatibility with v1.20.2 configs
- Test default behavior when nestedMode is undefined
- Test error message content and format
- Test parent reference validation

**Property Tests**: Verify universal properties across all inputs
- Property 1: Generate random non-overlapping path configs, verify all pass
- Property 2: Generate random nested path configs with nestedMode=true, verify all pass
- Property 3: Generate random nested path configs with nestedMode=false, verify all fail
- Property 4: Generate random invalid configs, verify error messages specify rules
- Property 5: Generate random nested path configs, verify error messages show both paths
- Property 6: Generate random configs with missing fields, verify error messages list fields

### Test Configuration

- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: multi-repo-validation-fix, Property {number}: {property_text}**

### Test Coverage Requirements

1. **Multi-Repository Scenarios**:
   - 2 independent repositories
   - 8 independent repositories
   - 2 nested repositories (with/without nestedMode)
   - Mixed independent and nested repositories

2. **Edge Cases**:
   - Empty path handling
   - Root directory paths
   - Paths with dots (`.github`, `.kiro`)
   - Windows vs Unix path separators

3. **Error Scenarios**:
   - Duplicate paths
   - Nested paths without nestedMode
   - Missing required fields
   - Invalid parent references
   - Multiple errors in single config

4. **Backward Compatibility**:
   - v1.20.2 configurations
   - v1.20.3 configurations with nestedMode
   - Configurations without settings object

### Integration Points

The fix integrates with existing components:
- **PathResolver**: No changes needed, already provides correct overlap detection
- **ConfigManager**: Enhanced `_validatePaths()` method
- **Existing Tests**: All existing tests must pass without modification

## Implementation Notes

### Key Implementation Details

1. **Error Categorization**: Use string matching to distinguish between "Duplicate path" and "nested within" errors from PathResolver

2. **Hint Messages**: Add contextual hints only when relevant (e.g., nestedMode hint only for nested path errors)

3. **Backward Compatibility**: Ensure undefined nestedMode behaves identically to false

4. **Test Data**: Use the 4 user-reported test cases as unit tests to prevent regression

### Performance Considerations

- Path validation is O(n²) where n is the number of repositories
- For typical use cases (< 100 repositories), performance impact is negligible
- No caching needed for validation results

### Security Considerations

- Path validation prevents directory traversal attacks
- Absolute path resolution ensures paths stay within project boundaries
- No new security concerns introduced by this fix

## Version Update

- Update `package.json` version to `1.20.4`
- Update `CHANGELOG.md` with hotfix details
- Mark as hotfix release in changelog
- Reference user bug report in changelog
