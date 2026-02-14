const RiskEvaluator = require('../../../lib/value/risk-evaluator');

describe('RiskEvaluator', () => {
  test('elevates to high when a metric worsens for two consecutive weeks', () => {
    const evaluator = new RiskEvaluator();

    const result = evaluator.evaluate({
      historySnapshots: [
        {
          period: '2026-W07',
          ttfv_minutes: 20,
          batch_success_rate: 0.85,
          cycle_reduction_rate: 0.33,
          manual_takeover_rate: 0.17
        },
        {
          period: '2026-W08',
          ttfv_minutes: 23,
          batch_success_rate: 0.85,
          cycle_reduction_rate: 0.33,
          manual_takeover_rate: 0.17
        }
      ],
      currentSnapshot: {
        period: '2026-W09',
        ttfv_minutes: 26,
        batch_success_rate: 0.85,
        cycle_reduction_rate: 0.33,
        manual_takeover_rate: 0.17
      }
    });

    expect(result.risk_level).toBe('high');
    expect(result.triggered_metrics).toContain('ttfv_minutes');
    expect(result.reasons.join(' ')).toContain('ttfv_minutes');
  });

  test('keeps medium risk when no two-week consecutive worsening occurs', () => {
    const evaluator = new RiskEvaluator();

    const result = evaluator.evaluate({
      historySnapshots: [
        {
          period: '2026-W07',
          ttfv_minutes: 22,
          batch_success_rate: 0.81,
          cycle_reduction_rate: 0.31,
          manual_takeover_rate: 0.19
        },
        {
          period: '2026-W08',
          ttfv_minutes: 20,
          batch_success_rate: 0.84,
          cycle_reduction_rate: 0.33,
          manual_takeover_rate: 0.18
        }
      ],
      currentSnapshot: {
        period: '2026-W09',
        ttfv_minutes: 21,
        batch_success_rate: 0.83,
        cycle_reduction_rate: 0.32,
        manual_takeover_rate: 0.18
      }
    });

    expect(result.risk_level).toBe('medium');
    expect(result.triggered_metrics).toHaveLength(0);
  });
});

