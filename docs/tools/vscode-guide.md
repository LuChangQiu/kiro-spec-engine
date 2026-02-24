# Using sce with VS Code + Copilot

> Integration guide for sce with Visual Studio Code and GitHub Copilot

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11  
**Tool**: VS Code + GitHub Copilot  
**Integration Mode**: Manual Export + Inline Context  
**Estimated Setup Time**: 5 minutes

---

## Overview

**VS Code + Copilot** provides AI-powered code completion and suggestions as you type.

**sce integration** uses a hybrid approach:
- Export context for understanding
- Reference Specs in code comments
- Copilot suggests code based on Spec files

### Why Use sce with VS Code + Copilot?

- ✅ **IDE you already use** - No need to switch tools
- ✅ **Inline suggestions** - AI helps as you type
- ✅ **Spec-aware completions** - Copilot reads your Spec files
- ✅ **Familiar workflow** - Minimal changes to your process

---

## Integration Mode

**Mode:** Manual Export + Inline Context

**How it works:**
1. Create Specs in sce
2. Reference Specs in code comments
3. Copilot reads Spec files and suggests code
4. Optionally export context for Copilot Chat

---

## Setup

### Prerequisites

- **VS Code installed** ([Download](https://code.visualstudio.com/))
- **GitHub Copilot extension** ([Install](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot))
- **sce installed** globally (`npm install -g scene-capability-engine`)
- **Project adopted** by sce (`sce adopt`)

### Step 1: Configure VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "github.copilot.enable": {
    "*": true,
    "markdown": true
  },
  "files.associations": {
    "*.md": "markdown"
  }
}
```

### Step 2: Create Workspace Snippet (Optional)

Create `.vscode/sce.code-snippets`:

```json
{
  "sce Spec Reference": {
    "prefix": "sce-ref",
    "body": [
      "/**",
      " * Spec: .sce/specs/${1:spec-name}/",
      " * Task: ${2:task-id}",
      " * ",
      " * Requirements: ${3:requirement-summary}",
      " * Design: ${4:design-summary}",
      " */"
    ],
    "description": "Reference sce Spec in code"
  }
}
```

---

## Workflow

### Method 1: Inline Spec References (Recommended) ⭐

**Reference Specs in your code comments:**

```javascript
/**
 * AuthController - Handles user authentication
 * 
 * Spec: .sce/specs/01-00-user-login/
 * Task: 2.1 - Implement AuthController
 * 
 * Requirements:
 * - POST /api/auth/login endpoint
 * - Validate email and password
 * - Return JWT token on success
 * - Return error on failure
 * 
 * Design: See .sce/specs/01-00-user-login/design.md#authcontroller
 */
class AuthController {
  // Start typing, Copilot will suggest based on comments and Spec files
  async login(req, res) {
    // Copilot suggests implementation
```

**Copilot reads:**
- Your comments
- Spec files in `.sce/specs/`
- Other project files

**Copilot suggests:**
- Method implementations
- Error handling
- Validation logic
- All based on your Spec

### Method 2: Using Copilot Chat

**Step 1: Export context**
```bash
sce context export 01-00-user-login
```

**Step 2: Open Copilot Chat** (Ctrl+Shift+I or Cmd+Shift+I)

**Step 3: Provide context**
```
I'm implementing user login. Here's the Spec:

[Paste context from context-export.md]

Please help me implement the AuthController.
```

**Step 4: Copilot generates code**

### Method 3: File-Level Context

**Add Spec reference at top of file:**

```javascript
/**
 * @file AuthController.js
 * @spec .sce/specs/01-00-user-login/
 * @task 2.1
 * 
 * Implements user authentication according to Spec.
 * See design document for architecture details.
 */

// Copilot now has context for entire file
```

---

## Example Workflow

### Implementing a Feature

**1. Create Spec**
```bash
sce spec bootstrap --name 01-00-user-login --non-interactive
# Edit requirements.md, design.md, tasks.md
```

**2. Create file with Spec reference**

```javascript
/**
 * AuthService.js
 * 
 * Spec: .sce/specs/01-00-user-login/
 * Task: 2.2 - Implement AuthService
 * 
 * Methods to implement:
 * - hashPassword(password) - Use bcrypt with 10 salt rounds
 * - authenticate(email, password) - Verify credentials
 * - generateToken(user) - Create JWT token (24h expiration)
 * 
 * See design.md for detailed specifications.
 */

class AuthService {
  constructor() {
    // Copilot suggests: this.bcrypt = require('bcrypt');
```

**3. Let Copilot suggest**

As you type, Copilot suggests:
- Constructor initialization
- Method signatures
- Implementation details
- Error handling
- All based on your Spec comments

**4. Accept or modify suggestions**

Press `Tab` to accept, or keep typing to modify.

**5. Update tasks.md**

```markdown
- [x] 2.2 Implement AuthService
```

---

## Tips & Best Practices

### 1. Write Detailed Comments

**Good:**
```javascript
/**
 * Validates user email format
 * 
 * Requirements (FR-3):
 * - Must be valid email format
 * - Must not be empty
 * - Must be lowercase
 * 
 * Returns: { valid: boolean, error?: string }
 */
function validateEmail(email) {
  // Copilot suggests comprehensive validation
```

**Not as good:**
```javascript
// Validate email
function validateEmail(email) {
  // Copilot has less context
```

### 2. Reference Spec Files

```javascript
// See: .sce/specs/01-00-user-login/design.md#api-design
```

Copilot can read the referenced file.

### 3. Use Type Annotations

```typescript
/**
 * Spec: .sce/specs/01-00-user-login/
 * Task: 2.2
 */
interface User {
  id: string;
  email: string;
  passwordHash: string;
  // Copilot suggests remaining fields from Spec
}
```

### 4. Break Down Complex Tasks

```javascript
// Task 2.2.1: Hash password
async hashPassword(password: string): Promise<string> {
  // Copilot suggests bcrypt implementation
}

// Task 2.2.2: Verify password
async verifyPassword(password: string, hash: string): Promise<boolean> {
  // Copilot suggests comparison logic
}
```

### 5. Use Copilot Chat for Complex Logic

For complex implementations, use Copilot Chat with exported context.

---

## Advanced Techniques

### 1. Spec-Driven TDD

```javascript
/**
 * AuthService Tests
 * Spec: .sce/specs/01-00-user-login/
 * 
 * Test cases from acceptance criteria:
 * - AC-1: Valid credentials return user
 * - AC-2: Invalid credentials return null
 * - AC-3: Rate limiting prevents brute force
 */
describe('AuthService', () => {
  // Copilot suggests test cases based on acceptance criteria
```

### 2. Multi-File Context

```javascript
/**
 * Related files:
 * - .sce/specs/01-00-user-login/design.md
 * - src/models/User.js
 * - src/services/ValidationService.js
 */
```

Copilot considers all referenced files.

### 3. Incremental Implementation

```javascript
// TODO: Implement according to Spec task 2.2.1
// See: .sce/specs/01-00-user-login/design.md#authservice

// Copilot suggests implementation when you start typing
```

---

## Comparison with Other Tools

### vs Cursor

**Copilot advantages:**
- ✅ Lighter weight
- ✅ Faster suggestions
- ✅ Better inline completions

**Cursor advantages:**
- ✅ Better at understanding full Specs
- ✅ Can modify multiple files
- ✅ More powerful AI model

### vs Claude

**Copilot advantages:**
- ✅ IDE integration
- ✅ Real-time suggestions
- ✅ No context switching

**Claude advantages:**
- ✅ Larger context window
- ✅ Better at complex logic
- ✅ More conversational

**Best approach:** Use Copilot for coding, Claude for planning

---

## Troubleshooting

### Issue: Copilot doesn't suggest Spec-aware code

**Solution 1:** Add more detailed comments
```javascript
/**
 * Detailed description of what this should do
 * Reference: .sce/specs/01-00-user-login/design.md
 */
```

**Solution 2:** Ensure Spec files are in workspace
- Copilot only reads files in open workspace
- Make sure `.sce/specs/` is included

### Issue: Suggestions don't match design

**Solution:** Be more explicit in comments
```javascript
/**
 * IMPORTANT: Must use bcrypt with exactly 10 salt rounds
 * See design.md section "Security Considerations"
 */
```

### Issue: Copilot suggests outdated patterns

**Solution:** Specify modern patterns in comments
```javascript
/**
 * Use async/await (not callbacks or .then())
 * Use ES6+ syntax
 */
```

---

## Related Documentation

- **[Quick Start Guide](../quick-start.md)** - Get started with sce
- **[Integration Modes](../integration-modes.md)** - Understanding integration modes
- **[Spec Workflow](../spec-workflow.md)** - Creating effective Specs

---

## Summary

**VS Code + Copilot + sce workflow:**
1. Create Spec in sce
2. Reference Spec in code comments
3. Let Copilot suggest implementations
4. Use Copilot Chat for complex logic
5. Update tasks.md manually

**Key advantages:**
- ✅ Use your existing IDE
- ✅ Real-time AI assistance
- ✅ Spec-aware suggestions
- ✅ Minimal workflow changes

**Best practices:**
- Write detailed comments
- Reference Spec files
- Use type annotations
- Break down complex tasks
- Combine with Copilot Chat

**Start using:** 🚀
```bash
sce adopt
sce spec bootstrap --name 01-00-my-feature --non-interactive
# Open VS Code and start coding with Spec references
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

