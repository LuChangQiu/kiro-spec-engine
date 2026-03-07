const {
  deriveGovernanceRiskLevel,
  buildGovernanceConcerns,
  buildGovernanceRecommendations
} = require('../../../lib/auto/governance-summary');

describe('auto governance summary helpers', () => {
  test('derives governance risk level from governance summary signals', () => {
    const risk = deriveGovernanceRiskLevel({
      failed_sessions: 1,
      pending_goals_sum: 2,
      failure_rate_percent: 33,
      release_gate: { available: true, latest_gate_passed: false }
    });

    expect(['medium', 'high', 'critical']).toContain(risk);
  });

  test('builds governance concerns from failed sessions and gate signals', () => {
    const concerns = buildGovernanceConcerns({
      total_sessions: 3,
      failed_sessions: 1,
      pending_goals_sum: 2,
      failure_rate_percent: 33,
      release_gate: { available: true, latest_gate_passed: false },
      handoff_quality: { available: true, total_runs: 1, latest_gate_passed: false, latest_status: 'failed' }
    });

    expect(concerns).toEqual(expect.arrayContaining([
      '1 failed session(s) detected across governance archives.',
      '2 pending controller goal(s) remain unprocessed.',
      'Latest release gate evaluation is failed.',
      'Latest handoff gate evaluation is failed.'
    ]));
  });

  test('builds governance recommendations from summary', () => {
    const recommendations = buildGovernanceRecommendations({
      failed_sessions: 1,
      pending_goals_sum: 1,
      failure_rate_percent: 20,
      risk_level: 'medium',
      release_gate: { available: true, latest_gate_passed: false },
      handoff_quality: { available: true, total_runs: 1, latest_gate_passed: false, latest_status: 'failed' }
    });

    expect(recommendations).toEqual(expect.arrayContaining([
      'Run `sce auto close-loop-recover latest --recover-until-complete --json` to drain failed goals.',
      'Run `sce auto close-loop-controller --controller-resume latest --json` to continue pending queue work.',
      'Recheck latest release evidence with `sce auto handoff evidence --window 5 --json`.'
    ]));
  });
});
