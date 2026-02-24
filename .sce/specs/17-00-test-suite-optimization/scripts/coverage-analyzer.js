/**
 * Coverage Analyzer - Identifies critical paths and maps them to integration tests
 */

const fs = require('fs-extra');
const path = require('path');
const {
  findJavaScriptFiles,
  parseJavaScriptFile,
  normalizePath,
  getRelativePath,
  calculatePercentage
} = require('./utils');

class CoverageAnalyzer {
  constructor(config) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  /**
   * Analyze codebase to identify critical paths
   * @param {string} libPath - Path to lib directory
   * @param {string} testsPath - Path to tests directory
   * @returns {Promise<Object>} Coverage report
   */
  async analyzeCoverage(libPath, testsPath) {
    const criticalPaths = await this.identifyCriticalPaths(libPath);
    const integrationTestsPath = path.join(testsPath, 'integration');
    const coverageMapping = await this.mapTestsToPaths(criticalPaths, integrationTestsPath);
    
    return this._generateCoverageReport(criticalPaths, coverageMapping);
  }

  /**
   * Identify critical paths by feature area
   * @param {string} libPath - Path to lib directory
   * @returns {Promise<Array>} Array of critical paths
   */
  async identifyCriticalPaths(libPath) {
    const criticalPaths = [];
    
    // Find all JavaScript files in lib directory
    const files = await findJavaScriptFiles(libPath, {
      recursive: true,
      exclude: ['node_modules', '.git', 'coverage', 'tests']
    });
    
    for (const file of files) {
      const relativePath = getRelativePath(file, this.projectRoot);
      const featureArea = this._determineFeatureArea(relativePath);
      const priority = this._determinePriority(relativePath);
      
      // Identify if this is a critical path
      if (this._isCriticalPath(relativePath)) {
        const dependencies = await this._analyzeDependencies(file);
        
        criticalPaths.push({
          id: this._generatePathId(relativePath),
          featureArea,
          description: this._generateDescription(relativePath),
          entryPoints: [relativePath],
          dependencies,
          priority
        });
      }
    }
    
    return criticalPaths;
  }

  /**
   * Map integration tests to critical paths
   * @param {Array} paths - Critical paths
   * @param {string} integrationTestsPath - Path to integration tests
   * @returns {Promise<Object>} Coverage mapping
   */
  async mapTestsToPaths(paths, integrationTestsPath) {
    const mapping = {
      covered: [],
      uncovered: []
    };
    
    // Check if integration tests directory exists
    if (!await fs.pathExists(integrationTestsPath)) {
      mapping.uncovered = paths;
      return mapping;
    }
    
    // Find all integration test files
    const testFiles = await findJavaScriptFiles(integrationTestsPath, {
      recursive: false
    });
    
    // Parse test files to extract tested modules
    const testedModules = new Set();
    for (const testFile of testFiles) {
      const modules = await this._extractTestedModules(testFile);
      modules.forEach(mod => testedModules.add(mod));
    }
    
    // Map paths to coverage
    for (const criticalPath of paths) {
      const isCovered = this._isPathCovered(criticalPath, testedModules);
      if (isCovered) {
        mapping.covered.push(criticalPath);
      } else {
        mapping.uncovered.push(criticalPath);
      }
    }
    
    return mapping;
  }

  /**
   * Determine feature area from file path
   * @private
   */
  _determineFeatureArea(filePath) {
    const normalizedPath = normalizePath(filePath);
    
    for (const area of this.config.featureAreas) {
      if (normalizedPath.includes(`/${area}/`) || normalizedPath.includes(`/${area}.js`)) {
        return area;
      }
    }
    
    return 'utils';
  }

  /**
   * Determine priority based on file characteristics
   * @private
   */
  _determinePriority(filePath) {
    const normalizedPath = normalizePath(filePath);
    
    // High priority: Commands, main entry points, data persistence
    if (normalizedPath.includes('/commands/') ||
        normalizedPath.includes('manager.js') ||
        normalizedPath.includes('registry.js')) {
      return 'high';
    }
    
    // Medium priority: Configuration, validation
    if (normalizedPath.includes('/config') ||
        normalizedPath.includes('validation') ||
        normalizedPath.includes('checker')) {
      return 'medium';
    }
    
    // Low priority: Utilities, formatters
    return 'low';
  }

  /**
   * Check if a file represents a critical path
   * @private
   */
  _isCriticalPath(filePath) {
    const normalizedPath = normalizePath(filePath);
    
    // Commands are always critical
    if (normalizedPath.includes('/commands/')) {
      return true;
    }
    
    // Manager classes are critical
    if (normalizedPath.includes('manager.js') ||
        normalizedPath.includes('registry.js') ||
        normalizedPath.includes('engine.js')) {
      return true;
    }
    
    // Main workflow orchestrators
    if (normalizedPath.includes('orchestrator') ||
        normalizedPath.includes('executor')) {
      return true;
    }
    
    return false;
  }

  /**
   * Analyze dependencies of a file
   * @private
   */
  async _analyzeDependencies(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const dependencies = [];
      
      // Extract require() and import statements
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
      
      let match;
      while ((match = requireRegex.exec(content)) !== null) {
        if (match[1].startsWith('./') || match[1].startsWith('../')) {
          dependencies.push(match[1]);
        }
      }
      
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1].startsWith('./') || match[1].startsWith('../')) {
          dependencies.push(match[1]);
        }
      }
      
      return [...new Set(dependencies)];
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract tested modules from a test file
   * @private
   */
  async _extractTestedModules(testFile) {
    try {
      const content = await fs.readFile(testFile, 'utf-8');
      const modules = [];
      
      // Extract require() statements for lib modules
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      let match;
      
      while ((match = requireRegex.exec(content)) !== null) {
        const modulePath = match[1];
        if (modulePath.includes('/lib/')) {
          modules.push(modulePath);
        }
      }
      
      return modules;
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a critical path is covered by tests
   * @private
   */
  _isPathCovered(criticalPath, testedModules) {
    for (const entryPoint of criticalPath.entryPoints) {
      for (const testedModule of testedModules) {
        if (testedModule.includes(entryPoint) || entryPoint.includes(testedModule)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Generate a unique ID for a critical path
   * @private
   */
  _generatePathId(filePath) {
    return normalizePath(filePath)
      .replace(/^lib\//, '')
      .replace(/\.js$/, '')
      .replace(/\//g, '-');
  }

  /**
   * Generate a description for a critical path
   * @private
   */
  _generateDescription(filePath) {
    const fileName = path.basename(filePath, '.js');
    const featureArea = this._determineFeatureArea(filePath);
    
    return `${featureArea}: ${fileName}`;
  }

  /**
   * Generate coverage report
   * @private
   */
  _generateCoverageReport(criticalPaths, coverageMapping) {
    const totalPaths = criticalPaths.length;
    const coveredPaths = coverageMapping.covered.length;
    const coveragePercentage = calculatePercentage(coveredPaths, totalPaths);
    
    // Group by feature area
    const byFeatureArea = {};
    for (const area of this.config.featureAreas) {
      const areaPaths = criticalPaths.filter(p => p.featureArea === area);
      const areaCovered = coverageMapping.covered.filter(p => p.featureArea === area);
      
      byFeatureArea[area] = {
        total: areaPaths.length,
        covered: areaCovered.length,
        percentage: calculatePercentage(areaCovered.length, areaPaths.length)
      };
    }
    
    return {
      totalCriticalPaths: totalPaths,
      coveredPaths,
      uncoveredPaths: coverageMapping.uncovered,
      coveragePercentage,
      byFeatureArea
    };
  }
}

module.exports = CoverageAnalyzer;
