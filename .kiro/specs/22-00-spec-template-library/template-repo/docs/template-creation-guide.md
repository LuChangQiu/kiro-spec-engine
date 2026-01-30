# Template Creation Guide

This guide explains how to create high-quality templates for the kse-spec-templates library.

## Table of Contents

- [Overview](#overview)
- [Template Structure](#template-structure)
- [YAML Frontmatter](#yaml-frontmatter)
- [Content Guidelines](#content-guidelines)
- [Placeholder Variables](#placeholder-variables)
- [Quality Standards](#quality-standards)
- [Testing Your Template](#testing-your-template)
- [Submission Process](#submission-process)

## Overview

A good template:
- Solves a common, recurring need
- Provides clear guidance and examples
- Follows Spec document standards
- Is based on real project experience
- Includes all three required files

## Template Structure

Each template must include exactly three files:

```
category/template-name/
├── requirements.md    # Feature requirements and acceptance criteria
├── design.md          # Technical design and architecture
└── tasks.md           # Implementation tasks breakdown
```

### Directory Naming

- **Category**: Use existing categories or propose new ones
  - `web-features/` - Frontend and web application features
  - `backend-features/` - Backend services and APIs
  - `infrastructure/` - Infrastructure and deployment
  - `devops/` - DevOps and CI/CD pipelines
  - `testing/` - Testing frameworks and strategies

- **Template Name**: Use kebab-case (e.g., `rest-api`, `database-integration`)

## YAML Frontmatter

Each file must start with YAML frontmatter containing metadata.

### Required Fields

```yaml
---
name: Template Display Name
category: web-features
description: Brief description (1-2 sentences)
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

### Field Guidelines

**name**: Clear, descriptive name (e.g., "REST API Feature")

**category**: Must match directory structure

**description**: 1-2 sentences explaining what the template is for

**difficulty**:
- `beginner` - Simple, well-documented, few dependencies
- `intermediate` - Moderate complexity, some experience needed
- `advanced` - Complex, requires deep domain knowledge

**tags**: 3-5 relevant keywords for searchability

**applicable_scenarios**: 3-5 specific use cases where this template applies

**author**: Your GitHub username

**dates**: Use ISO format (YYYY-MM-DD)

**version**: Semantic versioning (1.0.0)

## Content Guidelines

### requirements.md

**Structure**:
```markdown
# Requirements Document: {{SPEC_NAME_TITLE}}

## Introduction
<!-- Explain what this feature does and why it's needed -->

## Glossary
<!-- Define key terms -->

## Requirements

### Requirement 1: [Name]
**User Story:** As a [role], I want [goal], so that [benefit].

#### Acceptance Criteria
1. WHEN [condition], THE system SHALL [behavior]
2. WHEN [condition], THE system SHALL [behavior]

## Non-Functional Requirements

## Out of Scope
```

**Best Practices**:
- Use clear, testable acceptance criteria
- Include user stories for context
- Define domain-specific terms in glossary
- Use placeholders for customization (e.g., `{{SPEC_NAME}}`)
- Add guidance comments: `<!-- Fill this section with... -->`
- Provide examples where helpful

### design.md

**Structure**:
```markdown
# Design Document: {{SPEC_NAME_TITLE}}

## Overview
<!-- High-level description -->

## Architecture
<!-- Diagrams and component descriptions -->

## Component Details
<!-- Detailed design for each component -->

## Data Models
<!-- Entity definitions, schemas -->

## Error Handling
<!-- Error handling strategy -->

## Testing Strategy
<!-- Testing approach -->
```

**Best Practices**:
- Include Mermaid diagrams for architecture
- Provide code examples for key components
- Show data model structures (JSON, SQL, etc.)
- Explain design decisions
- Include technology choices with placeholders
- Add comments for customization points

### tasks.md

**Structure**:
```markdown
# Implementation Plan: {{SPEC_NAME_TITLE}}

## Overview
<!-- Brief description of implementation approach -->

## Tasks

### Phase 1: [Phase Name]

- [ ] 1. Task name
  - Subtask 1
  - Subtask 2
  - _Requirements: Requirement X_

- [ ] 2. Task name
  - Subtask 1
  - _Requirements: Requirement Y_

### Phase 2: [Phase Name]
...

## Notes
<!-- Implementation notes and tips -->
```

**Best Practices**:
- Break down into logical phases
- Use checkbox format: `- [ ]`
- Include requirement traceability: `_Requirements: Requirement X_`
- Order tasks by dependencies
- Keep tasks focused and testable
- Add implementation notes

## Placeholder Variables

Use these variables for automatic substitution:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{SPEC_NAME}}` | Spec name (kebab-case) | `user-authentication` |
| `{{SPEC_NAME_TITLE}}` | Spec name (Title Case) | `User Authentication` |
| `{{DATE}}` | Current date | `2025-01-31` |
| `{{YEAR}}` | Current year | `2025` |
| `{{AUTHOR}}` | User's Git name | `John Doe` |
| `{{PROJECT_NAME}}` | Project name | `my-app` |

**Usage Example**:
```markdown
# Requirements Document: {{SPEC_NAME_TITLE}}

This Spec defines the {{SPEC_NAME}} feature...

**Created**: {{DATE}}  
**Author**: {{AUTHOR}}
```

## Quality Standards

### Completeness Checklist

- [ ] All three files present (requirements.md, design.md, tasks.md)
- [ ] Valid YAML frontmatter in each file
- [ ] All required frontmatter fields present
- [ ] Follows standard Spec document structure
- [ ] Includes guidance comments
- [ ] Includes example content
- [ ] Uses placeholder variables appropriately
- [ ] No project-specific details (company names, URLs)
- [ ] No sensitive information (API keys, passwords)

### Content Quality

- [ ] Clear and concise writing
- [ ] Proper grammar and spelling
- [ ] Consistent terminology
- [ ] Logical organization
- [ ] Helpful examples
- [ ] Actionable guidance

### Technical Quality

- [ ] Based on real project experience
- [ ] Follows best practices
- [ ] Includes error handling
- [ ] Considers security
- [ ] Addresses performance
- [ ] Includes testing strategy

## Testing Your Template

### 1. Validate Structure

```bash
# Ensure all three files exist
ls category/template-name/
# Should show: requirements.md design.md tasks.md
```

### 2. Validate Frontmatter

Check that YAML frontmatter is valid:
- Starts and ends with `---`
- Proper YAML syntax
- All required fields present
- Correct data types (strings, arrays, etc.)

### 3. Test Template Application

Create a real Spec from your template:

```bash
# Add your template to local test repository
# Then test it
kse spec create test-feature --template category/template-name
```

Verify:
- All files created correctly
- Variables replaced properly
- Frontmatter removed
- Content makes sense
- No broken links or references

### 4. Review Content

- Read through all three files
- Ensure guidance is clear
- Check for typos and errors
- Verify examples are correct
- Test any code snippets

## Submission Process

### 1. Prepare Your Template

- Create template in appropriate category directory
- Ensure all quality standards met
- Test template thoroughly

### 2. Update Registry

Add entry to `template-registry.json`:

```json
{
  "id": "category/template-name",
  "name": "Template Display Name",
  "category": "category",
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
  "created_at": "2025-01-31",
  "updated_at": "2025-01-31"
}
```

### 3. Update README

Add your template to the README.md template list:

```markdown
### Category Name
- `template-name` - Brief description
```

### 4. Submit Pull Request

1. Fork the repository
2. Create a new branch: `git checkout -b add-template-name`
3. Add your template files
4. Update template-registry.json
5. Update README.md
6. Commit changes: `git commit -m "Add template: category/template-name"`
7. Push to your fork: `git push origin add-template-name`
8. Create Pull Request on GitHub

### 5. PR Description

Include in your PR description:

```markdown
## Template Submission

**Template**: category/template-name
**Category**: category
**Difficulty**: intermediate

### Description
[Brief description of what this template is for]

### Applicable Scenarios
- Scenario 1
- Scenario 2

### Testing
- [ ] Created Spec from template successfully
- [ ] Variables replaced correctly
- [ ] All files valid
- [ ] Content reviewed

### Checklist
- [ ] All three files present
- [ ] Valid YAML frontmatter
- [ ] Follows structure guidelines
- [ ] Includes guidance comments
- [ ] Tested with real Spec creation
- [ ] Registry updated
- [ ] README updated
```

## Tips for Great Templates

### 1. Be Specific

Focus on a specific, well-defined use case rather than trying to cover everything.

❌ Bad: "API Template" (too generic)  
✅ Good: "REST API with JWT Authentication" (specific)

### 2. Be Practical

Base templates on actual project experience, not theoretical ideals.

### 3. Be Clear

Use simple language and clear examples. Avoid jargon unless defined in glossary.

### 4. Be Complete

Don't leave critical sections empty. Provide examples or guidance for every section.

### 5. Be Helpful

Include comments explaining how to fill each section and what to consider.

## Common Mistakes to Avoid

❌ **Too Generic**: Template tries to cover too many use cases  
✅ **Focused**: Template addresses specific, common scenario

❌ **Too Specific**: Template includes project-specific details  
✅ **Reusable**: Template uses placeholders and generic examples

❌ **No Guidance**: Template is just empty structure  
✅ **Helpful**: Template includes comments and examples

❌ **Untested**: Template never used in real project  
✅ **Validated**: Template based on actual project experience

❌ **Incomplete**: Missing sections or files  
✅ **Complete**: All sections filled with guidance or examples

## Getting Help

- **Questions**: Open an issue in the repository
- **Examples**: Review existing templates
- **Discussion**: Join community discussions
- **Feedback**: Request review before submitting

---

**Last Updated**: 2025-01-31  
**Version**: 1.0.0
