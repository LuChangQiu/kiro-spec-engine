const { execSync } = require('child_process');
const { getI18n } = require('./i18n');

/**
 * Python Dependency Detection Component
 * 
 * Detects Python availability and provides user guidance for installation.
 * Supports Windows, Linux, and macOS platforms.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
class PythonChecker {
  constructor() {
    this.minMajor = 3;
    this.minMinor = 8;
  }

  /**
   * Check if Python is available and meets version requirements
   * 
   * @returns {Object} { available: boolean, version: string|null, message: string }
   * 
   * Requirements:
   * - 3.1: Verify Python availability before executing Python code
   * - 3.4: Detect Python 3.8 or higher
   * - 3.5: Inform user of minimum required version when too old
   */
  checkPython() {
    const i18n = getI18n();
    
    try {
      // Try to execute python --version
      const versionOutput = execSync('python --version', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      
      const parsed = this.parseVersion(versionOutput);
      
      if (!parsed) {
        return {
          available: false,
          version: versionOutput,
          message: i18n.t('python.malformed_version', { version: versionOutput })
        };
      }
      
      const { major, minor, patch } = parsed;
      const meetsRequirement = this.meetsVersionRequirement(major, minor);
      
      if (meetsRequirement) {
        return {
          available: true,
          version: `Python ${major}.${minor}.${patch}`,
          message: i18n.t('python.available', { version: `${major}.${minor}.${patch}` })
        };
      } else {
        return {
          available: false,
          version: `Python ${major}.${minor}.${patch}`,
          message: i18n.t('python.version_too_old', { 
            version: `${major}.${minor}.${patch}`, 
            required: `${this.minMajor}.${this.minMinor}+` 
          })
        };
      }
    } catch (error) {
      // Python not found or command failed
      return {
        available: false,
        version: null,
        message: i18n.t('python.not_found')
      };
    }
  }

  /**
   * Parse Python version string to extract version numbers
   * 
   * @param {string} versionString - Python version output (e.g., "Python 3.10.0")
   * @returns {Object|null} { major, minor, patch, meetsRequirement } or null if parsing fails
   * 
   * Requirements:
   * - 3.4: Extract version numbers for comparison
   */
  parseVersion(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return null;
    }
    
    // Match pattern: Python X.Y.Z
    const versionMatch = versionString.match(/Python\s+(\d+)\.(\d+)\.(\d+)/i);
    
    if (!versionMatch) {
      return null;
    }
    
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const patch = parseInt(versionMatch[3], 10);
    
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      return null;
    }
    
    return {
      major,
      minor,
      patch,
      meetsRequirement: this.meetsVersionRequirement(major, minor)
    };
  }

  /**
   * Check if version meets minimum requirement (3.8+)
   * 
   * @param {number} major - Major version number
   * @param {number} minor - Minor version number
   * @returns {boolean} True if version meets requirement
   */
  meetsVersionRequirement(major, minor) {
    if (major > this.minMajor) {
      return true;
    }
    if (major === this.minMajor && minor >= this.minMinor) {
      return true;
    }
    return false;
  }

  /**
   * Get installation instructions for the current OS
   * 
   * @returns {string} OS-specific installation instructions
   * 
   * Requirements:
   * - 3.3: Provide installation instructions for user's operating system
   */
  getInstallInstructions() {
    const i18n = getI18n();
    const platform = process.platform;
    
    // Map platform to locale key
    const platformKey = this.getPlatformKey(platform);
    
    // Try to get platform-specific instructions
    const instructions = i18n.t(`python.install.${platformKey}`);
    
    // If translation not found (returns key), use default
    if (instructions === `python.install.${platformKey}`) {
      return i18n.t('python.install.default');
    }
    
    return instructions;
  }

  /**
   * Map Node.js platform identifier to locale key
   * 
   * @param {string} platform - process.platform value
   * @returns {string} Platform key for locale lookup
   */
  getPlatformKey(platform) {
    switch (platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      default:
        return 'default';
    }
  }

  /**
   * Get friendly error message when Python is not available
   * 
   * @returns {string} User-friendly error message with installation guidance
   * 
   * Requirements:
   * - 3.2: Display friendly error message in user's language
   * - 3.3: Provide installation instructions
   */
  getErrorMessage() {
    const i18n = getI18n();
    const status = this.checkPython();
    
    if (status.available) {
      return null; // No error
    }
    
    const errorLines = [
      i18n.t('python.error_header'),
      '',
      status.message,
      '',
      i18n.t('python.install_header'),
      this.getInstallInstructions(),
      '',
      i18n.t('python.help_footer')
    ];
    
    return errorLines.join('\n');
  }
}

// Export singleton instance
module.exports = new PythonChecker();
