async function buildAutoGovernanceStats(projectPath, options = {}, dependencies = {}) {
  const {
    normalizeStatsWindowDays,
    normalizeStatusFilter,
    statsCloseLoopSessions,
    statsCloseLoopBatchSummarySessions,
    statsCloseLoopControllerSessions,
    showCloseLoopRecoveryMemory,
    loadGovernanceReleaseGateSignals,
    loadGovernanceHandoffQualitySignals,
    calculatePercent,
    deriveGovernanceRiskLevel,
    buildGovernanceConcerns,
    buildGovernanceRecommendations,
    buildTopCountEntries,
    now = () => new Date()
  } = dependencies;

  const days = normalizeStatsWindowDays(options.days);
  const statusFilter = normalizeStatusFilter(options.status);
  const normalizedOptions = {
    days,
    status: statusFilter.length > 0 ? statusFilter.join(',') : undefined
  };

  const [sessionStats, batchStats, controllerStats, recoveryMemory, releaseGateSignals, handoffQualitySignals] = await Promise.all([
    statsCloseLoopSessions(projectPath, normalizedOptions),
    statsCloseLoopBatchSummarySessions(projectPath, normalizedOptions),
    statsCloseLoopControllerSessions(projectPath, normalizedOptions),
    showCloseLoopRecoveryMemory(projectPath, {}),
    loadGovernanceReleaseGateSignals(projectPath),
    loadGovernanceHandoffQualitySignals(projectPath)
  ]);

  const totalSessions =
    (Number(sessionStats.total_sessions) || 0) +
    (Number(batchStats.total_sessions) || 0) +
    (Number(controllerStats.total_sessions) || 0);
  const completedSessions =
    (Number(sessionStats.completed_sessions) || 0) +
    (Number(batchStats.completed_sessions) || 0) +
    (Number(controllerStats.completed_sessions) || 0);
  const failedSessions =
    (Number(sessionStats.failed_sessions) || 0) +
    (Number(batchStats.failed_sessions) || 0) +
    (Number(controllerStats.failed_sessions) || 0);
  const pendingGoalsSum = Number(controllerStats.pending_goals_sum) || 0;
  const recoverySignatureCount = Number(recoveryMemory && recoveryMemory.stats && recoveryMemory.stats.signature_count) || 0;
  const summary = {
    total_sessions: totalSessions,
    completed_sessions: completedSessions,
    failed_sessions: failedSessions,
    failure_rate_percent: calculatePercent(failedSessions, totalSessions),
    completion_rate_percent: calculatePercent(completedSessions, totalSessions),
    pending_goals_sum: pendingGoalsSum,
    recovery_signature_count: recoverySignatureCount,
    release_gate: releaseGateSignals,
    handoff_quality: handoffQualitySignals
  };
  const riskLevel = deriveGovernanceRiskLevel(summary);
  const concerns = buildGovernanceConcerns(summary);
  const recommendations = buildGovernanceRecommendations({
    ...summary,
    risk_level: riskLevel
  });

  return {
    mode: 'auto-governance-stats',
    generated_at: new Date().toISOString(),
    criteria: {
      days,
      status_filter: statusFilter,
      since: days === null
        ? null
        : new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString()
    },
    totals: {
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      failed_sessions: failedSessions,
      completion_rate_percent: summary.completion_rate_percent,
      failure_rate_percent: summary.failure_rate_percent
    },
    throughput: {
      sub_spec_count_sum: Number(sessionStats.sub_spec_count_sum) || 0,
      batch_total_goals_sum: Number(batchStats.total_goals_sum) || 0,
      batch_processed_goals_sum: Number(batchStats.processed_goals_sum) || 0,
      controller_processed_goals_sum: Number(controllerStats.processed_goals_sum) || 0,
      controller_pending_goals_sum: pendingGoalsSum
    },
    top_master_specs: buildTopCountEntries(sessionStats.master_spec_counts, 10),
    health: {
      risk_level: riskLevel,
      concerns,
      recommendations,
      release_gate: releaseGateSignals,
      handoff_quality: handoffQualitySignals
    },
    recovery_memory: {
      file: recoveryMemory.file,
      scope: recoveryMemory.scope,
      signature_count: recoverySignatureCount,
      action_count: Number(recoveryMemory && recoveryMemory.stats && recoveryMemory.stats.action_count) || 0
    },
    archives: {
      session: sessionStats,
      batch_session: batchStats,
      controller_session: controllerStats
    }
  };
}

module.exports = {
  buildAutoGovernanceStats
};
