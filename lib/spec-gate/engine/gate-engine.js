const { randomUUID } = require('crypto');

class GateEngine {
  constructor(options = {}) {
    this.registry = options.registry;
    this.policy = options.policy;
  }

  async evaluate(input = {}) {
    const specId = input.specId;
    const runId = input.runId || randomUUID();
    const startedAt = new Date().toISOString();

    const policyRules = (this.policy && this.policy.rules) || {};
    const enabledRules = this.registry.listEnabled(policyRules);

    const rules = [];
    const failedChecks = [];
    const warnings = [];

    let weightedScore = 0;
    let totalWeight = 0;
    let hardFailTriggered = false;

    for (const rule of enabledRules) {
      const policyEntry = policyRules[rule.id] || {};
      const weight = Number(policyEntry.weight || 0);
      const hardFail = !!policyEntry.hard_fail;

      totalWeight += weight;
      const execution = await rule.execute({
        specId,
        runId,
        policy: this.policy
      });

      const passed = !!execution.passed;
      const ratio = this._normalizeRatio(execution.ratio);
      const ruleScore = passed ? weight : Number((weight * ratio).toFixed(2));

      if (!passed) {
        failedChecks.push({
          id: rule.id,
          hard_fail: hardFail,
          details: execution.details || {}
        });
      }

      if (hardFail && !passed) {
        hardFailTriggered = true;
      }

      if (Array.isArray(execution.warnings) && execution.warnings.length > 0) {
        warnings.push(...execution.warnings.map(message => ({ id: rule.id, message })));
      }

      weightedScore += ruleScore;

      rules.push({
        id: rule.id,
        passed,
        score: ruleScore,
        max_score: weight,
        hard_fail: hardFail,
        warnings: execution.warnings || [],
        details: execution.details || {}
      });
    }

    const score = totalWeight > 0
      ? Math.round((weightedScore / totalWeight) * 100)
      : 0;

    const decision = this._decide({
      score,
      hardFailTriggered,
      warnings
    });

    const nextActions = this._buildNextActions(decision, failedChecks, warnings);
    const endedAt = new Date().toISOString();

    return {
      spec_id: specId,
      run_id: runId,
      decision,
      score,
      rules,
      failed_checks: failedChecks,
      warnings,
      next_actions: nextActions,
      policy_snapshot: {
        thresholds: this.policy.thresholds,
        strict_mode: this.policy.strict_mode
      },
      started_at: startedAt,
      ended_at: endedAt
    };
  }

  _normalizeRatio(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return value;
  }

  _decide(context) {
    const thresholds = this.policy.thresholds || {};
    const goThreshold = Number(thresholds.go || 90);
    const conditionalThreshold = Number(thresholds.conditional_go || 70);
    const warningAsFailure = !!(this.policy.strict_mode && this.policy.strict_mode.warning_as_failure);

    if (context.hardFailTriggered) {
      return 'no-go';
    }

    if (warningAsFailure && context.warnings.length > 0) {
      return 'no-go';
    }

    if (context.score >= goThreshold) {
      return 'go';
    }

    if (context.score >= conditionalThreshold) {
      return 'conditional-go';
    }

    return 'no-go';
  }

  _buildNextActions(decision, failedChecks, warnings) {
    if (decision === 'go') {
      return ['Proceed to implementation and keep evidence attached to Spec artifacts.'];
    }

    const actions = [];

    if (failedChecks.length > 0) {
      actions.push(`Fix failed checks: ${failedChecks.map(item => item.id).join(', ')}`);
    }

    if (warnings.length > 0) {
      actions.push('Review warnings and decide whether to re-run with relaxed strict mode.');
    }

    actions.push('Re-run gate after remediation and attach latest gate report.');
    return actions;
  }
}

module.exports = {
  GateEngine
};

