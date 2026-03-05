const fs = require('fs-extra');
const path = require('path');

const DEFAULT_POLICY_PATH = path.join('.sce', 'config', 'task-quality-policy.json');

const DEFAULT_TASK_QUALITY_POLICY = Object.freeze({
  schema_version: '1.0',
  min_quality_score: 70,
  require_acceptance_criteria: true,
  allow_needs_split: false,
  auto_suggest_acceptance: true,
  max_sub_goals: 3
});

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeText(`${value || ''}`).toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizePolicy(payload = {}) {
  const policy = payload && typeof payload === 'object' ? payload : {};
  return {
    schema_version: normalizeText(policy.schema_version) || DEFAULT_TASK_QUALITY_POLICY.schema_version,
    min_quality_score: toPositiveInteger(
      policy.min_quality_score,
      DEFAULT_TASK_QUALITY_POLICY.min_quality_score
    ),
    require_acceptance_criteria: normalizeBoolean(
      policy.require_acceptance_criteria,
      DEFAULT_TASK_QUALITY_POLICY.require_acceptance_criteria
    ),
    allow_needs_split: normalizeBoolean(
      policy.allow_needs_split,
      DEFAULT_TASK_QUALITY_POLICY.allow_needs_split
    ),
    auto_suggest_acceptance: normalizeBoolean(
      policy.auto_suggest_acceptance,
      DEFAULT_TASK_QUALITY_POLICY.auto_suggest_acceptance
    ),
    max_sub_goals: toPositiveInteger(
      policy.max_sub_goals,
      DEFAULT_TASK_QUALITY_POLICY.max_sub_goals
    )
  };
}

async function loadTaskQualityPolicy(projectPath, policyPath, fileSystem = fs) {
  const resolvedPath = normalizeText(policyPath) || DEFAULT_POLICY_PATH;
  const absolutePath = path.isAbsolute(resolvedPath)
    ? resolvedPath
    : path.join(projectPath, resolvedPath);

  if (!await fileSystem.pathExists(absolutePath)) {
    return {
      policy: normalizePolicy(DEFAULT_TASK_QUALITY_POLICY),
      path: resolvedPath,
      loaded_from: 'default'
    };
  }

  try {
    const payload = await fileSystem.readJson(absolutePath);
    return {
      policy: normalizePolicy(payload),
      path: resolvedPath,
      loaded_from: 'file'
    };
  } catch (_error) {
    return {
      policy: normalizePolicy(DEFAULT_TASK_QUALITY_POLICY),
      path: resolvedPath,
      loaded_from: 'default'
    };
  }
}

module.exports = {
  DEFAULT_POLICY_PATH,
  DEFAULT_TASK_QUALITY_POLICY,
  normalizePolicy,
  loadTaskQualityPolicy
};
