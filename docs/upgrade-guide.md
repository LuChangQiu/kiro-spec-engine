# Project Upgrade Guide

This guide explains how to upgrade your Kiro Spec Engine (KSE) project to newer versions.

## Table of Contents

- [Overview](#overview)
- [Before You Upgrade](#before-you-upgrade)
- [Upgrade Process](#upgrade-process)
- [Upgrade Scenarios](#upgrade-scenarios)
- [Migration Scripts](#migration-scripts)
- [Troubleshooting](#troubleshooting)

---

## Overview

The `kse upgrade` command safely upgrades your project to newer KSE versions. It handles version gaps, runs migration scripts, and preserves all your content.

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
kse version-info

# Output:
# 📦 Version Information
# 
# Project:
#   kse version: 1.0.0
#   Template version: 1.0.0
#   Created: 2026-01-20 10:00:00
#   Last upgraded: 2026-01-20 10:00:00
# 
# Installed:
#   kse version: 1.2.1
# 
# ⚠️  Upgrade available
#   Run kse upgrade to update to v1.2.1
```

### Check for Version Mismatch

KSE automatically warns you when versions don't match:

```bash
kse status

# Output:
# ⚠️  Version Mismatch Detected
#   Project initialized with kse v1.0.0
#   Current kse version: v1.2.1
# 
# 💡 Tip: Run kse upgrade to update project templates
#   Or use --no-version-check to suppress this warning
```

### Prerequisites

1. **Commit your changes** (if using version control):
   ```bash
   git add -A
   git commit -m "Before KSE upgrade"
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
   kse upgrade
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
     Run kse rollback if you encounter issues
   
   🔥 Upgrade complete!
   ```

### Dry Run (Preview Upgrade)

Preview the upgrade plan without making changes:

```bash
kse upgrade --dry-run
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
kse upgrade --auto
```

**Use cases**:
- CI/CD pipelines
- Automated deployment scripts
- When you're confident about the upgrade

### Upgrade to Specific Version

Target a specific version instead of latest:

```bash
kse upgrade --to 1.2.0
```

---

## Upgrade Scenarios

### Scenario 1: Single Version Upgrade

**Situation**: Upgrade from 1.2.0 to 1.2.1 (adjacent versions)

**Command**:
```bash
kse upgrade
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
kse upgrade
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
kse upgrade
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
kse upgrade
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
  Run kse rollback to restore
```

**Solution**:
```bash
# Rollback to previous state
kse rollback

# Check what went wrong
kse doctor

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
    await ensureDirectory(path.join(projectPath, '.kiro/backups'));
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
kse upgrade --dry-run
```

---

## Troubleshooting

### Problem: "No version.json found"

**Cause**: Project not initialized with KSE

**Solution**:
```bash
# Use adopt instead of upgrade
kse adopt
```

---

### Problem: "Cannot downgrade versions"

**Cause**: Trying to upgrade to an older version

**Solution**:
```bash
# Check current version
kse version-info

# Upgrade only works forward
# To go back, use rollback:
kse rollback
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
kse rollback
```

**Step 3**: Report the issue
- Go to: https://github.com/heguangyong/kiro-spec-engine/issues
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
ls .kiro/backups/
rm -rf .kiro/backups/old-backup-id

# Try upgrade again
kse upgrade
```

---

### Problem: Want to skip version check warnings

**Cause**: Warnings are annoying during development

**Solution**:

**Temporary**:
```bash
kse status --no-version-check
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
kse version-info

# Upgrade when available
kse upgrade
```

### 2. Test After Upgrade

Verify everything works:
```bash
# Check status
kse status

# Run doctor
kse doctor

# Test your specs
kse enhance requirements .kiro/specs/your-spec/requirements.md
```

### 3. Keep Upgrade History

Don't delete backups immediately:
```bash
# Keep last 5 backups
ls -lt .kiro/backups/ | head -6
```

### 4. Read Release Notes

Check what changed:
- See CHANGELOG.md in KSE repository
- Review breaking changes
- Understand new features

### 5. Upgrade in Stages

For large version gaps:
```bash
# Instead of 1.0.0 → 2.0.0 directly
# Let KSE handle incremental upgrades
kse upgrade  # Automatically: 1.0.0 → 1.1.0 → 1.2.0 → 2.0.0
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
# KSE automatically checks compatibility
kse upgrade

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
kse rollback

# Select the upgrade backup
# Restore to previous state
```

### Manual Rollback

If automatic rollback fails:

```bash
# Backups are in .kiro/backups/
cd .kiro/backups/

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
   kse version-info
   kse status
   ```

2. **Test your specs**:
   - Run existing specs
   - Check for any issues

3. **Explore new features**:
   - Check CHANGELOG.md
   - Try new commands

4. **Clean old backups** (optional):
   ```bash
   # Keep last 3 backups
   ls .kiro/backups/
   ```

---

## Getting Help

- **Documentation**: Check README.md
- **Issues**: https://github.com/heguangyong/kiro-spec-engine/issues
- **Version Info**: `kse version-info`
- **System Check**: `kse doctor`
- **Rollback**: `kse rollback`

---

**Happy upgrading! 🔥**
