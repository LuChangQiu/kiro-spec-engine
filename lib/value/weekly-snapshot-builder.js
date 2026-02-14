const PERIOD_REGEX = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

function isValidPeriod(period) {
  return typeof period === 'string' && PERIOD_REGEX.test(period.trim());
}

class WeeklySnapshotBuilder {
  constructor(options = {}) {
    this.now = typeof options.now === 'function'
      ? options.now
      : (() => new Date().toISOString());
  }

  build(options = {}) {
    const {
      period,
      metrics,
      notes = '',
      contract
    } = options;

    if (!isValidPeriod(period)) {
      throw new Error(`Invalid period format: ${period}. Expected YYYY-WNN.`);
    }

    if (!contract || !Array.isArray(contract.metrics)) {
      throw new Error('Metric contract is required to build snapshot');
    }

    if (!metrics || typeof metrics !== 'object') {
      throw new Error('Snapshot metrics input must be an object');
    }

    const metricValues = {};
    contract.metrics.forEach(metric => {
      if (!Object.prototype.hasOwnProperty.call(metrics, metric.id)) {
        throw new Error(`Missing metric value: ${metric.id}`);
      }

      const numericValue = Number(metrics[metric.id]);
      if (!Number.isFinite(numericValue)) {
        throw new Error(`Metric value must be numeric: ${metric.id}`);
      }

      metricValues[metric.id] = numericValue;
    });

    return {
      period,
      ...metricValues,
      risk_level: 'medium',
      reasons: [],
      notes,
      generated_at: this.now()
    };
  }
}

module.exports = WeeklySnapshotBuilder;
module.exports.isValidPeriod = isValidPeriod;

