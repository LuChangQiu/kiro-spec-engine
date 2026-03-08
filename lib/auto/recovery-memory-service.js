const path = require('path');

function getCloseLoopRecoveryMemoryFile(projectPath, dependencies = {}) {
  const pathModule = dependencies.path || path;
  return pathModule.join(projectPath, '.sce', 'auto', 'close-loop-recovery-memory.json');
}

async function loadCloseLoopRecoveryMemory(projectPath, dependencies = {}) {
  const { fs, getCloseLoopRecoveryMemoryFile } = dependencies;
  const memoryFile = getCloseLoopRecoveryMemoryFile(projectPath);
  const fallbackPayload = {
    version: 1,
    signatures: {}
  };
  if (!(await fs.pathExists(memoryFile))) {
    return {
      file: memoryFile,
      payload: fallbackPayload
    };
  }

  let payload = null;
  try {
    payload = await fs.readJson(memoryFile);
  } catch (error) {
    return {
      file: memoryFile,
      payload: fallbackPayload
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      file: memoryFile,
      payload: fallbackPayload
    };
  }

  return {
    file: memoryFile,
    payload: {
      version: Number(payload.version) || 1,
      signatures: payload.signatures && typeof payload.signatures === 'object'
        ? payload.signatures
        : {}
    }
  };
}

function normalizeRecoveryMemoryToken(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function resolveRecoveryMemoryScope(projectPath, scopeCandidate, dependencies = {}) {
  const { path: pathModule = path, normalizeRecoveryMemoryToken, resolveGitBranchToken } = dependencies;
  const explicitScope = `${scopeCandidate || ''}`.trim();
  if (explicitScope && explicitScope.toLowerCase() !== 'auto') {
    return normalizeRecoveryMemoryToken(explicitScope) || 'default-scope';
  }

  const projectToken = normalizeRecoveryMemoryToken(pathModule.basename(pathModule.resolve(projectPath || '.'))) || 'project';
  const branchToken = await resolveGitBranchToken(projectPath);
  return `${projectToken}|${branchToken || 'default'}`;
}

async function resolveGitBranchToken(projectPath, dependencies = {}) {
  const { path: pathModule = path, fs, normalizeRecoveryMemoryToken } = dependencies;
  try {
    const gitMetadataPath = pathModule.join(projectPath, '.git');
    if (!(await fs.pathExists(gitMetadataPath))) {
      return 'no-git';
    }

    let gitDir = gitMetadataPath;
    const gitStat = await fs.stat(gitMetadataPath);
    if (gitStat.isFile()) {
      const pointer = await fs.readFile(gitMetadataPath, 'utf8');
      const match = pointer.match(/gitdir:\s*(.+)/i);
      if (match && match[1]) {
        gitDir = pathModule.resolve(projectPath, match[1].trim());
      }
    }

    const headFile = pathModule.join(gitDir, 'HEAD');
    if (!(await fs.pathExists(headFile))) {
      return 'no-head';
    }
    const headContent = `${await fs.readFile(headFile, 'utf8')}`.trim();
    const refMatch = headContent.match(/^ref:\s+refs\/heads\/(.+)$/i);
    if (refMatch && refMatch[1]) {
      return normalizeRecoveryMemoryToken(refMatch[1]) || 'unknown-branch';
    }
    if (/^[a-f0-9]{7,40}$/i.test(headContent)) {
      return `detached-${headContent.slice(0, 8).toLowerCase()}`;
    }
    return 'unknown-branch';
  } catch (error) {
    return 'unknown-branch';
  }
}

function buildRecoveryMemorySignature(summaryPayload, context = {}, dependencies = {}) {
  const { buildProgramDiagnostics } = dependencies;
  const safeSummary = summaryPayload && typeof summaryPayload === 'object'
    ? summaryPayload
    : {};
  const diagnostics = safeSummary.program_diagnostics && typeof safeSummary.program_diagnostics === 'object'
    ? safeSummary.program_diagnostics
    : buildProgramDiagnostics(safeSummary);
  const clusters = Array.isArray(diagnostics.failure_clusters)
    ? diagnostics.failure_clusters
    : [];
  const clusterSignature = clusters
    .slice(0, 3)
    .map(cluster => normalizeRecoveryMemoryToken(cluster && cluster.signature))
    .filter(Boolean)
    .join('|');
  const scopeToken = normalizeRecoveryMemoryToken(context.scope || 'default-scope') || 'default-scope';
  const modeToken = normalizeRecoveryMemoryToken(safeSummary.mode || 'unknown-mode');
  const failedCount = Number(safeSummary.failed_goals) || 0;
  const seed = clusterSignature || 'no-failure-cluster';
  return `scope-${scopeToken}|${modeToken}|failed-${failedCount}|${seed}`;
}

function getRecoveryActionMemoryKey(action, index) {
  const actionToken = normalizeRecoveryMemoryToken(action && action.action);
  const commandToken = normalizeRecoveryMemoryToken(action && action.suggested_command);
  const fallback = `action-${index}`;
  return actionToken || commandToken
    ? `${fallback}|${actionToken || 'none'}|${commandToken || 'none'}`
    : fallback;
}

function selectRecoveryActionFromMemory(availableActions, recoveryMemoryEntry) {
  if (
    !recoveryMemoryEntry ||
    typeof recoveryMemoryEntry !== 'object' ||
    !recoveryMemoryEntry.actions ||
    typeof recoveryMemoryEntry.actions !== 'object'
  ) {
    return null;
  }

  const candidates = [];
  for (let index = 1; index <= availableActions.length; index += 1) {
    const action = availableActions[index - 1];
    const key = getRecoveryActionMemoryKey(action, index);
    const stats = recoveryMemoryEntry.actions[key];
    if (!stats || typeof stats !== 'object') {
      continue;
    }
    const attempts = Number(stats.attempts) || 0;
    const successes = Number(stats.successes) || 0;
    if (attempts <= 0) {
      continue;
    }
    const successRate = successes / attempts;
    const score = (successRate * 100) + Math.min(25, attempts);
    candidates.push({
      index,
      key,
      score,
      attempts,
      successes,
      failures: Number(stats.failures) || 0,
      success_rate_percent: Number((successRate * 100).toFixed(2))
    });
  }

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.attempts !== left.attempts) {
      return right.attempts - left.attempts;
    }
    return left.index - right.index;
  });
  const best = candidates[0];
  return {
    ...best,
    selection_reason: 'highest memory score: success_rate_percent + bounded_attempt_bonus',
    top_candidates: candidates.slice(0, 5)
  };
}

function getRecoveryMemoryEntry(recoveryMemoryPayload, signature) {
  if (
    !recoveryMemoryPayload ||
    typeof recoveryMemoryPayload !== 'object' ||
    !recoveryMemoryPayload.signatures ||
    typeof recoveryMemoryPayload.signatures !== 'object'
  ) {
    return null;
  }
  const signatureKey = `${signature || ''}`.trim();
  if (!signatureKey) {
    return null;
  }
  const entry = recoveryMemoryPayload.signatures[signatureKey];
  return entry && typeof entry === 'object' ? entry : null;
}

async function updateCloseLoopRecoveryMemory(
  projectPath,
  recoveryMemory,
  signature,
  selectedIndex,
  selectedAction,
  finalStatus,
  metadata = {},
  dependencies = {}
) {
  const {
    fs,
    path: pathModule = path,
    getCloseLoopRecoveryMemoryFile,
    getRecoveryActionMemoryKey,
    normalizeRecoveryMemoryToken
  } = dependencies;
  const memoryFile = recoveryMemory && typeof recoveryMemory.file === 'string'
    ? recoveryMemory.file
    : getCloseLoopRecoveryMemoryFile(projectPath);
  const memoryPayload = recoveryMemory && recoveryMemory.payload && typeof recoveryMemory.payload === 'object'
    ? recoveryMemory.payload
    : {
      version: 1,
      signatures: {}
    };
  if (!memoryPayload.signatures || typeof memoryPayload.signatures !== 'object') {
    memoryPayload.signatures = {};
  }

  const signatureKey = `${signature || ''}`.trim() || 'unknown-signature';
  const selected = Number.isInteger(selectedIndex) && selectedIndex > 0 ? selectedIndex : 1;
  const actionKey = getRecoveryActionMemoryKey(selectedAction || {}, selected);
  const now = new Date().toISOString();
  const scope = normalizeRecoveryMemoryToken(metadata.scope || '') || null;

  if (!memoryPayload.signatures[signatureKey] || typeof memoryPayload.signatures[signatureKey] !== 'object') {
    memoryPayload.signatures[signatureKey] = {
      attempts: 0,
      successes: 0,
      failures: 0,
      scope,
      last_used_at: null,
      last_selected_index: null,
      actions: {}
    };
  }

  const signatureEntry = memoryPayload.signatures[signatureKey];
  if (!signatureEntry.actions || typeof signatureEntry.actions !== 'object') {
    signatureEntry.actions = {};
  }
  if (!signatureEntry.actions[actionKey] || typeof signatureEntry.actions[actionKey] !== 'object') {
    signatureEntry.actions[actionKey] = {
      attempts: 0,
      successes: 0,
      failures: 0,
      last_status: null,
      last_used_at: null,
      last_selected_index: selected
    };
  }

  const actionEntry = signatureEntry.actions[actionKey];
  const succeeded = `${finalStatus || ''}`.trim().toLowerCase() === 'completed';

  signatureEntry.attempts = (Number(signatureEntry.attempts) || 0) + 1;
  signatureEntry.successes = (Number(signatureEntry.successes) || 0) + (succeeded ? 1 : 0);
  signatureEntry.failures = (Number(signatureEntry.failures) || 0) + (succeeded ? 0 : 1);
  signatureEntry.scope = signatureEntry.scope || scope;
  signatureEntry.last_used_at = now;
  signatureEntry.last_selected_index = selected;

  actionEntry.attempts = (Number(actionEntry.attempts) || 0) + 1;
  actionEntry.successes = (Number(actionEntry.successes) || 0) + (succeeded ? 1 : 0);
  actionEntry.failures = (Number(actionEntry.failures) || 0) + (succeeded ? 0 : 1);
  actionEntry.last_status = `${finalStatus || 'unknown'}`;
  actionEntry.last_used_at = now;
  actionEntry.last_selected_index = selected;

  await fs.ensureDir(pathModule.dirname(memoryFile));
  await fs.writeJson(memoryFile, memoryPayload, { spaces: 2 });

  return {
    file: memoryFile,
    signature: signatureKey,
    action_key: actionKey,
    scope: signatureEntry.scope || scope,
    entry: actionEntry
  };
}

function summarizeRecoveryMemory(memoryPayload) {
  const signatures = memoryPayload && memoryPayload.signatures && typeof memoryPayload.signatures === 'object'
    ? memoryPayload.signatures
    : {};
  const signatureKeys = Object.keys(signatures);
  let actionCount = 0;
  const scopeCounts = {};
  for (const key of signatureKeys) {
    const entry = signatures[key];
    if (entry && entry.actions && typeof entry.actions === 'object') {
      actionCount += Object.keys(entry.actions).length;
    }
    const scope = normalizeRecoveryMemoryToken(entry && entry.scope ? entry.scope : 'default-scope') || 'default-scope';
    scopeCounts[scope] = (Number(scopeCounts[scope]) || 0) + 1;
  }
  return {
    signature_count: signatureKeys.length,
    action_count: actionCount,
    scope_count: Object.keys(scopeCounts).length,
    scopes: scopeCounts
  };
}

function filterRecoveryMemoryByScope(memoryPayload, scopeCandidate) {
  const normalizedScope = normalizeRecoveryMemoryToken(scopeCandidate);
  if (!normalizedScope) {
    return {
      scope: null,
      payload: memoryPayload
    };
  }

  const source = memoryPayload && typeof memoryPayload === 'object'
    ? memoryPayload
    : { version: 1, signatures: {} };
  const signatures = source.signatures && typeof source.signatures === 'object'
    ? source.signatures
    : {};
  const filteredSignatures = {};
  for (const [signature, entryRaw] of Object.entries(signatures)) {
    const entry = entryRaw && typeof entryRaw === 'object' ? entryRaw : null;
    if (!entry) {
      continue;
    }
    const entryScope = normalizeRecoveryMemoryToken(entry.scope || 'default-scope') || 'default-scope';
    if (entryScope !== normalizedScope) {
      continue;
    }
    filteredSignatures[signature] = entry;
  }

  return {
    scope: normalizedScope,
    payload: {
      version: Number(source.version) || 1,
      signatures: filteredSignatures
    }
  };
}

function buildRecoveryMemoryScopeStats(memoryPayload) {
  const signatures = memoryPayload && memoryPayload.signatures && typeof memoryPayload.signatures === 'object'
    ? memoryPayload.signatures
    : {};
  const aggregates = new Map();
  for (const entryRaw of Object.values(signatures)) {
    const entry = entryRaw && typeof entryRaw === 'object' ? entryRaw : null;
    if (!entry) {
      continue;
    }
    const scope = normalizeRecoveryMemoryToken(entry.scope || 'default-scope') || 'default-scope';
    if (!aggregates.has(scope)) {
      aggregates.set(scope, {
        scope,
        signature_count: 0,
        action_count: 0,
        attempts: 0,
        successes: 0,
        failures: 0
      });
    }
    const aggregate = aggregates.get(scope);
    aggregate.signature_count += 1;
    aggregate.attempts += Number(entry.attempts) || 0;
    aggregate.successes += Number(entry.successes) || 0;
    aggregate.failures += Number(entry.failures) || 0;
    if (entry.actions && typeof entry.actions === 'object') {
      aggregate.action_count += Object.keys(entry.actions).length;
    }
  }

  return [...aggregates.values()]
    .map(item => ({
      ...item,
      success_rate_percent: item.attempts > 0
        ? Number(((item.successes / item.attempts) * 100).toFixed(2))
        : 0
    }))
    .sort((left, right) => {
      if (right.signature_count !== left.signature_count) {
        return right.signature_count - left.signature_count;
      }
      return `${left.scope}`.localeCompare(`${right.scope}`);
    });
}

function isIsoTimestampOlderThan(timestamp, cutoffMs) {
  if (cutoffMs === null) {
    return false;
  }
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return true;
  }
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return true;
  }
  return parsed < cutoffMs;
}

async function showCloseLoopRecoveryMemory(projectPath, options = {}, dependencies = {}) {
  const { loadCloseLoopRecoveryMemory, filterRecoveryMemoryByScope, summarizeRecoveryMemory } = dependencies;
  const recoveryMemory = await loadCloseLoopRecoveryMemory(projectPath);
  const filtered = filterRecoveryMemoryByScope(recoveryMemory.payload, options.scope);
  return {
    mode: 'auto-recovery-memory-show',
    file: recoveryMemory.file,
    scope: filtered.scope,
    stats: summarizeRecoveryMemory(filtered.payload),
    payload: filtered.payload
  };
}

async function showCloseLoopRecoveryMemoryScopes(projectPath, dependencies = {}) {
  const { loadCloseLoopRecoveryMemory, buildRecoveryMemoryScopeStats } = dependencies;
  const recoveryMemory = await loadCloseLoopRecoveryMemory(projectPath);
  const scopes = buildRecoveryMemoryScopeStats(recoveryMemory.payload);
  return {
    mode: 'auto-recovery-memory-scopes',
    file: recoveryMemory.file,
    total_scopes: scopes.length,
    scopes
  };
}

async function pruneCloseLoopRecoveryMemory(projectPath, options = {}, dependencies = {}) {
  const {
    fs,
    path: pathModule = path,
    Date: DateCtor = Date,
    normalizeRecoveryMemoryTtlDays,
    loadCloseLoopRecoveryMemory,
    filterRecoveryMemoryByScope,
    summarizeRecoveryMemory
  } = dependencies;
  const olderThanDays = normalizeRecoveryMemoryTtlDays(options.olderThanDays === undefined ? 30 : options.olderThanDays);
  const scope = normalizeRecoveryMemoryToken(options.scope || '') || null;
  const dryRun = Boolean(options.dryRun);
  const recoveryMemory = await loadCloseLoopRecoveryMemory(projectPath);
  const memoryPayload = recoveryMemory.payload && typeof recoveryMemory.payload === 'object'
    ? recoveryMemory.payload
    : { version: 1, signatures: {} };
  if (!memoryPayload.signatures || typeof memoryPayload.signatures !== 'object') {
    memoryPayload.signatures = {};
  }

  const cutoffMs = olderThanDays === null
    ? null
    : DateCtor.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const filteredBeforePayload = scope
    ? filterRecoveryMemoryByScope(memoryPayload, scope).payload
    : memoryPayload;
  const signaturesBefore = summarizeRecoveryMemory(filteredBeforePayload).signature_count;
  const actionBefore = summarizeRecoveryMemory(filteredBeforePayload).action_count;

  const retainedSignatures = {};
  for (const [signature, entryRaw] of Object.entries(memoryPayload.signatures)) {
    const entry = entryRaw && typeof entryRaw === 'object' ? { ...entryRaw } : null;
    if (!entry) {
      continue;
    }
    const entryScope = normalizeRecoveryMemoryToken(entry.scope || 'default-scope') || 'default-scope';
    if (scope && entryScope !== scope) {
      retainedSignatures[signature] = entry;
      continue;
    }
    const actions = entry.actions && typeof entry.actions === 'object' ? entry.actions : {};
    const retainedActions = {};
    for (const [actionKey, actionStatsRaw] of Object.entries(actions)) {
      const actionStats = actionStatsRaw && typeof actionStatsRaw === 'object' ? actionStatsRaw : null;
      if (!actionStats) {
        continue;
      }
      if (!isIsoTimestampOlderThan(actionStats.last_used_at, cutoffMs)) {
        retainedActions[actionKey] = actionStats;
      }
    }

    if (Object.keys(retainedActions).length > 0 || !isIsoTimestampOlderThan(entry.last_used_at, cutoffMs)) {
      retainedSignatures[signature] = {
        ...entry,
        actions: retainedActions
      };
    }
  }

  const nextPayload = {
    version: Number(memoryPayload.version) || 1,
    signatures: retainedSignatures
  };
  const filteredAfterPayload = scope
    ? filterRecoveryMemoryByScope(nextPayload, scope).payload
    : nextPayload;
  const signaturesAfter = summarizeRecoveryMemory(filteredAfterPayload).signature_count;
  const actionAfter = summarizeRecoveryMemory(filteredAfterPayload).action_count;
  if (!dryRun) {
    await fs.ensureDir(pathModule.dirname(recoveryMemory.file));
    await fs.writeJson(recoveryMemory.file, nextPayload, { spaces: 2 });
  }

  return {
    mode: 'auto-recovery-memory-prune',
    file: recoveryMemory.file,
    scope,
    dry_run: dryRun,
    older_than_days: olderThanDays,
    signatures_before: signaturesBefore,
    signatures_after: signaturesAfter,
    actions_before: actionBefore,
    actions_after: actionAfter,
    signatures_removed: Math.max(0, signaturesBefore - signaturesAfter),
    actions_removed: Math.max(0, actionBefore - actionAfter)
  };
}

async function clearCloseLoopRecoveryMemory(projectPath, dependencies = {}) {
  const { fs, getCloseLoopRecoveryMemoryFile } = dependencies;
  const recoveryMemoryFile = getCloseLoopRecoveryMemoryFile(projectPath);
  const existed = await fs.pathExists(recoveryMemoryFile);
  if (existed) {
    await fs.remove(recoveryMemoryFile);
  }
  return {
    mode: 'auto-recovery-memory-clear',
    file: recoveryMemoryFile,
    existed,
    cleared: true
  };
}

function resolveRecoveryActionSelection(summaryPayload, actionCandidate, context = {}, dependencies = {}) {
  const {
    buildProgramDiagnostics,
    buildProgramRemediationActions,
    normalizeRecoveryActionIndex,
    selectRecoveryActionFromMemory
  } = dependencies;
  const diagnostics = summaryPayload && summaryPayload.program_diagnostics && typeof summaryPayload.program_diagnostics === 'object'
    ? summaryPayload.program_diagnostics
    : buildProgramDiagnostics(summaryPayload || {});
  const availableActions = Array.isArray(diagnostics.remediation_actions) && diagnostics.remediation_actions.length > 0
    ? diagnostics.remediation_actions
    : buildProgramRemediationActions(summaryPayload || {}, []);
  const optionLabel = typeof context.optionLabel === 'string' && context.optionLabel.trim()
    ? context.optionLabel.trim()
    : '--use-action';
  let selectedIndex = null;
  let selectionSource = 'default';
  let memorySelection = null;
  let selectionExplain = null;
  if (actionCandidate !== undefined && actionCandidate !== null) {
    selectedIndex = normalizeRecoveryActionIndex(actionCandidate, availableActions.length, optionLabel);
    selectionSource = 'explicit';
    selectionExplain = {
      mode: 'explicit',
      reason: `${optionLabel} provided`,
      selected_index: selectedIndex
    };
  } else {
    memorySelection = selectRecoveryActionFromMemory(availableActions, context.recoveryMemoryEntry);
    if (memorySelection) {
      selectedIndex = memorySelection.index;
      selectionSource = 'memory';
      selectionExplain = {
        mode: 'memory',
        reason: memorySelection.selection_reason,
        selected_index: selectedIndex,
        candidate_count: memorySelection.top_candidates.length,
        top_candidates: memorySelection.top_candidates
      };
    } else {
      selectedIndex = normalizeRecoveryActionIndex(undefined, availableActions.length);
      selectionExplain = {
        mode: 'default',
        reason: 'no matching memory entry found for current signature',
        selected_index: selectedIndex
      };
    }
  }
  const selectedAction = availableActions[selectedIndex - 1] || null;
  const appliedPatch = selectedAction && selectedAction.strategy_patch && typeof selectedAction.strategy_patch === 'object'
    ? { ...selectedAction.strategy_patch }
    : {};

  return {
    selectedIndex,
    selectedAction,
    availableActions,
    appliedPatch,
    selectionSource,
    memorySelection,
    selectionExplain
  };
}

function applyRecoveryActionPatch(options, selectedAction) {
  const baseOptions = { ...options };
  const patch = selectedAction && selectedAction.strategy_patch && typeof selectedAction.strategy_patch === 'object'
    ? selectedAction.strategy_patch
    : {};
  const merged = { ...baseOptions };

  if (patch.batchAutonomous !== undefined) {
    merged.batchAutonomous = Boolean(patch.batchAutonomous);
  }
  if (patch.continueOnError !== undefined && merged.continueOnError === undefined) {
    merged.continueOnError = Boolean(patch.continueOnError);
  }
  if (patch.batchParallel !== undefined && (merged.batchParallel === undefined || merged.batchParallel === null)) {
    merged.batchParallel = Number(patch.batchParallel);
  }
  if (patch.batchAgentBudget !== undefined && (merged.batchAgentBudget === undefined || merged.batchAgentBudget === null)) {
    merged.batchAgentBudget = Number(patch.batchAgentBudget);
  }
  if (patch.batchPriority !== undefined && (!merged.batchPriority || `${merged.batchPriority}`.trim().toLowerCase() === 'fifo')) {
    merged.batchPriority = patch.batchPriority;
  }
  if (patch.batchAgingFactor !== undefined && (merged.batchAgingFactor === undefined || merged.batchAgingFactor === null)) {
    merged.batchAgingFactor = Number(patch.batchAgingFactor);
  }
  if (patch.batchRetryRounds !== undefined && (merged.batchRetryRounds === undefined || merged.batchRetryRounds === null)) {
    merged.batchRetryRounds = Number(patch.batchRetryRounds);
  }
  if (patch.batchRetryUntilComplete !== undefined && merged.batchRetryUntilComplete === undefined) {
    merged.batchRetryUntilComplete = Boolean(patch.batchRetryUntilComplete);
  }
  if (patch.batchRetryMaxRounds !== undefined && (merged.batchRetryMaxRounds === undefined || merged.batchRetryMaxRounds === null)) {
    merged.batchRetryMaxRounds = Number(patch.batchRetryMaxRounds);
  }
  if (patch.dodTests !== undefined && !merged.dodTests) {
    merged.dodTests = patch.dodTests;
  }
  if (patch.dodTasksClosed !== undefined && merged.dodTasksClosed === undefined) {
    merged.dodTasksClosed = Boolean(patch.dodTasksClosed);
  }

  return merged;
}



module.exports = {
  getCloseLoopRecoveryMemoryFile,
  loadCloseLoopRecoveryMemory,
  normalizeRecoveryMemoryToken,
  resolveRecoveryMemoryScope,
  resolveGitBranchToken,
  buildRecoveryMemorySignature,
  getRecoveryActionMemoryKey,
  selectRecoveryActionFromMemory,
  getRecoveryMemoryEntry,
  updateCloseLoopRecoveryMemory,
  summarizeRecoveryMemory,
  filterRecoveryMemoryByScope,
  buildRecoveryMemoryScopeStats,
  showCloseLoopRecoveryMemory,
  showCloseLoopRecoveryMemoryScopes,
  pruneCloseLoopRecoveryMemory,
  clearCloseLoopRecoveryMemory,
  resolveRecoveryActionSelection,
  applyRecoveryActionPatch
};
