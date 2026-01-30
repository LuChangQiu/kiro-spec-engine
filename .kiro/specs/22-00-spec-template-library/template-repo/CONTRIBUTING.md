# Contributing to kse-spec-templates

Thank you for your interest in contributing templates! This guide will help you create high-quality templates that benefit the entire community.

## 🎯 Contribution Process

1. **Fork the repository**
2. **Create a new branch** for your template
3. **Add your template** following the structure guidelines below
4. **Test your template** by using it to create a real Spec
5. **Submit a pull request** with the validation checklist completed

## 📋 Template Structure

Each template must include three files with YAML frontmatter:

```
category/template-name/
├── requirements.md    # Feature requirements
├── design.md          # Technical design
└── tasks.md           # Implementation tasks
```

### Required YAML Frontmatter Fields

```yaml
---
name: Template Display Name
category: web-features | backend-features | infrastructure | devops | testing
description: Brief description of what this template is for (1-2 sentences)
difficulty: beginner | intermediate | advanced
tags:
  - tag1
  - tag2
  - tag3
applicable_scenarios:
  - Scenario 1
  - Scenario 2
  - Scenario 3
author: your-github-username
created_at: YYYY-MM-DD
updated_at: YYYY-MM-DD
version: 1.0.0
---
```

## ✅ Quality Standards

### 1. Completeness

- ✅ All three files (requirements.md, design.md, tasks.md) must be present
- ✅ Each file must have valid YAML frontmatter
- ✅ Each file must follow the standard Spec document structure

### 2. Guidance and Examples

- ✅ Include inline comments explaining how to fill each section
- ✅ Provide example content demonstrating best practices
- ✅ Use placeholder variables ({{SPEC_NAME}}, {{DATE}}, etc.) where appropriate

### 3. Real-World Validation

- ✅ Template must be tested by creating a real Spec from it
- ✅ Template should be based on actual project experience
- ✅ Template should solve a common, recurring need

### 4. Documentation

- ✅ Clear description in frontmatter
- ✅ Applicable scenarios listed
- ✅ Appropriate difficulty level
- ✅ Relevant tags for discoverability

## 📝 Template Content Guidelines

### requirements.md

Should include:
- Introduction section explaining the feature
- Glossary of key terms
- Functional requirements with user stories
- Non-functional requirements
- Acceptance criteria
- Out of scope section

**Example structure**:
```markdown
---
name: Your Template Name
category: web-features
description: Template description
difficulty: intermediate
tags: [tag1, tag2]
applicable_scenarios:
  - Scenario 1
author: your-username
created_at: 2025-01-30
updated_at: 2025-01-30
version: 1.0.0
---

# Requirements Document

## Introduction

<!-- Explain what this feature does and why it's needed -->
This Spec defines {{SPEC_NAME}} feature...

## Glossary

<!-- Define key terms -->
- **Term1**: Definition
- **Term2**: Definition

## Requirements

### Requirement 1: [Requirement Name]

**User Story:** As a [role], I want [goal], so that [benefit].

#### Acceptance Criteria

1. WHEN [condition], THE system SHALL [behavior]
2. WHEN [condition], THE system SHALL [behavior]

<!-- More requirements... -->
```

### design.md

Should include:
- Overview of the solution
- Architecture diagrams (using Mermaid)
- Component descriptions
- Data models
- Correctness properties (for property-based testing)
- Error handling strategy
- Testing strategy

### tasks.md

Should include:
- Overview of implementation approach
- Phased task breakdown
- Task dependencies
- Checkpoints for validation
- Requirements traceability

## 🔍 Validation Checklist

Before submitting your PR, ensure:

- [ ] All three files (requirements.md, design.md, tasks.md) are present
- [ ] YAML frontmatter is valid and contains all required fields
- [ ] Template follows standard Spec document structure
- [ ] Inline comments explain how to fill each section
- [ ] Example content demonstrates best practices
- [ ] Placeholder variables are used appropriately
- [ ] Template has been tested by creating a real Spec
- [ ] Description clearly explains the template's purpose
- [ ] Applicable scenarios are listed
- [ ] Difficulty level is appropriate
- [ ] Tags are relevant and helpful
- [ ] Template is added to template-registry.json
- [ ] README.md is updated with the new template

## 📊 Template Registry

After creating your template, add an entry to `template-registry.json`:

```json
{
  "id": "category/template-name",
  "name": "Template Display Name",
  "category": "web-features",
  "description": "Brief description",
  "difficulty": "intermediate",
  "tags": ["tag1", "tag2", "tag3"],
  "applicable_scenarios": [
    "Scenario 1",
    "Scenario 2"
  ],
  "files": [
    "requirements.md",
    "design.md",
    "tasks.md"
  ],
  "author": "your-github-username",
  "created_at": "2025-01-30",
  "updated_at": "2025-01-30"
}
```

## 🎨 Placeholder Variables

Use these variables in your templates for automatic substitution:

- `{{SPEC_NAME}}` - The Spec name (e.g., "user-authentication")
- `{{SPEC_NAME_TITLE}}` - Title case Spec name (e.g., "User Authentication")
- `{{DATE}}` - Current date (YYYY-MM-DD)
- `{{YEAR}}` - Current year
- `{{AUTHOR}}` - User's name from Git config
- `{{PROJECT_NAME}}` - Project name from package.json or directory

## 💡 Tips for Great Templates

1. **Be Specific**: Focus on a specific, well-defined use case
2. **Be Practical**: Base templates on real project experience
3. **Be Clear**: Use simple language and clear examples
4. **Be Complete**: Don't leave critical sections empty
5. **Be Helpful**: Include guidance comments throughout

## 🚫 What Not to Include

- ❌ Project-specific details (company names, internal URLs)
- ❌ Sensitive information (API keys, passwords)
- ❌ Overly generic templates that don't add value
- ❌ Templates without proper testing
- ❌ Duplicate templates (check existing templates first)

## 📞 Questions?

If you have questions about contributing:
- Open an issue in this repository
- Check existing templates for examples
- Review the [Template Creation Guide](docs/template-creation-guide.md)

## 🙏 Thank You!

Your contributions help the entire kse community build better software faster. We appreciate your time and effort!

---

**Last Updated**: 2025-01-30
