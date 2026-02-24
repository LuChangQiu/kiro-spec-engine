/**
 * Watch Mode Presets
 * 
 * Pre-configured watch patterns and actions for common workflows
 */

/**
 * Auto-sync preset
 * Watches tasks.md and automatically syncs workspace
 */
const autoSyncPreset = {
  name: 'auto-sync',
  description: 'Automatically sync workspace when tasks are updated',
  patterns: ['**/tasks.md'],
  actions: {
    '**/tasks.md': {
      command: 'sce workspace sync',
      debounce: 2000,
      retry: true,
      description: 'Sync workspace when tasks are updated'
    }
  },
  debounce: {
    default: 2000
  }
};

/**
 * Prompt regeneration preset
 * Watches requirements.md and design.md, regenerates prompts
 */
const promptRegenPreset = {
  name: 'prompt-regen',
  description: 'Regenerate prompts when requirements or design changes',
  patterns: [
    '**/.sce/specs/*/requirements.md',
    '**/.sce/specs/*/design.md'
  ],
  actions: {
    '**/.sce/specs/*/requirements.md': {
      command: 'sce prompt regenerate ${spec}',
      debounce: 5000,
      retry: true,
      description: 'Regenerate prompts when requirements change'
    },
    '**/.sce/specs/*/design.md': {
      command: 'sce prompt regenerate ${spec}',
      debounce: 5000,
      retry: true,
      description: 'Regenerate prompts when design changes'
    }
  },
  debounce: {
    default: 5000,
    perPattern: {
      '**/.sce/specs/*/requirements.md': 5000,
      '**/.sce/specs/*/design.md': 5000
    }
  }
};

/**
 * Context export preset
 * Watches for completion markers and exports context
 */
const contextExportPreset = {
  name: 'context-export',
  description: 'Export context when work is complete',
  patterns: ['**/.sce/specs/*/.complete'],
  actions: {
    '**/.sce/specs/*/.complete': {
      command: 'sce context export ${spec}',
      debounce: 1000,
      retry: true,
      description: 'Export context when completion marker is created'
    }
  },
  debounce: {
    default: 1000
  }
};

/**
 * Test runner preset
 * Watches source files and runs relevant tests
 */
const testRunnerPreset = {
  name: 'test-runner',
  description: 'Run tests when source files change',
  patterns: [
    '**/lib/**/*.js',
    '**/src/**/*.js',
    '**/lib/**/*.ts',
    '**/src/**/*.ts'
  ],
  actions: {
    '**/lib/**/*.js': {
      command: 'npm test -- ${file}.test.js',
      debounce: 3000,
      retry: false,
      condition: 'test_file_exists',
      description: 'Run tests when lib files change'
    },
    '**/src/**/*.js': {
      command: 'npm test -- ${file}.test.js',
      debounce: 3000,
      retry: false,
      condition: 'test_file_exists',
      description: 'Run tests when src files change'
    },
    '**/lib/**/*.ts': {
      command: 'npm test -- ${file}.test.ts',
      debounce: 3000,
      retry: false,
      condition: 'test_file_exists',
      description: 'Run tests when lib TypeScript files change'
    },
    '**/src/**/*.ts': {
      command: 'npm test -- ${file}.test.ts',
      debounce: 3000,
      retry: false,
      condition: 'test_file_exists',
      description: 'Run tests when src TypeScript files change'
    }
  },
  debounce: {
    default: 3000
  }
};

/**
 * All available presets
 */
const presets = {
  'auto-sync': autoSyncPreset,
  'prompt-regen': promptRegenPreset,
  'context-export': contextExportPreset,
  'test-runner': testRunnerPreset
};

/**
 * Get a preset by name
 * 
 * @param {string} name - Preset name
 * @returns {Object|null} Preset configuration or null if not found
 */
function getPreset(name) {
  return presets[name] || null;
}

/**
 * List all available presets
 * 
 * @returns {Array} Array of preset names and descriptions
 */
function listPresets() {
  return Object.keys(presets).map(name => ({
    name,
    description: presets[name].description
  }));
}

/**
 * Merge preset with existing configuration
 * 
 * @param {Object} existingConfig - Existing watch configuration
 * @param {string} presetName - Preset name to merge
 * @returns {Object} Merged configuration
 */
function mergePreset(existingConfig, presetName) {
  const preset = getPreset(presetName);
  
  if (!preset) {
    throw new Error(`Preset not found: ${presetName}`);
  }
  
  // Deep clone existing config
  const merged = JSON.parse(JSON.stringify(existingConfig));
  
  // Merge patterns (avoid duplicates)
  const existingPatterns = new Set(merged.patterns || []);
  for (const pattern of preset.patterns) {
    existingPatterns.add(pattern);
  }
  merged.patterns = Array.from(existingPatterns);
  
  // Merge actions
  merged.actions = merged.actions || {};
  for (const [pattern, action] of Object.entries(preset.actions)) {
    // Don't overwrite existing actions
    if (!merged.actions[pattern]) {
      merged.actions[pattern] = action;
    }
  }
  
  // Merge debounce settings
  merged.debounce = merged.debounce || {};
  if (preset.debounce.default && !merged.debounce.default) {
    merged.debounce.default = preset.debounce.default;
  }
  
  if (preset.debounce.perPattern) {
    merged.debounce.perPattern = merged.debounce.perPattern || {};
    for (const [pattern, delay] of Object.entries(preset.debounce.perPattern)) {
      if (!merged.debounce.perPattern[pattern]) {
        merged.debounce.perPattern[pattern] = delay;
      }
    }
  }
  
  return merged;
}

/**
 * Validate preset configuration
 * 
 * @param {string} presetName - Preset name
 * @returns {Object} Validation result
 */
function validatePreset(presetName) {
  const preset = getPreset(presetName);
  
  if (!preset) {
    return {
      valid: false,
      errors: [`Preset not found: ${presetName}`]
    };
  }
  
  const errors = [];
  
  // Validate patterns
  if (!preset.patterns || preset.patterns.length === 0) {
    errors.push('Preset must have at least one pattern');
  }
  
  // Validate actions
  if (!preset.actions || Object.keys(preset.actions).length === 0) {
    errors.push('Preset must have at least one action');
  }
  
  // Validate each action
  for (const [pattern, action] of Object.entries(preset.actions || {})) {
    if (!action.command) {
      errors.push(`Action for pattern "${pattern}" must have a command`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  presets,
  getPreset,
  listPresets,
  mergePreset,
  validatePreset,
  // Export individual presets for testing
  autoSyncPreset,
  promptRegenPreset,
  contextExportPreset,
  testRunnerPreset
};
