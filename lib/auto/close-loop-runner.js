const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');

const CollaborationManager = require('../collab/collab-manager');
const { runOrchestration } = require('../commands/orchestrate');
const { decomposeGoalToSpecPortfolio } = require('./goal-decomposer');
const { getAgentHints } = require('../scene-runtime/scene-ontology');

const CLOSE_LOOP_STRATEGY_MEMORY_VERSION = 1;
const CLOSE_LOOP_STRATEGY_MEMORY_FILE = path.join('.sce', 'auto', 'close-loop-strategy-memory.json');
const RISK_LEVEL_ORDER = {
  low: 1,
  medium: 2,
  high: 3
};

async function runAutoCloseLoop(goal, options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const executeOrchestration = dependencies.runOrchestration || runOrchestration;
  const decomposeGoal = dependencies.decomposeGoal || decomposeGoalToSpecPortfolio;
  const runCommand = dependencies.runCommand || executeShellCommand;
  const strategyMemory = await loadCloseLoopStrategyMemory(projectPath);
  const strategyMemoryContext = deriveCloseLoopStrategyMemoryContext(goal, options, strategyMemory);
  const runtimeOptions = {
    ...options,
    ...strategyMemoryContext.option_overrides
  };
  const dodConfig = normalizeDefinitionOfDoneConfig(runtimeOptions);
  const sessionConfig = normalizeSessionConfig(runtimeOptions);
  const replanConfig = normalizeReplanConfig(runtimeOptions);

  let resumedSession = null;
  let decomposition;
  if (sessionConfig.resumeRef) {
    resumedSession = await resolveCloseLoopSession(projectPath, sessionConfig.resumeRef);
    decomposition = buildDecompositionFromSession(resumedSession.data);
  } else {
    const requestedSubSpecCount = runtimeOptions.subs !== undefined ? Number(runtimeOptions.subs) : undefined;
    decomposition = await decomposeGoal(goal, {
      projectPath,
      prefix: runtimeOptions.prefix,
      subSpecCount: requestedSubSpecCount,
      feedbackBias: strategyMemoryContext.track_bias
    });
  }

  const masterSpec = decomposition.masterSpec;
  const masterSpecName = masterSpec.name;
  const runtimeSubSpecs = [...decomposition.subSpecs];
  const getAllSpecNames = () => [...runtimeSubSpecs.map(spec => spec.name), masterSpecName];

  if (runtimeOptions.dryRun) {
    const dryRunResult = {
      mode: 'auto-close-loop',
      goal: decomposition.goal,
      dry_run: true,
      status: 'planned',
      portfolio: {
        prefix: decomposition.prefix,
        master_spec: masterSpecName,
        sub_specs: runtimeSubSpecs.map(spec => spec.name),
        dependency_plan: runtimeSubSpecs.map(spec => ({
          spec: spec.name,
          depends_on: spec.dependencies.map(dep => dep.spec)
        }))
      },
      resumed: Boolean(resumedSession),
      strategy_memory: strategyMemoryContext.telemetry,
      resumed_from_session: resumedSession
        ? {
            id: resumedSession.id,
            file: resumedSession.file
          }
        : null,
      strategy: decomposition.strategy,
      replan: {
        enabled: replanConfig.enabled,
        max_attempts: replanConfig.maxAttempts,
        strategy: replanConfig.strategy,
        effective_max_attempts: replanConfig.maxAttempts,
        no_progress_window: replanConfig.noProgressWindow,
        performed: 0,
        attempts: [],
        exhausted: false,
        stalled_signature: null,
        stalled_no_progress_cycles: 0
      },
      next_actions: [
        'Run without --dry-run to materialize specs and execute orchestration.'
      ]
    };

    await maybeWriteOutput(dryRunResult, options, projectPath);
    printResult(dryRunResult, options);
    return dryRunResult;
  }

  const collabManager = dependencies.collaborationManager || new CollaborationManager(projectPath);

  const executionPlanning = await buildEnhancedExecutionPlanning({
    projectPath,
    subSpecs: runtimeSubSpecs,
    strategy: decomposition && decomposition.strategy ? decomposition.strategy : null,
    options: runtimeOptions
  });
  applyExecutionPlanning(runtimeSubSpecs, executionPlanning);

  let assignments;
  if (resumedSession) {
    await ensureExistingSpecs(projectPath, getAllSpecNames());
    assignments = resolveAssignmentsFromSession(resumedSession.data, masterSpec, runtimeSubSpecs);
  } else {
    await ensureSpecDirectoriesAreAvailable(projectPath, [masterSpec, ...runtimeSubSpecs]);
    await writeSpecDocuments(projectPath, decomposition);

    await collabManager.initMasterSpec(
      masterSpecName,
      runtimeSubSpecs.map(spec => ({ name: spec.name, dependencies: spec.dependencies }))
    );

    assignments = buildAssignments(masterSpec, runtimeSubSpecs);
    for (const assignment of assignments) {
      await collabManager.assignSpec(assignment.spec, assignment.agent);
    }
    await writeAgentSyncPlan(projectPath, masterSpecName, runtimeSubSpecs, assignments, executionPlanning);
    await syncMasterCollaborationMetadata(collabManager, masterSpecName, runtimeSubSpecs);
  }

  const runtimeAssignments = [...assignments];
  const leaseBySpec = executionPlanning && executionPlanning.lease_plan && executionPlanning.lease_plan.lease_by_spec
    ? executionPlanning.lease_plan.lease_by_spec
    : {};
  for (const assignment of runtimeAssignments) {
    const leaseKey = leaseBySpec[assignment.spec];
    if (leaseKey) {
      assignment.lease_key = leaseKey;
    }
  }
  const replan = {
    enabled: replanConfig.enabled,
    max_attempts: replanConfig.maxAttempts,
    strategy: replanConfig.strategy,
    effective_max_attempts: replanConfig.maxAttempts,
    no_progress_window: replanConfig.noProgressWindow,
    performed: 0,
    attempts: [],
    exhausted: false,
    stalled_signature: null,
    stalled_no_progress_cycles: 0
  };
  const sessionRuntime = buildCloseLoopSessionRuntime(
    projectPath,
    sessionConfig,
    resumedSession,
    decomposition.prefix
  );

  if (sessionRuntime && runtimeOptions.run !== false) {
    await persistCloseLoopSessionSnapshot({
      goal: decomposition.goal,
      status: 'running',
      resumed: Boolean(resumedSession),
      portfolio: {
        prefix: decomposition.prefix,
        master_spec: masterSpecName,
        sub_specs: runtimeSubSpecs.map(spec => spec.name),
        dependency_plan: runtimeSubSpecs.map(spec => ({
          spec: spec.name,
          depends_on: spec.dependencies.map(dep => dep.spec)
        })),
        assignments: runtimeAssignments,
        execution_plan: buildExecutionPlanSummary(executionPlanning)
      },
      strategy: decomposition.strategy,
      replan,
      dod: {
        enabled: dodConfig.enabled,
        passed: null,
        checks: [],
        failed_checks: []
      },
      orchestration: null,
      next_actions: [
        'Session is running. If interrupted, resume with `sce auto close-loop --resume interrupted`.'
      ]
    }, sessionRuntime);
  }

  let orchestrationResult = null;
  if (runtimeOptions.run !== false) {
    const statusReporter = createStatusReporter(runtimeOptions);
    let cycle = 0;
    const failureSignatures = new Set();
    let noProgressCycles = 0;
    let previousProgressSnapshot = null;

    while (true) {
      const orchestrationSpecNames = getAllSpecNames();
      orchestrationResult = await executeOrchestration({
        specNames: orchestrationSpecNames,
        maxParallel: runtimeOptions.maxParallel,
        json: false,
        silent: true,
        onStatus: statusReporter,
        statusIntervalMs: 1000
      }, {
        workspaceRoot: projectPath
      });

      await synchronizeCollaborationStatus(collabManager, orchestrationSpecNames, orchestrationResult);

      const failedSpecs = collectFailedSpecsForReplan(orchestrationResult, masterSpecName);
      const cycleBudget = resolveEffectiveReplanBudget(replanConfig, failedSpecs.length);
      const effectiveBudget = Math.max(replan.effective_max_attempts, cycleBudget);
      replan.effective_max_attempts = effectiveBudget;

      const progressEvaluation = evaluateReplanProgressStall({
        orchestrationResult,
        failedSpecs,
        previousSnapshot: previousProgressSnapshot,
        noProgressCycles,
        noProgressWindow: replanConfig.noProgressWindow
      });
      previousProgressSnapshot = progressEvaluation.currentSnapshot;
      noProgressCycles = progressEvaluation.noProgressCycles;
      if (progressEvaluation.shouldStall) {
        replan.exhausted = true;
        replan.stalled_no_progress_cycles = noProgressCycles;
        break;
      }

      if (!shouldRunReplanCycle(orchestrationResult, failedSpecs, replanConfig, cycle, effectiveBudget)) {
        if (replanConfig.enabled && cycle >= effectiveBudget && failedSpecs.length > 0) {
          replan.exhausted = true;
        }
        break;
      }

      const failedSignature = createFailedSpecSignature(failedSpecs);
      if (failedSignature && failureSignatures.has(failedSignature)) {
        replan.exhausted = true;
        replan.stalled_signature = failedSignature;
        break;
      }
      if (failedSignature) {
        failureSignatures.add(failedSignature);
      }

      cycle += 1;
      const remediationPlan = await materializeReplanCycle({
        projectPath,
        goal: decomposition.goal,
        masterSpecName,
        runtimeSubSpecs,
        runtimeAssignments,
        failedSpecs,
        cycle,
        collabManager,
        executionPlanning
      });

      replan.performed = cycle;
      replan.attempts.push({
        cycle,
        trigger_failed_specs: failedSpecs,
        budget_for_cycle: effectiveBudget,
        added_specs: remediationPlan.addedSpecs.map(spec => spec.name),
        added_assignments: remediationPlan.addedAssignments,
        orchestration_status_before: orchestrationResult.status
      });
    }
  }

  const finalSpecNames = getAllSpecNames();
  const dod = await evaluateDefinitionOfDone({
    projectPath,
    specNames: finalSpecNames,
    orchestrationResult,
    runInvoked: runtimeOptions.run !== false,
    dodConfig,
    runCommand
  });

  let status = orchestrationResult ? orchestrationResult.status : 'prepared';
  if (dodConfig.enabled && !dod.passed) {
    status = 'failed';
  }

  const result = {
    mode: 'auto-close-loop',
    goal: decomposition.goal,
    dry_run: false,
    status,
    resumed: Boolean(resumedSession),
    strategy_memory: strategyMemoryContext.telemetry,
    resumed_from_session: resumedSession
      ? {
          id: resumedSession.id,
          file: resumedSession.file
        }
      : null,
    portfolio: {
      prefix: decomposition.prefix,
      master_spec: masterSpecName,
      sub_specs: runtimeSubSpecs.map(spec => spec.name),
      dependency_plan: runtimeSubSpecs.map(spec => ({
        spec: spec.name,
        depends_on: spec.dependencies.map(dep => dep.spec)
      })),
      assignments: runtimeAssignments,
      execution_plan: buildExecutionPlanSummary(executionPlanning)
    },
    strategy: decomposition.strategy,
    replan,
    dod,
    orchestration: orchestrationResult,
    next_actions: buildNextActions(status, dod, replan)
  };

  await maybeWriteDodReport(result, runtimeOptions, projectPath);
  await maybePersistCloseLoopSession(result, sessionConfig, resumedSession, projectPath, sessionRuntime);
  await maybePruneCloseLoopSessions(result, sessionConfig, projectPath);
  await updateCloseLoopStrategyMemory(projectPath, result, strategyMemoryContext, strategyMemory);
  await maybeWriteOutput(result, runtimeOptions, projectPath);
  printResult(result, runtimeOptions);
  return result;
}

function normalizeSessionConfig(options) {
  if (options.sessionKeep !== undefined && options.sessionKeep !== null) {
    const parsed = Number(options.sessionKeep);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
      throw new Error('--session-keep must be an integer between 0 and 1000');
    }
  }

  if (options.sessionOlderThanDays !== undefined && options.sessionOlderThanDays !== null) {
    const parsed = Number(options.sessionOlderThanDays);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 36500) {
      throw new Error('--session-older-than-days must be an integer between 0 and 36500');
    }
  }

  return {
    enabled: options.session !== false,
    resumeRef: typeof options.resume === 'string' && options.resume.trim()
      ? options.resume.trim()
      : null,
    sessionId: typeof options.sessionId === 'string' && options.sessionId.trim()
      ? sanitizeSessionId(options.sessionId.trim())
      : null,
    keep: options.sessionKeep !== undefined && options.sessionKeep !== null
      ? Number(options.sessionKeep)
      : null,
    olderThanDays: options.sessionOlderThanDays !== undefined && options.sessionOlderThanDays !== null
      ? Number(options.sessionOlderThanDays)
      : null
  };
}

function sanitizeSessionId(value) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function getCloseLoopSessionDir(projectPath) {
  return path.join(projectPath, '.sce', 'auto', 'close-loop-sessions');
}

async function resolveCloseLoopSession(projectPath, resumeRef) {
  let filePath = null;
  const sessionDir = getCloseLoopSessionDir(projectPath);
  const normalizedResumeRef = `${resumeRef || ''}`.trim();
  const resumeToken = normalizedResumeRef.toLowerCase();
  const looksLikePath = /[\\/]/.test(normalizedResumeRef) || normalizedResumeRef.toLowerCase().endsWith('.json');

  if (resumeToken === 'latest') {
    filePath = await resolveLatestSessionFile(sessionDir);
  } else if (resumeToken === 'interrupted' || resumeToken === 'latest-interrupted') {
    filePath = await resolveLatestInterruptedSessionFile(sessionDir);
  } else if (looksLikePath) {
    const candidate = path.isAbsolute(normalizedResumeRef)
      ? normalizedResumeRef
      : path.join(projectPath, normalizedResumeRef);
    if (await fs.pathExists(candidate)) {
      filePath = candidate;
    }
  } else {
    const byId = path.join(sessionDir, `${sanitizeSessionId(normalizedResumeRef)}.json`);
    if (await fs.pathExists(byId)) {
      filePath = byId;
    }
  }

  if (!filePath) {
    if (resumeToken === 'interrupted' || resumeToken === 'latest-interrupted') {
      throw new Error('Close-loop interrupted session not found.');
    }
    throw new Error(`Close-loop session not found for "${resumeRef}".`);
  }

  const data = await fs.readJson(filePath);
  validateSessionData(data, filePath);
  const resolvedId = data.session_id || path.basename(filePath, '.json');
  return {
    id: resolvedId,
    file: filePath,
    data
  };
}

async function resolveLatestSessionFile(sessionDir) {
  if (!(await fs.pathExists(sessionDir))) {
    return null;
  }

  const entries = await fs.readdir(sessionDir);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.json')) {
      continue;
    }
    const filePath = path.join(sessionDir, entry);
    const stats = await fs.stat(filePath);
    candidates.push({
      filePath,
      mtimeMs: stats.mtimeMs
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0].filePath;
}

function normalizeSessionStatusToken(statusCandidate) {
  return `${statusCandidate || ''}`.trim().toLowerCase();
}

async function resolveLatestInterruptedSessionFile(sessionDir) {
  if (!(await fs.pathExists(sessionDir))) {
    return null;
  }

  const entries = await fs.readdir(sessionDir);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.json')) {
      continue;
    }
    const filePath = path.join(sessionDir, entry);
    const stats = await fs.stat(filePath);
    let status = 'unknown';
    try {
      const payload = await fs.readJson(filePath);
      status = payload && typeof payload.status === 'string'
        ? payload.status
        : 'unknown';
    } catch (_error) {
      // Ignore parse errors during interrupted-session discovery.
    }
    candidates.push({
      filePath,
      mtimeMs: stats.mtimeMs,
      status
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const interrupted = candidates.find(item => normalizeSessionStatusToken(item.status) !== 'completed');
  return interrupted ? interrupted.filePath : null;
}

function validateSessionData(data, filePath) {
  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid close-loop session payload: ${filePath}`);
  }
  if (!data.portfolio || typeof data.portfolio !== 'object') {
    throw new Error(`Session missing portfolio metadata: ${filePath}`);
  }
  if (!data.portfolio.master_spec || !Array.isArray(data.portfolio.sub_specs)) {
    throw new Error(`Session missing master/sub spec names: ${filePath}`);
  }
}

function buildDecompositionFromSession(sessionData) {
  const portfolio = sessionData.portfolio;
  const dependencyMap = new Map();
  for (const item of portfolio.dependency_plan || []) {
    dependencyMap.set(item.spec, Array.isArray(item.depends_on) ? item.depends_on : []);
  }

  const subSpecs = portfolio.sub_specs.map(specName => ({
    name: specName,
    title: specName,
    slug: specName,
    objective: 'Recovered from close-loop session snapshot.',
    dependencies: (dependencyMap.get(specName) || []).map(dep => ({
      spec: dep,
      type: 'requires-completion'
    }))
  }));

  const inferredPrefix = Number(portfolio.prefix);
  return {
    goal: sessionData.goal || 'Recovered close-loop goal',
    prefix: Number.isInteger(inferredPrefix) ? inferredPrefix : inferPrefixFromSpec(portfolio.master_spec),
    masterSpec: {
      name: portfolio.master_spec,
      title: portfolio.master_spec,
      objective: 'Recovered from close-loop session snapshot.',
      slug: portfolio.master_spec
    },
    subSpecs,
    strategy: sessionData.strategy || {
      source: 'resume-session',
      subSpecCount: subSpecs.length,
      matchedTracks: []
    }
  };
}

function inferPrefixFromSpec(specName) {
  const match = `${specName || ''}`.match(/^(\d+)-\d{2}-/);
  if (!match) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : 0;
}

function resolveAssignmentsFromSession(sessionData, masterSpec, subSpecs) {
  const knownSpecs = new Set([masterSpec.name, ...subSpecs.map(spec => spec.name)]);
  const persistedAssignments = Array.isArray(sessionData.portfolio && sessionData.portfolio.assignments)
    ? sessionData.portfolio.assignments
    : [];

  const normalized = persistedAssignments
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      spec: `${item.spec || ''}`.trim(),
      agent: `${item.agent || ''}`.trim()
    }))
    .filter(item => item.spec && item.agent && knownSpecs.has(item.spec));

  if (normalized.length === knownSpecs.size) {
    return normalized;
  }

  return buildAssignments(masterSpec, subSpecs);
}

async function ensureExistingSpecs(projectPath, specNames) {
  const missing = [];
  for (const specName of specNames) {
    const specPath = path.join(projectPath, '.sce', 'specs', specName);
    if (!(await fs.pathExists(specPath))) {
      missing.push(specName);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Resume failed because specs are missing: ${missing.join(', ')}`);
  }
}

function buildSessionSnapshot(result) {
  return {
    schema_version: '1.0',
    session_version: 1,
    updated_at: new Date().toISOString(),
    goal: result.goal,
    status: result.status,
    resumed: Boolean(result.resumed),
    portfolio: result.portfolio,
    strategy: result.strategy,
    replan: result.replan,
    dod: result.dod,
    orchestration: result.orchestration
  };
}

function getCloseLoopStrategyMemoryFile(projectPath) {
  return path.join(projectPath, CLOSE_LOOP_STRATEGY_MEMORY_FILE);
}

function buildGoalMemorySignature(goal) {
  return `${goal || ''}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff ]+/g, '');
}

async function loadCloseLoopStrategyMemory(projectPath) {
  const file = getCloseLoopStrategyMemoryFile(projectPath);
  if (!(await fs.pathExists(file))) {
    return {
      version: CLOSE_LOOP_STRATEGY_MEMORY_VERSION,
      updated_at: null,
      goals: {},
      track_feedback: {}
    };
  }
  try {
    const payload = await fs.readJson(file);
    if (!payload || typeof payload !== 'object') {
      throw new Error('invalid payload');
    }
    return {
      version: CLOSE_LOOP_STRATEGY_MEMORY_VERSION,
      updated_at: payload.updated_at || null,
      goals: payload.goals && typeof payload.goals === 'object' ? payload.goals : {},
      track_feedback: payload.track_feedback && typeof payload.track_feedback === 'object'
        ? payload.track_feedback
        : {}
    };
  } catch (error) {
    return {
      version: CLOSE_LOOP_STRATEGY_MEMORY_VERSION,
      updated_at: null,
      goals: {},
      track_feedback: {}
    };
  }
}

function deriveTrackFeedbackBias(trackFeedback) {
  const bias = {};
  const entries = trackFeedback && typeof trackFeedback === 'object'
    ? Object.entries(trackFeedback)
    : [];
  for (const [slug, record] of entries) {
    const attempts = Number(record && record.attempts) || 0;
    const successes = Number(record && record.successes) || 0;
    if (attempts <= 0) {
      continue;
    }
    const successRate = successes / attempts;
    const rawBias = (successRate - 0.5) * 4;
    bias[slug] = Number(Math.max(-2, Math.min(2, rawBias)).toFixed(2));
  }
  return bias;
}

function deriveCloseLoopStrategyMemoryContext(goal, options, strategyMemory) {
  const signature = buildGoalMemorySignature(goal);
  const goalMemory = signature && strategyMemory && strategyMemory.goals
    ? strategyMemory.goals[signature]
    : null;
  const optionOverrides = {};

  if (goalMemory && typeof goalMemory === 'object') {
    if (options.replanStrategy === undefined && typeof goalMemory.replan_strategy === 'string') {
      optionOverrides.replanStrategy = goalMemory.replan_strategy;
    }
    if (options.replanAttempts === undefined && Number.isInteger(Number(goalMemory.replan_attempts))) {
      optionOverrides.replanAttempts = Number(goalMemory.replan_attempts);
    }
    if (options.dodTests === undefined && typeof goalMemory.dod_tests === 'string' && goalMemory.dod_tests.trim()) {
      optionOverrides.dodTests = goalMemory.dod_tests.trim();
    }
  }

  const trackBias = deriveTrackFeedbackBias(strategyMemory && strategyMemory.track_feedback);
  return {
    goal_signature: signature || null,
    option_overrides: optionOverrides,
    track_bias: trackBias,
    telemetry: {
      enabled: true,
      goal_signature: signature || null,
      strategy_memory_hit: Boolean(goalMemory),
      applied_option_overrides: Object.keys(optionOverrides),
      track_bias_count: Object.keys(trackBias).length
    }
  };
}

function extractTrackSlugFromSpecName(specName) {
  const normalized = `${specName || ''}`.trim();
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^\d+-\d+-(.+)$/);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
}

async function updateCloseLoopStrategyMemory(projectPath, result, context, strategyMemory) {
  if (!context || !context.goal_signature || !strategyMemory) {
    return;
  }

  const file = getCloseLoopStrategyMemoryFile(projectPath);
  const nextMemory = {
    version: CLOSE_LOOP_STRATEGY_MEMORY_VERSION,
    updated_at: new Date().toISOString(),
    goals: {
      ...(strategyMemory.goals || {})
    },
    track_feedback: {
      ...(strategyMemory.track_feedback || {})
    }
  };
  const goalRecord = nextMemory.goals[context.goal_signature] || {
    attempts: 0,
    successes: 0,
    replan_strategy: null,
    replan_attempts: null,
    dod_tests: null,
    last_status: null
  };
  goalRecord.attempts = Number(goalRecord.attempts || 0) + 1;
  if (`${result && result.status ? result.status : ''}`.trim().toLowerCase() === 'completed') {
    goalRecord.successes = Number(goalRecord.successes || 0) + 1;
  } else {
    goalRecord.successes = Number(goalRecord.successes || 0);
  }
  if (result && result.replan) {
    if (result.replan.strategy) {
      goalRecord.replan_strategy = result.replan.strategy;
    }
    if (Number.isInteger(Number(result.replan.effective_max_attempts))) {
      goalRecord.replan_attempts = Number(result.replan.effective_max_attempts);
    }
  }
  const testCommandCheck = result && result.dod && Array.isArray(result.dod.checks)
    ? result.dod.checks.find(check => check.id === 'tests-command')
    : null;
  if (testCommandCheck && typeof testCommandCheck.message === 'string') {
    const match = testCommandCheck.message.match(/(?:passed|failed):\s(.+?)(?:\s\(code=|$)/i);
    if (match && match[1]) {
      goalRecord.dod_tests = match[1].trim();
    }
  }
  goalRecord.last_status = `${result && result.status ? result.status : ''}`.trim() || 'unknown';
  nextMemory.goals[context.goal_signature] = goalRecord;

  const trackNames = result && result.strategy && Array.isArray(result.strategy.matchedTracks)
    ? result.strategy.matchedTracks
    : [];
  for (const trackName of trackNames) {
    const normalizedTrackName = `${trackName || ''}`.trim();
    if (!normalizedTrackName) {
      continue;
    }
    const trackRecord = nextMemory.track_feedback[normalizedTrackName] || {
      attempts: 0,
      successes: 0
    };
    trackRecord.attempts = Number(trackRecord.attempts || 0) + 1;
    if (`${result && result.status ? result.status : ''}`.trim().toLowerCase() === 'completed') {
      trackRecord.successes = Number(trackRecord.successes || 0) + 1;
    } else {
      trackRecord.successes = Number(trackRecord.successes || 0);
    }
    nextMemory.track_feedback[normalizedTrackName] = trackRecord;
  }

  await fs.ensureDir(path.dirname(file));
  await fs.writeJson(file, nextMemory, { spaces: 2 });
}

async function buildEnhancedExecutionPlanning(context) {
  const projectPath = context.projectPath;
  const subSpecs = Array.isArray(context.subSpecs) ? context.subSpecs : [];
  const options = context.options && typeof context.options === 'object' ? context.options : {};
  const ontologyGuidanceEnabled = options.ontologyGuidance !== false;
  const conflictGovernanceEnabled = options.conflictGovernance !== false;
  const ontologyGuidance = ontologyGuidanceEnabled
    ? await loadSceneOntologyExecutionGuidance(projectPath, subSpecs)
    : {
      enabled: false,
      reason: 'disabled-by-option'
    };
  const leasePlan = conflictGovernanceEnabled
    ? buildSubSpecLeasePlan(subSpecs)
    : {
      lease_by_spec: {},
      groups: {},
      conflict_count: 0,
      conflicts: []
    };
  const plannedOrder = computePlannedSubSpecOrder(subSpecs, leasePlan, ontologyGuidance);
  return {
    conflict_governance_enabled: conflictGovernanceEnabled,
    ontology_guidance_enabled: ontologyGuidanceEnabled,
    ontology_guidance: ontologyGuidance,
    lease_plan: leasePlan,
    planned_order: plannedOrder
  };
}

async function loadSceneOntologyExecutionGuidance(projectPath, subSpecs) {
  const manifestPath = path.join(projectPath, 'scene-package.json');
  if (!(await fs.pathExists(manifestPath))) {
    return {
      enabled: false,
      reason: 'scene-package-not-found'
    };
  }
  try {
    const manifest = await fs.readJson(manifestPath);
    const hints = getAgentHints(manifest);
    const suggestedSequence = hints && Array.isArray(hints.suggested_sequence)
      ? hints.suggested_sequence.map(item => `${item || ''}`.trim()).filter(Boolean)
      : [];
    const mapping = {};
    for (const spec of subSpecs) {
      const specName = `${spec && spec.name ? spec.name : ''}`.trim();
      if (!specName) continue;
      const slug = extractTrackSlugFromSpecName(specName) || specName;
      const normalizedSlug = slug.toLowerCase();
      let matchedToken = null;
      let matchedIndex = -1;
      for (let index = 0; index < suggestedSequence.length; index += 1) {
        const token = suggestedSequence[index].toLowerCase();
        if (normalizedSlug.includes(token) || token.includes(normalizedSlug.split('-')[0])) {
          matchedToken = suggestedSequence[index];
          matchedIndex = index;
          break;
        }
      }
      if (matchedIndex >= 0) {
        mapping[specName] = {
          sequence_index: matchedIndex,
          token: matchedToken
        };
      }
    }
    return {
      enabled: true,
      source: manifestPath,
      suggested_sequence: suggestedSequence,
      mapped_specs: mapping
    };
  } catch (error) {
    return {
      enabled: false,
      reason: `scene-package-parse-error:${error.message}`
    };
  }
}

function buildSubSpecLeasePlan(subSpecs) {
  const leaseBySpec = {};
  const groups = {};
  for (const spec of subSpecs) {
    const specName = `${spec && spec.name ? spec.name : ''}`.trim();
    if (!specName) continue;
    const slug = extractTrackSlugFromSpecName(specName) || specName;
    const leaseKey = slug
      .split('-')
      .slice(0, 2)
      .join('-') || slug;
    leaseBySpec[specName] = leaseKey;
    if (!groups[leaseKey]) {
      groups[leaseKey] = [];
    }
    groups[leaseKey].push(specName);
  }
  const conflicts = Object.entries(groups)
    .filter(([, specs]) => specs.length > 1)
    .map(([leaseKey, specs]) => ({
      lease_key: leaseKey,
      specs
    }));
  return {
    lease_by_spec: leaseBySpec,
    groups,
    conflict_count: conflicts.length,
    conflicts
  };
}

function computePlannedSubSpecOrder(subSpecs, leasePlan, ontologyGuidance) {
  const specMap = new Map(subSpecs.map(spec => [spec.name, spec]));
  const orderedByOntology = [...subSpecs].sort((left, right) => {
    const leftIndex = resolveOntologySequenceIndex(left.name, ontologyGuidance);
    const rightIndex = resolveOntologySequenceIndex(right.name, ontologyGuidance);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.name.localeCompare(right.name);
  });

  const queuesByLease = new Map();
  for (const spec of orderedByOntology) {
    const leaseKey = leasePlan && leasePlan.lease_by_spec && leasePlan.lease_by_spec[spec.name]
      ? leasePlan.lease_by_spec[spec.name]
      : 'default';
    if (!queuesByLease.has(leaseKey)) {
      queuesByLease.set(leaseKey, []);
    }
    queuesByLease.get(leaseKey).push(spec.name);
  }

  const leaseKeys = [...queuesByLease.keys()].sort((left, right) => left.localeCompare(right));
  const picked = [];
  const pickedSet = new Set();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const leaseKey of leaseKeys) {
      const queue = queuesByLease.get(leaseKey);
      if (!queue || queue.length === 0) {
        continue;
      }
      const candidateName = queue[0];
      const candidate = specMap.get(candidateName);
      const deps = Array.isArray(candidate && candidate.dependencies) ? candidate.dependencies : [];
      const depsSatisfied = deps.every(dep => pickedSet.has(dep.spec) || !specMap.has(dep.spec));
      if (!depsSatisfied) {
        continue;
      }
      queue.shift();
      picked.push(candidateName);
      pickedSet.add(candidateName);
      progressed = true;
    }
  }

  for (const leaseKey of leaseKeys) {
    const queue = queuesByLease.get(leaseKey) || [];
    while (queue.length > 0) {
      const item = queue.shift();
      if (!pickedSet.has(item)) {
        picked.push(item);
        pickedSet.add(item);
      }
    }
  }

  const original = subSpecs.map(spec => spec.name);
  return {
    original,
    reordered: picked,
    auto_reordered: JSON.stringify(original) !== JSON.stringify(picked)
  };
}

function resolveOntologySequenceIndex(specName, ontologyGuidance) {
  if (!ontologyGuidance || !ontologyGuidance.enabled) {
    return Number.MAX_SAFE_INTEGER;
  }
  const record = ontologyGuidance.mapped_specs && ontologyGuidance.mapped_specs[specName];
  if (!record || !Number.isInteger(record.sequence_index)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return record.sequence_index;
}

function applyExecutionPlanning(subSpecs, executionPlanning) {
  if (!executionPlanning || !executionPlanning.planned_order || !executionPlanning.planned_order.auto_reordered) {
    return;
  }
  const order = executionPlanning.planned_order.reordered;
  const map = new Map(subSpecs.map(spec => [spec.name, spec]));
  const reordered = [];
  for (const name of order) {
    if (map.has(name)) {
      reordered.push(map.get(name));
      map.delete(name);
    }
  }
  for (const rest of map.values()) {
    reordered.push(rest);
  }
  subSpecs.splice(0, subSpecs.length, ...reordered);
}

function buildExecutionPlanSummary(executionPlanning) {
  if (!executionPlanning) {
    return null;
  }
  return {
    conflict_governance_enabled: executionPlanning.conflict_governance_enabled !== false,
    ontology_guidance_enabled: executionPlanning.ontology_guidance_enabled !== false,
    lease_plan: executionPlanning.lease_plan,
    ontology_guidance: executionPlanning.ontology_guidance,
    scheduling: executionPlanning.planned_order
  };
}

function createSessionId(result, sessionConfig) {
  const portfolio = result && result.portfolio && typeof result.portfolio === 'object'
    ? result.portfolio
    : {};
  if (sessionConfig.sessionId) {
    return sessionConfig.sessionId;
  }
  const prefixToken = Number.isInteger(portfolio.prefix)
    ? String(portfolio.prefix).padStart(2, '0')
    : 'xx';
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return `${prefixToken}-${timestamp}`;
}

function buildCloseLoopSessionRuntime(projectPath, sessionConfig, resumedSession, prefix) {
  if (!sessionConfig.enabled) {
    return null;
  }

  const sessionDir = getCloseLoopSessionDir(projectPath);
  const sessionId = resumedSession
    ? resumedSession.id
    : createSessionId({ portfolio: { prefix } }, sessionConfig);
  const sessionFile = resumedSession
    ? resumedSession.file
    : path.join(sessionDir, `${sessionId}.json`);
  const createdAt = resumedSession && resumedSession.data && typeof resumedSession.data.created_at === 'string' &&
    resumedSession.data.created_at.trim()
    ? resumedSession.data.created_at.trim()
    : new Date().toISOString();

  return {
    id: sessionId,
    file: sessionFile,
    resumed: Boolean(resumedSession),
    created_at: createdAt
  };
}

async function persistCloseLoopSessionSnapshot(result, sessionRuntime) {
  if (!sessionRuntime || !sessionRuntime.file) {
    return;
  }

  const snapshot = buildSessionSnapshot(result);
  snapshot.session_id = sessionRuntime.id;
  snapshot.created_at = sessionRuntime.created_at || snapshot.updated_at;

  await fs.ensureDir(path.dirname(sessionRuntime.file));
  await fs.writeJson(sessionRuntime.file, snapshot, { spaces: 2 });
}

async function maybePersistCloseLoopSession(result, sessionConfig, resumedSession, projectPath, sessionRuntime = null) {
  if (!sessionConfig.enabled) {
    return;
  }

  const resolvedSession = sessionRuntime || buildCloseLoopSessionRuntime(
    projectPath,
    sessionConfig,
    resumedSession,
    result && result.portfolio ? result.portfolio.prefix : null
  );
  if (!resolvedSession) {
    return;
  }

  await persistCloseLoopSessionSnapshot(result, resolvedSession);

  result.session = {
    id: resolvedSession.id,
    file: resolvedSession.file,
    resumed: Boolean(resolvedSession.resumed)
  };
}

async function maybePruneCloseLoopSessions(result, sessionConfig, projectPath) {
  if (!sessionConfig.enabled) {
    return;
  }

  const hasRetentionPolicy = sessionConfig.keep !== null || sessionConfig.olderThanDays !== null;
  if (!hasRetentionPolicy) {
    return;
  }

  const sessionDir = getCloseLoopSessionDir(projectPath);
  if (!(await fs.pathExists(sessionDir))) {
    return;
  }

  const files = (await fs.readdir(sessionDir))
    .filter(item => item.toLowerCase().endsWith('.json'));
  const entries = [];

  for (const file of files) {
    const filePath = path.join(sessionDir, file);
    const stats = await fs.stat(filePath);
    entries.push({
      file: filePath,
      mtimeMs: stats.mtimeMs
    });
  }

  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const keep = sessionConfig.keep === null ? Number.POSITIVE_INFINITY : sessionConfig.keep;
  const cutoffMs = sessionConfig.olderThanDays === null
    ? null
    : Date.now() - (sessionConfig.olderThanDays * 24 * 60 * 60 * 1000);

  const deleted = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.file === (result.session && result.session.file)) {
      continue;
    }

    const beyondKeep = Number.isFinite(keep) ? index >= keep : true;
    const beyondAge = cutoffMs === null || entry.mtimeMs < cutoffMs;
    if (beyondKeep && beyondAge) {
      await fs.remove(entry.file);
      deleted.push(entry.file);
    }
  }

  result.session_prune = {
    enabled: true,
    keep: Number.isFinite(keep) ? keep : null,
    older_than_days: sessionConfig.olderThanDays,
    deleted_count: deleted.length
  };
}

function normalizeReplanConfig(options) {
  const strategyCandidate = typeof options.replanStrategy === 'string'
    ? options.replanStrategy.trim().toLowerCase()
    : 'adaptive';
  if (!['fixed', 'adaptive'].includes(strategyCandidate)) {
    throw new Error('--replan-strategy must be either "fixed" or "adaptive"');
  }

  if (options.replanAttempts !== undefined && options.replanAttempts !== null) {
    const requested = Number(options.replanAttempts);
    if (!Number.isInteger(requested) || requested < 0 || requested > 5) {
      throw new Error('--replan-attempts must be an integer between 0 and 5');
    }
  }

  const resolvedAttempts = options.replanAttempts !== undefined && options.replanAttempts !== null
    ? Number(options.replanAttempts)
    : 1;
  if (options.replanNoProgressWindow !== undefined && options.replanNoProgressWindow !== null) {
    const requestedWindow = Number(options.replanNoProgressWindow);
    if (!Number.isInteger(requestedWindow) || requestedWindow < 1 || requestedWindow > 10) {
      throw new Error('--replan-no-progress-window must be an integer between 1 and 10');
    }
  }
  const noProgressWindow = options.replanNoProgressWindow !== undefined && options.replanNoProgressWindow !== null
    ? Number(options.replanNoProgressWindow)
    : 3;

  return {
    enabled: options.replan !== false && resolvedAttempts > 0,
    maxAttempts: resolvedAttempts,
    strategy: strategyCandidate,
    noProgressWindow
  };
}

function resolveEffectiveReplanBudget(replanConfig, failedSpecCount) {
  const base = replanConfig.maxAttempts;
  if (replanConfig.strategy === 'fixed') {
    return base;
  }

  const adaptiveFloor = Math.max(1, Math.ceil(Number(failedSpecCount || 0) / 2));
  return Math.min(5, Math.max(base, adaptiveFloor));
}

async function syncMasterCollaborationMetadata(collabManager, masterSpecName, subSpecs) {
  await collabManager.metadataManager.atomicUpdate(masterSpecName, metadata => {
    metadata.version = metadata.version || '1.0.0';
    metadata.type = 'master';
    const uniqueSubSpecs = [...new Set(subSpecs.map(spec => spec.name))];
    metadata.subSpecs = uniqueSubSpecs;
    metadata.dependencies = uniqueSubSpecs.map(specName => ({
      spec: specName,
      type: 'requires-completion'
    }));

    const currentStatus = metadata.status && metadata.status.current
      ? metadata.status.current
      : 'not-started';
    metadata.status = {
      current: currentStatus,
      updatedAt: new Date().toISOString()
    };
    return metadata;
  });
}

function collectFailedSpecsForReplan(orchestrationResult, masterSpecName) {
  const failed = new Set([
    ...(orchestrationResult && Array.isArray(orchestrationResult.failed) ? orchestrationResult.failed : []),
    ...(orchestrationResult && Array.isArray(orchestrationResult.skipped) ? orchestrationResult.skipped : [])
  ]);

  failed.delete(masterSpecName);
  return [...failed];
}

function shouldRunReplanCycle(
  orchestrationResult,
  failedSpecs,
  replanConfig,
  completedCycles,
  effectiveBudget
) {
  if (!replanConfig.enabled) {
    return false;
  }

  if (!orchestrationResult || orchestrationResult.status === 'completed') {
    return false;
  }

  if (failedSpecs.length === 0) {
    return false;
  }

  return completedCycles < effectiveBudget;
}

function evaluateReplanProgressStall(context) {
  const {
    orchestrationResult,
    failedSpecs,
    previousSnapshot,
    noProgressCycles,
    noProgressWindow
  } = context;

  const currentSnapshot = buildReplanProgressSnapshot(orchestrationResult, failedSpecs);
  if (!currentSnapshot.shouldTrack || !previousSnapshot || !previousSnapshot.shouldTrack) {
    return {
      shouldStall: false,
      noProgressCycles: 0,
      currentSnapshot
    };
  }

  const hasProgress =
    currentSnapshot.completedCount > previousSnapshot.completedCount ||
    currentSnapshot.failedCount < previousSnapshot.failedCount;
  const nextNoProgressCycles = hasProgress ? 0 : (noProgressCycles + 1);
  return {
    shouldStall: nextNoProgressCycles >= noProgressWindow,
    noProgressCycles: nextNoProgressCycles,
    currentSnapshot
  };
}

function buildReplanProgressSnapshot(orchestrationResult, failedSpecs) {
  const completedCount = orchestrationResult && Array.isArray(orchestrationResult.completed)
    ? orchestrationResult.completed.length
    : 0;
  const failedCount = Array.isArray(failedSpecs) ? failedSpecs.length : 0;
  const shouldTrack = Boolean(orchestrationResult) &&
    orchestrationResult.status !== 'completed' &&
    failedCount > 0;

  return {
    shouldTrack,
    completedCount,
    failedCount
  };
}

function createFailedSpecSignature(failedSpecs) {
  if (!Array.isArray(failedSpecs) || failedSpecs.length === 0) {
    return null;
  }

  const normalized = [...new Set(
    failedSpecs
      .map(item => `${item || ''}`.trim())
      .filter(Boolean)
  )].sort();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.join('|');
}

async function materializeReplanCycle(context) {
  const {
    projectPath,
    goal,
    masterSpecName,
    runtimeSubSpecs,
    runtimeAssignments,
    failedSpecs,
    cycle,
    collabManager,
    executionPlanning
  } = context;

  const remediationSpec = buildRemediationSubSpec(
    masterSpecName,
    runtimeSubSpecs,
    failedSpecs,
    cycle
  );

  await ensureSpecDirectoriesAreAvailable(projectPath, [remediationSpec]);
  await writeSingleSubSpecDocuments(projectPath, goal, remediationSpec);
  await collabManager.metadataManager.writeMetadata(remediationSpec.name, {
    version: '1.0.0',
    type: 'sub',
    masterSpec: masterSpecName,
    dependencies: remediationSpec.dependencies,
    status: {
      current: 'not-started',
      updatedAt: new Date().toISOString()
    },
    interfaces: {
      provides: [],
      consumes: []
    }
  });

  const addedAssignments = buildRemediationAssignments(runtimeAssignments, [remediationSpec]);
  for (const assignment of addedAssignments) {
    await collabManager.assignSpec(assignment.spec, assignment.agent);
  }

  runtimeSubSpecs.push(remediationSpec);
  runtimeAssignments.push(...addedAssignments);
  await syncMasterCollaborationMetadata(collabManager, masterSpecName, runtimeSubSpecs);
  await writeAgentSyncPlan(projectPath, masterSpecName, runtimeSubSpecs, runtimeAssignments, executionPlanning);

  return {
    addedSpecs: [remediationSpec],
    addedAssignments
  };
}

function buildRemediationSubSpec(masterSpecName, runtimeSubSpecs, failedSpecs, cycle) {
  const prefix = inferPrefixFromSpec(masterSpecName);
  const prefixToken = formatPrefix(prefix > 0 ? prefix : 1);
  const nextSequence = resolveNextSubSpecSequence(prefixToken, runtimeSubSpecs.map(spec => spec.name));
  const slug = trimSlug(`replan-remediation-cycle-${cycle}`, 42);

  return {
    name: `${prefixToken}-${String(nextSequence).padStart(2, '0')}-${slug}`,
    title: `Replan Remediation Cycle ${cycle}`,
    slug,
    objective: `Recover failed orchestration path for: ${failedSpecs.join(', ')}`,
    remediation_targets: [...failedSpecs],
    dependencies: []
  };
}

function resolveNextSubSpecSequence(prefixToken, specNames) {
  let max = 0;
  const pattern = new RegExp(`^${escapeRegex(prefixToken)}-(\\d+)-`);

  for (const specName of specNames) {
    const match = `${specName}`.match(pattern);
    if (!match) {
      continue;
    }
    const seq = Number(match[1]);
    if (Number.isInteger(seq) && seq > max) {
      max = seq;
    }
  }

  return max + 1;
}

function buildRemediationAssignments(existingAssignments, remediationSpecs) {
  const maxSubAgentIndex = existingAssignments.reduce((max, item) => {
    const match = `${item.agent || ''}`.match(/^agent-sub-(\d+)$/);
    if (!match) {
      return max;
    }
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > max ? parsed : max;
  }, 0);

  return remediationSpecs.map((spec, index) => ({
    spec: spec.name,
    agent: `agent-sub-${String(maxSubAgentIndex + index + 1).padStart(2, '0')}`
  }));
}

async function writeSingleSubSpecDocuments(projectPath, goal, subSpec) {
  const subPath = path.join(projectPath, '.sce', 'specs', subSpec.name);
  await fs.ensureDir(subPath);
  await fs.writeFile(path.join(subPath, 'requirements.md'), buildSubRequirements(goal, subSpec), 'utf8');
  await fs.writeFile(path.join(subPath, 'design.md'), buildSubDesign(subSpec), 'utf8');
  await fs.writeFile(path.join(subPath, 'tasks.md'), buildSubTasks(subSpec), 'utf8');
}

function formatPrefix(prefix) {
  return prefix < 10 ? `0${prefix}` : `${prefix}`;
}

function trimSlug(value, maxLength) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength).replace(/-+$/g, '');
}

function escapeRegex(value) {
  return `${value}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureSpecDirectoriesAreAvailable(projectPath, specs) {
  for (const spec of specs) {
    const specPath = path.join(projectPath, '.sce', 'specs', spec.name);
    if (await fs.pathExists(specPath)) {
      throw new Error(`Spec already exists: ${spec.name}. Use --prefix to select a new portfolio number.`);
    }
  }
}

async function writeSpecDocuments(projectPath, decomposition) {
  const masterPath = path.join(projectPath, '.sce', 'specs', decomposition.masterSpec.name);
  await fs.ensureDir(masterPath);
  await fs.writeFile(path.join(masterPath, 'requirements.md'), buildMasterRequirements(decomposition), 'utf8');
  await fs.writeFile(path.join(masterPath, 'design.md'), buildMasterDesign(decomposition), 'utf8');
  await fs.writeFile(path.join(masterPath, 'tasks.md'), buildMasterTasks(decomposition), 'utf8');

  for (const subSpec of decomposition.subSpecs) {
    const subPath = path.join(projectPath, '.sce', 'specs', subSpec.name);
    await fs.ensureDir(subPath);
    await fs.writeFile(path.join(subPath, 'requirements.md'), buildSubRequirements(decomposition.goal, subSpec), 'utf8');
    await fs.writeFile(path.join(subPath, 'design.md'), buildSubDesign(subSpec), 'utf8');
    await fs.writeFile(path.join(subPath, 'tasks.md'), buildSubTasks(subSpec), 'utf8');
  }
}

function buildAssignments(masterSpec, subSpecs) {
  const assignments = [
    { spec: masterSpec.name, agent: 'agent-master' }
  ];

  subSpecs.forEach((spec, index) => {
    assignments.push({
      spec: spec.name,
      agent: `agent-sub-${String(index + 1).padStart(2, '0')}`
    });
  });

  return assignments;
}

async function synchronizeCollaborationStatus(collabManager, allSpecNames, orchestrationResult) {
  const completed = new Set(orchestrationResult.completed || []);
  const failed = new Set(orchestrationResult.failed || []);
  const skipped = new Set(orchestrationResult.skipped || []);

  for (const specName of allSpecNames) {
    if (completed.has(specName)) {
      await collabManager.updateSpecStatus(specName, 'completed');
      continue;
    }

    if (failed.has(specName)) {
      await collabManager.updateSpecStatus(specName, 'blocked', 'orchestration-failed');
      continue;
    }

    if (skipped.has(specName)) {
      await collabManager.updateSpecStatus(specName, 'blocked', 'dependency-skipped');
      continue;
    }

    await collabManager.updateSpecStatus(specName, 'not-started');
  }
}

function normalizeDodRiskLevel(levelCandidate) {
  if (levelCandidate === undefined || levelCandidate === null || `${levelCandidate}`.trim() === '') {
    return null;
  }
  const normalized = `${levelCandidate}`.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(RISK_LEVEL_ORDER, normalized)) {
    throw new Error('--dod-max-risk-level must be one of: low, medium, high');
  }
  return normalized;
}

function normalizeDodMinCompletionRate(rateCandidate) {
  if (rateCandidate === undefined || rateCandidate === null || `${rateCandidate}`.trim() === '') {
    return null;
  }
  const parsed = Number(rateCandidate);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('--dod-kpi-min-completion-rate must be a number between 0 and 100');
  }
  return Number(parsed.toFixed(2));
}

function normalizeDodMaxSuccessRateDrop(dropCandidate) {
  if (dropCandidate === undefined || dropCandidate === null || `${dropCandidate}`.trim() === '') {
    return null;
  }
  const parsed = Number(dropCandidate);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('--dod-max-success-rate-drop must be a number between 0 and 100');
  }
  return Number(parsed.toFixed(2));
}

function normalizeDodBaselineWindow(windowCandidate) {
  if (windowCandidate === undefined || windowCandidate === null || `${windowCandidate}`.trim() === '') {
    return 5;
  }
  const parsed = Number(windowCandidate);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error('--dod-baseline-window must be an integer between 1 and 50');
  }
  return parsed;
}

function normalizeDefinitionOfDoneConfig(options) {
  const timeoutCandidate = Number(options.dodTestsTimeout);
  const minCompletionRateCandidate = options.dodKpiMinCompletionRate;
  const baselineDropCandidate = options.dodMaxSuccessRateDrop;
  const baselineWindowCandidate = options.dodBaselineWindow;

  return {
    enabled: options.dod !== false,
    requireDocs: options.dodDocs !== false,
    requireCollabCompleted: options.dodCollab !== false,
    requireOrchestrationCompleted: options.run !== false,
    requireTasksClosed: Boolean(options.dodTasksClosed),
    maxRiskLevel: normalizeDodRiskLevel(options.dodMaxRiskLevel),
    minCompletionRatePercent: normalizeDodMinCompletionRate(minCompletionRateCandidate),
    maxSuccessRateDropPercent: normalizeDodMaxSuccessRateDrop(baselineDropCandidate),
    baselineWindow: normalizeDodBaselineWindow(baselineWindowCandidate),
    testCommand: typeof options.dodTests === 'string' && options.dodTests.trim()
      ? options.dodTests.trim()
      : null,
    testTimeoutMs: Number.isFinite(timeoutCandidate) && timeoutCandidate > 0
      ? timeoutCandidate
      : 10 * 60 * 1000
  };
}

async function evaluateDefinitionOfDone(context) {
  const {
    projectPath,
    specNames,
    orchestrationResult,
    runInvoked,
    dodConfig,
    runCommand
  } = context;

  if (!dodConfig.enabled) {
    return {
      enabled: false,
      passed: true,
      failed_checks: [],
      checks: []
    };
  }

  const checks = [];
  const completionRatePercent = calculateCloseLoopCompletionRatePercent(orchestrationResult, specNames);
  const derivedRiskLevel = deriveCloseLoopRiskLevel(orchestrationResult, specNames);

  if (dodConfig.requireDocs) {
    const missingDocs = await findMissingSpecDocuments(projectPath, specNames);
    checks.push({
      id: 'docs-complete',
      status: missingDocs.length === 0 ? 'passed' : 'failed',
      message: missingDocs.length === 0
        ? 'All spec docs are present (requirements/design/tasks).'
        : `Missing spec docs: ${missingDocs.join(', ')}`
    });
  } else {
    checks.push({
      id: 'docs-complete',
      status: 'skipped',
      message: 'Doc completeness gate disabled.'
    });
  }

  if (dodConfig.requireOrchestrationCompleted) {
    const completed = orchestrationResult && orchestrationResult.status === 'completed';
    checks.push({
      id: 'orchestration-completed',
      status: completed ? 'passed' : 'failed',
      message: completed
        ? 'Orchestration reached completed terminal state.'
        : `Orchestration terminal status is ${orchestrationResult ? orchestrationResult.status : 'unknown'}.`
    });
  } else {
    checks.push({
      id: 'orchestration-completed',
      status: 'skipped',
      message: 'Orchestration gate skipped (--no-run).'
    });
  }

  if (dodConfig.maxRiskLevel) {
    const passesRisk = compareRiskLevels(derivedRiskLevel, dodConfig.maxRiskLevel) <= 0;
    checks.push({
      id: 'risk-level-threshold',
      status: passesRisk ? 'passed' : 'failed',
      message: passesRisk
        ? `Derived run risk "${derivedRiskLevel}" is within threshold "${dodConfig.maxRiskLevel}".`
        : `Derived run risk "${derivedRiskLevel}" exceeds threshold "${dodConfig.maxRiskLevel}".`,
      details: {
        derived_risk_level: derivedRiskLevel,
        max_risk_level: dodConfig.maxRiskLevel
      }
    });
  } else {
    checks.push({
      id: 'risk-level-threshold',
      status: 'skipped',
      message: 'Risk threshold gate disabled.'
    });
  }

  if (dodConfig.minCompletionRatePercent !== null) {
    const completionPassed = completionRatePercent >= dodConfig.minCompletionRatePercent;
    checks.push({
      id: 'kpi-completion-rate-threshold',
      status: completionPassed ? 'passed' : 'failed',
      message: completionPassed
        ? `Completion KPI ${completionRatePercent}% meets threshold ${dodConfig.minCompletionRatePercent}%.`
        : `Completion KPI ${completionRatePercent}% is below threshold ${dodConfig.minCompletionRatePercent}%.`,
      details: {
        completion_rate_percent: completionRatePercent,
        min_completion_rate_percent: dodConfig.minCompletionRatePercent
      }
    });
  } else {
    checks.push({
      id: 'kpi-completion-rate-threshold',
      status: 'skipped',
      message: 'Completion KPI threshold gate disabled.'
    });
  }

  if (dodConfig.maxSuccessRateDropPercent !== null) {
    const baselineSnapshot = await buildCloseLoopSuccessRateBaseline(projectPath, dodConfig.baselineWindow);
    if (baselineSnapshot.sample_count <= 0) {
      checks.push({
        id: 'kpi-baseline-drop-threshold',
        status: 'skipped',
        message: 'Baseline KPI gate skipped because no historical close-loop sessions were found.',
        details: {
          baseline_window: dodConfig.baselineWindow
        }
      });
    } else {
      const baselineDrop = Number((baselineSnapshot.average_success_rate_percent - completionRatePercent).toFixed(2));
      const dropPassed = baselineDrop <= dodConfig.maxSuccessRateDropPercent;
      checks.push({
        id: 'kpi-baseline-drop-threshold',
        status: dropPassed ? 'passed' : 'failed',
        message: dropPassed
          ? `Completion KPI drop ${baselineDrop}% is within allowed baseline drop ${dodConfig.maxSuccessRateDropPercent}%.`
          : `Completion KPI drop ${baselineDrop}% exceeds allowed baseline drop ${dodConfig.maxSuccessRateDropPercent}%.`,
        details: {
          baseline_window: baselineSnapshot.sample_count,
          baseline_success_rate_percent: baselineSnapshot.average_success_rate_percent,
          latest_completion_rate_percent: completionRatePercent,
          baseline_drop_percent: baselineDrop,
          max_allowed_drop_percent: dodConfig.maxSuccessRateDropPercent
        }
      });
    }
  } else {
    checks.push({
      id: 'kpi-baseline-drop-threshold',
      status: 'skipped',
      message: 'Baseline KPI drop threshold gate disabled.'
    });
  }

  if (dodConfig.requireCollabCompleted) {
    if (!runInvoked) {
      checks.push({
        id: 'collaboration-completed',
        status: 'skipped',
        message: 'Collaboration completion gate skipped because orchestration did not run.'
      });
    } else {
      const nonCompleted = await findNonCompletedCollaborationSpecs(projectPath, specNames);
      checks.push({
        id: 'collaboration-completed',
        status: nonCompleted.length === 0 ? 'passed' : 'failed',
        message: nonCompleted.length === 0
          ? 'Collaboration statuses are completed for all specs.'
          : `Collaboration not completed: ${nonCompleted.join(', ')}`
      });
    }
  } else {
    checks.push({
      id: 'collaboration-completed',
      status: 'skipped',
      message: 'Collaboration gate disabled.'
    });
  }

  if (dodConfig.requireTasksClosed) {
    const openTasks = await findSpecsWithOpenTasks(projectPath, specNames);
    checks.push({
      id: 'tasks-checklist-closed',
      status: openTasks.length === 0 ? 'passed' : 'failed',
      message: openTasks.length === 0
        ? 'All tasks checklists are fully closed.'
        : `Open checklist items remain in: ${openTasks.join(', ')}`
    });
  } else {
    checks.push({
      id: 'tasks-checklist-closed',
      status: 'skipped',
      message: 'Tasks checklist closure gate disabled.'
    });
  }

  if (dodConfig.testCommand) {
    const testResult = await runCommand(dodConfig.testCommand, {
      cwd: projectPath,
      timeoutMs: dodConfig.testTimeoutMs
    });
    checks.push({
      id: 'tests-command',
      status: testResult.success ? 'passed' : 'failed',
      message: testResult.success
        ? `Test command passed: ${dodConfig.testCommand}`
        : `Test command failed: ${dodConfig.testCommand} (code=${testResult.code === null ? 'n/a' : testResult.code})`,
      details: summarizeCommandFailure(testResult)
    });
  } else {
    checks.push({
      id: 'tests-command',
      status: 'skipped',
      message: 'No DoD test command configured.'
    });
  }

  const failedChecks = checks.filter(check => check.status === 'failed');
  return {
    enabled: true,
    passed: failedChecks.length === 0,
    failed_checks: failedChecks.map(check => check.id),
    checks
  };
}

function compareRiskLevels(left, right) {
  const leftValue = RISK_LEVEL_ORDER[left] || RISK_LEVEL_ORDER.high;
  const rightValue = RISK_LEVEL_ORDER[right] || RISK_LEVEL_ORDER.high;
  return leftValue - rightValue;
}

function calculateCloseLoopCompletionRatePercent(orchestrationResult, specNames) {
  const totalSpecs = Array.isArray(specNames) ? specNames.length : 0;
  if (totalSpecs <= 0) {
    return 0;
  }
  if (!orchestrationResult || typeof orchestrationResult !== 'object') {
    return 0;
  }
  const completedList = Array.isArray(orchestrationResult.completed) ? orchestrationResult.completed : [];
  const uniqueCompleted = new Set(completedList.map(item => `${item || ''}`.trim()).filter(Boolean)).size;
  return Number(((uniqueCompleted / totalSpecs) * 100).toFixed(2));
}

function deriveCloseLoopRiskLevel(orchestrationResult, specNames) {
  const totalSpecs = Array.isArray(specNames) ? specNames.length : 0;
  if (totalSpecs <= 0 || !orchestrationResult || typeof orchestrationResult !== 'object') {
    return 'high';
  }
  const failedList = [
    ...(Array.isArray(orchestrationResult.failed) ? orchestrationResult.failed : []),
    ...(Array.isArray(orchestrationResult.skipped) ? orchestrationResult.skipped : [])
  ];
  const failedSpecs = new Set(failedList.map(item => `${item || ''}`.trim()).filter(Boolean)).size;
  if (failedSpecs <= 0 && `${orchestrationResult.status || ''}`.trim().toLowerCase() === 'completed') {
    return 'low';
  }
  const failedRatio = totalSpecs > 0 ? failedSpecs / totalSpecs : 1;
  if (failedRatio >= 0.4) {
    return 'high';
  }
  return 'medium';
}

async function buildCloseLoopSuccessRateBaseline(projectPath, baselineWindow) {
  const sessionDir = getCloseLoopSessionDir(projectPath);
  const windowSize = Number.isInteger(baselineWindow) ? baselineWindow : 5;
  if (!(await fs.pathExists(sessionDir))) {
    return {
      sample_count: 0,
      average_success_rate_percent: 0
    };
  }

  const entries = (await fs.readdir(sessionDir))
    .filter(item => item.toLowerCase().endsWith('.json'))
    .map(item => path.join(sessionDir, item));
  const sessions = [];
  for (const file of entries) {
    let payload = null;
    try {
      payload = await fs.readJson(file);
    } catch (error) {
      continue;
    }
    const stats = await fs.stat(file);
    sessions.push({
      payload,
      mtimeMs: stats.mtimeMs
    });
  }

  sessions.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const scoped = sessions.slice(0, windowSize);
  const successRates = scoped
    .map(item => {
      const payload = item.payload || {};
      const portfolio = payload.portfolio && typeof payload.portfolio === 'object' ? payload.portfolio : {};
      const totalSpecs = (Array.isArray(portfolio.sub_specs) ? portfolio.sub_specs.length : 0) + 1;
      const orchestration = payload.orchestration && typeof payload.orchestration === 'object' ? payload.orchestration : null;
      if (orchestration && Array.isArray(orchestration.completed) && totalSpecs > 0) {
        const completed = new Set(orchestration.completed.map(spec => `${spec || ''}`.trim()).filter(Boolean)).size;
        return Number(((completed / totalSpecs) * 100).toFixed(2));
      }
      const status = `${payload.status || ''}`.trim().toLowerCase();
      if (status === 'completed') {
        return 100;
      }
      if (status === 'failed' || status === 'partial-failed') {
        return 0;
      }
      return null;
    })
    .filter(value => Number.isFinite(value));

  if (successRates.length === 0) {
    return {
      sample_count: 0,
      average_success_rate_percent: 0
    };
  }
  const average = successRates.reduce((sum, value) => sum + value, 0) / successRates.length;
  return {
    sample_count: successRates.length,
    average_success_rate_percent: Number(average.toFixed(2))
  };
}

async function findMissingSpecDocuments(projectPath, specNames) {
  const requiredDocs = ['requirements.md', 'design.md', 'tasks.md'];
  const missing = [];

  for (const specName of specNames) {
    const basePath = path.join(projectPath, '.sce', 'specs', specName);
    for (const docName of requiredDocs) {
      const filePath = path.join(basePath, docName);
      if (!(await fs.pathExists(filePath))) {
        missing.push(`${specName}/${docName}`);
      }
    }
  }

  return missing;
}

async function findNonCompletedCollaborationSpecs(projectPath, specNames) {
  const notCompleted = [];

  for (const specName of specNames) {
    const collabPath = path.join(projectPath, '.sce', 'specs', specName, 'collaboration.json');
    if (!(await fs.pathExists(collabPath))) {
      notCompleted.push(`${specName}(missing-collaboration-json)`);
      continue;
    }

    const metadata = await fs.readJson(collabPath);
    const currentStatus = metadata.status && metadata.status.current;
    if (currentStatus !== 'completed') {
      notCompleted.push(`${specName}(${currentStatus || 'unknown'})`);
    }
  }

  return notCompleted;
}

async function findSpecsWithOpenTasks(projectPath, specNames) {
  const specsWithOpenTasks = [];

  for (const specName of specNames) {
    const tasksPath = path.join(projectPath, '.sce', 'specs', specName, 'tasks.md');
    if (!(await fs.pathExists(tasksPath))) {
      specsWithOpenTasks.push(specName);
      continue;
    }

    const content = await fs.readFile(tasksPath, 'utf8');
    if (/\n\s*-\s*\[\s\]\s+/.test(`\n${content}`)) {
      specsWithOpenTasks.push(specName);
    }
  }

  return specsWithOpenTasks;
}

function summarizeCommandFailure(result) {
  if (result.success) {
    return null;
  }

  if (result.timedOut) {
    return `Timed out after ${result.timeoutMs}ms`;
  }

  if (result.error) {
    return result.error;
  }

  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  return stderr || stdout || 'No error output captured.';
}

function executeShellCommand(command, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : 10 * 60 * 1000;

  return new Promise(resolve => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timeout = null;
    const maxOutputChars = 50_000;

    const finish = result => {
      if (settled) return;
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(result);
    };

    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env
    });

    const append = (current, chunk) => {
      const next = current + chunk.toString();
      if (next.length <= maxOutputChars) {
        return next;
      }
      return next.slice(next.length - maxOutputChars);
    };

    child.stdout.on('data', data => {
      stdout = append(stdout, data);
    });

    child.stderr.on('data', data => {
      stderr = append(stderr, data);
    });

    child.on('close', (code, signal) => {
      finish({
        success: code === 0,
        code,
        signal,
        stdout,
        stderr
      });
    });

    child.on('error', error => {
      finish({
        success: false,
        code: null,
        signal: null,
        stdout,
        stderr,
        error: error.message
      });
    });

    timeout = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch (_err) {
        // Child process may already be gone.
      }
      finish({
        success: false,
        code: null,
        signal: 'SIGTERM',
        stdout,
        stderr,
        timedOut: true,
        timeoutMs
      });
    }, timeoutMs);

    if (typeof timeout.unref === 'function') {
      timeout.unref();
    }
  });
}

function buildMasterRequirements(decomposition) {
  const lines = [
    '# Requirements',
    '',
    `## Goal`,
    decomposition.goal,
    '',
    '## Functional Requirements',
    '1. THE SYSTEM SHALL decompose the goal into a coordinated master/sub-spec portfolio automatically.',
    '2. THE SYSTEM SHALL execute the portfolio in a closed loop until orchestration reaches a terminal state.',
    '3. THE SYSTEM SHALL synchronize collaboration metadata, ownership, and dependency status across all specs.',
    '4. THE SYSTEM SHALL emit machine-readable execution evidence for downstream auditing.',
    '',
    '## Success Criteria',
    `- Master Spec: \`${decomposition.masterSpec.name}\``,
    `- Sub Specs: ${decomposition.subSpecs.map(spec => `\`${spec.name}\``).join(', ')}`,
    '- Portfolio can be rerun deterministically with the same topology.',
    ''
  ];

  return lines.join('\n');
}

function buildMasterDesign(decomposition) {
  const lines = [
    '# Design',
    '',
    '## Requirement Mapping',
    '- FR1 -> Portfolio decomposition engine + naming strategy',
    '- FR2 -> Orchestrate runtime invocation with dependency-aware order',
    '- FR3 -> Collaboration metadata synchronization (status + assignment)',
    '- FR4 -> JSON result artifact and terminal summary',
    '',
    '## Coordination Topology',
    `- Master: \`${decomposition.masterSpec.name}\``,
    ...decomposition.subSpecs.map(subSpec => {
      const deps = subSpec.dependencies.map(dep => dep.spec).join(', ');
      return `- Sub: \`${subSpec.name}\`${deps ? ` (depends on: ${deps})` : ''}`;
    }),
    '',
    '## Integration Contract',
    '- All Sub Specs must be marked completed before the Master Spec can be completed.',
    '- Blocked/failed Sub Specs propagate a blocked state to dependent Specs.',
    '- Final result is published as a single orchestration report payload.',
    ''
  ];

  return lines.join('\n');
}

function buildMasterTasks(decomposition) {
  const lines = [
    '# Tasks',
    '',
    '- [ ] 1. Confirm portfolio topology and dependency contracts',
    '  - **Requirement**: FR1',
    '  - **Design**: Coordination Topology',
    '  - **Validation**: Dependencies are explicit and acyclic',
    '',
    '- [ ] 2. Launch orchestrate runtime for all Sub Specs and Master',
    '  - **Requirement**: FR2',
    '  - **Design**: Integration Contract',
    '  - **Validation**: `sce orchestrate run` reaches terminal state',
    '',
    '- [ ] 3. Reconcile collaboration status and produce closure evidence',
    '  - **Requirement**: FR3, FR4',
    '  - **Design**: Integration Contract',
    '  - **Validation**: collaboration metadata + JSON artifact are consistent',
    '',
    `## Linked Sub Specs`,
    ...decomposition.subSpecs.map(subSpec => `- [ ] ${subSpec.name}`),
    ''
  ];

  return lines.join('\n');
}

function buildSubRequirements(goal, subSpec) {
  const lines = [
    '# Requirements',
    '',
    '## Goal Alignment',
    goal,
    '',
    `## Sub Capability: ${subSpec.title}`,
    subSpec.objective,
    '',
    '## Functional Requirements',
    '1. THE SYSTEM SHALL implement the capability scope defined in this Sub Spec.',
    '2. THE SYSTEM SHALL provide integration-ready outputs for downstream dependent Specs.',
    '3. THE SYSTEM SHALL maintain testable acceptance evidence for completion gates.',
    ''
  ];

  return lines.join('\n');
}

function buildSubDesign(subSpec) {
  const dependencyNames = subSpec.dependencies.map(dep => dep.spec);
  const dependencyLine = dependencyNames.length > 0
    ? dependencyNames.join(', ')
    : 'None';

  const lines = [
    '# Design',
    '',
    '## Requirement Mapping',
    '- FR1 -> Capability implementation unit',
    '- FR2 -> Integration output contract',
    '- FR3 -> Validation and gate evidence',
    '',
    '## Execution Contract',
    `- Capability: ${subSpec.title}`,
    `- Dependencies: ${dependencyLine}`,
    '- Output: updated requirements/design/tasks and implementation artifacts',
    '- Validation: tests + gate evidence for completion',
    ''
  ];

  return lines.join('\n');
}

function buildSubTasks(subSpec) {
  const lines = [
    '# Tasks',
    '',
    '- [ ] 1. Implement capability scope for this Sub Spec',
    '  - **Requirement**: FR1',
    '  - **Design**: Execution Contract',
    '  - **Validation**: Deliver scoped implementation with clear boundaries',
    '',
    '- [ ] 2. Produce integration-ready outputs and contracts',
    '  - **Requirement**: FR2',
    '  - **Design**: Execution Contract',
    '  - **Validation**: Downstream Specs can consume outputs without ambiguity',
    '',
    '- [ ] 3. Complete validation evidence and handoff summary',
    '  - **Requirement**: FR3',
    '  - **Design**: Execution Contract',
    '  - **Validation**: Tests and gate evidence are attached',
    ''
  ];

  if (subSpec.dependencies.length > 0) {
    lines.push('## Dependencies');
    subSpec.dependencies.forEach(dep => {
      lines.push(`- [ ] ${dep.spec} (${dep.type})`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

function buildNextActions(status, dod, replan) {
  if ((status === 'failed' || status === 'stopped') && replan && replan.enabled && replan.exhausted) {
    const budget = replan.effective_max_attempts || replan.max_attempts;
    const stalledMessage = replan.stalled_signature
      ? `Replan stopped because failed-spec signature repeated: ${replan.stalled_signature}.`
      : replan.stalled_no_progress_cycles > 0
        ? `Replan stopped because no progress was detected for ${replan.stalled_no_progress_cycles} consecutive failed cycles.`
        : `Automatic replan attempts exhausted (${budget}).`;
    return [
      stalledMessage,
      'Run `sce auto close-loop --resume latest --replan-attempts <n>` to continue with higher replan budget.',
      'Use `sce orchestrate status --json` for failure diagnostics.'
    ];
  }

  if (dod && dod.enabled && dod.passed === false) {
    const failures = dod.failed_checks && dod.failed_checks.length > 0
      ? dod.failed_checks.join(', ')
      : 'unknown';
    return [
      `Resolve failed Definition-of-Done gates: ${failures}.`,
      'Run `sce auto close-loop "<goal>" --dod-tests "<command>"` again after fixes.',
      'Use `sce orchestrate status --json` for detailed orchestration diagnostics.'
    ];
  }

  if (status === 'completed') {
    const replanHint = replan && replan.performed > 0
      ? `Replan cycles executed: ${replan.performed}.`
      : 'No replan cycle was required.';
    return [
      replanHint,
      'Inspect orchestration summary and merged outputs from all sub-specs.',
      'Run `sce collab status --graph` to verify final dependency graph health.'
    ];
  }

  if (status === 'failed' || status === 'stopped') {
    return [
      'Run `sce orchestrate status --json` for failure details.',
      'Resolve blocked specs and rerun the close-loop command with a new prefix.'
    ];
  }

  return [
    'Run `sce orchestrate status` to observe runtime progress.'
  ];
}

function normalizeDodReportPath(result, options, projectPath) {
  if (typeof options.dodReport === 'string' && options.dodReport.trim()) {
    const customPath = options.dodReport.trim();
    return path.isAbsolute(customPath)
      ? customPath
      : path.join(projectPath, customPath);
  }

  return path.join(
    projectPath,
    '.sce',
    'specs',
    result.portfolio.master_spec,
    'custom',
    'dod-report.json'
  );
}

function buildDodReportPayload(result) {
  const orchestrationSummary = result.orchestration
    ? {
        status: result.orchestration.status,
        completed_count: (result.orchestration.completed || []).length,
        failed_count: (result.orchestration.failed || []).length,
        skipped_count: (result.orchestration.skipped || []).length
      }
    : null;

  return {
    mode: 'auto-close-loop-dod-report',
    generated_at: new Date().toISOString(),
    goal: result.goal,
    status: result.status,
    portfolio: {
      prefix: result.portfolio.prefix,
      master_spec: result.portfolio.master_spec,
      sub_specs: result.portfolio.sub_specs
    },
    replan: result.replan,
    dod: result.dod,
    orchestration: orchestrationSummary,
    next_actions: result.next_actions
  };
}

async function maybeWriteDodReport(result, options, projectPath) {
  if (options.dodReport === false) {
    return;
  }

  const reportPath = normalizeDodReportPath(result, options, projectPath);
  const payload = buildDodReportPayload(result);
  await fs.ensureDir(path.dirname(reportPath));
  await fs.writeJson(reportPath, payload, { spaces: 2 });
  result.dod_report_file = reportPath;
}

async function maybeWriteOutput(result, options, projectPath) {
  if (!options.out) {
    return;
  }

  const outputPath = path.isAbsolute(options.out)
    ? options.out
    : path.join(projectPath, options.out);

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeJson(outputPath, result, { spaces: 2 });
  result.output_file = outputPath;
}

function printResult(result, options) {
  if (options.quiet) {
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(chalk.blue('🚀') + ' Autonomous close-loop portfolio generated');
  console.log(chalk.gray(`  Goal: ${result.goal}`));
  console.log(chalk.gray(`  Status: ${result.status}`));
  console.log(chalk.gray(`  Master: ${result.portfolio.master_spec}`));
  console.log(chalk.gray(`  Sub Specs: ${result.portfolio.sub_specs.join(', ')}`));

  if (result.orchestration) {
    console.log(chalk.gray(`  Orchestration: ${result.orchestration.status}`));
  }

  if (result.replan && result.replan.enabled) {
    const summary = `${result.replan.performed}/${result.replan.effective_max_attempts || result.replan.max_attempts} cycles`;
    const strategy = result.replan.strategy ? ` strategy=${result.replan.strategy}` : '';
    const exhaustedTag = result.replan.exhausted ? ' (exhausted)' : '';
    console.log(chalk.gray(`  Replan: ${summary}${strategy}${exhaustedTag}`));
  }

  if (result.dod && result.dod.enabled) {
    const failedCount = result.dod.failed_checks.length;
    const totalChecks = result.dod.checks.length;
    console.log(chalk.gray(
      `  DoD: ${result.dod.passed ? 'passed' : 'failed'} (${totalChecks - failedCount}/${totalChecks} checks passed)`
    ));
    if (!result.dod.passed) {
      console.log(chalk.gray(`  DoD failures: ${result.dod.failed_checks.join(', ')}`));
    }
  }

  if (result.output_file) {
    console.log(chalk.gray(`  Output: ${result.output_file}`));
  }

  if (result.dod_report_file) {
    console.log(chalk.gray(`  DoD report: ${result.dod_report_file}`));
  }

  if (result.session) {
    const resumeTag = result.session.resumed ? ' (resumed)' : '';
    console.log(chalk.gray(`  Session: ${result.session.id}${resumeTag}`));
    console.log(chalk.gray(`  Session file: ${result.session.file}`));
  }

  if (result.session_prune && result.session_prune.enabled) {
    console.log(chalk.gray(
      `  Session prune: deleted=${result.session_prune.deleted_count} keep=` +
      `${result.session_prune.keep === null ? 'all' : result.session_prune.keep}`
    ));
  }
}

function createStatusReporter(options) {
  if (options.json || options.stream === false) {
    return null;
  }

  let lastSignature = '';
  let previousSpecStates = new Map();

  return status => {
    const signature = [
      status.status,
      status.currentBatch || 0,
      status.totalBatches || 0,
      status.completedSpecs || 0,
      status.failedSpecs || 0,
      status.runningSpecs || 0
    ].join('|');

    if (signature !== lastSignature) {
      console.log(chalk.gray(
        `[orchestrate] status=${status.status} batch=${status.currentBatch || 0}/${status.totalBatches || 0} ` +
        `completed=${status.completedSpecs || 0} failed=${status.failedSpecs || 0} running=${status.runningSpecs || 0}`
      ));
      lastSignature = signature;
    }

    const specEntries = Object.entries(status.specs || {});
    for (const [specName, info] of specEntries) {
      const prev = previousSpecStates.get(specName);
      if (prev !== info.status) {
        console.log(chalk.gray(`  [spec] ${specName} -> ${info.status}`));
        previousSpecStates.set(specName, info.status);
      }
    }
  };
}

module.exports = {
  runAutoCloseLoop,
  buildAssignments,
  writeSpecDocuments
};

async function writeAgentSyncPlan(projectPath, masterSpecName, subSpecs, assignments, executionPlanning = null) {
  const customDir = path.join(projectPath, '.sce', 'specs', masterSpecName, 'custom');
  await fs.ensureDir(customDir);
  const leaseBySpec = executionPlanning && executionPlanning.lease_plan && executionPlanning.lease_plan.lease_by_spec
    ? executionPlanning.lease_plan.lease_by_spec
    : {};
  const conflictGroups = executionPlanning && executionPlanning.lease_plan && Array.isArray(executionPlanning.lease_plan.conflicts)
    ? executionPlanning.lease_plan.conflicts
    : [];
  const scheduling = executionPlanning && executionPlanning.planned_order
    ? executionPlanning.planned_order
    : null;
  const ontologyGuidance = executionPlanning && executionPlanning.ontology_guidance
    ? executionPlanning.ontology_guidance
    : null;

  const lines = [
    '# Agent Sync Plan',
    '',
    '## Agent Topology',
    ...assignments.map(item => {
      const leaseKey = leaseBySpec[item.spec] ? ` lease=\`${leaseBySpec[item.spec]}\`` : '';
      return `- \`${item.agent}\`: owns \`${item.spec}\`${leaseKey}`;
    }),
    '',
    '## Dependency Cadence',
    ...subSpecs.map(spec => {
      const deps = spec.dependencies.map(dep => dep.spec).join(', ');
      return deps
        ? `- \`${spec.name}\` starts after: ${deps}`
        : `- \`${spec.name}\` can start immediately`;
    }),
    '',
    '## Close-Loop Rules',
    '1. Sub specs update collaboration status immediately after each milestone.',
    '2. Master spec only transitions to completed when all subs are completed.',
    '3. Any failed/blocked sub spec propagates blocked state to dependent specs.',
    ''
  ];

  if (conflictGroups.length > 0) {
    lines.push(
      '## Lease Conflict Guard',
      ...conflictGroups.map(group => `- lease \`${group.lease_key}\`: ${group.specs.join(', ')}`),
      ''
    );
  }

  if (scheduling && Array.isArray(scheduling.reordered) && scheduling.reordered.length > 0) {
    lines.push(
      '## Scheduling Plan',
      `- Auto reordered: ${scheduling.auto_reordered ? 'yes' : 'no'}`,
      `- Sequence: ${scheduling.reordered.join(' -> ')}`,
      ''
    );
  }

  if (ontologyGuidance && ontologyGuidance.enabled) {
    const suggested = Array.isArray(ontologyGuidance.suggested_sequence)
      ? ontologyGuidance.suggested_sequence.join(' -> ')
      : '(none)';
    lines.push(
      '## Ontology Guidance',
      `- Source: ${ontologyGuidance.source}`,
      `- Suggested sequence: ${suggested}`,
      ''
    );
  }

  await fs.writeFile(path.join(customDir, 'agent-sync-plan.md'), lines.join('\n'), 'utf8');
}
