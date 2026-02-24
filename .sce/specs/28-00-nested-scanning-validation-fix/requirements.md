# Requirements Document

## Introduction

This hotfix addresses critical validation issues discovered in v1.20.2 testing. The nested repository scanning feature discovers repositories correctly but fails to save due to overly strict validation rules that contradict the feature's purpose.

## Glossary

- **Nested_Repository**: A Git repository located within another repository's directory structure
- **Repository_Name**: The identifier for a repository in the configuration
- **Path_Overlap**: When one repository path is a subdirectory of another
- **Hidden_Directory**: A directory starting with a dot (`.`), common in Git repositories

## Requirements

### Requirement 1: Allow Hidden Directory Names

**User Story:** As a developer, I want to manage repositories in hidden directories (like `.github`, `.sce`), so that I can track all Git repositories in my project.

#### Acceptance Criteria

1. WHEN a repository is in a hidden directory (starts with `.`), THE System SHALL accept it as a valid repository name
2. WHEN generating repository names from paths, THE System SHALL handle hidden directories correctly
3. WHEN validating repository names, THE System SHALL allow names starting with dots
4. THE Repository_Name validation SHALL still reject truly invalid characters (spaces, special symbols)

### Requirement 2: Allow Nested Repository Paths

**User Story:** As a developer using nested repositories, I want to save configurations with overlapping paths, so that the nested scanning feature actually works.

#### Acceptance Criteria

1. WHEN using `--nested` mode, THE System SHALL allow repositories with overlapping paths
2. WHEN using `--no-nested` mode, THE System SHALL still reject overlapping paths
3. WHEN parent-child relationships exist, THE System SHALL validate them correctly
4. THE Path validation SHALL be context-aware based on scanning mode

### Requirement 3: Fix Repository Discovery Bug

**User Story:** As a developer, I want all discovered repositories to have valid names and paths, so that configuration saves successfully.

#### Acceptance Criteria

1. WHEN discovering repositories, THE System SHALL always generate a valid name
2. WHEN discovering repositories, THE System SHALL always include the path
3. WHEN a repository has no remote, THE System SHALL still include it with null remote
4. ALL discovered repositories SHALL pass validation

### Requirement 4: Improve Validation Error Messages

**User Story:** As a developer, I want clear error messages when validation fails, so that I can understand and fix issues quickly.

#### Acceptance Criteria

1. WHEN validation fails, THE Error_Message SHALL show which validation rule failed
2. WHEN multiple repositories fail, THE Error_Message SHALL group errors by type
3. WHEN a repository name is invalid, THE Error_Message SHALL suggest a valid alternative
4. THE Error_Message SHALL be actionable and helpful

### Requirement 5: Maintain Backward Compatibility

**User Story:** As a developer with existing configurations, I want the hotfix to work with my current setup, so that nothing breaks.

#### Acceptance Criteria

1. WHEN loading existing configurations, THE System SHALL process them successfully
2. WHEN using non-nested mode, THE System SHALL function identically to v1.20.2
3. WHEN using single repository configurations, THE System SHALL work as before
4. ALL existing tests SHALL pass

### Requirement 6: Version Update

**User Story:** As a user, I want to know this is a hotfix release, so that I understand it's a bug fix update.

#### Acceptance Criteria

1. THE System SHALL update package.json version to 1.20.3
2. THE System SHALL update CHANGELOG.md with hotfix details
3. THE CHANGELOG SHALL clearly mark this as a hotfix release
4. THE CHANGELOG SHALL list all bugs fixed in this release

## Implementation Summary

### Changes Made

#### 1. ConfigManager (`lib/repo/config-manager.js`)

**Updated `_isValidRepoName()` method:**
```javascript
// OLD: Rejected names starting with dots
/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

// NEW: Allows names starting with dots
/^\.?[a-zA-Z0-9][a-zA-Z0-9._-]*$/
```

**Updated `_validatePaths()` method:**
- Added `allowNested` parameter (default: false)
- Skip overlap validation when `allowNested === true`
- Maintains strict validation in non-nested mode

**Updated `validateConfig()` method:**
- Pass `settings.nestedMode` to `_validatePaths()`
- Context-aware validation based on scanning mode

#### 2. RepoManager (`lib/repo/repo-manager.js`)

**Updated `discoverRepositories()` method:**
- Normalize empty `relativePath` to `'.'` instead of empty string
- Ensures all repositories have valid paths

#### 3. InitHandler (`lib/repo/handlers/init-handler.js`)

**Added detailed error reporting:**
- Show validation errors during scanning
- Include `settings.nestedMode` in configuration
- Help users understand validation failures

### Testing Results

- ✅ All 1686 unit tests passing
- ✅ Successfully scanned 104 nested repositories in real-world project (331-poc)
- ✅ Configuration saved with `settings.nestedMode: true`
- ✅ Parent-child relationships correctly established
- ✅ Hidden directories (`.github`, `.sce`) accepted
- ✅ Path overlaps allowed in nested mode
- ✅ Root directory normalized to '.'

### Version Information

- **Version**: 1.20.3
- **Release Date**: 2026-02-01
- **Type**: Hotfix
- **Spec**: 28-00-nested-scanning-validation-fix


