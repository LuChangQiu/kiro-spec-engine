class EvalBridge {
  buildPayload({ sceneManifest, plan, runResult }) {
    const metrics = {
      success: runResult.status === 'success',
      cycle_time_ms: runResult.duration_ms,
      manual_takeover_rate: runResult.manual_takeover ? 1 : 0,
      policy_violation_count: runResult.policy && runResult.policy.allowed ? 0 : 1,
      node_failure_count: (runResult.node_results || []).filter((item) => item.status === 'failed').length
    };

    return {
      trace_id: runResult.trace_id,
      scene_ref: sceneManifest.metadata.obj_id,
      scene_version: sceneManifest.metadata.obj_version,
      plan_id: plan.plan_id,
      status: runResult.status,
      metrics,
      evidence_summary: {
        node_count: plan.nodes.length,
        evidence_count: (runResult.evidence || []).length
      }
    };
  }

  score(payload, target = {}) {
    let score = 1;

    if (target.max_cycle_time_ms && payload.metrics.cycle_time_ms > target.max_cycle_time_ms) {
      score -= 0.2;
    }

    if (payload.metrics.policy_violation_count > 0) {
      score -= 0.5;
    }

    if (payload.metrics.node_failure_count > 0) {
      score -= 0.3;
    }

    return Math.max(0, Number(score.toFixed(2)));
  }
}

module.exports = EvalBridge;
