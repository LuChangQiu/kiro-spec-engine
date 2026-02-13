# Using kse with Cursor

> Complete guide to integrating kse with Cursor IDE for AI-assisted development

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: Cursor IDE  
**Integration Mode**: Manual Export  
**Estimated Setup Time**: 5 minutes

---

## Overview

**Cursor** is an AI-powered IDE built on VS Code that provides intelligent code completion, chat-based coding, and AI pair programming through Composer mode.

**kse integration with Cursor** uses the **Manual Export** mode, where you export Spec context and provide it to Cursor's AI features (Chat, Composer, or inline suggestions).

### Why Use kse with Cursor?

- ✅ **Structured context** - Cursor understands your requirements and design
- ✅ **Better code generation** - AI follows your architecture decisions
- ✅ **Consistent implementation** - All code matches your Spec
- ✅ **Progress tracking** - Know what's done and what's next

---

## Integration Mode

**Mode:** Manual Export

**How it works:**
1. You create Specs in kse (requirements, design, tasks)
2. You export context using `kse context export`
3. You provide context to Cursor (Chat, Composer, or .cursorrules)
4. Cursor generates code based on your Spec
5. You update task status in tasks.md

---

## Setup

### Prerequisites

- **Cursor IDE** installed ([Download](https://cursor.sh/))
- **kse** installed globally (`npm install -g kiro-spec-engine`)
- **Project adopted** by kse (`kse adopt`)

### Step 1: Configure Cursor for kse

Create a `.cursorrules` file in your project root:

```markdown
# Project Rules

This project uses kse (Kiro Spec Engine) for spec-driven development.

## Spec Location
All Specs are in `.kiro/specs/` directory.

## Before Implementing Features
1. Check if a Spec exists in `.kiro/specs/`
2. Read the requirements.md, design.md, and tasks.md
3. Follow the design architecture exactly
4. Update tasks.md when completing tasks

## Spec Structure
- requirements.md - What we're building and why
- design.md - How we're building it (architecture, APIs, components)
- tasks.md - Step-by-step implementation plan

## Example
For user login feature:
- Spec: `.kiro/specs/01-00-user-login/`
- Design: `.kiro/specs/01-00-user-login/design.md`
- Tasks: `.kiro/specs/01-00-user-login/tasks.md`

## Code Standards
[Add your project-specific coding standards here]
```

### Step 2: Create Shell Alias (Optional but Recommended)

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Quick export and copy to clipboard
alias kse-clip='kse context export $1 && cat .kiro/specs/$1/context-export.md | pbcopy && echo "✅ Context copied to clipboard"'

# Generate task-specific prompt
alias kse-task='kse prompt generate $1 $2 --tool=cursor'
```

Reload your shell:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

---

## Workflow

### Method 1: Using Cursor Composer (Recommended) ⭐

**Best for:** Implementing complete features or multiple related tasks

**Step 1: Export context**
```bash
kse context export 01-00-user-login
```

**Step 2: Copy context**
```bash
# macOS
cat .kiro/specs/01-00-user-login/context-export.md | pbcopy

# Windows
type .kiro\specs\01-00-user-login\context-export.md | clip

# Or use alias
kse-clip 01-00-user-login
```

**Step 3: Open Cursor Composer**
- Press `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux)
- Or click the Composer icon in the sidebar

**Step 4: Provide context and instructions**
```
[Paste the entire context from context-export.md]

Please implement task 1.1: "Create AuthController class"

Follow the design document exactly:
- Use the specified API endpoints
- Implement all methods as designed
- Include error handling as specified
```

**Step 5: Review and accept changes**
- Cursor will show proposed file changes
- Review each change carefully
- Accept or modify as needed

**Step 6: Update task status**
Edit `.kiro/specs/01-00-user-login/tasks.md`:
```markdown
- [x] 1.1 Create AuthController class  ← Changed from [ ] to [x]
```

### Method 2: Using Cursor Chat

**Best for:** Quick questions, debugging, or small changes

**Step 1: Generate task-specific prompt**
```bash
kse prompt generate 01-00-user-login 1.1 --tool=cursor
```

**Step 2: Open Cursor Chat**
- Press `Cmd+L` (macOS) or `Ctrl+L` (Windows/Linux)
- Or click the Chat icon in the sidebar

**Step 3: Paste prompt and ask**
```
[Paste the generated prompt]

Can you implement this following the design document?
```

**Step 4: Iterate**
```
You: "Add error handling for invalid email"
Cursor: [Generates error handling code]

You: "Add unit tests for this"
Cursor: [Generates tests]
```

### Method 3: Using Inline Suggestions

**Best for:** Writing code with AI assistance as you type

**Step 1: Add context in comments**
```javascript
// Task 1.1: Create AuthController class
// See: .kiro/specs/01-00-user-login/design.md
//
// Requirements:
// - POST /api/auth/login endpoint
// - Validate email and password
// - Return JWT token on success
// - Return error message on failure

class AuthController {
  // Cursor will suggest implementation based on comments
```

**Step 2: Let Cursor suggest**
- Start typing
- Cursor suggests code based on your comments and Spec files
- Press `Tab` to accept suggestions

---

## Example Workflow

### Complete Feature Implementation

**Scenario:** Implement user login feature

**1. Create and write Spec**
```bash
kse spec bootstrap --name 01-00-user-login --non-interactive
# Edit requirements.md, design.md, tasks.md
```

**2. Export context**
```bash
kse-clip 01-00-user-login
```

**3. Open Cursor Composer (Cmd+K)**
```
[Paste context]

I need to implement the user login feature according to this Spec.

Let's start with task 1.1: "Set up project dependencies"

Please:
1. Install the required packages (express, bcrypt, jsonwebtoken, validator)
2. Create the basic project structure
3. Set up TypeScript configuration if needed
```

**4. Cursor generates:**
```bash
# package.json updates
# tsconfig.json (if TypeScript)
# Basic folder structure
```

**5. Continue with next task**
```
Great! Now let's implement task 1.2: "Create User model and database schema"

Follow the design document:
- User interface with id, email, passwordHash, name, createdAt, lastLoginAt
- Database migration for users table
- Index on email field
```

**6. Iterate through all tasks**
```
Task 2.1: Implement ValidationService
Task 2.2: Implement AuthService
Task 2.3: Implement UserRepository
Task 3.1: Implement AuthController
...
```

**7. Update tasks.md as you go**
```markdown
- [x] 1.1 Set up project dependencies
- [x] 1.2 Create User model and database schema
- [x] 2.1 Implement ValidationService
- [ ] 2.2 Implement AuthService
...
```

---

## Tips & Best Practices

### 1. Use Composer for Complex Tasks

**Good for Composer:**
- Implementing entire components
- Creating multiple related files
- Refactoring across files
- Setting up project structure

**Example:**
```
Implement the entire AuthService according to the design:
- hashPassword() method
- authenticate() method
- generateToken() method
- Include all error handling
- Add JSDoc comments
```

### 2. Use Chat for Clarifications

**Good for Chat:**
- Understanding design decisions
- Debugging issues
- Quick modifications
- Asking "why" questions

**Example:**
```
Why does the design specify bcrypt with 10 salt rounds?
What are the security implications?
```

### 3. Reference Spec Files in Code

**Add comments that reference Specs:**
```javascript
/**
 * AuthController handles user authentication
 * 
 * Spec: .kiro/specs/01-00-user-login/design.md
 * Requirements: FR-1, FR-2, FR-3
 * 
 * @see .kiro/specs/01-00-user-login/design.md#authcontroller
 */
class AuthController {
  // ...
}
```

### 4. Break Large Specs into Tasks

**Instead of:**
```
Implement the entire user login feature
```

**Do:**
```
Implement task 1.1: Create AuthController class
[After completion]
Implement task 1.2: Add input validation
[After completion]
Implement task 1.3: Add authentication logic
```

### 5. Use .cursorrules for Consistency

**Update .cursorrules with project standards:**
```markdown
## Code Style
- Use TypeScript
- Use async/await (not .then())
- All functions must have JSDoc comments
- Use descriptive variable names

## Testing
- Write tests for all public methods
- Use Jest for testing
- Aim for 80%+ code coverage

## Error Handling
- Use try-catch for async operations
- Return structured error objects
- Log errors with context
```

### 6. Keep Context Fresh

**Re-export after Spec changes:**
```bash
# After editing design.md
kse context export 01-00-user-login

# Copy new context
kse-clip 01-00-user-login

# Provide to Cursor again
```

### 7. Use Task-Specific Prompts for Large Specs

**For large Specs (>5KB context):**
```bash
# Instead of exporting entire Spec
kse prompt generate 01-00-user-login 1.1 --tool=cursor

# Generates focused prompt for just task 1.1
```

---

## Common Pitfalls

### ❌ Pitfall 1: Not Providing Enough Context

**Problem:**
```
Cursor: "Implement user login"
```

**Solution:**
```
[Paste full context from context-export.md]

Implement task 1.1: "Create AuthController class"

Follow the design document exactly:
- API endpoint: POST /api/auth/login
- Request format: { email, password }
- Response format: { token } or { error }
- Use the specified error messages
```

### ❌ Pitfall 2: Forgetting to Update Tasks

**Problem:** Tasks.md gets out of sync with actual progress

**Solution:** Update tasks.md immediately after completing each task

### ❌ Pitfall 3: Not Using .cursorrules

**Problem:** Cursor doesn't know about your Specs

**Solution:** Create .cursorrules file with Spec location and structure

### ❌ Pitfall 4: Accepting All Suggestions Blindly

**Problem:** AI-generated code may not be perfect

**Solution:** Always review Cursor's suggestions before accepting

---

## Troubleshooting

### Issue: Cursor doesn't follow the design

**Solution 1:** Be more explicit in your prompt
```
Strictly follow the design document in .kiro/specs/01-00-user-login/design.md

Do not deviate from:
- The specified API endpoints
- The component structure
- The error handling approach
```

**Solution 2:** Include design excerpts in prompt
```
According to the design:

## API Design
POST /api/auth/login
Request: { email: string, password: string }
Response: { token: string } or { error: string }

Please implement exactly as specified.
```

### Issue: Context too large for Cursor

**Solution:** Use task-specific prompts
```bash
kse prompt generate 01-00-user-login 1.1 --tool=cursor --max-length=5000
```

### Issue: Cursor suggests wrong file locations

**Solution:** Specify file paths explicitly
```
Create the AuthController in src/controllers/AuthController.ts

[Rest of prompt]
```

### Issue: Lost context in long conversation

**Solution:** Re-paste context periodically
```
Let me re-provide the Spec context to ensure we're aligned:

[Paste context again]

Now let's continue with task 2.1...
```

---

## Advanced Techniques

### 1. Multi-File Implementation

**Use Composer to create multiple files at once:**
```
Implement the complete authentication system:

Files to create:
1. src/controllers/AuthController.ts
2. src/services/AuthService.ts
3. src/services/ValidationService.ts
4. src/repositories/UserRepository.ts
5. tests/auth.test.ts

Follow the design document for each component.
```

### 2. Iterative Refinement

**Start simple, then enhance:**
```
Step 1: "Implement basic AuthController with login endpoint"
[Review and accept]

Step 2: "Add input validation to the login endpoint"
[Review and accept]

Step 3: "Add error handling and rate limiting"
[Review and accept]
```

### 3. Test-Driven Development

**Generate tests first:**
```
Based on the design document, generate unit tests for AuthService:
- Test hashPassword()
- Test authenticate() with valid credentials
- Test authenticate() with invalid credentials
- Test generateToken()

Use Jest and follow the test structure in the design.
```

Then implement:
```
Now implement AuthService to make these tests pass.
```

### 4. Code Review Mode

**Use Chat to review generated code:**
```
Review the AuthController implementation:
1. Does it follow the design document?
2. Are there any security issues?
3. Is error handling complete?
4. Are there any edge cases we missed?
```

---

## Integration with Other Tools

### With Git

```bash
# Commit Spec changes
git add .kiro/specs/01-00-user-login/
git commit -m "Add user login Spec"

# Commit implementation
git add src/
git commit -m "Implement user login (task 1.1-1.3)"
```

### With Testing

```bash
# After Cursor generates code
npm test

# If tests fail, ask Cursor to fix
# In Cursor Chat:
"The tests are failing with this error: [paste error]
Please fix the implementation."
```

### With Code Review

```bash
# Export context for reviewer
kse context export 01-00-user-login

# Share context-export.md with reviewer
# Reviewer can see requirements and design
```

---

## Example Prompts

### Starting a Feature
```
I've provided the complete Spec for user login feature.

Please implement task 1.1: "Set up project dependencies"

Install these packages:
- express
- bcrypt
- jsonwebtoken
- validator
- express-rate-limit

Also set up TypeScript if not already configured.
```

### Implementing a Component
```
Implement the AuthService according to the design document:

Location: src/services/AuthService.ts

Methods to implement:
1. hashPassword(password: string): Promise<string>
   - Use bcrypt with 10 salt rounds
   
2. authenticate(email: string, password: string): Promise<User | null>
   - Find user by email
   - Compare password hash
   - Return user if valid, null if invalid
   
3. generateToken(user: User): string
   - Create JWT token
   - Include user id and email
   - Expire in 24 hours

Include error handling and JSDoc comments.
```

### Adding Tests
```
Create comprehensive unit tests for AuthService:

Location: tests/services/AuthService.test.ts

Test cases:
1. hashPassword() generates valid bcrypt hash
2. authenticate() returns user with valid credentials
3. authenticate() returns null with invalid credentials
4. authenticate() returns null for non-existent user
5. generateToken() creates valid JWT
6. generateToken() includes correct user data

Use Jest and follow AAA pattern (Arrange, Act, Assert).
```

### Debugging
```
The login endpoint is returning 500 error with this message:
[paste error]

The implementation is in src/controllers/AuthController.ts

According to the design document, it should:
- Validate inputs
- Call AuthService.authenticate()
- Return token on success
- Return error on failure

Please help debug and fix the issue.
```

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with kse
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs
- **[Command Reference](../command-reference.md)** - All kse commands

---

## Summary

**Cursor + kse workflow:**
1. Create Spec in kse (requirements, design, tasks)
2. Export context: `kse context export spec-name`
3. Use Cursor Composer (Cmd+K) or Chat (Cmd+L)
4. Provide context and implement tasks
5. Update tasks.md as you complete tasks

**Key advantages:**
- ✅ Structured, consistent code generation
- ✅ AI follows your architecture
- ✅ Clear progress tracking
- ✅ Better code quality

**Best practices:**
- Use Composer for complex tasks
- Use Chat for quick questions
- Keep .cursorrules updated
- Re-export context after Spec changes
- Review all AI suggestions

**Start using kse with Cursor:** 🚀
```bash
kse adopt
kse spec bootstrap --name 01-00-my-feature --non-interactive
kse context export 01-00-my-feature
# Open Cursor Composer (Cmd+K) and paste context
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

