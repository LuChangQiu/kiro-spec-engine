const path = require('path');

function buildAutoHandoffReleaseGateHistoryEntry(entry = {}, options = {}, dependencies = {}) {
  const { parseAutoHandoffGateSignalsMap, normalizeHandoffText, parseAutoHandoffReleaseGateTag, parseAutoHandoffGateBoolean, normalizeAutoHandoffGateRiskLevel, parseAutoHandoffGateNumber, toPortablePath } = dependencies;
  const projectPath = options.projectPath || process.cwd();
  const sourceFile = typeof options.file === 'string' && options.file.trim()
    ? options.file.trim()
    : null;
  const signalMap = parseAutoHandoffGateSignalsMap(entry.signals);
  const derivedTag = normalizeHandoffText(options.tag)
    || (sourceFile ? parseAutoHandoffReleaseGateTag(path.basename(sourceFile)) : null)
    || normalizeHandoffText(entry.tag);
  const gatePassed = parseAutoHandoffGateBoolean(
    entry.gate_passed !== undefined ? entry.gate_passed : signalMap.gate_passed,
    null
  );
  const riskLevel = normalizeAutoHandoffGateRiskLevel(
    normalizeHandoffText(entry.risk_level) || signalMap.risk_level
  );
  const specSuccessRate = parseAutoHandoffGateNumber(
    entry.spec_success_rate_percent !== undefined
      ? entry.spec_success_rate_percent
      : signalMap.spec_success_rate
  );
  const sceneBatchStatus = normalizeHandoffText(
    entry.scene_package_batch_status !== undefined
      ? entry.scene_package_batch_status
      : signalMap.scene_package_batch_status
  );
  let sceneBatchPassed = parseAutoHandoffGateBoolean(
    entry.scene_package_batch_passed !== undefined
      ? entry.scene_package_batch_passed
      : signalMap.scene_package_batch_passed,
    null
  );
  if (sceneBatchPassed === null && sceneBatchStatus && sceneBatchStatus !== 'skipped') {
    sceneBatchPassed = sceneBatchStatus === 'passed';
  }
  const sceneBatchFailureCount = parseAutoHandoffGateNumber(
    entry.scene_package_batch_failure_count !== undefined
      ? entry.scene_package_batch_failure_count
      : signalMap.scene_package_batch_failure_count
  );
  const capabilityExpectedUnknownCount = parseAutoHandoffGateNumber(
    entry.capability_expected_unknown_count !== undefined
      ? entry.capability_expected_unknown_count
      : (
        signalMap.capability_expected_unknown_count !== undefined
          ? signalMap.capability_expected_unknown_count
          : signalMap.capability_lexicon_expected_unknown_count
      )
  );
  const capabilityProvidedUnknownCount = parseAutoHandoffGateNumber(
    entry.capability_provided_unknown_count !== undefined
      ? entry.capability_provided_unknown_count
      : (
        signalMap.capability_provided_unknown_count !== undefined
          ? signalMap.capability_provided_unknown_count
          : signalMap.capability_lexicon_provided_unknown_count
      )
  );
  const releaseGatePreflightAvailable = parseAutoHandoffGateBoolean(
    entry.release_gate_preflight_available !== undefined
      ? entry.release_gate_preflight_available
      : signalMap.release_gate_preflight_available,
    null
  );
  const releaseGatePreflightBlocked = parseAutoHandoffGateBoolean(
    entry.release_gate_preflight_blocked !== undefined
      ? entry.release_gate_preflight_blocked
      : signalMap.release_gate_preflight_blocked,
    null
  );
  const requireReleaseGatePreflight = parseAutoHandoffGateBoolean(
    entry.require_release_gate_preflight !== undefined
      ? entry.require_release_gate_preflight
      : (
        signalMap.require_release_gate_preflight !== undefined
          ? signalMap.require_release_gate_preflight
          : signalMap.release_gate_preflight_hard_gate
      ),
    null
  );
  const drift = entry && typeof entry.drift === 'object' && !Array.isArray(entry.drift)
    ? entry.drift
    : {};
  const driftAlerts = Array.isArray(drift.alerts)
    ? drift.alerts
      .map(item => `${item || ''}`.trim())
      .filter(Boolean)
    : [];
  const hasDriftAlertSource = (
    entry.drift_alert_count !== undefined
    || drift.alert_count !== undefined
    || Array.isArray(drift.alerts)
  );
  const driftAlertCount = hasDriftAlertSource
    ? parseAutoHandoffGateNumber(
      entry.drift_alert_count !== undefined
        ? entry.drift_alert_count
        : (drift.alert_count !== undefined ? drift.alert_count : driftAlerts.length)
    )
    : null;
  const driftBlocked = parseAutoHandoffGateBoolean(
    entry.drift_blocked !== undefined
      ? entry.drift_blocked
      : drift.blocked,
    null
  );
  const driftEnforce = parseAutoHandoffGateBoolean(
    entry.drift_enforce !== undefined
      ? entry.drift_enforce
      : drift.enforce,
    null
  );
  const driftEvaluatedAt = normalizeHandoffText(
    entry.drift_evaluated_at !== undefined
      ? entry.drift_evaluated_at
      : drift.evaluated_at
  );
  const weeklyOps = entry && typeof entry.weekly_ops === 'object' && !Array.isArray(entry.weekly_ops)
    ? entry.weekly_ops
    : {};
  const weeklyOpsSignals = weeklyOps && typeof weeklyOps.signals === 'object' && !Array.isArray(weeklyOps.signals)
    ? weeklyOps.signals
    : {};
  const weeklyOpsViolations = Array.isArray(weeklyOps.violations)
    ? weeklyOps.violations.map(item => `${item}`)
    : [];
  const weeklyOpsWarnings = Array.isArray(weeklyOps.warnings)
    ? weeklyOps.warnings.map(item => `${item}`)
    : [];
  const weeklyOpsConfigWarnings = Array.isArray(weeklyOps.config_warnings)
    ? weeklyOps.config_warnings.map(item => `${item}`)
    : [];
  const weeklyOpsAvailable = parseAutoHandoffGateBoolean(entry.weekly_ops_available, null) === true
    || Object.keys(weeklyOps).length > 0;
  const weeklyOpsBlocked = parseAutoHandoffGateBoolean(
    entry.weekly_ops_blocked !== undefined
      ? entry.weekly_ops_blocked
      : weeklyOps.blocked,
    null
  );
  const weeklyOpsRiskRaw = normalizeHandoffText(
    entry.weekly_ops_risk_level !== undefined
      ? entry.weekly_ops_risk_level
      : weeklyOpsSignals.risk
  );
  const weeklyOpsRiskLevel = weeklyOpsRiskRaw
    ? normalizeAutoHandoffGateRiskLevel(weeklyOpsRiskRaw)
    : null;
  const weeklyOpsGovernanceStatus = normalizeHandoffText(
    entry.weekly_ops_governance_status !== undefined
      ? entry.weekly_ops_governance_status
      : weeklyOpsSignals.governance_status
  ) || null;
  const weeklyOpsAuthorizationTierBlockRatePercentCandidate = (
    entry.weekly_ops_authorization_tier_block_rate_percent !== undefined
      ? entry.weekly_ops_authorization_tier_block_rate_percent
      : weeklyOpsSignals.authorization_tier_block_rate_percent
  );
  const weeklyOpsDialogueAuthorizationBlockRatePercentCandidate = (
    entry.weekly_ops_dialogue_authorization_block_rate_percent !== undefined
      ? entry.weekly_ops_dialogue_authorization_block_rate_percent
      : weeklyOpsSignals.dialogue_authorization_block_rate_percent
  );
  const weeklyOpsMatrixRegressionPositiveRatePercentCandidate = (
    entry.weekly_ops_matrix_regression_positive_rate_percent !== undefined
      ? entry.weekly_ops_matrix_regression_positive_rate_percent
      : weeklyOpsSignals.matrix_regression_positive_rate_percent
  );
  const weeklyOpsRuntimeBlockRatePercentCandidate = (
    entry.weekly_ops_runtime_block_rate_percent !== undefined
      ? entry.weekly_ops_runtime_block_rate_percent
      : weeklyOpsSignals.runtime_block_rate_percent
  );
  const weeklyOpsRuntimeUiModeViolationTotalCandidate = (
    entry.weekly_ops_runtime_ui_mode_violation_total !== undefined
      ? entry.weekly_ops_runtime_ui_mode_violation_total
      : weeklyOpsSignals.runtime_ui_mode_violation_total
  );
  const weeklyOpsRuntimeUiModeViolationRatePercentCandidate = (
    entry.weekly_ops_runtime_ui_mode_violation_rate_percent !== undefined
      ? entry.weekly_ops_runtime_ui_mode_violation_rate_percent
      : weeklyOpsSignals.runtime_ui_mode_violation_rate_percent
  );
  const weeklyOpsViolationsCountCandidate = (
    entry.weekly_ops_violations_count !== undefined
      ? entry.weekly_ops_violations_count
      : (
        weeklyOps.violations_count !== undefined
          ? weeklyOps.violations_count
          : (weeklyOpsAvailable ? weeklyOpsViolations.length : null)
      )
  );
  const weeklyOpsWarningCountCandidate = (
    entry.weekly_ops_warning_count !== undefined
      ? entry.weekly_ops_warning_count
      : (
        weeklyOps.warning_count !== undefined
          ? weeklyOps.warning_count
          : (weeklyOpsAvailable ? weeklyOpsWarnings.length : null)
      )
  );
  const weeklyOpsConfigWarningCountCandidate = (
    entry.weekly_ops_config_warning_count !== undefined
      ? entry.weekly_ops_config_warning_count
      : (
        weeklyOps.config_warning_count !== undefined
          ? weeklyOps.config_warning_count
          : (weeklyOpsAvailable ? weeklyOpsConfigWarnings.length : null)
      )
  );
  const weeklyOpsAuthorizationTierBlockRatePercent = (
    weeklyOpsAuthorizationTierBlockRatePercentCandidate === null
    || weeklyOpsAuthorizationTierBlockRatePercentCandidate === undefined
    || weeklyOpsAuthorizationTierBlockRatePercentCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsAuthorizationTierBlockRatePercentCandidate);
  const weeklyOpsDialogueAuthorizationBlockRatePercent = (
    weeklyOpsDialogueAuthorizationBlockRatePercentCandidate === null
    || weeklyOpsDialogueAuthorizationBlockRatePercentCandidate === undefined
    || weeklyOpsDialogueAuthorizationBlockRatePercentCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsDialogueAuthorizationBlockRatePercentCandidate);
  const weeklyOpsMatrixRegressionPositiveRatePercent = (
    weeklyOpsMatrixRegressionPositiveRatePercentCandidate === null
    || weeklyOpsMatrixRegressionPositiveRatePercentCandidate === undefined
    || weeklyOpsMatrixRegressionPositiveRatePercentCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsMatrixRegressionPositiveRatePercentCandidate);
  const weeklyOpsRuntimeBlockRatePercent = (
    weeklyOpsRuntimeBlockRatePercentCandidate === null
    || weeklyOpsRuntimeBlockRatePercentCandidate === undefined
    || weeklyOpsRuntimeBlockRatePercentCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsRuntimeBlockRatePercentCandidate);
  const weeklyOpsRuntimeUiModeViolationTotal = (
    weeklyOpsRuntimeUiModeViolationTotalCandidate === null
    || weeklyOpsRuntimeUiModeViolationTotalCandidate === undefined
    || weeklyOpsRuntimeUiModeViolationTotalCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsRuntimeUiModeViolationTotalCandidate);
  const weeklyOpsRuntimeUiModeViolationRatePercent = (
    weeklyOpsRuntimeUiModeViolationRatePercentCandidate === null
    || weeklyOpsRuntimeUiModeViolationRatePercentCandidate === undefined
    || weeklyOpsRuntimeUiModeViolationRatePercentCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsRuntimeUiModeViolationRatePercentCandidate);
  const weeklyOpsViolationsCount = (
    weeklyOpsViolationsCountCandidate === null
    || weeklyOpsViolationsCountCandidate === undefined
    || weeklyOpsViolationsCountCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsViolationsCountCandidate);
  const weeklyOpsWarningCount = (
    weeklyOpsWarningCountCandidate === null
    || weeklyOpsWarningCountCandidate === undefined
    || weeklyOpsWarningCountCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsWarningCountCandidate);
  const weeklyOpsConfigWarningCount = (
    weeklyOpsConfigWarningCountCandidate === null
    || weeklyOpsConfigWarningCountCandidate === undefined
    || weeklyOpsConfigWarningCountCandidate === ''
  )
    ? null
    : parseAutoHandoffGateNumber(weeklyOpsConfigWarningCountCandidate);
  const violations = Array.isArray(entry.violations)
    ? entry.violations.map(item => `${item}`)
    : [];
  const configWarnings = Array.isArray(entry.config_warnings)
    ? entry.config_warnings.map(item => `${item}`)
    : [];
  const signals = Array.isArray(entry.signals)
    ? entry.signals.map(item => `${item}`)
    : [];
  const thresholds = entry.thresholds && typeof entry.thresholds === 'object' && !Array.isArray(entry.thresholds)
    ? { ...entry.thresholds }
    : {};
  const evaluatedAt = normalizeHandoffText(
    entry.evaluated_at || entry.generated_at || entry.updated_at
  );
  const mode = normalizeHandoffText(entry.mode);
  const enforce = parseAutoHandoffGateBoolean(entry.enforce, false);
  const evidenceUsed = parseAutoHandoffGateBoolean(entry.evidence_used, false);
  const requireEvidence = parseAutoHandoffGateBoolean(entry.require_evidence, false);
  const requireGatePass = parseAutoHandoffGateBoolean(entry.require_gate_pass, true);
  const summaryFile = normalizeHandoffText(entry.summary_file);
  const portableFile = sourceFile
    ? toPortablePath(projectPath, sourceFile)
    : normalizeHandoffText(entry.file);
  const violationsCount = Number.isInteger(entry.violations_count)
    ? entry.violations_count
    : violations.length;
  const configWarningCount = Number.isInteger(entry.config_warning_count)
    ? entry.config_warning_count
    : configWarnings.length;

  return {
    tag: derivedTag,
    evaluated_at: evaluatedAt,
    gate_passed: gatePassed,
    mode,
    enforce,
    evidence_used: evidenceUsed,
    require_evidence: requireEvidence,
    require_gate_pass: requireGatePass,
    risk_level: riskLevel,
    spec_success_rate_percent: specSuccessRate,
    scene_package_batch_status: sceneBatchStatus || null,
    scene_package_batch_passed: typeof sceneBatchPassed === 'boolean' ? sceneBatchPassed : null,
    scene_package_batch_failure_count: Number.isFinite(sceneBatchFailureCount) ? sceneBatchFailureCount : null,
    capability_expected_unknown_count: Number.isFinite(capabilityExpectedUnknownCount)
      ? Math.max(0, Number(capabilityExpectedUnknownCount))
      : null,
    capability_provided_unknown_count: Number.isFinite(capabilityProvidedUnknownCount)
      ? Math.max(0, Number(capabilityProvidedUnknownCount))
      : null,
    release_gate_preflight_available: typeof releaseGatePreflightAvailable === 'boolean'
      ? releaseGatePreflightAvailable
      : null,
    release_gate_preflight_blocked: typeof releaseGatePreflightBlocked === 'boolean'
      ? releaseGatePreflightBlocked
      : null,
    require_release_gate_preflight: typeof requireReleaseGatePreflight === 'boolean'
      ? requireReleaseGatePreflight
      : null,
    drift_alert_count: Number.isFinite(driftAlertCount) ? Math.max(0, Number(driftAlertCount)) : null,
    drift_blocked: typeof driftBlocked === 'boolean' ? driftBlocked : null,
    drift_enforce: typeof driftEnforce === 'boolean' ? driftEnforce : null,
    drift_evaluated_at: driftEvaluatedAt || null,
    weekly_ops_available: weeklyOpsAvailable,
    weekly_ops_blocked: typeof weeklyOpsBlocked === 'boolean' ? weeklyOpsBlocked : null,
    weekly_ops_risk_level: weeklyOpsRiskLevel,
    weekly_ops_governance_status: weeklyOpsGovernanceStatus,
    weekly_ops_authorization_tier_block_rate_percent: Number.isFinite(weeklyOpsAuthorizationTierBlockRatePercent)
      ? weeklyOpsAuthorizationTierBlockRatePercent
      : null,
    weekly_ops_dialogue_authorization_block_rate_percent: Number.isFinite(weeklyOpsDialogueAuthorizationBlockRatePercent)
      ? weeklyOpsDialogueAuthorizationBlockRatePercent
      : null,
    weekly_ops_matrix_regression_positive_rate_percent: Number.isFinite(weeklyOpsMatrixRegressionPositiveRatePercent)
      ? weeklyOpsMatrixRegressionPositiveRatePercent
      : null,
    weekly_ops_runtime_block_rate_percent: Number.isFinite(weeklyOpsRuntimeBlockRatePercent)
      ? weeklyOpsRuntimeBlockRatePercent
      : null,
    weekly_ops_runtime_ui_mode_violation_total: Number.isFinite(weeklyOpsRuntimeUiModeViolationTotal)
      ? Math.max(0, Number(weeklyOpsRuntimeUiModeViolationTotal))
      : null,
    weekly_ops_runtime_ui_mode_violation_rate_percent: Number.isFinite(weeklyOpsRuntimeUiModeViolationRatePercent)
      ? Math.max(0, Number(weeklyOpsRuntimeUiModeViolationRatePercent))
      : null,
    weekly_ops_violations_count: Number.isFinite(weeklyOpsViolationsCount)
      ? Math.max(0, Number(weeklyOpsViolationsCount))
      : null,
    weekly_ops_warning_count: Number.isFinite(weeklyOpsWarningCount)
      ? Math.max(0, Number(weeklyOpsWarningCount))
      : null,
    weekly_ops_config_warning_count: Number.isFinite(weeklyOpsConfigWarningCount)
      ? Math.max(0, Number(weeklyOpsConfigWarningCount))
      : null,
    violations_count: Math.max(0, Number(violationsCount) || 0),
    config_warning_count: Math.max(0, Number(configWarningCount) || 0),
    thresholds,
    summary_file: summaryFile,
    file: portableFile,
    signals,
    violations,
    config_warnings: configWarnings
  };
}

async function loadAutoHandoffReleaseGateReports(projectPath, dirCandidate = null, dependencies = {}) {
  const { resolveAutoHandoffReleaseEvidenceDir, fs, parseAutoHandoffReleaseGateTag, buildAutoHandoffReleaseGateHistoryEntry } = dependencies;
  const dirPath = resolveAutoHandoffReleaseEvidenceDir(projectPath, dirCandidate);
  const warnings = [];
  if (!(await fs.pathExists(dirPath))) {
    return {
      dir: dirPath,
      report_files: [],
      entries: [],
      warnings
    };
  }

  const names = await fs.readdir(dirPath);
  const reportFiles = names
    .filter(name => {
      if (typeof name !== 'string') {
        return false;
      }
      const lowered = name.trim().toLowerCase();
      if (!lowered.startsWith('release-gate-') || !lowered.endsWith('.json')) {
        return false;
      }
      if (lowered === 'release-gate-history.json') {
        return false;
      }
      if (lowered.startsWith('release-gate-history-')) {
        return false;
      }
      return parseAutoHandoffReleaseGateTag(name) !== null;
    })
    .map(name => path.join(dirPath, name));

  const entries = [];
  for (const reportFile of reportFiles) {
    let payload = null;
    try {
      payload = await fs.readJson(reportFile);
    } catch (error) {
      warnings.push(`skip invalid release gate report: ${reportFile} (${error.message})`);
      continue;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      warnings.push(`skip invalid release gate payload: ${reportFile}`);
      continue;
    }
    try {
      entries.push(buildAutoHandoffReleaseGateHistoryEntry(
        payload,
        {
          projectPath,
          file: reportFile,
          tag: parseAutoHandoffReleaseGateTag(path.basename(reportFile))
        },
        dependencies
      ));
    } catch (error) {
      warnings.push(`skip invalid release gate report entry: ${reportFile} (${error.message})`);
    }
  }

  return {
    dir: dirPath,
    report_files: reportFiles,
    entries,
    warnings
  };
}

async function loadAutoHandoffReleaseGateHistorySeed(projectPath, fileCandidate = null, dependencies = {}) {
  const { resolveAutoHandoffReleaseGateHistoryFile, fs, buildAutoHandoffReleaseGateHistoryEntry } = dependencies;
  const filePath = resolveAutoHandoffReleaseGateHistoryFile(projectPath, fileCandidate);
  if (!(await fs.pathExists(filePath))) {
    return {
      file: filePath,
      entries: [],
      warnings: []
    };
  }

  let payload = null;
  try {
    payload = await fs.readJson(filePath);
  } catch (error) {
    return {
      file: filePath,
      entries: [],
      warnings: [`skip invalid gate history file: ${filePath} (${error.message})`]
    };
  }
  const list = Array.isArray(payload && payload.entries) ? payload.entries : [];
  const warnings = [];
  const entries = [];
  list
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .forEach((item, index) => {
      try {
        entries.push(buildAutoHandoffReleaseGateHistoryEntry(item, { projectPath }, dependencies));
      } catch (error) {
        warnings.push(`skip invalid gate history entry #${index + 1}: ${error.message}`);
      }
    });
  return {
    file: filePath,
    entries,
    warnings
  };
}

function mergeAutoHandoffReleaseGateHistoryEntries(entries = [], dependencies = {}) {
  const { normalizeHandoffText, toAutoHandoffTimestamp } = dependencies;
  const merged = new Map();
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const key = normalizeHandoffText(entry.tag)
      || normalizeHandoffText(entry.file)
      || `entry-${index}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, entry);
      return;
    }
    const prevTs = toAutoHandoffTimestamp(previous.evaluated_at);
    const nextTs = toAutoHandoffTimestamp(entry.evaluated_at);
    if (nextTs >= prevTs) {
      merged.set(key, entry);
    }
  });
  return Array.from(merged.values());
}

module.exports = {
  buildAutoHandoffReleaseGateHistoryEntry,
  loadAutoHandoffReleaseGateReports,
  loadAutoHandoffReleaseGateHistorySeed,
  mergeAutoHandoffReleaseGateHistoryEntries
};

