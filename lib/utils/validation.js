/**
 * Validation Utilities
 * 
 * Provides validation functions for project structure, version files,
 * and dependencies. Used for post-operation validation.
 */

const path = require('path');
const { pathExists, readJSON } = require('./fs-utils');
const { spawn } = require('child_process');

/**
 * Validates project structure
 * Checks if all required files and directories exist
 * 
 * @param {string} projectPath - Absolute path to project root
 * @returns {Promise<ValidationResult>}
 */
async function validateProjectStructure(projectPath) {
  const errors = [];
  const warnings = [];
  
  try {
    const kiroPath = path.join(projectPath, '.kiro');
    
    // Check if .kiro/ directory exists
    const kiroExists = await pathExists(kiroPath);
    if (!kiroExists) {
      errors.push('.kiro/ directory not found');
      return { success: false, errors, warnings };
    }
    
    // Check required directories
    const requiredDirs = [
      { path: 'specs', required: false },
      { path: 'steering', required: true },
      { path: 'tools', required: true },
      { path: 'backups', required: false }
    ];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(kiroPath, dir.path);
      const exists = await pathExists(dirPath);
      
      if (!exists) {
        if (dir.required) {
          errors.push(`Required directory not found: ${dir.path}/`);
        } else {
          warnings.push(`Optional directory not found: ${dir.path}/`);
        }
      }
    }
    
    // Check required steering files
    const requiredSteeringFiles = [
      { path: 'steering/CORE_PRINCIPLES.md', required: true },
      { path: 'steering/ENVIRONMENT.md', required: true },
      { path: 'steering/CURRENT_CONTEXT.md', required: true },
      { path: 'steering/RULES_GUIDE.md', required: true }
    ];
    
    for (const file of requiredSteeringFiles) {
      const filePath = path.join(kiroPath, file.path);
      const exists = await pathExists(filePath);
      
      if (!exists) {
        if (file.required) {
          errors.push(`Required file not found: ${file.path}`);
        } else {
          warnings.push(`Optional file not found: ${file.path}`);
        }
      }
    }
    
    // Check required tool files
    const requiredToolFiles = [
      { path: 'tools/ultrawork_enhancer.py', required: true }
    ];
    
    for (const file of requiredToolFiles) {
      const filePath = path.join(kiroPath, file.path);
      const exists = await pathExists(filePath);
      
      if (!exists) {
        if (file.required) {
          warnings.push(`Tool file not found: ${file.path}`);
        }
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Validation failed: ${error.message}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Validates version.json file structure
 * 
 * @param {string} projectPath - Absolute path to project root
 * @returns {Promise<ValidationResult>}
 */
async function validateVersionFile(projectPath) {
  const errors = [];
  const warnings = [];
  
  try {
    const versionPath = path.join(projectPath, '.kiro', 'version.json');
    
    // Check if version.json exists
    const exists = await pathExists(versionPath);
    if (!exists) {
      errors.push('version.json not found');
      return { success: false, errors, warnings };
    }
    
    // Read and validate structure
    const versionInfo = await readJSON(versionPath);
    
    // Check required fields
    const requiredFields = [
      'sce-version',
      'template-version',
      'created',
      'last-upgraded',
      'upgrade-history'
    ];
    
    for (const field of requiredFields) {
      if (!(field in versionInfo)) {
        errors.push(`Missing required field in version.json: ${field}`);
      }
    }
    
    // Validate field types
    if (versionInfo['sce-version'] && typeof versionInfo['sce-version'] !== 'string') {
      errors.push('sce-version must be a string');
    }
    
    if (versionInfo['template-version'] && typeof versionInfo['template-version'] !== 'string') {
      errors.push('template-version must be a string');
    }
    
    if (versionInfo['upgrade-history'] && !Array.isArray(versionInfo['upgrade-history'])) {
      errors.push('upgrade-history must be an array');
    }
    
    // Validate upgrade history entries
    if (Array.isArray(versionInfo['upgrade-history'])) {
      versionInfo['upgrade-history'].forEach((entry, index) => {
        if (!entry.from || !entry.to || !entry.date || typeof entry.success !== 'boolean') {
          warnings.push(`Invalid upgrade history entry at index ${index}`);
        }
      });
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Failed to validate version.json: ${error.message}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Validates dependencies (Node.js and Python versions)
 * 
 * @param {string} projectPath - Absolute path to project root
 * @returns {Promise<ValidationResult>}
 */
async function validateDependencies(projectPath) {
  const errors = [];
  const warnings = [];
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (nodeMajor < 16) {
      errors.push(`Node.js version ${nodeVersion} is not supported. Requires Node.js 16+`);
    }
    
    // Check Python version (if Ultrawork tools are present)
    const toolPath = path.join(projectPath, '.kiro/tools/ultrawork_enhancer.py');
    const toolExists = await pathExists(toolPath);
    
    if (toolExists) {
      try {
        const pythonVersion = await checkPythonVersion();
        
        if (!pythonVersion) {
          warnings.push('Python not found. Ultrawork tools require Python 3.8+');
        } else {
          const [major, minor] = pythonVersion.split('.').map(Number);
          
          if (major < 3 || (major === 3 && minor < 8)) {
            warnings.push(`Python ${pythonVersion} found. Ultrawork tools require Python 3.8+`);
          }
        }
      } catch (error) {
        warnings.push('Could not check Python version');
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`Failed to validate dependencies: ${error.message}`);
    return { success: false, errors, warnings };
  }
}

/**
 * Checks Python version
 * 
 * @returns {Promise<string|null>} - Python version string or null if not found
 */
function checkPythonVersion() {
  return new Promise((resolve) => {
    const python = spawn('python', ['--version']);
    let output = '';
    let settled = false;
    let timeoutId = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(value);
    };

    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0 && output) {
        // Extract version number from "Python 3.x.x"
        const match = output.match(/Python (\d+\.\d+\.\d+)/);
        if (match) {
          finish(match[1]);
        } else {
          finish(null);
        }
      } else {
        finish(null);
      }
    });
    
    python.on('error', () => {
      finish(null);
    });
    
    // Timeout after 5 seconds
    timeoutId = setTimeout(() => {
      try {
        python.kill();
      } catch (_err) {
        // Process may already be gone.
      }
      finish(null);
    }, 5000);
    if (typeof timeoutId.unref === 'function') {
      timeoutId.unref();
    }
  });
}

/**
 * Validates complete project (structure + version + dependencies)
 * 
 * @param {string} projectPath - Absolute path to project root
 * @returns {Promise<ValidationResult>}
 */
async function validateProject(projectPath) {
  const allErrors = [];
  const allWarnings = [];
  
  // Run all validations
  const structureResult = await validateProjectStructure(projectPath);
  const versionResult = await validateVersionFile(projectPath);
  const depsResult = await validateDependencies(projectPath);
  
  // Combine results
  allErrors.push(...structureResult.errors);
  allErrors.push(...versionResult.errors);
  allErrors.push(...depsResult.errors);
  
  allWarnings.push(...structureResult.warnings);
  allWarnings.push(...versionResult.warnings);
  allWarnings.push(...depsResult.warnings);
  
  return {
    success: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

module.exports = {
  validateProjectStructure,
  validateVersionFile,
  validateDependencies,
  validateProject,
  checkPythonVersion
};
