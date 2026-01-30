# Team Collaboration Guide

## Overview

This guide explains how to effectively collaborate on kse projects with your team, covering version control strategies, Spec sharing, and multi-user workflows.

---

## 📋 Version Control Strategy

### What to Commit

kse uses a **layered .gitignore strategy** to balance team collaboration and personal workflow:

#### ✅ DO Commit (Team Shared)

| Path | Purpose | Why Commit |
|------|---------|-----------|
| `.kiro/specs/` | Feature specifications | **Core value**: Team needs to see requirements, design, and tasks |
| `.kiro/steering/CORE_PRINCIPLES.md` | Development principles | Team coding standards |
| `.kiro/steering/ENVIRONMENT.md` | Project environment | Project setup and configuration |
| `.kiro/steering/RULES_GUIDE.md` | Rules index | Quick reference for team |
| `.kiro/tools/` | Shared scripts | Team automation tools |
| `.kiro/config/` | Project configuration | Document governance, etc. |
| `.kiro/contexts/` (structure) | Multi-user setup | Directory structure for team contexts |

#### ❌ DO NOT Commit (User-Specific)

| Path | Purpose | Why Exclude |
|------|---------|-------------|
| `.kiro/steering/CURRENT_CONTEXT.md` | Personal work context | Causes merge conflicts |
| `.kiro/contexts/*/CURRENT_CONTEXT.md` | Personal contexts | User-specific state |
| `.kiro/environments.json` | Environment registry | User-specific configurations |
| `.kiro/env-backups/` | Environment backups | User-specific backups |
| `.kiro/backups/` | Adoption backups | Temporary backups |
| `.kiro/logs/` | Operation logs | Runtime logs |
| `.kiro/reports/` | Compliance reports | Temporary reports |

### Recommended .gitignore

```gitignore
# ========================================
# .kiro/ Directory - Layered Management
# ========================================

# Personal state files (DO NOT commit)
.kiro/steering/CURRENT_CONTEXT.md
.kiro/contexts/.active
.kiro/contexts/*/CURRENT_CONTEXT.md

# Environment configuration (DO NOT commit)
.kiro/environments.json
.kiro/env-backups/

# Temporary files and backups (DO NOT commit)
.kiro/backups/
.kiro/logs/
.kiro/reports/

# Spec artifacts (COMMIT - but exclude temporary files)
.kiro/specs/**/SESSION-*.md
.kiro/specs/**/*-SUMMARY.md
.kiro/specs/**/*-COMPLETE.md
.kiro/specs/**/TEMP-*.md
.kiro/specs/**/WIP-*.md
.kiro/specs/**/MVP-*.md
```

---

## 🤝 Multi-User Workflows

### Scenario 1: Multiple Developers, Same Project

**Setup**:

```bash
# Developer A
git clone <repo>
cd project
npm install -g kiro-spec-engine
kse adopt
.kiro/create-workspace.bat alice

# Developer B
git clone <repo>
cd project
npm install -g kiro-spec-engine
kse adopt
.kiro/create-workspace.bat bob
```

**Daily Workflow**:

```bash
# Switch to your personal context
.kiro/switch-workspace.bat alice

# Work on your tasks
kse status
# ... make changes ...

# Commit Spec changes (shared)
git add .kiro/specs/
git commit -m "feat: complete task 3.2 in Spec 15-00"

# Your personal CURRENT_CONTEXT.md is NOT committed (gitignored)
```

**Benefits**:
- ✅ Each developer has their own CURRENT_CONTEXT.md
- ✅ No merge conflicts on personal state
- ✅ Spec documents are shared and versioned
- ✅ Team can see feature progress

### Scenario 2: Spec-Driven Feature Development

**Feature Owner** (creates Spec):

```bash
# Create new Spec
kse workflows create user-authentication

# Edit requirements, design, tasks
# ... work on Spec documents ...

# Commit Spec to share with team
git add .kiro/specs/21-00-user-authentication/
git commit -m "spec: add user authentication feature"
git push
```

**Team Member** (implements Spec):

```bash
# Pull latest Specs
git pull

# Check available Specs
kse status

# Read Spec documents
cat .kiro/specs/21-00-user-authentication/requirements.md
cat .kiro/specs/21-00-user-authentication/design.md
cat .kiro/specs/21-00-user-authentication/tasks.md

# Implement according to Spec
# ... write code ...

# Update task status
# Edit tasks.md, mark tasks as complete

# Commit implementation + task updates
git add .kiro/specs/21-00-user-authentication/tasks.md
git add lib/ tests/
git commit -m "feat: implement user authentication (tasks 1-3)"
git push
```

**Benefits**:
- ✅ Clear requirements and design shared upfront
- ✅ Team knows what to implement
- ✅ Progress is tracked in tasks.md
- ✅ Knowledge is preserved in Spec documents

### Scenario 3: Environment Configuration Sharing

**Problem**: Each developer needs different environment configurations (local DB, API endpoints, etc.)

**Solution**: Share environment **templates**, not the registry

**Project Structure**:

```
project-root/
├── config/
│   ├── env-local.json          # Template for local environment
│   ├── env-staging.json        # Template for staging
│   └── env-production.json     # Template for production
├── .env.local                  # Source file for local
├── .env.staging                # Source file for staging
├── .env.production             # Source file for production
└── .kiro/
    └── environments.json       # NOT committed (user-specific)
```

**Setup for New Team Member**:

```bash
# Clone project
git clone <repo>
cd project

# Install kse
npm install -g kiro-spec-engine
kse adopt

# Register environments from templates
kse env register config/env-local.json
kse env register config/env-staging.json
kse env register config/env-production.json

# Switch to local environment
kse env switch local
```

**Benefits**:
- ✅ Environment templates are versioned
- ✅ Each developer registers their own environments
- ✅ No conflicts on `.kiro/environments.json`
- ✅ Easy onboarding for new team members

---

## 📚 Spec Sharing Best Practices

### 1. Commit Complete Specs

When creating a Spec, commit all three documents:

```bash
git add .kiro/specs/22-00-feature-name/requirements.md
git add .kiro/specs/22-00-feature-name/design.md
git add .kiro/specs/22-00-feature-name/tasks.md
git commit -m "spec: add feature-name specification"
```

### 2. Update Tasks as You Progress

```bash
# After completing tasks
git add .kiro/specs/22-00-feature-name/tasks.md
git commit -m "chore: update task status for feature-name"
```

### 3. Exclude Temporary Spec Files

The .gitignore already excludes:
- `SESSION-*.md` - Session summaries
- `*-SUMMARY.md` - Temporary summaries
- `*-COMPLETE.md` - Completion reports
- `TEMP-*.md`, `WIP-*.md`, `MVP-*.md` - Work-in-progress files

These are useful during development but shouldn't be committed.

### 4. Commit Spec Artifacts Selectively

If your Spec generates useful artifacts (scripts, reports, test data):

```bash
# Commit useful scripts
git add .kiro/specs/22-00-feature-name/scripts/migration.js

# Commit important reports
git add .kiro/specs/22-00-feature-name/reports/performance-analysis.md

# But exclude temporary files (already gitignored)
```

---

## 🔄 Workflow Examples

### Example 1: Starting a New Feature

**Product Owner / Tech Lead**:

```bash
# 1. Create Spec
kse workflows create payment-integration

# 2. Write requirements
# Edit .kiro/specs/23-00-payment-integration/requirements.md

# 3. Write design
# Edit .kiro/specs/23-00-payment-integration/design.md

# 4. Break down tasks
# Edit .kiro/specs/23-00-payment-integration/tasks.md

# 5. Commit Spec
git add .kiro/specs/23-00-payment-integration/
git commit -m "spec: add payment integration feature"
git push

# 6. Assign to team
# Create GitHub issue linking to Spec
```

**Developer**:

```bash
# 1. Pull latest
git pull

# 2. Review Spec
kse status
cat .kiro/specs/23-00-payment-integration/requirements.md
cat .kiro/specs/23-00-payment-integration/design.md

# 3. Implement tasks
# ... write code ...

# 4. Update task status
# Edit tasks.md, mark completed tasks

# 5. Commit implementation
git add .kiro/specs/23-00-payment-integration/tasks.md
git add lib/payment/ tests/payment/
git commit -m "feat: implement payment integration (tasks 1-5)"
git push
```

### Example 2: Code Review with Spec Context

**Reviewer**:

```bash
# 1. Check PR
git checkout feature/payment-integration

# 2. Read Spec for context
cat .kiro/specs/23-00-payment-integration/requirements.md
cat .kiro/specs/23-00-payment-integration/design.md

# 3. Verify implementation matches design
# Compare code against design document

# 4. Check task completion
cat .kiro/specs/23-00-payment-integration/tasks.md

# 5. Provide feedback
# Comment on PR with Spec references
```

**Benefits**:
- ✅ Reviewer has full context
- ✅ Can verify implementation matches design
- ✅ Can check if all tasks are complete
- ✅ Spec serves as documentation

### Example 3: Onboarding New Team Member

**New Developer**:

```bash
# 1. Clone and setup
git clone <repo>
cd project
npm install -g kiro-spec-engine
kse adopt

# 2. Create personal workspace
.kiro/create-workspace.bat john

# 3. Register environments
kse env register config/env-local.json
kse env switch local

# 4. Review project Specs
kse status
# See all features and their status

# 5. Pick a task
cat .kiro/specs/24-00-feature/tasks.md
# Find unassigned tasks

# 6. Start working
# ... implement tasks ...
```

**Benefits**:
- ✅ All Specs are available immediately
- ✅ Can see project history and decisions
- ✅ Clear task list to pick from
- ✅ No setup friction

---

## 🚨 Common Pitfalls

### ❌ Pitfall 1: Committing CURRENT_CONTEXT.md

**Problem**: Causes merge conflicts when multiple developers work simultaneously.

**Solution**: Ensure `.kiro/steering/CURRENT_CONTEXT.md` is in .gitignore.

```bash
# Check if gitignored
git check-ignore .kiro/steering/CURRENT_CONTEXT.md
# Should output: .kiro/steering/CURRENT_CONTEXT.md

# If not, add to .gitignore
echo ".kiro/steering/CURRENT_CONTEXT.md" >> .gitignore
```

### ❌ Pitfall 2: Committing environments.json

**Problem**: Each developer has different environment configurations.

**Solution**: Commit environment **templates**, not the registry.

```bash
# DO commit templates
git add config/env-local.json
git commit -m "chore: add environment templates"

# DO NOT commit registry
# .kiro/environments.json should be gitignored
```

### ❌ Pitfall 3: Not Committing Specs

**Problem**: Team can't see feature requirements and design.

**Solution**: Always commit Spec documents.

```bash
# Commit Specs
git add .kiro/specs/
git commit -m "spec: add new feature specification"
```

### ❌ Pitfall 4: Committing Temporary Files

**Problem**: Pollutes repository with session summaries and temporary reports.

**Solution**: Ensure temporary patterns are gitignored.

```gitignore
.kiro/specs/**/SESSION-*.md
.kiro/specs/**/*-SUMMARY.md
.kiro/specs/**/*-COMPLETE.md
.kiro/specs/**/TEMP-*.md
```

---

## 📊 Summary

### Commit Strategy

| Content | Commit? | Reason |
|---------|---------|--------|
| Spec documents (requirements, design, tasks) | ✅ Yes | Team collaboration |
| Core principles, environment guide | ✅ Yes | Team standards |
| Shared tools and scripts | ✅ Yes | Team automation |
| Personal CURRENT_CONTEXT.md | ❌ No | Causes conflicts |
| Environment registry (environments.json) | ❌ No | User-specific |
| Backups, logs, reports | ❌ No | Temporary files |
| Environment templates (config/*.json) | ✅ Yes | Team setup |

### Key Principles

1. **Share Knowledge**: Commit Specs so team can see requirements and design
2. **Avoid Conflicts**: Don't commit personal state (CURRENT_CONTEXT.md)
3. **Template Over Instance**: Commit environment templates, not registries
4. **Clean Repository**: Exclude temporary files and backups
5. **Multi-User Support**: Use contexts/ for personal workspaces

---

**Version**: 1.0  
**Last Updated**: 2026-01-30  
**Related**: [Environment Management Guide](environment-management-guide.md), [.kiro/README.md](../.kiro/README.md)
