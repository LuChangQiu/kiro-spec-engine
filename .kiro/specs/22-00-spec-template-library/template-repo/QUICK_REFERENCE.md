# Quick Reference

## Repository Structure

```
kse-spec-templates/
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── template_request.md
├── docs/
│   ├── template-usage-guide.md
│   └── template-creation-guide.md
├── web-features/
│   ├── rest-api/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   └── graphql-api/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── backend-features/
│   └── database-integration/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── template-registry.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

## Quick Commands

### For Users

```bash
# List all templates
kse templates list

# Search templates
kse templates search "api"

# View template details
kse templates show web-features/rest-api

# Create Spec from template
kse spec create my-feature --template web-features/rest-api

# Update templates
kse templates update
```

### For Contributors

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/kse-spec-templates.git
cd kse-spec-templates

# Create new branch
git checkout -b add-my-template

# Add your template files
mkdir -p category/template-name
# Create requirements.md, design.md, tasks.md

# Update registry
# Edit template-registry.json

# Commit and push
git add .
git commit -m "Add template: category/template-name"
git push origin add-my-template

# Create PR on GitHub
```

## Template Checklist

### Required Files
- [ ] requirements.md
- [ ] design.md
- [ ] tasks.md

### Required Frontmatter Fields
- [ ] name
- [ ] category
- [ ] description
- [ ] difficulty
- [ ] tags (array)
- [ ] applicable_scenarios (array)
- [ ] author
- [ ] created_at
- [ ] updated_at
- [ ] version

### Content Requirements
- [ ] Guidance comments
- [ ] Example content
- [ ] Placeholder variables
- [ ] No sensitive information
- [ ] No project-specific details

### Registry Update
- [ ] Add entry to template-registry.json
- [ ] Update README.md

## Placeholder Variables

| Variable | Example Output |
|----------|----------------|
| `{{SPEC_NAME}}` | `user-authentication` |
| `{{SPEC_NAME_TITLE}}` | `User Authentication` |
| `{{DATE}}` | `2025-01-31` |
| `{{YEAR}}` | `2025` |
| `{{AUTHOR}}` | `John Doe` |
| `{{PROJECT_NAME}}` | `my-app` |

## Template Categories

- **web-features** - Frontend and web application features
- **backend-features** - Backend services and APIs
- **infrastructure** - Infrastructure and deployment
- **devops** - DevOps and CI/CD pipelines
- **testing** - Testing frameworks and strategies

## Difficulty Levels

- **beginner** - Simple, well-documented, few dependencies
- **intermediate** - Moderate complexity, some experience needed
- **advanced** - Complex, requires deep domain knowledge

## Support

- **Documentation**: See docs/ directory
- **Issues**: https://github.com/heguangyong/kse-spec-templates/issues
- **Main Project**: https://github.com/heguangyong/kiro-spec-engine

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-31
