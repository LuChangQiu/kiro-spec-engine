const GateSummaryEmitter = require('../../../lib/value/gate-summary-emitter');

const contract = {
  metrics: [
    {
      id: 'ttfv_minutes',
      target: '<= 30',
      target_rule: { operator: '<=', value: 30, raw: '<= 30' }
    },
    {
      id: 'batch_success_rate',
      target: '>= 0.80',
      target_rule: { operator: '>=', value: 0.80, raw: '>= 0.80' }
    },
    {
      id: 'cycle_reduction_rate',
      target: '>= 0.30',
      target_rule: { operator: '>=', value: 0.30, raw: '>= 0.30' }
    },
    {
      id: 'manual_takeover_rate',
      target: '<= 0.20',
      target_rule: { operator: '<=', value: 0.20, raw: '<= 0.20' }
    }
  ],
  threshold_policy: {
    go_no_go: {
      day_60_min_passed_metrics: 3
    }
  }
};

describe('GateSummaryEmitter', () => {
  test('emits go decision when day-60 threshold is met', () => {
    const emitter = new GateSummaryEmitter();

    const summary = emitter.build({
      checkpoint: 'day-60',
      contract,
      snapshot: {
        ttfv_minutes: 27,
        batch_success_rate: 0.81,
        cycle_reduction_rate: 0.31,
        manual_takeover_rate: 0.22
      },
      evidence: ['custom/weekly-metrics/2026-W09.json']
    });

    expect(summary.passed_metrics).toBe(3);
    expect(summary.required_passed_metrics).toBe(3);
    expect(summary.decision).toBe('go');
  });

  test('emits no-go when threshold is not met', () => {
    const emitter = new GateSummaryEmitter();

    const summary = emitter.build({
      checkpoint: 'day-60',
      contract,
      snapshot: {
        ttfv_minutes: 35,
        batch_success_rate: 0.81,
        cycle_reduction_rate: 0.31,
        manual_takeover_rate: 0.22
      }
    });

    expect(summary.passed_metrics).toBe(2);
    expect(summary.decision).toBe('no-go');
  });
});

