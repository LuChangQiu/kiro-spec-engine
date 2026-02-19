#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_EVIDENCE = '.kiro/reports/release-evidence/handoff-runs.json';
const DEFAULT_BASELINE = '.kiro/reports/release-evidence/moqui-template-baseline.json';
const DEFAULT_LEXICON = '.kiro/reports/release-evidence/moqui-lexicon-audit.json';
const DEFAULT_CAPABILITY_MATRIX = '.kiro/reports/handoff-capability-matrix.json';
const DEFAULT_OUT = '.kiro/reports/release-evidence/moqui-release-summary.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/release-evidence/moqui-release-summary.md';

function parseArgs(argv) {
  const options = {
    evidence: DEFAULT_EVIDENCE,
    baseline: DEFAULT_BASELINE,
    lexicon: DEFAULT_LEXICON,
    capabilityMatrix: DEFAULT_CAPABILITY_MATRIX,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    failOnGateFail: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--evidence' && next) {
      options.evidence = next;
      i += 1;
    } else if (token === '--baseline' && next) {
      options.baseline = next;
      i += 1;
    } else if (token === '--lexicon' && next) {
      options.lexicon = next;
      i += 1;
    } else if (token === '--capability-matrix' && next) {
      options.capabilityMatrix = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--fail-on-gate-fail') {
      options.failOnGateFail = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-release-summary.js [options]',
    '',
    'Options:',
    `  --evidence <path>          Handoff release evidence JSON (default: ${DEFAULT_EVIDENCE})`,
    `  --baseline <path>          Moqui baseline JSON (default: ${DEFAULT_BASELINE})`,
    `  --lexicon <path>           Moqui lexicon audit JSON (default: ${DEFAULT_LEXICON})`,
    `  --capability-matrix <path> Capability matrix JSON (default: ${DEFAULT_CAPABILITY_MATRIX})`,
    `  --out <path>               Summary JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>      Summary markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --fail-on-gate-fail        Exit non-zero when summary gate status is failed',
    '  --json                     Print summary JSON to stdout',
    '  -h, --help                 Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeBoolean(value) {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  return null;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function safeReadJson(cwd, candidatePath) {
  const absolutePath = path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(cwd, candidatePath);
  const relativePath = path.relative(cwd, absolutePath) || '.';
  const exists = await fs.pathExists(absolutePath);
  if (!exists) {
    return {
      path: relativePath,
      exists: false,
      parse_error: null,
      payload: null
    };
  }

  try {
    const payload = await fs.readJson(absolutePath);
    return {
      path: relativePath,
      exists: true,
      parse_error: null,
      payload
    };
  } catch (error) {
    return {
      path: relativePath,
      exists: true,
      parse_error: error.message,
      payload: null
    };
  }
}

function pickLatestSession(evidencePayload) {
  const sessions = Array.isArray(evidencePayload && evidencePayload.sessions)
    ? evidencePayload.sessions
    : [];
  if (sessions.length === 0) {
    return null;
  }

  const latestSessionId = typeof evidencePayload.latest_session_id === 'string'
    ? evidencePayload.latest_session_id.trim()
    : '';
  if (latestSessionId) {
    const matched = sessions.find(item => item && item.session_id === latestSessionId);
    if (matched) {
      return matched;
    }
  }

  return sessions[0];
}

function extractBaseline(payload) {
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : {};
  const compare = payload && payload.compare && typeof payload.compare === 'object'
    ? payload.compare
    : {};
  const regressions = Array.isArray(compare.regressions)
    ? compare.regressions
    : [];
  return {
    status: payload && typeof payload.status === 'string' ? payload.status : null,
    portfolio_passed: normalizeBoolean(summary.portfolio_passed),
    avg_score: normalizeNumber(summary.avg_score),
    valid_rate_percent: normalizeNumber(summary.valid_rate_percent),
    baseline_failed: normalizeNumber(summary.baseline_failed),
    regressions_count: regressions.length
  };
}

function extractLexicon(payload) {
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : {};
  return {
    passed: normalizeBoolean(summary.passed),
    expected_unknown_count: normalizeNumber(summary.expected_unknown_count),
    provided_unknown_count: normalizeNumber(summary.provided_unknown_count),
    uncovered_expected_count: normalizeNumber(summary.uncovered_expected_count),
    coverage_percent: normalizeNumber(summary.coverage_percent)
  };
}

function extractCapabilityCoverage(payload) {
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : {};
  return {
    passed: normalizeBoolean(summary.passed),
    semantic_passed: normalizeBoolean(summary.semantic_passed),
    coverage_percent: normalizeNumber(summary.coverage_percent),
    semantic_complete_percent: normalizeNumber(summary.semantic_complete_percent),
    covered_capabilities: normalizeNumber(summary.covered_capabilities),
    uncovered_capabilities: normalizeNumber(summary.uncovered_capabilities)
  };
}

function extractScenePackageBatch(payload) {
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : {};
  const batchGate = payload && payload.batch_ontology_gate && typeof payload.batch_ontology_gate === 'object'
    ? payload.batch_ontology_gate
    : {};
  return {
    status: payload && typeof payload.status === 'string' ? payload.status : null,
    batch_gate_passed: normalizeBoolean(
      summary.batch_gate_passed !== undefined
        ? summary.batch_gate_passed
        : batchGate.passed
    ),
    failed: normalizeNumber(summary.failed),
    selected: normalizeNumber(summary.selected)
  };
}

function extractHandoffGate(sessionPayload) {
  const gate = sessionPayload && sessionPayload.gate && typeof sessionPayload.gate === 'object'
    ? sessionPayload.gate
    : {};
  const releasePreflight = sessionPayload && sessionPayload.release_gate_preflight
    && typeof sessionPayload.release_gate_preflight === 'object'
    ? sessionPayload.release_gate_preflight
    : {};
  const policy = sessionPayload && sessionPayload.policy && typeof sessionPayload.policy === 'object'
    ? sessionPayload.policy
    : {};
  return {
    session_id: sessionPayload && sessionPayload.session_id ? sessionPayload.session_id : null,
    status: sessionPayload && sessionPayload.status ? sessionPayload.status : null,
    merged_at: sessionPayload && sessionPayload.merged_at ? sessionPayload.merged_at : null,
    gate_passed: normalizeBoolean(gate.passed),
    spec_success_rate_percent: normalizeNumber(gate && gate.actual && gate.actual.spec_success_rate_percent),
    risk_level: gate && gate.actual && typeof gate.actual.risk_level === 'string'
      ? gate.actual.risk_level
      : null,
    release_preflight_unblocked: releasePreflight.blocked === true
      ? false
      : (releasePreflight.blocked === false ? true : null),
    max_moqui_matrix_regressions: normalizeNumber(policy.max_moqui_matrix_regressions)
  };
}

function extractCapabilityMatrix(payload) {
  const gates = payload && payload.gates && typeof payload.gates === 'object'
    ? payload.gates
    : {};
  const coverage = payload && payload.capability_coverage && typeof payload.capability_coverage === 'object'
    ? payload.capability_coverage
    : {};
  const summary = coverage && coverage.summary && typeof coverage.summary === 'object'
    ? coverage.summary
    : {};
  return {
    status: payload && typeof payload.status === 'string' ? payload.status : null,
    gate_passed: normalizeBoolean(gates.passed),
    coverage_passed: normalizeBoolean(
      gates.capability_coverage && gates.capability_coverage.passed
    ),
    semantic_passed: normalizeBoolean(
      gates.capability_semantic && gates.capability_semantic.passed
    ),
    lexicon_passed: normalizeBoolean(
      gates.capability_lexicon && gates.capability_lexicon.passed
    ),
    coverage_percent: normalizeNumber(summary.coverage_percent),
    semantic_complete_percent: normalizeNumber(summary.semantic_complete_percent)
  };
}

function normalizeGateStatus(checks, matrixRegressionCheck) {
  const requiredChecks = checks.filter(item => item.required);
  const hasFailed = requiredChecks.some(item => item.value === false) || matrixRegressionCheck === false;
  if (hasFailed) {
    return 'failed';
  }
  const hasUnknown = requiredChecks.some(item => item.value === null) || matrixRegressionCheck === null;
  if (hasUnknown) {
    return 'incomplete';
  }
  return 'passed';
}

function buildRecommendations(summary) {
  const recommendations = [];
  const push = (value) => {
    const text = `${value || ''}`.trim();
    if (!text || recommendations.includes(text)) {
      return;
    }
    recommendations.push(text);
  };

  if (summary.gate_status === 'incomplete') {
    push(
      'Generate baseline release evidence first: `npx sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --dry-run --json`.'
    );
    push(
      'Generate capability matrix evidence: `npx sce auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --fail-on-gap --json`.'
    );
  }

  const map = new Map(summary.checks.map(item => [item.key, item.value]));
  if (map.get('handoff_gate') === false) {
    push(
      'Fix handoff gate failures and rerun: `npx sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --dry-run --json`.'
    );
  }
  if (map.get('baseline_portfolio') === false) {
    push(
      'Remediate baseline portfolio score/gaps: `npx sce scene moqui-baseline --include-all --fail-on-portfolio-fail --json`.'
    );
  }
  if (map.get('scene_package_batch') === false) {
    push(
      'Repair scene package batch ontology gate: `npx sce scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --json`.'
    );
  }
  if (map.get('capability_coverage') === false || map.get('capability_semantic') === false) {
    push(
      'Close capability and semantic gaps: `npx sce auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --fail-on-gap --json`.'
    );
  }
  if (map.get('lexicon_gate') === false) {
    push(
      'Align manifest/template aliases with canonical lexicon: `node scripts/moqui-lexicon-audit.js --manifest docs/handoffs/handoff-manifest.json --fail-on-gap --json`.'
    );
  }
  if (map.get('release_preflight') === false) {
    push(
      'Release gate preflight is blocked; resolve governance release-gate blockers and rerun handoff evidence.'
    );
  }
  if (summary.matrix_regression_check === false) {
    push(
      'Recover matrix regressions to policy limit before release: `npx sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --dry-run --json`.'
    );
  }

  if (recommendations.length === 0) {
    push('No blocking issue detected in the available evidence.');
  }

  return recommendations;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# Moqui Release Summary');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Gate status: ${report.summary.gate_status}`);
  lines.push(
    `- Gate passed: ${report.summary.gate_passed === null ? 'n/a' : (report.summary.gate_passed ? 'yes' : 'no')}`
  );
  lines.push('');
  lines.push('## Current Session');
  lines.push('');
  lines.push(`- Session ID: ${report.handoff.session_id || 'n/a'}`);
  lines.push(`- Status: ${report.handoff.status || 'n/a'}`);
  lines.push(`- Merged at: ${report.handoff.merged_at || 'n/a'}`);
  lines.push('');
  lines.push('## Gate Checks');
  lines.push('');
  lines.push('| Check | Value | Required |');
  lines.push('| --- | --- | --- |');
  for (const check of report.summary.checks) {
    const valueText = check.value === null ? 'n/a' : (check.value ? 'pass' : 'fail');
    lines.push(`| ${check.key} | ${valueText} | ${check.required ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('## Signals');
  lines.push('');
  lines.push(`- Baseline portfolio passed: ${report.baseline.portfolio_passed === null ? 'n/a' : (report.baseline.portfolio_passed ? 'yes' : 'no')}`);
  lines.push(`- Baseline avg score: ${report.baseline.avg_score === null ? 'n/a' : report.baseline.avg_score}`);
  lines.push(`- Baseline valid-rate: ${report.baseline.valid_rate_percent === null ? 'n/a' : `${report.baseline.valid_rate_percent}%`}`);
  lines.push(`- Lexicon passed: ${report.lexicon.passed === null ? 'n/a' : (report.lexicon.passed ? 'yes' : 'no')}`);
  lines.push(`- Lexicon coverage: ${report.lexicon.coverage_percent === null ? 'n/a' : `${report.lexicon.coverage_percent}%`}`);
  lines.push(`- Capability coverage passed: ${report.capability_coverage.passed === null ? 'n/a' : (report.capability_coverage.passed ? 'yes' : 'no')}`);
  lines.push(`- Capability semantic passed: ${report.capability_coverage.semantic_passed === null ? 'n/a' : (report.capability_coverage.semantic_passed ? 'yes' : 'no')}`);
  lines.push(`- Capability coverage: ${report.capability_coverage.coverage_percent === null ? 'n/a' : `${report.capability_coverage.coverage_percent}%`}`);
  lines.push(`- Capability semantic completeness: ${report.capability_coverage.semantic_complete_percent === null ? 'n/a' : `${report.capability_coverage.semantic_complete_percent}%`}`);
  lines.push(`- Scene package batch gate passed: ${report.scene_package_batch.batch_gate_passed === null ? 'n/a' : (report.scene_package_batch.batch_gate_passed ? 'yes' : 'no')}`);
  lines.push(
    `- Matrix regressions: ${report.summary.matrix_regressions === null ? 'n/a' : report.summary.matrix_regressions}` +
    ` (max=${report.summary.max_matrix_regressions === null ? 'n/a' : report.summary.max_matrix_regressions})`
  );
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  lines.push('| Input | Path | Exists | Parse Error |');
  lines.push('| --- | --- | --- | --- |');
  for (const input of Object.values(report.inputs)) {
    lines.push(
      `| ${input.key} | ${input.path} | ${input.exists ? 'yes' : 'no'} | ${input.parse_error || 'none'} |`
    );
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const item of report.recommendations) {
    lines.push(`- ${item}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const [evidenceInput, baselineInput, lexiconInput, capabilityMatrixInput] = await Promise.all([
    safeReadJson(cwd, options.evidence),
    safeReadJson(cwd, options.baseline),
    safeReadJson(cwd, options.lexicon),
    safeReadJson(cwd, options.capabilityMatrix)
  ]);

  const latestSession = pickLatestSession(evidenceInput.payload);
  const handoff = extractHandoffGate(latestSession || {});
  const baselineFromEvidence = extractBaseline(
    latestSession && latestSession.moqui_baseline && typeof latestSession.moqui_baseline === 'object'
      ? latestSession.moqui_baseline
      : {}
  );
  const capabilityFromEvidence = extractCapabilityCoverage(
    latestSession && latestSession.moqui_capability_coverage && typeof latestSession.moqui_capability_coverage === 'object'
      ? latestSession.moqui_capability_coverage
      : {}
  );
  const scenePackageBatch = extractScenePackageBatch(
    latestSession && latestSession.scene_package_batch && typeof latestSession.scene_package_batch === 'object'
      ? latestSession.scene_package_batch
      : {}
  );

  const baselineFromFile = extractBaseline(
    baselineInput.payload && typeof baselineInput.payload === 'object'
      ? baselineInput.payload
      : {}
  );
  const lexicon = extractLexicon(
    lexiconInput.payload && typeof lexiconInput.payload === 'object'
      ? lexiconInput.payload
      : {}
  );
  const capabilityMatrix = extractCapabilityMatrix(
    capabilityMatrixInput.payload && typeof capabilityMatrixInput.payload === 'object'
      ? capabilityMatrixInput.payload
      : {}
  );

  const baseline = {
    status: baselineFromFile.status || baselineFromEvidence.status || null,
    portfolio_passed: baselineFromFile.portfolio_passed !== null
      ? baselineFromFile.portfolio_passed
      : baselineFromEvidence.portfolio_passed,
    avg_score: baselineFromFile.avg_score !== null ? baselineFromFile.avg_score : baselineFromEvidence.avg_score,
    valid_rate_percent: baselineFromFile.valid_rate_percent !== null
      ? baselineFromFile.valid_rate_percent
      : baselineFromEvidence.valid_rate_percent,
    baseline_failed: baselineFromFile.baseline_failed !== null
      ? baselineFromFile.baseline_failed
      : baselineFromEvidence.baseline_failed,
    regressions_count: baselineFromFile.regressions_count > 0
      ? baselineFromFile.regressions_count
      : baselineFromEvidence.regressions_count
  };

  const capabilityCoverage = {
    passed: capabilityMatrix.coverage_passed !== null
      ? capabilityMatrix.coverage_passed
      : capabilityFromEvidence.passed,
    semantic_passed: capabilityMatrix.semantic_passed !== null
      ? capabilityMatrix.semantic_passed
      : capabilityFromEvidence.semantic_passed,
    coverage_percent: capabilityMatrix.coverage_percent !== null
      ? capabilityMatrix.coverage_percent
      : capabilityFromEvidence.coverage_percent,
    semantic_complete_percent: capabilityMatrix.semantic_complete_percent !== null
      ? capabilityMatrix.semantic_complete_percent
      : capabilityFromEvidence.semantic_complete_percent,
    covered_capabilities: capabilityFromEvidence.covered_capabilities,
    uncovered_capabilities: capabilityFromEvidence.uncovered_capabilities
  };

  const matrixRegressions = baseline.regressions_count;
  const maxMatrixRegressions = handoff.max_moqui_matrix_regressions;
  const matrixRegressionCheck = (
    matrixRegressions === null || maxMatrixRegressions === null
      ? null
      : matrixRegressions <= maxMatrixRegressions
  );

  const checks = [
    { key: 'handoff_gate', value: handoff.gate_passed, required: true },
    { key: 'baseline_portfolio', value: baseline.portfolio_passed, required: true },
    { key: 'scene_package_batch', value: scenePackageBatch.batch_gate_passed, required: true },
    { key: 'capability_coverage', value: capabilityCoverage.passed, required: true },
    { key: 'capability_semantic', value: capabilityCoverage.semantic_passed, required: true },
    {
      key: 'lexicon_gate',
      value: lexicon.passed !== null ? lexicon.passed : capabilityMatrix.lexicon_passed,
      required: true
    },
    { key: 'release_preflight', value: handoff.release_preflight_unblocked, required: false }
  ];

  const gateStatus = normalizeGateStatus(checks, matrixRegressionCheck);
  const gatePassed = gateStatus === 'passed'
    ? true
    : (gateStatus === 'failed' ? false : null);
  const summary = {
    gate_status: gateStatus,
    gate_passed: gatePassed,
    checks,
    matrix_regressions: matrixRegressions,
    max_matrix_regressions: maxMatrixRegressions,
    matrix_regression_check: matrixRegressionCheck
  };

  const report = {
    mode: 'moqui-release-summary',
    generated_at: new Date().toISOString(),
    inputs: {
      evidence: { key: 'evidence', ...evidenceInput },
      baseline: { key: 'baseline', ...baselineInput },
      lexicon: { key: 'lexicon', ...lexiconInput },
      capability_matrix: { key: 'capability_matrix', ...capabilityMatrixInput }
    },
    handoff,
    baseline,
    lexicon,
    capability_coverage: capabilityCoverage,
    capability_matrix: capabilityMatrix,
    scene_package_batch: scenePackageBatch,
    summary
  };
  report.recommendations = buildRecommendations(report.summary);

  const outPath = path.resolve(cwd, options.out);
  const markdownOutPath = path.resolve(cwd, options.markdownOut);
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdownReport(report), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      ...report,
      output: {
        json: path.relative(cwd, outPath) || '.',
        markdown: path.relative(cwd, markdownOutPath) || '.'
      }
    }, null, 2)}\n`);
  } else {
    process.stdout.write(`Moqui release summary generated (${summary.gate_status}).\n`);
    process.stdout.write(`- JSON: ${path.relative(cwd, outPath) || '.'}\n`);
    process.stdout.write(`- Markdown: ${path.relative(cwd, markdownOutPath) || '.'}\n`);
  }

  if (options.failOnGateFail && summary.gate_status === 'failed') {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Moqui release summary failed: ${error.message}`);
  process.exit(1);
});
