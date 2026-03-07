function presentGovernanceSessionList(
  projectPath,
  filteredSessions,
  statusFilter,
  resumeOnly,
  buildStatusCounts,
  getGovernanceCloseLoopSessionDir,
  limit = null
) {
  const sessions = Array.isArray(filteredSessions) ? filteredSessions : [];
  const resumedSessions = sessions.filter((session) => session && session.resumed_from_governance_session_id).length;
  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : sessions.length;
  return {
    mode: 'auto-governance-session-list',
    session_dir: getGovernanceCloseLoopSessionDir(projectPath),
    total: sessions.length,
    status_filter: statusFilter,
    resume_only: resumeOnly,
    resumed_sessions: resumedSessions,
    fresh_sessions: sessions.length - resumedSessions,
    status_counts: buildStatusCounts(sessions),
    sessions: sessions.slice(0, maxItems).map((item) => ({
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
      parse_error: item.parse_error,
      file: item.file
    }))
  };
}

module.exports = {
  presentGovernanceSessionList
};
