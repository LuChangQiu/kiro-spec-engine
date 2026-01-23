# Requirements: Project Adoption and Upgrade System

## Overview

This spec defines a comprehensive system for kiro-spec-engine (kse) to intelligently adopt existing projects and provide smooth upgrade paths for users. The system must handle two critical scenarios: onboarding new users with existing projects, and upgrading existing users to new versions.

---

## 1. Project Adoption (接管现有项目)

### 1.1 Detection and Analysis

**User Story**: As a developer with an existing project, I want kse to detect my project structure and intelligently integrate without breaking anything.

**Acceptance Criteria**:
- GIVEN a project directory
- WHEN I run `kse adopt` or `kse init --adopt`
- THEN kse should:
  - Detect if `.kiro/` directory exists
  - Analyze existing structure (specs/, steering/, tools/)
  - Identify project type (Node.js, Python, mixed, etc.)
  - Report findings to user before making changes

### 1.2 Smart Integration Modes

**User Story**: As a user, I want different adoption strategies based on my project's current state.

**Acceptance Criteria**:

**Mode A: Fresh Adoption** (no `.kiro/` directory)
- Create complete `.kiro/` structure
- Initialize with default templates
- Create `.kiro/version.json` with current kse version

**Mode B: Partial Adoption** (`.kiro/` exists but incomplete)
- Preserve existing specs/ and steering/
- Add missing components (tools/, README.md, etc.)
- Merge steering rules intelligently
- Update `.kiro/version.json`

**Mode C: Full Adoption** (complete `.kiro/` from older version)
- Detect version from `.kiro/version.json` or structure
- Upgrade components to current version
- Preserve all user content
- Create backup before changes

### 1.3 Conflict Resolution

**User Story**: As a user, I want clear guidance when kse detects conflicts with my existing setup.

**Acceptance Criteria**:
- Detect file conflicts (e.g., existing CORE_PRINCIPLES.md vs template)
- Offer resolution strategies:
  - Keep existing (skip template)
  - Merge (combine both)
  - Replace (use template, backup existing)
  - Manual (show diff, let user decide)
- Create `.kiro/backups/` directory for replaced files

### 1.4 Validation and Verification

**User Story**: As a user, I want to verify that adoption was successful.

**Acceptance Criteria**:
- Run post-adoption validation
- Check all required files exist
- Verify Python dependencies (if using Ultrawork)
- Generate adoption report
- Provide rollback option if issues detected

---

## 2. Version Management

### 2.1 Version Tracking

**User Story**: As a developer, I want kse to track which version initialized my project.

**Acceptance Criteria**:
- Create `.kiro/version.json` on init/adopt:
  ```json
  {
    "kse-version": "1.0.0",
    "template-version": "1.0.0",
    "created": "2026-01-23T10:00:00Z",
    "last-upgraded": "2026-01-23T10:00:00Z",
    "upgrade-history": []
  }
  ```
- Update version file on upgrades
- Never delete version history

### 2.2 Version Detection

**User Story**: As a user, I want kse to automatically detect version mismatches.

**Acceptance Criteria**:
- On any kse command, check project version vs installed kse version
- Display warning if mismatch detected:
  ```
  ⚠️  Project initialized with kse v1.0.0
  📦 Current kse version: v1.2.0
  💡 Run `kse upgrade` to update project templates
  ```
- Allow users to suppress warnings with `--no-version-check`

### 2.3 Compatibility Matrix

**User Story**: As a maintainer, I want to define which versions are compatible.

**Acceptance Criteria**:
- Maintain compatibility matrix in kse:
  ```javascript
  {
    "1.0.x": { compatible: ["1.0.0", "1.1.0", "1.2.0"], breaking: false },
    "1.1.x": { compatible: ["1.0.0", "1.1.0", "1.2.0"], breaking: false },
    "2.0.x": { compatible: ["2.0.0"], breaking: true, migration: "required" }
  }
  ```
- Check compatibility before operations
- Block operations if breaking changes detected without upgrade

---

## 3. Smooth Upgrade System

### 3.1 Upgrade Command

**User Story**: As a user, I want a simple command to upgrade my project to the latest kse version.

**Acceptance Criteria**:
- Provide `kse upgrade` command
- Options:
  - `kse upgrade` - interactive upgrade with prompts
  - `kse upgrade --auto` - automatic upgrade (safe changes only)
  - `kse upgrade --dry-run` - show what would change
  - `kse upgrade --to=1.2.0` - upgrade to specific version

### 3.2 Upgrade Strategy

**User Story**: As a user, I want upgrades to be safe and reversible.

**Acceptance Criteria**:

**Pre-upgrade**:
- Create full backup in `.kiro/backups/upgrade-YYYY-MM-DD-HHMMSS/`
- Analyze changes required
- Show upgrade plan to user
- Require confirmation (unless `--auto`)

**During upgrade**:
- Update template files (steering/, tools/)
- Preserve user content (specs/, custom files)
- Merge configuration changes
- Update `.kiro/version.json`

**Post-upgrade**:
- Run validation checks
- Generate upgrade report
- Provide rollback command if needed

### 3.3 Incremental Upgrades

**User Story**: As a user on an old version, I want to upgrade through intermediate versions safely.

**Acceptance Criteria**:
- Detect version gap (e.g., 1.0.0 → 1.5.0)
- Offer incremental upgrade path:
  ```
  📦 Upgrade path: 1.0.0 → 1.2.0 → 1.5.0
  
  This ensures all migration scripts run correctly.
  Continue? (Y/n)
  ```
- Execute upgrades sequentially
- Stop if any upgrade fails

### 3.4 Migration Scripts

**User Story**: As a maintainer, I want to provide custom migration logic for breaking changes.

**Acceptance Criteria**:
- Support migration scripts in kse:
  ```
  migrations/
    1.0.0-to-1.1.0.js
    1.1.0-to-2.0.0.js
  ```
- Each script exports:
  ```javascript
  module.exports = {
    version: "1.1.0",
    breaking: false,
    migrate: async (projectPath) => { /* migration logic */ },
    rollback: async (projectPath) => { /* rollback logic */ }
  }
  ```
- Execute migrations during upgrade
- Log all migration actions

---

## 4. User Experience

### 4.1 Clear Communication

**User Story**: As a user, I want clear, actionable messages during adoption/upgrade.

**Acceptance Criteria**:
- Use consistent messaging format:
  - ✅ Success (green)
  - ⚠️  Warning (yellow)
  - ❌ Error (red)
  - 💡 Tip (blue)
  - 📦 Info (cyan)
- Provide progress indicators for long operations
- Show detailed logs with `--verbose`

### 4.2 Documentation

**User Story**: As a user, I want comprehensive documentation for adoption and upgrades.

**Acceptance Criteria**:
- Create `docs/adoption-guide.md`
- Create `docs/upgrade-guide.md`
- Include in README.md
- Provide examples for common scenarios

### 4.3 Rollback Support

**User Story**: As a user, I want to easily rollback if something goes wrong.

**Acceptance Criteria**:
- Provide `kse rollback` command
- List available backups
- Restore from backup with confirmation
- Preserve current state before rollback

---

## 5. Non-Functional Requirements

### 5.1 Safety

- All destructive operations require confirmation
- Always create backups before changes
- Validate backups before proceeding
- Provide rollback for all operations

### 5.2 Performance

- Adoption should complete in < 10 seconds for typical projects
- Upgrade should complete in < 30 seconds
- Backup operations should be fast (use incremental if possible)

### 5.3 Compatibility

- Support Node.js 16+
- Support Python 3.8+ (for Ultrawork)
- Work on Windows, macOS, Linux
- Handle various project structures gracefully

### 5.4 Reliability

- Never lose user data
- Handle interruptions gracefully (Ctrl+C)
- Atomic operations where possible
- Clear error messages with recovery steps

---

## 6. Success Metrics

- **Adoption Success Rate**: > 95% of adoptions complete without errors
- **Upgrade Success Rate**: > 98% of upgrades complete without rollback
- **User Satisfaction**: Positive feedback on ease of adoption/upgrade
- **Support Tickets**: < 5% of users need help with adoption/upgrade

---

## 7. Future Considerations

- **Cloud Sync**: Sync project settings across machines
- **Team Collaboration**: Share project configurations
- **Auto-Update**: Optional automatic upgrades for non-breaking changes
- **Plugin System**: Allow third-party extensions to hook into adoption/upgrade

---

**Version**: 1.0  
**Created**: 2026-01-23  
**Status**: Draft
