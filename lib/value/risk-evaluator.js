const DEFAULT_METRIC_DIRECTIONS = {
  ttfv_minutes: 'lower',
  batch_success_rate: 'higher',
  cycle_reduction_rate: 'higher',
  manual_takeover_rate: 'lower'
};

function parsePeriodKey(period) {
  const match = /^(\d{4})-W(\d{2})$/.exec(period || '');
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const year = Number(match[1]);
  const week = Number(match[2]);
  return (year * 100) + week;
}

function isWorse(current, previous, direction) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return false;
  }

  if (direction === 'lower') {
    return current > previous;
  }

  return current < previous;
}

class RiskEvaluator {
  constructor(options = {}) {
    this.metricDirections = {
      ...DEFAULT_METRIC_DIRECTIONS,
      ...(options.metricDirections || {})
    };
  }

  evaluate(options = {}) {
    const {
      historySnapshots = [],
      currentSnapshot
    } = options;

    if (!currentSnapshot || typeof currentSnapshot !== 'object' || !currentSnapshot.period) {
      throw new Error('currentSnapshot with valid period is required');
    }

    const dedupedByPeriod = new Map();
    historySnapshots.forEach(snapshot => {
      if (snapshot && snapshot.period) {
        dedupedByPeriod.set(snapshot.period, snapshot);
      }
    });
    dedupedByPeriod.set(currentSnapshot.period, currentSnapshot);

    const snapshots = Array.from(dedupedByPeriod.values())
      .sort((left, right) => parsePeriodKey(left.period) - parsePeriodKey(right.period));

    const details = {};
    const streaks = {};

    Object.entries(this.metricDirections).forEach(([metricId, direction]) => {
      details[metricId] = {
        better_direction: direction,
        max_consecutive_worse: 0,
        triggered: false
      };
      streaks[metricId] = 0;
    });

    for (let index = 1; index < snapshots.length; index += 1) {
      const previous = snapshots[index - 1];
      const current = snapshots[index];

      Object.entries(this.metricDirections).forEach(([metricId, direction]) => {
        const currentValue = Number(current[metricId]);
        const previousValue = Number(previous[metricId]);

        if (isWorse(currentValue, previousValue, direction)) {
          streaks[metricId] += 1;
        } else {
          streaks[metricId] = 0;
        }

        details[metricId].max_consecutive_worse = Math.max(
          details[metricId].max_consecutive_worse,
          streaks[metricId]
        );

        if (streaks[metricId] >= 2) {
          details[metricId].triggered = true;
        }
      });
    }

    const triggeredMetrics = Object.entries(details)
      .filter(([, value]) => value.triggered)
      .map(([metricId]) => metricId);

    const reasons = triggeredMetrics.map(metricId => (
      `${metricId} worsened for 2 consecutive weeks`
    ));

    return {
      evaluated_period: currentSnapshot.period,
      risk_level: triggeredMetrics.length > 0 ? 'high' : 'medium',
      triggered_metrics: triggeredMetrics,
      reasons,
      details
    };
  }
}

module.exports = RiskEvaluator;
module.exports.parsePeriodKey = parsePeriodKey;

