/**
 * ContentGeneralizer - Replaces project-specific content with template variables
 */

class ContentGeneralizer {
  constructor() {
    this.patterns = this.definePatterns();
  }

  /**
   * Defines generalization patterns
   * @returns {Object} Pattern definitions
   */
  definePatterns() {
    return {
      // Spec name patterns (will be customized per Spec)
      SPEC_NAME: {
        variable: '{{SPEC_NAME}}',
        priority: 1
      },
      SPEC_NAME_TITLE: {
        variable: '{{SPEC_NAME_TITLE}}',
        priority: 2
      },
      // Date patterns
      DATE: {
        pattern: /\b\d{4}-\d{2}-\d{2}\b/g,
        variable: '{{DATE}}',
        priority: 3
      },
      // Version patterns (in context)
      VERSION: {
        pattern: /\bv?\d+\.\d+\.\d+\b/g,
        variable: '{{VERSION}}',
        priority: 4,
        contextKeywords: ['version', 'release', 'v']
      }
    };
  }

  /**
   * Generalizes Spec content
   * @param {Object} fileContents - Original file contents
   * @param {Object} specMetadata - Spec metadata
   * @returns {Object} Generalized content and flags
   */
  generalize(fileContents, specMetadata) {
    const replacements = this.buildReplacementMap(specMetadata);
    const result = {
      files: {},
      summary: {
        totalReplacements: 0,
        totalFlags: 0
      }
    };

    for (const [filename, content] of Object.entries(fileContents)) {
      if (!content) {
        result.files[filename] = {
          original: content,
          generalized: content,
          replacements: [],
          flags: []
        };
        continue;
      }

      const { generalized, replacementList } = this.applyPatterns(content, replacements);
      const flags = this.detectAmbiguousContent(generalized);

      result.files[filename] = {
        original: content,
        generalized,
        replacements: replacementList,
        flags
      };

      result.summary.totalReplacements += replacementList.reduce((sum, r) => sum + r.count, 0);
      result.summary.totalFlags += flags.length;
    }

    return result;
  }

  /**
   * Builds replacement map from Spec metadata
   * @param {Object} specMetadata - Spec metadata
   * @returns {Array} Replacement patterns
   */
  buildReplacementMap(specMetadata) {
    const replacements = [];

    // Spec name replacements (most specific first)
    if (specMetadata.fullDirName) {
      replacements.push({
        pattern: new RegExp(this.escapeRegex(specMetadata.fullDirName), 'g'),
        variable: '{{SPEC_NAME}}',
        priority: 1,
        description: 'Full directory name'
      });
    }

    if (specMetadata.specName) {
      replacements.push({
        pattern: new RegExp(this.escapeRegex(specMetadata.specName), 'g'),
        variable: '{{SPEC_NAME}}',
        priority: 1,
        description: 'Kebab-case name'
      });
    }

    if (specMetadata.specNameTitle) {
      replacements.push({
        pattern: new RegExp(this.escapeRegex(specMetadata.specNameTitle), 'g'),
        variable: '{{SPEC_NAME_TITLE}}',
        priority: 2,
        description: 'Title case name'
      });
    }

    // Date replacements
    if (specMetadata.dates) {
      if (specMetadata.dates.created) {
        replacements.push({
          pattern: new RegExp(this.escapeRegex(specMetadata.dates.created), 'g'),
          variable: '{{DATE}}',
          priority: 3,
          description: 'Creation date'
        });
      }
      if (specMetadata.dates.modified && specMetadata.dates.modified !== specMetadata.dates.created) {
        replacements.push({
          pattern: new RegExp(this.escapeRegex(specMetadata.dates.modified), 'g'),
          variable: '{{DATE}}',
          priority: 3,
          description: 'Modified date'
        });
      }
    }

    // Author replacement
    if (specMetadata.author && specMetadata.author !== 'Unknown') {
      replacements.push({
        pattern: new RegExp(this.escapeRegex(specMetadata.author), 'g'),
        variable: '{{AUTHOR}}',
        priority: 4,
        description: 'Author name'
      });
    }

    // Path replacements
    if (specMetadata.specPath) {
      replacements.push({
        pattern: new RegExp(this.escapeRegex(specMetadata.specPath), 'g'),
        variable: '.sce/specs/{{SPEC_NAME}}',
        priority: 5,
        description: 'Spec path'
      });
    }

    // Sort by priority
    return replacements.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Applies generalization patterns to text
   * @param {string} content - Original content
   * @param {Array} replacements - Replacement patterns
   * @returns {Object} Generalized content and matches
   */
  applyPatterns(content, replacements) {
    let generalized = content;
    const replacementList = [];

    for (const replacement of replacements) {
      const matches = content.match(replacement.pattern);
      if (matches && matches.length > 0) {
        generalized = generalized.replace(replacement.pattern, replacement.variable);
        replacementList.push({
          pattern: replacement.description || replacement.pattern.toString(),
          variable: replacement.variable,
          count: matches.length
        });
      }
    }

    return { generalized, replacementList };
  }

  /**
   * Detects ambiguous content that needs review
   * @param {string} content - Content to analyze
   * @returns {Array} Flagged items
   */
  detectAmbiguousContent(content) {
    const flags = [];
    const lines = content.split('\n');

    // Patterns for ambiguous content
    const ambiguousPatterns = [
      {
        pattern: /\b[A-Z][a-z]+\s+(?:Corp|Inc|LLC|Ltd|Company)\b/g,
        severity: 'warning',
        message: 'Possible company name detected'
      },
      {
        pattern: /https?:\/\/(?!github\.com|npmjs\.com)[^\s]+/g,
        severity: 'info',
        message: 'Specific URL detected (not GitHub/npm)'
      },
      {
        pattern: /\b(?:API_KEY|SECRET|PASSWORD|TOKEN)\s*[:=]\s*['"][^'"]+['"]/g,
        severity: 'warning',
        message: 'Hardcoded credential detected'
      }
    ];

    lines.forEach((line, index) => {
      ambiguousPatterns.forEach(({ pattern, severity, message }) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            flags.push({
              line: index + 1,
              content: match,
              severity,
              message
            });
          });
        }
      });
    });

    return flags;
  }

  /**
   * Escapes special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = ContentGeneralizer;
