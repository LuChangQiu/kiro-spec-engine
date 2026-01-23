# Troubleshooting Guide

> Common issues and solutions for kse

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-23  
**Audience**: All Users  
**Estimated Time**: Reference as needed

---

## Quick Navigation

- [Installation Issues](#installation-issues)
- [Adoption Issues](#adoption-issues)
- [Command Issues](#command-issues)
- [Integration Issues](#integration-issues)
- [Watch Mode Issues](#watch-mode-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Getting More Help](#getting-more-help)

---

## Installation Issues

### Error: "npm install -g kse" fails

**Symptoms:**
```
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules
```

**Cause:** Insufficient permissions to install global npm packages

**Solutions:**

**Option 1: Use npx (Recommended)**
```bash
# No installation needed, run directly
npx kse status
npx kse adopt
```

**Option 2: Fix npm permissions (macOS/Linux)**
```bash
# Create npm directory in home folder
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH=~/.npm-global/bin:$PATH

# Reload shell config
source ~/.bashrc  # or source ~/.zshrc

# Now install
npm install -g kse
```

**Option 3: Use sudo (Not Recommended)**
```bash
sudo npm install -g kse
```

---

### Error: "kse: command not found"

**Symptoms:**
```bash
$ kse status
bash: kse: command not found
```

**Cause:** kse is not in your PATH

**Solutions:**

**Check if kse is installed:**
```bash
npm list -g kse
```

**If installed, find where:**
```bash
npm root -g
# Output: /usr/local/lib/node_modules (or similar)
```

**Add to PATH:**
```bash
# macOS/Linux - Add to ~/.bashrc or ~/.zshrc
export PATH="/usr/local/bin:$PATH"

# Windows - Add to System Environment Variables
# C:\Users\YourName\AppData\Roaming\npm
```

**Verify:**
```bash
which kse  # macOS/Linux
where kse  # Windows
```

---

### Error: "Node.js version too old"

**Symptoms:**
```
Error: kse requires Node.js 14 or higher
Current version: v12.x.x
```

**Cause:** kse requires Node.js 14+

**Solution:**

**Update Node.js:**
```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
# https://nodejs.org/
```

**Verify:**
```bash
node --version
# Should show v14.x.x or higher
```

---

## Adoption Issues

### Error: "Not a git repository"

**Symptoms:**
```bash
$ kse adopt
Error: Not a git repository
kse requires a git repository to track Specs
```

**Cause:** kse requires git for version control

**Solution:**

**Initialize git:**
```bash
git init
git add .
git commit -m "Initial commit"

# Now adopt kse
kse adopt
```

**Why git is required:**
- Specs should be version controlled
- Team collaboration needs git
- kse uses git to detect project root

---

### Error: "kse.json already exists"

**Symptoms:**
```bash
$ kse adopt
Error: kse.json already exists
Use 'kse upgrade' to update existing installation
```

**Cause:** Project already has kse installed

**Solutions:**

**If you want to upgrade:**
```bash
kse upgrade
```

**If you want to start fresh:**
```bash
# Backup existing Specs
cp -r .kiro .kiro.backup

# Remove kse
rm kse.json
rm -rf .kiro

# Re-adopt
kse adopt
```

---

### Error: "Permission denied creating .kiro directory"

**Symptoms:**
```bash
$ kse adopt
Error: EACCES: permission denied, mkdir '.kiro'
```

**Cause:** Insufficient permissions in project directory

**Solution:**

**Check directory permissions:**
```bash
ls -la
```

**Fix permissions:**
```bash
# Make sure you own the directory
sudo chown -R $USER:$USER .

# Or run in a directory you own
cd ~/projects/my-project
kse adopt
```

---

## Command Issues

### Error: "No Specs found"

**Symptoms:**
```bash
$ kse status
No Specs found in .kiro/specs/
```

**Cause:** No Specs have been created yet

**Solution:**

**Create your first Spec:**
```bash
kse create-spec 01-00-my-feature
```

**Or check if Specs exist:**
```bash
ls -la .kiro/specs/
```

---

### Error: "Invalid Spec name format"

**Symptoms:**
```bash
$ kse create-spec my-feature
Error: Invalid Spec name format
Expected: {number}-{number}-{kebab-case-name}
```

**Cause:** Spec names must follow the format: `XX-YY-feature-name`

**Solution:**

**Use correct format:**
```bash
# ✅ Correct
kse create-spec 01-00-user-login
kse create-spec 02-01-fix-auth-bug

# ❌ Wrong
kse create-spec user-login
kse create-spec 01-user-login
kse create-spec UserLogin
```

---

### Error: "Context export failed"

**Symptoms:**
```bash
$ kse context export 01-00-user-login
Error: Failed to export context
```

**Possible Causes & Solutions:**

**1. Spec doesn't exist:**
```bash
# Check Spec exists
ls .kiro/specs/01-00-user-login/

# If not, create it
kse create-spec 01-00-user-login
```

**2. Missing Spec files:**
```bash
# Spec needs at least requirements.md
ls .kiro/specs/01-00-user-login/requirements.md

# Create if missing
touch .kiro/specs/01-00-user-login/requirements.md
```

**3. File permission issues:**
```bash
# Check permissions
ls -la .kiro/specs/01-00-user-login/

# Fix if needed
chmod 644 .kiro/specs/01-00-user-login/*.md
```

---

### Error: "Task not found"

**Symptoms:**
```bash
$ kse task claim 01-00-user-login 1.1
Error: Task 1.1 not found in tasks.md
```

**Cause:** Task ID doesn't exist in tasks.md

**Solution:**

**Check tasks.md:**
```bash
cat .kiro/specs/01-00-user-login/tasks.md
```

**Verify task ID format:**
```markdown
# tasks.md should have:
- [ ] 1.1 Task description
- [ ] 1.2 Another task

# Not:
- [ ] Task description (missing ID)
```

---

## Integration Issues

### My AI tool doesn't understand the context

**Symptoms:**
- AI generates code that doesn't match your Spec
- AI asks for information already in the Spec
- AI ignores design decisions

**Solutions:**

**1. Be explicit in your prompt:**
```
❌ Bad: "Implement the login feature"

✅ Good: "Please implement the login feature following the 
requirements and design in the provided context. Pay special 
attention to the API design and error handling sections."
```

**2. Verify context was provided:**
```bash
# Check context file exists and has content
cat .kiro/specs/01-00-user-login/context-export.md

# Should contain requirements, design, and tasks
```

**3. Break down large contexts:**
```bash
# Instead of entire Spec, export specific task
kse prompt generate 01-00-user-login 1.1
```

**4. Use steering rules:**
```bash
# Include project-specific rules
kse context export 01-00-user-login --include-steering
```

---

### Context file too large for AI tool

**Symptoms:**
- AI tool rejects context (too many tokens)
- AI tool truncates context
- Error: "Context exceeds maximum length"

**Solutions:**

**1. Use task-specific prompts:**
```bash
# Export just one task
kse prompt generate 01-00-user-login 1.1
```

**2. Simplify your Spec:**
- Remove unnecessary details from requirements
- Condense design documentation
- Break large Specs into smaller ones

**3. Use a tool with larger context window:**
- Claude Code: 200K tokens
- GPT-4 Turbo: 128K tokens
- Gemini Pro: 1M tokens

---

### AI generates code that doesn't match design

**Symptoms:**
- Code structure differs from design
- API endpoints don't match specification
- Component names are different

**Solutions:**

**1. Improve design specificity:**
```markdown
# ❌ Vague
- Create authentication system

# ✅ Specific
- Create AuthController class with login() method
- Method signature: async login(email: string, password: string): Promise<AuthResult>
- Return { token: string } on success
- Return { error: string } on failure
```

**2. Reference design in prompt:**
```
"Please implement exactly as specified in the Design section,
using the exact class names, method signatures, and API endpoints
documented."
```

**3. Provide code examples in design:**
```markdown
## Example Implementation
```javascript
class AuthController {
  async login(email, password) {
    // Implementation here
  }
}
```
```

---

## Watch Mode Issues

### Watch mode not detecting changes

**Symptoms:**
```bash
$ kse watch status
Status: Running

# But editing Spec files doesn't trigger actions
```

**Solutions:**

**1. Restart watch mode:**
```bash
kse watch stop
kse watch start
```

**2. Check watch patterns:**
```bash
kse watch config
# Verify patterns include your files
```

**3. Check file system events:**
```bash
# Some editors don't trigger file system events
# Try saving with "Save As" instead of "Save"
```

**4. Increase watch delay:**
```bash
# If changes are too rapid
kse watch config --delay 1000
```

---

### Watch mode consuming too much CPU

**Symptoms:**
- High CPU usage when watch mode is running
- System becomes slow

**Solutions:**

**1. Reduce watch scope:**
```bash
# Watch only specific Specs
kse watch start --spec 01-00-user-login
```

**2. Exclude unnecessary files:**
```bash
# Add to watch config
{
  "exclude": [
    "node_modules/**",
    ".git/**",
    "*.log"
  ]
}
```

**3. Stop when not needed:**
```bash
# Stop watch mode when not actively developing
kse watch stop
```

---

### Watch mode actions not executing

**Symptoms:**
- Watch mode detects changes
- But actions don't run

**Solutions:**

**1. Check action configuration:**
```bash
kse watch config
# Verify actions are properly configured
```

**2. Check action logs:**
```bash
kse watch logs
# Look for error messages
```

**3. Test action manually:**
```bash
# Try running the action command directly
kse context export 01-00-user-login
```

---

## Platform-Specific Issues

### Windows Issues

#### PowerShell vs CMD

**Issue:** Commands work in CMD but not PowerShell (or vice versa)

**Solution:**
```powershell
# Use CMD for kse commands
cmd /c kse status

# Or configure PowerShell execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Path separators

**Issue:** Paths with forward slashes don't work

**Solution:**
```bash
# ❌ Wrong on Windows
kse context export .kiro/specs/01-00-user-login

# ✅ Correct on Windows
kse context export .kiro\specs\01-00-user-login

# ✅ Or use forward slashes (kse handles both)
kse context export 01-00-user-login
```

#### Line endings

**Issue:** Files have wrong line endings (CRLF vs LF)

**Solution:**
```bash
# Configure git to handle line endings
git config --global core.autocrlf true

# Or use .gitattributes
echo "*.md text eol=lf" >> .gitattributes
```

---

### macOS Issues

#### Gatekeeper blocking kse

**Issue:** "kse cannot be opened because it is from an unidentified developer"

**Solution:**
```bash
# kse is installed via npm, so this shouldn't happen
# But if it does:
xattr -d com.apple.quarantine $(which kse)
```

#### Permission issues

**Issue:** "Operation not permitted"

**Solution:**
```bash
# Grant Terminal full disk access
# System Preferences → Security & Privacy → Privacy → Full Disk Access
# Add Terminal.app
```

---

### Linux Issues

#### Different shells

**Issue:** Commands work in bash but not zsh (or vice versa)

**Solution:**
```bash
# Add kse to PATH in your shell config
# For bash: ~/.bashrc
# For zsh: ~/.zshrc
export PATH="$HOME/.npm-global/bin:$PATH"

# Reload config
source ~/.bashrc  # or ~/.zshrc
```

#### Permission issues

**Issue:** "Permission denied" errors

**Solution:**
```bash
# Check file permissions
ls -la $(which kse)

# Should be executable
chmod +x $(which kse)
```

---

## Getting More Help

### Before Asking for Help

**Gather information:**
```bash
# kse version
kse --version

# Node.js version
node --version

# npm version
npm --version

# Operating system
uname -a  # macOS/Linux
ver       # Windows

# Current directory structure
ls -la .kiro/
```

### Where to Get Help

**1. Documentation:**
- [Quick Start Guide](quick-start.md)
- [FAQ](faq.md)
- [Command Reference](command-reference.md)

**2. GitHub Issues:**
- Search existing issues: https://github.com/kiro-spec-engine/kse/issues
- Create new issue: https://github.com/kiro-spec-engine/kse/issues/new

**3. GitHub Discussions:**
- Ask questions: https://github.com/kiro-spec-engine/kse/discussions
- Share tips and tricks
- Connect with other users

**4. Community:**
- Discord: [Join our Discord](https://discord.gg/kse)
- Twitter: [@kse_dev](https://twitter.com/kse_dev)

### Creating a Good Issue Report

**Include:**
1. **What you tried to do**
2. **What you expected to happen**
3. **What actually happened**
4. **Error messages** (full text)
5. **Environment info** (OS, Node version, kse version)
6. **Steps to reproduce**

**Example:**
```markdown
## Description
Context export fails for Spec with Chinese characters in filename

## Steps to Reproduce
1. Create Spec: kse create-spec 01-00-用户登录
2. Run: kse context export 01-00-用户登录
3. Error occurs

## Expected Behavior
Context should export successfully

## Actual Behavior
Error: Invalid filename

## Environment
- OS: macOS 13.0
- Node: v18.12.0
- kse: v1.0.0

## Error Message
```
Error: EINVAL: invalid filename
```
```

---

## Related Documentation

- **[Quick Start Guide](quick-start.md)** - Get started with kse
- **[FAQ](faq.md)** - Frequently asked questions
- **[Command Reference](command-reference.md)** - All kse commands
- **[Integration Modes](integration-modes.md)** - Using kse with AI tools

---

## Summary

**Most Common Issues:**
1. **Installation** - Use npx or fix npm permissions
2. **Command not found** - Add kse to PATH
3. **Spec name format** - Use XX-YY-feature-name format
4. **Context too large** - Use task-specific prompts
5. **Watch mode** - Restart or check configuration

**Quick Fixes:**
```bash
# Restart kse watch mode
kse watch stop && kse watch start

# Verify installation
kse --version

# Check Spec structure
ls -la .kiro/specs/

# Test context export
kse context export spec-name
```

**Still stuck?** → [Create an issue](https://github.com/kiro-spec-engine/kse/issues/new)

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-23
