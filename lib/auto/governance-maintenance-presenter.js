function defaultEvaluateGovernanceReleaseGateBlockState(assessment) {
  const releaseGate = assessment && assessment.release_gate && typeof assessment.release_gate === 'object'
    ? assessment.release_gate
    : (assessment && assessment.health && assessment.health.release_gate && typeof assessment.health.release_gate === 'object'
      ? assessment.health.release_gate
      : {});
  const blockedReasons = Array.isArray(releaseGate.blocked_reasons) ? releaseGate.blocked_reasons : [];
  return {
    blocked: releaseGate.available === true && releaseGate.latest_gate_passed === false,
    reasons: blockedReasons
  };
}

function buildAutoGovernanceMaintenancePlan(assessment = {}, policy = {}, dryRun = false, dependencies = {}) {
  const sessionTotal = Number(assessment && assessment.archives && assessment.archives.session && assessment.archives.session.total_sessions) || 0;
  const batchTotal = Number(assessment && assessment.archives && assessment.archives.batch_session && assessment.archives.batch_session.total_sessions) || 0;
  const controllerTotal = Number(assessment && assessment.archives && assessment.archives.controller_session && assessment.archives.controller_session.total_sessions) || 0;
  const recoverySignatureCount = Number(assessment && assessment.recovery_memory && assessment.recovery_memory.signature_count) || 0;
  const failedSessions = Number(assessment && assessment.totals && assessment.totals.failed_sessions) || 0;
  const pendingGoals = Number(assessment && assessment.throughput && assessment.throughput.controller_pending_goals_sum) || Number(assessment && assessment.totals && assessment.totals.pending_goals_sum) || 0;

  const sessionKeep = Number(policy.session_keep || 0);
  const batchSessionKeep = Number(policy.batch_session_keep || 0);
  const controllerSessionKeep = Number(policy.controller_session_keep || 0);
  const recoveryOlderThanDays = policy.recovery_memory_older_than_days;

  const sessionCommand = `sce auto session prune --keep ${sessionKeep}${dryRun ? ' --dry-run' : ''} --json`;
  const batchCommand = `sce auto batch-session prune --keep ${batchSessionKeep}${dryRun ? ' --dry-run' : ''} --json`;
  const controllerCommand = `sce auto controller-session prune --keep ${controllerSessionKeep}${dryRun ? ' --dry-run' : ''} --json`;
  const recoveryCommand = `sce auto recovery-memory prune --older-than-days ${recoveryOlderThanDays}${dryRun ? ' --dry-run' : ''} --json`;
  const evaluateGovernanceReleaseGateBlockState = dependencies.evaluateGovernanceReleaseGateBlockState || defaultEvaluateGovernanceReleaseGateBlockState;
  const releaseGateBlockState = evaluateGovernanceReleaseGateBlockState(assessment);
  const releaseGateReasons = Array.isArray(releaseGateBlockState.reasons) ? releaseGateBlockState.reasons : [];
  const releaseGateAdvisoryPlan = [];
  if (releaseGateBlockState.blocked) {
    releaseGateAdvisoryPlan.push({
      id: 'release-gate-evidence-review',
      type: 'advisory',
      apply_supported: false,
      enabled: true,
      reason: `release gate quality is blocking governance loop: ${releaseGateReasons.join(', ')}`,
      command: 'sce auto handoff evidence --window 5 --json',
      blocked_reasons: releaseGateReasons
    });
    if (releaseGateReasons.some((item) => `${item}`.includes('scene-batch') || `${item}`.includes('drift'))) {
      releaseGateAdvisoryPlan.push({
        id: 'release-gate-scene-batch-remediate',
        type: 'advisory',
        apply_supported: false,
        enabled: true,
        reason: 'release gate drift/scene signals need package-publish-batch remediation',
        command: 'sce scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --json',
        blocked_reasons: releaseGateReasons
      });
    }
    if (releaseGateReasons.some((item) => `${item}`.startsWith('handoff-'))) {
      releaseGateAdvisoryPlan.push({
        id: 'release-gate-handoff-remediate',
        type: 'advisory',
        apply_supported: false,
        enabled: true,
        reason: 'handoff quality signals are blocking governance convergence',
        command: 'sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --dry-run --json',
        blocked_reasons: releaseGateReasons
      });
    }
  }

  return [
    ...releaseGateAdvisoryPlan,
    {
      id: 'session-prune',
      type: 'maintenance',
      apply_supported: true,
      enabled: sessionTotal > sessionKeep,
      reason: sessionTotal > sessionKeep
        ? `close-loop session archive ${sessionTotal} exceeds keep policy ${sessionKeep}`
        : 'close-loop session archive is within keep policy',
      command: sessionCommand,
      target_total: sessionTotal,
      keep: sessionKeep
    },
    {
      id: 'batch-session-prune',
      type: 'maintenance',
      apply_supported: true,
      enabled: batchTotal > batchSessionKeep,
      reason: batchTotal > batchSessionKeep
        ? `batch session archive ${batchTotal} exceeds keep policy ${batchSessionKeep}`
        : 'batch session archive is within keep policy',
      command: batchCommand,
      target_total: batchTotal,
      keep: batchSessionKeep
    },
    {
      id: 'controller-session-prune',
      type: 'maintenance',
      apply_supported: true,
      enabled: controllerTotal > controllerSessionKeep,
      reason: controllerTotal > controllerSessionKeep
        ? `controller session archive ${controllerTotal} exceeds keep policy ${controllerSessionKeep}`
        : 'controller session archive is within keep policy',
      command: controllerCommand,
      target_total: controllerTotal,
      keep: controllerSessionKeep
    },
    {
      id: 'recovery-memory-prune',
      type: 'maintenance',
      apply_supported: true,
      enabled: recoverySignatureCount > 0,
      reason: recoverySignatureCount > 0
        ? `recovery memory contains ${recoverySignatureCount} signature(s), prune stale entries`
        : 'recovery memory is empty',
      command: recoveryCommand,
      target_total: recoverySignatureCount,
      older_than_days: recoveryOlderThanDays
    },
    {
      id: 'recover-latest',
      type: 'advisory',
      apply_supported: false,
      enabled: failedSessions > 0,
      reason: failedSessions > 0
        ? `${failedSessions} failed session(s) detected, run recovery drain`
        : 'no failed sessions detected',
      command: 'sce auto close-loop-recover latest --recover-until-complete --json'
    },
    {
      id: 'controller-resume-latest',
      type: 'advisory',
      apply_supported: false,
      enabled: pendingGoals > 0,
      reason: pendingGoals > 0
        ? `${pendingGoals} pending controller goal(s) detected, resume controller queue`
        : 'no pending controller goals detected',
      command: 'sce auto close-loop-controller --controller-resume latest --json'
    }
  ];
}

function summarizeGovernanceMaintenanceExecution(plan = [], executedActions = []) {
  const safePlan = Array.isArray(plan) ? plan : [];
  const safeExecuted = Array.isArray(executedActions) ? executedActions : [];
  const plannedActions = safePlan.filter((item) => item && item.enabled).length;
  const applicableActions = safePlan.filter((item) => item && item.enabled && item.apply_supported).length;
  const advisoryActions = safePlan.filter((item) => item && item.enabled && !item.apply_supported).length;
  const appliedActions = safeExecuted.filter((item) => item && item.status === 'applied').length;
  const failedActions = safeExecuted.filter((item) => item && item.status === 'failed').length;
  return {
    planned_actions: plannedActions,
    applicable_actions: applicableActions,
    advisory_actions: advisoryActions,
    applied_actions: appliedActions,
    failed_actions: failedActions
  };
}

module.exports = {
  buildAutoGovernanceMaintenancePlan,
  summarizeGovernanceMaintenanceExecution
};
