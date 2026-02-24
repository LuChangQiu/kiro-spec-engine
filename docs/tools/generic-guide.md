# Using sce with Any AI Tool

> Universal integration guide for sce with any AI coding assistant

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: Any AI Tool  
**Integration Mode**: Manual Export  
**Estimated Setup Time**: 2 minutes

---

## Overview

This guide shows how to use sce with **any AI coding tool**, including:
- ChatGPT
- Gemini
- Codeium
- Tabnine
- Amazon CodeWhisperer
- Any other AI assistant

**sce works with any tool that can:**
- Accept text input
- Generate code
- Understand context

---

## Universal Integration Pattern

### The Basic Workflow

```
1. Create Spec in sce
   ↓
2. Export context
   ↓
3. Provide context to your AI tool
   ↓
4. AI generates code
   ↓
5. Update tasks manually
```

This pattern works with **every AI tool**.

---

## Setup

### Prerequisites

- **Any AI tool** (web-based, IDE plugin, or CLI)
- **sce installed** (`npm install -g scene-capability-engine`)
- **Project adopted** (`sce adopt`)

### No Tool-Specific Setup Required

sce exports plain text that any AI can understand.

---

## Workflow

### Step 1: Create Your Spec

```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
# Edit requirements.md, design.md, tasks.md
```

### Step 2: Export Context

```bash
sce context export 01-00-user-login
```

This creates `.sce/specs/01-00-user-login/context-export.md`

### Step 3: Copy Context

**macOS:**
```bash
cat .sce/specs/01-00-user-login/context-export.md | pbcopy
```

**Windows:**
```bash
type .sce\specs\01-00-user-login\context-export.md | clip
```

**Linux:**
```bash
cat .sce/specs/01-00-user-login/context-export.md | xclip -selection clipboard
```

**Or manually:**
- Open `context-export.md`
- Select all (Ctrl+A / Cmd+A)
- Copy (Ctrl+C / Cmd+C)

### Step 4: Provide to Your AI Tool

**Web-based tools (ChatGPT, Gemini, etc.):**
1. Open the tool in your browser
2. Start a new conversation
3. Paste the context
4. Add your request

**IDE plugins (Tabnine, Codeium, etc.):**
1. Add context as code comments
2. Let the AI suggest based on comments

**CLI tools:**
1. Pipe context to the tool
2. Or save to a file and reference it

### Step 5: Implement with AI

```
[Paste context]

Please implement task 1.1: "Set up project dependencies"

Follow the design document exactly.
```

### Step 6: Update Tasks

Edit `tasks.md`:
```markdown
- [x] 1.1 Set up project dependencies
```

---

## Tool-Specific Adaptations

### Web-Based AI (ChatGPT, Gemini, Claude Web, etc.)

**Workflow:**
```
1. Export context
2. Open AI tool in browser
3. Paste context
4. Implement tasks one by one
5. Copy generated code to your project
```

**Tips:**
- Start fresh conversation per feature
- Re-paste context if conversation gets long
- Save important responses

### IDE Plugins (Tabnine, Codeium, CodeWhisperer, etc.)

**Workflow:**
```
1. Export context
2. Add context as comments in your code
3. Let AI suggest as you type
4. Accept or modify suggestions
```

**Example:**
```javascript
/**
 * Spec: .sce/specs/01-00-user-login/
 * Task: 2.1 - Implement AuthController
 * 
 * Requirements:
 * - POST /api/auth/login endpoint
 * - Validate email and password
 * - Return JWT token on success
 * 
 * Design: See design.md for details
 */
class AuthController {
  // AI suggests implementation
```

### CLI Tools (Aider, etc.)

**Workflow:**
```bash
# Export context
sce context export 01-00-user-login

# Provide to CLI tool
your-ai-tool --context .sce/specs/01-00-user-login/context-export.md

# Or pipe it
cat .sce/specs/01-00-user-login/context-export.md | your-ai-tool
```

### API-Based Tools

**Workflow:**
```javascript
const fs = require('fs');
const context = fs.readFileSync('.sce/specs/01-00-user-login/context-export.md', 'utf8');

// Call your AI API
const response = await aiAPI.generate({
  prompt: `${context}\n\nImplement task 1.1`,
  model: 'your-model'
});
```

---

## Universal Best Practices

### 1. Always Provide Complete Context

**Good:**
```
[Paste entire context-export.md]

Implement task 1.1 following the design document.
```

**Not as good:**
```
Implement user login
[No context]
```

### 2. Be Explicit About Requirements

```
Follow these requirements exactly:
- Use bcrypt for password hashing
- Use JWT for tokens
- Implement rate limiting
- Follow the API design in the Spec
```

### 3. Implement Incrementally

```
Task 1.1 → Review → Task 1.2 → Review → Task 2.1 → Review
```

Don't try to implement everything at once.

### 4. Reference the Design

```
According to the design document, section "AuthService":
[Quote relevant section]

Please implement this exactly as specified.
```

### 5. Update Tasks Promptly

After each completed task, update `tasks.md` immediately.

---

## Handling Tool Limitations

### Limited Context Window

**Problem:** Your AI tool can't handle large Specs

**Solution:** Use task-specific prompts
```bash
sce prompt generate 01-00-user-login 1.1 --max-length=5000
```

### No File Access

**Problem:** AI can't read your project files

**Solution:** Include relevant code in your prompt
```
Here's the current User model:
[Paste code]

And here's the Spec:
[Paste context]

Please implement AuthService that uses this User model.
```

### No Command Execution

**Problem:** AI can't run sce commands

**Solution:** Run commands yourself and provide output
```bash
sce status
# Copy output

# In AI tool:
"Here's the current project status:
[Paste output]

What should we work on next?"
```

### No Multi-File Editing

**Problem:** AI can only generate one file at a time

**Solution:** Implement file by file
```
"First, generate AuthController.js"
[Save file]

"Now, generate AuthService.js"
[Save file]

"Now, generate the tests"
[Save file]
```

---

## Example Prompts

### Starting a Feature
```
I'm implementing a user login feature. Here's the complete Spec:

[Paste context-export.md]

This includes:
- Requirements: What we're building
- Design: How we're building it
- Tasks: Step-by-step plan

Please help me implement task 1.1: "Set up project dependencies"
```

### Implementing a Component
```
Based on this Spec:

[Paste relevant section]

Please implement the AuthService class with these methods:
1. hashPassword(password)
2. authenticate(email, password)
3. generateToken(user)

Follow the design document exactly.
```

### Debugging
```
I'm getting this error:

[Paste error]

Here's my implementation:

[Paste code]

According to the Spec, it should:

[Paste relevant requirements]

What's wrong and how do I fix it?
```

---

## Creating Your Own Integration

### For Tool Developers

If you're building an AI coding tool, consider:

**1. Native sce Support**
- Read `.sce/specs/` directory
- Parse requirements.md, design.md, tasks.md
- Update tasks.md automatically

**2. Command Execution**
- Allow executing `sce context export`
- Read exported context files
- Execute `sce task claim` and `sce task unclaim`

**3. File Watching**
- Watch for Spec file changes
- Auto-reload context when Specs update

**4. UI Integration**
- Show Spec structure in sidebar
- Highlight current task
- Show progress indicators

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with sce
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs
- **[Tool-Specific Guides](../tools/)** - Guides for specific tools

---

## Summary

**sce works with any AI tool:**

**Universal workflow:**
1. Create Spec
2. Export context
3. Provide to AI
4. Implement
5. Update tasks

**Key principles:**
- ✅ Provide complete context
- ✅ Be explicit about requirements
- ✅ Implement incrementally
- ✅ Reference the design
- ✅ Update tasks promptly

**Adapt to your tool:**
- Web-based: Copy-paste workflow
- IDE plugin: Comment-based context
- CLI: Pipe or file-based
- API: Programmatic integration

**Start using:** 🚀
```bash
sce adopt
sce spec bootstrap --name 01-00-my-feature --non-interactive
sce context export 01-00-my-feature
# Provide context to your AI tool
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

