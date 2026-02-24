# Project Upgrade Guide

This guide explains how to upgrade your Scene Capability Engine (sce) project to newer versions.

## Table of Contents

- [Overview](#overview)
- [Before You Upgrade](#before-you-upgrade)
- [Upgrade Process](#upgrade-process)
- [Upgrade Scenarios](#upgrade-scenarios)
- [Migration Scripts](#migration-scripts)
- [Troubleshooting](#troubleshooting)

---

## Overview

The `sce upgrade` command safely upgrades your project to newer sce versions. It handles version gaps, runs migration scripts, and preserves all your content.

**Key Features**:
- ✅ Automatic version gap detection
- ✅ Incremental upgrades through intermediate versions
- ✅ Migration script execution
- ✅ Automatic backup before upgrade
- ✅ Dry-run mode to preview changes
- ✅ Easy rollback if needed

---

## Before You Upgrade

### Check Current Version

```bash
# Check project version
sce version-info

# Output:
# 📦 Version Information
# 
# Project:
#   sce version: 1.0.0
#   Template version: 1.0.0
#   Created: 2026-01-20 10:00:00
#   Last upgraded: 2026-01-20 10:00:00
# 
# Installed:
#   sce version: 1.2.1
# 
# ⚠️  Upgrade available
#   Run sce upgrade to update to v1.2.1
```

### Check for Version Mismatch

sce automatically warns you when versions don't match:

```bash
sce status

# Output:
# ⚠️  Version Mismatch Detected
#   Project initialized with sce v1.0.0
#   Current sce version: v1.2.1
# 
# 💡 Tip: Run sce upgrade to update project templates
#   Or use --no-version-check to suppress this warning
```

### Prerequisites

1. **Commit your changes** (if using version control):
   ```bash
   git add -A
   git commit -m "Before sce upgrade"
   ```

2. **Ensure no pending work**:
   - Save all open files
   - Complete any in-progress specs

3. **Check disk space**:
   - Upgrades create backups
   - Ensure sufficient disk space

---

## Upgrade Process

### Basic Upgrade (Interactive)

1. **Run the upgrade command**:
   ```bash
   sce upgrade
   ```

2. **Review the upgrade plan**:
   ```
   📦 Checking project version...
     Current version: 1.0.0
     Target version: 1.2.1
   
   📋 Planning upgrade...
   
   Upgrade Plan:
     From: 1.0.0
     To: 1.2.1
     Path: 1.0.0 → 1.1.0 → 1.2.0 → 1.2.1
     Estimated time: 30 seconds
   
   Migrations:
     1. 1.0.0 → 1.1.0 [safe]
        Script: 1.0.0-to-1.1.0.js
     2. 1.1.0 → 1.2.0 [safe]
        No migration script needed
     3. 1.2.0 → 1.2.1 [safe]
        No migration script needed
   ```

3. **Confirm the upgrade**:
   ```
   Proceed with upgrade? (Y/n)
   ```

4. **Wait for completion**:
   ```
   📦 Creating backup...
   ✅ Backup created: upgrade-2026-01-23-110000
   
   🚀 Executing upgrade...
     [1/3] Migrating 1.0.0 → 1.1.0
     [2/3] Migrating 1.1.0 → 1.2.0
     [3/3] Migrating 1.2.0 → 1.2.1
   
   🔍 Validating upgrade...
   
   ✅ Upgrade complete!
   
     Upgraded from 1.0.0 to 1.2.1
   
   Migrations executed:
     ✅ 1.0.0 → 1.1.0
        - Created backups/ directory
        - Verified version.json structure
     ✅ 1.1.0 → 1.2.0
        - No migration script needed
     ✅ 1.2.0 → 1.2.1
        - No migration script needed
   
   📦 Backup: upgrade-2026-01-23-110000
     Run sce rollback if you encounter issues
   
   🔥 Upgrade complete!
   ```

### Dry Run (Preview Upgrade)

Preview the upgrade plan without making changes:

```bash
sce upgrade --dry-run
```

**Output**:
```
🔍 Dry run mode - no changes will be made

Migrations that would be executed:
  1. 1.0.0 → 1.1.0
     - Created backups/ directory
     - Verified version.json structure
  2. 1.1.0 → 1.2.0
     - No migration script needed
```

### Automatic Mode (No Prompts)

Skip all confirmations:

```bash
sce upgrade --auto
```

**Use cases**:
- CI/CD pipelines
- Automated deployment scripts
- When you're confident about the upgrade

### Upgrade to Specific Version

Target a specific version instead of latest:

```bash
sce upgrade --to 1.2.0
```

---

## Upgrade Scenarios

### Scenario 1: Single Version Upgrade

**Situation**: Upgrade from 1.2.0 to 1.2.1 (adjacent versions)

**Command**:
```bash
sce upgrade
```

**What happens**:
- Direct upgrade (no intermediate versions)
- Quick and simple
- Usually no migration scripts needed

---

### Scenario 2: Multiple Version Gap

**Situation**: Upgrade from 1.0.0 to 1.2.1 (multiple versions behind)

**Command**:
```bash
sce upgrade
```

**What happens**:
- Incremental upgrade: 1.0.0 → 1.1.0 → 1.2.0 → 1.2.1
- Each migration runs sequentially
- Ensures all changes are applied correctly

**Why incremental?**
- Safer: Each step is tested
- Traceable: Clear upgrade history
- Reversible: Can rollback to any point

---

### Scenario 3: Breaking Changes

**Situation**: Upgrade involves breaking changes (e.g., 1.x → 2.0)

**Command**:
```bash
sce upgrade
```

**What happens**:
```
📦 Upgrade Plan:
  From: 1.2.1
  To: 2.0.0
  Path: 1.2.1 → 2.0.0

Migrations:
  1. 1.2.1 → 2.0.0 [⚠️  BREAKING]
     Script: 1.2.1-to-2.0.0.js
     
⚠️  Warning: This upgrade contains breaking changes
    Review the migration details carefully
    
Proceed with upgrade? (Y/n)
```

**After upgrade**:
- Review migration changes
- Test your specs
- Update any custom code if needed

---

### Scenario 4: Already Up to Date

**Situation**: Your project is already at the latest version

**Command**:
```bash
sce upgrade
```

**Output**:
```
📦 Checking project version...
  Current version: 1.2.1
  Target version: 1.2.1

✅ Already up to date (1.2.1)
```

---

### Scenario 5: Upgrade Failed

**Situation**: Upgrade fails during migration

**What happens**:
```
🚀 Executing upgrade...
  [1/3] Migrating 1.0.0 → 1.1.0
  [2/3] Migrating 1.1.0 → 1.2.0
  
❌ Upgrade failed
  Migration 1.1.0 → 1.2.0 failed: File not found

📦 Backup available: upgrade-2026-01-23-110000
  Run sce rollback to restore
```

**Solution**:
```bash
# Rollback to previous state
sce rollback

# Check what went wrong
sce doctor

# Try again or report issue
```

---

## Migration Scripts

### What Are Migration Scripts?

Migration scripts handle version-specific changes:
- Update file structures
- Modify configurations
- Add new features
- Fix compatibility issues

### Migration Script Locations

```
lib/upgrade/migrations/
├── 1.0.0-to-1.1.0.js
├── 1.1.0-to-1.2.0.js
└── 1.2.0-to-2.0.0.js
```

### Migration Script Structure

```javascript
module.exports = {
  version: "1.1.0",
  breaking: false,
  description: "Add version management foundation",
  
  async migrate(projectPath, context) {
    // Migration logic
    const changes = [];
    
    // Example: Create backups directory
    await ensureDirectory(path.join(projectPath, '.sce/backups'));
    changes.push('Created backups/ directory');
    
    return { success: true, changes };
  },
  
  async rollback(projectPath, context) {
    // Rollback logic (optional)
  }
};
```

### Viewing Migration Details

Check what a migration will do:

```bash
# Dry run shows migration details
sce upgrade --dry-run
```

---

## Troubleshooting

### Problem: "No version.json found"

**Cause**: Project not initialized with sce

**Solution**:
```bash
# Use adopt instead of upgrade
sce adopt
```

---

### Problem: "Cannot downgrade versions"

**Cause**: Trying to upgrade to an older version

**Solution**:
```bash
# Check current version
sce version-info

# Upgrade only works forward
# To go back, use rollback:
sce rollback
```

---

### Problem: Migration script fails

**Cause**: Migration script encountered an error

**Solution**:

**Step 1**: Check the error message
```
❌ Migration 1.0.0 → 1.1.0 failed: Cannot read property 'version' of undefined
```

**Step 2**: Rollback
```bash
sce rollback
```

**Step 3**: Report the issue
- Go to: https://github.com/heguangyong/scene-capability-engine/issues
- Include:
  - Error message
  - Current version
  - Target version
  - Backup ID

---

### Problem: Upgrade interrupted (Ctrl+C)

**Cause**: User interrupted the upgrade process

**What happens**:
```
⚠️  Operation interrupted by user
🔄 Rolling back changes...
✅ Rollback complete
```

**Solution**:
- Automatic rollback protects your project
- Try upgrade again when ready

---

### Problem: Disk space full during upgrade

**Cause**: Insufficient disk space for backup

**Solution**:
```bash
# Check disk space
df -h

# Clean old backups
ls .sce/backups/
rm -rf .sce/backups/old-backup-id

# Try upgrade again
sce upgrade
```

---

### Problem: Want to skip version check warnings

**Cause**: Warnings are annoying during development

**Solution**:

**Temporary**:
```bash
sce status --no-version-check
```

**Permanent** (not recommended):
```bash
# Add to your shell profile
export KIRO_NO_VERSION_CHECK=1
```

---

## Best Practices

### 1. Regular Upgrades

Don't fall too far behind:
```bash
# Check for updates monthly
sce version-info

# Upgrade when available
sce upgrade
```

### 2. Test After Upgrade

Verify everything works:
```bash
# Check status
sce status

# Run doctor
sce doctor

# Test your specs
sce enhance requirements .sce/specs/your-spec/requirements.md
```

### 3. Keep Upgrade History

Don't delete backups immediately:
```bash
# Keep last 5 backups
ls -lt .sce/backups/ | head -6
```

### 4. Read Release Notes

Check what changed:
- See CHANGELOG.md in sce repository
- Review breaking changes
- Understand new features

### 5. Upgrade in Stages

For large version gaps:
```bash
# Instead of 1.0.0 → 2.0.0 directly
# Let sce handle incremental upgrades
sce upgrade  # Automatically: 1.0.0 → 1.1.0 → 1.2.0 → 2.0.0
```

---

## Version Compatibility

### Compatibility Matrix

| From Version | To Version | Compatible | Breaking | Migration Required |
|--------------|------------|------------|----------|-------------------|
| 1.0.0        | 1.1.0      | ✅ Yes     | No       | Optional          |
| 1.0.0        | 1.2.0      | ✅ Yes     | No       | Optional          |
| 1.1.0        | 1.2.0      | ✅ Yes     | No       | No                |
| 1.x.x        | 2.0.0      | ⚠️  Yes    | Yes      | Required          |

### Checking Compatibility

```bash
# sce automatically checks compatibility
sce upgrade

# If incompatible, you'll see:
# ❌ Error: Incompatible versions
#    Cannot upgrade from 1.0.0 to 3.0.0
#    Please upgrade incrementally
```

---

## Rollback Guide

If upgrade fails or causes issues:

### Quick Rollback

```bash
# List backups
sce rollback

# Select the upgrade backup
# Restore to previous state
```

### Manual Rollback

If automatic rollback fails:

```bash
# Backups are in .sce/backups/
cd .sce/backups/

# Find the upgrade backup
ls -lt

# Manually restore
cp -r upgrade-2026-01-23-110000/* ..
```

---

## Next Steps

After successful upgrade:

1. **Verify the upgrade**:
   ```bash
   sce version-info
   sce status
   ```

2. **Check .gitignore configuration**:
   The upgrade process automatically checks and fixes your `.gitignore` for team collaboration. If you see a warning about .gitignore, you can manually fix it:
   ```bash
   sce doctor --fix-gitignore
   ```
   Learn more: [Team Collaboration Guide](./team-collaboration-guide.md)

3. **Test your specs**:
   - Run existing specs
   - Check for any issues

4. **Explore new features**:
   - Check CHANGELOG.md
   - Try new commands

5. **Clean old backups** (optional):
   ```bash
   # Keep last 3 backups
   ls .sce/backups/
   ```

---

## Getting Help

- **Documentation**: Check README.md
- **Issues**: https://github.com/heguangyong/scene-capability-engine/issues
- **Version Info**: `sce version-info`
- **System Check**: `sce doctor`
- **Rollback**: `sce rollback`

---

**Happy upgrading! 🔥**
