# Export Command - Design

> Technical design for kse export command

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

---

## Architecture

**Pattern:** Command Pattern  
**CLI Framework:** Commander.js  
**Markdown Processing:** marked library  
**File I/O:** Node.js fs/promises

---

## Component Design

### ExportCommand
**File:** `lib/commands/export.command.js`

**Responsibilities:**
- Parse command arguments
- Validate inputs
- Orchestrate export process
- Display results

**Methods:**
```javascript
class ExportCommand {
  async execute(specName, options) {
    // 1. Validate Spec exists
    // 2. Load Spec data
    // 3. Format based on options.format
    // 4. Write to file
    // 5. Display success message
  }
}
```

---

### ExportService
**File:** `lib/services/export.service.js`

**Responsibilities:**
- Load Spec files
- Format data for export
- Generate output files

**Methods:**
```javascript
class ExportService {
  async loadSpec(specName) {
    // Read requirements.md, design.md, tasks.md
    // Return { requirements, design, tasks, metadata }
  }

  async exportAsJSON(specData, outputPath) {
    // Format as JSON
    // Write to file
  }

  async exportAsMarkdown(specData, outputPath) {
    // Combine all documents
    // Add TOC
    // Write to file
  }

  async exportAsHTML(specData, outputPath) {
    // Convert Markdown to HTML
    // Add styling
    // Write to file
  }
}
```

---

## Command Registration

**File:** `bin/kiro-spec-engine.js`

```javascript
program
  .command('export <spec-name>')
  .description('Export Spec in various formats')
  .option('-f, --format <format>', 'Output format (json|md|html)', 'md')
  .option('-o, --output <path>', 'Output file path')
  .option('--include-meta', 'Include metadata', true)
  .action(async (specName, options) => {
    const command = new ExportCommand();
    await command.execute(specName, options);
  });
```

---

## Output Formats

### JSON Format
```json
{
  "name": "01-00-feature-name",
  "metadata": {
    "created": "2026-01-23T10:00:00Z",
    "version": "1.0.0"
  },
  "requirements": "# Requirements\n...",
  "design": "# Design\n...",
  "tasks": "# Tasks\n..."
}
```

### Markdown Format
```markdown
# Spec: 01-00-feature-name

**Exported:** 2026-01-23  
**Version:** 1.0.0

## Table of Contents
- [Requirements](#requirements)
- [Design](#design)
- [Tasks](#tasks)

---

## Requirements
[Content from requirements.md]

---

## Design
[Content from design.md]

---

## Tasks
[Content from tasks.md]
```

### HTML Format
```html
<!DOCTYPE html>
<html>
<head>
  <title>Spec: 01-00-feature-name</title>
  <style>/* Styling */</style>
</head>
<body>
  <h1>Spec: 01-00-feature-name</h1>
  <!-- Converted Markdown content -->
</body>
</html>
```

---

## Error Handling

```javascript
// Spec not found
throw new Error(`Spec "${specName}" not found in .kiro/specs/`);

// Invalid format
throw new Error(`Invalid format "${format}". Use: json, md, or html`);

// File write error
throw new Error(`Failed to write export file: ${error.message}`);
```

---

## Requirements Traceability

| Requirement | Component | Method |
|-------------|-----------|--------|
| US-1 | ExportService | exportAsJSON() |
| US-2 | ExportService | exportAsMarkdown() |
| US-3 | ExportService | exportAsHTML() |
| FR-1 | ExportCommand | execute() |
| FR-2 | ExportService | exportAsJSON() |
| FR-3 | ExportService | exportAsMarkdown() |
| FR-4 | ExportService | exportAsHTML() |

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
