# Project Adoption Guide

This guide explains how to adopt existing projects into Scene Capability Engine (sce) using the new **zero-interaction smart adoption system**.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Adoption Modes](#adoption-modes)
- [Command Options](#command-options)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)
- [Migration from Interactive Mode](#migration-from-interactive-mode)

---

## Overview

The `sce adopt` command now features **smart, zero-interaction adoption** that automatically handles project integration without asking any questions.

**Key Features**:
- ✅ **Zero Questions** - No user input required
- ✅ **Smart Detection** - Automatically detects project state
- ✅ **Automatic Decisions** - Intelligently resolves all conflicts
- ✅ **Mandatory Backup** - Always creates verified backups
- ✅ **Clear Feedback** - Shows exactly what happened
- ✅ **Easy Rollback** - Simple undo with one command

**Philosophy**: The system makes intelligent decisions automatically while maintaining complete safety through mandatory backups and clear communication.

---

## Quick Start

### For New Users

Simply run:
```bash
cd your-project
sce adopt
```

That's it! The system will:
1. Analyze your project
2. Choose the best strategy
3. Create a backup
4. Apply changes
5. Show you a summary

**Example Output**:
```
🔥 Scene Capability Engine - Project Adoption

📦 Analyzing project structure... ✅
📋 Creating adoption plan... ✅

Adoption Plan:
  Mode: Smart Update
  Files to update: 5
  Files to preserve: 8
  Backup required: Yes

🚀 Starting adoption...
📦 Creating backup... ✅ backup-20260128-143022
✓ Validating backup... ✅ 5 files verified
📝 Updating files...
  ✅ .kiro/steering/CORE_PRINCIPLES.md
  ✅ .kiro/steering/ENVIRONMENT.md
  ✅ .kiro/tools/ultrawork_enhancer.py
  ⏭️  .kiro/specs/ (preserved)
✅ Adoption completed successfully!

📊 Summary:
  Backup: backup-20260128-143022
  Updated: 5 files
  Preserved: 3 specs, 2 custom files
  
💡 Your original files are safely backed up.
   To restore: sce rollback backup-20260128-143022
```

### Preview Changes First

Want to see what would happen without making changes?
```bash
sce adopt --dry-run
```

---

## How It Works

### Automatic Detection

The system automatically detects your project state:
- Checks for existing `.kiro/` directory
- Reads version information
- Identifies user content (specs, custom files)
- Detects potential conflicts

### Smart Mode Selection

Based on detection, it chooses the optimal mode:

| Project State | Selected Mode | What Happens |
|--------------|---------------|--------------|
| No `.kiro/` | **Fresh** | Creates complete structure |
| `.kiro/` + same version | **Skip** | Already up-to-date |
| `.kiro/` + older version | **Smart Update** | Updates templates only |
| `.kiro/` + newer version | **Warning** | Version mismatch alert |
| `.kiro/` + no version | **Smart Adopt** | Full adoption with backup |

### Automatic Conflict Resolution

The system automatically resolves file conflicts using smart rules:

| File Type | Resolution Strategy |
|-----------|-------------------|
| **Template files** (steering/, tools/) | Backup + Update to latest |
| **User content** (specs/, custom/) | Always preserve |
| **Config files** (version.json) | Backup + Update |
| **Special** (CURRENT_CONTEXT.md) | Always preserve |

### Mandatory Backup

Before any modifications:
1. Creates selective backup (only files that will change)
2. Validates backup integrity
3. Aborts if backup fails
4. Provides rollback command

---

## Adoption Modes

### 1. Fresh Adoption

**When**: No `.kiro/` directory exists

**Actions**:
- Creates complete `.kiro/` structure
- Copies all template files
- Creates `version.json`
- No conflicts, no backup needed

**Example**:
```bash
$ sce adopt

Mode: Fresh
Actions:
  - Create .kiro/ directory structure
  - Copy template files
  - Create version.json

✅ Adoption completed successfully!
```

### 2. Skip Mode

**When**: Already at latest version

**Actions**:
- No changes made
- Displays current version info
- Suggests next steps

**Example**:
```bash
$ sce adopt

✅ Project already adopted with latest version (v1.9.0)
No changes needed.

💡 Next steps:
   - Create a spec: sce spec bootstrap --name 01-00-my-feature --non-interactive
   - Check status: sce status
```

### 3. Smart Update

**When**: Existing `.kiro/` with older version

**Actions**:
- Backs up files that will change
- Updates template files to latest version
- Preserves all user content (specs, CURRENT_CONTEXT.md)
- Updates version.json

**Example**:
```bash
$ sce adopt

Mode: Smart Update (v1.8.0 → v1.9.0)
Backup: backup-20260128-143022
Updated: 5 template files
Preserved: 3 specs, CURRENT_CONTEXT.md

✅ Adoption completed successfully!
```

### 4. Smart Adopt

**When**: `.kiro/` exists but no version info

**Actions**:
- Backs up entire `.kiro/` directory
- Adopts with full structure
- Preserves user content
- Creates version.json

**Example**:
```bash
$ sce adopt

Mode: Smart Adopt
Backup: backup-20260128-143022
Updated: 8 files
Preserved: 5 specs, 3 custom files

✅ Adoption completed successfully!
```

### 5. Warning Mode

**When**: Local version is newer than sce version

**Actions**:
- Displays warning message
- No changes made
- Suggests upgrading sce

**Example**:
```bash
$ sce adopt

⚠️  Warning: Project version (v2.0.0) is newer than sce version (v1.9.0)

Possible causes:
  - You downgraded sce
  - Project was adopted with newer sce version

Solutions:
  1. Upgrade sce: npm install -g scene-capability-engine@latest
  2. Force adopt: sce adopt --force (not recommended)

No changes made.
```

---

## Command Options

### Basic Options

```bash
# Default: Smart, automatic, safe
sce adopt

# Preview changes without executing
sce adopt --dry-run

# Show detailed logs
sce adopt --verbose

# Force overwrite (with backup)
sce adopt --force
```

### Advanced Options

```bash
# Skip backup (dangerous, not recommended)
sce adopt --no-backup

# Skip template updates
sce adopt --skip-update

# Enable interactive mode (legacy behavior)
sce adopt --interactive
```

### Option Details

| Option | Description | Safety |
|--------|-------------|--------|
| `--dry-run` | Preview without executing | ✅ Safe |
| `--verbose` | Show detailed logs | ✅ Safe |
| `--force` | Force overwrite with backup | ⚠️ Use with caution |
| `--no-backup` | Skip backup creation | ❌ Dangerous |
| `--skip-update` | Don't update templates | ⚠️ May cause inconsistency |
| `--interactive` | Enable legacy interactive mode | ✅ Safe |

---

## Common Scenarios

### Scenario 1: First Time User

**Situation**: You just installed sce and want to adopt your project.

**Solution**:
```bash
cd your-project
sce adopt
```

**What happens**: Fresh adoption creates complete structure, no questions asked.

---

### Scenario 2: Upgrading sce Version

**Situation**: You upgraded sce from v1.8.0 to v1.9.0.

**Solution**:
```bash
sce adopt
```

**What happens**: Smart Update backs up and updates template files, preserves your specs.

---

### Scenario 3: Want to Preview First

**Situation**: You want to see what would change before committing.

**Solution**:
```bash
sce adopt --dry-run
```

**What happens**: Shows detailed plan without making any changes.

---

### Scenario 4: Need Detailed Information

**Situation**: You want to see exactly what's happening.

**Solution**:
```bash
sce adopt --verbose
```

**What happens**: Shows detailed logs of every operation.

---

### Scenario 5: Undo Adoption

**Situation**: You want to revert the adoption.

**Solution**:
```bash
sce rollback backup-20260128-143022
```

**What happens**: Restores all files from backup.

---

### Scenario 6: Multiple Projects

**Situation**: You want to adopt multiple projects.

**Solution**:
```bash
# Bash script
for dir in project1 project2 project3; do
  cd $dir
  sce adopt
  cd ..
done
```

**What happens**: Each project is adopted automatically without interaction.

---

## Troubleshooting

### Problem: Backup Creation Failed

**Error**:
```
❌ Error: Backup Creation Failed

Problem: Unable to create backup of existing files

Possible causes:
  - Insufficient disk space
  - Permission denied for .kiro/backups/
  - File system error
```

**Solutions**:
1. Free up disk space (need ~50MB)
2. Check file permissions: `ls -la .kiro/`
3. Try running with elevated permissions (if appropriate)

---

### Problem: Permission Denied

**Error**:
```
❌ Error: Permission Denied

Problem: Cannot write to .kiro/ directory
```

**Solutions**:
```bash
# Check permissions
ls -la .kiro/

# Fix permissions (Unix/Mac)
chmod -R u+w .kiro/

# Windows: Right-click .kiro/ → Properties → Security → Edit
```

---

### Problem: Version Mismatch Warning

**Error**:
```
⚠️  Warning: Project version (v2.0.0) is newer than sce version (v1.9.0)
```

**Solutions**:
```bash
# Upgrade sce to latest
npm install -g scene-capability-engine@latest

# Then adopt again
sce adopt
```

---

### Problem: Want to Keep Old Behavior

**Situation**: You prefer the interactive mode.

**Solution**:
```bash
sce adopt --interactive
```

**What happens**: Enables legacy interactive mode with prompts.

---

## Migration from Interactive Mode

### What Changed

**Old Behavior** (v1.8.0 and earlier):
- Asked multiple questions
- Required user decisions
- Manual conflict resolution
- Optional backup

**New Behavior** (v1.9.0+):
- Zero questions
- Automatic decisions
- Smart conflict resolution
- Mandatory backup

### Comparison

| Aspect | Old (Interactive) | New (Smart) |
|--------|------------------|-------------|
| User Input | Multiple prompts | None |
| Conflict Resolution | Manual selection | Automatic |
| Backup | Optional | Mandatory |
| Speed | Slow (waits for input) | Fast (automatic) |
| Safety | Depends on user choices | Always safe |

### Using Legacy Mode

If you prefer the old interactive behavior:
```bash
sce adopt --interactive
```

This enables:
- All the old prompts
- Manual conflict resolution
- Step-by-step confirmation

### Recommended Approach

For most users, the new smart mode is recommended:
- Faster and easier
- Safer (mandatory backups)
- No learning curve
- Can always rollback

---

## Best Practices

### 1. Preview First (Optional)

For peace of mind:
```bash
sce adopt --dry-run
sce adopt
```

### 2. Commit Before Adoption

If using version control:
```bash
git add -A
git commit -m "Before sce adoption"
sce adopt
```

### 3. Verify After Adoption

Check everything is correct:
```bash
sce status
sce version-info
```

### 4. Keep Backups

Don't delete automatic backups immediately:
```bash
# Backups are in .kiro/backups/
ls .kiro/backups/
```

### 5. Use Verbose for Debugging

If something seems wrong:
```bash
sce adopt --verbose
```

---

## What Gets Created

After adoption, your project will have:

```
your-project/
├── .kiro/                          # sce core directory
│   ├── version.json                # Version tracking
│   ├── specs/                      # Spec storage
│   ├── steering/                   # AI behavior rules
│   │   ├── CORE_PRINCIPLES.md
│   │   ├── ENVIRONMENT.md
│   │   ├── CURRENT_CONTEXT.md
│   │   └── RULES_GUIDE.md
│   ├── tools/                      # Ultrawork tools
│   │   └── ultrawork_enhancer.py
│   ├── backups/                    # Automatic backups
│   │   └── adopt-{timestamp}/
│   └── README.md
└── (your existing files)           # All preserved
```

---

## Next Steps

After successful adoption:

1. **Verify .gitignore configuration**:
   The adoption process automatically checks and fixes your `.gitignore` for team collaboration. If you see a warning about .gitignore, you can manually fix it:
   ```bash
   sce doctor --fix-gitignore
   ```
   Learn more: [Team Collaboration Guide](./team-collaboration-guide.md)

2. **Create your first spec**:
   ```bash
   sce spec bootstrap --name 01-00-my-feature --non-interactive
   ```

3. **Check project status**:
   ```bash
   sce status
   ```

4. **Read the spec workflow guide**:
   - See `.kiro/specs/SPEC_WORKFLOW_GUIDE.md`

5. **Explore Ultrawork**:
   ```bash
   sce enhance requirements .kiro/specs/01-00-my-feature/requirements.md
   ```

---

## Getting Help

- **Documentation**: Check README.md in your `.kiro/` directory
- **System Check**: `sce doctor`
- **Version Info**: `sce version-info`
- **Issues**: https://github.com/heguangyong/scene-capability-engine/issues

---

**Happy adopting! 🔥**

