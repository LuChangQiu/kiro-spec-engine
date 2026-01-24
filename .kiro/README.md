# kse - Kiro Spec Engine

> **AI Tools: Read this first!** This project uses kse (Kiro Spec Engine) for structured development.

---

## 🎯 What is kse?

**kse** is a CLI tool that provides structured, Spec-driven development workflows for AI-assisted coding.

**Key concepts:**
- **Spec**: A structured feature definition with requirements, design, and tasks
- **Context Export**: Generate AI-friendly documentation from Specs
- **Task Tracking**: Monitor implementation progress
- **Steering Rules**: AI behavior guidelines in `.kiro/steering/`

**This project has adopted kse** - all development should follow the Spec-driven workflow

---

## 📦 kse Commands (For AI Tools)

### Check Project Status
```bash
kse status
```
Shows all Specs and their progress.

### List All Specs
```bash
kse workflows
```
Lists all available Specs in `.kiro/specs/`.

### Export Spec Context
```bash
kse context export <spec-name>
```
Generates AI-friendly context from a Spec (requirements + design + tasks).

**Example:**
```bash
kse context export 01-00-user-login
# Creates: .kiro/specs/01-00-user-login/context-export.md
```

### Generate Task Prompt
```bash
kse prompt generate <spec-name> <task-id>
```
Creates a focused prompt for a specific task.

**Example:**
```bash
kse prompt generate 01-00-user-login 1.1
# Generates prompt for task 1.1 only
```

### Claim a Task
```bash
kse task claim <spec-name> <task-id>
```
Mark a task as "in progress" and assign it to yourself.

**Example:**
```bash
kse task claim 01-00-user-login 1.1
```

### Check Adoption Status
```bash
kse doctor
```
Verifies kse is properly configured in the project.

---

## 🤖 AI Workflow Guide

### When User Asks to Implement a Feature

**Step 1: Check if Spec exists**
```bash
kse workflows
```

**Step 2: Export Spec context**
```bash
kse context export <spec-name>
```

**Step 3: Read the exported context**
```bash
# Context is at: .kiro/specs/<spec-name>/context-export.md
```

**Step 4: Implement according to the Spec**
- Follow requirements in `requirements.md`
- Follow design in `design.md`
- Complete tasks from `tasks.md`

**Step 5: Update task status**
- Mark tasks as complete: `- [x] 1.1 Task description`
- Mark tasks in progress: `- [-] 1.1 Task description`

### When User Asks About Project Status

```bash
kse status
```

This shows:
- All Specs in the project
- Task completion progress
- Current active Specs

### When User Asks to Start a New Feature

**If no Spec exists:**
```
I notice there's no Spec for this feature yet. 
Would you like me to create one? I can help you define:
1. Requirements (what we're building)
2. Design (how we'll build it)
3. Tasks (implementation steps)
```

**If Spec exists:**
```bash
kse context export <spec-name>
# Then read and implement according to the Spec
```

---

## 📁 Directory Structure

```
.kiro/
├── README.md                  # This file - kse usage guide
├── specs/                     # All Specs live here
│   ├── SPEC_WORKFLOW_GUIDE.md # Detailed Spec workflow
│   └── {spec-name}/           # Individual Spec
│       ├── requirements.md    # What we're building
│       ├── design.md          # How we'll build it
│       ├── tasks.md           # Implementation steps
│       ├── context-export.md  # AI-friendly export (generated)
│       ├── scripts/           # Spec-specific scripts
│       ├── tests/             # Spec-specific tests
│       └── results/           # Execution results
├── steering/                  # AI behavior rules
│   ├── RULES_GUIDE.md         # Quick reference
│   ├── CORE_PRINCIPLES.md     # Core development rules
│   ├── ENVIRONMENT.md         # Project environment
│   └── CURRENT_CONTEXT.md     # Current Spec context
└── tools/                     # Tool configurations
```

**Key files for AI:**
- `.kiro/README.md` (this file) - kse command reference
- `.kiro/steering/CORE_PRINCIPLES.md` - Development rules
- `.kiro/steering/CURRENT_CONTEXT.md` - Current work context
- `.kiro/specs/{spec-name}/context-export.md` - Spec context

---

## 📖 Spec Structure

Each Spec contains three core documents:

### 1. requirements.md
**Purpose:** Define WHAT we're building

**Contains:**
- User stories
- Functional requirements
- Non-functional requirements
- Acceptance criteria

### 2. design.md
**Purpose:** Define HOW we'll build it

**Contains:**
- Architecture overview
- Component design
- API design
- Data models
- Technology choices

### 3. tasks.md
**Purpose:** Break down implementation

**Contains:**
- Ordered task list
- Task dependencies
- Implementation notes

**Task status markers:**
- `- [ ]` Not started
- `- [-]` In progress
- `- [x]` Completed

---

## 🎯 Spec-Driven Workflow

```
1. User requests feature
   ↓
2. Check if Spec exists (kse workflows)
   ↓
3. If no Spec: Suggest creating one
   If Spec exists: Export context (kse context export)
   ↓
4. Read requirements.md and design.md
   ↓
5. Implement according to Spec
   ↓
6. Update tasks.md as you complete tasks
   ↓
7. Verify against acceptance criteria
```

**Why Spec-driven?**
- ✅ Clear requirements before coding
- ✅ Consistent architecture decisions
- ✅ Trackable progress
- ✅ Better AI understanding of context
- ✅ Knowledge preserved in Specs

---

## 🔧 Common AI Tasks

### Task 1: Implement a Feature

```bash
# 1. Check what Specs exist
kse workflows

# 2. Export the Spec context
kse context export 01-00-user-login

# 3. Read the context
# File: .kiro/specs/01-00-user-login/context-export.md

# 4. Implement according to requirements and design

# 5. Update tasks.md to mark tasks complete
```

### Task 2: Check Project Status

```bash
kse status
```

Shows all Specs and their completion progress.

### Task 3: Work on Specific Task

```bash
# Generate focused prompt for one task
kse prompt generate 01-00-user-login 1.1

# Claim the task
kse task claim 01-00-user-login 1.1

# Implement the task

# Mark complete in tasks.md
```

### Task 4: Understand Project Context

**Read these files in order:**
1. `.kiro/README.md` (this file) - kse basics
2. `.kiro/steering/CURRENT_CONTEXT.md` - Current work
3. `.kiro/steering/CORE_PRINCIPLES.md` - Development rules
4. `.kiro/specs/{spec-name}/requirements.md` - Feature requirements
5. `.kiro/specs/{spec-name}/design.md` - Feature design

---

## 💡 Best Practices for AI

### DO:
- ✅ Always check `kse workflows` to see available Specs
- ✅ Export context before implementing: `kse context export <spec>`
- ✅ Follow requirements and design documents strictly
- ✅ Update tasks.md as you complete work
- ✅ Read steering rules in `.kiro/steering/`
- ✅ Keep all Spec artifacts in the Spec directory

### DON'T:
- ❌ Implement features without checking for Specs first
- ❌ Ignore requirements or design documents
- ❌ Create temporary files in project root
- ❌ Skip updating task status
- ❌ Deviate from architecture without discussion

---

## 🚀 Quick Reference

| Task | Command |
|------|---------|
| List all Specs | `kse workflows` |
| Check status | `kse status` |
| Export Spec | `kse context export <spec>` |
| Generate task prompt | `kse prompt generate <spec> <task>` |
| Claim task | `kse task claim <spec> <task>` |
| Verify setup | `kse doctor` |

---

## 📚 Learn More

- **Spec Workflow Guide**: `.kiro/specs/SPEC_WORKFLOW_GUIDE.md`
- **Core Principles**: `.kiro/steering/CORE_PRINCIPLES.md`
- **Current Context**: `.kiro/steering/CURRENT_CONTEXT.md`
- **Environment**: `.kiro/steering/ENVIRONMENT.md`

---

**kse Version**: 1.5.4  
**Last Updated**: 2026-01-24  
**Purpose**: AI tool reference for kse usage
