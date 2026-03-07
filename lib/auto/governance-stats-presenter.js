function presentGovernanceSessionStats(projectPath, filteredSessions, options = {}, dependencies = {}) {
  const sessions = Array.isArray(filteredSessions) ? filteredSessions : [];
  const normalizeStatusToken = dependencies.normalizeStatusToken || ((value) => String(value || '').trim().toLowerCase());
  const isCompletedStatus = dependencies.isCompletedStatus || ((status) => normalizeStatusToken(status) === 'completed');
  const isFailedStatus = dependencies.isFailedStatus || ((status) => ['failed', 'partial-failed', 'error', 'invalid'].includes(normalizeStatusToken(status)));
  const calculatePercent = dependencies.calculatePercent || ((a, b) => (Number(b) > 0 ? Number(((Number(a) / Number(b)) * 100).toFixed(2)) : 0));
  const toGovernanceReleaseGateNumber = dependencies.toGovernanceReleaseGateNumber || ((value) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });
  const getGovernanceCloseLoopSessionDir = dependencies.getGovernanceCloseLoopSessionDir || ((value) => value);
  const buildStatusCounts = dependencies.buildStatusCounts || (() => ({}));
  const parseAutoHandoffGateBoolean = dependencies.parseAutoHandoffGateBoolean || ((value, fallback = null) => {
    if (value === true) {
      return true;
    }
    if (value === false) {
      return false;
    }
    return fallback;
  });

  const days = options.days ?? null;
  const statusFilter = Array.isArray(options.status_filter) ? options.status_filter : [];
  const resumeOnly = Boolean(options.resume_only);
  const cutoffMs = options.cutoff_ms ?? null;

  let completedSessions = 0;
  let failedSessions = 0;
  let stoppedSessions = 0;
  let convergedSessions = 0;
  let advisoryEnabledSessions = 0;
  let advisoryFailedActionsSum = 0;
  let performedRoundsSum = 0;
  let sessionsWithRounds = 0;
  let resumedSessions = 0;
  let releaseGateObservedSessions = 0;
  let releaseGateFailedSessions = 0;
  let releaseGateDriftAlertSessions = 0;
  let releaseGateBlockedSessions = 0;
  let releaseGatePassRateSum = 0;
  let releaseGatePassRateCount = 0;
  let releaseGateSceneBatchPassRateSum = 0;
  let releaseGateSceneBatchPassRateCount = 0;
  let releaseGateDriftAlertRateSum = 0;
  let releaseGateDriftAlertRateCount = 0;
  let roundReleaseGateObservedSum = 0;
  let roundReleaseGateChangedSum = 0;
  let weeklyOpsStopSessions = 0;
  let weeklyOpsBlockedStopSessions = 0;
  let weeklyOpsHighPressureStopSessions = 0;
  let weeklyOpsConfigWarningPositiveStopSessions = 0;
  let weeklyOpsAuthTierPressureStopSessions = 0;
  let weeklyOpsDialoguePressureStopSessions = 0;
  let weeklyOpsRuntimeBlockRateHighStopSessions = 0;
  let weeklyOpsRuntimeUiModeViolationHighStopSessions = 0;
  let weeklyOpsBlockedRunsSum = 0;
  let weeklyOpsBlockedRunsCount = 0;
  let weeklyOpsBlockRateSum = 0;
  let weeklyOpsBlockRateCount = 0;
  let weeklyOpsConfigWarningsTotalSum = 0;
  let weeklyOpsConfigWarningsTotalCount = 0;
  let weeklyOpsAuthTierBlockRateSum = 0;
  let weeklyOpsAuthTierBlockRateCount = 0;
  let weeklyOpsDialogueBlockRateSum = 0;
  let weeklyOpsDialogueBlockRateCount = 0;
  let weeklyOpsRuntimeBlockRateSum = 0;
  let weeklyOpsRuntimeBlockRateCount = 0;
  let weeklyOpsRuntimeUiModeViolationTotalSum = 0;
  let weeklyOpsRuntimeUiModeViolationTotalCount = 0;
  let weeklyOpsRuntimeUiModeViolationRateSum = 0;
  let weeklyOpsRuntimeUiModeViolationRateCount = 0;
  const stopReasonCounts = {};
  const finalRiskCounts = {};
  const resumedFromCounts = {};

  for (const session of sessions) {
    const status = normalizeStatusToken(session && session.status) || 'unknown';
    if (isCompletedStatus(status)) {
      completedSessions += 1;
    } else if (isFailedStatus(status)) {
      failedSessions += 1;
    } else if (status === 'stopped') {
      stoppedSessions += 1;
    }

    if (session && session.converged === true) {
      convergedSessions += 1;
    }
    if (session && session.execute_advisory === true) {
      advisoryEnabledSessions += 1;
    }
    advisoryFailedActionsSum += Number(session && session.advisory_failed_actions) || 0;

    const performedRounds = Number(session && session.performed_rounds);
    if (Number.isFinite(performedRounds)) {
      performedRoundsSum += performedRounds;
      sessionsWithRounds += 1;
    }
    if (session && session.resumed_from_governance_session_id) {
      resumedSessions += 1;
      const parentId = String(session.resumed_from_governance_session_id).trim() || 'unknown';
      resumedFromCounts[parentId] = (resumedFromCounts[parentId] || 0) + 1;
    }
    if (session && session.release_gate_available === true) {
      releaseGateObservedSessions += 1;
      const latestGatePassed = parseAutoHandoffGateBoolean(session.release_gate_latest_gate_passed, null);
      if (latestGatePassed === false) {
        releaseGateFailedSessions += 1;
      }
      const releaseGatePassRate = Number(session.release_gate_pass_rate_percent);
      if (Number.isFinite(releaseGatePassRate)) {
        releaseGatePassRateSum += releaseGatePassRate;
        releaseGatePassRateCount += 1;
      }
      const sceneBatchPassRate = Number(session.release_gate_scene_package_batch_pass_rate_percent);
      if (Number.isFinite(sceneBatchPassRate)) {
        releaseGateSceneBatchPassRateSum += sceneBatchPassRate;
        releaseGateSceneBatchPassRateCount += 1;
      }
      const driftAlertRate = Number(session.release_gate_drift_alert_rate_percent);
      if (Number.isFinite(driftAlertRate)) {
        releaseGateDriftAlertRateSum += driftAlertRate;
        releaseGateDriftAlertRateCount += 1;
        if (driftAlertRate > 0) {
          releaseGateDriftAlertSessions += 1;
        }
      }
      const driftBlockedRuns = Number(session.release_gate_drift_blocked_runs);
      if (Number.isFinite(driftBlockedRuns) && driftBlockedRuns > 0) {
        releaseGateBlockedSessions += 1;
      }
      roundReleaseGateObservedSum += Number(session.round_release_gate_observed) || 0;
      roundReleaseGateChangedSum += Number(session.round_release_gate_changed) || 0;
    }
    if (session && session.stop_detail_weekly_ops_available === true) {
      weeklyOpsStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_blocked === true) {
      weeklyOpsBlockedStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_high_pressure === true) {
      weeklyOpsHighPressureStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_config_warning_positive === true) {
      weeklyOpsConfigWarningPositiveStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_auth_tier_block_rate_high === true) {
      weeklyOpsAuthTierPressureStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_dialogue_authorization_block_rate_high === true) {
      weeklyOpsDialoguePressureStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_runtime_block_rate_high === true) {
      weeklyOpsRuntimeBlockRateHighStopSessions += 1;
    }
    if (session && session.stop_detail_weekly_ops_runtime_ui_mode_violation_high === true) {
      weeklyOpsRuntimeUiModeViolationHighStopSessions += 1;
    }
    const weeklyOpsBlockedRuns = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_blocked_runs);
    if (Number.isFinite(weeklyOpsBlockedRuns)) {
      weeklyOpsBlockedRunsSum += weeklyOpsBlockedRuns;
      weeklyOpsBlockedRunsCount += 1;
    }
    const weeklyOpsBlockRate = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_block_rate_percent);
    if (Number.isFinite(weeklyOpsBlockRate)) {
      weeklyOpsBlockRateSum += weeklyOpsBlockRate;
      weeklyOpsBlockRateCount += 1;
    }
    const weeklyOpsConfigWarningsTotal = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_config_warnings_total);
    if (Number.isFinite(weeklyOpsConfigWarningsTotal)) {
      weeklyOpsConfigWarningsTotalSum += weeklyOpsConfigWarningsTotal;
      weeklyOpsConfigWarningsTotalCount += 1;
    }
    const weeklyOpsAuthTierBlockRate = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_auth_tier_block_rate_percent);
    if (Number.isFinite(weeklyOpsAuthTierBlockRate)) {
      weeklyOpsAuthTierBlockRateSum += weeklyOpsAuthTierBlockRate;
      weeklyOpsAuthTierBlockRateCount += 1;
    }
    const weeklyOpsDialogueBlockRate = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_dialogue_authorization_block_rate_percent);
    if (Number.isFinite(weeklyOpsDialogueBlockRate)) {
      weeklyOpsDialogueBlockRateSum += weeklyOpsDialogueBlockRate;
      weeklyOpsDialogueBlockRateCount += 1;
    }
    const weeklyOpsRuntimeBlockRate = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_runtime_block_rate_percent);
    if (Number.isFinite(weeklyOpsRuntimeBlockRate)) {
      weeklyOpsRuntimeBlockRateSum += weeklyOpsRuntimeBlockRate;
      weeklyOpsRuntimeBlockRateCount += 1;
    }
    const weeklyOpsRuntimeUiModeViolationTotal = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_runtime_ui_mode_violation_total);
    if (Number.isFinite(weeklyOpsRuntimeUiModeViolationTotal)) {
      weeklyOpsRuntimeUiModeViolationTotalSum += weeklyOpsRuntimeUiModeViolationTotal;
      weeklyOpsRuntimeUiModeViolationTotalCount += 1;
    }
    const weeklyOpsRuntimeUiModeViolationRate = toGovernanceReleaseGateNumber(session && session.stop_detail_weekly_ops_runtime_ui_mode_violation_rate_percent);
    if (Number.isFinite(weeklyOpsRuntimeUiModeViolationRate)) {
      weeklyOpsRuntimeUiModeViolationRateSum += weeklyOpsRuntimeUiModeViolationRate;
      weeklyOpsRuntimeUiModeViolationRateCount += 1;
    }

    const stopReason = String(session && session.stop_reason ? session.stop_reason : '').trim().toLowerCase() || 'unknown';
    stopReasonCounts[stopReason] = (stopReasonCounts[stopReason] || 0) + 1;

    const finalRisk = String(session && session.final_risk ? session.final_risk : '').trim().toLowerCase() || 'unknown';
    finalRiskCounts[finalRisk] = (finalRiskCounts[finalRisk] || 0) + 1;
  }

  const totalSessions = sessions.length;
  const completionRate = totalSessions > 0 ? Number(((completedSessions / totalSessions) * 100).toFixed(2)) : 0;
  const failureRate = totalSessions > 0 ? Number(((failedSessions / totalSessions) * 100).toFixed(2)) : 0;
  const averagePerformedRounds = sessionsWithRounds > 0 ? Number((performedRoundsSum / sessionsWithRounds).toFixed(2)) : 0;
  const resumedRate = totalSessions > 0 ? Number(((resumedSessions / totalSessions) * 100).toFixed(2)) : 0;
  const latestSession = totalSessions > 0 ? sessions[0] : null;
  const oldestSession = totalSessions > 0 ? sessions[sessions.length - 1] : null;

  return {
    mode: 'auto-governance-session-stats',
    session_dir: getGovernanceCloseLoopSessionDir(projectPath),
    criteria: {
      days,
      status_filter: statusFilter,
      resume_only: resumeOnly,
      since: cutoffMs === null ? null : new Date(cutoffMs).toISOString()
    },
    total_sessions: totalSessions,
    resumed_sessions: resumedSessions,
    fresh_sessions: totalSessions - resumedSessions,
    resumed_rate_percent: resumedRate,
    completed_sessions: completedSessions,
    failed_sessions: failedSessions,
    stopped_sessions: stoppedSessions,
    converged_sessions: convergedSessions,
    advisory_enabled_sessions: advisoryEnabledSessions,
    advisory_failed_actions_sum: advisoryFailedActionsSum,
    completion_rate_percent: completionRate,
    failure_rate_percent: failureRate,
    average_performed_rounds: averagePerformedRounds,
    release_gate: {
      observed_sessions: releaseGateObservedSessions,
      failed_sessions: releaseGateFailedSessions,
      failed_rate_percent: calculatePercent(releaseGateFailedSessions, releaseGateObservedSessions),
      drift_alert_sessions: releaseGateDriftAlertSessions,
      drift_alert_session_rate_percent: calculatePercent(releaseGateDriftAlertSessions, releaseGateObservedSessions),
      blocked_sessions: releaseGateBlockedSessions,
      average_pass_rate_percent: releaseGatePassRateCount > 0 ? Number((releaseGatePassRateSum / releaseGatePassRateCount).toFixed(2)) : null,
      average_scene_package_batch_pass_rate_percent: releaseGateSceneBatchPassRateCount > 0 ? Number((releaseGateSceneBatchPassRateSum / releaseGateSceneBatchPassRateCount).toFixed(2)) : null,
      average_drift_alert_rate_percent: releaseGateDriftAlertRateCount > 0 ? Number((releaseGateDriftAlertRateSum / releaseGateDriftAlertRateCount).toFixed(2)) : null,
      round_telemetry_observed: roundReleaseGateObservedSum,
      round_telemetry_changed: roundReleaseGateChangedSum,
      round_telemetry_change_rate_percent: calculatePercent(roundReleaseGateChangedSum, roundReleaseGateObservedSum),
      weekly_ops_stop: {
        sessions: weeklyOpsStopSessions,
        session_rate_percent: calculatePercent(weeklyOpsStopSessions, totalSessions),
        blocked_sessions: weeklyOpsBlockedStopSessions,
        blocked_session_rate_percent: calculatePercent(weeklyOpsBlockedStopSessions, weeklyOpsStopSessions),
        high_pressure_sessions: weeklyOpsHighPressureStopSessions,
        high_pressure_session_rate_percent: calculatePercent(weeklyOpsHighPressureStopSessions, weeklyOpsStopSessions),
        config_warning_positive_sessions: weeklyOpsConfigWarningPositiveStopSessions,
        config_warning_positive_rate_percent: calculatePercent(weeklyOpsConfigWarningPositiveStopSessions, weeklyOpsStopSessions),
        auth_tier_pressure_sessions: weeklyOpsAuthTierPressureStopSessions,
        auth_tier_pressure_rate_percent: calculatePercent(weeklyOpsAuthTierPressureStopSessions, weeklyOpsStopSessions),
        dialogue_authorization_pressure_sessions: weeklyOpsDialoguePressureStopSessions,
        dialogue_authorization_pressure_rate_percent: calculatePercent(weeklyOpsDialoguePressureStopSessions, weeklyOpsStopSessions),
        runtime_block_rate_high_sessions: weeklyOpsRuntimeBlockRateHighStopSessions,
        runtime_block_rate_high_rate_percent: calculatePercent(weeklyOpsRuntimeBlockRateHighStopSessions, weeklyOpsStopSessions),
        runtime_ui_mode_violation_high_sessions: weeklyOpsRuntimeUiModeViolationHighStopSessions,
        runtime_ui_mode_violation_high_rate_percent: calculatePercent(weeklyOpsRuntimeUiModeViolationHighStopSessions, weeklyOpsStopSessions),
        blocked_runs_sum: weeklyOpsBlockedRunsSum,
        average_blocked_runs: weeklyOpsBlockedRunsCount > 0 ? Number((weeklyOpsBlockedRunsSum / weeklyOpsBlockedRunsCount).toFixed(2)) : null,
        average_block_rate_percent: weeklyOpsBlockRateCount > 0 ? Number((weeklyOpsBlockRateSum / weeklyOpsBlockRateCount).toFixed(2)) : null,
        config_warnings_total_sum: weeklyOpsConfigWarningsTotalSum,
        average_config_warnings_total: weeklyOpsConfigWarningsTotalCount > 0 ? Number((weeklyOpsConfigWarningsTotalSum / weeklyOpsConfigWarningsTotalCount).toFixed(2)) : null,
        average_auth_tier_block_rate_percent: weeklyOpsAuthTierBlockRateCount > 0 ? Number((weeklyOpsAuthTierBlockRateSum / weeklyOpsAuthTierBlockRateCount).toFixed(2)) : null,
        average_dialogue_authorization_block_rate_percent: weeklyOpsDialogueBlockRateCount > 0 ? Number((weeklyOpsDialogueBlockRateSum / weeklyOpsDialogueBlockRateCount).toFixed(2)) : null,
        average_runtime_block_rate_percent: weeklyOpsRuntimeBlockRateCount > 0 ? Number((weeklyOpsRuntimeBlockRateSum / weeklyOpsRuntimeBlockRateCount).toFixed(2)) : null,
        runtime_ui_mode_violation_total_sum: weeklyOpsRuntimeUiModeViolationTotalSum,
        average_runtime_ui_mode_violation_total: weeklyOpsRuntimeUiModeViolationTotalCount > 0 ? Number((weeklyOpsRuntimeUiModeViolationTotalSum / weeklyOpsRuntimeUiModeViolationTotalCount).toFixed(2)) : null,
        average_runtime_ui_mode_violation_rate_percent: weeklyOpsRuntimeUiModeViolationRateCount > 0 ? Number((weeklyOpsRuntimeUiModeViolationRateSum / weeklyOpsRuntimeUiModeViolationRateCount).toFixed(2)) : null
      }
    },
    status_counts: buildStatusCounts(sessions),
    stop_reason_counts: stopReasonCounts,
    final_risk_counts: finalRiskCounts,
    resumed_from_counts: resumedFromCounts,
    latest_updated_at: latestSession ? latestSession.updated_at : null,
    oldest_updated_at: oldestSession ? oldestSession.updated_at : null,
    latest_sessions: sessions.slice(0, 10).map((item) => ({
      id: item.id,
      status: item.status,
      target_risk: item.target_risk,
      final_risk: item.final_risk,
      performed_rounds: item.performed_rounds,
      max_rounds: item.max_rounds,
      converged: item.converged,
      execute_advisory: item.execute_advisory,
      advisory_failed_actions: item.advisory_failed_actions,
      release_gate_available: item.release_gate_available,
      release_gate_latest_gate_passed: item.release_gate_latest_gate_passed,
      release_gate_pass_rate_percent: item.release_gate_pass_rate_percent,
      release_gate_drift_alert_rate_percent: item.release_gate_drift_alert_rate_percent,
      round_release_gate_observed: item.round_release_gate_observed,
      round_release_gate_changed: item.round_release_gate_changed,
      stop_detail_weekly_ops_available: item.stop_detail_weekly_ops_available,
      stop_detail_weekly_ops_blocked: item.stop_detail_weekly_ops_blocked,
      stop_detail_weekly_ops_high_pressure: item.stop_detail_weekly_ops_high_pressure,
      stop_detail_weekly_ops_config_warning_positive: item.stop_detail_weekly_ops_config_warning_positive,
      stop_detail_weekly_ops_auth_tier_block_rate_high: item.stop_detail_weekly_ops_auth_tier_block_rate_high,
      stop_detail_weekly_ops_dialogue_authorization_block_rate_high:
        item.stop_detail_weekly_ops_dialogue_authorization_block_rate_high,
      stop_detail_weekly_ops_runtime_block_rate_high: item.stop_detail_weekly_ops_runtime_block_rate_high,
      stop_detail_weekly_ops_runtime_ui_mode_violation_high:
        item.stop_detail_weekly_ops_runtime_ui_mode_violation_high,
      stop_detail_weekly_ops_blocked_runs: item.stop_detail_weekly_ops_blocked_runs,
      stop_detail_weekly_ops_block_rate_percent: item.stop_detail_weekly_ops_block_rate_percent,
      stop_detail_weekly_ops_config_warnings_total: item.stop_detail_weekly_ops_config_warnings_total,
      stop_detail_weekly_ops_auth_tier_block_rate_percent: item.stop_detail_weekly_ops_auth_tier_block_rate_percent,
      stop_detail_weekly_ops_dialogue_authorization_block_rate_percent:
        item.stop_detail_weekly_ops_dialogue_authorization_block_rate_percent,
      stop_detail_weekly_ops_runtime_block_rate_percent: item.stop_detail_weekly_ops_runtime_block_rate_percent,
      stop_detail_weekly_ops_runtime_ui_mode_violation_total:
        item.stop_detail_weekly_ops_runtime_ui_mode_violation_total,
      stop_detail_weekly_ops_runtime_ui_mode_violation_rate_percent:
        item.stop_detail_weekly_ops_runtime_ui_mode_violation_rate_percent,
      stop_reason: item.stop_reason,
      resumed_from_governance_session_id: item.resumed_from_governance_session_id,
      updated_at: item.updated_at,
      parse_error: item.parse_error
    }))
  };
}

module.exports = {
  presentGovernanceSessionStats
};
