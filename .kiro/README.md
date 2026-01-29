# Project Development Guide

> **AI Tools: Read this first!** This project follows Spec-driven development methodology.

---

## 🎯 How This Project Works

This project uses **Spec-driven development** - a structured approach where:
- Every feature starts with a **Spec** (requirements + design + tasks)
- All work is tracked and documented
- AI tools help implement features according to Specs

**Your role as AI:**
- When user requests a feature → Check if Spec exists, if not, help create one
- When implementing → Follow the Spec's requirements and design
- When stuck → Read the Spec documents for context
- Track progress by updating task status

**The tool `kse` helps you:**
- Check project status: `kse status`
- Find Specs: `kse workflows`
- Get context: `kse context export <spec-name>`
- But you don't need to memorize commands - use them when needed

---

## 📋 Development Workflow

### When User Asks You to Implement a Feature

**Step 1: Check if Spec exists**
```
Look in .kiro/specs/ directory
```

**Step 2: If Spec exists**
- Read `requirements.md` - understand what to build
- Read `design.md` - understand how to build it
- Read `tasks.md` - see implementation steps
- Implement according to the Spec
- Update task status as you complete work

**Step 3: If no Spec exists**
- Suggest creating a Spec first
- Help user define requirements
- Help design the solution
- Break down into tasks
- Then implement

**Why Spec-first?**
- Clear requirements prevent misunderstandings
- Design decisions are documented
- Progress is trackable
- Knowledge is preserved

### When User Asks About Project Status

Check what's happening:
```bash
kse status
```

This shows all Specs and their progress.

### When You Need Context

If you need to understand a feature:
```bash
kse context export <spec-name>
```

This generates a summary of requirements, design, and tasks.

---

## 📁 Project Structure

```
.kiro/
├── README.md                  # This file - project development guide
├── specs/                     # All Specs live here
│   ├── SPEC_WORKFLOW_GUIDE.md # Spec creation workflow guide
│   └── {spec-name}/           # Individual Spec
│       ├── requirements.md    # What we're building
│       ├── design.md          # How we'll build it
│       ├── tasks.md           # Implementation steps
│       ├── reports/           # Reports and summaries
│       ├── scripts/           # Automation scripts
│       └── custom/            # Custom artifacts
├── steering/                  # Development rules (auto-loaded by AI)
│   ├── CORE_PRINCIPLES.md     # Core development principles
│   ├── ENVIRONMENT.md         # Project environment
│   ├── CURRENT_CONTEXT.md     # Current work context
│   └── RULES_GUIDE.md         # Rules index
├── config/                    # Configuration files
│   └── docs.json              # Document governance rules
├── contexts/                  # Multi-user collaboration contexts
│   ├── README.md              # Context management guide
│   └── {developer}/           # Individual developer contexts
├── logs/                      # Audit logs
│   └── governance-history.json # Document governance history
├── reports/                   # Compliance reports
│   └── document-compliance-*.md
└── tools/                     # Tool configurations
```

**Key files:**
- `.kiro/steering/CORE_PRINCIPLES.md` - Development principles for this project
- `.kiro/steering/CURRENT_CONTEXT.md` - What we're currently working on
- `.kiro/specs/{spec-name}/` - Feature specifications

**Directory purposes:**
- **specs/** - All feature specifications and their artifacts
- **steering/** - AI behavior rules (⚠️ auto-loaded, keep minimal)
- **config/** - System configuration (document governance, etc.)
- **contexts/** - Multi-user collaboration support (optional)
- **logs/** - Audit trails for governance operations
- **reports/** - Historical compliance reports

---

## 📖 What is a Spec?

A Spec is a complete feature definition with three parts:

### 1. requirements.md - WHAT we're building
- User stories
- Functional requirements
- Acceptance criteria
- Non-functional requirements

### 2. design.md - HOW we'll build it
- Architecture
- Component design
- API design
- Technology choices

### 3. tasks.md - Implementation steps
- Ordered task list
- Task dependencies
- Implementation notes

**Task status:**
- `- [ ]` Not started
- `- [-]` In progress  
- `- [x]` Completed

---

## 💡 Working with This Project

### DO:
- ✅ Check for existing Specs before starting work
- ✅ Follow requirements and design in Specs
- ✅ Update task status as you work
- ✅ Read steering rules for project-specific guidelines
- ✅ Ask user if requirements are unclear

### DON'T:
- ❌ Start implementing without understanding requirements
- ❌ Ignore the design document
- ❌ Create files in wrong locations
- ❌ Skip updating task status

---

## 🔍 Finding Information

**Need to understand a feature?**
→ Read `.kiro/specs/{spec-name}/requirements.md` and `design.md`

**Need to know what to work on?**
→ Read `.kiro/specs/{spec-name}/tasks.md`

**Need project context?**
→ Read `.kiro/steering/CURRENT_CONTEXT.md`

**Need development rules?**
→ Read `.kiro/steering/CORE_PRINCIPLES.md`

**Need to check status?**
→ Run `kse status`

---

## 🗂️ Workspace Management

### Multi-Project Management (kse workspace)

Manage multiple kse projects from one place:

```bash
# Create/register a workspace
kse workspace create <name> [path]

# List all workspaces
kse workspace list

# Switch to a workspace
kse workspace switch <name>

# Show current workspace info
kse workspace info

# Remove a workspace
kse workspace remove <name>
```

**Use case**: You have multiple projects (kse-main, my-app, another-tool) and want to quickly switch between them.

**Data storage**: `~/.kse/workspace-state.json` (global config)
- **Windows**: `C:\Users\{YourName}\.kse\workspace-state.json`
- **Linux/macOS**: `~/.kse/workspace-state.json`

**Data structure**:
```json
{
  "version": "1.0",
  "activeWorkspace": "kse-main",
  "workspaces": [
    {
      "name": "kse-main",
      "path": "E:/workspace/kiro-spec-engine",
      "createdAt": "2026-01-29T06:32:41.418Z",
      "lastAccessed": "2026-01-29T06:32:55.190Z"
    }
  ],
  "preferences": {
    "autoDetectWorkspace": true,
    "confirmDestructiveOperations": true
  }
}
```

**Key features**:
- ✅ Global configuration (not in project directory)
- ✅ Single Source of Truth (data atomicity)
- ✅ Cross-project management
- ✅ Access history tracking

### Multi-User Collaboration (contexts/)

For teams working on the same project:

```bash
# Create personal context (Windows)
.kiro\create-workspace.bat <your-name>

# Switch context (Windows)
.kiro\switch-workspace.bat <workspace-name>

# Linux/macOS
bash .kiro/create-workspace.sh <your-name>
bash .kiro/switch-workspace.sh <workspace-name>
```

**Use case**: Multiple developers working on the same project, each with their own `CURRENT_CONTEXT.md`.

**Data storage**: `.kiro/contexts/{developer}/CURRENT_CONTEXT.md`

**How it works**:
1. Each developer has their own context in `contexts/{name}/`
2. When you switch workspace, your current context is saved
3. The new workspace's context is loaded to `steering/CURRENT_CONTEXT.md`
4. Only the active context is read by AI tools

**Multi-user + Auto-fix**:
- ✅ Auto-fix detects multi-user projects automatically
- ✅ Your personal context in `contexts/` is preserved
- ✅ Only `steering/CURRENT_CONTEXT.md` is managed by auto-fix
- ✅ Switch workspace to restore your personal context

**Key difference**:
- **kse workspace**: Cross-project management (different directories)
- **contexts/**: Same project, different developers

**Setup for new team members**:
```bash
# 1. Clone the project
git clone <repo-url>
cd <project>

# 2. Install kse
npm install -g kiro-spec-engine

# 3. Create your personal workspace
.kiro\create-workspace.bat <your-name>

# 4. Start working
kse status
```

---

## 🔒 Steering Directory Compliance

The `.kiro/steering/` directory is **automatically loaded in every AI session**, making it critical to keep clean and minimal.

### Allowed Files (Only These 4)

- ✅ `CORE_PRINCIPLES.md` - Core development principles
- ✅ `ENVIRONMENT.md` - Project environment configuration
- ✅ `CURRENT_CONTEXT.md` - Current work context
- ✅ `RULES_GUIDE.md` - Rules index

### Prohibited Content

- ❌ **Any other files** (analysis reports, temporary notes, etc.)
- ❌ **Any subdirectories** (archive/, old-rules/, etc.)
- ❌ **Hidden files** (.gitkeep, .DS_Store, etc.)

### Why This Matters

**Context pollution**: Every file in steering/ is loaded into AI context, consuming tokens and slowing responses.

**Token waste**: Unnecessary files increase costs and reduce available context for actual work.

### Automatic Compliance Check

kse automatically checks steering directory compliance before every command:

```bash
# Normal usage - check runs automatically and fixes violations
kse status

# If violations found, they are automatically backed up and removed
# Output example:
# 🔧 Auto-fixing steering directory compliance violations...
# Disallowed files to be removed:
#   - analysis-report.md
# ✓ Backup created: .kiro/backups/steering-cleanup-2026-01-29T10-30-00
# ✓ Removed file: analysis-report.md
# ✓ Steering directory cleaned successfully!

# Bypass check (not recommended)
kse status --skip-steering-check

# Force check even if cached
kse status --force-steering-check

# Environment variable bypass
set KSE_SKIP_STEERING_CHECK=1
kse status
```

**Cache behavior**: After first successful check, kse caches the result per version to avoid repeated checks.

**Cache location**: `~/.kse/steering-check-cache.json`

### Auto-Fix Behavior

When violations are detected, kse automatically:

1. **Creates differential backup** - Only backs up violating files/directories
2. **Backup location** - `.kiro/backups/steering-cleanup-{timestamp}/`
3. **Removes violations** - Cleans steering directory to compliant state
4. **Shows progress** - Clear messages about what was backed up and removed
5. **Provides rollback info** - Shows command to restore if needed

**No user confirmation required** - The system takes over and fixes automatically.

**Multi-user projects**: 
- Auto-fix detects if you're using `contexts/` for multi-user collaboration
- Your personal context in `contexts/{your-name}/` is preserved
- Only `steering/CURRENT_CONTEXT.md` is managed by auto-fix
- Use workspace scripts to switch between personal contexts

### Restoring from Backup

If you need to restore backed-up files:

```bash
kse rollback --backup steering-cleanup-2026-01-29T10-30-00
```

### Multi-User Collaboration

If multiple developers work on the same project:

1. **Each developer creates their workspace**:
   ```bash
   .kiro\create-workspace.bat alice
   .kiro\create-workspace.bat bob
   ```

2. **Switch between workspaces**:
   ```bash
   .kiro\switch-workspace.bat alice
   ```

3. **Auto-fix respects multi-user setup**:
   - Detects `contexts/` directory automatically
   - Preserves personal contexts
   - Shows informational message during fix

4. **Git workflow**:
   - Commit: `contexts/` directory structure
   - Ignore: `contexts/**/CURRENT_CONTEXT.md` (personal contexts)
   - Ignore: `steering/CURRENT_CONTEXT.md` (active context)

---

**Where to move content**:
- Analysis reports → `.kiro/specs/{spec-name}/results/`
- Historical data → `.kiro/specs/{spec-name}/`
- Detailed documentation → `docs/`
- Temporary files → Delete them

---

## 📋 Document Governance

The project enforces document structure standards:

### Validation Commands

```bash
# Validate document structure
kse docs validate [--spec <name>] [--all]

# Scan for violations
kse docs diagnostic

# Archive misplaced files
kse docs archive --spec <name>
```

### Allowed Structure

**Spec subdirectories** (only these are allowed):
- `reports/` - Reports and summaries
- `scripts/` - Automation scripts
- `custom/` - Custom artifacts

**Temporary file patterns** (auto-detected):
- `*-SUMMARY.md`, `SESSION-*.md`, `*-COMPLETE.md`
- `TEMP-*.md`, `WIP-*.md`, `MVP-*.md`

**Governance logs**:
- `.kiro/logs/governance-history.json` - Audit trail
- `.kiro/reports/document-compliance-*.md` - Compliance reports

---

## 🚀 Quick Start for AI

1. **User asks you to implement something**
2. **You check**: Does a Spec exist for this? (`kse workflows` or check `.kiro/specs/`)
3. **If yes**: Read the Spec and implement according to it
4. **If no**: Suggest creating a Spec first, help user define it
5. **While working**: Update task status in `tasks.md`
6. **When done**: Mark tasks complete

**Remember**: You're not just writing code, you're following a structured development process. The Spec is your guide.

---

**Project Type**: Spec-driven development  
**Last Updated**: 2026-01-29  
**Version**: 2.0  
**Purpose**: Guide AI tools to work effectively with this project

**New in v2.0**:
- Multi-workspace management (`kse workspace`)
- Document governance system (`kse docs`)
- Multi-user collaboration support (contexts/)
- Comprehensive directory structure documentation
