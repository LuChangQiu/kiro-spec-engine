const path = require('path');
const fs = require('fs-extra');

const PROBLEM_EVAL_API_VERSION = 'sce.problem-eval/v0.1';
const DEFAULT_POLICY_PATH = '.sce/config/problem-eval-policy.json';
const DEFAULT_REPORT_DIR = '.sce/reports/problem-eval';
const STUDIO_STAGES = Object.freeze(['plan', 'generate', 'apply', 'verify', 'release']);
const DEBUG_EVIDENCE_TAGS = Object.freeze(['debug-evidence', 'diagnostic-evidence', 'debug-log']);

const DEFAULT_PROBLEM_EVAL_POLICY = Object.freeze({
  schema_version: '1.0',
  enabled: true,
  mode: 'required',
  enforce_on_stages: [...STUDIO_STAGES],
  block_on_stages: ['apply', 'release'],
  min_confidence_by_stage: {
    plan: 20,
    generate: 25,
    apply: 30,
    verify: 35,
    release: 40
  },
  high_risk_requires_debug_evidence: true,
  high_risk_keywords: [
    'auth',
    'payment',
    'security',
    'delete',
    'rollback',
    'production',
    'migrate',
    'compliance',
    'data-loss'
  ],
  recommendation_limit: 6
});

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeLowerText(`${value || ''}`);
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function normalizeArray(value = []) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function normalizeIncidentState(value, fallback = 'open') {
  const normalized = normalizeLowerText(value);
  if (!normalized) {
    return fallback;
  }
  if (normalized === 'open' || normalized === 'resolved') {
    return normalized;
  }
  return fallback;
}

function hasDebugEvidenceInAttempt(attempt = {}) {
  const tags = normalizeArray(attempt.tags).map((item) => item.toLowerCase());
  if (tags.some((tag) => DEBUG_EVIDENCE_TAGS.includes(tag))) {
    return true;
  }
  const verification = normalizeArray(attempt.verification_evidence);
  if (verification.some((item) => /^debug:/i.test(item))) {
    return true;
  }
  const notes = normalizeLowerText(attempt.notes);
  if (notes && /(debug|trace|diagnostic|observability|telemetry|日志|埋点|观测)/i.test(notes)) {
    return true;
  }
  return false;
}

function normalizePolicy(policy = {}, env = process.env) {
  const envMode = normalizeLowerText(env.SCE_PROBLEM_EVAL_MODE);
  const envDisabled = normalizeBoolean(env.SCE_PROBLEM_EVAL_DISABLED, false);
  const mode = envMode === 'off' || envMode === 'advisory' || envMode === 'required'
    ? envMode
    : normalizeLowerText(policy.mode) || DEFAULT_PROBLEM_EVAL_POLICY.mode;
  const enabled = envDisabled
    ? false
    : mode === 'off'
      ? false
      : normalizeBoolean(policy.enabled, DEFAULT_PROBLEM_EVAL_POLICY.enabled);
  const minByStage = {
    ...DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage,
    ...(policy.min_confidence_by_stage && typeof policy.min_confidence_by_stage === 'object'
      ? policy.min_confidence_by_stage
      : {})
  };

  const normalized = {
    schema_version: normalizeText(policy.schema_version) || DEFAULT_PROBLEM_EVAL_POLICY.schema_version,
    enabled,
    mode: mode || DEFAULT_PROBLEM_EVAL_POLICY.mode,
    enforce_on_stages: normalizeArray(policy.enforce_on_stages).length > 0
      ? normalizeArray(policy.enforce_on_stages).map((item) => item.toLowerCase())
      : [...DEFAULT_PROBLEM_EVAL_POLICY.enforce_on_stages],
    block_on_stages: normalizeArray(policy.block_on_stages).length > 0
      ? normalizeArray(policy.block_on_stages).map((item) => item.toLowerCase())
      : [...DEFAULT_PROBLEM_EVAL_POLICY.block_on_stages],
    min_confidence_by_stage: {
      plan: normalizeInteger(minByStage.plan, DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage.plan, 0, 100),
      generate: normalizeInteger(minByStage.generate, DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage.generate, 0, 100),
      apply: normalizeInteger(minByStage.apply, DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage.apply, 0, 100),
      verify: normalizeInteger(minByStage.verify, DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage.verify, 0, 100),
      release: normalizeInteger(minByStage.release, DEFAULT_PROBLEM_EVAL_POLICY.min_confidence_by_stage.release, 0, 100)
    },
    high_risk_requires_debug_evidence: normalizeBoolean(
      policy.high_risk_requires_debug_evidence,
      DEFAULT_PROBLEM_EVAL_POLICY.high_risk_requires_debug_evidence
    ),
    high_risk_keywords: normalizeArray(policy.high_risk_keywords).length > 0
      ? normalizeArray(policy.high_risk_keywords).map((item) => item.toLowerCase())
      : [...DEFAULT_PROBLEM_EVAL_POLICY.high_risk_keywords],
    recommendation_limit: normalizeInteger(
      policy.recommendation_limit,
      DEFAULT_PROBLEM_EVAL_POLICY.recommendation_limit,
      1,
      20
    )
  };

  return normalized;
}

async function loadProblemEvalPolicy(projectPath = process.cwd(), fileSystem = fs, env = process.env) {
  const policyPath = path.join(projectPath, DEFAULT_POLICY_PATH);
  let payload = {};
  if (await fileSystem.pathExists(policyPath)) {
    try {
      payload = await fileSystem.readJson(policyPath);
    } catch (error) {
      throw new Error(`Failed to read problem-eval policy: ${error.message}`);
    }
  }

  const policy = normalizePolicy(payload, env);
  return {
    policy_path: policyPath,
    policy
  };
}

function scoreRisk(stage, text, policy, incidentSignals = {}, releaseChannel = '') {
  let score = 0;
  const signals = [];
  const keywords = Array.isArray(policy.high_risk_keywords) ? policy.high_risk_keywords : [];
  let keywordHits = 0;
  for (const keyword of keywords) {
    if (!keyword) {
      continue;
    }
    if (text.includes(keyword)) {
      keywordHits += 1;
    }
  }
  if (keywordHits > 0) {
    const keywordScore = Math.min(30, keywordHits * 6);
    score += keywordScore;
    signals.push(`high-risk-keywords:${keywordHits}`);
  }

  if (stage === 'release') {
    score += 28;
    signals.push('stage-release');
  } else if (stage === 'verify') {
    score += 18;
    signals.push('stage-verify');
  } else if (stage === 'apply') {
    score += 14;
    signals.push('stage-apply');
  } else if (stage === 'generate') {
    score += 8;
    signals.push('stage-generate');
  }

  if (normalizeLowerText(releaseChannel) === 'prod') {
    score += 18;
    signals.push('channel-prod');
  }

  const openIncidents = Number(incidentSignals.open_incident_count || 0);
  const maxAttempts = Number(incidentSignals.max_attempt_count || 0);
  if (openIncidents > 0) {
    score += Math.min(20, openIncidents * 3);
    signals.push(`open-incidents:${openIncidents}`);
  }
  if (maxAttempts >= 3) {
    score += 16;
    signals.push(`repeat-attempts:${maxAttempts}`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level = 'low';
  if (score >= 70) {
    level = 'high';
  } else if (score >= 40) {
    level = 'medium';
  }

  return { score, level, signals };
}

function scoreEvidence(context = {}, incidentSignals = {}) {
  const signals = [];
  let score = 0;
  const domainChain = context.domain_chain && typeof context.domain_chain === 'object'
    ? context.domain_chain
    : {};
  const summary = domainChain.summary && typeof domainChain.summary === 'object'
    ? domainChain.summary
    : {};

  if (domainChain.resolved === true) {
    score += 20;
    signals.push('domain-chain-resolved');
  }
  const decisionSteps = Number(summary.decision_path_steps || 0);
  if (decisionSteps >= 3) {
    score += 15;
    signals.push(`decision-path:${decisionSteps}`);
  } else if (decisionSteps > 0) {
    score += 8;
    signals.push(`decision-path-partial:${decisionSteps}`);
  }
  const verificationGates = Array.isArray(summary.verification_gates) ? summary.verification_gates.length : 0;
  if (verificationGates > 0) {
    score += Math.min(12, verificationGates * 3);
    signals.push(`verification-gates:${verificationGates}`);
  }
  const relatedSpecsCount = Number(context.related_specs_count || 0);
  if (relatedSpecsCount > 0) {
    score += Math.min(15, 8 + relatedSpecsCount);
    signals.push(`related-specs:${relatedSpecsCount}`);
  }
  if (incidentSignals.has_debug_evidence === true) {
    score += 15;
    signals.push('debug-evidence-present');
  }
  const stageReadiness = context.stage_readiness && typeof context.stage_readiness === 'object'
    ? context.stage_readiness
    : {};
  if (stageReadiness.prerequisites_ready === true) {
    score += 8;
    signals.push('stage-prerequisites-ready');
  }
  if (stageReadiness.rollback_ready === true) {
    score += 10;
    signals.push('rollback-ready');
  }
  if (stageReadiness.gate_required_ready === true) {
    score += 6;
    signals.push('required-gates-available');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, signals };
}

function scoreReadiness(context = {}) {
  const signals = [];
  let score = 0;
  const stageReadiness = context.stage_readiness && typeof context.stage_readiness === 'object'
    ? context.stage_readiness
    : {};

  if (normalizeText(context.scene_id)) {
    score += 20;
    signals.push('scene-defined');
  }
  if (normalizeText(context.goal)) {
    score += 10;
    signals.push('goal-defined');
  }
  if (normalizeText(context.spec_id)) {
    score += 10;
    signals.push('spec-bound');
  }
  if (stageReadiness.prerequisites_ready === true) {
    score += 25;
    signals.push('prerequisites-ready');
  }
  if (stageReadiness.patch_bundle_ready === true) {
    score += 15;
    signals.push('patch-bundle-ready');
  }
  if (stageReadiness.verify_report_ready === true) {
    score += 10;
    signals.push('verify-report-ready');
  }
  const gateSignals = context.gate_signals && typeof context.gate_signals === 'object'
    ? context.gate_signals
    : {};
  const requiredTotal = Number(gateSignals.required_total || 0);
  const requiredEnabled = Number(gateSignals.required_enabled || 0);
  if (requiredTotal > 0) {
    const ratio = requiredEnabled / requiredTotal;
    score += Math.round(Math.max(0, Math.min(10, ratio * 10)));
    signals.push(`gate-availability:${requiredEnabled}/${requiredTotal}`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, signals };
}

function deriveStrategy(stage, risk, evidence, confidence, incidentSignals = {}, policy = DEFAULT_PROBLEM_EVAL_POLICY) {
  const reasons = [];
  let strategy = 'direct-execution';
  if (Number(incidentSignals.max_attempt_count || 0) >= 3
    && policy.high_risk_requires_debug_evidence
    && incidentSignals.has_debug_evidence !== true) {
    strategy = 'debug-first';
    reasons.push('repeated-failures-without-debug-evidence');
    return { strategy, reasons };
  }
  if (risk.level === 'high' && evidence.score < 55) {
    strategy = 'evidence-first';
    reasons.push('high-risk-insufficient-evidence');
    return { strategy, reasons };
  }
  if (confidence < 45) {
    strategy = 'explore-and-validate';
    reasons.push('low-confidence');
    return { strategy, reasons };
  }
  if (stage === 'release' && risk.level !== 'low') {
    strategy = 'controlled-execution';
    reasons.push('release-risk-control');
    return { strategy, reasons };
  }
  reasons.push('confidence-sufficient');
  return { strategy, reasons };
}

function evaluateProblemContext(context = {}, policy = DEFAULT_PROBLEM_EVAL_POLICY) {
  const stage = normalizeLowerText(context.stage);
  if (!STUDIO_STAGES.includes(stage)) {
    throw new Error(`Unsupported problem-eval stage: ${context.stage || 'unknown'}`);
  }

  const textForRisk = [
    normalizeLowerText(context.goal),
    normalizeLowerText(context.scene_id),
    normalizeLowerText(context.spec_id),
    normalizeLowerText(context?.domain_chain?.reason),
    normalizeLowerText(context.release_channel)
  ].join(' ');

  const incidentSignals = context.incident_signals && typeof context.incident_signals === 'object'
    ? context.incident_signals
    : {};
  const risk = scoreRisk(stage, textForRisk, policy, incidentSignals, context.release_channel);
  const evidence = scoreEvidence(context, incidentSignals);
  const readiness = scoreReadiness(context);
  const confidenceScore = Math.max(0, Math.min(100, Math.round(
    evidence.score * 0.45 + readiness.score * 0.35 + (100 - risk.score) * 0.20
  )));

  const minConfidence = Number(policy?.min_confidence_by_stage?.[stage] || 0);
  const strategy = deriveStrategy(stage, risk, evidence, confidenceScore, incidentSignals, policy);
  const blockers = [];
  const warnings = [];

  const enforced = policy.enabled === true && Array.isArray(policy.enforce_on_stages) && policy.enforce_on_stages.includes(stage);
  const blockStage = Array.isArray(policy.block_on_stages) && policy.block_on_stages.includes(stage);
  const advisoryMode = policy.mode === 'advisory';

  if (confidenceScore < minConfidence) {
    warnings.push(`confidence ${confidenceScore} below threshold ${minConfidence}`);
    if (blockStage) {
      blockers.push(`confidence-too-low:${confidenceScore}<${minConfidence}`);
    }
  }

  if (policy.high_risk_requires_debug_evidence
    && risk.level === 'high'
    && Number(incidentSignals.max_attempt_count || 0) >= 3
    && incidentSignals.has_debug_evidence !== true) {
    warnings.push('high risk with repeated failed attempts and no debug evidence');
    if (blockStage) {
      blockers.push('missing-debug-evidence-after-repeated-failures');
    }
  }

  if (evidence.score < 35) {
    warnings.push(`evidence score ${evidence.score} is low`);
    if (blockStage && risk.level === 'high') {
      blockers.push(`high-risk-low-evidence:${evidence.score}`);
    }
  }

  const recommendations = [];
  if (strategy.strategy === 'debug-first') {
    recommendations.push('Capture debug trace/log evidence before the next patch attempt.');
  }
  if (strategy.strategy === 'evidence-first' || evidence.score < 45) {
    recommendations.push('Refresh domain artifacts and verify ontology coverage before execution.');
    recommendations.push('Load related historical specs and compare successful remediation paths.');
  }
  if (risk.level !== 'low') {
    recommendations.push('Prefer guarded execution with rollback checkpoints and release gates enabled.');
  }
  if (Number(incidentSignals.open_incident_count || 0) > 0) {
    recommendations.push('Review staging incident attempts to avoid repeating failed actions.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Proceed with direct execution and keep gate verification enabled.');
  }

  const cappedRecommendations = recommendations.slice(0, policy.recommendation_limit || 6);
  const blocked = enforced && blockStage && !advisoryMode && blockers.length > 0;

  return {
    mode: 'problem-eval',
    api_version: PROBLEM_EVAL_API_VERSION,
    generated_at: new Date().toISOString(),
    stage,
    scene_id: normalizeText(context.scene_id),
    spec_id: normalizeText(context.spec_id),
    job_id: normalizeText(context.job_id),
    policy: {
      enabled: policy.enabled === true,
      mode: policy.mode,
      enforced,
      block_stage: blockStage,
      min_confidence: minConfidence
    },
    dimensions: {
      risk,
      evidence,
      readiness,
      strategy
    },
    incident_signals: {
      ...incidentSignals
    },
    confidence_score: confidenceScore,
    warnings,
    blockers,
    recommendations: cappedRecommendations,
    passed: !blocked,
    blocked
  };
}

function isIncidentRelevantToContext(incident = {}, context = {}) {
  const wantedSpecId = normalizeText(context.spec_id);
  const wantedSceneId = normalizeText(context.scene_id);
  const wantedGoal = normalizeLowerText(context.goal);
  if (!wantedSpecId && !wantedSceneId && !wantedGoal) {
    return true;
  }

  const title = normalizeLowerText(incident.title);
  const symptom = normalizeLowerText(incident.symptom);
  const matchesGoal = wantedGoal && (title.includes(wantedGoal) || symptom.includes(wantedGoal));
  const matchesSpec = wantedSpecId
    && Array.isArray(incident.attempts)
    && incident.attempts.some((attempt) => normalizeText(attempt?.source?.spec) === wantedSpecId);
  const matchesScene = wantedSceneId
    && (title.includes(wantedSceneId.toLowerCase()) || symptom.includes(wantedSceneId.toLowerCase()));
  return Boolean(matchesSpec || matchesScene || matchesGoal);
}

async function collectIncidentSignals(projectPath = process.cwd(), context = {}, fileSystem = fs) {
  const indexPath = path.join(projectPath, '.sce', 'errorbook', 'staging', 'index.json');
  if (!await fileSystem.pathExists(indexPath)) {
    return {
      has_staging_data: false,
      total_incident_count: 0,
      open_incident_count: 0,
      resolved_incident_count: 0,
      relevant_incident_count: 0,
      max_attempt_count: 0,
      has_debug_evidence: false
    };
  }

  const indexPayload = await fileSystem.readJson(indexPath).catch(() => null);
  if (!indexPayload || !Array.isArray(indexPayload.incidents)) {
    return {
      has_staging_data: true,
      total_incident_count: 0,
      open_incident_count: 0,
      resolved_incident_count: 0,
      relevant_incident_count: 0,
      max_attempt_count: 0,
      has_debug_evidence: false
    };
  }

  const incidentsDir = path.join(projectPath, '.sce', 'errorbook', 'staging', 'incidents');
  let relevantCount = 0;
  let maxAttemptCount = 0;
  let hasDebugEvidence = false;

  for (const summary of indexPayload.incidents.slice(0, 200)) {
    const incidentId = normalizeText(summary.id);
    if (!incidentId) {
      continue;
    }
    const incidentPath = path.join(incidentsDir, `${incidentId}.json`);
    if (!await fileSystem.pathExists(incidentPath)) {
      continue;
    }
    const incident = await fileSystem.readJson(incidentPath).catch(() => null);
    if (!incident || !isIncidentRelevantToContext(incident, context)) {
      continue;
    }
    relevantCount += 1;
    const attemptCount = Number(incident.attempt_count || (Array.isArray(incident.attempts) ? incident.attempts.length : 0) || 0);
    if (attemptCount > maxAttemptCount) {
      maxAttemptCount = attemptCount;
    }
    if (Array.isArray(incident.attempts) && incident.attempts.some((attempt) => hasDebugEvidenceInAttempt(attempt))) {
      hasDebugEvidence = true;
    }
  }

  return {
    has_staging_data: true,
    total_incident_count: indexPayload.incidents.length,
    open_incident_count: indexPayload.incidents.filter((item) => normalizeIncidentState(item.state, 'open') === 'open').length,
    resolved_incident_count: indexPayload.incidents.filter((item) => normalizeIncidentState(item.state, 'open') === 'resolved').length,
    relevant_incident_count: relevantCount,
    max_attempt_count: maxAttemptCount,
    has_debug_evidence: hasDebugEvidence
  };
}

function toRelativePosix(projectPath, absolutePath) {
  return path.relative(projectPath, absolutePath).replace(/\\/g, '/');
}

function sanitizeSegment(value, fallback = 'adhoc') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return fallback;
  }
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

async function runProblemEvaluation(context = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const env = dependencies.env || process.env;
  const writeReport = dependencies.writeReport !== false;
  const policyBundle = dependencies.policyBundle || await loadProblemEvalPolicy(projectPath, fileSystem, env);
  const policy = policyBundle.policy;
  const incidentSignals = context.incident_signals || await collectIncidentSignals(projectPath, context, fileSystem);
  const report = evaluateProblemContext({
    ...context,
    incident_signals: incidentSignals
  }, policy);

  if (writeReport) {
    const reportDir = path.join(projectPath, DEFAULT_REPORT_DIR);
    const stage = sanitizeSegment(report.stage, 'stage');
    const jobId = sanitizeSegment(report.job_id, `adhoc-${Date.now()}`);
    const reportPath = path.join(reportDir, `${jobId}-${stage}.json`);
    await fileSystem.ensureDir(path.dirname(reportPath));
    await fileSystem.writeJson(reportPath, report, { spaces: 2 });
    report.report_file = toRelativePosix(projectPath, reportPath);
  }

  return report;
}

module.exports = {
  PROBLEM_EVAL_API_VERSION,
  DEFAULT_POLICY_PATH,
  DEFAULT_REPORT_DIR,
  DEFAULT_PROBLEM_EVAL_POLICY,
  normalizePolicy,
  loadProblemEvalPolicy,
  collectIncidentSignals,
  evaluateProblemContext,
  runProblemEvaluation
};
