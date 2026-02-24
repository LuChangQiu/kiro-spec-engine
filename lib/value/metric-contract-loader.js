const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

const REQUIRED_METRIC_IDS = [
  'ttfv_minutes',
  'batch_success_rate',
  'cycle_reduction_rate',
  'manual_takeover_rate'
];

const METRIC_DIRECTION_HINTS = {
  ttfv_minutes: 'lower',
  batch_success_rate: 'higher',
  cycle_reduction_rate: 'higher',
  manual_takeover_rate: 'lower'
};

function parseTargetExpression(target) {
  if (typeof target === 'number' && Number.isFinite(target)) {
    return {
      operator: '=',
      value: target,
      raw: String(target)
    };
  }

  if (typeof target !== 'string') {
    throw new Error(`Invalid target expression type: ${typeof target}`);
  }

  const match = /^(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$/.exec(target.trim());
  if (!match) {
    throw new Error(`Invalid target expression: ${target}`);
  }

  return {
    operator: match[1],
    value: Number(match[2]),
    raw: target
  };
}

class MetricContractLoader {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  getDefaultPath() {
    return path.join(
      this.projectPath,
      '.sce',
      'specs',
      '112-00-spec-value-realization-program',
      'custom',
      'metric-definition.yaml'
    );
  }

  resolvePath(contractPath) {
    if (!contractPath) {
      return this.getDefaultPath();
    }

    return path.isAbsolute(contractPath)
      ? contractPath
      : path.join(this.projectPath, contractPath);
  }

  async load(options = {}) {
    const contractPath = this.resolvePath(options.path);

    if (!await fs.pathExists(contractPath)) {
      throw new Error(`Metric contract not found: ${contractPath}`);
    }

    const raw = await fs.readFile(contractPath, 'utf8');
    const extension = path.extname(contractPath).toLowerCase();

    let parsed;
    try {
      parsed = extension === '.json' ? JSON.parse(raw) : yaml.load(raw);
    } catch (error) {
      throw new Error(`Failed to parse metric contract: ${error.message}`);
    }

    const normalized = this.normalize(parsed);
    const validation = this.validate(normalized);

    if (!validation.valid) {
      throw new Error(`Invalid metric contract: ${validation.errors.join('; ')}`);
    }

    return {
      contract: normalized,
      contractPath
    };
  }

  normalize(contract = {}) {
    const metrics = Array.isArray(contract.metrics) ? contract.metrics : [];

    const normalizedMetrics = metrics.map(metric => {
      const id = typeof metric.id === 'string' ? metric.id.trim() : '';
      const targetRule = parseTargetExpression(metric.target);

      return {
        ...metric,
        id,
        unit: typeof metric.unit === 'string' ? metric.unit.trim().toLowerCase() : metric.unit,
        better_direction: this.inferBetterDirection(id, metric, targetRule),
        target_rule: targetRule
      };
    });

    const metricMap = {};
    normalizedMetrics.forEach(metric => {
      metricMap[metric.id] = metric;
    });

    return {
      ...contract,
      metrics: normalizedMetrics,
      metric_map: metricMap
    };
  }

  inferBetterDirection(metricId, metric, targetRule) {
    if (metric && typeof metric.better_direction === 'string') {
      return metric.better_direction.trim().toLowerCase();
    }

    if (METRIC_DIRECTION_HINTS[metricId]) {
      return METRIC_DIRECTION_HINTS[metricId];
    }

    if (targetRule.operator === '<=' || targetRule.operator === '<') {
      return 'lower';
    }

    return 'higher';
  }

  validate(contract = {}) {
    const errors = [];

    if (!contract || typeof contract !== 'object') {
      return {
        valid: false,
        errors: ['Contract must be an object']
      };
    }

    if (!Array.isArray(contract.metrics) || contract.metrics.length === 0) {
      errors.push('metrics must be a non-empty array');
      return { valid: false, errors };
    }

    const presentMetricIds = new Set();

    contract.metrics.forEach((metric, index) => {
      if (!metric.id || typeof metric.id !== 'string') {
        errors.push(`metrics[${index}].id is required`);
      } else {
        presentMetricIds.add(metric.id);
      }

      if (!metric.name || typeof metric.name !== 'string') {
        errors.push(`metrics[${index}].name is required`);
      }

      if (!metric.unit || typeof metric.unit !== 'string') {
        errors.push(`metrics[${index}].unit is required`);
      }

      if (!metric.target_rule) {
        errors.push(`metrics[${index}].target is required`);
        return;
      }

      if (!Number.isFinite(metric.target_rule.value)) {
        errors.push(`metrics[${index}].target value must be numeric`);
      }

      if (metric.unit === 'ratio' && (metric.target_rule.value < 0 || metric.target_rule.value > 1)) {
        errors.push(`metrics[${index}].target ratio must be between 0 and 1`);
      }

      if (metric.id === 'ttfv_minutes' && metric.target_rule.value < 0) {
        errors.push('ttfv_minutes target must be >= 0');
      }
    });

    REQUIRED_METRIC_IDS.forEach(metricId => {
      if (!presentMetricIds.has(metricId)) {
        errors.push(`required metric is missing: ${metricId}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = MetricContractLoader;
module.exports.REQUIRED_METRIC_IDS = REQUIRED_METRIC_IDS;
module.exports.parseTargetExpression = parseTargetExpression;

