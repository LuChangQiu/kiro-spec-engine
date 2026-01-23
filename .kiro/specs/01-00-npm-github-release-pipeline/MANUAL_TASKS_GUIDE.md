# Manual Tasks Guide: GitHub Setup and Release

This guide provides step-by-step instructions for completing the remaining manual tasks (Tasks 17-19) that require GitHub account access and npm publishing permissions.

## Prerequisites

Before starting, ensure you have:
- ✅ GitHub account with repository creation permissions
- ✅ npm account (create at https://www.npmjs.com/signup)
- ✅ Git installed and configured locally
- ✅ All automated tasks (1-16) completed

---

## Task 17: GitHub Repository Setup

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Fill in repository details:
   - **Repository name**: `kiro-spec-engine`
   - **Description**: "Kiro Spec Engine - A spec-driven development engine with steering rules and quality enhancement powered by Ultrawork spirit"
   - **Visibility**: Public
   - **Initialize**: Do NOT initialize with README (we already have one)
3. Click "Create repository"

### Step 2: Initialize Local Git Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Kiro Spec Engine v1.0.0"

# Add remote origin (replace USERNAME with your GitHub username)
git remote add origin https://github.com/USERNAME/kiro-spec-engine.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Configure Repository Settings

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Under "General" → "Topics", add:
   - `kiro`
   - `spec`
   - `cli`
   - `development-tools`
   - `ultrawork`
   - `quality-enhancement`

### Step 4: Configure NPM_TOKEN Secret

1. Get your npm token:
   ```bash
   npm login
   npm token create
   ```
   Copy the generated token

2. In GitHub repository:
   - Go to "Settings" → "Secrets and variables" → "Actions"
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

### Step 5: Verify GitHub Actions

1. Go to "Actions" tab in your repository
2. Verify that workflows are enabled
3. You should see two workflows:
   - "Test" workflow
   - "Release" workflow

**✅ Task 17 Complete!**

---

## Task 18: First Release

### Step 1: Verify Everything is Ready

```bash
# Run all tests
npm test

# Check coverage
npm run coverage

# Verify version in package.json is 1.0.0
cat package.json | grep version

# Test CLI locally
node bin/kiro-spec-engine.js --version
node bin/kiro-spec-engine.js doctor
node bin/kiro-spec-engine.js --help
```

### Step 2: Update CHANGELOG.md

Edit `CHANGELOG.md` and update the release section:

```markdown
## [1.0.0] - 2026-01-23

### Added
- Initial stable release
- Complete npm and GitHub release pipeline
- Python dependency detection with OS-specific installation instructions
- Doctor command for system diagnostics
- Automated CI/CD with GitHub Actions
- Multi-language support (English and Chinese)
- Comprehensive test infrastructure
- Ultrawork quality enhancement tool

### Documentation
- Complete README with installation and usage guide
- Chinese README (README.zh.md)
- Contributing guidelines
- MIT License
```

### Step 3: Commit and Push Changes

```bash
# Add CHANGELOG changes
git add CHANGELOG.md

# Commit
git commit -m "Release v1.0.0"

# Push to main
git push origin main
```

### Step 4: Create and Push Version Tag

```bash
# Create version tag
git tag v1.0.0

# Push tag to GitHub (this triggers the release workflow)
git push origin v1.0.0
```

### Step 5: Monitor Release Workflow

1. Go to GitHub repository → "Actions" tab
2. You should see "Release" workflow running
3. Wait for it to complete (usually 5-10 minutes)
4. Workflow will:
   - Run all tests
   - Publish to npm
   - Create GitHub release

### Step 6: Verify npm Publication

```bash
# Check if package is published
npm view kiro-spec-engine

# Should show package information including version 1.0.0
```

### Step 7: Verify GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" (right sidebar)
3. You should see "Release v1.0.0"
4. Verify release notes are present

**✅ Task 18 Complete!**

---

## Task 19: Post-Release Validation

### Step 1: Install Package Globally from npm

```bash
# Uninstall local version if installed
npm uninstall -g kiro-spec-engine

# Install from npm registry
npm install -g kiro-spec-engine

# Verify installation
which kse  # On Unix/Mac
where kse  # On Windows
```

### Step 2: Test kse --version

```bash
kse --version
# Expected output: 1.0.0

kiro-spec-engine --version
# Expected output: 1.0.0
```

**✅ Test Passed** if version displays correctly

### Step 3: Test kse --help

```bash
kse --help
# Should display usage information with all commands
```

**✅ Test Passed** if help displays correctly

### Step 4: Test kse doctor

```bash
kse doctor
# Should check Node.js and Python availability
```

**✅ Test Passed** if diagnostics display correctly

### Step 5: Test kse init

```bash
# Create test directory
mkdir test-kse-project
cd test-kse-project

# Initialize project
kse init "Test Project"

# Verify structure
ls -la .kiro/
# Should see: specs/, steering/, tools/, README.md
```

**✅ Test Passed** if project structure is created

### Step 6: Test Language Switching

```bash
# Test Chinese
kse --lang zh --help

# Test English
kse --lang en --help
```

**✅ Test Passed** if both languages work

### Step 7: Document Any Issues

If you encounter any issues:

1. Create GitHub issue with details:
   - What command you ran
   - Expected behavior
   - Actual behavior
   - Error messages
   - Your environment (OS, Node version, Python version)

2. Label the issue appropriately:
   - `bug` for defects
   - `documentation` for doc issues
   - `enhancement` for improvements

**✅ Task 19 Complete!**

---

## Troubleshooting

### Issue: npm publish fails with authentication error

**Solution**:
1. Verify NPM_TOKEN is correctly set in GitHub Secrets
2. Regenerate npm token: `npm token create`
3. Update GitHub Secret with new token
4. Re-run release workflow

### Issue: GitHub Actions workflow fails

**Solution**:
1. Check workflow logs in Actions tab
2. Common issues:
   - Tests failing: Fix tests locally first
   - Coverage below 70%: Add more tests
   - npm token invalid: Update secret
3. Fix issues and push new tag

### Issue: Package not found on npm after release

**Solution**:
1. Wait 5-10 minutes (npm registry propagation)
2. Check npm registry: https://www.npmjs.com/package/kiro-spec-engine
3. If still not found, check GitHub Actions logs for errors

### Issue: CLI commands not working after global install

**Solution**:
1. Verify npm global bin directory is in PATH:
   ```bash
   npm config get prefix
   # Add this path to your PATH environment variable
   ```
2. Restart terminal
3. Try installation again

---

## Success Criteria

All tasks are complete when:

- ✅ GitHub repository is public and accessible
- ✅ Repository has all topics/tags configured
- ✅ NPM_TOKEN secret is configured
- ✅ GitHub Actions workflows are enabled
- ✅ Version tag v1.0.0 is pushed
- ✅ Release workflow completes successfully
- ✅ Package is published to npm
- ✅ GitHub release is created
- ✅ Package can be installed globally via npm
- ✅ All CLI commands work correctly
- ✅ Both English and Chinese languages work
- ✅ Doctor command checks system requirements
- ✅ Init command creates project structure

---

## Next Steps After Release

1. **Monitor npm downloads**: https://www.npmjs.com/package/kiro-spec-engine
2. **Watch GitHub stars/forks**: Track community interest
3. **Respond to issues**: Help users with problems
4. **Plan next release**: Gather feedback and plan improvements
5. **Update documentation**: Keep README and guides current
6. **Promote the project**: Share on social media, forums, etc.

---

## Congratulations! 🎉

You have successfully completed the npm and GitHub release pipeline for Kiro Spec Engine!

The project is now:
- ✅ Published to npm
- ✅ Available on GitHub
- ✅ Fully automated with CI/CD
- ✅ Ready for users worldwide

**Thank you for embodying the Ultrawork spirit! 🔥**

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-23  
**Spec**: 01-00-npm-github-release-pipeline
