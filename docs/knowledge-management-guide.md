# Knowledge Management Guide

## Overview

The Knowledge Management system allows you to build and maintain a personal knowledge base within your sce projects. Capture experiences, patterns, best practices, and lessons learned as you work.

## Quick Start

### Initialize Knowledge Base

```bash
sce knowledge init
```

This creates `.kiro/knowledge/` directory with:
- `patterns/` - Design patterns and solutions
- `lessons/` - Lessons learned
- `workflows/` - Custom workflows
- `checklists/` - Task checklists
- `references/` - Reference materials

### Add Knowledge Entry

```bash
# Add a design pattern
sce knowledge add pattern "Repository Pattern Best Practices" \
  --tags "design-pattern,database" \
  --category backend

# Add a lesson learned
sce knowledge add lesson "Avoid N+1 Queries" \
  --tags "performance,database" \
  --category optimization
```

### List Entries

```bash
# List all entries
sce knowledge list

# Filter by type
sce knowledge list --type pattern

# Filter by tag
sce knowledge list --tag database

# Sort by date
sce knowledge list --sort created:desc
```

### Search

```bash
# Search in titles and tags
sce knowledge search "database"

# Full-text search in content
sce knowledge search "repository" --full-text
```

### View Entry

```bash
sce knowledge show kb-1770099318706-4dmali
```

### Delete Entry

```bash
# With confirmation
sce knowledge delete kb-xxx

# Skip confirmation
sce knowledge delete kb-xxx --force

# Without backup
sce knowledge delete kb-xxx --force --no-backup
```

### Statistics

```bash
sce knowledge stats
```

## Entry Types

### Pattern
Design patterns, architectural solutions, code patterns.

**Template sections**:
- Context - When to use
- Problem - What it solves
- Solution - How to implement
- Examples - Code examples
- Trade-offs - Pros and cons
- References - Related resources

### Lesson
Lessons learned from experience, mistakes, successes.

**Template sections**:
- Situation - Context
- Challenge - Problem faced
- Action - What you did
- Result - Outcome
- Lesson Learned - Key takeaway
- Application - Future use

### Workflow
Custom workflows, processes, procedures.

**Template sections**:
- Purpose - What it's for
- Prerequisites - Requirements
- Steps - Step-by-step guide
- Verification - How to verify
- Troubleshooting - Common issues
- References - Related docs

### Checklist
Task checklists, verification lists.

**Template sections**:
- Purpose - What it's for
- Checklist Items - Items to check
- Notes - Additional context
- References - Related resources

### Reference
Reference materials, links, documentation.

**Template sections**:
- Overview - Brief description
- Key Information - Important details
- Usage - How to use
- Examples - Practical examples
- Related - Related references

## Best Practices

### When to Add Knowledge

- ✅ After solving a difficult problem
- ✅ When discovering a useful pattern
- ✅ After making a mistake (lesson learned)
- ✅ When creating a reusable workflow
- ✅ When finding useful references

### Tagging Strategy

Use consistent, descriptive tags:
- **Technology**: `javascript`, `python`, `react`, `node`
- **Domain**: `backend`, `frontend`, `database`, `api`
- **Type**: `design-pattern`, `performance`, `security`, `testing`
- **Level**: `beginner`, `intermediate`, `advanced`

### Organization Tips

1. **Be Specific**: Clear, descriptive titles
2. **Add Context**: Explain when and why
3. **Include Examples**: Code snippets, screenshots
4. **Link Related**: Reference other entries
5. **Keep Updated**: Review and update periodically

## Advanced Usage

### Custom Templates

Create custom templates in `.kiro/knowledge/.templates/`:

```markdown
---
id: {{ID}}
type: custom-type
title: {{TITLE}}
created: {{DATE}}
updated: {{DATE}}
tags: []
status: active
---

## Your Custom Sections

Content here...
```

### Bulk Operations

```bash
# Export all entries
sce knowledge export --output my-knowledge.zip

# Import entries
sce knowledge import my-knowledge.zip
```

### Integration with Project

Knowledge entries can reference project files:

```markdown
## Related Code

See implementation in `lib/repository/user-repository.js`
```

## Troubleshooting

### Knowledge Base Not Found

```bash
Error: Knowledge base not initialized
```

**Solution**: Run `sce knowledge init`

### Entry Not Found

```bash
Error: Entry not found: kb-xxx
```

**Solution**: Check ID with `sce knowledge list`

### Corrupted Index

```bash
Error: Failed to load index
```

**Solution**: Rebuild index:
```bash
# Delete index.json
rm .kiro/knowledge/index.json

# Reinitialize
sce knowledge init
```

## FAQ

**Q: Where is knowledge stored?**  
A: In `.kiro/knowledge/` directory, organized by type.

**Q: Can I edit entries manually?**  
A: Yes, they're just Markdown files with YAML frontmatter.

**Q: How do I share knowledge with team?**  
A: Commit `.kiro/knowledge/` to git (except `.backups/`).

**Q: Can I use custom entry types?**  
A: Yes, create custom templates in `.kiro/knowledge/.templates/`.

**Q: How do I backup my knowledge?**  
A: Use `sce knowledge export` or commit to git.

## See Also

- [Command Reference](./command-reference.md)
- [Quick Start](./quick-start.md)
- [Spec Workflow](./spec-workflow.md)
