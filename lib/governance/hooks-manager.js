/**
 * Hooks Manager
 * 
 * Manages Git hooks for document governance
 */

const fs = require('fs-extra');
const path = require('path');

class HooksManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.gitDir = path.join(projectPath, '.git');
    this.hooksDir = path.join(this.gitDir, 'hooks');
    this.preCommitPath = path.join(this.hooksDir, 'pre-commit');
    this.backupPath = path.join(this.hooksDir, 'pre-commit.backup');
    
    // Marker to identify our hook content
    this.hookMarkerStart = '# BEGIN scene-capability-engine document governance';
    this.hookMarkerEnd = '# END scene-capability-engine document governance';
  }
  
  /**
   * Check if Git hooks are installed
   * 
   * @returns {Promise<Object>}
   */
  async checkHooksInstalled() {
    try {
      // Check if .git directory exists
      if (!await fs.pathExists(this.gitDir)) {
        return {
          installed: false,
          reason: 'not_git_repo',
          message: 'Not a Git repository'
        };
      }
      
      // Check if hooks directory exists
      if (!await fs.pathExists(this.hooksDir)) {
        return {
          installed: false,
          reason: 'no_hooks_dir',
          message: 'Git hooks directory does not exist'
        };
      }
      
      // Check if pre-commit hook exists
      if (!await fs.pathExists(this.preCommitPath)) {
        return {
          installed: false,
          reason: 'no_hook',
          message: 'Pre-commit hook not installed'
        };
      }
      
      // Check if our hook content is present
      const content = await fs.readFile(this.preCommitPath, 'utf8');
      const hasOurHook = content.includes(this.hookMarkerStart);
      
      return {
        installed: hasOurHook,
        reason: hasOurHook ? 'installed' : 'other_hook',
        message: hasOurHook 
          ? 'Document governance hook is installed' 
          : 'Pre-commit hook exists but is not ours',
        hasExistingHook: !hasOurHook
      };
    } catch (error) {
      return {
        installed: false,
        reason: 'error',
        message: `Error checking hooks: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Install pre-commit hook
   * 
   * @returns {Promise<Object>}
   */
  async installHooks() {
    try {
      // Check if .git directory exists
      if (!await fs.pathExists(this.gitDir)) {
        return {
          success: false,
          reason: 'not_git_repo',
          message: 'Not a Git repository. Initialize Git first with: git init'
        };
      }
      
      // Create hooks directory if it doesn't exist
      if (!await fs.pathExists(this.hooksDir)) {
        await fs.ensureDir(this.hooksDir);
      }
      
      // Check if pre-commit hook already exists
      let existingContent = '';
      let hasExistingHook = false;
      
      if (await fs.pathExists(this.preCommitPath)) {
        existingContent = await fs.readFile(this.preCommitPath, 'utf8');
        
        // Check if our hook is already installed
        if (existingContent.includes(this.hookMarkerStart)) {
          return {
            success: true,
            reason: 'already_installed',
            message: 'Document governance hook is already installed'
          };
        }
        
        hasExistingHook = true;
        
        // Backup existing hook
        await fs.writeFile(this.backupPath, existingContent);
      }
      
      // Generate our hook content
      const ourHookContent = this.generateHookContent();
      
      // Combine with existing hook if present
      let finalContent;
      if (hasExistingHook) {
        // Preserve existing hook and add ours
        finalContent = this.combineHooks(existingContent, ourHookContent);
      } else {
        // Just use our hook with shebang
        finalContent = `#!/bin/sh\n\n${ourHookContent}`;
      }
      
      // Write the hook file
      await fs.writeFile(this.preCommitPath, finalContent);
      
      // Make it executable (Unix-like systems)
      if (process.platform !== 'win32') {
        await fs.chmod(this.preCommitPath, 0o755);
      }
      
      return {
        success: true,
        reason: hasExistingHook ? 'installed_with_preservation' : 'installed',
        message: hasExistingHook 
          ? 'Document governance hook installed. Existing hook preserved and backed up.'
          : 'Document governance hook installed successfully.',
        backupCreated: hasExistingHook
      };
    } catch (error) {
      return {
        success: false,
        reason: 'error',
        message: `Failed to install hooks: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Uninstall pre-commit hook
   * 
   * @returns {Promise<Object>}
   */
  async uninstallHooks() {
    try {
      // Check if hook exists
      if (!await fs.pathExists(this.preCommitPath)) {
        return {
          success: true,
          reason: 'not_installed',
          message: 'Document governance hook is not installed'
        };
      }
      
      // Read current hook content
      const content = await fs.readFile(this.preCommitPath, 'utf8');
      
      // Check if our hook is present
      if (!content.includes(this.hookMarkerStart)) {
        return {
          success: false,
          reason: 'not_our_hook',
          message: 'Pre-commit hook exists but is not ours. Manual removal required.'
        };
      }
      
      // Remove our hook content
      const newContent = this.removeOurHook(content);
      
      // If nothing left (or just shebang), remove the file
      const trimmedContent = newContent.trim();
      if (trimmedContent === '' || trimmedContent === '#!/bin/sh') {
        await fs.remove(this.preCommitPath);
        
        // Restore backup if it exists
        if (await fs.pathExists(this.backupPath)) {
          await fs.remove(this.backupPath);
        }
        
        return {
          success: true,
          reason: 'removed',
          message: 'Document governance hook removed successfully.'
        };
      } else {
        // Write back the remaining content
        await fs.writeFile(this.preCommitPath, newContent);
        
        return {
          success: true,
          reason: 'removed_preserved',
          message: 'Document governance hook removed. Other hooks preserved.'
        };
      }
    } catch (error) {
      return {
        success: false,
        reason: 'error',
        message: `Failed to uninstall hooks: ${error.message}`,
        error: error.message
      };
    }
  }
  
  /**
   * Generate hook content
   * 
   * @returns {string}
   */
  generateHookContent() {
    // Use Node.js to run validation
    // This works on both Windows and Unix-like systems
    return `${this.hookMarkerStart}

# Run document governance validation
node -e "
const path = require('path');
const ConfigManager = require('./lib/governance/config-manager');
const ValidationEngine = require('./lib/governance/validation-engine');

(async () => {
  try {
    const projectPath = process.cwd();
    const configManager = new ConfigManager(projectPath);
    const config = await configManager.load();
    const validator = new ValidationEngine(projectPath, config);
    
    // Validate root directory and all specs
    const report = await validator.validate({ all: true });
    
    if (!report.valid) {
      console.error('\\n❌ Document governance validation failed!\\n');
      console.error('Found ' + report.errors.length + ' error(s):\\n');
      
      report.errors.forEach(err => {
        console.error('  • ' + err.path);
        console.error('    ' + err.message);
        console.error('    → ' + err.recommendation + '\\n');
      });
      
      console.error('Fix these issues before committing:');
      console.error('  sce doctor --docs    # Diagnose issues');
      console.error('  sce cleanup          # Remove temporary files');
      console.error('  sce validate --all   # Validate structure\\n');
      
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running document validation:', error.message);
    // Don't block commit on validation errors
    process.exit(0);
  }
})();
"

${this.hookMarkerEnd}
`;
  }
  
  /**
   * Combine existing hook with our hook
   * 
   * @param {string} existingContent - Existing hook content
   * @param {string} ourContent - Our hook content
   * @returns {string}
   */
  combineHooks(existingContent, ourContent) {
    // Ensure shebang is present
    let combined = existingContent;
    
    if (!combined.startsWith('#!/')) {
      combined = '#!/bin/sh\n\n' + combined;
    }
    
    // Add our hook at the end
    combined += '\n\n' + ourContent;
    
    return combined;
  }
  
  /**
   * Remove our hook from combined content
   * 
   * @param {string} content - Hook content
   * @returns {string}
   */
  removeOurHook(content) {
    const startIndex = content.indexOf(this.hookMarkerStart);
    const endIndex = content.indexOf(this.hookMarkerEnd);
    
    if (startIndex === -1 || endIndex === -1) {
      return content;
    }
    
    // Remove our hook section (including markers and newlines)
    const before = content.substring(0, startIndex).trimEnd();
    const after = content.substring(endIndex + this.hookMarkerEnd.length).trimStart();
    
    if (before && after) {
      return before + '\n\n' + after;
    } else if (before) {
      return before;
    } else if (after) {
      return after;
    } else {
      return '';
    }
  }
}

module.exports = HooksManager;
