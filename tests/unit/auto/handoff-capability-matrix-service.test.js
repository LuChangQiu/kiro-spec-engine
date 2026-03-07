const {
  buildAutoHandoffCapabilityMatrixPolicy,
  buildAutoHandoffCapabilityMatrixRecommendations,
  buildAutoHandoffCapabilityMatrix
} = require('../../../lib/auto/handoff-capability-matrix-service');

describe('auto handoff capability matrix service', () => {
  test('builds capability matrix policy from preset and overrides', () => {
    const result = buildAutoHandoffCapabilityMatrixPolicy({
      profile: 'enterprise',
      minCapabilityCoverage: 95,
      requireCapabilityLexicon: false
    }, {
      resolveAutoHandoffPolicyPreset: () => ({
        profile: 'enterprise',
        preset: {
          min_capability_coverage_percent: 80,
          min_capability_semantic_percent: 90,
          require_capability_coverage: true,
          require_capability_semantic: true,
          require_capability_lexicon: true,
          require_moqui_baseline: true
        }
      }),
      normalizeHandoffMinCapabilityCoverage: (v) => Number(v),
      resolveAutoHandoffPolicyOptionNumber: (v, fallback) => v ?? fallback,
      normalizeHandoffMinCapabilitySemantic: (v) => Number(v),
      resolveAutoHandoffPolicyOptionBoolean: (v, fallback) => v ?? fallback
    });

    expect(result).toEqual({
      profile: 'enterprise',
      min_capability_coverage_percent: 95,
      min_capability_semantic_percent: 90,
      require_capability_coverage: true,
      require_capability_semantic: true,
      require_capability_lexicon: false,
      require_moqui_baseline: true
    });
  });

  test('builds capability matrix recommendations', () => {
    const result = buildAutoHandoffCapabilityMatrixRecommendations({
      manifest_path: 'docs/handoffs/handoff-manifest.json',
      template_diff: { compatibility: 'needs-sync' },
      capability_coverage: {
        status: 'ready',
        summary: { passed: false, min_required_percent: 100, semantic_passed: false },
        normalization: {
          expected_unknown: ['a'],
          provided_unknown: ['b']
        }
      },
      moqui_baseline: {
        status: 'passed',
        compare: { baseline: true }
      },
      remediation_queue: { file: '.sce/auto/remediation.lines' }
    }, {
      normalizeHandoffText: (v) => String(v || '').trim(),
      quoteCliArg: (v) => v,
      buildAutoHandoffMoquiCoverageRegressions: () => [{ label: 'business_rule_closed', delta_rate_percent: -25 }],
      buildMoquiRegressionRecoverySequenceLines: () => ['Step 1', 'Step 2'],
      clusterRemediationFile: '.sce/auto/matrix-remediation.capability-clusters.json',
      baselineJsonFile: '.sce/reports/release-evidence/moqui-template-baseline.json'
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.stringContaining('Sync template library and rerun'),
      expect.stringContaining('Recover Moqui matrix regressions'),
      'Step 1',
      'Step 2',
      expect.stringContaining('Close capability gaps with strict gate'),
      expect.stringContaining('Backfill capability ontology semantics'),
      expect.stringContaining('Normalize capability lexicon gaps with strict audit'),
      expect.stringContaining('Replay remediation queue')
    ]));
  });

  test('builds capability matrix result from delegated services', async () => {
    const result = await buildAutoHandoffCapabilityMatrix('proj', {
      manifest: 'handoff-manifest.json',
      remediationQueueOut: '.sce/auto/remediation.lines'
    }, {
      buildAutoHandoffPlan: async () => ({
        manifest_path: 'docs/handoffs/handoff-manifest.json',
        source_project: 'E:/workspace/demo',
        handoff: {
          spec_count: 2,
          template_count: 1,
          capabilities: ['cap.a'],
          capability_source: 'manifest',
          capability_inference: { applied: false }
        }
      }),
      buildAutoHandoffCapabilityMatrixPolicy: () => ({ profile: 'default' }),
      buildAutoHandoffTemplateDiff: async () => ({ compatibility: 'ready' }),
      buildAutoHandoffMoquiBaselineSnapshot: async () => ({ status: 'passed' }),
      buildAutoHandoffCapabilityCoverageSnapshot: async () => ({ status: 'ready', summary: { passed: true } }),
      evaluateAutoHandoffMoquiBaselineGateReasons: () => [],
      evaluateAutoHandoffCapabilityCoverageGateReasons: () => [],
      evaluateAutoHandoffCapabilitySemanticGateReasons: () => [],
      evaluateAutoHandoffCapabilityLexiconGateReasons: () => [],
      normalizeHandoffText: (v) => String(v || '').trim(),
      maybeWriteAutoHandoffMoquiRemediationQueue: async () => ({ file: '.sce/auto/remediation.lines', goal_count: 1 }),
      buildAutoHandoffCapabilityMatrixRecommendations: () => ['ok'],
      now: () => '2026-03-08T00:00:00.000Z'
    });

    expect(result).toEqual(expect.objectContaining({
      mode: 'auto-handoff-capability-matrix',
      generated_at: '2026-03-08T00:00:00.000Z',
      status: 'ready',
      manifest_path: 'docs/handoffs/handoff-manifest.json',
      source_project: 'E:/workspace/demo',
      recommendations: ['ok'],
      remediation_queue: { file: '.sce/auto/remediation.lines', goal_count: 1 }
    }));
    expect(result.gates).toEqual(expect.objectContaining({
      passed: true,
      reasons: []
    }));
  });
});
