const fs = require('fs-extra');
const path = require('path');

/**
 * SteeringComplianceChecker - Validates steering directory compliance
 * 
 * Ensures the .sce/steering/ directory contains only allowed files
 * and no subdirectories to prevent context pollution and excessive
 * token consumption in AI sessions.
 */
class SteeringComplianceChecker {
  /**
   * Get list of allowed files in steering directory
   * 
   * @returns {string[]} Array of allowed file names
   */
  getAllowedFiles() {
    return [
      'CORE_PRINCIPLES.md',
      'ENVIRONMENT.md',
      'CURRENT_CONTEXT.md',
      'RULES_GUIDE.md'
    ];
  }

  /**
   * Check if steering directory is compliant
   * 
   * @param {string} steeringPath - Path to steering directory
   * @returns {ComplianceResult} Result with status and violations
   */
  check(steeringPath) {
    // Non-existent directory is compliant
    if (!fs.existsSync(steeringPath)) {
      return { compliant: true };
    }

    const violations = [];
    const allowedFiles = this.getAllowedFiles();
    
    try {
      const entries = fs.readdirSync(steeringPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Subdirectories are not allowed
          violations.push({
            type: 'subdirectory',
            name: entry.name,
            path: path.join(steeringPath, entry.name)
          });
        } else if (!allowedFiles.includes(entry.name)) {
          // File not in allowlist
          violations.push({
            type: 'disallowed_file',
            name: entry.name,
            path: path.join(steeringPath, entry.name)
          });
        }
      }
      
      return {
        compliant: violations.length === 0,
        violations
      };
    } catch (error) {
      // Re-throw unexpected errors
      throw error;
    }
  }
}

module.exports = SteeringComplianceChecker;
