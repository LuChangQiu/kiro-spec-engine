const path = require('path');

function normalizeSchemaScope(scopeCandidate) {
  const allowed = new Set([
    'close-loop-session',
    'batch-session',
    'controller-session',
    'governance-session'
  ]);
  const raw = `${scopeCandidate || 'all'}`.trim().toLowerCase();
  const tokens = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (tokens.length === 0 || tokens.includes('all')) {
    return [...allowed];
  }
  const normalized = [];
  for (const token of tokens) {
    if (!allowed.has(token)) {
      throw new Error('--only must be one of: all, close-loop-session, batch-session, controller-session, governance-session');
    }
    if (!normalized.includes(token)) {
      normalized.push(token);
    }
  }
  return normalized;
}

function normalizeTargetSchemaVersion(targetVersionCandidate) {
  const normalized = `${targetVersionCandidate || ''}`.trim();
  if (!normalized) {
    throw new Error('--target-version is required.');
  }
  if (normalized.length > 32) {
    throw new Error('--target-version must be 32 characters or fewer.');
  }
  return normalized;
}

function getAutoArchiveSchemaTargets(projectPath, scope, dependencies = {}) {
  const {
    getCloseLoopSessionDir,
    getCloseLoopBatchSummaryDir,
    getCloseLoopControllerSessionDir,
    getGovernanceCloseLoopSessionDir
  } = dependencies;
  const allTargets = [
    { id: 'close-loop-session', directory: getCloseLoopSessionDir(projectPath) },
    { id: 'batch-session', directory: getCloseLoopBatchSummaryDir(projectPath) },
    { id: 'controller-session', directory: getCloseLoopControllerSessionDir(projectPath) },
    { id: 'governance-session', directory: getGovernanceCloseLoopSessionDir(projectPath) }
  ];
  const scopeSet = new Set(scope);
  return allTargets.filter((item) => scopeSet.has(item.id));
}

function classifyArchiveSchemaCompatibility(schemaVersion, supportedVersions) {
  const normalized = typeof schemaVersion === 'string' ? schemaVersion.trim() : '';
  if (!normalized) {
    return 'missing_schema_version';
  }
  if (supportedVersions.has(normalized)) {
    return 'compatible';
  }
  return 'incompatible';
}

async function checkAutoArchiveSchema(projectPath, options = {}, dependencies = {}) {
  const {
    fs,
    calculatePercent,
    getCloseLoopSessionDir,
    getCloseLoopBatchSummaryDir,
    getCloseLoopControllerSessionDir,
    getGovernanceCloseLoopSessionDir,
    supportedVersions,
    now = () => new Date()
  } = dependencies;
  const scope = normalizeSchemaScope(options.only);
  const targets = getAutoArchiveSchemaTargets(projectPath, scope, {
    getCloseLoopSessionDir,
    getCloseLoopBatchSummaryDir,
    getCloseLoopControllerSessionDir,
    getGovernanceCloseLoopSessionDir
  });
  const archives = [];

  for (const target of targets) {
    const archiveSummary = {
      id: target.id,
      directory: target.directory,
      total_files: 0,
      compatible_files: 0,
      missing_schema_version_files: 0,
      incompatible_files: 0,
      parse_error_files: 0,
      issues: []
    };
    if (!(await fs.pathExists(target.directory))) {
      archives.push(archiveSummary);
      continue;
    }
    const files = (await fs.readdir(target.directory))
      .filter((item) => item.toLowerCase().endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));
    archiveSummary.total_files = files.length;

    for (const file of files) {
      const filePath = path.join(target.directory, file);
      let payload = null;
      try {
        payload = await fs.readJson(filePath);
      } catch (error) {
        archiveSummary.parse_error_files += 1;
        archiveSummary.issues.push({ file: filePath, compatibility: 'parse_error', error: error.message });
        continue;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        archiveSummary.parse_error_files += 1;
        archiveSummary.issues.push({ file: filePath, compatibility: 'parse_error', error: 'invalid JSON root type' });
        continue;
      }
      const schemaVersion = typeof payload.schema_version === 'string' ? payload.schema_version.trim() : '';
      const compatibility = classifyArchiveSchemaCompatibility(schemaVersion, supportedVersions);
      if (compatibility === 'compatible') {
        archiveSummary.compatible_files += 1;
      } else if (compatibility === 'missing_schema_version') {
        archiveSummary.missing_schema_version_files += 1;
        archiveSummary.issues.push({ file: filePath, compatibility, schema_version: null });
      } else {
        archiveSummary.incompatible_files += 1;
        archiveSummary.issues.push({ file: filePath, compatibility, schema_version: schemaVersion });
      }
    }
    archives.push(archiveSummary);
  }

  const totals = archives.reduce((acc, item) => ({
    total_files: acc.total_files + item.total_files,
    compatible_files: acc.compatible_files + item.compatible_files,
    missing_schema_version_files: acc.missing_schema_version_files + item.missing_schema_version_files,
    incompatible_files: acc.incompatible_files + item.incompatible_files,
    parse_error_files: acc.parse_error_files + item.parse_error_files
  }), {
    total_files: 0,
    compatible_files: 0,
    missing_schema_version_files: 0,
    incompatible_files: 0,
    parse_error_files: 0
  });

  const nowValue = now();
  return {
    mode: 'auto-schema-check',
    generated_at: nowValue instanceof Date ? nowValue.toISOString() : new Date(nowValue).toISOString(),
    supported_versions: [...supportedVersions],
    scope,
    summary: {
      ...totals,
      compatibility_rate_percent: calculatePercent(totals.compatible_files, totals.total_files)
    },
    archives
  };
}

async function migrateAutoArchiveSchema(projectPath, options = {}, dependencies = {}) {
  const {
    fs,
    getCloseLoopSessionDir,
    getCloseLoopBatchSummaryDir,
    getCloseLoopControllerSessionDir,
    getGovernanceCloseLoopSessionDir,
    defaultVersion,
    now = () => new Date()
  } = dependencies;
  const scope = normalizeSchemaScope(options.only);
  const targetVersion = normalizeTargetSchemaVersion(options.targetVersion || defaultVersion);
  const dryRun = !options.apply;
  const targets = getAutoArchiveSchemaTargets(projectPath, scope, {
    getCloseLoopSessionDir,
    getCloseLoopBatchSummaryDir,
    getCloseLoopControllerSessionDir,
    getGovernanceCloseLoopSessionDir
  });
  const archives = [];

  for (const target of targets) {
    const archiveSummary = {
      id: target.id,
      directory: target.directory,
      total_files: 0,
      candidate_files: 0,
      updated_files: 0,
      skipped_compatible_files: 0,
      parse_error_files: 0,
      updates: [],
      errors: []
    };
    if (!(await fs.pathExists(target.directory))) {
      archives.push(archiveSummary);
      continue;
    }

    const files = (await fs.readdir(target.directory))
      .filter((item) => item.toLowerCase().endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));
    archiveSummary.total_files = files.length;

    for (const file of files) {
      const filePath = path.join(target.directory, file);
      let payload = null;
      try {
        payload = await fs.readJson(filePath);
      } catch (error) {
        archiveSummary.parse_error_files += 1;
        archiveSummary.errors.push({ file: filePath, error: error.message });
        continue;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        archiveSummary.parse_error_files += 1;
        archiveSummary.errors.push({ file: filePath, error: 'invalid JSON root type' });
        continue;
      }

      const previousVersion = typeof payload.schema_version === 'string' ? payload.schema_version.trim() : '';
      if (previousVersion === targetVersion) {
        archiveSummary.skipped_compatible_files += 1;
        continue;
      }

      archiveSummary.candidate_files += 1;
      if (dryRun) {
        archiveSummary.updates.push({ file: filePath, from: previousVersion || null, to: targetVersion });
        continue;
      }

      payload.schema_version = targetVersion;
      await fs.writeJson(filePath, payload, { spaces: 2 });
      archiveSummary.updated_files += 1;
      archiveSummary.updates.push({ file: filePath, from: previousVersion || null, to: targetVersion });
    }
    archives.push(archiveSummary);
  }

  const totals = archives.reduce((acc, item) => ({
    total_files: acc.total_files + item.total_files,
    candidate_files: acc.candidate_files + item.candidate_files,
    updated_files: acc.updated_files + item.updated_files,
    skipped_compatible_files: acc.skipped_compatible_files + item.skipped_compatible_files,
    parse_error_files: acc.parse_error_files + item.parse_error_files
  }), {
    total_files: 0,
    candidate_files: 0,
    updated_files: 0,
    skipped_compatible_files: 0,
    parse_error_files: 0
  });

  const nowValue = now();
  return {
    mode: 'auto-schema-migrate',
    generated_at: nowValue instanceof Date ? nowValue.toISOString() : new Date(nowValue).toISOString(),
    dry_run: dryRun,
    target_version: targetVersion,
    scope,
    summary: totals,
    archives
  };
}

module.exports = {
  normalizeSchemaScope,
  normalizeTargetSchemaVersion,
  getAutoArchiveSchemaTargets,
  classifyArchiveSchemaCompatibility,
  checkAutoArchiveSchema,
  migrateAutoArchiveSchema
};
