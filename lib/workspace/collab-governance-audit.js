'use strict';

const fs = require('fs-extra');
const path = require('path');
const { minimatch } = require('minimatch');
const { loadGitSnapshot } = require('./spec-delivery-audit');
const SteeringComplianceChecker = require('../steering/steering-compliance-checker');

const MAX_SCAN_BYTES = 256 * 1024;
const ACTIVE_TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml'
]);

const ACTIVE_TEXT_SCAN_ROOTS = Object.freeze([
  '.github',
  'bin',
  'docs',
  'lib',
  'README.md',
  'README.zh.md',
  'scripts',
  'template'
]);

const ACTIVE_TEXT_SCAN_EXCLUDES = Object.freeze([
  '.git/**',
  '.sce/specs/**',
  'CHANGELOG.md',
  'coverage/**',
  'dist/**',
  'build/**',
  'docs/handoffs/**',
  'docs/releases/**',
  'docs/zh/releases/**',
  'node_modules/**',
  'tests/**'
]);

const LEGACY_REFERENCE_REGEX = /\.kiro(?:[\\/]|-workspaces\b)/;
const MULTI_AGENT_CONFIG_REFERENCE = '.sce/config/multi-agent.json';
const ERRORBOOK_REGISTRY_CONFIG_PATH = '.sce/config/errorbook-registry.json';
const PROJECT_SHARED_ERRORBOOK_REGISTRY_PATH = '.sce/knowledge/errorbook/project-shared-registry.json';
const PROJECT_SHARED_ERRORBOOK_SOURCE_NAME = 'project-shared';
const ADOPTION_CONFIG_PATH = '.sce/adoption-config.json';

const REQUIRED_GITIGNORE_RULES = Object.freeze([
  { rule: '.sce/steering/CURRENT_CONTEXT.md', sample: '.sce/steering/CURRENT_CONTEXT.md' },
  { rule: '.sce/contexts/.active', sample: '.sce/contexts/.active' },
  { rule: '.sce/contexts/*/CURRENT_CONTEXT.md', sample: '.sce/contexts/alice/CURRENT_CONTEXT.md' },
  { rule: '.sce/config/agent-registry.json', sample: '.sce/config/agent-registry.json' },
  { rule: '.sce/config/coordination-log.json', sample: '.sce/config/coordination-log.json' },
  { rule: '.sce/config/machine-id.json', sample: '.sce/config/machine-id.json' },
  { rule: '.sce/specs/**/.lock', sample: '.sce/specs/demo/.lock' },
  { rule: '.sce/specs/**/locks/', sample: '.sce/specs/demo/locks/1.1.lock' },
  { rule: '.sce/specs/**/tasks.md.lock', sample: '.sce/specs/demo/tasks.md.lock' },
  { rule: '.sce/steering/*.lock', sample: '.sce/steering/CURRENT_CONTEXT.md.lock' },
  { rule: '.sce/steering/*.pending.*', sample: '.sce/steering/CURRENT_CONTEXT.md.pending.agent-1' }
]);

const RUNTIME_TRACKED_PATTERNS = Object.freeze([
  '.sce/steering/CURRENT_CONTEXT.md',
  '.sce/contexts/.active',
  '.sce/contexts/*/CURRENT_CONTEXT.md',
  '.sce/config/agent-registry.json',
  '.sce/config/coordination-log.json',
  '.sce/config/machine-id.json',
  '.sce/specs/**/.lock',
  '.sce/specs/**/locks/**',
  '.sce/specs/**/tasks.md.lock',
  '.sce/steering/*.lock',
  '.sce/steering/*.pending.*'
]);

function toRelativePosix(projectRoot, targetPath) {
  return path.relative(projectRoot, targetPath).replace(/\\/g, '/');
}

function normalizeRelativePath(projectRoot, candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return null;
  }

  const absolutePath = path.isAbsolute(candidate)
    ? candidate
    : path.join(projectRoot, candidate);
  const relativePath = toRelativePosix(projectRoot, absolutePath);
  if (!relativePath || relativePath.startsWith('..')) {
    return null;
  }
  return relativePath;
}

function matchesAnyPattern(candidate, patterns) {
  return patterns.some((pattern) => minimatch(candidate, pattern, { dot: true }));
}

function shouldExcludeFromActiveScan(relativePath) {
  return matchesAnyPattern(relativePath, ACTIVE_TEXT_SCAN_EXCLUDES);
}

function isActiveTextCandidate(relativePath) {
  if (!relativePath || shouldExcludeFromActiveScan(relativePath)) {
    return false;
  }

  const normalized = `${relativePath}`.replace(/\\/g, '/');
  const exactRoot = ACTIVE_TEXT_SCAN_ROOTS.find((item) => !item.includes('/') && item === normalized);
  if (exactRoot) {
    return true;
  }

  const underRoot = ACTIVE_TEXT_SCAN_ROOTS.some((root) => {
    if (!root.includes('/')) {
      return normalized.startsWith(`${root}/`);
    }
    return normalized === root || normalized.startsWith(`${root}/`);
  });
  if (!underRoot) {
    return false;
  }

  return ACTIVE_TEXT_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function parseGitignore(content) {
  return `${content || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'));
}

function gitignorePatternMatchesSample(pattern, sample) {
  const normalizedPattern = `${pattern || ''}`.replace(/\\/g, '/').trim();
  const normalizedSample = `${sample || ''}`.replace(/\\/g, '/').trim();
  if (!normalizedPattern || !normalizedSample) {
    return false;
  }

  if (normalizedPattern === normalizedSample) {
    return true;
  }

  const matchPattern = normalizedPattern.endsWith('/')
    ? `${normalizedPattern}**`
    : normalizedPattern;
  return minimatch(normalizedSample, matchPattern, { dot: true });
}

async function collectCandidateTextFiles(projectRoot, trackedFiles, fileSystem) {
  const results = [];
  const visited = new Set();

  if (trackedFiles instanceof Set && trackedFiles.size > 0) {
    for (const relativePath of trackedFiles) {
      if (!isActiveTextCandidate(relativePath) || visited.has(relativePath)) {
        continue;
      }
      visited.add(relativePath);
      results.push(relativePath);
    }
  }

  async function walk(relativePath) {
    const absolutePath = path.join(projectRoot, relativePath);
    let stats;
    try {
      stats = await fileSystem.stat(absolutePath);
    } catch (_error) {
      return;
    }

    if (stats.isDirectory()) {
      let entries = [];
      try {
        entries = await fileSystem.readdir(absolutePath, { withFileTypes: true });
      } catch (_error) {
        return;
      }
      for (const entry of entries) {
        const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (shouldExcludeFromActiveScan(childRelative)) {
          continue;
        }
        await walk(childRelative);
      }
      return;
    }

    if (!stats.isFile()) {
      return;
    }

    if (!isActiveTextCandidate(relativePath) || visited.has(relativePath)) {
      return;
    }
    visited.add(relativePath);
    results.push(relativePath);
  }

  for (const root of ACTIVE_TEXT_SCAN_ROOTS) {
    const normalized = normalizeRelativePath(projectRoot, root);
    if (!normalized) {
      continue;
    }
    await walk(normalized);
  }

  return results.sort();
}

function summarizeLine(line) {
  const trimmed = `${line || ''}`.trim();
  if (trimmed.length <= 160) {
    return trimmed;
  }
  return `${trimmed.slice(0, 157)}...`;
}

async function scanActiveTextReferences(projectRoot, trackedFiles, options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const candidateFiles = Array.isArray(options.candidateFiles)
    ? options.candidateFiles
    : await collectCandidateTextFiles(projectRoot, trackedFiles, fileSystem);

  const legacyMatches = [];
  const multiAgentConfigReferences = [];

  for (const relativePath of candidateFiles) {
    const absolutePath = path.join(projectRoot, relativePath);
    let stats;
    try {
      stats = await fileSystem.stat(absolutePath);
    } catch (_error) {
      continue;
    }
    if (!stats.isFile() || stats.size > MAX_SCAN_BYTES) {
      continue;
    }

    let content;
    try {
      content = await fileSystem.readFile(absolutePath, 'utf8');
    } catch (_error) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (LEGACY_REFERENCE_REGEX.test(line)) {
        legacyMatches.push({
          path: relativePath,
          line: index + 1,
          snippet: summarizeLine(line)
        });
      }
      if (line.includes(MULTI_AGENT_CONFIG_REFERENCE)) {
        multiAgentConfigReferences.push({
          path: relativePath,
          line: index + 1,
          snippet: summarizeLine(line)
        });
      }
    }
  }

  return {
    candidate_files: candidateFiles,
    legacy_matches: legacyMatches,
    multi_agent_config_references: multiAgentConfigReferences
  };
}

async function inspectGitignore(projectRoot, options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const exists = await fileSystem.pathExists(gitignorePath);
  const report = {
    file: '.gitignore',
    exists,
    required_rules: REQUIRED_GITIGNORE_RULES.map((item) => item.rule),
    missing_rules: [],
    warnings: [],
    violations: [],
    passed: true,
    reason: 'passed'
  };

  if (!exists) {
    report.passed = false;
    report.reason = 'missing-gitignore';
    report.violations.push('missing .gitignore');
    return report;
  }

  const patterns = parseGitignore(await fileSystem.readFile(gitignorePath, 'utf8'));
  report.missing_rules = REQUIRED_GITIGNORE_RULES
    .filter((rule) => !patterns.some((pattern) => gitignorePatternMatchesSample(pattern, rule.sample)))
    .map((rule) => rule.rule);

  if (report.missing_rules.length > 0) {
    report.passed = false;
    report.reason = 'missing-rules';
    report.violations.push(...report.missing_rules.map((rule) => `missing ignore rule: ${rule}`));
  }

  return report;
}

function inspectRuntimeTracking(gitSnapshot) {
  const trackedFiles = gitSnapshot && gitSnapshot.tracked_files instanceof Set
    ? [...gitSnapshot.tracked_files]
    : [];
  const trackedRuntimeFiles = trackedFiles
    .filter((relativePath) => matchesAnyPattern(relativePath, RUNTIME_TRACKED_PATTERNS))
    .sort();

  if (!gitSnapshot || gitSnapshot.available !== true) {
    return {
      available: false,
      tracked_runtime_files: [],
      warnings: ['git repository unavailable; runtime tracking audit is advisory only'],
      violations: [],
      passed: true,
      reason: 'git-unavailable'
    };
  }

  const passed = trackedRuntimeFiles.length === 0;
  return {
    available: true,
    tracked_runtime_files: trackedRuntimeFiles,
    warnings: [],
    violations: trackedRuntimeFiles.map((item) => `runtime/personal state tracked by git: ${item}`),
    passed,
    reason: passed ? 'passed' : 'tracked-runtime-files'
  };
}

function validateMultiAgentConfig(payload) {
  const violations = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    violations.push('multi-agent config must be a JSON object');
    return violations;
  }

  if (typeof payload.enabled !== 'boolean') {
    violations.push('multi-agent config must declare boolean field "enabled"');
  }
  if (
    payload.heartbeatIntervalMs !== undefined
    && (!Number.isInteger(payload.heartbeatIntervalMs) || payload.heartbeatIntervalMs <= 0)
  ) {
    violations.push('multi-agent config field "heartbeatIntervalMs" must be a positive integer');
  }
  if (
    payload.heartbeatTimeoutMs !== undefined
    && (!Number.isInteger(payload.heartbeatTimeoutMs) || payload.heartbeatTimeoutMs <= 0)
  ) {
    violations.push('multi-agent config field "heartbeatTimeoutMs" must be a positive integer');
  }
  if (
    Number.isInteger(payload.heartbeatIntervalMs)
    && Number.isInteger(payload.heartbeatTimeoutMs)
    && payload.heartbeatTimeoutMs <= payload.heartbeatIntervalMs
  ) {
    violations.push('"heartbeatTimeoutMs" must be greater than "heartbeatIntervalMs"');
  }
  return violations;
}

function validateErrorbookRegistryConfig(payload) {
  const violations = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    violations.push('errorbook registry config must be a JSON object');
    return violations;
  }

  if (typeof payload.enabled !== 'boolean') {
    violations.push('errorbook registry config must declare boolean field "enabled"');
  } else if (payload.enabled !== true) {
    violations.push('errorbook registry config must keep "enabled" set to true under co-work baseline');
  }

  if (typeof payload.cache_file !== 'string' || !payload.cache_file.trim()) {
    violations.push('errorbook registry config must declare non-empty field "cache_file"');
  }

  const projection = payload.project_shared_projection;
  if (!projection || typeof projection !== 'object' || Array.isArray(projection)) {
    violations.push('errorbook registry config must declare object field "project_shared_projection"');
  } else {
    if (projection.enabled !== true) {
      violations.push('errorbook registry config must keep project_shared_projection.enabled=true under co-work baseline');
    }
    if (typeof projection.file !== 'string' || !projection.file.trim()) {
      violations.push('errorbook registry config must declare non-empty project_shared_projection.file');
    }
    if (!Array.isArray(projection.statuses) || projection.statuses.length === 0) {
      violations.push('errorbook registry config must declare non-empty project_shared_projection.statuses');
    }
    if (!Number.isFinite(Number(projection.min_quality))) {
      violations.push('errorbook registry config must declare numeric project_shared_projection.min_quality');
    }
  }

  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  if (sources.length === 0) {
    violations.push('errorbook registry config must declare at least one registry source');
    return violations;
  }

  const enabledSources = sources.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false;
    }
    const enabled = item.enabled !== false;
    const source = typeof item.url === 'string' && item.url.trim()
      ? item.url.trim()
      : typeof item.file === 'string' && item.file.trim()
        ? item.file.trim()
        : typeof item.path === 'string' && item.path.trim()
          ? item.path.trim()
          : '';
    return enabled && Boolean(source);
  });

  if (enabledSources.length === 0) {
    violations.push('errorbook registry config must keep at least one enabled source with a non-empty url/file');
  }

  if (projection && typeof projection === 'object' && !Array.isArray(projection)) {
    const hasProjectSharedSource = enabledSources.some((item) => {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const file = typeof item.file === 'string' ? item.file.trim() : '';
      const sourcePath = typeof item.path === 'string' ? item.path.trim() : '';
      return name === PROJECT_SHARED_ERRORBOOK_SOURCE_NAME
        || file === projection.file
        || sourcePath === projection.file;
    });
    if (!hasProjectSharedSource) {
      violations.push('errorbook registry config must keep an enabled project-shared source aligned with project_shared_projection.file');
    }
  }

  return violations;
}

async function inspectErrorbookRegistry(projectRoot, gitSnapshot, options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const configPath = path.join(projectRoot, '.sce', 'config', 'errorbook-registry.json');
  const exists = await fileSystem.pathExists(configPath);
  const report = {
    file: ERRORBOOK_REGISTRY_CONFIG_PATH,
    exists,
    valid: false,
    enabled: null,
    enabled_source_count: 0,
    project_shared_projection_file: PROJECT_SHARED_ERRORBOOK_REGISTRY_PATH,
    project_shared_projection_exists: false,
    project_shared_projection_tracked: null,
    warnings: [],
    violations: [],
    passed: true,
    reason: 'passed'
  };

  if (!exists) {
    report.passed = false;
    report.reason = 'missing-config';
    report.violations.push('shared errorbook registry config is missing');
    return report;
  }

  let payload;
  try {
    payload = await fileSystem.readJson(configPath);
  } catch (error) {
    report.passed = false;
    report.reason = 'invalid-json';
    report.violations.push(`invalid errorbook registry config: ${error.message}`);
    return report;
  }

  const validationErrors = validateErrorbookRegistryConfig(payload);
  report.valid = validationErrors.length === 0;
  report.enabled = typeof payload.enabled === 'boolean' ? payload.enabled : null;
  report.project_shared_projection_file = payload
    && payload.project_shared_projection
    && typeof payload.project_shared_projection.file === 'string'
    && payload.project_shared_projection.file.trim()
    ? normalizeRelativePath(projectRoot, payload.project_shared_projection.file.trim()) || payload.project_shared_projection.file.trim()
    : PROJECT_SHARED_ERRORBOOK_REGISTRY_PATH;
  report.enabled_source_count = Array.isArray(payload.sources)
    ? payload.sources.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || item.enabled === false) {
        return false;
      }
      return (
        (typeof item.url === 'string' && item.url.trim())
        || (typeof item.file === 'string' && item.file.trim())
        || (typeof item.path === 'string' && item.path.trim())
      );
    }).length
    : 0;

  if (validationErrors.length > 0) {
    report.passed = false;
    report.reason = 'invalid-config';
    report.violations.push(...validationErrors);
    return report;
  }

  const projectionFile = report.project_shared_projection_file;
  const projectionAbsolutePath = path.isAbsolute(projectionFile)
    ? projectionFile
    : path.join(projectRoot, projectionFile);
  report.project_shared_projection_exists = await fileSystem.pathExists(projectionAbsolutePath);
  if (!report.project_shared_projection_exists) {
    report.passed = false;
    report.reason = 'missing-project-shared-projection';
    report.violations.push(`shared project errorbook projection file is missing: ${projectionFile}`);
    return report;
  }

  try {
    const projectionPayload = await fileSystem.readJson(projectionAbsolutePath);
    if (!projectionPayload || typeof projectionPayload !== 'object' || Array.isArray(projectionPayload)) {
      report.violations.push(`shared project errorbook projection must be a JSON object: ${projectionFile}`);
    } else if (!Array.isArray(projectionPayload.entries)) {
      report.violations.push(`shared project errorbook projection must declare entries[]: ${projectionFile}`);
    }
  } catch (error) {
    report.violations.push(`invalid shared project errorbook projection: ${error.message}`);
  }

  if (gitSnapshot && gitSnapshot.available === true) {
    report.project_shared_projection_tracked = gitSnapshot.tracked_files.has(projectionFile);
    if (report.project_shared_projection_tracked !== true) {
      report.violations.push(`shared project errorbook projection must be tracked by git: ${projectionFile}`);
    }
  }

  if (report.violations.length > 0) {
    report.passed = false;
    report.reason = 'invalid-config';
  }

  return report;
}

async function inspectErrorbookConvergence(projectRoot, options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const configPath = path.join(projectRoot, '.sce', 'adoption-config.json');
  const exists = await fileSystem.pathExists(configPath);
  const report = {
    file: ADOPTION_CONFIG_PATH,
    exists,
    managed_project: exists,
    warnings: [],
    violations: [],
    passed: true,
    reason: exists ? 'passed' : 'not-managed'
  };

  if (!exists) {
    return report;
  }

  let payload;
  try {
    payload = await fileSystem.readJson(configPath);
  } catch (error) {
    report.passed = false;
    report.reason = 'invalid-json';
    report.violations.push(`invalid adoption config: ${error.message}`);
    return report;
  }

  const convergence = payload
    && payload.defaults
    && payload.defaults.errorbook_convergence
    && typeof payload.defaults.errorbook_convergence === 'object'
    && !Array.isArray(payload.defaults.errorbook_convergence)
    ? payload.defaults.errorbook_convergence
    : null;

  if (!convergence) {
    report.passed = false;
    report.reason = 'missing-convergence';
    report.violations.push('managed adoption baseline is missing defaults.errorbook_convergence');
    return report;
  }

  if (convergence.enabled !== true) {
    report.violations.push('managed adoption baseline must keep errorbook_convergence.enabled=true');
  }
  if (convergence.canonical_mechanism !== 'errorbook') {
    report.violations.push('managed adoption baseline must keep errorbook_convergence.canonical_mechanism=errorbook');
  }
  if (convergence.disallow_parallel_mechanisms !== true) {
    report.violations.push('managed adoption baseline must keep errorbook_convergence.disallow_parallel_mechanisms=true');
  }
  if (convergence.strategy !== 'absorb_into_sce_errorbook') {
    report.violations.push('managed adoption baseline must keep errorbook_convergence.strategy=absorb_into_sce_errorbook');
  }

  if (report.violations.length > 0) {
    report.passed = false;
    report.reason = 'convergence-drift';
  }

  return report;
}

async function inspectMultiAgentConfig(projectRoot, scanResult, options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const configPath = path.join(projectRoot, '.sce', 'config', 'multi-agent.json');
  const exists = await fileSystem.pathExists(configPath);
  const runtimeTracePatterns = [
    '.sce/config/agent-registry.json',
    '.sce/config/coordination-log.json',
    '.sce/specs/**/locks/**',
    '.sce/specs/**/tasks.md.lock',
    '.sce/steering/*.lock',
    '.sce/steering/*.pending.*'
  ];

  const runtimeTracePaths = [];
  async function walk(relativePath) {
    const absolutePath = path.join(projectRoot, relativePath);
    let entries = [];
    try {
      entries = await fileSystem.readdir(absolutePath, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      const childRelative = `${relativePath}/${entry.name}`.replace(/\\/g, '/');
      if (entry.isDirectory()) {
        await walk(childRelative);
      } else if (matchesAnyPattern(childRelative, runtimeTracePatterns)) {
        runtimeTracePaths.push(childRelative);
      }
    }
  }

  for (const root of ['.sce/config', '.sce/specs', '.sce/steering']) {
    if (await fileSystem.pathExists(path.join(projectRoot, root))) {
      await walk(root);
    }
  }

  const report = {
    file: '.sce/config/multi-agent.json',
    exists,
    valid: false,
    enabled: null,
    runtime_traces: runtimeTracePaths.sort(),
    reference_count: Array.isArray(scanResult?.multi_agent_config_references)
      ? scanResult.multi_agent_config_references.length
      : 0,
    warnings: [],
    violations: [],
    passed: true,
    reason: 'not-configured'
  };

  if (!exists) {
    if (report.runtime_traces.length > 0) {
      report.passed = false;
      report.reason = 'missing-config';
      report.violations.push('multi-agent runtime traces detected but .sce/config/multi-agent.json is missing');
    } else if (report.reference_count > 0) {
      report.reason = 'missing-config-advisory';
      report.warnings.push('multi-agent config is referenced in active docs/code but project config is not seeded');
    }
    return report;
  }

  let payload;
  try {
    payload = await fileSystem.readJson(configPath);
  } catch (error) {
    report.passed = false;
    report.reason = 'invalid-json';
    report.violations.push(`invalid multi-agent config: ${error.message}`);
    return report;
  }

  const validationErrors = validateMultiAgentConfig(payload);
  report.valid = validationErrors.length === 0;
  report.enabled = typeof payload.enabled === 'boolean' ? payload.enabled : null;
  if (validationErrors.length > 0) {
    report.passed = false;
    report.reason = 'invalid-config';
    report.violations.push(...validationErrors);
    return report;
  }

  report.reason = 'passed';
  return report;
}

function inspectSteeringBoundary(projectRoot) {
  const checker = new SteeringComplianceChecker();
  const steeringPath = path.join(projectRoot, '.sce', 'steering');
  const result = checker.check(steeringPath);
  const violations = Array.isArray(result.violations) ? result.violations : [];
  return {
    path: '.sce/steering',
    exists: fs.existsSync(steeringPath),
    compliant: result.compliant === true,
    violations: violations.map((item) => {
      const relativePath = item.path ? normalizeRelativePath(projectRoot, item.path) : null;
      return {
        type: item.type,
        name: item.name,
        path: relativePath
      };
    }),
    warnings: [],
    passed: result.compliant === true,
    reason: result.compliant === true ? 'passed' : 'boundary-drift'
  };
}

async function auditCollabGovernance(projectRoot = process.cwd(), options = {}, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const gitSnapshot = loadGitSnapshot(projectRoot, { allowNoRemote: true }, dependencies);
  const gitignore = await inspectGitignore(projectRoot, options, dependencies);
  const runtimeTracking = inspectRuntimeTracking(gitSnapshot);
  const scanResult = await scanActiveTextReferences(projectRoot, gitSnapshot.tracked_files, options, dependencies);
  const multiAgent = await inspectMultiAgentConfig(projectRoot, scanResult, options, dependencies);
  const errorbookRegistry = await inspectErrorbookRegistry(projectRoot, gitSnapshot, options, dependencies);
  const errorbookConvergence = await inspectErrorbookConvergence(projectRoot, options, dependencies);
  const steeringBoundary = inspectSteeringBoundary(projectRoot);

  const legacyReferences = {
    matches: scanResult.legacy_matches,
    warnings: [],
    violations: scanResult.legacy_matches.map((item) => `legacy .kiro reference: ${item.path}:${item.line}`),
    passed: scanResult.legacy_matches.length === 0,
    reason: scanResult.legacy_matches.length === 0 ? 'passed' : 'legacy-references'
  };

  const report = {
    mode: 'workspace-collab-governance-audit',
    generated_at: new Date().toISOString(),
    root: projectRoot,
    git: {
      available: gitSnapshot.available === true,
      branch: gitSnapshot.branch,
      upstream: gitSnapshot.upstream,
      has_target_remote: gitSnapshot.has_target_remote === true,
      warnings: gitSnapshot.available === true ? gitSnapshot.warnings : []
    },
    gitignore,
    runtime_tracking: runtimeTracking,
    multi_agent: multiAgent,
    errorbook_registry: errorbookRegistry,
    errorbook_convergence: errorbookConvergence,
    legacy_references: legacyReferences,
    steering_boundary: steeringBoundary,
    summary: {
      missing_gitignore_rules: gitignore.missing_rules.length,
      tracked_runtime_files: runtimeTracking.tracked_runtime_files.length,
      multi_agent_warnings: multiAgent.warnings.length,
      multi_agent_violations: multiAgent.violations.length,
      errorbook_registry_violations: errorbookRegistry.violations.length,
      errorbook_convergence_violations: errorbookConvergence.violations.length,
      legacy_reference_count: legacyReferences.matches.length,
      steering_boundary_violations: steeringBoundary.violations.length
    },
    warnings: [],
    violations: [],
    passed: true,
    reason: 'passed'
  };

  report.warnings.push(...gitignore.warnings);
  report.warnings.push(...(gitSnapshot.available === true ? gitSnapshot.warnings : []));
  report.warnings.push(...runtimeTracking.warnings);
  report.warnings.push(...multiAgent.warnings);
  report.warnings.push(...errorbookRegistry.warnings);
  report.warnings.push(...errorbookConvergence.warnings);
  report.warnings.push(...legacyReferences.warnings);
  report.warnings.push(...steeringBoundary.warnings);

  report.violations.push(...gitignore.violations);
  report.violations.push(...runtimeTracking.violations);
  report.violations.push(...multiAgent.violations);
  report.violations.push(...errorbookRegistry.violations);
  report.violations.push(...errorbookConvergence.violations);
  report.violations.push(...legacyReferences.violations);
  report.violations.push(
    ...steeringBoundary.violations.map((item) => `steering boundary violation: ${item.path || item.name}`)
  );

  report.passed = report.violations.length === 0;
  report.reason = report.passed
    ? (report.warnings.length > 0 ? 'warnings' : 'passed')
    : 'violations';

  return report;
}

module.exports = {
  ACTIVE_TEXT_SCAN_EXCLUDES,
  ACTIVE_TEXT_SCAN_ROOTS,
  MULTI_AGENT_CONFIG_REFERENCE,
  REQUIRED_GITIGNORE_RULES,
  RUNTIME_TRACKED_PATTERNS,
  auditCollabGovernance,
  inspectGitignore,
  inspectErrorbookConvergence,
  inspectErrorbookRegistry,
  inspectMultiAgentConfig,
  inspectRuntimeTracking,
  scanActiveTextReferences,
  validateErrorbookRegistryConfig,
  validateMultiAgentConfig
};
