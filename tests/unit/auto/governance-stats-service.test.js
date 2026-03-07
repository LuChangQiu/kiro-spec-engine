const { buildAutoGovernanceStats } = require('../../../lib/auto/governance-stats-service');

describe('auto governance stats service', () => {
  test('aggregates archive stats and governance health into one payload', async () => {
    const result = await buildAutoGovernanceStats('proj', { days: 7 }, {
      normalizeStatsWindowDays: (value) => value,
      normalizeStatusFilter: () => [],
      statsCloseLoopSessions: async () => ({ total_sessions: 2, completed_sessions: 1, failed_sessions: 1, sub_spec_count_sum: 3, master_spec_counts: { '01-00': 2 } }),
      statsCloseLoopBatchSummarySessions: async () => ({ total_sessions: 1, completed_sessions: 1, failed_sessions: 0, total_goals_sum: 4, processed_goals_sum: 4 }),
      statsCloseLoopControllerSessions: async () => ({ total_sessions: 1, completed_sessions: 0, failed_sessions: 0, processed_goals_sum: 2, pending_goals_sum: 1 }),
      showCloseLoopRecoveryMemory: async () => ({ file: 'mem.json', scope: null, stats: { signature_count: 2, action_count: 3 } }),
      loadGovernanceReleaseGateSignals: async () => ({ available: false }),
      loadGovernanceHandoffQualitySignals: async () => ({ available: false }),
      calculatePercent: (a, b) => (b > 0 ? Number(((a / b) * 100).toFixed(2)) : 0),
      deriveGovernanceRiskLevel: () => 'medium',
      buildGovernanceConcerns: () => ['c1'],
      buildGovernanceRecommendations: () => ['r1'],
      buildTopCountEntries: () => [{ key: '01-00', count: 2 }],
      now: () => new Date('2026-03-07T00:00:00.000Z')
    });

    expect(result).toEqual(expect.objectContaining({
      mode: 'auto-governance-stats',
      totals: expect.objectContaining({
        total_sessions: 4,
        completed_sessions: 2,
        failed_sessions: 1
      }),
      throughput: expect.objectContaining({
        controller_pending_goals_sum: 1
      }),
      health: expect.objectContaining({
        risk_level: 'medium',
        concerns: ['c1'],
        recommendations: ['r1']
      }),
      recovery_memory: expect.objectContaining({
        signature_count: 2,
        action_count: 3
      })
    }));
  });
});
