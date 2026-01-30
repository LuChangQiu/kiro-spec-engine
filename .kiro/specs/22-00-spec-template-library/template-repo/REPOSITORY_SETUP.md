# Repository Setup Instructions

This document provides instructions for setting up the kse-spec-templates GitHub repository.

## Repository Creation

### 1. Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `kse-spec-templates`
3. **Description**: `Official template library for kiro-spec-engine (kse) - High-quality Spec templates for rapid feature development`
4. **Visibility**: Public
5. **Initialize**: Do NOT initialize with README, .gitignore, or license (we have these already)
6. Click "Create repository"

### 2. Push Initial Content

```bash
# Navigate to template-repo directory
cd .kiro/specs/22-00-spec-template-library/template-repo

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: kse-spec-templates v1.0.0

- Add REST API template
- Add GraphQL API template
- Add Database Integration template
- Add comprehensive documentation
- Add contribution guidelines
- Add GitHub templates"

# Add remote
git remote add origin https://github.com/heguangyong/kse-spec-templates.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Create Initial Release

```bash
# Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0

Initial release with 3 templates:
- web-features/rest-api
- web-features/graphql-api
- backend-features/database-integration

Includes:
- Comprehensive documentation
- Contribution guidelines
- GitHub issue and PR templates"

git push origin v1.0.0
```

## Repository Settings

### General Settings

1. Go to repository Settings
2. **Features**:
   - ✅ Issues
   - ✅ Projects (optional)
   - ✅ Wiki (optional)
   - ✅ Discussions (recommended)
3. **Pull Requests**:
   - ✅ Allow squash merging
   - ✅ Allow merge commits
   - ✅ Automatically delete head branches

### Branch Protection

1. Go to Settings → Branches
2. Add branch protection rule for `main`:
   - Branch name pattern: `main`
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators (optional)

### Topics

Add repository topics for discoverability:

1. Go to repository main page
2. Click "Add topics"
3. Add: `kse`, `spec-templates`, `kiro-spec-engine`, `templates`, `development`, `specifications`, `feature-specs`

### About Section

Update repository description:

**Description**: Official template library for kiro-spec-engine (kse) - High-quality Spec templates for rapid feature development

**Website**: https://github.com/heguangyong/kiro-spec-engine

**Topics**: kse, spec-templates, kiro-spec-engine, templates, development, specifications, feature-specs

## GitHub Pages (Optional)

To host documentation on GitHub Pages:

1. Go to Settings → Pages
2. **Source**: Deploy from a branch
3. **Branch**: main
4. **Folder**: /docs
5. Click "Save"

Documentation will be available at: https://heguangyong.github.io/kse-spec-templates/

## Integration with kse CLI

### Update Default Template Source

In kse CLI, the default template source URL should be:

```
https://github.com/heguangyong/kse-spec-templates.git
```

This is already configured in `lib/templates/template-manager.js`:

```javascript
const DEFAULT_TEMPLATE_SOURCE = {
  name: 'official',
  type: 'official',
  url: 'https://github.com/heguangyong/kse-spec-templates.git',
  branch: 'main',
  enabled: true
};
```

## Maintenance

### Adding New Templates

1. Create template files in appropriate category directory
2. Update `template-registry.json`
3. Update `README.md` template list
4. Create PR with template submission checklist
5. After merge, create new release tag

### Versioning

Follow semantic versioning:

- **Major** (X.0.0): Breaking changes to template structure
- **Minor** (1.X.0): New templates added
- **Patch** (1.0.X): Bug fixes, documentation updates

### Release Process

1. Update version in `template-registry.json`
2. Update `README.md` with changes
3. Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
4. Push tag: `git push origin vX.Y.Z`
5. Create GitHub Release with changelog

## Community Guidelines

### Code of Conduct

Create `CODE_OF_CONDUCT.md` (optional but recommended):

```markdown
# Code of Conduct

## Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

## Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Enforcement

Instances of abusive behavior may be reported to the project team.
```

### Security Policy

Create `SECURITY.md` (optional):

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email security@example.com.

Please do not open public issues for security vulnerabilities.
```

## Monitoring

### Watch for Issues

- Enable email notifications for new issues
- Respond to bug reports within 48 hours
- Respond to template requests within 1 week

### Review Pull Requests

- Review PRs within 1 week
- Use PR template checklist
- Test templates before merging
- Provide constructive feedback

## Support

### Documentation

- Keep README.md up to date
- Update guides when adding features
- Add examples for common use cases

### Community

- Enable Discussions for Q&A
- Create FAQ document
- Link to main kse repository

---

**Setup Date**: 2025-01-31  
**Repository**: https://github.com/heguangyong/kse-spec-templates  
**Maintainer**: kse-team
