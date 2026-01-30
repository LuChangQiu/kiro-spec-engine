# Setup Instructions for kse-spec-templates Repository

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `kse-spec-templates`
3. Description: "Official template library for kiro-spec-engine"
4. Public repository
5. **Do NOT** initialize with README (we have our own)
6. Click "Create repository"

## Step 2: Copy Template Files

All template files are prepared in:
```
.kiro/specs/22-00-spec-template-library/template-repo/
```

### Option A: Manual Copy (Recommended for first time)

```bash
# 1. Create a new directory for the repository
mkdir kse-spec-templates
cd kse-spec-templates

# 2. Initialize Git
git init
git branch -M main

# 3. Copy files from template-repo/
# Copy all files from .kiro/specs/22-00-spec-template-library/template-repo/ to here

# 4. Add and commit
git add .
git commit -m "Initial commit: Add REST API template and documentation"

# 5. Push to GitHub
git remote add origin https://github.com/heguangyong/kse-spec-templates.git
git push -u origin main
```

### Option B: Using Script (Windows)

```cmd
REM Run from project root
cd .kiro\specs\22-00-spec-template-library
xcopy template-repo\* ..\..\..\..\kse-spec-templates\ /E /I /Y
cd ..\..\..\..\kse-spec-templates
git init
git branch -M main
git add .
git commit -m "Initial commit: Add REST API template and documentation"
git remote add origin https://github.com/heguangyong/kse-spec-templates.git
git push -u origin main
```

## Step 3: Verify Repository Structure

Your repository should look like this:

```
kse-spec-templates/
├── README.md
├── CONTRIBUTING.md
├── template-registry.json
└── web-features/
    └── rest-api/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

## Step 4: Add License

Create a LICENSE file (MIT License recommended):

```
MIT License

Copyright (c) 2025 kse-team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Step 5: Create Initial Release

```bash
git tag -a v1.0.0 -m "Release v1.0.0: Initial template library with REST API template"
git push origin v1.0.0
```

## Step 6: Test Integration with kse

Once the repository is created, test it:

```bash
# This will be implemented in kse later
kse templates update
kse templates list
kse spec create test-api --template web-features/rest-api
```

## Next Steps

1. ✅ Create more templates (GraphQL API, Database Integration, etc.)
2. ✅ Add documentation in docs/ directory
3. ✅ Set up GitHub Actions for template validation
4. ✅ Create issue templates for template contributions
5. ✅ Add CHANGELOG.md

## Repository Settings

### Branch Protection

Consider adding branch protection rules:
- Require pull request reviews before merging
- Require status checks to pass
- Require branches to be up to date

### Topics

Add these topics to the repository:
- kse
- kiro-spec-engine
- spec-templates
- development-templates
- software-engineering

---

**Created**: 2025-01-30  
**For**: Spec 22-00 - Spec Template Library
