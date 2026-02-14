const { parseTargetExpression } = require('./metric-contract-loader');

function evaluateTarget(value, targetRule) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return false;
  }

  switch (targetRule.operator) {
    case '<=':
      return numericValue <= targetRule.value;
    case '>=':
      return numericValue >= targetRule.value;
    case '<':
      return numericValue < targetRule.value;
    case '>':
      return numericValue > targetRule.value;
    case '=':
      return numericValue === targetRule.value;
    default:
      return false;
  }
}

class GateSummaryEmitter {
  constructor(options = {}) {
    this.defaultThresholdRatio = options.defaultThresholdRatio || 0.75;
  }

  build(options = {}) {
    const {
      checkpoint = 'day-30',
      snapshot,
      contract,
      evidence = []
    } = options;

    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('snapshot is required');
    }

    if (!contract || !Array.isArray(contract.metrics)) {
      throw new Error('metric contract is required');
    }

    const checks = contract.metrics.map(metric => {
      const targetRule = metric.target_rule || parseTargetExpression(metric.target);
      const value = Number(snapshot[metric.id]);

      return {
        metric_id: metric.id,
        value,
        target: targetRule.raw,
        operator: targetRule.operator,
        target_value: targetRule.value,
        passed: evaluateTarget(value, targetRule)
      };
    });

    const passedMetrics = checks.filter(item => item.passed).length;
    const totalMetrics = checks.length;
    const requiredPassedMetrics = this.resolveRequiredPassCount(checkpoint, totalMetrics, contract);
    const decision = passedMetrics >= requiredPassedMetrics ? 'go' : 'no-go';

    return {
      checkpoint,
      passed_metrics: passedMetrics,
      total_metrics: totalMetrics,
      required_passed_metrics: requiredPassedMetrics,
      decision,
      checks,
      evidence
    };
  }

  resolveRequiredPassCount(checkpoint, totalMetrics, contract) {
    const goNoGo = contract
      && contract.threshold_policy
      && contract.threshold_policy.go_no_go
      ? contract.threshold_policy.go_no_go
      : {};

    let configuredThreshold;
    if (checkpoint === 'day-60') {
      configuredThreshold = Number(goNoGo.day_60_min_passed_metrics);
    } else if (checkpoint === 'day-30') {
      configuredThreshold = Number(goNoGo.day_30_min_passed_metrics);
    }

    if (Number.isFinite(configuredThreshold) && configuredThreshold > 0) {
      return Math.min(totalMetrics, Math.floor(configuredThreshold));
    }

    return Math.max(1, Math.ceil(totalMetrics * this.defaultThresholdRatio));
  }
}

module.exports = GateSummaryEmitter;

