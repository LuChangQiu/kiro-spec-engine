const path = require('path');

async function runAutoHandoff(projectPath, options = {}, dependencies = {}) {
  const {
    AUTO_HANDOFF_RELEASE_EVIDENCE_FILE,
    buildAutoHandoffRunSessionId,
    buildAutoHandoffRunPolicy,
    beginAutoHandoffRunPhase,
    buildAutoHandoffPlan,
    evaluateHandoffOntologyValidation,
    buildAutoHandoffTemplateDiff,
    buildAutoHandoffReleaseGatePreflight,
    loadGovernanceReleaseGateSignals,
    completeAutoHandoffRunPhase,
    evaluateAutoHandoffOntologyGateReasons,
    auditSpecDeliverySync,
    evaluateAutoHandoffSpecDeliveryGateReasons,
    evaluateAutoHandoffReleaseGatePreflightGateReasons,
    failAutoHandoffRunPhase,
    buildAutoHandoffMoquiBaselineSnapshot,
    buildAutoHandoffMoquiBaselinePhaseDetails,
    evaluateAutoHandoffMoquiBaselineGateReasons,
    buildAutoHandoffScenePackageBatchSnapshot,
    buildAutoHandoffScenePackageBatchPhaseDetails,
    evaluateAutoHandoffScenePackageBatchGateReasons,
    buildAutoHandoffCapabilityCoverageSnapshot,
    evaluateAutoHandoffCapabilityCoverageGateReasons,
    evaluateAutoHandoffCapabilityLexiconGateReasons,
    buildAutoHandoffQueueFromContinueSource,
    buildAutoHandoffQueue,
    writeAutoHandoffQueueFile,
    skipAutoHandoffRunPhase,
    buildAutoHandoffExecutionBatches,
    buildAutoHandoffSpecStatus,
    evaluateAutoHandoffRunGates,
    executeAutoHandoffExecutionBatches,
    buildAutoObservabilitySnapshot,
    extractAutoObservabilityWeeklyOpsStopTelemetry,
    buildProgramKpiSnapshot,
    buildAutoHandoffRegression,
    maybeWriteAutoHandoffMoquiRemediationQueue,
    buildAutoHandoffRunFailureSummary,
    buildAutoHandoffRunRecommendations,
    writeAutoHandoffRunReport,
    mergeAutoHandoffRunIntoReleaseEvidence
  } = dependencies;

  const startedAtMs = Date.now();
  const result = {
    mode: 'auto-handoff-run',
    status: 'running',
    generated_at: new Date().toISOString(),
    session_id: buildAutoHandoffRunSessionId(),
    manifest_path: null,
    source_project: null,
    policy: buildAutoHandoffRunPolicy(options),
    dry_run: Boolean(options.dryRun),
    phases: [],
    handoff: null,
    template_diff: null,
    queue: null,
    continued_from: null,
    dependency_execution: null,
    batch_summary: null,
    observability_snapshot: null,
    spec_status: null,
    ontology_validation: null,
    spec_delivery_sync: null,
    moqui_baseline: null,
    scene_package_batch: null,
    moqui_capability_coverage: null,
    release_gate_preflight: null,
    remediation_queue: null,
    gates: null,
    regression: null,
    release_evidence: null,
    failure_summary: null,
    recommendations: [],
    warnings: [],
    error: null
  };

  try {
    const precheckPhase = beginAutoHandoffRunPhase(result, 'precheck', 'Plan and precheck');
    let plan = null;
    try {
      plan = await buildAutoHandoffPlan(projectPath, {
        manifest: options.manifest,
        strict: options.strict,
        strictWarnings: options.strictWarnings
      });
      result.manifest_path = plan.manifest_path;
      result.source_project = plan.source_project || null;
      result.handoff = plan.handoff;
      result.ontology_validation = evaluateHandoffOntologyValidation(
        plan && plan.handoff ? plan.handoff.ontology_validation : null
      );
      result.spec_delivery_sync = await auditSpecDeliverySync(projectPath, {
        requireManifest: false
      });
      result.template_diff = await buildAutoHandoffTemplateDiff(projectPath, { manifest: options.manifest });
      result.release_gate_preflight = buildAutoHandoffReleaseGatePreflight(
        await loadGovernanceReleaseGateSignals(projectPath)
      );
      if (result.release_gate_preflight.parse_error) {
        result.warnings.push(
          `release gate preflight parse failed: ${result.release_gate_preflight.parse_error}`
        );
      }
      if (result.release_gate_preflight.blocked === true) {
        const reasonText = result.release_gate_preflight.reasons.length > 0
          ? result.release_gate_preflight.reasons.join('; ')
          : 'release gate blocked';
        result.warnings.push(`release gate preflight is blocked: ${reasonText}`);
      }
      completeAutoHandoffRunPhase(precheckPhase, {
        validation: plan.validation,
        phase_count: Array.isArray(plan.phases) ? plan.phases.length : 0,
        spec_delivery_sync: result.spec_delivery_sync
          ? {
            manifest_count: result.spec_delivery_sync.summary
              ? result.spec_delivery_sync.summary.manifest_count
              : 0,
            passed: result.spec_delivery_sync.passed === true,
            reason: result.spec_delivery_sync.reason || null
          }
          : null,
        template_compatibility: result.template_diff.compatibility,
        release_gate_preflight: {
          available: result.release_gate_preflight.available,
          blocked: result.release_gate_preflight.blocked,
          latest_tag: result.release_gate_preflight.latest_tag,
          latest_gate_passed: result.release_gate_preflight.latest_gate_passed,
          latest_weekly_ops_runtime_block_rate_percent:
            result.release_gate_preflight.latest_weekly_ops_runtime_block_rate_percent,
          latest_weekly_ops_runtime_ui_mode_violation_total:
            result.release_gate_preflight.latest_weekly_ops_runtime_ui_mode_violation_total,
          latest_weekly_ops_runtime_ui_mode_violation_rate_percent:
            result.release_gate_preflight.latest_weekly_ops_runtime_ui_mode_violation_rate_percent,
          weekly_ops_runtime_block_rate_max_percent:
            result.release_gate_preflight.weekly_ops_runtime_block_rate_max_percent,
          weekly_ops_runtime_ui_mode_violation_total:
            result.release_gate_preflight.weekly_ops_runtime_ui_mode_violation_total,
          weekly_ops_runtime_ui_mode_violation_run_rate_percent:
            result.release_gate_preflight.weekly_ops_runtime_ui_mode_violation_run_rate_percent,
          weekly_ops_runtime_ui_mode_violation_rate_max_percent:
            result.release_gate_preflight.weekly_ops_runtime_ui_mode_violation_rate_max_percent
        }
      });
      const ontologyGateReasons = evaluateAutoHandoffOntologyGateReasons(
        result.policy,
        result.ontology_validation
      );
      if (ontologyGateReasons.length > 0) {
        throw new Error(`handoff ontology validation gate failed: ${ontologyGateReasons.join('; ')}`);
      }
      const specDeliveryGateReasons = evaluateAutoHandoffSpecDeliveryGateReasons(
        result.policy,
        result.spec_delivery_sync
      );
      if (specDeliveryGateReasons.length > 0) {
        throw new Error(`handoff spec delivery sync gate failed: ${specDeliveryGateReasons.join('; ')}`);
      }
      if (
        result.policy.require_spec_delivery_sync !== true &&
        result.spec_delivery_sync &&
        result.spec_delivery_sync.reason !== 'no-manifests' &&
        result.spec_delivery_sync.passed !== true
      ) {
        const advisoryReasons = Array.isArray(result.spec_delivery_sync.violations)
          ? result.spec_delivery_sync.violations
          : [];
        if (advisoryReasons.length > 0) {
          result.warnings.push(
            `spec delivery sync advisory: ${advisoryReasons.join('; ')}`
          );
        }
      }
      const releaseGatePreflightReasons = evaluateAutoHandoffReleaseGatePreflightGateReasons(
        result.policy,
        result.release_gate_preflight
      );
      if (releaseGatePreflightReasons.length > 0) {
        throw new Error(`handoff release gate preflight failed: ${releaseGatePreflightReasons.join('; ')}`);
      }
    } catch (error) {
      failAutoHandoffRunPhase(precheckPhase, error);
      throw error;
    }

    const baselinePhase = beginAutoHandoffRunPhase(result, 'moqui-baseline', 'Moqui template baseline scorecard');
    try {
      result.moqui_baseline = await buildAutoHandoffMoquiBaselineSnapshot(projectPath);
      completeAutoHandoffRunPhase(
        baselinePhase,
        buildAutoHandoffMoquiBaselinePhaseDetails(result.moqui_baseline)
      );
      if (result.moqui_baseline && result.moqui_baseline.status === 'error') {
        result.warnings.push(`moqui baseline generation failed: ${result.moqui_baseline.error || 'unknown error'}`);
      }
      const moquiBaselineGateReasons = evaluateAutoHandoffMoquiBaselineGateReasons(
        result.policy,
        result.moqui_baseline
      );
      if (moquiBaselineGateReasons.length > 0) {
        throw new Error(`handoff moqui baseline gate failed: ${moquiBaselineGateReasons.join('; ')}`);
      }
    } catch (baselineError) {
      failAutoHandoffRunPhase(baselinePhase, baselineError);
      if (!result.moqui_baseline) {
        result.moqui_baseline = {
          status: 'error',
          generated: false,
          error: baselineError && baselineError.message ? baselineError.message : `${baselineError}`
        };
      }
      throw baselineError;
    }

    const sceneBatchPhase = beginAutoHandoffRunPhase(
      result,
      'scene-package-batch',
      'Scene package publish-batch dry-run gate'
    );
    try {
      result.scene_package_batch = await buildAutoHandoffScenePackageBatchSnapshot(
        projectPath,
        result.manifest_path
      );
      completeAutoHandoffRunPhase(
        sceneBatchPhase,
        buildAutoHandoffScenePackageBatchPhaseDetails(result.scene_package_batch)
      );
      if (result.scene_package_batch && result.scene_package_batch.status === 'error') {
        result.warnings.push(
          `scene package publish-batch dry-run failed: ${result.scene_package_batch.error || 'unknown error'}`
        );
      }
      const sceneBatchGateReasons = evaluateAutoHandoffScenePackageBatchGateReasons(
        result.policy,
        result.scene_package_batch
      );
      if (sceneBatchGateReasons.length > 0) {
        throw new Error(`handoff scene package batch gate failed: ${sceneBatchGateReasons.join('; ')}`);
      }
    } catch (sceneBatchError) {
      failAutoHandoffRunPhase(sceneBatchPhase, sceneBatchError);
      if (!result.scene_package_batch) {
        result.scene_package_batch = {
          status: 'error',
          generated: false,
          error: sceneBatchError && sceneBatchError.message ? sceneBatchError.message : `${sceneBatchError}`
        };
      }
      throw sceneBatchError;
    }

    const capabilityCoveragePhase = beginAutoHandoffRunPhase(
      result,
      'moqui-capability-coverage',
      'Moqui capability coverage matrix'
    );
    try {
      result.moqui_capability_coverage = await buildAutoHandoffCapabilityCoverageSnapshot(
        projectPath,
        result.handoff,
        result.policy
      );
      completeAutoHandoffRunPhase(capabilityCoveragePhase, {
        status: result.moqui_capability_coverage.status || 'unknown',
        coverage_percent: Number.isFinite(
          Number(
            result.moqui_capability_coverage &&
            result.moqui_capability_coverage.summary
              ? result.moqui_capability_coverage.summary.coverage_percent
              : null
          )
        )
          ? Number(result.moqui_capability_coverage.summary.coverage_percent)
          : null,
        passed: Boolean(
          result.moqui_capability_coverage &&
          result.moqui_capability_coverage.summary &&
          result.moqui_capability_coverage.summary.passed === true
        )
      });
      const capabilityCoverageGateReasons = evaluateAutoHandoffCapabilityCoverageGateReasons(
        result.policy,
        result.moqui_capability_coverage
      );
      if (capabilityCoverageGateReasons.length > 0) {
        throw new Error(`handoff capability coverage gate failed: ${capabilityCoverageGateReasons.join('; ')}`);
      }
      const capabilityLexiconGateReasons = evaluateAutoHandoffCapabilityLexiconGateReasons(
        result.policy,
        result.moqui_capability_coverage
      );
      if (capabilityLexiconGateReasons.length > 0) {
        throw new Error(`handoff capability lexicon gate failed: ${capabilityLexiconGateReasons.join('; ')}`);
      }
    } catch (capabilityCoverageError) {
      failAutoHandoffRunPhase(capabilityCoveragePhase, capabilityCoverageError);
      if (!result.moqui_capability_coverage) {
        result.moqui_capability_coverage = {
          status: 'error',
          generated: false,
          error: capabilityCoverageError && capabilityCoverageError.message
            ? capabilityCoverageError.message
            : `${capabilityCoverageError}`
        };
      }
      throw capabilityCoverageError;
    }

    const queuePhase = beginAutoHandoffRunPhase(result, 'queue', 'Queue generation');
    let queue = null;
    try {
      if (options.continueFrom) {
        queue = await buildAutoHandoffQueueFromContinueSource(projectPath, plan, options);
      } else {
        queue = await buildAutoHandoffQueue(projectPath, {
          manifest: options.manifest,
          out: options.queueOut,
          append: options.append,
          includeKnownGaps: options.includeKnownGaps,
          dryRun: options.dryRun
        });
      }
      if (!queue.dry_run) {
        await writeAutoHandoffQueueFile(projectPath, queue, {
          out: options.queueOut,
          append: options.append
        });
      }
      result.queue = {
        goal_count: queue.goal_count,
        include_known_gaps: queue.include_known_gaps,
        output_file: queue.output_file || null,
        dependency_batching: result.policy.dependency_batching,
        resumed_from: queue.resumed_from || null
      };
      result.continued_from = queue.resumed_from || null;
      completeAutoHandoffRunPhase(queuePhase, {
        goal_count: queue.goal_count,
        output_file: queue.output_file || null,
        resumed_from: queue.resumed_from
          ? {
            session_id: queue.resumed_from.session_id,
            strategy: queue.resumed_from.strategy
          }
          : null
      });
    } catch (error) {
      failAutoHandoffRunPhase(queuePhase, error);
      throw error;
    }

    const continuationBaselineSummary = queue && queue.resume_context && queue.resume_context.previous_batch_summary
      ? queue.resume_context.previous_batch_summary
      : null;

    if (result.dry_run) {
      skipAutoHandoffRunPhase(result, 'execution', 'Autonomous close-loop-batch', 'dry-run');
      skipAutoHandoffRunPhase(result, 'observability', 'Observability snapshot', 'dry-run');
      result.dependency_execution = buildAutoHandoffExecutionBatches(
        result.handoff,
        Array.isArray(queue && queue.goals) ? queue.goals : [],
        result.policy.dependency_batching
      );
      result.spec_status = buildAutoHandoffSpecStatus(
        result.handoff && Array.isArray(result.handoff.specs) ? result.handoff.specs : [],
        null,
        continuationBaselineSummary
      );
      result.gates = evaluateAutoHandoffRunGates({
        policy: result.policy,
        dryRun: true,
        specStatus: result.spec_status,
        ontology: result.ontology_validation,
        moquiBaseline: result.moqui_baseline,
        scenePackageBatch: result.scene_package_batch,
        capabilityCoverage: result.moqui_capability_coverage,
        programKpi: {
          risk_level: 'low'
        }
      });
      result.status = 'dry-run';
      return result;
    }

    const executionPhase = beginAutoHandoffRunPhase(result, 'execution', 'Autonomous close-loop-batch');
    let executionResult = null;
    try {
      executionResult = await executeAutoHandoffExecutionBatches(projectPath, result.handoff, queue, {
        queueOut: options.queueOut,
        continueOnError: options.continueOnError,
        batchAutonomous: options.batchAutonomous,
        batchParallel: options.batchParallel,
        batchAgentBudget: options.batchAgentBudget,
        batchRetryRounds: options.batchRetryRounds,
        batchRetryUntilComplete: options.batchRetryUntilComplete,
        batchRetryMaxRounds: options.batchRetryMaxRounds,
        dependencyBatching: result.policy.dependency_batching
      });
      result.dependency_execution = executionResult.execution_plan;
      result.batch_summary = executionResult.summary;
      result.spec_status = buildAutoHandoffSpecStatus(
        result.handoff && Array.isArray(result.handoff.specs) ? result.handoff.specs : [],
        result.batch_summary,
        continuationBaselineSummary
      );
      completeAutoHandoffRunPhase(executionPhase, {
        status: result.batch_summary.status,
        processed_goals: result.batch_summary.processed_goals,
        failed_goals: result.batch_summary.failed_goals,
        execution_batches: Array.isArray(executionResult.execution_batches)
          ? executionResult.execution_batches.length
          : 0
      });
    } catch (error) {
      failAutoHandoffRunPhase(executionPhase, error);
      throw error;
    }

    const observabilityPhase = beginAutoHandoffRunPhase(result, 'observability', 'Observability snapshot');
    try {
      result.observability_snapshot = await buildAutoObservabilitySnapshot(projectPath, options);
      const observabilityWeeklyOps = extractAutoObservabilityWeeklyOpsStopTelemetry(result.observability_snapshot);
      completeAutoHandoffRunPhase(observabilityPhase, {
        risk_level: result.observability_snapshot && result.observability_snapshot.highlights
          ? result.observability_snapshot.highlights.governance_risk_level
          : null,
        weekly_ops_stop_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.sessions
        ) || 0,
        weekly_ops_high_pressure_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.high_pressure_sessions
        ) || 0,
        weekly_ops_config_warning_positive_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.config_warning_positive_sessions
        ) || 0,
        weekly_ops_auth_tier_pressure_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.auth_tier_pressure_sessions
        ) || 0,
        weekly_ops_dialogue_authorization_pressure_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.dialogue_authorization_pressure_sessions
        ) || 0,
        weekly_ops_runtime_block_rate_high_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.runtime_block_rate_high_sessions
        ) || 0,
        weekly_ops_runtime_ui_mode_violation_high_sessions: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.runtime_ui_mode_violation_high_sessions
        ) || 0,
        weekly_ops_runtime_ui_mode_violation_total_sum: Number(
          observabilityWeeklyOps && observabilityWeeklyOps.runtime_ui_mode_violation_total_sum
        ) || 0
      });
    } catch (error) {
      failAutoHandoffRunPhase(observabilityPhase, error);
      throw error;
    }

    result.gates = evaluateAutoHandoffRunGates({
      policy: result.policy,
      dryRun: false,
      specStatus: result.spec_status,
      ontology: result.ontology_validation,
      moquiBaseline: result.moqui_baseline,
      scenePackageBatch: result.scene_package_batch,
      capabilityCoverage: result.moqui_capability_coverage,
      programKpi: buildProgramKpiSnapshot(result.batch_summary || {})
    });
    if (!result.gates.passed) {
      throw new Error(`handoff run gate failed: ${result.gates.reasons.join('; ')}`);
    }
    result.status = 'completed';
  } catch (error) {
    result.status = 'failed';
    result.error = error && error.message ? error.message : `${error}`;
  } finally {
    result.completed_at = new Date().toISOString();
    result.elapsed_ms = Math.max(0, Date.now() - startedAtMs);
    result.regression = await buildAutoHandoffRegression(projectPath, result);
    result.remediation_queue = await maybeWriteAutoHandoffMoquiRemediationQueue(projectPath, result);
    result.failure_summary = buildAutoHandoffRunFailureSummary(result);
    result.recommendations = buildAutoHandoffRunRecommendations(projectPath, result);
    await writeAutoHandoffRunReport(projectPath, result, options.out);
    if (result.dry_run) {
      result.release_evidence = {
        mode: 'auto-handoff-release-evidence',
        merged: false,
        skipped: true,
        reason: 'dry-run',
        file: path.join(projectPath, AUTO_HANDOFF_RELEASE_EVIDENCE_FILE)
      };
    } else {
      try {
        result.release_evidence = await mergeAutoHandoffRunIntoReleaseEvidence(projectPath, result, result.output_file);
      } catch (mergeError) {
        const message = mergeError && mergeError.message ? mergeError.message : `${mergeError}`;
        result.release_evidence = {
          mode: 'auto-handoff-release-evidence',
          merged: false,
          file: path.join(projectPath, AUTO_HANDOFF_RELEASE_EVIDENCE_FILE),
          error: message
        };
        result.warnings.push(`release evidence merge failed: ${message}`);
      }
    }
    try {
      await writeAutoHandoffRunReport(projectPath, result, options.out);
    } catch (refreshError) {
      const message = refreshError && refreshError.message ? refreshError.message : `${refreshError}`;
      result.warnings.push(`handoff run report refresh failed: ${message}`);
    }
  }

  return result;
}

module.exports = {
  runAutoHandoff
};
