# Cross-Tool Usage Guide

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

## Overview

Kiro Spec Engine (kse) is designed to work seamlessly across multiple AI coding assistants. This guide explains how to use kse specs with different tools, including Kiro IDE, Claude Code, Cursor, GitHub Copilot, and other AI assistants.

## Table of Contents

- [Quick Start](#quick-start)
- [Kiro IDE (Native)](#kiro-ide-native)
- [Claude Code](#claude-code)
- [Cursor](#cursor)
- [GitHub Copilot](#github-copilot)
- [Generic AI Tools](#generic-ai-tools)
- [Feature Comparison](#feature-comparison)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Export Context for Any Tool

```bash
# Export complete spec context
kse context export <spec-name>

# Export with steering rules
kse context export <spec-name> --steering --steering-files=CORE_PRINCIPLES.md

# Generate task-specific prompt
kse prompt generate <spec-name> <task-id>
kse prompt generate <spec-name> <task-id> --tool=claude-code
```

### Basic Workflow

1. **Export context** from kse
2. **Load context** into your AI tool
3. **Work on tasks** with AI assistance
4. **Update task status** in original `tasks.md`

---

## Kiro IDE (Native)

### Setup

Kiro IDE has native kse integration with automatic steering rule loading.

**Installation**:
```bash
npm install -g kiro-spec-engine
kse adopt
```

**Features**:
- ✅ Automatic steering rule loading
- ✅ Full CLI command support
- ✅ Real-time task status updates
- ✅ Multi-user workspace support
- ✅ Agent hooks integration (if available)

### Workflow

1. **Create or adopt project**:
   ```bash
   kse init "My Project"
   # or
   kse adopt
   ```

2. **Create spec**:
   ```bash
   kse spec bootstrap --name 01-00-user-authentication --non-interactive
   ```

3. **Work with AI**:
   - Steering rules are loaded automatically
   - Use `#File` to reference spec files
   - Use `#Folder` to reference directories

4. **Track progress**:
   ```bash
   kse status
   ```

### Best Practices

- Keep steering rules in `.kiro/steering/` for automatic loading
- Use `CURRENT_CONTEXT.md` to maintain session context
- Leverage agent hooks for automated workflows
- Use multi-user workspaces for team collaboration

---

## Claude Code

### Setup

Claude Code requires manual context loading via exported files.

**Prerequisites**:
- kse installed: `npm install -g kiro-spec-engine`
- Project adopted: `kse adopt`

### Workflow

1. **Export context**:
   ```bash
   kse context export 01-00-user-authentication
   ```

2. **Copy exported file**:
   ```bash
   # Location: .kiro/specs/01-00-user-authentication/context-export.md
   cat .kiro/specs/01-00-user-authentication/context-export.md
   ```

3. **Load into Claude Code**:
   - Copy the entire `context-export.md` content
   - Paste into Claude Code chat
   - Claude will understand the spec structure

4. **Generate task prompt** (optional):
   ```bash
   kse prompt generate 01-00-user-authentication 1.1 --tool=claude-code
   ```

5. **Work on task**:
   - Reference specific sections: "According to the Requirements..."
   - Ask for implementation: "Implement task 1.1 following the Design"
   - Request tests: "Write tests for this implementation"

6. **Update task status**:
   ```bash
   # Manually update tasks.md
   - [x] 1.1 Implement authentication module
   ```

### Tips

- **Context size**: Claude has a large context window, so full exports work well
- **Incremental work**: Load context once, work on multiple tasks
- **Code generation**: Ask Claude to generate complete implementations
- **Testing**: Request unit tests and integration tests
- **Documentation**: Ask for inline comments and README updates

### Example Session

```
You: [Paste context-export.md content]

You: I want to implement task 1.1 "Implement authentication module". 
     Please follow the design and create the AuthModule class.

Claude: [Generates implementation based on design]

You: Now write unit tests for this module.

Claude: [Generates tests]

You: Update the task status to completed.

[Manually update tasks.md: - [x] 1.1 ...]
```

---

## Cursor

### Setup

Cursor works similarly to Claude Code but with IDE integration.

**Prerequisites**:
- Cursor IDE installed
- kse installed: `npm install -g kiro-spec-engine`

### Workflow

1. **Export context**:
   ```bash
   kse context export 01-00-user-authentication
   ```

2. **Generate task prompt**:
   ```bash
   kse prompt generate 01-00-user-authentication 1.1 --tool=cursor
   ```

3. **Load into Cursor**:
   - Open Cursor Composer (Cmd+K or Ctrl+K)
   - Paste the prompt content
   - Cursor will understand the context

4. **Work with Cursor**:
   - Use Composer for large changes
   - Use inline suggestions for small edits
   - Reference spec files directly in prompts

5. **Apply changes**:
   - Review Cursor's suggestions
   - Accept or modify changes
   - Run tests to verify

6. **Update task status**:
   ```bash
   # Update tasks.md manually
   ```

### Tips

- **Composer mode**: Best for implementing complete tasks
- **Inline mode**: Good for small fixes and refinements
- **File references**: Cursor can read project files directly
- **Multi-file edits**: Cursor can modify multiple files at once
- **Git integration**: Review changes before committing

### Example Workflow

```bash
# 1. Generate prompt
kse prompt generate 01-00-user-auth 1.1 --tool=cursor

# 2. Open Cursor Composer (Cmd+K)
# 3. Paste prompt content
# 4. Cursor generates implementation
# 5. Review and accept changes
# 6. Run tests
npm test

# 7. Update task status
# Edit tasks.md: - [x] 1.1 ...
```

---

## GitHub Copilot

### Setup

GitHub Copilot works best with inline comments and code context.

**Prerequisites**:
- GitHub Copilot subscription
- kse installed: `npm install -g kiro-spec-engine`

### Workflow

1. **Export context**:
   ```bash
   kse context export 01-00-user-authentication
   ```

2. **Generate task prompt**:
   ```bash
   kse prompt generate 01-00-user-authentication 1.1 --tool=codex
   ```

3. **Use in code**:
   ```javascript
   /**
    * Task 1.1: Implement authentication module
    * 
    * Requirements:
    * - User login with username/password
    * - Session management
    * - Token generation
    * 
    * Design:
    * - AuthModule class with login() method
    * - JWT token generation
    * - Session storage
    */
   
   class AuthModule {
     // Copilot will suggest implementation
   }
   ```

4. **Let Copilot suggest**:
   - Type function signatures
   - Copilot suggests implementations
   - Accept or modify suggestions

5. **Update task status**:
   ```bash
   # Update tasks.md manually
   ```

### Tips

- **Detailed comments**: More context = better suggestions
- **Function signatures**: Define interfaces first
- **Test-driven**: Write test cases, let Copilot implement
- **Incremental**: Build step-by-step, not all at once
- **Review carefully**: Copilot suggestions need validation

### Example

```javascript
// From prompt: Task 1.1 - Implement AuthModule
// Requirements: User login, session management
// Design: AuthModule class with login() method

class AuthModule {
  constructor(config) {
    // Copilot suggests: this.config = config; this.sessions = new Map();
  }

  async login(username, password) {
    // Copilot suggests complete implementation
  }
}
```

---

## Generic AI Tools

### Setup

Any AI tool that accepts Markdown context can work with kse.

### Workflow

1. **Export context**:
   ```bash
   kse context export <spec-name>
   ```

2. **Load into tool**:
   - Copy `context-export.md` content
   - Paste into AI tool's input
   - Tool will understand the structure

3. **Work on tasks**:
   - Reference requirements and design
   - Ask for implementations
   - Request tests and documentation

4. **Update manually**:
   - Update `tasks.md` after completion
   - Commit changes to git

### Tips

- **Clear prompts**: Be specific about what you want
- **Iterative**: Work on one task at a time
- **Validation**: Always test generated code
- **Documentation**: Keep task status updated

---

## Feature Comparison

| Feature | Kiro IDE | Claude Code | Cursor | Copilot | Generic |
|---------|----------|-------------|--------|---------|---------|
| **Steering Auto-Load** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Context Export** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Prompt Generation** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Task Claiming** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Workspace Sync** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Multi-User** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Real-time Updates** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Agent Hooks** | ✅* | ❌ | ❌ | ❌ | ❌ |
| **File References** | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| **Multi-file Edits** | ✅ | ⚠️ | ✅ | ❌ | ⚠️ |
| **Code Generation** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Test Generation** | ✅ | ✅ | ✅ | ⚠️ | ✅ |

**Legend**:
- ✅ Full support
- ⚠️ Partial support / Manual steps required
- ❌ Not supported
- \* If available in Kiro IDE

---

## Limitations and Trade-offs

### Kiro IDE
**Pros**:
- Native integration, no manual steps
- Full feature support
- Real-time collaboration

**Cons**:
- Requires Kiro IDE
- Learning curve for IDE features

### Claude Code
**Pros**:
- Large context window
- Excellent code generation
- Natural language understanding

**Cons**:
- Manual context loading
- No real-time task updates
- No multi-user features

### Cursor
**Pros**:
- IDE integration
- Multi-file editing
- Git integration

**Cons**:
- Manual context loading
- Smaller context window than Claude
- No multi-user features

### GitHub Copilot
**Pros**:
- Inline suggestions
- Fast iteration
- Works in any IDE

**Cons**:
- Limited context understanding
- Requires detailed comments
- No task management

### Generic AI Tools
**Pros**:
- Works with any tool
- Flexible workflow
- No vendor lock-in

**Cons**:
- All manual steps
- No automation
- No collaboration features

---

## Troubleshooting

### Context Too Large

**Problem**: Exported context exceeds tool's limit

**Solutions**:
```bash
# Export without steering
kse context export <spec> --no-steering

# Generate task-specific prompt (smaller)
kse prompt generate <spec> <task-id>

# Export specific sections only
kse context export <spec> --no-design
```

### Task Status Not Syncing

**Problem**: Changes in AI tool don't update kse

**Solution**: Manual update required for non-Kiro tools
```bash
# Edit tasks.md manually
vim .kiro/specs/<spec-name>/tasks.md

# Or use kse commands
kse task claim <spec> <task-id>
kse task unclaim <spec> <task-id>
```

### Steering Rules Not Applied

**Problem**: AI doesn't follow project conventions

**Solution**: Include steering in export
```bash
kse context export <spec> --steering --steering-files=CORE_PRINCIPLES.md,ENVIRONMENT.md
```

### Generated Code Doesn't Match Design

**Problem**: AI generates code that doesn't follow design

**Solution**:
1. Be more specific in prompts
2. Reference design sections explicitly
3. Provide code examples
4. Iterate with AI to refine

### Multi-User Conflicts

**Problem**: Multiple developers working on same task

**Solution**: Use kse task claiming (Kiro IDE only)
```bash
kse task claim <spec> <task-id>
# Work on task
kse task unclaim <spec> <task-id>
```

For other tools: Manual coordination required

---

## Best Practices

### General

1. **Export context before starting**: Always have latest spec
2. **One task at a time**: Focus on single task for clarity
3. **Test thoroughly**: AI-generated code needs validation
4. **Update status promptly**: Keep tasks.md current
5. **Commit frequently**: Small, focused commits

### For Non-Kiro Tools

1. **Manual task tracking**: Update tasks.md after each task
2. **Context refresh**: Re-export if spec changes
3. **Team coordination**: Communicate task assignments
4. **Code review**: Always review AI-generated code
5. **Documentation**: Keep README and comments updated

### For Kiro IDE

1. **Use steering rules**: Leverage automatic loading
2. **Multi-user workspaces**: Enable for team projects
3. **Task claiming**: Claim tasks before starting
4. **Workspace sync**: Sync regularly with team
5. **Agent hooks**: Automate repetitive tasks

---

## Additional Resources

- [kse Documentation](../README.md)
- [Spec Workflow Guide](../.kiro/specs/SPEC_WORKFLOW_GUIDE.md)
- [Steering Strategy Guide](./steering-strategy-guide.md)
- [Phase 1 Summary](../.kiro/specs/03-00-multi-user-and-cross-tool-support/docs/phase-1-summary.md)
- [Phase 2 Summary](../.kiro/specs/03-00-multi-user-and-cross-tool-support/docs/phase-2-summary.md)

---

**Questions or Issues?**

- Check [Troubleshooting](#troubleshooting) section
- Review [Feature Comparison](#feature-comparison)
- Consult tool-specific documentation
- Open an issue on GitHub

**Version History**:
- v1.0 (2026-01-23): Initial cross-tool guide

