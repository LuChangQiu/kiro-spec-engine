const path = require('path');

async function runAutoGovernanceCloseLoop(projectPath, options = {}, dependencies = {}) {
  const {
    loadGovernanceCloseLoopSessionPayload,
    isExplicitOptionSource,
    normalizeStatsWindowDays,
    normalizeStatusFilter,
    normalizeGovernanceMaxRounds,
    normalizeGovernanceTargetRiskLevel,
    normalizeGovernanceAdvisoryRecoverMaxRounds,
    normalizeGovernanceAdvisoryControllerMaxCycles,
    normalizeGovernanceSessionKeep,
    normalizeGovernanceSessionOlderThanDays,
    sanitizeBatchSessionId,
    createGovernanceCloseLoopSessionId,
    buildAutoGovernanceStats,
    runAutoGovernanceMaintenance,
    executeGovernanceAdvisoryRecover,
    executeGovernanceAdvisoryControllerResume,
    evaluateGovernanceReleaseGateBlockState,
    extractGovernanceWeeklyOpsStopDetail,
    compareRiskLevel,
    buildGovernanceCloseLoopRecommendations,
    persistGovernanceCloseLoopSession,
    resolveGovernanceCloseLoopRunStatus,
    pruneGovernanceCloseLoopSessions,
    getGovernanceCloseLoopSessionDir,
    extractGovernanceReleaseGateSnapshot
  } = dependencies;

  let resumedGovernanceSession = null;
  if (options.governanceResume) {
    resumedGovernanceSession = await loadGovernanceCloseLoopSessionPayload(projectPath, options.governanceResume);
  }

  const resumePayload = resumedGovernanceSession && resumedGovernanceSession.payload && typeof resumedGovernanceSession.payload === 'object'
    ? resumedGovernanceSession.payload
    : null;
  const optionSources = options && options.optionSources && typeof options.optionSources === 'object'
    ? options.optionSources
    : {};
  const isExplicitOption = optionName => isExplicitOptionSource(optionSources[optionName]);
  const allowResumeDrift = Boolean(options.governanceResumeAllowDrift);

  const maxRounds = normalizeGovernanceMaxRounds(
    options.maxRounds !== undefined && options.maxRounds !== null
      ? options.maxRounds
      : (resumePayload && resumePayload.max_rounds !== undefined && resumePayload.max_rounds !== null
        ? resumePayload.max_rounds
        : undefined),
    3
  );
  const resumeTargetRisk = resumedGovernanceSession && resumePayload && typeof resumePayload.target_risk === 'string'
    ? normalizeGovernanceTargetRiskLevel(resumePayload.target_risk)
    : null;
  const targetRisk = normalizeGovernanceTargetRiskLevel(
    resumedGovernanceSession && !isExplicitOption('targetRisk')
      ? (resumePayload && resumePayload.target_risk !== undefined && resumePayload.target_risk !== null
        ? resumePayload.target_risk
        : options.targetRisk)
      : options.targetRisk
  );
  const resumeExecuteAdvisory = resumedGovernanceSession && resumePayload && typeof resumePayload.execute_advisory === 'boolean'
    ? resumePayload.execute_advisory
    : false;
  const executeAdvisory = resumedGovernanceSession && !isExplicitOption('executeAdvisory')
    ? resumeExecuteAdvisory
    : Boolean(options.executeAdvisory);
  const resumeAdvisoryPolicy = resumePayload && resumePayload.advisory_policy && typeof resumePayload.advisory_policy === 'object'
    ? resumePayload.advisory_policy
    : null;
  const resumeAdvisoryRecoverMaxRounds = resumeAdvisoryPolicy && resumeAdvisoryPolicy.recover_max_rounds !== undefined &&
    resumeAdvisoryPolicy.recover_max_rounds !== null
    ? normalizeGovernanceAdvisoryRecoverMaxRounds(resumeAdvisoryPolicy.recover_max_rounds, 3)
    : 3;
  const resumeAdvisoryControllerMaxCycles = resumeAdvisoryPolicy && resumeAdvisoryPolicy.controller_max_cycles !== undefined &&
    resumeAdvisoryPolicy.controller_max_cycles !== null
    ? normalizeGovernanceAdvisoryControllerMaxCycles(resumeAdvisoryPolicy.controller_max_cycles, 20)
    : 20;
  const governanceSessionEnabled = options.governanceSession !== false;
  const governanceSessionKeep = normalizeGovernanceSessionKeep(options.governanceSessionKeep);
  const governanceSessionOlderThanDays = normalizeGovernanceSessionOlderThanDays(options.governanceSessionOlderThanDays);
  if (governanceSessionOlderThanDays !== null && governanceSessionKeep === null) {
    throw new Error('--governance-session-older-than-days requires --governance-session-keep.');
  }
  const requestedGovernanceSessionId = options.governanceSessionId !== undefined && options.governanceSessionId !== null
    ? sanitizeBatchSessionId(options.governanceSessionId)
    : null;
  if (options.governanceSessionId && !requestedGovernanceSessionId) {
    throw new Error('--governance-session-id is invalid after sanitization.');
  }
  let governanceSessionId = requestedGovernanceSessionId
    || (resumedGovernanceSession && resumedGovernanceSession.id ? sanitizeBatchSessionId(resumedGovernanceSession.id) : null)
    || (governanceSessionEnabled ? createGovernanceCloseLoopSessionId() : null);
  if (governanceSessionEnabled && !governanceSessionId) {
    throw new Error('Failed to resolve governance close-loop session id.');
  }
  if (
    !executeAdvisory &&
    options.advisoryRecoverMaxRounds !== undefined &&
    options.advisoryRecoverMaxRounds !== null
  ) {
    throw new Error('--advisory-recover-max-rounds requires --execute-advisory.');
  }
  if (
    !executeAdvisory &&
    options.advisoryControllerMaxCycles !== undefined &&
    options.advisoryControllerMaxCycles !== null
  ) {
    throw new Error('--advisory-controller-max-cycles requires --execute-advisory.');
  }
  const advisoryRecoverMaxRounds = normalizeGovernanceAdvisoryRecoverMaxRounds(
    resumedGovernanceSession && !isExplicitOption('advisoryRecoverMaxRounds')
      ? (resumeAdvisoryPolicy && resumeAdvisoryPolicy.recover_max_rounds !== undefined &&
        resumeAdvisoryPolicy.recover_max_rounds !== null
        ? resumeAdvisoryPolicy.recover_max_rounds
        : options.advisoryRecoverMaxRounds)
      : options.advisoryRecoverMaxRounds,
    3
  );
  const advisoryControllerMaxCycles = normalizeGovernanceAdvisoryControllerMaxCycles(
    resumedGovernanceSession && !isExplicitOption('advisoryControllerMaxCycles')
      ? (resumeAdvisoryPolicy && resumeAdvisoryPolicy.controller_max_cycles !== undefined &&
        resumeAdvisoryPolicy.controller_max_cycles !== null
        ? resumeAdvisoryPolicy.controller_max_cycles
        : options.advisoryControllerMaxCycles)
      : options.advisoryControllerMaxCycles,
    20
  );
  const planOnly = Boolean(options.planOnly);
  const dryRun = Boolean(options.dryRun);
  const days = normalizeStatsWindowDays(options.days);
  const statusFilter = normalizeStatusFilter(options.status);
  const assessmentOptions = {
    days,
    status: statusFilter.length > 0 ? statusFilter.join(',') : undefined
  };
  const apply = !planOnly;
  const rounds = Array.isArray(resumePayload && resumePayload.rounds)
    ? [...resumePayload.rounds]
    : [];
  if (
    resumedGovernanceSession &&
    !allowResumeDrift &&
    isExplicitOption('maxRounds') &&
    maxRounds < rounds.length
  ) {
    throw new Error(
      `--max-rounds (${maxRounds}) is lower than resumed performed rounds (${rounds.length}). ` +
      'Use --governance-resume-allow-drift to override.'
    );
  }
  if (resumedGovernanceSession && !allowResumeDrift) {
    const driftIssues = [];
    if (isExplicitOption('targetRisk') && resumeTargetRisk && targetRisk !== resumeTargetRisk) {
      driftIssues.push(`target-risk resumed=${resumeTargetRisk} requested=${targetRisk}`);
    }
    if (isExplicitOption('executeAdvisory') && executeAdvisory !== resumeExecuteAdvisory) {
      driftIssues.push(
        `execute-advisory resumed=${resumeExecuteAdvisory ? 'enabled' : 'disabled'} ` +
        `requested=${executeAdvisory ? 'enabled' : 'disabled'}`
      );
    }
    if (
      executeAdvisory &&
      resumeExecuteAdvisory &&
      isExplicitOption('advisoryRecoverMaxRounds') &&
      advisoryRecoverMaxRounds !== resumeAdvisoryRecoverMaxRounds
    ) {
      driftIssues.push(
        `advisory-recover-max-rounds resumed=${resumeAdvisoryRecoverMaxRounds} requested=${advisoryRecoverMaxRounds}`
      );
    }
    if (
      executeAdvisory &&
      resumeExecuteAdvisory &&
      isExplicitOption('advisoryControllerMaxCycles') &&
      advisoryControllerMaxCycles !== resumeAdvisoryControllerMaxCycles
    ) {
      driftIssues.push(
        `advisory-controller-max-cycles resumed=${resumeAdvisoryControllerMaxCycles} ` +
        `requested=${advisoryControllerMaxCycles}`
      );
    }
    if (driftIssues.length > 0) {
      throw new Error(
        `Governance resume option drift detected: ${driftIssues.join('; ')}. ` +
        'Use --governance-resume-allow-drift to override.'
      );
    }
  }
  let stopReason = 'max-rounds-exhausted';
  let stopDetail = resumePayload && resumePayload.stop_detail && typeof resumePayload.stop_detail === 'object'
    ? resumePayload.stop_detail
    : null;
  let converged = Boolean(resumePayload && resumePayload.converged);
  let initialAssessment = resumePayload && resumePayload.initial_assessment
    ? resumePayload.initial_assessment
    : null;
  let finalAssessment = resumePayload && resumePayload.final_assessment
    ? resumePayload.final_assessment
    : null;
  const advisorySummary = {
    planned_actions: Number(resumePayload && resumePayload.advisory_summary && resumePayload.advisory_summary.planned_actions) || 0,
    executed_actions: Number(resumePayload && resumePayload.advisory_summary && resumePayload.advisory_summary.executed_actions) || 0,
    failed_actions: Number(resumePayload && resumePayload.advisory_summary && resumePayload.advisory_summary.failed_actions) || 0,
    skipped_actions: Number(resumePayload && resumePayload.advisory_summary && resumePayload.advisory_summary.skipped_actions) || 0
  };
  let governanceSessionPrune = null;

  const buildGovernanceCloseLoopResult = () => ({
    mode: 'auto-governance-close-loop',
    generated_at: new Date().toISOString(),
    apply,
    plan_only: planOnly,
    dry_run: dryRun,
    target_risk: targetRisk,
    max_rounds: maxRounds,
    performed_rounds: rounds.length,
    converged,
    execute_advisory: executeAdvisory,
    advisory_policy: {
      recover_max_rounds: advisoryRecoverMaxRounds,
      controller_max_cycles: advisoryControllerMaxCycles
    },
    advisory_summary: advisorySummary,
    stop_reason: stopReason,
    stop_detail: stopDetail,
    initial_assessment: initialAssessment,
    final_assessment: finalAssessment,
    recommendations: buildGovernanceCloseLoopRecommendations(finalAssessment, stopReason, stopDetail),
    resumed_from_governance_session: resumedGovernanceSession
      ? {
        id: resumedGovernanceSession.id,
        file: resumedGovernanceSession.file,
        status: resumePayload && resumePayload.status ? resumePayload.status : null
      }
      : null,
    governance_session: governanceSessionEnabled
      ? {
        id: governanceSessionId,
        file: path.join(getGovernanceCloseLoopSessionDir(projectPath), `${governanceSessionId}.json`)
      }
      : null,
    governance_session_prune: governanceSessionPrune,
    rounds
  });

  const persistGovernanceState = async status => {
    if (!governanceSessionEnabled) {
      return;
    }
    const persisted = await persistGovernanceCloseLoopSession(projectPath, governanceSessionId, buildGovernanceCloseLoopResult(), status);
    if (persisted && persisted.id) {
      governanceSessionId = persisted.id;
    }
  };

  if (converged) {
    stopReason = 'already-converged';
  } else if (rounds.length >= maxRounds) {
    stopReason = 'max-rounds-already-reached';
  } else {
    stopDetail = null;
    await persistGovernanceState('running');
  }

  for (let round = rounds.length + 1; round <= maxRounds && stopReason === 'max-rounds-exhausted'; round += 1) {
    const roundResult = await runAutoGovernanceMaintenance(projectPath, {
      ...options,
      apply,
      dryRun
    });
    if (!initialAssessment) {
      initialAssessment = roundResult.assessment;
    }
    const roundPlan = Array.isArray(roundResult.plan) ? roundResult.plan : [];
    const advisoryPlannedActions = roundPlan.filter(item => item && item.enabled && !item.apply_supported).length;
    const advisoryActions = [];

    if (executeAdvisory && apply) {
      const shouldRecover = roundPlan.some(item => item && item.id === 'recover-latest' && item.enabled);
      if (shouldRecover) {
        advisoryActions.push(await executeGovernanceAdvisoryRecover(projectPath, {
          recoverMaxRounds: advisoryRecoverMaxRounds,
          dryRun,
          recoveryMemoryScope: options.recoveryMemoryScope
        }));
      }

      const shouldResumeController = roundPlan.some(item => item && item.id === 'controller-resume-latest' && item.enabled);
      if (shouldResumeController) {
        advisoryActions.push(await executeGovernanceAdvisoryControllerResume(projectPath, {
          maxCycles: advisoryControllerMaxCycles,
          dryRun
        }));
      }
    }

    const advisoryExecutedActions = advisoryActions.filter(item => item && item.status === 'applied').length;
    const advisoryFailedActions = advisoryActions.filter(item => item && item.status === 'failed').length;
    const advisorySkippedActions = advisoryActions.filter(item => item && item.status === 'skipped').length;
    advisorySummary.planned_actions += advisoryPlannedActions;
    advisorySummary.executed_actions += advisoryExecutedActions;
    advisorySummary.failed_actions += advisoryFailedActions;
    advisorySummary.skipped_actions += advisorySkippedActions;

    let effectiveAfterAssessment = roundResult.after_assessment || roundResult.assessment;
    if (executeAdvisory && advisoryActions.length > 0) {
      effectiveAfterAssessment = await buildAutoGovernanceStats(projectPath, assessmentOptions);
    }
    finalAssessment = effectiveAfterAssessment;
    rounds.push({
      round,
      risk_before: roundResult.assessment && roundResult.assessment.health
        ? roundResult.assessment.health.risk_level
        : null,
      risk_after: effectiveAfterAssessment && effectiveAfterAssessment.health
        ? effectiveAfterAssessment.health.risk_level
        : null,
      release_gate_before: extractGovernanceReleaseGateSnapshot(roundResult.assessment),
      release_gate_after: extractGovernanceReleaseGateSnapshot(effectiveAfterAssessment),
      planned_actions: roundResult.summary.planned_actions,
      applicable_actions: roundResult.summary.applicable_actions,
      applied_actions: roundResult.summary.applied_actions,
      failed_actions: roundResult.summary.failed_actions,
      advisory_planned_actions: advisoryPlannedActions,
      advisory_executed_actions: advisoryExecutedActions,
      advisory_failed_actions: advisoryFailedActions,
      advisory_skipped_actions: advisorySkippedActions,
      advisory_actions: advisoryActions
    });

    if (roundResult.summary.failed_actions > 0) {
      stopReason = 'maintenance-action-failed';
      break;
    }
    if (executeAdvisory && advisoryFailedActions > 0) {
      stopReason = 'advisory-action-failed';
      break;
    }
    if (planOnly || dryRun) {
      stopReason = 'non-mutating-mode';
      break;
    }
    const releaseGateBlockState = evaluateGovernanceReleaseGateBlockState(effectiveAfterAssessment);
    if (releaseGateBlockState.blocked) {
      const weeklyOpsStopDetail = extractGovernanceWeeklyOpsStopDetail(
        effectiveAfterAssessment &&
        effectiveAfterAssessment.health &&
        effectiveAfterAssessment.health.release_gate
      );
      stopReason = 'release-gate-blocked';
      stopDetail = {
        type: 'release-gate-block',
        reasons: releaseGateBlockState.reasons,
        release_gate: releaseGateBlockState.snapshot,
        weekly_ops: weeklyOpsStopDetail
      };
      break;
    }
    if (compareRiskLevel(effectiveAfterAssessment.health.risk_level, targetRisk) <= 0) {
      converged = true;
      stopReason = 'target-risk-reached';
      break;
    }
    if (
      roundResult.summary.applicable_actions === 0 &&
      !(executeAdvisory && (advisoryExecutedActions > 0 || advisoryFailedActions > 0))
    ) {
      stopReason = 'no-applicable-actions';
      break;
    }

    await persistGovernanceState('running');
  }

  if (!initialAssessment || !finalAssessment) {
    throw new Error('Governance close-loop did not produce any assessment.');
  }

  const result = buildGovernanceCloseLoopResult();
  if (governanceSessionEnabled) {
    const persistedSession = await persistGovernanceCloseLoopSession(
      projectPath,
      governanceSessionId,
      result,
      resolveGovernanceCloseLoopRunStatus(stopReason, converged)
    );
    if (persistedSession && persistedSession.id) {
      governanceSessionId = persistedSession.id;
    }
  }
  if (governanceSessionKeep !== null) {
    governanceSessionPrune = await pruneGovernanceCloseLoopSessions(projectPath, {
      keep: governanceSessionKeep,
      olderThanDays: governanceSessionOlderThanDays,
      dryRun,
      currentFile: governanceSessionEnabled
        ? path.join(getGovernanceCloseLoopSessionDir(projectPath), `${governanceSessionId}.json`)
        : null
    });
    result.governance_session_prune = governanceSessionPrune;
  }
  return result;
}

module.exports = {
  runAutoGovernanceCloseLoop
};
