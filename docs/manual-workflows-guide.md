# Manual Workflows Guide

> Complete guide for manual workflows when automation is not available

---

## Overview

This guide provides step-by-step instructions for common workflows when using kiro-spec-engine without automation (watch mode or agent hooks). These workflows are designed to be efficient and easy to follow.

**When to use manual workflows:**
- When automation is not set up
- When working in environments without watch mode support
- When you prefer manual control over automation
- For one-off tasks or testing

---

## Table of Contents

1. [Task Sync Workflow](#task-sync-workflow)
2. [Context Export Workflow](#context-export-workflow)
3. [Prompt Generation Workflow](#prompt-generation-workflow)
4. [Workflow Checklists](#workflow-checklists)

---

## Task Sync Workflow

### Purpose
Keep your workspace synchronized with task progress across multiple users or tools.

### Time Estimate
- Initial sync: 2-3 minutes
- Subsequent syncs: 30-60 seconds

### Prerequisites
- Project adopted with kiro-spec-engine
- Active spec with tasks.md file
- Write access to .kiro/specs/ directory

### Step-by-Step Instructions

#### 1. Check Current Status
```bash
kse status
```

**What to look for:**
- Current spec name
- Number of tasks (total, completed, in progress)
- Last sync timestamp

**Time:** ~5 seconds

---

#### 2. Review Task Changes
Open your spec's `tasks.md` file and review:
- Tasks you've completed (mark with `[x]`)
- Tasks you're working on (mark with `[-]`)
- Tasks you've queued (mark with `[~]`)

**Example:**
```markdown
- [x] 1.1 Completed task
- [-] 1.2 In progress task
- [~] 1.3 Queued task
- [ ] 1.4 Not started task
```

**Time:** ~30-60 seconds

---

#### 3. Sync Workspace
```bash
kse workspace sync
```

**What this does:**
- Updates workspace metadata
- Synchronizes task status
- Detects conflicts
- Updates timestamps

**Time:** ~10-15 seconds

---

#### 4. Verify Sync
```bash
kse status
```

**Verify:**
- Task counts are updated
- Sync timestamp is current
- No conflicts reported

**Time:** ~5 seconds

---

### Best Practices

1. **Sync Frequency**
   - Before starting work: Always sync first
   - After completing tasks: Sync immediately
   - During long sessions: Sync every 30-60 minutes

2. **Conflict Resolution**
   - If conflicts detected, review both versions
   - Keep the most recent accurate state
   - Document resolution in commit message

3. **Team Coordination**
   - Communicate task claims in team chat
   - Use task claiming feature: `kse task claim <spec> <task-id>`
   - Check for claimed tasks before starting work

---

## Context Export Workflow

### Purpose
Export spec context for sharing with AI assistants or team members.

### Time Estimate
- Single spec export: 15-30 seconds
- With steering rules: 30-45 seconds

### Prerequisites
- Active spec with requirements, design, and tasks
- Optional: Steering rules configured

### Step-by-Step Instructions

#### 1. Identify Spec to Export
```bash
kse status
```

Note the spec name you want to export.

**Time:** ~5 seconds

---

#### 2. Export Context
```bash
kse context export <spec-name>
```

**Options:**
- `--include-steering`: Include steering rules
- `--steering-files <files>`: Specific steering files (comma-separated)
- `--output <path>`: Custom output path

**Example:**
```bash
kse context export my-feature --include-steering --steering-files CORE_PRINCIPLES.md,ENVIRONMENT.md
```

**Time:** ~10-20 seconds

---

#### 3. Locate Export File
The export is saved to:
```
.kiro/specs/<spec-name>/context-export.md
```

**Time:** ~5 seconds

---

#### 4. Use Exported Context
- Copy content to AI assistant
- Share with team members
- Use as documentation reference
- Include in project handoff

**Time:** Varies by use case

---

### Best Practices

1. **When to Export**
   - Before starting a new task
   - When asking for AI assistance
   - For project documentation
   - During team handoffs

2. **What to Include**
   - Always: requirements, design, tasks
   - Usually: core steering rules
   - Sometimes: environment-specific rules
   - Rarely: all steering rules (too verbose)

3. **Export Management**
   - Exports are regenerated each time
   - Old exports are overwritten
   - Consider versioning important exports
   - Clean up old exports periodically

---

## Prompt Generation Workflow

### Purpose
Generate AI prompts for specific tasks with relevant context.

### Time Estimate
- Single task prompt: 20-30 seconds
- Batch generation: 1-2 minutes per 10 tasks

### Prerequisites
- Active spec with tasks
- Task IDs identified
- Requirements and design documents complete

### Step-by-Step Instructions

#### 1. Identify Task
Review tasks.md and note the task ID:
```bash
cat .kiro/specs/<spec-name>/tasks.md
```

**Example task ID:** `1.2` or `3.1.1`

**Time:** ~10-15 seconds

---

#### 2. Generate Prompt
```bash
kse prompt generate <spec-name> <task-id>
```

**Options:**
- `--target <tool>`: Target tool (kiro, vscode, cursor, other)
- `--output <path>`: Custom output path

**Example:**
```bash
kse prompt generate my-feature 1.2 --target vscode
```

**Time:** ~10-15 seconds

---

#### 3. Locate Generated Prompt
The prompt is saved to:
```
.kiro/specs/<spec-name>/prompts/task-<task-id>.md
```

**Time:** ~5 seconds

---

#### 4. Use Generated Prompt
- Copy to AI assistant
- Review for accuracy
- Customize if needed
- Execute task based on prompt

**Time:** Varies by task complexity

---

### Batch Operations

For multiple tasks:

```bash
# Generate prompts for all incomplete tasks
for task in 1.1 1.2 1.3; do
  kse prompt generate my-feature $task
done
```

**Time:** ~20-30 seconds per task

---

### Best Practices

1. **Prompt Quality**
   - Review generated prompts before use
   - Customize for specific context
   - Add tool-specific instructions
   - Include relevant examples

2. **Prompt Organization**
   - Keep prompts in spec directory
   - Use consistent naming
   - Version control prompts
   - Clean up after task completion

3. **Optimization Tips**
   - Generate prompts in batches
   - Reuse prompts for similar tasks
   - Template common patterns
   - Document customizations

---

## Workflow Checklists

### Daily Workflow Checklist

**Morning (Start of Work)**
- [ ] Sync workspace: `kse workspace sync`
- [ ] Check status: `kse status`
- [ ] Review task list
- [ ] Claim tasks you'll work on
- [ ] Export context for active tasks

**During Work**
- [ ] Update task status as you progress
- [ ] Sync every 30-60 minutes
- [ ] Export context when asking for help
- [ ] Generate prompts for new tasks

**End of Day**
- [ ] Mark completed tasks
- [ ] Update in-progress tasks
- [ ] Final sync: `kse workspace sync`
- [ ] Commit changes to version control

---

### Task Completion Checklist

- [ ] Review task requirements
- [ ] Generate task prompt
- [ ] Export context if needed
- [ ] Complete implementation
- [ ] Run tests
- [ ] Update task status to completed
- [ ] Sync workspace
- [ ] Commit changes

---

### Spec Creation Checklist

- [ ] Create spec: `kse spec bootstrap --name <name> --non-interactive`
- [ ] Write requirements.md
- [ ] Write design.md
- [ ] Generate tasks.md
- [ ] Export initial context
- [ ] Generate prompts for first tasks
- [ ] Sync workspace
- [ ] Begin implementation

---

## Time Estimates Summary

| Workflow | Time Estimate |
|----------|---------------|
| Task Sync | 30-60 seconds |
| Context Export | 15-45 seconds |
| Prompt Generation | 20-30 seconds |
| Daily Sync Routine | 2-3 minutes |
| Full Spec Setup | 10-15 minutes |

---

## Troubleshooting

### Common Issues

**Issue: Sync conflicts**
- **Solution:** Review both versions, keep most recent
- **Prevention:** Sync more frequently

**Issue: Export fails**
- **Solution:** Check spec exists, files are readable
- **Prevention:** Verify spec structure before export

**Issue: Prompt generation incomplete**
- **Solution:** Ensure requirements and design are complete
- **Prevention:** Complete docs before generating prompts

---

## Next Steps

1. **Set Up Automation:** Consider using watch mode for automatic workflows
   ```bash
   kse watch init
   kse watch install auto-sync
   ```

2. **Learn More:**
   - [Watch Mode Guide](./watch-mode-guide.md)
   - [Cross-Tool Guide](./cross-tool-guide.md)
   - [Architecture](./architecture.md)

3. **Get Help:**
   - Run `kse --help` for command reference
   - Check [GitHub Issues](https://github.com/heguangyong/scene-capability-engine/issues)
   - Review [Contributing Guide](../CONTRIBUTING.md)

---

**Version:** 1.0  
**Last Updated:** 2026-01-23  
**Spec:** 05-00-agent-hooks-and-automation

