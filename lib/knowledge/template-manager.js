/**
 * Template Manager
 * Manages entry templates
 */

const fs = require('fs-extra');
const path = require('path');

class TemplateManager {
  constructor(knowledgePath) {
    this.knowledgePath = knowledgePath;
    this.templatesDir = path.join(knowledgePath, '.templates');
    this.builtInTemplatesDir = path.join(__dirname, 'templates');
  }
  
  /**
   * Get template by type
   * @param {string} type - Template type
   * @returns {string} - Template content
   */
  async getTemplate(type) {
    // Check custom template first
    const customPath = path.join(this.templatesDir, `${type}.md`);
    if (await fs.pathExists(customPath)) {
      return fs.readFile(customPath, 'utf-8');
    }
    
    // Fall back to built-in template
    return this.getDefaultTemplate(type);
  }
  
  /**
   * List available templates
   * @returns {Array} - Template names
   */
  async listTemplates() {
    const templates = ['pattern', 'lesson', 'workflow', 'checklist', 'reference'];
    
    // Check for custom templates
    if (await fs.pathExists(this.templatesDir)) {
      const files = await fs.readdir(this.templatesDir);
      const customTemplates = files
        .filter(f => f.endsWith('.md'))
        .map(f => path.basename(f, '.md'));
      
      return [...new Set([...templates, ...customTemplates])];
    }
    
    return templates;
  }
  
  /**
   * Get default built-in template
   * @param {string} type - Template type
   * @returns {string} - Template content
   */
  getDefaultTemplate(type) {
    const templates = {
      pattern: `## Context

Describe when and where this pattern applies.

## Problem

What problem does this pattern solve?

## Solution

How to implement this pattern.

## Examples

\`\`\`javascript
// Code example
\`\`\`

## Trade-offs

Advantages and disadvantages.

## References

- Related patterns
- External resources
`,
      
      lesson: `## Situation

What was the context or project?

## Challenge

What problem or challenge did you face?

## Action

What did you do to address it?

## Result

What was the outcome?

## Lesson Learned

What did you learn from this experience?

## Application

How can this lesson be applied in the future?
`,
      
      workflow: `## Purpose

What is this workflow for?

## Prerequisites

What needs to be in place before starting?

## Steps

1. First step
2. Second step
3. Third step

## Verification

How to verify the workflow completed successfully?

## Troubleshooting

Common issues and solutions.

## References

- Related workflows
- Documentation links
`,
      
      checklist: `## Purpose

What is this checklist for?

## Checklist Items

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

## Notes

Additional context or tips.

## References

- Related checklists
- Documentation
`,
      
      reference: `## Overview

Brief description of this reference.

## Key Information

Important details, links, or data.

## Usage

How to use this reference.

## Examples

Practical examples.

## Related

- Related references
- External links
`
    };
    
    if (!templates[type]) {
      throw new Error(`Unknown template type: ${type}`);
    }
    
    return templates[type];
  }
}

module.exports = TemplateManager;
