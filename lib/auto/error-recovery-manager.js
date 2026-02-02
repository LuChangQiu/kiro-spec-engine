/**
 * Error Recovery Manager
 * Automatic error diagnosis and resolution with learning capabilities
 */

class ErrorRecoveryManager {
  constructor(config = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      strategies: config.strategies || [],
      learningEnabled: config.learningEnabled !== false
    };
    
    this.strategyRegistry = new Map();
    this.successHistory = new Map(); // error type -> successful strategies
    this.failureHistory = new Map(); // error type -> failed strategies
    this.recoveryLog = [];
    
    // Register default strategies
    this.registerDefaultStrategies();
  }
  
  /**
   * Register default recovery strategies
   */
  registerDefaultStrategies() {
    // Syntax fix strategy
    this.registerStrategy('syntax-fix', async (error, context) => {
      const analysis = this.analyzeError(error, context);
      if (analysis.type !== 'compilation') return { success: false };
      
      // Extract syntax error details
      const syntaxMatch = error.message.match(/Unexpected token|Unexpected identifier|Missing|Expected/i);
      if (!syntaxMatch) return { success: false };
      
      return {
        success: true,
        action: 'fix-syntax',
        details: `Identified syntax error: ${syntaxMatch[0]}`
      };
    });
    
    // Import resolution strategy
    this.registerStrategy('import-resolution', async (error, context) => {
      const analysis = this.analyzeError(error, context);
      if (analysis.type !== 'compilation' && analysis.type !== 'runtime') {
        return { success: false };
      }
      
      // Check for missing module errors
      const importMatch = error.message.match(/Cannot find module ['"](.+)['"]/);
      if (!importMatch) return { success: false };
      
      return {
        success: true,
        action: 'add-import',
        module: importMatch[1],
        details: `Missing module: ${importMatch[1]}`
      };
    });
    
    // Type correction strategy
    this.registerStrategy('type-correction', async (error, context) => {
      const analysis = this.analyzeError(error, context);
      if (analysis.type !== 'compilation') return { success: false };
      
      // Check for type errors
      const typeMatch = error.message.match(/Type ['"](.+)['"] is not assignable to type ['"](.+)['"]/);
      if (!typeMatch) return { success: false };
      
      return {
        success: true,
        action: 'fix-type',
        from: typeMatch[1],
        to: typeMatch[2],
        details: `Type mismatch: ${typeMatch[1]} -> ${typeMatch[2]}`
      };
    });
    
    // Null check strategy
    this.registerStrategy('null-check', async (error, context) => {
      const analysis = this.analyzeError(error, context);
      if (analysis.type !== 'runtime') return { success: false };
      
      // Check for null/undefined errors
      const nullMatch = error.message.match(/Cannot read property|undefined is not|null is not/i);
      if (!nullMatch) return { success: false };
      
      return {
        success: true,
        action: 'add-null-check',
        details: `Null/undefined access detected`
      };
    });
    
    // Error handling strategy
    this.registerStrategy('error-handling', async (error, context) => {
      const analysis = this.analyzeError(error, context);
      
      return {
        success: true,
        action: 'add-try-catch',
        details: `Wrap code in try-catch block`
      };
    });
  }
  
  /**
   * Analyze error and extract information
   * @param {Error} error - Error to analyze
   * @param {Object} context - Execution context
   * @returns {Object} - Error analysis
   */
  analyzeError(error, context = {}) {
    const message = error.message || '';
    const stack = error.stack || '';
    
    // Determine error type
    let type = 'unknown';
    let severity = 'medium';
    
    if (message.match(/SyntaxError|Unexpected token|Parse error/i)) {
      type = 'compilation';
      severity = 'high';
    } else if (message.match(/Test failed|Assertion failed|Expected/i)) {
      type = 'test-failure';
      severity = 'medium';
    } else if (message.match(/TypeError|ReferenceError|Cannot read/i)) {
      type = 'runtime';
      severity = 'high';
    } else if (message.match(/Cannot find module|Module not found/i)) {
      type = 'dependency';
      severity = 'high';
    }
    
    // Extract context from stack trace
    const fileMatch = stack.match(/at .+ \((.+):(\d+):(\d+)\)/);
    const errorContext = fileMatch ? {
      file: fileMatch[1],
      line: parseInt(fileMatch[2]),
      column: parseInt(fileMatch[3])
    } : context;
    
    // Suggest strategies based on error type
    const suggestedStrategies = this.getSuggestedStrategies(type, message);
    
    return {
      type,
      severity,
      message,
      stackTrace: stack,
      context: errorContext,
      suggestedStrategies
    };
  }
  
  /**
   * Get suggested strategies for error type
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @returns {Array} - Suggested strategy names
   */
  getSuggestedStrategies(type, message) {
    const strategies = [];
    
    // Check learning history first
    if (this.learningEnabled && this.successHistory.has(type)) {
      const successfulStrategies = this.successHistory.get(type);
      strategies.push(...successfulStrategies.slice(0, 2)); // Top 2 successful
    }
    
    // Add type-specific strategies
    switch (type) {
      case 'compilation':
        strategies.push('syntax-fix', 'import-resolution', 'type-correction');
        break;
      case 'test-failure':
        strategies.push('error-handling');
        break;
      case 'runtime':
        strategies.push('null-check', 'error-handling', 'import-resolution');
        break;
      case 'dependency':
        strategies.push('import-resolution');
        break;
      default:
        strategies.push('error-handling');
    }
    
    return [...new Set(strategies)]; // Remove duplicates
  }
  
  /**
   * Select best recovery strategy
   * @param {Object} errorAnalysis - Error analysis result
   * @returns {string|null} - Strategy name or null
   */
  async selectRecoveryStrategy(errorAnalysis) {
    const { suggestedStrategies } = errorAnalysis;
    
    // Try suggested strategies in order
    for (const strategyName of suggestedStrategies) {
      if (this.strategyRegistry.has(strategyName)) {
        return strategyName;
      }
    }
    
    return null;
  }
  
  /**
   * Apply recovery strategy
   * @param {string} strategyName - Strategy to apply
   * @param {Object} context - Execution context
   * @returns {Object} - Recovery result
   */
  async applyRecoveryStrategy(strategyName, context) {
    const strategy = this.strategyRegistry.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyName}`);
    }
    
    try {
      const result = await strategy(context.error, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Validate recovery by re-running tests
   * @param {Object} context - Execution context
   * @returns {boolean} - True if recovery successful
   */
  async validateRecovery(context) {
    // This would run tests to verify the fix
    // For now, return true (actual implementation would run tests)
    return true;
  }
  
  /**
   * Register a recovery strategy
   * @param {string} name - Strategy name
   * @param {Function} strategyFn - Strategy function
   */
  registerStrategy(name, strategyFn) {
    this.strategyRegistry.set(name, strategyFn);
  }
  
  /**
   * Get available strategies
   * @returns {Array} - Strategy names
   */
  getAvailableStrategies() {
    return Array.from(this.strategyRegistry.keys());
  }
  
  /**
   * Record successful recovery
   * @param {Object} errorAnalysis - Error analysis
   * @param {string} strategy - Strategy that succeeded
   */
  async recordSuccess(errorAnalysis, strategy) {
    if (!this.learningEnabled) return;
    
    const { type } = errorAnalysis;
    
    if (!this.successHistory.has(type)) {
      this.successHistory.set(type, []);
    }
    
    const successes = this.successHistory.get(type);
    if (!successes.includes(strategy)) {
      successes.unshift(strategy); // Add to front
    }
    
    this.recoveryLog.push({
      timestamp: new Date().toISOString(),
      type,
      strategy,
      success: true
    });
  }
  
  /**
   * Record failed recovery
   * @param {Object} errorAnalysis - Error analysis
   * @param {string} strategy - Strategy that failed
   */
  async recordFailure(errorAnalysis, strategy) {
    if (!this.learningEnabled) return;
    
    const { type } = errorAnalysis;
    
    if (!this.failureHistory.has(type)) {
      this.failureHistory.set(type, []);
    }
    
    const failures = this.failureHistory.get(type);
    if (!failures.includes(strategy)) {
      failures.push(strategy);
    }
    
    this.recoveryLog.push({
      timestamp: new Date().toISOString(),
      type,
      strategy,
      success: false
    });
  }
  
  /**
   * Get recovery log
   * @returns {Array} - Recovery log entries
   */
  getRecoveryLog() {
    return this.recoveryLog;
  }
  
  /**
   * Get success rate for strategy
   * @param {string} strategy - Strategy name
   * @returns {number} - Success rate (0-1)
   */
  getSuccessRate(strategy) {
    const entries = this.recoveryLog.filter(e => e.strategy === strategy);
    if (entries.length === 0) return 0;
    
    const successes = entries.filter(e => e.success).length;
    return successes / entries.length;
  }
  
  /**
   * Attempt error recovery
   * @param {Error} error - Error to recover from
   * @param {Object} context - Execution context
   * @returns {Object} - Recovery result
   */
  async attemptRecovery(error, context) {
    const analysis = this.analyzeError(error, context);
    const strategy = await this.selectRecoveryStrategy(analysis);
    
    if (!strategy) {
      return {
        success: false,
        message: 'No suitable recovery strategy found'
      };
    }
    
    const result = await this.applyRecoveryStrategy(strategy, { ...context, error });
    
    if (result.success) {
      await this.recordSuccess(analysis, strategy);
    } else {
      await this.recordFailure(analysis, strategy);
    }
    
    return result;
  }
}

module.exports = ErrorRecoveryManager;
