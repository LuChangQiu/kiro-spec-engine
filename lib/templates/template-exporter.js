/**
 * TemplateExporter - Exports template package to directory
 */

const fs = require('fs').promises;
const path = require('path');

class TemplateExporter {
  constructor() {
    this.defaultOutputDir = '.kiro/templates/exports';
  }

  /**
   * Exports template package
   * @param {Object} templateData - Template data
   * @param {string} outputDir - Output directory
   * @returns {Promise<Object>} Export result
   */
  async exportTemplate(templateData, outputDir) {
    const { metadata, files, validationResult } = templateData;
    const templateDir = outputDir || path.join(this.defaultOutputDir, metadata.name);

    try {
      // Create output directory
      await this.createOutputDirectory(templateDir);

      // Write template files
      const writtenFiles = await this.writeTemplateFiles(files, templateDir);

      // Generate registry entry
      const registryEntry = this.generateRegistryEntry(metadata);
      await fs.writeFile(
        path.join(templateDir, 'template-registry.json'),
        JSON.stringify(registryEntry, null, 2),
        'utf-8'
      );
      writtenFiles.push('template-registry.json');

      // Generate documentation files
      const submissionGuide = this.generateSubmissionGuide(metadata);
      await fs.writeFile(
        path.join(templateDir, 'SUBMISSION_GUIDE.md'),
        submissionGuide,
        'utf-8'
      );
      writtenFiles.push('SUBMISSION_GUIDE.md');

      const prDescription = this.generatePRDescription(metadata);
      await fs.writeFile(
        path.join(templateDir, 'PR_DESCRIPTION.md'),
        prDescription,
        'utf-8'
      );
      writtenFiles.push('PR_DESCRIPTION.md');

      const reviewChecklist = this.generateReviewChecklist(validationResult);
      await fs.writeFile(
        path.join(templateDir, 'REVIEW_CHECKLIST.md'),
        reviewChecklist,
        'utf-8'
      );
      writtenFiles.push('REVIEW_CHECKLIST.md');

      const usageExample = this.generateUsageExample(metadata);
      await fs.writeFile(
        path.join(templateDir, 'USAGE_EXAMPLE.md'),
        usageExample,
        'utf-8'
      );
      writtenFiles.push('USAGE_EXAMPLE.md');

      // Log creation
      await this.logCreation(templateDir, templateData);
      writtenFiles.push('creation.log');

      return {
        success: true,
        outputDir: templateDir,
        filesCreated: writtenFiles,
        validation: validationResult,
        metadata
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await fs.rm(templateDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Creates output directory structure
   * @param {string} outputDir - Output directory
   * @returns {Promise<void>}
   */
  async createOutputDirectory(outputDir) {
    try {
      await fs.access(outputDir);
      // Directory exists, ask user (for now, just overwrite)
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    await fs.mkdir(outputDir, { recursive: true });
  }

  /**
   * Writes template files
   * @param {Object} fileContents - File contents
   * @param {string} outputDir - Output directory
   * @returns {Promise<Array>} Written files
   */
  async writeTemplateFiles(fileContents, outputDir) {
    const writtenFiles = [];

    for (const [filename, content] of Object.entries(fileContents)) {
      if (content) {
        const filePath = path.join(outputDir, filename);
        await fs.writeFile(filePath, content, 'utf-8');
        writtenFiles.push(filename);
      }
    }

    return writtenFiles;
  }

  /**
   * Generates registry entry
   * @param {Object} metadata - Template metadata
   * @returns {Object} Registry entry
   */
  generateRegistryEntry(metadata) {
    return {
      name: metadata.name,
      category: metadata.category,
      description: metadata.description,
      tags: metadata.tags || [],
      author: metadata.author,
      version: metadata.version,
      kse_version: metadata.kse_version,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      path: `${metadata.category}/${metadata.name}`
    };
  }

  /**
   * Generates submission guide
   * @param {Object} metadata - Template metadata
   * @returns {string} Submission guide content
   */
  generateSubmissionGuide(metadata) {
    return `# Template Submission Guide

## Template: ${metadata.name}

Congratulations! Your template has been generated successfully. Follow these steps to submit it to the scene-capability-engine-templates repository.

## Next Steps

### 1. Review the Template

- Check \`requirements.md\`, \`design.md\`, and \`tasks.md\` for accuracy
- Verify that all project-specific content has been replaced with template variables
- Review \`REVIEW_CHECKLIST.md\` for a complete list of items to verify

### 2. Test the Template

Test your template locally before submitting:

\`\`\`bash
# Apply the template to create a new Spec
kse spec create test-spec --template ${metadata.name}

# Verify the generated Spec is correct
cd .kiro/specs/test-spec
# Check that variables were replaced correctly
\`\`\`

### 3. Submit to Repository

**Option A: Fork + Pull Request (Recommended)**

\`\`\`bash
# 1. Fork the scene-capability-engine-templates repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/scene-capability-engine-templates.git
cd scene-capability-engine-templates

# 3. Create a branch
git checkout -b add-${metadata.name}

# 4. Copy your template to the appropriate category directory
mkdir -p ${metadata.category}/${metadata.name}
cp /path/to/this/template/* ${metadata.category}/${metadata.name}/

# 5. Update template-registry.json
# Add the entry from template-registry.json in this directory

# 6. Commit and push
git add .
git commit -m "feat: add ${metadata.name} template"
git push origin add-${metadata.name}

# 7. Create Pull Request on GitHub
# Use the content from PR_DESCRIPTION.md
\`\`\`

**Option B: Issue Submission (Simple)**

If you're not familiar with Git:

1. Go to https://github.com/heguangyong/scene-capability-engine-templates/issues
2. Create a new issue with title: \`[Template Submission] ${metadata.name}\`
3. Attach the template files or paste their contents
4. A maintainer will review and add your template

## Files in This Package

- \`requirements.md\` - Template requirements document
- \`design.md\` - Template design document
- \`tasks.md\` - Template tasks document
- \`template-registry.json\` - Registry entry for your template
- \`SUBMISSION_GUIDE.md\` - This file
- \`PR_DESCRIPTION.md\` - Draft PR description
- \`REVIEW_CHECKLIST.md\` - Items to verify before submission
- \`USAGE_EXAMPLE.md\` - How to use your template
- \`creation.log\` - Creation log for debugging

## Questions?

If you have questions about the submission process, please:
- Check the scene-capability-engine-templates repository README
- Open an issue in the repository
- Contact the maintainers

Thank you for contributing to the kse template library!
`;
  }

  /**
   * Generates PR description
   * @param {Object} metadata - Template metadata
   * @returns {string} PR description
   */
  generatePRDescription(metadata) {
    return `# Add ${metadata.name} Template

## Description

${metadata.description}

## Template Details

- **Name**: ${metadata.name}
- **Category**: ${metadata.category}
- **Tags**: ${metadata.tags.join(', ')}
- **Author**: ${metadata.author}
- **Version**: ${metadata.version}
- **Minimum KSE Version**: ${metadata.kse_version}

## Files Included

- \`requirements.md\` - Requirements document with YAML frontmatter
- \`design.md\` - Design document with YAML frontmatter
- \`tasks.md\` - Tasks document with YAML frontmatter

## Checklist

- [ ] Template files include valid YAML frontmatter
- [ ] All project-specific content replaced with template variables
- [ ] Template tested locally with \`kse spec create\`
- [ ] Template follows naming conventions (kebab-case)
- [ ] Description is clear and concise
- [ ] Tags are relevant and searchable
- [ ] Registry entry added to \`template-registry.json\`

## Testing

Tested locally by applying the template:

\`\`\`bash
kse spec create test-spec --template ${metadata.name}
\`\`\`

## Additional Notes

(Add any additional context or notes here)
`;
  }

  /**
   * Generates review checklist
   * @param {Object} validationResult - Validation result
   * @returns {string} Review checklist
   */
  generateReviewChecklist(validationResult) {
    const score = validationResult?.score || 0;
    const errors = validationResult?.errors || [];
    const warnings = validationResult?.warnings || [];

    return `# Template Review Checklist

## Validation Results

- **Quality Score**: ${score}/100
- **Errors**: ${errors.length}
- **Warnings**: ${warnings.length}

${errors.length > 0 ? `\n### Errors\n\n${errors.map(e => `- ❌ ${e}`).join('\n')}\n` : ''}
${warnings.length > 0 ? `\n### Warnings\n\n${warnings.map(w => `- ⚠️ ${w}`).join('\n')}\n` : ''}

## Manual Review Items

### Content Quality

- [ ] All project-specific names replaced with \`{{SPEC_NAME}}\`
- [ ] All dates replaced with \`{{DATE}}\`
- [ ] All author names replaced with \`{{AUTHOR}}\`
- [ ] All version numbers replaced with \`{{VERSION}}\` (where appropriate)
- [ ] No hardcoded paths or URLs (except examples)
- [ ] EARS patterns preserved correctly
- [ ] Requirement numbering is consistent

### Metadata Quality

- [ ] Template name is in kebab-case
- [ ] Description is clear and concise (1-2 sentences)
- [ ] Category is appropriate
- [ ] Tags are relevant and searchable
- [ ] Version follows semver format
- [ ] Author information is correct

### Structure Quality

- [ ] All three files present (requirements.md, design.md, tasks.md)
- [ ] YAML frontmatter is valid in all files
- [ ] Frontmatter includes all required fields
- [ ] Document structure is preserved
- [ ] Internal references are not broken

### Testing

- [ ] Template applied successfully with \`kse spec create\`
- [ ] Variables replaced correctly in generated Spec
- [ ] Generated Spec is usable and makes sense
- [ ] No errors during template application

### Documentation

- [ ] USAGE_EXAMPLE.md is clear and helpful
- [ ] All template variables are documented
- [ ] Prerequisites are listed (if any)
- [ ] Examples are provided

## Recommendations

${score >= 90 ? '✅ Template quality is excellent! Ready for submission.' : ''}
${score >= 70 && score < 90 ? '⚠️ Template quality is good, but consider addressing warnings before submission.' : ''}
${score < 70 ? '❌ Template quality needs improvement. Please address errors and warnings before submission.' : ''}

## Next Steps

1. Review and address any errors or warnings above
2. Complete the manual review checklist
3. Test the template locally
4. Follow the submission guide in SUBMISSION_GUIDE.md
`;
  }

  /**
   * Generates usage example
   * @param {Object} metadata - Template metadata
   * @returns {string} Usage example
   */
  generateUsageExample(metadata) {
    return `# Template Usage Example

## Template: ${metadata.name}

${metadata.description}

## How to Use This Template

### 1. List Available Templates

\`\`\`bash
kse templates list
\`\`\`

### 2. View Template Details

\`\`\`bash
kse templates show ${metadata.category}/${metadata.name}
\`\`\`

### 3. Create a New Spec from This Template

\`\`\`bash
kse spec create my-new-feature --template ${metadata.category}/${metadata.name}
\`\`\`

This will create a new Spec at \`.kiro/specs/XX-00-my-new-feature/\` with:
- \`requirements.md\` - Requirements document
- \`design.md\` - Design document
- \`tasks.md\` - Implementation tasks

### 4. Customize the Generated Spec

The template uses the following variables that will be replaced:

- \`{{SPEC_NAME}}\` - Your Spec name in kebab-case (e.g., \`my-new-feature\`)
- \`{{SPEC_NAME_TITLE}}\` - Your Spec name in Title Case (e.g., \`My New Feature\`)
- \`{{DATE}}\` - Current date in ISO format (e.g., \`2025-01-31\`)
- \`{{AUTHOR}}\` - Your name from git config
- \`{{VERSION}}\` - Version number (default: \`1.0.0\`)

## What This Template Provides

This template helps you create a Spec for:

${metadata.description}

## Prerequisites

- kse version ${metadata.kse_version} or higher
- Basic understanding of Spec-driven development

## Tags

${metadata.tags.map(tag => `- ${tag}`).join('\n')}

## Example Output

After applying this template, you'll have a complete Spec structure ready to customize for your specific needs.

## Questions?

If you have questions about using this template:
- Check the kse documentation
- Review the generated Spec files
- Open an issue in the scene-capability-engine-templates repository
`;
  }

  /**
   * Logs creation details
   * @param {string} outputDir - Output directory
   * @param {Object} templateData - Template data
   * @returns {Promise<void>}
   */
  async logCreation(outputDir, templateData) {
    const { metadata, validationResult, generalizationResult } = templateData;
    const timestamp = new Date().toISOString();

    const log = `# Template Creation Log

**Timestamp**: ${timestamp}
**Template Name**: ${metadata.name}
**Category**: ${metadata.category}
**Version**: ${metadata.version}

## Generalization Summary

- Total Replacements: ${generalizationResult?.summary?.totalReplacements || 0}
- Total Flags: ${generalizationResult?.summary?.totalFlags || 0}

## Validation Summary

- Quality Score: ${validationResult?.score || 0}/100
- Errors: ${validationResult?.errors?.length || 0}
- Warnings: ${validationResult?.warnings?.length || 0}

## Files Generated

- requirements.md
- design.md
- tasks.md
- template-registry.json
- SUBMISSION_GUIDE.md
- PR_DESCRIPTION.md
- REVIEW_CHECKLIST.md
- USAGE_EXAMPLE.md
- creation.log

## Status

${validationResult?.valid ? '✅ Template validation passed' : '❌ Template validation failed'}

---
Generated by kse templates create-from-spec
`;

    await fs.writeFile(path.join(outputDir, 'creation.log'), log, 'utf-8');
  }
}

module.exports = TemplateExporter;
