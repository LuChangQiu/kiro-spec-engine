const { runAutoHandoff } = require('../../../lib/auto/handoff-run-service');

describe('auto handoff run service', () => {
  test('supports dry-run orchestration through injected dependencies', async () => {
    const reportCalls = [];
    const skippedPhases = [];
    const deps = {
      AUTO_HANDOFF_RELEASE_EVIDENCE_FILE: '.sce/reports/release-evidence/handoff-runs.json',
      buildAutoHandoffRunSessionId: () => 'handoff-session-1',
      buildAutoHandoffRunPolicy: () => ({ dependency_batching: 'phased' }),
      beginAutoHandoffRunPhase: (result, id, title) => {
        const phase = { id, title, status: 'running' };
        result.phases.push(phase);
        return phase;
      },
      buildAutoHandoffPlan: async () => ({
        manifest_path: '.sce/handoff/manifest.json',
        source_project: 'demo-project',
        handoff: {
          specs: [{ id: 'spec-01' }],
          ontology_validation: { status: 'passed' }
        },
        validation: { passed: true },
        phases: [{ id: 'plan' }]
      }),
      evaluateHandoffOntologyValidation: (payload) => payload || { status: 'unknown' },
      buildAutoHandoffTemplateDiff: async () => ({ compatibility: 'compatible' }),
      buildAutoHandoffReleaseGatePreflight: () => ({
        available: false,
        blocked: false,
        reasons: [],
        latest_tag: null,
        latest_gate_passed: null,
        latest_weekly_ops_runtime_block_rate_percent: null,
        latest_weekly_ops_runtime_ui_mode_violation_total: null,
        latest_weekly_ops_runtime_ui_mode_violation_rate_percent: null,
        weekly_ops_runtime_block_rate_max_percent: null,
        weekly_ops_runtime_ui_mode_violation_total: null,
        weekly_ops_runtime_ui_mode_violation_run_rate_percent: null,
        weekly_ops_runtime_ui_mode_violation_rate_max_percent: null
      }),
      loadGovernanceReleaseGateSignals: async () => ({}),
      completeAutoHandoffRunPhase: (phase, details) => {
        phase.status = 'completed';
        phase.details = details;
      },
      evaluateAutoHandoffOntologyGateReasons: () => [],
      auditSpecDeliverySync: async () => ({
        passed: true,
        reason: 'passed',
        summary: { manifest_count: 1 },
        violations: []
      }),
      evaluateAutoHandoffSpecDeliveryGateReasons: () => [],
      evaluateAutoHandoffReleaseGatePreflightGateReasons: () => [],
      failAutoHandoffRunPhase: (phase, error) => {
        phase.status = 'failed';
        phase.error = error && error.message ? error.message : `${error}`;
      },
      buildAutoHandoffMoquiBaselineSnapshot: async () => ({ status: 'passed', summary: {} }),
      buildAutoHandoffMoquiBaselinePhaseDetails: (snapshot) => ({ status: snapshot.status }),
      evaluateAutoHandoffMoquiBaselineGateReasons: () => [],
      buildAutoHandoffScenePackageBatchSnapshot: async () => ({ status: 'passed', summary: {} }),
      buildAutoHandoffScenePackageBatchPhaseDetails: (snapshot) => ({ status: snapshot.status }),
      evaluateAutoHandoffScenePackageBatchGateReasons: () => [],
      buildAutoHandoffCapabilityCoverageSnapshot: async () => ({
        status: 'passed',
        summary: { coverage_percent: 100, passed: true }
      }),
      evaluateAutoHandoffCapabilityCoverageGateReasons: () => [],
      evaluateAutoHandoffCapabilityLexiconGateReasons: () => [],
      buildAutoHandoffQueueFromContinueSource: async () => {
        throw new Error('continue source should not be used in this test');
      },
      buildAutoHandoffQueue: async () => ({
        goal_count: 1,
        include_known_gaps: false,
        output_file: null,
        dry_run: true,
        goals: [{ id: 'goal-01' }],
        resumed_from: null,
        resume_context: null
      }),
      writeAutoHandoffQueueFile: async () => {
        throw new Error('queue file should not be written for dry-run');
      },
      skipAutoHandoffRunPhase: (result, id, title, reason) => {
        skippedPhases.push(id);
        result.phases.push({ id, title, status: 'skipped', reason });
      },
      buildAutoHandoffExecutionBatches: (_handoff, goals, dependencyBatching) => ({
        dependency_batching: dependencyBatching,
        goals
      }),
      buildAutoHandoffSpecStatus: (specs, summary, baseline) => ({
        spec_count: specs.length,
        summary_present: Boolean(summary),
        baseline_present: Boolean(baseline)
      }),
      evaluateAutoHandoffRunGates: () => ({ passed: true, reasons: [] }),
      executeAutoHandoffExecutionBatches: async () => {
        throw new Error('execution should not run for dry-run');
      },
      buildAutoObservabilitySnapshot: async () => {
        throw new Error('observability should not run for dry-run');
      },
      extractAutoObservabilityWeeklyOpsStopTelemetry: () => ({}),
      buildProgramKpiSnapshot: () => ({ risk_level: 'low' }),
      buildAutoHandoffRegression: async () => ({ trend: 'stable' }),
      maybeWriteAutoHandoffMoquiRemediationQueue: async () => null,
      buildAutoHandoffRunFailureSummary: (result) => ({ status: result.status }),
      buildAutoHandoffRunRecommendations: () => ['review release evidence after live run'],
      writeAutoHandoffRunReport: async (_projectPath, result, out) => {
        reportCalls.push({ session_id: result.session_id, out: out || null, status: result.status });
      },
      mergeAutoHandoffRunIntoReleaseEvidence: async () => {
        throw new Error('release evidence merge should not run for dry-run');
      }
    };

    const result = await runAutoHandoff('demo-project', { dryRun: true }, deps);

    expect(result.status).toBe('dry-run');
    expect(result.session_id).toBe('handoff-session-1');
    expect(result.release_evidence).toEqual(expect.objectContaining({
      skipped: true,
      reason: 'dry-run'
    }));
    expect(result.dependency_execution).toEqual(expect.objectContaining({
      dependency_batching: 'phased'
    }));
    expect(result.gates).toEqual(expect.objectContaining({ passed: true }));
    expect(reportCalls).toHaveLength(2);
    expect(skippedPhases).toEqual(['execution', 'observability']);
  });

  test('fails in precheck when spec delivery sync gate is blocked', async () => {
    const deps = {
      AUTO_HANDOFF_RELEASE_EVIDENCE_FILE: '.sce/reports/release-evidence/handoff-runs.json',
      buildAutoHandoffRunSessionId: () => 'handoff-session-2',
      buildAutoHandoffRunPolicy: () => ({ require_spec_delivery_sync: true }),
      beginAutoHandoffRunPhase: (result, id, title) => {
        const phase = { id, title, status: 'running' };
        result.phases.push(phase);
        return phase;
      },
      buildAutoHandoffPlan: async () => ({
        manifest_path: '.sce/handoff/manifest.json',
        source_project: 'demo-project',
        handoff: {
          specs: [{ id: 'spec-01' }],
          ontology_validation: { status: 'passed' }
        },
        validation: { passed: true },
        phases: [{ id: 'plan' }]
      }),
      evaluateHandoffOntologyValidation: (payload) => payload || { status: 'unknown' },
      auditSpecDeliverySync: async () => ({
        passed: false,
        reason: 'violations',
        summary: { manifest_count: 1 },
        violations: ['[121-00-spec-delivery-sync-integrity-gate] src/feature.js => not-tracked']
      }),
      buildAutoHandoffTemplateDiff: async () => ({ compatibility: 'compatible' }),
      buildAutoHandoffReleaseGatePreflight: () => ({
        available: true,
        blocked: false,
        reasons: []
      }),
      loadGovernanceReleaseGateSignals: async () => ({}),
      completeAutoHandoffRunPhase: (phase, details) => {
        phase.status = 'completed';
        phase.details = details;
      },
      evaluateAutoHandoffOntologyGateReasons: () => [],
      evaluateAutoHandoffSpecDeliveryGateReasons: (_policy, snapshot) => snapshot.violations,
      evaluateAutoHandoffReleaseGatePreflightGateReasons: () => [],
      failAutoHandoffRunPhase: (phase, error) => {
        phase.status = 'failed';
        phase.error = error && error.message ? error.message : `${error}`;
      },
      buildAutoHandoffMoquiBaselineSnapshot: async () => ({ status: 'passed', summary: {} }),
      buildAutoHandoffMoquiBaselinePhaseDetails: (snapshot) => ({ status: snapshot.status }),
      evaluateAutoHandoffMoquiBaselineGateReasons: () => [],
      buildAutoHandoffScenePackageBatchSnapshot: async () => ({ status: 'passed', summary: {} }),
      buildAutoHandoffScenePackageBatchPhaseDetails: (snapshot) => ({ status: snapshot.status }),
      evaluateAutoHandoffScenePackageBatchGateReasons: () => [],
      buildAutoHandoffCapabilityCoverageSnapshot: async () => ({
        status: 'passed',
        summary: { coverage_percent: 100, passed: true }
      }),
      evaluateAutoHandoffCapabilityCoverageGateReasons: () => [],
      evaluateAutoHandoffCapabilityLexiconGateReasons: () => [],
      buildAutoHandoffQueueFromContinueSource: async () => ({ goal_count: 0 }),
      buildAutoHandoffQueue: async () => ({ goal_count: 0 }),
      writeAutoHandoffQueueFile: async () => {},
      skipAutoHandoffRunPhase: () => {},
      buildAutoHandoffExecutionBatches: () => ({}),
      buildAutoHandoffSpecStatus: () => ({}),
      evaluateAutoHandoffRunGates: () => ({ passed: true, reasons: [] }),
      executeAutoHandoffExecutionBatches: async () => ({ execution_plan: {}, summary: {} }),
      buildAutoObservabilitySnapshot: async () => ({}),
      extractAutoObservabilityWeeklyOpsStopTelemetry: () => ({}),
      buildProgramKpiSnapshot: () => ({ risk_level: 'low' }),
      buildAutoHandoffRegression: async () => ({ trend: 'stable' }),
      maybeWriteAutoHandoffMoquiRemediationQueue: async () => null,
      buildAutoHandoffRunFailureSummary: (result) => ({ status: result.status }),
      buildAutoHandoffRunRecommendations: () => ['sce workspace delivery-audit --json --strict'],
      writeAutoHandoffRunReport: async () => {},
      mergeAutoHandoffRunIntoReleaseEvidence: async () => ({ merged: true })
    };

    const result = await runAutoHandoff('demo-project', { dryRun: true }, deps);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('handoff spec delivery sync gate failed');
    expect(result.spec_delivery_sync).toEqual(expect.objectContaining({
      passed: false,
      reason: 'violations'
    }));
    expect(result.phases[0]).toEqual(expect.objectContaining({
      id: 'precheck',
      status: 'failed'
    }));
  });
});
