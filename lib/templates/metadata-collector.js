/**
 * MetadataCollector - Collects template metadata through interactive prompts
 */

const inquirer = require('inquirer');
const { execSync } = require('child_process');

class MetadataCollector {
  constructor(options = {}) {
    this.interactive = options.interactive !== false;
    this.categories = [
      'web-features',
      'backend-features',
      'infrastructure',
      'testing',
      'documentation',
      'other'
    ];
  }

  /**
   * Collects all template metadata
   * @param {Object} specMetadata - Extracted Spec metadata
   * @param {boolean} interactive - Use interactive prompts
   * @returns {Promise<Object>} Template metadata
   */
  async collectMetadata(specMetadata, interactive = this.interactive) {
    if (!interactive) {
      return this.getDefaultMetadata(specMetadata);
    }

    const metadata = {};

    // Template name
    metadata.name = await this.promptTemplateName(specMetadata.specName);

    // Description
    metadata.description = await this.promptDescription();

    // Category
    metadata.category = await this.promptCategory();

    // Tags
    const suggestedTags = this.suggestTags({ 'requirements.md': '' });
    metadata.tags = await this.promptTags(suggestedTags);

    // Author
    metadata.author = await this.promptAuthor(specMetadata.author);

    // Version
    metadata.version = await this.promptVersion();

    // KSE version
    metadata.kse_version = await this.promptKseVersion();

    // Timestamps
    const now = new Date().toISOString().split('T')[0];
    metadata.created_at = now;
    metadata.updated_at = now;

    // Validate and confirm
    const validation = this.validateMetadata(metadata);
    if (!validation.valid) {
      throw new Error(`Metadata validation failed: ${validation.errors.join(', ')}`);
    }

    console.log('\n📋 Metadata Summary:');
    console.log(JSON.stringify(metadata, null, 2));

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Confirm metadata?',
        default: true
      }
    ]);

    if (!confirmed) {
      throw new Error('Metadata collection cancelled by user');
    }

    return metadata;
  }

  /**
   * Prompts for template name
   * @param {string} defaultName - Default name
   * @returns {Promise<string>} Template name
   */
  async promptTemplateName(defaultName) {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Template name (kebab-case):',
        default: defaultName,
        validate: (input) => {
          if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input)) {
            return 'Name must be in kebab-case format (lowercase, hyphens only)';
          }
          return true;
        }
      }
    ]);
    return name;
  }

  /**
   * Prompts for description
   * @returns {Promise<string>} Description
   */
  async promptDescription() {
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Brief description (1-2 sentences):',
        validate: (input) => {
          if (input.length < 10) {
            return 'Description must be at least 10 characters';
          }
          if (input.length > 200) {
            return 'Description must be less than 200 characters';
          }
          return true;
        }
      }
    ]);
    return description;
  }

  /**
   * Prompts for category
   * @returns {Promise<string>} Selected category
   */
  async promptCategory() {
    const { category } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Select category:',
        choices: this.categories
      }
    ]);
    return category;
  }

  /**
   * Prompts for tags
   * @param {Array} suggestedTags - Suggested tags
   * @returns {Promise<Array>} Tags
   */
  async promptTags(suggestedTags = []) {
    const suggestionText = suggestedTags.length > 0 
      ? ` (suggested: ${suggestedTags.join(', ')})`
      : '';
    
    const { tagsInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tagsInput',
        message: `Tags (comma-separated)${suggestionText}:`,
        default: suggestedTags.join(', ')
      }
    ]);

    return tagsInput
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
  }

  /**
   * Prompts for author
   * @param {string} defaultAuthor - Default author
   * @returns {Promise<string>} Author name
   */
  async promptAuthor(defaultAuthor) {
    const { author } = await inquirer.prompt([
      {
        type: 'input',
        name: 'author',
        message: 'Author name:',
        default: defaultAuthor || this.getGitUser()
      }
    ]);
    return author;
  }

  /**
   * Prompts for version
   * @returns {Promise<string>} Version
   */
  async promptVersion() {
    const { version } = await inquirer.prompt([
      {
        type: 'input',
        name: 'version',
        message: 'Template version:',
        default: '1.0.0',
        validate: (input) => {
          if (!/^\d+\.\d+\.\d+$/.test(input)) {
            return 'Version must follow semver format (e.g., 1.0.0)';
          }
          return true;
        }
      }
    ]);
    return version;
  }

  /**
   * Prompts for KSE version
   * @returns {Promise<string>} KSE version
   */
  async promptKseVersion() {
    const currentVersion = this.getCurrentKseVersion();
    const { kseVersion } = await inquirer.prompt([
      {
        type: 'input',
        name: 'kseVersion',
        message: 'Minimum KSE version required:',
        default: currentVersion
      }
    ]);
    return kseVersion;
  }

  /**
   * Validates metadata completeness
   * @param {Object} metadata - Collected metadata
   * @returns {Object} Validation result
   */
  validateMetadata(metadata) {
    const errors = [];
    const requiredFields = ['name', 'description', 'category', 'tags', 'author', 'version', 'kse_version'];

    for (const field of requiredFields) {
      if (!metadata[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate kebab-case name
    if (metadata.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(metadata.name)) {
      errors.push('Name must be in kebab-case format');
    }

    // Validate semver version
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push('Version must follow semver format');
    }

    // Validate category
    if (metadata.category && !this.categories.includes(metadata.category)) {
      errors.push(`Category must be one of: ${this.categories.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Suggests tags based on content analysis
   * @param {Object} fileContents - Spec file contents
   * @returns {Array} Suggested tags
   */
  suggestTags(fileContents) {
    const allContent = Object.values(fileContents).join(' ').toLowerCase();
    const keywords = [
      'api', 'rest', 'graphql', 'database', 'authentication', 'authorization',
      'testing', 'deployment', 'ci/cd', 'monitoring', 'logging', 'caching',
      'frontend', 'backend', 'cli', 'template', 'automation', 'integration'
    ];

    return keywords.filter(keyword => allContent.includes(keyword)).slice(0, 5);
  }

  /**
   * Gets default metadata (non-interactive mode)
   * @param {Object} specMetadata - Spec metadata
   * @returns {Object} Default metadata
   */
  getDefaultMetadata(specMetadata) {
    const now = new Date().toISOString().split('T')[0];
    return {
      name: specMetadata.specName,
      description: `Template for ${specMetadata.specNameTitle}`,
      category: 'other',
      tags: [],
      author: specMetadata.author || this.getGitUser(),
      version: '1.0.0',
      kse_version: this.getCurrentKseVersion(),
      created_at: now,
      updated_at: now
    };
  }

  /**
   * Gets git user name
   * @returns {string} Git user name
   */
  getGitUser() {
    try {
      return execSync('git config user.name', { encoding: 'utf-8' }).trim();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Gets current KSE version
   * @returns {string} KSE version
   */
  getCurrentKseVersion() {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version;
    } catch {
      return '1.0.0';
    }
  }
}

module.exports = MetadataCollector;
