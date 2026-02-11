# Using kse with Kiro IDE

> Native integration guide for kse with Kiro IDE

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: Kiro IDE  
**Integration Mode**: Native Integration  
**Estimated Setup Time**: None (built-in)

---

## Overview

**Kiro IDE** is the native development environment for kse with built-in Spec-driven development support.

**kse integration with Kiro** uses **Native Integration** - no manual export needed, everything is automatic.

### Why Use kse with Kiro?

- ✅ **Zero setup** - Works out of the box
- ✅ **Fully automatic** - No manual commands needed
- ✅ **Seamless workflow** - AI reads Specs directly
- ✅ **Auto task tracking** - Tasks update automatically
- ✅ **Best experience** - Purpose-built for kse

---

## Integration Mode

**Mode:** Native Integration (Fully Automatic)

**How it works:**
1. You create Specs in kse
2. Kiro AI automatically reads Spec files
3. Kiro AI implements features based on Specs
4. Kiro AI updates tasks.md automatically
5. No manual export or copy-paste needed

---

## Setup

### Prerequisites

- **Kiro IDE installed**
- **Project with .kiro/ directory**

### No Setup Required!

Kiro IDE automatically detects and uses kse Specs. Just start working.

---

## Workflow

### Method 1: Natural Language (Recommended) ⭐

**Simply tell Kiro what you want:**

```
You: "Implement the user login feature"

Kiro AI:
  [Automatically reads] .kiro/specs/01-00-user-login/
  [Understands] Requirements, Design, Tasks
  [Implements] Code according to design
  [Updates] tasks.md automatically
  [Shows] "Implemented tasks 1.1-1.3, ready for review"
```

**No commands needed. No context export. Just natural conversation.**

### Method 2: Spec-Specific Instructions

```
You: "Check the Spec for 01-00-user-login and implement task 2.1"

Kiro AI:
  [Reads Spec]
  [Implements task 2.1]
  [Updates tasks.md]
  [Done]
```

### Method 3: Design Review

```
You: "Review the design for user login and suggest improvements"

Kiro AI:
  [Reads design.md]
  [Analyzes architecture]
  [Provides feedback]
  [Suggests improvements]
```

---

## Example Workflow

### Complete Feature Implementation

**1. Create Spec (using Kiro or command line)**
```
You: "Create a new Spec for user login"

Kiro AI:
  [Creates] .kiro/specs/01-00-user-login/
  [Generates] requirements.md, design.md, tasks.md templates
  [Opens] Files for editing
```

**2. Write or refine Spec**
```
You: "Help me write the requirements for user login"

Kiro AI:
  [Suggests] User stories
  [Suggests] Acceptance criteria
  [Suggests] Non-functional requirements
```

**3. Implement**
```
You: "Implement this Spec"

Kiro AI:
  [Reads all Spec files]
  [Implements all tasks]
  [Runs tests]
  [Updates tasks.md]
  [Reports] "Feature complete, all tests passing"
```

**4. Review**
```
You: "Show me what you implemented"

Kiro AI:
  [Shows] File changes
  [Shows] Completed tasks
  [Shows] Test results
```

---

## Key Features

### 1. Automatic Spec Detection

Kiro automatically finds and reads Specs. No need to specify paths.

```
You: "What Specs do we have?"
Kiro: "Found 3 Specs: 01-00-user-login, 02-00-password-reset, 03-00-user-profile"
```

### 2. Intelligent Task Management

Kiro tracks tasks automatically.

```
You: "What's the status of user login?"
Kiro: "5 tasks complete, 3 in progress, 2 not started. Next: Implement rate limiting"
```

### 3. Design-First Development

Kiro enforces following the design.

```
You: "Implement AuthController"
Kiro: [Reads design.md] [Implements exactly as designed] [No deviations]
```

### 4. Continuous Validation

Kiro validates against requirements.

```
Kiro: "Implementation complete. Validating against requirements..."
Kiro: "✓ All acceptance criteria met"
Kiro: "✓ All non-functional requirements satisfied"
```

---

## Tips & Best Practices

### 1. Trust the Automation

Let Kiro handle Spec reading and task tracking. Don't manually export context.

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

### Issue: Kiro doesn't see my Spec

**Check:**
1. Spec is in `.kiro/specs/` directory
2. Spec has requirements.md, design.md, tasks.md
3. Files are not empty

### Issue: Kiro doesn't follow design

**This shouldn't happen with Kiro.** If it does:
1. Check design.md is complete and clear
2. Report as a bug

### Issue: Tasks not updating

**This shouldn't happen with Kiro.** If it does:
1. Check tasks.md file permissions
2. Report as a bug

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with kse
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs

---

## Summary

**Kiro + kse = Perfect Integration**

**Zero setup, zero manual work:**
1. Create Spec
2. Tell Kiro what to build
3. Kiro does everything automatically
4. Review and approve

**This is the ideal kse experience.** All other tools require workarounds because they weren't built for kse. Kiro was.

**Start using:** 🚀
```
Just open Kiro IDE and say:
"Create a Spec for user login and implement it"
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
