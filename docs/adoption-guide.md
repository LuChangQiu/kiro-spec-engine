# Project Adoption Guide

This guide explains how to adopt existing projects into Kiro Spec Engine (KSE).

## Table of Contents

- [Overview](#overview)
- [Before You Start](#before-you-start)
- [Adoption Modes](#adoption-modes)
- [Step-by-Step Guide](#step-by-step-guide)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

---

## Overview

The `kse adopt` command intelligently integrates KSE into your existing project. It analyzes your project structure and chooses the best adoption strategy automatically.

**Key Features**:
- ✅ Automatic project structure detection
- ✅ Three adoption modes (fresh, partial, full)
- ✅ Automatic backup before changes
- ✅ Conflict detection and resolution
- ✅ Dry-run mode to preview changes
- ✅ Easy rollback if needed

---

## Before You Start

### Prerequisites

1. **Install KSE globally**:
   ```bash
   npm install -g kiro-spec-engine
   ```

2. **Navigate to your project**:
   ```bash
   cd /path/to/your/project
   ```

3. **Check current status** (optional):
   ```bash
   kse status
   ```

### What Gets Created

After adoption, your project will have:

```
your-project/
├── .kiro/                          # KSE core directory
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
│   └── README.md
└── (your existing files)
```

---

## Adoption Modes

KSE automatically selects the appropriate mode based on your project structure:

### 1. Fresh Adoption

**When**: No `.kiro/` directory exists

**What happens**:
- Creates complete `.kiro/` structure from scratch
- Initializes with default templates
- Creates `version.json` with current KSE version

**Example**:
```bash
# Your project has no .kiro/ directory
kse adopt
```

### 2. Partial Adoption

**When**: `.kiro/` exists but is incomplete (no `version.json`)

**What happens**:
- Preserves existing `specs/` and `steering/`
- Adds missing components
- Creates or updates `version.json`
- Creates backup before changes

**Example**:
```bash
# You have .kiro/specs/ but no version.json
kse adopt
```

### 3. Full Adoption

**When**: Complete `.kiro/` with `version.json` exists

**What happens**:
- Upgrades components to current version
- Preserves all user content
- Updates template files
- Creates backup before changes

**Example**:
```bash
# You have complete .kiro/ from older KSE version
kse adopt
```

---

## Step-by-Step Guide

### Basic Adoption (Interactive)

1. **Run the adopt command**:
   ```bash
   kse adopt
   ```

2. **Review the analysis**:
   ```
   📦 Analyzing project structure...
   
   Project Analysis:
     Project Type: nodejs
     .kiro/ Directory: No
     Recommended Strategy: fresh
   ```

3. **Review the adoption plan**:
   ```
   📋 Adoption Plan:
     Mode: fresh
     Actions:
       - Create .kiro/ directory structure
       - Copy template files (steering, tools, docs)
       - Create version.json
   ```

4. **Confirm the operation**:
   ```
   Proceed with adoption? (Y/n)
   ```

5. **Wait for completion**:
   ```
   📦 Creating backup...
   ✅ Backup created: adopt-2026-01-23-100000
   
   🚀 Executing adoption...
   
   ✅ Adoption completed successfully!
   
   Files created:
     + .kiro/
     + .kiro/specs/
     + .kiro/steering/
     + .kiro/tools/
     + version.json
   ```

### Dry Run (Preview Changes)

Preview what would change without making any modifications:

```bash
kse adopt --dry-run
```

**Output**:
```
🔍 Dry run mode - no changes will be made

Files that would be created:
  + .kiro/
  + .kiro/specs/
  + .kiro/steering/
  + version.json
```

### Automatic Mode (No Prompts)

Skip all confirmations (use with caution):

```bash
kse adopt --auto
```

**Use cases**:
- CI/CD pipelines
- Automated scripts
- When you're confident about the changes

### Force Specific Mode

Override automatic mode detection:

```bash
# Force fresh adoption
kse adopt --mode fresh

# Force partial adoption
kse adopt --mode partial

# Force full adoption
kse adopt --mode full
```

### Force Overwrite Conflicting Files

When you want to update template files to the latest version:

```bash
# Force overwrite conflicting files (creates backup first)
kse adopt --force
```

**What it does**:
- Overwrites existing steering files with latest templates
- Automatically creates backup before overwriting
- Useful when upgrading to get latest template improvements
- Shows clear warning about which files will be overwritten

**Use cases**:
- Upgrading template files to latest version
- Resetting steering files to defaults
- Applying new template improvements

**Safety**:
- Always creates backup before overwriting
- Can rollback with `kse rollback` if needed
- Preserves your Spec content (only updates templates)

**Example**:
```bash
$ kse adopt --force

⚠️  Conflicts detected:
    - steering/CORE_PRINCIPLES.md
    - steering/ENVIRONMENT.md
    - README.md
  ⚠️  --force enabled: Conflicting files will be overwritten
  A backup will be created before overwriting

? Proceed with adoption? Yes

📦 Creating backup...
✅ Backup created: backup-20260124-143022

🚀 Executing adoption...
✅ Adoption completed successfully!

Files updated:
  ~ steering/CORE_PRINCIPLES.md
  ~ steering/ENVIRONMENT.md
  ~ README.md

📦 Backup: backup-20260124-143022
  Run kse rollback if you need to undo changes
```

---

## Common Scenarios

### Scenario 1: Brand New Project

**Situation**: You just created a new project and want to use KSE.

**Solution**:
```bash
cd my-new-project
kse adopt
```

**Result**: Fresh adoption creates complete `.kiro/` structure.

---

### Scenario 2: Existing Project with Specs

**Situation**: You've been using KSE informally (manual `.kiro/` setup) and want to formalize it.

**Solution**:
```bash
cd my-existing-project
kse adopt
```

**Result**: Partial adoption preserves your specs and adds missing components.

---

### Scenario 3: Old KSE Project

**Situation**: Your project was initialized with an older KSE version.

**Solution**:
```bash
cd my-old-kse-project
kse adopt
```

**Result**: Full adoption upgrades to current version while preserving your content.

---

### Scenario 4: Conflict Resolution

**Situation**: You have custom steering files that conflict with templates.

**What happens**:
```
⚠️  Conflicts detected:
    - steering/CORE_PRINCIPLES.md

Existing files will be preserved, template files will be skipped
```

**Options**:
1. **Keep existing** (default): Your files are preserved
2. **Manual merge**: Review and merge manually after adoption
3. **Rollback and retry**: Use `kse rollback` if needed

---

### Scenario 5: Multiple Projects

**Situation**: You want to adopt KSE across multiple projects.

**Solution**:
```bash
# Create a script
for dir in project1 project2 project3; do
  cd $dir
  kse adopt --auto
  cd ..
done
```

---

## Troubleshooting

### Problem: "Permission denied" error

**Cause**: Insufficient file system permissions

**Solution**:
```bash
# Check permissions
ls -la .kiro/

# Fix permissions (Unix/Mac)
chmod -R u+w .kiro/

# Or run with elevated permissions (not recommended)
sudo kse adopt
```

---

### Problem: Adoption fails midway

**Cause**: File system error, disk full, or interrupted operation

**Solution**:
```bash
# Check if backup was created
kse rollback

# Select the most recent backup
# Restore and try again
```

---

### Problem: "Already adopted" message

**Cause**: Project already has `.kiro/` with current version

**Solution**:
```bash
# Check version info
kse version-info

# If you want to re-adopt, use upgrade instead
kse upgrade
```

---

### Problem: Conflicts with existing files

**Cause**: Your custom files conflict with template files

**Solution**:

**Option 1**: Keep your files (default behavior)
```bash
kse adopt
# Your files are preserved automatically
```

**Option 2**: Manual merge after adoption
```bash
kse adopt
# Then manually review and merge:
# - Your file: .kiro/steering/CORE_PRINCIPLES.md
# - Template: Check KSE documentation for latest template
```

**Option 3**: Backup and replace
```bash
# Manually backup your custom files
cp .kiro/steering/CORE_PRINCIPLES.md ~/backup/

# Remove conflicting files
rm .kiro/steering/CORE_PRINCIPLES.md

# Adopt again
kse adopt
```

---

### Problem: Python not found warning

**Cause**: Python is not installed or not in PATH

**Solution**:

**If you need Ultrawork tools**:
```bash
# Install Python 3.8+
# Windows: Download from python.org
# Mac: brew install python3
# Linux: sudo apt install python3

# Verify installation
python --version
```

**If you don't need Ultrawork tools**:
- Ignore the warning
- You can still use all other KSE features

---

### Problem: Want to undo adoption

**Cause**: Changed your mind or something went wrong

**Solution**:
```bash
# List available backups
kse rollback

# Select the backup from before adoption
# Restore to previous state
```

---

## Best Practices

### 1. Always Review First

Use dry-run mode before actual adoption:
```bash
kse adopt --dry-run
```

### 2. Commit Before Adoption

If using version control:
```bash
git add -A
git commit -m "Before KSE adoption"
kse adopt
```

### 3. Check Version Info

After adoption, verify everything is correct:
```bash
kse version-info
kse status
```

### 4. Keep Backups

Don't delete automatic backups immediately:
```bash
# Backups are in .kiro/backups/
ls .kiro/backups/
```

### 5. Document Custom Changes

If you customize steering files, document your changes:
```markdown
# In .kiro/steering/CUSTOM_RULES.md
## Custom Rules for This Project
- Rule 1: ...
- Rule 2: ...
```

---

## Next Steps

After successful adoption:

1. **Create your first spec**:
   ```bash
   kse create-spec 01-00-my-feature
   ```

2. **Check project status**:
   ```bash
   kse status
   ```

3. **Read the upgrade guide**:
   - See [Upgrade Guide](upgrade-guide.md) for version management

4. **Explore Ultrawork**:
   - Enhance your specs with quality assessment
   ```bash
   kse enhance requirements .kiro/specs/01-00-my-feature/requirements.md
   ```

---

## Getting Help

- **Documentation**: Check README.md in your `.kiro/` directory
- **Issues**: https://github.com/heguangyong/kiro-spec-engine/issues
- **Version Info**: `kse version-info`
- **System Check**: `kse doctor`

---

**Happy adopting! 🔥**
