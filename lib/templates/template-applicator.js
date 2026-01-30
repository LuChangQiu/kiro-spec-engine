/**
 * TemplateApplicator - Applies templates to create new Specs
 * 
 * Handles file copying, variable substitution, and frontmatter removal.
 */

const fs = require('fs-extra');
const path = require('path');
const { FileSystemError } = require('./template-error');

class TemplateApplicator {
  constructor() {
    this.requiredFiles = ['requirements.md', 'design.md', 'tasks.md'];
  }

  /**
   * Applies a template to create a new Spec
   * 
   * @param {string} specName - Spec name (e.g., 'user-authentication')
   * @param {string} templatePath - Path to template directory
   * @param {string} targetDir - Target Spec directory
   * @param {Object} options - Application options
   * @param {boolean} options.force - Overwrite existing files
   * @param {Object} options.variables - Custom variables
   * @returns {Promise<Object>} Application result
   */
  async applyTemplate(specName, templatePath, targetDir, options = {}) {
    const { force = false, variables = {} } = options;

    const result = {
      success: true,
      filesCreated: [],
      filesSkipped: [],
      errors: []
    };

    // Check if template exists
    if (!await fs.pathExists(templatePath)) {
      throw new FileSystemError(
        'Template directory does not exist',
        { templatePath }
      );
    }

    // Check if target directory exists
    if (await fs.pathExists(targetDir) && !force) {
      throw new FileSystemError(
        'Target directory already exists',
        {
          targetDir,
          suggestion: 'Use --force to overwrite or choose a different name'
        }
      );
    }

    // Create target directory
    await fs.ensureDir(targetDir);

    // Prepare variables
    const allVariables = this._prepareVariables(specName, variables);

    // Copy and transform files
    for (const file of this.requiredFiles) {
      const sourcePath = path.join(templatePath, file);
      const targetPath = path.join(targetDir, file);

      if (!await fs.pathExists(sourcePath)) {
        result.errors.push(`Template missing file: ${file}`);
        continue;
      }

      try {
        // Read source file
        let content = await fs.readFile(sourcePath, 'utf8');

        // Remove frontmatter
        content = this.removeFrontmatter(content);

        // Transform variables
        content = this.transformVariables(content, allVariables);

        // Normalize line endings
        content = this.normalizeLineEndings(content);

        // Write target file
        await fs.writeFile(targetPath, content, 'utf8');

        result.filesCreated.push(file);
      } catch (error) {
        result.errors.push(`Failed to process ${file}: ${error.message}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Prepares variables for substitution
   * 
   * @param {string} specName - Spec name
   * @param {Object} customVariables - Custom variables
   * @returns {Object} All variables
   * @private
   */
  _prepareVariables(specName, customVariables = {}) {
    const now = new Date();
    
    // Convert kebab-case to Title Case (preserve hyphens for numbers)
    const specNameTitle = specName
      .split('-')
      .map(word => {
        // If word is all digits, keep it as is
        if (/^\d+$/.test(word)) {
          return word;
        }
        // Otherwise capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');

    const defaultVariables = {
      SPEC_NAME: specName,
      SPEC_NAME_TITLE: specNameTitle,
      DATE: now.toISOString().split('T')[0],
      YEAR: now.getFullYear().toString(),
      AUTHOR: this._getAuthorName(),
      PROJECT_NAME: this._getProjectName()
    };

    return { ...defaultVariables, ...customVariables };
  }

  /**
   * Gets author name from Git config
   * 
   * @returns {string} Author name
   * @private
   */
  _getAuthorName() {
    try {
      const { execSync } = require('child_process');
      const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
      return name || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Gets project name from package.json or directory
   * 
   * @returns {string} Project name
   * @private
   */
  _getProjectName() {
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = require(packagePath);
        return pkg.name || path.basename(process.cwd());
      }
    } catch (error) {
      // Ignore
    }
    
    return path.basename(process.cwd());
  }

  /**
   * Removes YAML frontmatter from content
   * 
   * @param {string} content - File content
   * @returns {string} Content without frontmatter
   */
  removeFrontmatter(content) {
    // Normalize line endings first
    const normalized = content.replace(/\r\n/g, '\n');
    // Remove frontmatter
    return normalized.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  /**
   * Transforms variables in content
   * 
   * @param {string} content - File content
   * @param {Object} variables - Variables to substitute
   * @returns {string} Transformed content
   */
  transformVariables(content, variables) {
    let result = content;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.split(placeholder).join(value);
    }

    return result;
  }

  /**
   * Normalizes line endings to LF
   * 
   * @param {string} content - File content
   * @returns {string} Content with LF line endings
   */
  normalizeLineEndings(content) {
    return content.replace(/\r\n/g, '\n');
  }

  /**
   * Handles file conflict
   * 
   * @param {string} targetPath - Target file path
   * @param {string} strategy - Conflict strategy ('overwrite', 'skip', 'rename')
   * @returns {Promise<string>} Resolved target path
   */
  async handleConflict(targetPath, strategy = 'skip') {
    if (!await fs.pathExists(targetPath)) {
      return targetPath;
    }

    switch (strategy) {
      case 'overwrite':
        return targetPath;
      
      case 'skip':
        return null;
      
      case 'rename':
        let counter = 1;
        let newPath = targetPath;
        const ext = path.extname(targetPath);
        const base = targetPath.slice(0, -ext.length);
        
        while (await fs.pathExists(newPath)) {
          newPath = `${base}-${counter}${ext}`;
          counter++;
        }
        
        return newPath;
      
      default:
        return targetPath;
    }
  }
}

module.exports = TemplateApplicator;
