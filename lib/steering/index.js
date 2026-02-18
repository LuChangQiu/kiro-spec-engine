const path = require('path');
const SteeringComplianceChecker = require('./steering-compliance-checker');
const ComplianceCache = require('./compliance-cache');
const ComplianceErrorReporter = require('./compliance-error-reporter');
const ComplianceAutoFixer = require('./compliance-auto-fixer');
const { SpecSteering } = require('./spec-steering');
const { SteeringLoader } = require('./steering-loader');
const { ContextSyncManager } = require('./context-sync-manager');

/**
 * Run steering directory compliance check
 * 
 * @param {Object} options - Check options
 * @param {boolean} options.skip - Skip the check entirely
 * @param {boolean} options.force - Force check even if cache is valid
 * @param {string} options.projectPath - Project root path (defaults to cwd)
 * @param {string} options.version - Current sce version
 * @returns {boolean} True if compliant or check skipped, false otherwise
 */
async function runSteeringComplianceCheck(options = {}) {
  const {
    skip = false,
    force = false,
    projectPath = process.cwd(),
    version = require('../../package.json').version
  } = options;

  // Skip check if requested
  if (skip) {
    return true;
  }

  try {
    const checker = new SteeringComplianceChecker();
    const cache = new ComplianceCache();
    const reporter = new ComplianceErrorReporter();
    const fixer = new ComplianceAutoFixer();

    // Check cache unless forced
    if (!force && cache.isValid(version)) {
      // Cache is valid, skip check
      return true;
    }

    // Perform compliance check with performance measurement
    const startTime = Date.now();
    const steeringPath = path.join(projectPath, '.kiro', 'steering');
    const result = checker.check(steeringPath);
    const duration = Date.now() - startTime;

    // Log warning if check exceeds performance target
    if (duration > 50) {
      console.warn(`Warning: Steering compliance check took ${duration}ms (target: <50ms)`);
    }

    if (!result.compliant) {
      // Auto-fix violations
      console.log(''); // Empty line for better formatting
      const fixResult = await fixer.fix(steeringPath, result.violations);
      
      if (fixResult.success) {
        console.log('✓ Steering directory is now compliant\n');
        // Update cache after successful fix
        cache.update(version);
        return true;
      } else {
        // If fix failed, report and exit
        reporter.reportAndExit(result.violations);
        return false;
      }
    }

    // Update cache on success
    cache.update(version);
    return true;
  } catch (error) {
    // Log error but don't block execution
    console.warn(`Warning: Steering compliance check failed: ${error.message}`);
    return true; // Allow execution to proceed
  }
}

module.exports = {
  runSteeringComplianceCheck,
  SteeringComplianceChecker,
  ComplianceCache,
  ComplianceErrorReporter,
  ComplianceAutoFixer,
  SpecSteering,
  SteeringLoader,
  ContextSyncManager
};
