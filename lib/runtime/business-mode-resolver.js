'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_BUSINESS_MODE_POLICY = 'docs/interactive-customization/business-mode-policy-baseline.json';
const BUSINESS_MODES = new Set(['user-mode', 'ops-mode', 'dev-mode']);

const BUILTIN_POLICY = Object.freeze({
  version: '1.0.0',
  defaults: {
    mode: null,
    enforce_alignment: true
  },
  modes: {
    'user-mode': {
      execution_mode: 'suggestion',
      dialogue_profile: 'business-user',
      ui_mode: 'user-app',
      runtime_mode: 'user-assist',
      runtime_environment: 'staging',
      auto_execute_low_risk: false
    },
    'ops-mode': {
      execution_mode: 'apply',
      dialogue_profile: 'system-maintainer',
      ui_mode: 'ops-console',
      runtime_mode: 'ops-fix',
      runtime_environment: 'staging',
      auto_execute_low_risk: false
    },
    'dev-mode': {
      execution_mode: 'apply',
      dialogue_profile: 'system-maintainer',
      ui_mode: 'ops-console',
      runtime_mode: 'feature-dev',
      runtime_environment: 'dev',
      auto_execute_low_risk: false
    }
  }
});

function normalizeBusinessMode(value) {
  const normalized = `${value || ''}`.trim().toLowerCase();
  return normalized || null;
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) {
    return value;
  }
  return fallback;
}

function sanitizeModePreset(rawPreset = {}) {
  return {
    execution_mode: `${rawPreset.execution_mode || ''}`.trim().toLowerCase() || null,
    dialogue_profile: `${rawPreset.dialogue_profile || ''}`.trim().toLowerCase() || null,
    ui_mode: `${rawPreset.ui_mode || ''}`.trim().toLowerCase() || null,
    runtime_mode: `${rawPreset.runtime_mode || ''}`.trim().toLowerCase() || null,
    runtime_environment: `${rawPreset.runtime_environment || ''}`.trim().toLowerCase() || null,
    auto_execute_low_risk: normalizeBoolean(rawPreset.auto_execute_low_risk, false)
  };
}

function normalizePolicy(rawPolicy = {}) {
  const defaults = rawPolicy && typeof rawPolicy.defaults === 'object' ? rawPolicy.defaults : {};
  const rawModes = rawPolicy && rawPolicy.modes && typeof rawPolicy.modes === 'object'
    ? rawPolicy.modes
    : {};

  const mergedModes = {};
  for (const [modeKey, fallbackPreset] of Object.entries(BUILTIN_POLICY.modes)) {
    const overridePreset = rawModes[modeKey] && typeof rawModes[modeKey] === 'object'
      ? rawModes[modeKey]
      : null;
    mergedModes[modeKey] = sanitizeModePreset({
      ...fallbackPreset,
      ...(overridePreset || {})
    });
  }

  return {
    version: `${rawPolicy.version || BUILTIN_POLICY.version}`,
    defaults: {
      mode: normalizeBusinessMode(defaults.mode),
      enforce_alignment: normalizeBoolean(defaults.enforce_alignment, BUILTIN_POLICY.defaults.enforce_alignment)
    },
    modes: mergedModes
  };
}

function loadBusinessModePolicy({ cwd, policyPath }) {
  const policyRef = `${policyPath || DEFAULT_BUSINESS_MODE_POLICY}`.trim() || DEFAULT_BUSINESS_MODE_POLICY;
  const resolvedPath = path.isAbsolute(policyRef) ? policyRef : path.resolve(cwd, policyRef);

  if (!fs.existsSync(resolvedPath)) {
    return {
      policy: normalizePolicy(BUILTIN_POLICY),
      policy_path: resolvedPath,
      policy_source: 'builtin'
    };
  }

  try {
    const rawPolicy = fs.readJsonSync(resolvedPath);
    return {
      policy: normalizePolicy(rawPolicy),
      policy_path: resolvedPath,
      policy_source: 'file'
    };
  } catch (_error) {
    return {
      policy: normalizePolicy(BUILTIN_POLICY),
      policy_path: resolvedPath,
      policy_source: 'builtin'
    };
  }
}

function inferBusinessMode(options = {}) {
  const runtimeMode = `${options.runtimeMode || ''}`.trim().toLowerCase();
  const dialogueProfile = `${options.dialogueProfile || ''}`.trim().toLowerCase();
  const executionMode = `${options.executionMode || ''}`.trim().toLowerCase();

  if (runtimeMode === 'feature-dev') {
    return 'dev-mode';
  }
  if (dialogueProfile === 'system-maintainer' || executionMode === 'apply') {
    return 'ops-mode';
  }
  return 'user-mode';
}

function applyPresetDefaults(options = {}, explicitKeys = new Set(), preset = null) {
  if (!preset) {
    return;
  }

  if (!explicitKeys.has('executionMode') && preset.execution_mode) {
    options.executionMode = preset.execution_mode;
  }
  if (!explicitKeys.has('dialogueProfile') && preset.dialogue_profile) {
    options.dialogueProfile = preset.dialogue_profile;
  }
  if (!explicitKeys.has('uiMode') && preset.ui_mode) {
    options.uiMode = preset.ui_mode;
  }
  if (!explicitKeys.has('runtimeMode') && preset.runtime_mode) {
    options.runtimeMode = preset.runtime_mode;
  }
  if (!explicitKeys.has('runtimeEnvironment') && preset.runtime_environment) {
    options.runtimeEnvironment = preset.runtime_environment;
  }
  if (!explicitKeys.has('autoExecuteLowRisk') && typeof preset.auto_execute_low_risk === 'boolean') {
    options.autoExecuteLowRisk = preset.auto_execute_low_risk;
  }
}

function collectPresetConflicts(options = {}, preset = null) {
  if (!preset) {
    return [];
  }

  const checks = [
    { key: 'execution_mode', actual: `${options.executionMode || ''}`.trim().toLowerCase(), expected: preset.execution_mode },
    { key: 'dialogue_profile', actual: `${options.dialogueProfile || ''}`.trim().toLowerCase(), expected: preset.dialogue_profile },
    { key: 'ui_mode', actual: `${options.uiMode || ''}`.trim().toLowerCase(), expected: preset.ui_mode },
    { key: 'runtime_mode', actual: `${options.runtimeMode || ''}`.trim().toLowerCase(), expected: preset.runtime_mode },
    { key: 'runtime_environment', actual: `${options.runtimeEnvironment || ''}`.trim().toLowerCase(), expected: preset.runtime_environment }
  ];

  return checks
    .filter(item => item.expected && item.actual !== item.expected)
    .map(item => ({
      key: item.key,
      expected: item.expected,
      actual: item.actual || '(empty)'
    }));
}

function buildAlignmentError(mode, conflicts = []) {
  const summary = conflicts
    .map(item => `${item.key}: expected ${item.expected}, got ${item.actual}`)
    .join('; ');
  return `--business-mode ${mode} conflicts with explicit options (${summary}). Use --allow-mode-override to continue.`;
}

function applyBusinessModePolicy(options = {}, explicitKeys = new Set(), cwd = process.cwd()) {
  const policyInfo = loadBusinessModePolicy({
    cwd,
    policyPath: options.businessModePolicy || DEFAULT_BUSINESS_MODE_POLICY
  });

  const normalizedInputMode = normalizeBusinessMode(options.businessMode);
  const fallbackMode = policyInfo.policy.defaults.mode && BUSINESS_MODES.has(policyInfo.policy.defaults.mode)
    ? policyInfo.policy.defaults.mode
    : null;
  const resolvedMode = normalizedInputMode || fallbackMode || inferBusinessMode(options);
  const preset = policyInfo.policy.modes[resolvedMode] || null;
  const modeExplicitlyProvided = normalizedInputMode != null;
  const allowModeOverride = options.allowModeOverride === true;
  const enforceAlignment = policyInfo.policy.defaults.enforce_alignment === true;

  if (modeExplicitlyProvided) {
    applyPresetDefaults(options, explicitKeys, preset);
  }

  const conflicts = modeExplicitlyProvided ? collectPresetConflicts(options, preset) : [];
  if (modeExplicitlyProvided && enforceAlignment && !allowModeOverride && conflicts.length > 0) {
    throw new Error(buildAlignmentError(resolvedMode, conflicts));
  }

  options.businessMode = resolvedMode;
  options.businessModePolicy = options.businessModePolicy || DEFAULT_BUSINESS_MODE_POLICY;

  return {
    business_mode: resolvedMode,
    mode_explicit: modeExplicitlyProvided,
    allow_mode_override: allowModeOverride,
    policy_path: policyInfo.policy_path,
    policy_source: policyInfo.policy_source,
    preset,
    conflicts
  };
}

module.exports = {
  DEFAULT_BUSINESS_MODE_POLICY,
  BUSINESS_MODES,
  BUILTIN_POLICY,
  normalizeBusinessMode,
  normalizePolicy,
  loadBusinessModePolicy,
  inferBusinessMode,
  applyPresetDefaults,
  collectPresetConflicts,
  buildAlignmentError,
  applyBusinessModePolicy
};
