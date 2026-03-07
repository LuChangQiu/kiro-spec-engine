function buildAutoHandoffCapabilityMatrixPolicy(options = {}, dependencies = {}) {
  const {
    resolveAutoHandoffPolicyPreset,
    normalizeHandoffMinCapabilityCoverage,
    resolveAutoHandoffPolicyOptionNumber,
    normalizeHandoffMinCapabilitySemantic,
    resolveAutoHandoffPolicyOptionBoolean
  } = dependencies;
  const { profile, preset } = resolveAutoHandoffPolicyPreset(options.profile, '--profile');
  return {
    profile,
    min_capability_coverage_percent: normalizeHandoffMinCapabilityCoverage(
      resolveAutoHandoffPolicyOptionNumber(
        options.minCapabilityCoverage,
        preset.min_capability_coverage_percent
      )
    ),
    min_capability_semantic_percent: normalizeHandoffMinCapabilitySemantic(
      resolveAutoHandoffPolicyOptionNumber(
        options.minCapabilitySemantic,
        preset.min_capability_semantic_percent
      )
    ),
    require_capability_coverage: resolveAutoHandoffPolicyOptionBoolean(
      options.requireCapabilityCoverage,
      preset.require_capability_coverage
    ),
    require_capability_semantic: resolveAutoHandoffPolicyOptionBoolean(
      options.requireCapabilitySemantic,
      preset.require_capability_semantic
    ),
    require_capability_lexicon: resolveAutoHandoffPolicyOptionBoolean(
      options.requireCapabilityLexicon,
      preset.require_capability_lexicon
    ),
    require_moqui_baseline: resolveAutoHandoffPolicyOptionBoolean(
      options.requireMoquiBaseline,
      preset.require_moqui_baseline
    )
  };
}

function buildAutoHandoffCapabilityMatrixRecommendations(result = {}, dependencies = {}) {
  const {
    normalizeHandoffText,
    quoteCliArg,
    buildAutoHandoffMoquiCoverageRegressions,
    buildMoquiRegressionRecoverySequenceLines,
    clusterRemediationFile,
    baselineJsonFile
  } = dependencies;

  const recommendations = [];
  const push = value => {
    const text = `${value || ''}`.trim();
    if (!text || recommendations.includes(text)) {
      return;
    }
    recommendations.push(text);
  };

  const manifestPath = normalizeHandoffText(result && result.manifest_path);
  const manifestCli = manifestPath ? quoteCliArg(manifestPath) : '<path>';
  const templateDiff = result && result.template_diff && typeof result.template_diff === 'object'
    ? result.template_diff
    : {};
  const capabilityCoverage = result && result.capability_coverage && typeof result.capability_coverage === 'object'
    ? result.capability_coverage
    : {};
  const coverageSummary = capabilityCoverage && capabilityCoverage.summary && typeof capabilityCoverage.summary === 'object'
    ? capabilityCoverage.summary
    : {};
  const coverageNormalization = capabilityCoverage && capabilityCoverage.normalization &&
    typeof capabilityCoverage.normalization === 'object'
    ? capabilityCoverage.normalization
    : {};
  const expectedUnknownCount = Array.isArray(coverageNormalization.expected_unknown)
    ? coverageNormalization.expected_unknown.length
    : 0;
  const providedUnknownCount = Array.isArray(coverageNormalization.provided_unknown)
    ? coverageNormalization.provided_unknown.length
    : 0;
  const baseline = result && result.moqui_baseline && typeof result.moqui_baseline === 'object'
    ? result.moqui_baseline
    : {};
  const baselineCompare = baseline && baseline.compare && typeof baseline.compare === 'object'
    ? baseline.compare
    : {};
  const baselineRegressions = buildAutoHandoffMoquiCoverageRegressions(baselineCompare);

  if (templateDiff.compatibility === 'needs-sync') {
    push(`Sync template library and rerun: sce auto handoff template-diff --manifest ${manifestCli} --json`);
  }
  if (baseline.status === 'error' || (baseline.summary && baseline.summary.portfolio_passed === false)) {
    push('Rebuild Moqui baseline: sce scene moqui-baseline --json');
  }
  if (baselineRegressions.length > 0) {
    push(
      `Recover Moqui matrix regressions: ` +
      `${baselineRegressions.slice(0, 3).map(item => `${item.label}:${item.delta_rate_percent}%`).join(' | ')}`
    );
    for (const line of buildMoquiRegressionRecoverySequenceLines({
      clusterGoalsArg: quoteCliArg(clusterRemediationFile),
      baselineArg: quoteCliArg(baselineJsonFile),
      wrapCommands: false,
      withPeriod: false
    })) {
      push(line);
    }
  }
  if (capabilityCoverage.status === 'skipped') {
    push('Declare `capabilities` in handoff manifest to enable capability matrix coverage gates.');
  }
  if (coverageSummary && coverageSummary.passed === false) {
    push(
      `Close capability gaps with strict gate: ` +
      `sce auto handoff run --manifest ${manifestCli} --min-capability-coverage ${coverageSummary.min_required_percent} --json`
    );
  }
  if (coverageSummary && coverageSummary.semantic_passed === false) {
    push(
      `Backfill capability ontology semantics and rerun matrix: ` +
      `sce scene package-ontology-backfill-batch --manifest ${manifestCli} --json`
    );
  }
  if (expectedUnknownCount > 0 || providedUnknownCount > 0) {
    push(
      `Normalize capability lexicon gaps with strict audit: ` +
      `node scripts/moqui-lexicon-audit.js --manifest ${manifestCli} ` +
      '--template-dir .sce/templates/scene-packages --fail-on-gap --json'
    );
  }
  if (result.remediation_queue && result.remediation_queue.file) {
    push(
      `Replay remediation queue: sce auto close-loop-batch ${quoteCliArg(result.remediation_queue.file)} --format lines --json`
    );
  }

  return recommendations;
}

async function buildAutoHandoffCapabilityMatrix(projectPath, options = {}, dependencies = {}) {
  const {
    buildAutoHandoffPlan,
    buildAutoHandoffCapabilityMatrixPolicy,
    buildAutoHandoffTemplateDiff,
    buildAutoHandoffMoquiBaselineSnapshot,
    buildAutoHandoffCapabilityCoverageSnapshot,
    evaluateAutoHandoffMoquiBaselineGateReasons,
    evaluateAutoHandoffCapabilityCoverageGateReasons,
    evaluateAutoHandoffCapabilitySemanticGateReasons,
    evaluateAutoHandoffCapabilityLexiconGateReasons,
    normalizeHandoffText,
    maybeWriteAutoHandoffMoquiRemediationQueue,
    buildAutoHandoffCapabilityMatrixRecommendations,
    now = () => new Date().toISOString()
  } = dependencies;

  const plan = await buildAutoHandoffPlan(projectPath, {
    manifest: options.manifest,
    strict: options.strict,
    strictWarnings: options.strictWarnings
  });

  const policy = buildAutoHandoffCapabilityMatrixPolicy(options);

  const [templateDiff, moquiBaseline, capabilityCoverage] = await Promise.all([
    buildAutoHandoffTemplateDiff(projectPath, { handoff: plan.handoff }),
    buildAutoHandoffMoquiBaselineSnapshot(projectPath),
    buildAutoHandoffCapabilityCoverageSnapshot(projectPath, plan.handoff, policy)
  ]);

  const templateSyncReasons = templateDiff.compatibility === 'ready'
    ? []
    : [`template-sync:${templateDiff.compatibility}`];
  const baselineGateReasons = evaluateAutoHandoffMoquiBaselineGateReasons(
    { require_moqui_baseline: true },
    moquiBaseline
  );
  const capabilityGateReasons = evaluateAutoHandoffCapabilityCoverageGateReasons(
    policy,
    capabilityCoverage
  );
  const semanticGateReasons = evaluateAutoHandoffCapabilitySemanticGateReasons(
    policy,
    capabilityCoverage
  );
  const lexiconGateReasons = evaluateAutoHandoffCapabilityLexiconGateReasons(
    policy,
    capabilityCoverage
  );
  const reasons = [
    ...templateSyncReasons,
    ...baselineGateReasons.map(item => `moqui-baseline:${item}`),
    ...capabilityGateReasons.map(item => `capability-coverage:${item}`),
    ...semanticGateReasons.map(item => `capability-semantic:${item}`),
    ...lexiconGateReasons.map(item => `capability-lexicon:${item}`)
  ];

  const result = {
    mode: 'auto-handoff-capability-matrix',
    generated_at: now(),
    status: reasons.length === 0 ? 'ready' : 'needs-remediation',
    manifest_path: plan.manifest_path,
    source_project: plan.source_project || null,
    handoff: {
      spec_count: plan.handoff && Number.isFinite(Number(plan.handoff.spec_count))
        ? Number(plan.handoff.spec_count)
        : 0,
      template_count: plan.handoff && Number.isFinite(Number(plan.handoff.template_count))
        ? Number(plan.handoff.template_count)
        : 0,
      capability_count: Array.isArray(plan.handoff && plan.handoff.capabilities)
        ? plan.handoff.capabilities.length
        : 0,
      capability_source: normalizeHandoffText(plan.handoff && plan.handoff.capability_source) || 'manifest',
      capability_inference: plan.handoff && plan.handoff.capability_inference &&
        typeof plan.handoff.capability_inference === 'object'
        ? plan.handoff.capability_inference
        : {
          applied: false,
          inferred_count: 0,
          inferred_capabilities: [],
          inferred_from_templates: [],
          unresolved_template_count: 0,
          unresolved_templates: []
        },
      capabilities: Array.isArray(plan.handoff && plan.handoff.capabilities)
        ? plan.handoff.capabilities
        : []
    },
    policy,
    template_diff: templateDiff,
    moqui_baseline: moquiBaseline,
    capability_coverage: capabilityCoverage,
    gates: {
      passed: reasons.length === 0,
      reasons,
      template_sync: {
        passed: templateSyncReasons.length === 0,
        reasons: templateSyncReasons
      },
      moqui_baseline: {
        passed: baselineGateReasons.length === 0,
        reasons: baselineGateReasons
      },
      capability_coverage: {
        passed: capabilityGateReasons.length === 0,
        reasons: capabilityGateReasons
      },
      capability_semantic: {
        passed: semanticGateReasons.length === 0,
        reasons: semanticGateReasons
      },
      capability_lexicon: {
        passed: lexiconGateReasons.length === 0,
        reasons: lexiconGateReasons
      }
    },
    remediation_queue: null,
    recommendations: []
  };

  result.remediation_queue = await maybeWriteAutoHandoffMoquiRemediationQueue(
    projectPath,
    {
      moqui_baseline: moquiBaseline,
      moqui_capability_coverage: capabilityCoverage
    },
    options.remediationQueueOut
  );
  result.recommendations = buildAutoHandoffCapabilityMatrixRecommendations(result);

  return result;
}

module.exports = {
  buildAutoHandoffCapabilityMatrixPolicy,
  buildAutoHandoffCapabilityMatrixRecommendations,
  buildAutoHandoffCapabilityMatrix
};
