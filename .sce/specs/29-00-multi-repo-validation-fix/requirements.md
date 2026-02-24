# Requirements Document

## Introduction

This spec addresses a critical validation bug discovered in v1.20.3 where multi-repository configurations fail validation even with valid, non-overlapping repository paths. The issue affects users trying to manage multiple independent repositories in a single project.

## Glossary

- **Multi_Repository_Configuration**: A configuration with 2 or more repositories
- **Independent_Repositories**: Repositories with non-overlapping paths (e.g., `backend/`, `frontend/`)
- **Nested_Repositories**: Repositories where one path is a subdirectory of another (e.g., `backend/` and `backend/runtime/component/HiveMind/`)
- **Path_Overlap**: When one repository path is a subdirectory of another
- **Validation_Context**: The mode (nested or non-nested) that determines validation rules

## Requirements

### Requirement 1: Fix Multi-Repository Validation Logic

**User Story:** As a developer, I want to configure multiple independent repositories, so that I can manage all my project's repositories in one place.

#### Acceptance Criteria

1. WHEN repositories have non-overlapping paths, THE System SHALL accept the configuration regardless of `nestedMode` setting
2. WHEN repositories have overlapping paths AND `nestedMode` is true, THE System SHALL accept the configuration
3. WHEN repositories have overlapping paths AND `nestedMode` is false or undefined, THE System SHALL reject the configuration
4. THE System SHALL validate each repository independently before checking path relationships

### Requirement 2: Improve Error Message Clarity

**User Story:** As a developer, I want detailed error messages when validation fails, so that I can quickly identify and fix the issue.

#### Acceptance Criteria

1. WHEN validation fails, THE Error_Message SHALL specify which validation rule failed
2. WHEN path overlap is detected, THE Error_Message SHALL show the conflicting paths
3. WHEN a repository is missing required fields, THE Error_Message SHALL list the missing fields
4. WHEN multiple errors exist, THE Error_Message SHALL group errors by repository and type
5. THE Error_Message SHALL suggest solutions (e.g., "Enable nestedMode for nested repositories")

### Requirement 3: Support Common Multi-Repository Patterns

**User Story:** As a developer, I want to use common repository organization patterns, so that my workflow matches industry standards.

#### Acceptance Criteria

1. WHEN using independent repositories (e.g., `backend/`, `frontend/`, `docs/`), THE System SHALL accept the configuration
2. WHEN using nested repositories with parent references, THE System SHALL validate parent-child relationships
3. WHEN using nested repositories without parent references, THE System SHALL require `nestedMode: true`
4. THE System SHALL support both flat and hierarchical repository structures

### Requirement 4: Maintain Backward Compatibility

**User Story:** As a developer with existing configurations, I want the fix to work with my current setup, so that nothing breaks.

#### Acceptance Criteria

1. WHEN loading v1.20.2 configurations, THE System SHALL process them successfully
2. WHEN loading v1.20.3 configurations with `nestedMode`, THE System SHALL honor the setting
3. WHEN `nestedMode` is undefined, THE System SHALL default to false (strict validation)
4. ALL existing tests SHALL pass without modification

### Requirement 5: Add Comprehensive Test Coverage

**User Story:** As a developer, I want comprehensive tests for multi-repository scenarios, so that this bug doesn't happen again.

#### Acceptance Criteria

1. THE Test_Suite SHALL include tests for 2+ independent repositories
2. THE Test_Suite SHALL include tests for nested repositories with `nestedMode: true`
3. THE Test_Suite SHALL include tests for nested repositories with `nestedMode: false` (should fail)
4. THE Test_Suite SHALL include tests for the user's reported configuration
5. THE Test_Suite SHALL include tests for parent-child relationships

### Requirement 6: Version Update

**User Story:** As a user, I want to know this is a hotfix release, so that I understand it's a critical bug fix.

#### Acceptance Criteria

1. THE System SHALL update package.json version to 1.20.4
2. THE System SHALL update CHANGELOG.md with hotfix details
3. THE CHANGELOG SHALL clearly mark this as a hotfix release
4. THE CHANGELOG SHALL reference the user's bug report and test case

## Test Cases from User Report

### Test Case 1: Two Independent Repositories (No Parent)
```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "backend",
      "path": "backend",
      "remote": "https://github.com/heguangyong/moqui-framework.git",
      "defaultBranch": "master",
      "parent": null
    },
    {
      "name": "frontend",
      "path": "frontend",
      "remote": "https://github.com/user/frontend.git",
      "defaultBranch": "main",
      "parent": null
    }
  ]
}
```
**Expected**: ✅ Should pass validation (independent paths)

### Test Case 2: Two Nested Repositories (No Parent Reference)
```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "backend",
      "path": "backend",
      "remote": "https://github.com/heguangyong/moqui-framework.git",
      "defaultBranch": "master",
      "parent": null
    },
    {
      "name": "HiveMind",
      "path": "backend/runtime/component/HiveMind",
      "remote": "https://github.com/moqui/HiveMind.git",
      "defaultBranch": "master",
      "parent": null
    }
  ]
}
```
**Expected**: ❌ Should fail validation (nested paths without `nestedMode: true`)

### Test Case 3: Two Nested Repositories (With nestedMode)
```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "backend",
      "path": "backend",
      "remote": "https://github.com/heguangyong/moqui-framework.git",
      "defaultBranch": "master",
      "parent": null
    },
    {
      "name": "HiveMind",
      "path": "backend/runtime/component/HiveMind",
      "remote": "https://github.com/moqui/HiveMind.git",
      "defaultBranch": "master",
      "parent": null
    }
  ],
  "settings": {
    "nestedMode": true
  }
}
```
**Expected**: ✅ Should pass validation (nested paths with `nestedMode: true`)

### Test Case 4: Eight Independent Repositories
```json
{
  "version": "1.0",
  "repositories": [
    { "name": "repo1", "path": "repo1" },
    { "name": "repo2", "path": "repo2" },
    { "name": "repo3", "path": "repo3" },
    { "name": "repo4", "path": "repo4" },
    { "name": "repo5", "path": "repo5" },
    { "name": "repo6", "path": "repo6" },
    { "name": "repo7", "path": "repo7" },
    { "name": "repo8", "path": "repo8" }
  ]
}
```
**Expected**: ✅ Should pass validation (all independent paths)

## Root Cause Analysis

### Current Behavior (v1.20.3)

The `_validatePaths()` method in ConfigManager:
1. Calls `pathResolver.validateNoOverlap()` for all paths
2. If `allowNested === true`, filters out "nested within" errors
3. If `allowNested === false`, reports all errors including "nested within"

**Problem**: The method treats ALL multi-repository configs as potentially problematic, even when paths don't overlap.

### Expected Behavior

The validation should:
1. Check if paths actually overlap before applying strict validation
2. Allow independent repositories regardless of `nestedMode`
3. Only enforce `nestedMode` requirement when paths actually overlap
4. Provide clear error messages indicating the specific issue

### Fix Strategy

1. **Improve `_validatePaths()` logic**:
   - Distinguish between duplicate paths and nested paths
   - Only apply `nestedMode` check when paths actually overlap
   - Allow independent repositories without requiring `nestedMode`

2. **Enhance error messages**:
   - Show which specific paths conflict
   - Suggest enabling `nestedMode` when nested paths detected
   - Group errors by type for clarity

3. **Add comprehensive tests**:
   - Test all user-reported scenarios
   - Test edge cases (empty paths, root paths, etc.)
   - Test error message content
