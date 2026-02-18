# Using sce with Windsurf

> Complete guide to integrating sce with Windsurf for automated AI-assisted development

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: Windsurf  
**Integration Mode**: Native + Manual Export + Watch Mode  
**Estimated Setup Time**: 10 minutes

---

## Overview

**Windsurf** is an AI coding agent that can execute commands, modify files, and interact with your development environment autonomously.

**sce integration with Windsurf** supports all three modes:
- **Native-like**: Windsurf can execute sce commands directly
- **Manual Export**: Traditional export and paste workflow
- **Watch Mode**: Automatic context updates

### Why Use sce with Windsurf?

- ✅ **Fully automated** - Windsurf can run sce commands itself
- ✅ **Command execution** - No manual copy-paste needed
- ✅ **File modification** - Windsurf updates tasks.md automatically
- ✅ **Best automation** - Most seamless sce integration after SCE

---

## Integration Modes

### Mode 1: AI-Executed Commands (Recommended) ⭐

**How it works:**
1. You tell Windsurf what to build
2. Windsurf executes `sce context export` automatically
3. Windsurf reads the exported context
4. Windsurf implements the feature
5. Windsurf updates tasks.md automatically

**Example:**
```
You: "Implement the user login feature using sce"

Windsurf:
  [Executes] sce context export 01-00-user-login
  [Reads] .kiro/specs/01-00-user-login/context-export.md
  [Implements] Code according to design
  [Updates] tasks.md with completed tasks
```

### Mode 2: Watch Mode + Windsurf

**How it works:**
1. Start sce watch mode
2. Edit Specs, context auto-updates
3. Windsurf always has latest context
4. Fully automated workflow

---

## Setup

### Prerequisites

- **Windsurf installed** ([Download](https://windsurf.ai/))
- **sce installed** globally (`npm install -g scene-capability-engine`)
- **Project adopted** by sce (`sce adopt`)

### Step 1: Configure Windsurf System Prompt

Add to Windsurf's system prompt or project instructions:

```markdown
# sce Integration

This project uses sce (Scene Capability Engine) for spec-driven development.

## Before Implementing Features

1. Check if a Spec exists: `sce status`
2. Export Spec context: `sce context export <spec-name>`
3. Read the exported context file
4. Follow the design document exactly
5. Update tasks.md when completing tasks

## sce Commands

- `sce status` - Show project status and available Specs
- `sce context export <spec-name>` - Export Spec context
- `sce task claim <spec-name> <task-id>` - Claim a task
- `sce prompt generate <spec-name> <task-id>` - Generate task prompt

## Workflow

When user asks to implement a feature:
1. Run `sce context export <spec-name>`
2. Read `.kiro/specs/<spec-name>/context-export.md`
3. Implement according to design
4. Update `.kiro/specs/<spec-name>/tasks.md` (change [ ] to [x])

## Example

User: "Implement user login"
You should:
1. `sce context export 01-00-user-login`
2. Read context file
3. Implement AuthController, AuthService, etc.
4. Update tasks.md: `- [x] 1.1 Create AuthController`
```

### Step 2: Enable Watch Mode (Optional)

```bash
sce watch init
sce watch install context-export
sce watch start
```

---

## Workflow

### Method 1: Fully Automated (Recommended) ⭐

**Step 1: Tell Windsurf what to build**
```
You: "I need to implement the user login feature. Use sce to get the Spec and implement it."
```

**Step 2: Windsurf executes automatically**
```
Windsurf:
  [Executes] sce status
  [Output] Found Spec: 01-00-user-login
  
  [Executes] sce context export 01-00-user-login
  [Output] Context exported to context-export.md
  
  [Reads] .kiro/specs/01-00-user-login/context-export.md
  
  [Analyzes] Requirements, Design, Tasks
  
  [Implements] Task 1.1: Set up project dependencies
  [Creates] package.json updates
  
  [Updates] tasks.md: - [x] 1.1 Set up project dependencies
  
  [Implements] Task 1.2: Create User model
  [Creates] src/models/User.js
  
  [Updates] tasks.md: - [x] 1.2 Create User model
  
  [Continues through all tasks...]
```

**Step 3: Review and approve**
- Windsurf shows you what it's doing
- You can approve or modify each step
- Tasks are automatically tracked

### Method 2: Task-by-Task

**More control over implementation:**
```
You: "Use sce to get the user login Spec, then implement task 1.1 only"

Windsurf:
  [Executes] sce context export 01-00-user-login
  [Reads] context
  [Implements] Only task 1.1
  [Updates] tasks.md

You: "Good! Now implement task 1.2"

Windsurf:
  [Implements] Task 1.2
  [Updates] tasks.md
```

### Method 3: With Watch Mode

**Setup once, use forever:**
```bash
# Terminal 1: Start watch mode
sce watch start

# Terminal 2: Work with Windsurf
# Edit Specs → Context auto-updates → Windsurf always has latest
```

---

## Example Workflow

### Complete Feature Implementation

**Scenario:** Implement user login from scratch

**1. Create Spec**
```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
# Edit requirements.md, design.md, tasks.md
```

**2. Tell Windsurf**
```
You: "I've created a Spec for user login at .kiro/specs/01-00-user-login/

Please:
1. Use sce to export the context
2. Read the requirements and design
3. Implement all tasks in order
4. Update tasks.md as you complete each task
5. Run tests after each major component"
```

**3. Windsurf works autonomously**
```
Windsurf:
  ✓ Exported context
  ✓ Read Spec (requirements, design, tasks)
  ✓ Implemented task 1.1: Set up dependencies
  ✓ Implemented task 1.2: Create User model
  ✓ Implemented task 2.1: ValidationService
  ✓ Implemented task 2.2: AuthService
  ✓ Implemented task 2.3: UserRepository
  ✓ Implemented task 3.1: AuthController
  ✓ Implemented task 3.2: Rate limiting
  ✓ Implemented task 4.1: Tests
  ✓ All tests passing
  ✓ Updated tasks.md (all tasks marked complete)
  
  Feature complete! All 15 tasks implemented and tested.
```

---

## Tips & Best Practices

### 1. Let Windsurf Execute sce Commands

**Good:**
```
"Use sce to get the Spec for user login and implement it"
```

**Not as good:**
```
[You manually export context and paste it]
```

### 2. Be Specific About Task Updates

**Include in your instructions:**
```
"After completing each task, update tasks.md by changing [ ] to [x]"
```

### 3. Use Task Claiming

```
"Before implementing, claim task 1.1 using: sce task claim 01-00-user-login 1.1"
```

### 4. Request Progress Updates

```
"After each task, show me what you completed and what's next"
```

### 5. Combine with Watch Mode

```bash
# Keep watch mode running
sce watch start

# Tell Windsurf
"The Spec context auto-updates. Just read the latest context-export.md file"
```

---

## Advanced Techniques

### 1. Automated Testing

```
"After implementing each component:
1. Run the tests
2. If tests fail, fix the implementation
3. Don't move to next task until tests pass"
```

### 2. Incremental Commits

```
"After completing each task:
1. Update tasks.md
2. Run tests
3. Commit with message: 'Implement task X.X: [task name]'"
```

### 3. Design Validation

```
"Before implementing:
1. Read the design document
2. Identify any potential issues
3. Suggest improvements
4. Wait for my approval before proceeding"
```

### 4. Continuous Integration

```
"After implementing all tasks:
1. Run full test suite
2. Check code coverage
3. Run linter
4. Fix any issues
5. Generate test report"
```

---

## Troubleshooting

### Issue: Windsurf doesn't know about sce

**Solution:** Add sce instructions to system prompt (see Setup section)

### Issue: Windsurf doesn't update tasks.md

**Solution:** Be explicit:
```
"After completing task 1.1, edit .kiro/specs/01-00-user-login/tasks.md and change:
- [ ] 1.1 Task name
to:
- [x] 1.1 Task name"
```

### Issue: Windsurf deviates from design

**Solution:**
```
"Strictly follow the design document. Do not make architectural changes without asking first."
```

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with sce
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Command Reference](../command-reference.md)** - All sce commands

---

## Summary

**Windsurf + sce = Most Automated Workflow**

**Key advantages:**
- ✅ Windsurf executes sce commands automatically
- ✅ No manual copy-paste needed
- ✅ Automatic task tracking
- ✅ Full feature implementation with minimal intervention

**Best practices:**
- Configure system prompt with sce instructions
- Let Windsurf execute sce commands
- Use watch mode for auto-updates
- Request progress updates
- Review before approving changes

**Start using:** 🚀
```bash
sce adopt
sce spec bootstrap --name 01-00-my-feature --non-interactive
# Tell Windsurf: "Use sce to implement 01-00-my-feature"
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

