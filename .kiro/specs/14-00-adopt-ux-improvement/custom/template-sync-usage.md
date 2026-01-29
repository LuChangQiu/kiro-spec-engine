# Template Sync System - Usage Examples

This document provides examples of how to use the Template Sync System.

## Overview

The Template Sync System automatically synchronizes template files with project files, detecting content differences and updating only changed files while preserving user-specific content.

## Basic Usage

### Detect Template Differences

```javascript
const TemplateSync = require('./lib/adoption/template-sync');

const templateSync = new TemplateSync();
const projectPath = '/path/to/project';
const templatePath = '/path/to/templates';

// Detect differences
const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);

console.log('Template Sync Report:');
console.log(`  Total templates: ${report.summary.total}`);
console.log(`  Needs sync: ${report.summary.needsSync}`);
console.log(`  Missing: ${report.summary.missing}`);
console.log(`  Different: ${report.summary.different}`);
console.log(`  Up-to-date: ${report.summary.identical}`);
console.log(`  Preserved: ${report.summary.preserved}`);
```

### Sync Templates

```javascript
// Sync templates to project
const result = await templateSync.syncTemplates(projectPath, templatePath);

console.log('Sync Complete:');
console.log(`  Synced: ${result.summary.synced} files`);
console.log(`  Created: ${result.summary.created} files`);
console.log(`  Updated: ${result.summary.updated} files`);
console.log(`  Errors: ${result.summary.errors}`);
```

### Dry Run Mode

```javascript
// Preview changes without executing
const result = await templateSync.syncTemplates(projectPath, templatePath, {
  dryRun: true
});

console.log('Dry Run - No changes made');
console.log(`Files that would be synced: ${result.report.summary.needsSync}`);
```

### Progress Callback

```javascript
// Monitor sync progress
const result = await templateSync.syncTemplates(projectPath, templatePath, {
  onProgress: (update) => {
    console.log(`[${update.type}] ${update.file}: ${update.status}`);
    if (update.error) {
      console.error(`  Error: ${update.error}`);
    }
  }
});
```

## Advanced Usage

### Custom Template Files

```javascript
const templateSync = new TemplateSync();

// Add custom template file
templateSync.addTemplateFile('custom/my-template.md');

// Remove template file
templateSync.removeTemplateFile('custom/my-template.md');

// Get all template files
const files = templateSync.getTemplateFiles();
console.log('Template files:', files);
```

### Custom Preserved Files

```javascript
// Add file to preserve list
templateSync.addPreservedFile('custom/user-config.json');

// Remove from preserve list
templateSync.removePreservedFile('custom/user-config.json');

// Get all preserved files
const preserved = templateSync.getPreservedFiles();
console.log('Preserved files:', preserved);
```

### File Comparison

```javascript
// Compare two files
const file1 = '/path/to/file1.md';
const file2 = '/path/to/file2.md';

const isDifferent = await templateSync.compareFiles(file1, file2);
console.log(`Files are ${isDifferent ? 'different' : 'identical'}`);
```

### Check if File is Binary

```javascript
const filePath = '/path/to/file.bin';
const isBinary = await templateSync.isBinaryFile(filePath);
console.log(`File is ${isBinary ? 'binary' : 'text'}`);
```

## Report Formatting

### Format Sync Report

```javascript
const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);
const formatted = templateSync.formatSyncReport(report);
console.log(formatted);
```

Output:
```
Template Sync Report:
  Total templates: 8
  Needs sync: 3
    Missing: 1
    Different: 2
  Up-to-date: 4
  Preserved: 1

Missing files:
  - steering/ENVIRONMENT.md

Different files:
  - steering/CORE_PRINCIPLES.md
  - tools/ultrawork_enhancer.py

Preserved files:
  - steering/CURRENT_CONTEXT.md (User-specific file)
```

### Format Sync Result

```javascript
const result = await templateSync.syncTemplates(projectPath, templatePath);
const formatted = templateSync.formatSyncResult(result);
console.log(formatted);
```

Output:
```
Template Sync Complete:
  Total: 3
  Synced: 3
    Created: 1
    Updated: 2
  Errors: 0

Synced files:
  ✨ steering/ENVIRONMENT.md (created)
  📝 steering/CORE_PRINCIPLES.md (updated)
  📝 tools/ultrawork_enhancer.py (updated)
```

## Integration Example

### Complete Adoption Flow

```javascript
const TemplateSync = require('./lib/adoption/template-sync');

async function adoptProject(projectPath, templatePath) {
  const templateSync = new TemplateSync();
  
  try {
    // Step 1: Detect differences
    console.log('📦 Analyzing template differences...');
    const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);
    
    if (report.summary.needsSync === 0) {
      console.log('✅ All templates are up-to-date!');
      return;
    }
    
    // Step 2: Show what will be synced
    console.log(templateSync.formatSyncReport(report));
    
    // Step 3: Sync templates with progress
    console.log('\n🚀 Syncing templates...');
    const result = await templateSync.syncTemplates(projectPath, templatePath, {
      onProgress: (update) => {
        if (update.status === 'complete') {
          const icon = update.type === 'create' ? '✨' : '📝';
          console.log(`  ${icon} ${update.file}`);
        } else if (update.status === 'error') {
          console.error(`  ❌ ${update.file}: ${update.error}`);
        }
      }
    });
    
    // Step 4: Show results
    console.log('\n' + templateSync.formatSyncResult(result));
    
    if (result.summary.errors > 0) {
      console.error('\n⚠️  Some files failed to sync. Please review errors above.');
      return false;
    }
    
    console.log('\n✅ Template sync completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Template sync failed:', error.message);
    return false;
  }
}

// Usage
adoptProject('/path/to/project', '/path/to/templates')
  .then(success => {
    if (success) {
      console.log('Project adoption complete!');
    } else {
      console.error('Project adoption failed!');
      process.exit(1);
    }
  });
```

## Key Features

### Automatic File Classification

The system automatically classifies files:
- **Template files**: Updated to latest version (with backup)
- **User content**: Always preserved
- **Config files**: Merged with updates
- **Generated files**: Skipped (can be regenerated)

### Special Handling

- **CURRENT_CONTEXT.md**: Always preserved (user-specific)
- **Binary files**: Detected and handled correctly
- **Line endings**: Normalized for comparison (CRLF vs LF)

### Error Handling

- Errors don't stop the entire sync process
- Each file error is captured and reported
- Sync continues with remaining files
- Detailed error messages for troubleshooting

## Best Practices

1. **Always use dry-run first** to preview changes
2. **Create backups** before syncing (handled by adoption system)
3. **Monitor progress** with callbacks for long operations
4. **Check errors** in the result and handle appropriately
5. **Preserve user content** by adding to preserve list

## Template Files List

Default template files synced:
- `steering/CORE_PRINCIPLES.md`
- `steering/ENVIRONMENT.md`
- `steering/RULES_GUIDE.md`
- `tools/ultrawork_enhancer.py`
- `README.md`
- `ultrawork-application-guide.md`
- `ultrawork-integration-summary.md`
- `sisyphus-deep-dive.md`

Default preserved files:
- `steering/CURRENT_CONTEXT.md` (user-specific context)

## Performance

The system is optimized for performance:
- **Content-based comparison**: Only syncs files with actual changes
- **Hash-based detection**: Fast file comparison using SHA-256
- **Selective operations**: Only processes files that need updates
- **Binary detection**: Efficient detection of binary vs text files

## Error Scenarios

### Template File Not Found

```javascript
// If template file doesn't exist, it's reported in errors
const report = await templateSync.detectTemplateDifferences(projectPath, templatePath);
if (report.summary.errors > 0) {
  console.error('Template errors:');
  report.differences.errors.forEach(err => {
    console.error(`  - ${err.path}: ${err.error}`);
  });
}
```

### Sync Failure

```javascript
// Sync errors are captured but don't throw
const result = await templateSync.syncTemplates(projectPath, templatePath);
if (result.summary.errors > 0) {
  console.error('Sync errors:');
  result.errors.forEach(err => {
    console.error(`  - ${err.path}: ${err.error}`);
  });
}
```

## Testing

The Template Sync System includes comprehensive unit tests covering:
- File difference detection
- File comparison (text and binary)
- Template synchronization
- Error handling
- Progress callbacks
- Dry-run mode
- File preservation
- Custom template management

Run tests:
```bash
npm test -- tests/unit/adoption/template-sync.test.js
```
