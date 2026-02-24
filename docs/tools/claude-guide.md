# Using sce with Claude Code

> Complete guide to integrating sce with Claude Code for AI-assisted development

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: Claude Code (Anthropic)  
**Integration Mode**: Manual Export  
**Estimated Setup Time**: 3 minutes

---

## Overview

**Claude Code** is Anthropic's AI coding assistant with a large context window (200K tokens), excellent code understanding, and conversational development capabilities.

**sce integration with Claude** uses the **Manual Export** mode, where you export Spec context and paste it into Claude conversations.

### Why Use sce with Claude?

- ✅ **Large context window** - Can handle entire Specs at once
- ✅ **Excellent understanding** - Claude deeply understands requirements and design
- ✅ **Conversational workflow** - Natural back-and-forth development
- ✅ **Multi-turn implementation** - Complete features across multiple messages

---

## Integration Mode

**Mode:** Manual Export

**How it works:**
1. Create Specs in sce (requirements, design, tasks)
2. Export context: `sce context export spec-name`
3. Copy entire context and paste into Claude conversation
4. Claude implements features based on your Spec
5. Update task status manually in tasks.md

---

## Setup

### Prerequisites

- **Claude Code access** ([Get access](https://claude.ai/))
- **sce installed** globally (`npm install -g scene-capability-engine`)
- **Project adopted** by sce (`sce adopt`)

### Recommended Claude Launch Mode

When pairing Claude with sce-managed autonomous work, use the full-permission launch mode:

```bash
claude --dangerously-skip-permission
```

This keeps Claude runtime behavior aligned with sce orchestrator sub-agent defaults (`danger-full-access` + no approval prompts).

### Step 1: Create Shell Alias (Recommended)

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Quick export and copy to clipboard
alias sce-clip='sce context export $1 && cat .sce/specs/$1/context-export.md | pbcopy && echo "✅ Context copied to clipboard"'

# Windows PowerShell (add to $PROFILE)
function sce-clip { sce context export $args[0]; Get-Content ".sce\specs\$($args[0])\context-export.md" | Set-Clipboard; Write-Host "✅ Context copied to clipboard" }
```

---

## Workflow

### Method 1: Full Spec Context (Recommended) ⭐

**Best for:** Implementing complete features with multiple tasks

**Step 1: Export and copy context**
```bash
sce context export 01-00-user-login
sce-clip 01-00-user-login  # Or manually copy
```

**Step 2: Start new Claude conversation**
Open Claude Code and start a fresh conversation for each feature.

**Step 3: Provide context**
```
I'm working on a user login feature. Here's the complete Spec:

[Paste entire context from context-export.md]

Please help me implement this feature following the design document exactly.
```

**Step 4: Implement tasks iteratively**
```
You: "Let's start with task 1.1: Set up project dependencies"

Claude: [Provides installation commands and setup instructions]

You: "Great! Now task 1.2: Create User model and database schema"

Claude: [Generates User model code and migration]

You: "Perfect! Now task 2.1: Implement ValidationService"

Claude: [Generates ValidationService with all methods]
```

**Step 5: Update tasks as you complete them**
Edit `.sce/specs/01-00-user-login/tasks.md`:
```markdown
- [x] 1.1 Set up project dependencies
- [x] 1.2 Create User model and database schema
- [x] 2.1 Implement ValidationService
- [ ] 2.2 Implement AuthService
```

### Method 2: Task-Specific Context

**Best for:** Large Specs or focused implementation

**Step 1: Generate task-specific prompt**
```bash
sce prompt generate 01-00-user-login 2.1 --tool=claude-code
```

**Step 2: Copy and paste into Claude**
```
[Paste task-specific prompt]

Please implement this task following the design document.
```

---

## Example Workflow

### Complete Feature Implementation

**Scenario:** Implement user login feature from scratch

**1. Create and prepare Spec**
```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
# Edit requirements.md, design.md, tasks.md
sce-clip 01-00-user-login
```

**2. Start Claude conversation**
```
I'm implementing a user login feature. Here's the complete Spec:

[Paste context]

This Spec includes:
- Requirements: What we're building and why
- Design: Architecture, APIs, components
- Tasks: Step-by-step implementation plan

Please help me implement this following the design exactly.
```

**3. Claude's response**
```
I'll help you implement the user login feature according to your Spec. 
I can see you have a well-structured design with:
- AuthController for handling requests
- AuthService for business logic
- ValidationService for input validation
- UserRepository for database access

Let's start with task 1.1: Setting up project dependencies.

[Provides npm install commands]

Would you like me to proceed with the next task?
```

**4. Continue implementation**
```
You: "Yes, let's do task 1.2: Create User model and database schema"

Claude: [Generates User model code]

You: "Excellent! Can you also generate the database migration?"

Claude: [Generates migration file]

You: "Perfect! Now task 2.1: Implement ValidationService"

Claude: [Generates ValidationService with all methods and tests]
```

**5. Handle edge cases**
```
You: "The design mentions rate limiting. Can you add that to the AuthController?"

Claude: [Adds rate limiting middleware based on design specs]

You: "What about error handling for database connection failures?"

Claude: [Adds comprehensive error handling]
```

**6. Review and refine**
```
You: "Can you review the AuthService implementation against the design document?"

Claude: [Reviews code, suggests improvements]

You: "Add JSDoc comments to all public methods"

Claude: [Adds documentation]
```

---

## Tips & Best Practices

### 1. Use Fresh Conversations for Each Feature

**Why:** Claude maintains context throughout a conversation. Starting fresh ensures clean context.

**Do:**
```
Conversation 1: User Login Feature
Conversation 2: Password Reset Feature
Conversation 3: User Profile Feature
```

**Don't:**
```
Single conversation: All features mixed together
```

### 2. Provide Complete Context Upfront

**Good:**
```
Here's the complete Spec for user login:

[Paste entire context-export.md]

Let's implement task 1.1 first.
```

**Not as good:**
```
I need to implement user login.
[No context provided]
```

### 3. Reference the Design Document

**When asking for implementation:**
```
According to the design document, the AuthService should have three methods:
1. hashPassword()
2. authenticate()
3. generateToken()

Please implement these following the specifications exactly.
```

### 4. Implement Incrementally

**Good workflow:**
```
Task 1.1 → Review → Task 1.2 → Review → Task 2.1 → Review
```

**Avoid:**
```
"Implement everything at once"
```

### 5. Ask Claude to Explain Design Decisions

```
You: "Why does the design specify bcrypt with 10 salt rounds?"

Claude: [Explains security considerations]

You: "What are the trade-offs of using JWT vs sessions?"

Claude: [Discusses pros and cons]
```

### 6. Use Claude for Code Review

```
You: "Review this AuthController implementation against the design document. Are there any issues?"

Claude: [Provides detailed review with suggestions]
```

### 7. Leverage Claude's Large Context Window

**Advantage:** Can handle entire Specs (requirements + design + tasks) in one conversation

```
You can paste:
- Full requirements.md (5KB)
- Full design.md (10KB)
- Full tasks.md (3KB)
- Additional context (steering rules, coding standards)

Total: ~20KB - well within Claude's 200K token limit
```

---

## Common Pitfalls

### ❌ Pitfall 1: Not Providing Enough Context

**Problem:**
```
You: "Implement user login"
Claude: [Makes assumptions, may not match your design]
```

**Solution:**
```
You: [Paste complete Spec context]
"Implement user login following this design exactly"
```

### ❌ Pitfall 2: Mixing Multiple Features in One Conversation

**Problem:** Context gets confused, Claude mixes up different features

**Solution:** Use separate conversations for each feature/Spec

### ❌ Pitfall 3: Not Updating Tasks

**Problem:** Lose track of progress

**Solution:** Update tasks.md after each completed task

### ❌ Pitfall 4: Accepting Code Without Review

**Problem:** AI-generated code may have issues

**Solution:** Always review code before using it

---

## Advanced Techniques

### 1. Multi-Turn Feature Development

**Use Claude's conversation memory:**
```
Turn 1: "Implement AuthController"
Turn 2: "Add error handling to AuthController"
Turn 3: "Add rate limiting to AuthController"
Turn 4: "Write tests for AuthController"
Turn 5: "Refactor AuthController for better testability"
```

Claude remembers previous turns and builds on them.

### 2. Design Validation

**Before implementation:**
```
You: "Review this design document. Are there any issues or improvements you'd suggest?"

Claude: [Provides architectural feedback]

You: "Good points. Let's update the design to address those concerns."
```

### 3. Test-Driven Development

```
You: "Based on the design, generate comprehensive unit tests for AuthService first"

Claude: [Generates tests]

You: "Now implement AuthService to make these tests pass"

Claude: [Implements code]
```

### 4. Incremental Refactoring

```
You: "The AuthController is getting large. Suggest refactoring options"

Claude: [Suggests splitting into smaller components]

You: "Let's extract validation logic into a separate middleware"

Claude: [Refactors code]
```

### 5. Documentation Generation

```
You: "Generate API documentation for all endpoints in AuthController"

Claude: [Creates OpenAPI/Swagger docs]

You: "Add JSDoc comments to all methods"

Claude: [Adds documentation]
```

---

## Example Prompts

### Starting Implementation
```
I'm implementing a user login feature. Here's the complete Spec:

[Paste context-export.md]

Key points:
- Follow the design document exactly
- Use the specified technology stack (Node.js, Express, bcrypt, JWT)
- Implement error handling as specified
- Include all security measures (rate limiting, password hashing)

Let's start with task 1.1: "Set up project dependencies"
```

### Implementing a Component
```
Based on the design document, implement the AuthService with these methods:

1. hashPassword(password: string): Promise<string>
   - Use bcrypt with 10 salt rounds
   - Handle errors appropriately

2. authenticate(email: string, password: string): Promise<User | null>
   - Find user by email
   - Compare password hash
   - Return user if valid, null otherwise

3. generateToken(user: User): string
   - Create JWT token
   - Include user id and email in payload
   - Set expiration to 24 hours

Include comprehensive error handling and JSDoc comments.
```

### Debugging
```
I'm getting this error when testing the login endpoint:

[Paste error message]

Here's the current implementation:

[Paste code]

According to the design document, it should:
- Validate inputs
- Call AuthService.authenticate()
- Return token on success
- Return error on failure

What's wrong and how do I fix it?
```

### Code Review
```
Please review this implementation against the design document:

[Paste code]

Check for:
1. Does it follow the design architecture?
2. Are all requirements implemented?
3. Is error handling complete?
4. Are there any security issues?
5. Is the code maintainable?
6. Are there any edge cases we missed?
```

---

## Troubleshooting

### Issue: Claude doesn't follow the design

**Solution 1:** Be more explicit
```
"Strictly follow the design document. Do not deviate from:
- The specified API endpoints
- The component structure
- The error handling approach
- The technology choices"
```

**Solution 2:** Quote the design
```
"According to the design document, section 'API Design':

POST /api/auth/login
Request: { email: string, password: string }
Response: { token: string } or { error: string }

Please implement exactly as specified."
```

### Issue: Context too large

**Solution:** Use task-specific prompts
```bash
sce prompt generate 01-00-user-login 2.1 --tool=claude-code --max-length=10000
```

### Issue: Lost context in long conversation

**Solution:** Re-paste context
```
"Let me re-provide the Spec context to ensure we're aligned:

[Paste context again]

Now let's continue with task 3.1..."
```

### Issue: Claude suggests different approach than design

**Solution:** Acknowledge but redirect
```
"I appreciate the suggestion, but for this project we need to follow the design document exactly. Let's implement it as specified, and we can consider improvements later."
```

---

## Integration with Development Workflow

### With Git
```bash
# Commit Spec
git add .sce/specs/01-00-user-login/
git commit -m "Add user login Spec"

# Implement with Claude
# [Use Claude to generate code]

# Commit implementation
git add src/
git commit -m "Implement user login (tasks 1.1-2.3)"
```

### With Testing
```bash
# After Claude generates code
npm test

# If tests fail, ask Claude
"Tests are failing with this error: [paste error]
Please fix the implementation."
```

### With Code Review
```
# Share context with reviewer
sce context export 01-00-user-login

# Reviewer can see:
# - What was supposed to be built (requirements)
# - How it was supposed to be built (design)
# - What was implemented (tasks)
```

---

## Comparison with Other Tools

### Claude vs Cursor

**Claude advantages:**
- ✅ Larger context window
- ✅ Better at understanding complex requirements
- ✅ More conversational, easier to iterate

**Cursor advantages:**
- ✅ IDE integration
- ✅ Can directly modify files
- ✅ Sees your entire codebase

**Use Claude when:**
- Planning and designing
- Implementing complex logic
- Need detailed explanations
- Working on multiple files

**Use Cursor when:**
- Need direct file editing
- Want IDE integration
- Prefer visual code changes

### Claude vs ChatGPT

**Claude advantages:**
- ✅ Larger context window (200K vs 128K)
- ✅ Better code understanding
- ✅ More accurate implementations

**ChatGPT advantages:**
- ✅ Faster responses
- ✅ More widely available

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with sce
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs
- **[Command Reference](../command-reference.md)** - All sce commands

---

## Summary

**Claude + sce workflow:**
1. Create Spec in sce (requirements, design, tasks)
2. Export context: `sce context export spec-name`
3. Start fresh Claude conversation
4. Paste complete context
5. Implement tasks iteratively
6. Update tasks.md as you complete tasks

**Key advantages:**
- ✅ Large context window handles entire Specs
- ✅ Excellent code understanding and generation
- ✅ Natural conversational development
- ✅ Great for complex features

**Best practices:**
- Use fresh conversations per feature
- Provide complete context upfront
- Implement incrementally
- Reference design document explicitly
- Review all generated code

**Start using sce with Claude:** 🚀
```bash
sce adopt
sce spec bootstrap --name 01-00-my-feature --non-interactive
sce-clip 01-00-my-feature
# Open Claude and paste context
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

