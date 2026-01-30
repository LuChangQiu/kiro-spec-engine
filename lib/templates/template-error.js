/**
 * Template Error Classes
 * 
 * Provides specialized error types for template operations with
 * context-specific error messages and troubleshooting suggestions.
 */

/**
 * Base error class for all template-related errors
 */
class TemplateError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'TemplateError';
    this.type = type;
    this.details = details;
    this.suggestions = this.generateSuggestions();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Generate context-specific troubleshooting suggestions
   * @returns {string[]} Array of suggestion strings
   */
  generateSuggestions() {
    switch (this.type) {
      case 'network':
        return [
          'Check your internet connection',
          'Verify the repository URL is correct',
          'Try again later if the service is temporarily unavailable',
          'Check if you need to configure proxy settings'
        ];
      
      case 'validation':
        return [
          'Review the template structure requirements',
          'Check the YAML frontmatter syntax',
          'Ensure all required fields are present',
          'Refer to CONTRIBUTING.md for template format'
        ];
      
      case 'filesystem':
        return [
          'Check file permissions',
          'Ensure sufficient disk space',
          'Verify the path is correct',
          'Try running with elevated permissions if needed'
        ];
      
      case 'git':
        return [
          'Ensure Git is installed and in PATH',
          'Check repository URL is accessible',
          'Verify Git credentials if repository is private',
          'Try clearing the cache and re-downloading'
        ];
      
      default:
        return [
          'Check the error details above',
          'Refer to documentation for troubleshooting',
          'Report this issue if the problem persists'
        ];
    }
  }
  
  /**
   * Format error for display to user
   * @returns {string} Formatted error message
   */
  format() {
    let output = `\n❌ ${this.message}\n`;
    
    if (Object.keys(this.details).length > 0) {
      output += '\nDetails:\n';
      for (const [key, value] of Object.entries(this.details)) {
        output += `  ${key}: ${value}\n`;
      }
    }
    
    if (this.suggestions.length > 0) {
      output += '\nSuggestions:\n';
      this.suggestions.forEach((suggestion, index) => {
        output += `  ${index + 1}. ${suggestion}\n`;
      });
    }
    
    return output;
  }
}

/**
 * Network-related errors (download, clone, pull)
 */
class NetworkError extends TemplateError {
  constructor(message, details = {}) {
    super('network', message, details);
    this.name = 'NetworkError';
  }
}

/**
 * Template validation errors
 */
class ValidationError extends TemplateError {
  constructor(message, details = {}) {
    super('validation', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * File system operation errors
 */
class FileSystemError extends TemplateError {
  constructor(message, details = {}) {
    super('filesystem', message, details);
    this.name = 'FileSystemError';
  }
}

/**
 * Git operation errors
 */
class GitError extends TemplateError {
  constructor(message, details = {}) {
    super('git', message, details);
    this.name = 'GitError';
  }
}

module.exports = {
  TemplateError,
  NetworkError,
  ValidationError,
  FileSystemError,
  GitError
};
