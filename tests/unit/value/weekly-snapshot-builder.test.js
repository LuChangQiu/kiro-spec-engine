const WeeklySnapshotBuilder = require('../../../lib/value/weekly-snapshot-builder');

const contract = {
  metrics: [
    { id: 'ttfv_minutes' },
    { id: 'batch_success_rate' },
    { id: 'cycle_reduction_rate' },
    { id: 'manual_takeover_rate' }
  ]
};

describe('WeeklySnapshotBuilder', () => {
  test('builds a normalized snapshot', () => {
    const builder = new WeeklySnapshotBuilder({
      now: () => '2026-02-14T10:00:00.000Z'
    });

    const snapshot = builder.build({
      period: '2026-W08',
      metrics: {
        ttfv_minutes: 27,
        batch_success_rate: 0.84,
        cycle_reduction_rate: 0.32,
        manual_takeover_rate: 0.18
      },
      notes: 'stable week',
      contract
    });

    expect(snapshot.period).toBe('2026-W08');
    expect(snapshot.ttfv_minutes).toBe(27);
    expect(snapshot.risk_level).toBe('medium');
    expect(snapshot.notes).toBe('stable week');
    expect(snapshot.generated_at).toBe('2026-02-14T10:00:00.000Z');
  });

  test('fails when metric value is missing', () => {
    const builder = new WeeklySnapshotBuilder();

    expect(() => builder.build({
      period: '2026-W08',
      metrics: {
        ttfv_minutes: 27,
        batch_success_rate: 0.84,
        cycle_reduction_rate: 0.32
      },
      contract
    })).toThrow('Missing metric value: manual_takeover_rate');
  });

  test('fails on invalid period format', () => {
    const builder = new WeeklySnapshotBuilder();

    expect(() => builder.build({
      period: '2026/08',
      metrics: {
        ttfv_minutes: 27,
        batch_success_rate: 0.84,
        cycle_reduction_rate: 0.32,
        manual_takeover_rate: 0.18
      },
      contract
    })).toThrow('Invalid period format');
  });
});

