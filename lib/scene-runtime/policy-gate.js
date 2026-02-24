const HIGH_RISK_LEVELS = new Set(['high', 'critical']);

class PolicyGate {
  evaluate(sceneManifest, runMode = 'dry_run', context = {}) {
    const spec = sceneManifest.spec || {};
    const governance = spec.governance_contract || {};
    const approval = governance.approval || {};
    const domain = spec.domain || 'erp';

    const riskLevel = governance.risk_level || 'medium';
    const approvalRequired = approval.required === true;

    const reasons = [];

    if (runMode === 'commit') {
      if (approvalRequired && !context.approved) {
        reasons.push('approval is required for commit');
      }

      if (HIGH_RISK_LEVELS.has(riskLevel) && !context.approved) {
        reasons.push('high-risk commit requires approval');
      }

      if (domain === 'hybrid' && context.allowHybridCommit !== true) {
        reasons.push('hybrid commit is disabled in runtime pilot');
      }

      if (domain === 'robot' || domain === 'hybrid') {
        const safetyChecks = context.safetyChecks || {};

        if (!safetyChecks.preflight) {
          reasons.push('robot safety preflight check failed');
        }

        if (!safetyChecks.stopChannel) {
          reasons.push('robot stop channel is unavailable');
        }

        if (riskLevel === 'critical' && !context.dualApproved) {
          reasons.push('critical robot commit requires dual approval');
        }
      }
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      policy: {
        risk_level: riskLevel,
        approval_required: approvalRequired,
        domain,
        run_mode: runMode
      }
    };
  }
}

module.exports = PolicyGate;
