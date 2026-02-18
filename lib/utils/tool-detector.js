/**
 * Tool Detector
 * 
 * Detects which IDE/editor the user is using
 */

const fs = require('fs-extra');
const path = require('path');

/**
 * Detect the current IDE/editor environment
 * 
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Detection result
 */
async function detectTool(projectPath) {
  const detections = {
    SCE: await detectKiroIDE(projectPath),
    vscode: await detectVSCode(projectPath),
    cursor: await detectCursor(projectPath),
    other: null
  };

  // Determine primary tool
  let primaryTool = 'unknown';
  let confidence = 'low';

  if (detections.SCE.detected) {
    primaryTool = 'SCE';
    confidence = detections.SCE.confidence;
  } else if (detections.cursor.detected && detections.cursor.confidence === 'high') {
    // Only use Cursor if we have high confidence (Cursor-specific indicators)
    primaryTool = 'cursor';
    confidence = detections.cursor.confidence;
  } else if (detections.vscode.detected) {
    primaryTool = 'vscode';
    confidence = detections.vscode.confidence;
  } else if (detections.cursor.detected) {
    // Fallback to Cursor if VS Code not detected
    primaryTool = 'cursor';
    confidence = detections.cursor.confidence;
  } else {
    primaryTool = 'other';
    confidence = 'low';
  }

  return {
    primaryTool,
    confidence,
    detections,
    recommendations: getRecommendations(primaryTool, detections)
  };
}

/**
 * Detect AI IDE
 * 
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Detection result
 */
async function detectKiroIDE(projectPath) {
  const indicators = [];
  let detected = false;
  let confidence = 'low';

  // Check for .kiro directory
  const kiroDir = path.join(projectPath, '.kiro');
  if (await fs.pathExists(kiroDir)) {
    indicators.push('.kiro directory exists');
    detected = true;
    confidence = 'medium';
  }

  // Check for SCE-specific files
  const kiroFiles = [
    '.kiro/steering',
    '.kiro/specs',
    '.kiro/tools'
  ];

  for (const file of kiroFiles) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      indicators.push(`${file} exists`);
      confidence = 'high';
    }
  }

  // Check for environment variables (if running in SCE)
  if (process.env.KIRO_IDE === 'true' || process.env.KIRO_VERSION) {
    indicators.push('SCE environment variables detected');
    detected = true;
    confidence = 'high';
  }

  return {
    detected,
    confidence,
    indicators,
    features: detected ? ['agent-hooks', 'native-integration'] : []
  };
}

/**
 * Detect VS Code
 * 
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Detection result
 */
async function detectVSCode(projectPath) {
  const indicators = [];
  let detected = false;
  let confidence = 'low';

  // Check for .vscode directory
  const vscodeDir = path.join(projectPath, '.vscode');
  if (await fs.pathExists(vscodeDir)) {
    indicators.push('.vscode directory exists');
    detected = true;
    confidence = 'medium';
  }

  // Check for VS Code specific files
  const vscodeFiles = [
    '.vscode/settings.json',
    '.vscode/launch.json',
    '.vscode/tasks.json'
  ];

  for (const file of vscodeFiles) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      indicators.push(`${file} exists`);
      confidence = 'high';
    }
  }

  // Check for environment variables
  if (process.env.VSCODE_PID || process.env.TERM_PROGRAM === 'vscode') {
    indicators.push('VS Code environment detected');
    detected = true;
    confidence = 'high';
  }

  return {
    detected,
    confidence,
    indicators,
    features: detected ? ['watch-mode', 'manual-workflows'] : []
  };
}

/**
 * Detect Cursor
 * 
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Detection result
 */
async function detectCursor(projectPath) {
  const indicators = [];
  let detected = false;
  let confidence = 'low';

  // Cursor uses similar structure to VS Code
  const vscodeDir = path.join(projectPath, '.vscode');
  if (await fs.pathExists(vscodeDir)) {
    indicators.push('.vscode directory exists (Cursor compatible)');
    detected = true;
    confidence = 'low'; // Could be VS Code or Cursor
  }

  // Check for Cursor-specific indicators
  if (process.env.CURSOR_VERSION || process.env.TERM_PROGRAM === 'cursor') {
    indicators.push('Cursor environment detected');
    detected = true;
    confidence = 'high';
  }

  // Check for Cursor-specific settings
  const settingsPath = path.join(projectPath, '.vscode/settings.json');
  if (await fs.pathExists(settingsPath)) {
    try {
      const settings = await fs.readJson(settingsPath);
      if (settings['cursor.aiEnabled'] !== undefined || 
          settings['cursor.chat'] !== undefined) {
        indicators.push('Cursor-specific settings found');
        confidence = 'high';
      }
    } catch (error) {
      // Ignore JSON parse errors
    }
  }

  return {
    detected,
    confidence,
    indicators,
    features: detected ? ['watch-mode', 'manual-workflows', 'ai-integration'] : []
  };
}

/**
 * Get recommendations based on detected tool
 * 
 * @param {string} primaryTool - Primary tool name
 * @param {Object} detections - All detections
 * @returns {Array} Recommendations
 */
function getRecommendations(primaryTool, detections) {
  const recommendations = [];

  switch (primaryTool) {
    case 'SCE':
      recommendations.push({
        type: 'native',
        title: 'Use SCE Agent Hooks',
        description: 'You can use native SCE agent hooks for seamless automation',
        action: 'Configure hooks in .kiro/hooks/'
      });
      recommendations.push({
        type: 'optional',
        title: 'Watch Mode Available',
        description: 'Watch mode is also available as a fallback option',
        action: 'Run: sce watch init'
      });
      break;

    case 'vscode':
    case 'cursor':
      recommendations.push({
        type: 'primary',
        title: 'Use Watch Mode',
        description: 'Watch mode provides automated file monitoring for your IDE',
        action: 'Run: sce watch init && sce watch install auto-sync'
      });
      recommendations.push({
        type: 'preset',
        title: 'Install Presets',
        description: 'Pre-configured automation patterns for common workflows',
        action: 'Run: sce watch presets'
      });
      break;

    case 'other':
    default:
      recommendations.push({
        type: 'manual',
        title: 'Manual Workflows',
        description: 'Follow documented manual workflows for your tool',
        action: 'See: docs/cross-tool-guide.md'
      });
      recommendations.push({
        type: 'watch',
        title: 'Try Watch Mode',
        description: 'Watch mode works with most editors and IDEs',
        action: 'Run: sce watch init'
      });
      break;
  }

  return recommendations;
}

/**
 * Get automation suggestions based on tool
 * 
 * @param {string} tool - Tool name
 * @returns {Array} Suggestions
 */
function getAutomationSuggestions(tool) {
  const suggestions = {
    SCE: [
      'Configure agent hooks for automatic task sync',
      'Set up prompt regeneration on spec changes',
      'Enable context export on task completion'
    ],
    vscode: [
      'Install auto-sync preset for task synchronization',
      'Use watch mode for automated workflows',
      'Configure VS Code tasks for manual triggers'
    ],
    cursor: [
      'Install auto-sync preset for task synchronization',
      'Use watch mode for automated workflows',
      'Leverage Cursor AI for enhanced productivity'
    ],
    other: [
      'Follow manual workflow documentation',
      'Consider using watch mode for automation',
      'Set up shell aliases for common commands'
    ]
  };

  return suggestions[tool] || suggestions.other;
}

/**
 * Generate auto-configuration for detected tool
 * 
 * @param {Object} detection - Detection result from detectTool
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Auto-configuration result
 */
async function generateAutoConfig(detection, projectPath) {
  const { primaryTool, confidence } = detection;
  
  const config = {
    tool: primaryTool,
    confidence,
    suggestedPresets: [],
    suggestedCommands: [],
    configPath: null,
    notes: []
  };

  switch (primaryTool) {
    case 'SCE':
      config.suggestedPresets = [];
      config.suggestedCommands = [
        'Use native SCE agent hooks (see .kiro/hooks/)',
        'Optional: sce watch init (for watch mode fallback)'
      ];
      config.notes.push('AI IDE detected - native hooks are recommended');
      config.notes.push('Watch mode available as fallback option');
      break;

    case 'vscode':
    case 'cursor':
      config.suggestedPresets = ['auto-sync', 'prompt-regen', 'context-export'];
      config.suggestedCommands = [
        'sce watch init',
        'sce watch install auto-sync',
        'sce watch start'
      ];
      config.configPath = path.join(projectPath, '.kiro/watch-config.json');
      config.notes.push(`${primaryTool === 'vscode' ? 'VS Code' : 'Cursor'} detected - watch mode recommended`);
      config.notes.push('Run suggested commands to set up automation');
      break;

    case 'other':
    default:
      config.suggestedPresets = ['auto-sync'];
      config.suggestedCommands = [
        'sce watch init',
        'sce watch install auto-sync',
        'See: docs/cross-tool-guide.md for manual workflows'
      ];
      config.notes.push('No specific IDE detected');
      config.notes.push('Watch mode available for basic automation');
      config.notes.push('Manual workflows documented in docs/');
      break;
  }

  return config;
}

/**
 * Offer to install presets interactively
 * 
 * @param {Object} detection - Detection result from detectTool
 * @param {string} projectPath - Project root path
 * @returns {Promise<Object>} Installation result
 */
async function offerPresetInstallation(detection, projectPath) {
  const config = await generateAutoConfig(detection, projectPath);
  
  return {
    success: true,
    config,
    message: 'Auto-configuration generated successfully'
  };
}

module.exports = {
  detectTool,
  detectKiroIDE,
  detectVSCode,
  detectCursor,
  getRecommendations,
  getAutomationSuggestions,
  generateAutoConfig,
  offerPresetInstallation
};
