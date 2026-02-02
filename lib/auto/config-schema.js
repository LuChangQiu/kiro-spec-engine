/**
 * Configuration Schema for Autonomous Control
 * Defines and validates autonomous execution configuration
 */

const DEFAULT_CONFIG = {
  version: '1.0.0',
  mode: 'balanced',
  
  checkpoints: {
    requirementsReview: false,
    designReview: false,
    tasksReview: false,
    phaseCompletion: true,
    finalReview: true,
    errorThreshold: 5
  },
  
  errorRecovery: {
    enabled: true,
    maxAttempts: 3,
    strategies: ['syntax-fix', 'import-resolution', 'type-correction', 'null-check', 'error-handling'],
    learningEnabled: true
  },
  
  safety: {
    requireProductionConfirmation: true,
    requireExternalResourceConfirmation: true,
    requireDestructiveOperationConfirmation: true,
    allowedOperations: [],
    blockedOperations: []
  },
  
  performance: {
    maxConcurrentTasks: 1,
    taskTimeout: 300000, // 5 minutes
    checkpointInterval: 600000 // 10 minutes
  },
  
  notifications: {
    enabled: true,
    onCheckpoint: true,
    onError: true,
    onCompletion: true
  }
};

const MODE_PRESETS = {
  conservative: {
    checkpoints: {
      requirementsReview: true,
      designReview: true,
      tasksReview: true,
      phaseCompletion: true,
      finalReview: true,
      errorThreshold: 3
    }
  },
  
  balanced: {
    checkpoints: {
      requirementsReview: false,
      designReview: false,
      tasksReview: false,
      phaseCompletion: true,
      finalReview: true,
      errorThreshold: 5
    }
  },
  
  aggressive: {
    checkpoints: {
      requirementsReview: false,
      designReview: false,
      tasksReview: false,
      phaseCompletion: false,
      finalReview: true,
      errorThreshold: 10
    }
  }
};

/**
 * Validate autonomous configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];
  
  if (!config) {
    return { valid: false, errors: ['Configuration is required'] };
  }
  
  // Validate mode
  if (config.mode && !['conservative', 'balanced', 'aggressive'].includes(config.mode)) {
    errors.push('mode must be "conservative", "balanced", or "aggressive"');
  }
  
  // Validate checkpoints
  if (config.checkpoints) {
    if (typeof config.checkpoints.errorThreshold === 'number' && config.checkpoints.errorThreshold < 1) {
      errors.push('checkpoints.errorThreshold must be >= 1');
    }
  }
  
  // Validate error recovery
  if (config.errorRecovery) {
    if (typeof config.errorRecovery.maxAttempts === 'number' && config.errorRecovery.maxAttempts < 1) {
      errors.push('errorRecovery.maxAttempts must be >= 1');
    }
  }
  
  // Validate performance
  if (config.performance) {
    if (typeof config.performance.maxConcurrentTasks === 'number' && config.performance.maxConcurrentTasks < 1) {
      errors.push('performance.maxConcurrentTasks must be >= 1');
    }
    if (typeof config.performance.taskTimeout === 'number' && config.performance.taskTimeout < 1000) {
      errors.push('performance.taskTimeout must be >= 1000ms');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge configurations with hierarchy: defaults < global < project
 * @param {Object} globalConfig - Global configuration
 * @param {Object} projectConfig - Project-specific configuration
 * @returns {Object} - Merged configuration
 */
function mergeConfigs(globalConfig = {}, projectConfig = {}) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  // Apply mode preset if specified
  const mode = projectConfig.mode || globalConfig.mode || DEFAULT_CONFIG.mode;
  if (MODE_PRESETS[mode]) {
    Object.assign(merged.checkpoints, MODE_PRESETS[mode].checkpoints);
  }
  merged.mode = mode;
  
  // Deep merge global config
  deepMerge(merged, globalConfig);
  
  // Deep merge project config (overrides global)
  deepMerge(merged, projectConfig);
  
  return merged;
}

/**
 * Deep merge source into target
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

module.exports = {
  DEFAULT_CONFIG,
  MODE_PRESETS,
  validateConfig,
  mergeConfigs
};
