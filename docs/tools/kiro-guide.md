# Using sce with AI IDE

> Native integration guide for sce with AI IDE

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: AI IDE  
**Integration Mode**: Native Integration  
**Estimated Setup Time**: None (built-in)

---

## Overview

**AI IDE** is the native development environment for sce with built-in Spec-driven development support.

**sce integration with SCE** uses **Native Integration** - no manual export needed, everything is automatic.

### Why Use sce with SCE?

- ✅ **Zero setup** - Works out of the box
- ✅ **Fully automatic** - No manual commands needed
- ✅ **Seamless workflow** - AI reads Specs directly
- ✅ **Auto task tracking** - Tasks update automatically
- ✅ **Best experience** - Purpose-built for sce

---

## Integration Mode

**Mode:** Native Integration (Fully Automatic)

**How it works:**
1. You create Specs in sce
2. SCE AI automatically reads Spec files
3. SCE AI implements features based on Specs
4. SCE AI updates tasks.md automatically
5. No manual export or copy-paste needed

---

## Setup

### Prerequisites

- **AI IDE installed**
- **Project with .sce/ directory**

### No Setup Required!

AI IDE automatically detects and uses sce Specs. Just start working.

---

## Workflow

### Method 1: Natural Language (Recommended) ⭐

**Simply tell SCE what you want:**

```
You: "Implement the user login feature"

SCE AI:
  [Automatically reads] .sce/specs/01-00-user-login/
  [Understands] Requirements, Design, Tasks
  [Implements] Code according to design
  [Updates] tasks.md automatically
  [Shows] "Implemented tasks 1.1-1.3, ready for review"
```

**No commands needed. No context export. Just natural conversation.**

### Method 2: Spec-Specific Instructions

```
You: "Check the Spec for 01-00-user-login and implement task 2.1"

SCE AI:
  [Reads Spec]
  [Implements task 2.1]
  [Updates tasks.md]
  [Done]
```

### Method 3: Design Review

```
You: "Review the design for user login and suggest improvements"

SCE AI:
  [Reads design.md]
  [Analyzes architecture]
  [Provides feedback]
  [Suggests improvements]
```

---

## Example Workflow

### Complete Feature Implementation

**1. Create Spec (using SCE or command line)**
```
You: "Create a new Spec for user login"

SCE AI:
  [Creates] .sce/specs/01-00-user-login/
  [Generates] requirements.md, design.md, tasks.md templates
  [Opens] Files for editing
```

**2. Write or refine Spec**
```
You: "Help me write the requirements for user login"

SCE AI:
  [Suggests] User stories
  [Suggests] Acceptance criteria
  [Suggests] Non-functional requirements
```

**3. Implement**
```
You: "Implement this Spec"

SCE AI:
  [Reads all Spec files]
  [Implements all tasks]
  [Runs tests]
  [Updates tasks.md]
  [Reports] "Feature complete, all tests passing"
```

**4. Review**
```
You: "Show me what you implemented"

SCE AI:
  [Shows] File changes
  [Shows] Completed tasks
  [Shows] Test results
```

---

## Key Features

### 1. Automatic Spec Detection

SCE automatically finds and reads Specs. No need to specify paths.

```
You: "What Specs do we have?"
SCE: "Found 3 Specs: 01-00-user-login, 02-00-password-reset, 03-00-user-profile"
```

### 2. Intelligent Task Management

SCE tracks tasks automatically.

```
You: "What's the status of user login?"
SCE: "5 tasks complete, 3 in progress, 2 not started. Next: Implement rate limiting"
```

### 3. Design-First Development

SCE enforces following the design.

```
You: "Implement AuthController"
SCE: [Reads design.md] [Implements exactly as designed] [No deviations]
```

### 4. Continuous Validation

SCE validates against requirements.

```
SCE: "Implementation complete. Validating against requirements..."
SCE: "✓ All acceptance criteria met"
SCE: "✓ All non-functional requirements satisfied"
```

---

## Tips & Best Practices

### 1. Trust the Automation

Let SCE handle Spec reading and task tracking. Don't manually export context.

### 2. Use Natural Language

```
Good: "Implement user login"
Also good: "Build the login feature"
Also good: "Let's work on authentication"
```

### 3. Leverage Design Review

```
"Review the design before we start implementing"
```

### 4. Iterative Refinement

```
"Implement task 1.1"
[Review]
"Good, now task 1.2"
[Review]
"Perfect, continue with remaining tasks"
```

### 5. Ask for Status Anytime

```
"What's our progress on user login?"
"Which tasks are complete?"
"What should we work on next?"
```

---

## Advantages Over Other Tools

### vs Manual Export (Claude, Cursor)

- ✅ No manual export needed
- ✅ No copy-paste
- ✅ Always up-to-date
- ✅ Automatic task tracking

### vs AI-Executed Commands (Windsurf)

- ✅ No command execution needed
- ✅ Faster (no command overhead)
- ✅ More reliable (no command failures)
- ✅ Better integration

### vs Watch Mode

- ✅ No background process needed
- ✅ No configuration required
- ✅ Instant updates
- ✅ Lower resource usage

---

## Troubleshooting

### Issue: SCE doesn't see my Spec

**Check:**
1. Spec is in `.sce/specs/` directory
2. Spec has requirements.md, design.md, tasks.md
3. Files are not empty

### Issue: SCE doesn't follow design

**This shouldn't happen with SCE.** If it does:
1. Check design.md is complete and clear
2. Report as a bug

### Issue: Tasks not updating

**This shouldn't happen with SCE.** If it does:
1. Check tasks.md file permissions
2. Report as a bug

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with sce
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs

---

## Summary

**SCE + sce = Perfect Integration**

**Zero setup, zero manual work:**
1. Create Spec
2. Tell SCE what to build
3. SCE does everything automatically
4. Review and approve

**This is the ideal sce experience.** All other tools require workarounds because they weren't built for sce. SCE was.

**Start using:** 🚀
```
Just open AI IDE and say:
"Create a Spec for user login and implement it"
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
