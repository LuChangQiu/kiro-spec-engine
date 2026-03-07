const { runAutoGovernanceCloseLoop } = require('../../../lib/auto/governance-close-loop-service');

describe('auto governance close-loop service', () => {
  test('runs one non-mutating round through the extracted service', async () => {
    const assessment = {
      health: { risk_level: 'high' },
      release_gate: { available: false }
    };

    const result = await runAutoGovernanceCloseLoop('proj', {
      dryRun: true,
      maxRounds: 1,
      targetRisk: 'high',
      governanceSession: false
    }, {
      loadGovernanceCloseLoopSessionPayload: jest.fn(),
      isExplicitOptionSource: () => false,
      normalizeStatsWindowDays: (value) => value ?? null,
      normalizeStatusFilter: () => [],
      normalizeGovernanceMaxRounds: (value, fallback) => value || fallback,
      normalizeGovernanceTargetRiskLevel: (value) => String(value || 'low').trim().toLowerCase(),
      normalizeGovernanceAdvisoryRecoverMaxRounds: (_value, fallback) => fallback,
      normalizeGovernanceAdvisoryControllerMaxCycles: (_value, fallback) => fallback,
      normalizeGovernanceSessionKeep: () => null,
      normalizeGovernanceSessionOlderThanDays: () => null,
      sanitizeBatchSessionId: (value) => value,
      createGovernanceCloseLoopSessionId: () => 'gov-1',
      buildAutoGovernanceStats: jest.fn().mockResolvedValue(assessment),
      runAutoGovernanceMaintenance: jest.fn().mockResolvedValue({
        assessment,
        after_assessment: assessment,
        plan: [],
        summary: {
          planned_actions: 0,
          applicable_actions: 0,
          applied_actions: 0,
          failed_actions: 0
        }
      }),
      executeGovernanceAdvisoryRecover: jest.fn(),
      executeGovernanceAdvisoryControllerResume: jest.fn(),
      evaluateGovernanceReleaseGateBlockState: () => ({ blocked: false, reasons: [], snapshot: null }),
      extractGovernanceWeeklyOpsStopDetail: () => null,
      compareRiskLevel: () => 0,
      buildGovernanceCloseLoopRecommendations: () => [],
      persistGovernanceCloseLoopSession: jest.fn(),
      resolveGovernanceCloseLoopRunStatus: () => 'completed',
      pruneGovernanceCloseLoopSessions: jest.fn(),
      getGovernanceCloseLoopSessionDir: () => '.sce/auto/governance-close-loop-sessions',
      extractGovernanceReleaseGateSnapshot: () => null
    });

    expect(result).toEqual(expect.objectContaining({
      mode: 'auto-governance-close-loop',
      dry_run: true,
      stop_reason: 'non-mutating-mode',
      converged: false
    }));
    expect(Array.isArray(result.rounds)).toBe(true);
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toEqual(expect.objectContaining({
      planned_actions: 0,
      advisory_planned_actions: 0,
      advisory_executed_actions: 0
    }));
  });
});
