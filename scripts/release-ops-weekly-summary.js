#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_EVIDENCE = '.sce/reports/release-evidence/handoff-runs.json';
const DEFAULT_GATE_HISTORY = '.sce/reports/release-evidence/release-gate-history.json';
const DEFAULT_INTERACTIVE_GOVERNANCE = '.sce/reports/interactive-governance-report.json';
const DEFAULT_MATRIX_SIGNALS = '.sce/reports/interactive-matrix-signals.jsonl';
const DEFAULT_OUT = '.sce/reports/release-evidence/weekly-ops-summary.json';
const DEFAULT_MARKDOWN_OUT = '.sce/reports/release-evidence/weekly-ops-summary.md';

function parseArgs(argv) {
  const options = {
    evidence: DEFAULT_EVIDENCE,
    gateHistory: DEFAULT_GATE_HISTORY,
    interactiveGovernance: DEFAULT_INTERACTIVE_GOVERNANCE,
    matrixSignals: DEFAULT_MATRIX_SIGNALS,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    from: null,
    to: null,
    windowDays: 7,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--evidence' && next) {
      options.evidence = next;
      i += 1;
    } else if (token === '--gate-history' && next) {
      options.gateHistory = next;
      i += 1;
    } else if (token === '--interactive-governance' && next) {
      options.interactiveGovernance = next;
      i += 1;
    } else if (token === '--matrix-signals' && next) {
      options.matrixSignals = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--from' && next) {
      options.from = next;
      i += 1;
    } else if (token === '--to' && next) {
      options.to = next;
      i += 1;
    } else if (token === '--window-days' && next) {
      options.windowDays = Number(next);
      i += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  const hasFrom = Boolean(typeof options.from === 'string' && options.from.trim());
  const hasTo = Boolean(typeof options.to === 'string' && options.to.trim());
  if (hasFrom !== hasTo) {
    throw new Error('--from and --to must be provided together.');
  }

  if (!Number.isFinite(options.windowDays) || options.windowDays < 1 || options.windowDays > 90) {
    throw new Error('--window-days must be an integer between 1 and 90.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/release-ops-weekly-summary.js [options]',
    '',
    'Options:',
    `  --evidence <path>              Handoff evidence JSON (default: ${DEFAULT_EVIDENCE})`,
    `  --gate-history <path>          Release gate history JSON (default: ${DEFAULT_GATE_HISTORY})`,
    `  --interactive-governance <path> Interactive governance JSON (default: ${DEFAULT_INTERACTIVE_GOVERNANCE})`,
    `  --matrix-signals <path>        Interactive matrix signals JSONL (default: ${DEFAULT_MATRIX_SIGNALS})`,
    `  --out <path>                   JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>          Markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --from <ISO datetime>          Window start (requires --to)',
    '  --to <ISO datetime>            Window end (requires --from)',
    '  --window-days <n>              Default rolling window in days (1-90, default: 7)',
    '  --json                         Print report JSON payload',
    '  -h, --help                     Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function parseIsoDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid date for ${label}: ${value}`);
  }
  return date;
}

function buildWindow(options, now = new Date()) {
  if (options.from && options.to) {
    const from = parseIsoDate(options.from, '--from');
    const to = parseIsoDate(options.to, '--to');
    if (from.getTime() > to.getTime()) {
      throw new Error('--from must be <= --to.');
    }
    return { from, to, mode: 'custom' };
  }
  const to = new Date(now.getTime());
  const from = new Date(now.getTime());
  from.setUTCDate(from.getUTCDate() - options.windowDays);
  return { from, to, mode: 'rolling' };
}

async function safeReadJson(cwd, candidatePath) {
  const absolutePath = resolvePath(cwd, candidatePath);
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

async function safeReadJsonLines(cwd, candidatePath) {
  const absolutePath = resolvePath(cwd, candidatePath);
  const relativePath = path.relative(cwd, absolutePath) || '.';
  const exists = await fs.pathExists(absolutePath);
  if (!exists) {
    return {
      path: relativePath,
      exists: false,
      parse_error: null,
      records: []
    };
  }

  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    const records = `${content || ''}`
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean);
    return {
      path: relativePath,
      exists: true,
      parse_error: null,
      records
    };
  } catch (error) {
    return {
      path: relativePath,
      exists: true,
      parse_error: error.message,
      records: []
    };
  }
}

function parseTimestamp(entry, fields = []) {
  for (const key of fields) {
    const value = entry && entry[key];
    if (!value) {
      continue;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function filterByWindow(entries, window, fields, includeUnknown = false) {
  const fromMs = window.from.getTime();
  const toMs = window.to.getTime();
  return entries.filter((entry) => {
    const ts = parseTimestamp(entry, fields);
    if (ts === null) {
      return includeUnknown;
    }
    return ts >= fromMs && ts <= toMs;
  });
}

function toPercent(numerator, denominator) {
  const total = Number(denominator);
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Number(((Number(numerator) / total) * 100).toFixed(2));
}

function toAverage(values = []) {
  const nums = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  if (nums.length === 0) {
    return null;
  }
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
}

function buildHandoffSnapshot(payload, window) {
  const sessions = Array.isArray(payload && payload.sessions) ? payload.sessions : [];
  const scoped = filterByWindow(
    sessions,
    window,
    ['merged_at', 'generated_at', 'updated_at'],
    false
  );
  const statusCounts = {
    completed: 0,
    failed: 0,
    dry_run: 0,
    running: 0,
    other: 0
  };
  const risk = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0
  };
  let gateKnownRuns = 0;
  let gatePassedRuns = 0;
  let sceneKnownRuns = 0;
  let scenePassedRuns = 0;
  let preflightKnownRuns = 0;
  let preflightBlockedRuns = 0;
  const specRateValues = [];
  const expectedUnknownKnown = [];
  const providedUnknownKnown = [];

  for (const session of scoped) {
    const status = `${session && session.status ? session.status : ''}`.trim().toLowerCase();
    if (statusCounts[status] !== undefined) {
      statusCounts[status] += 1;
    } else {
      statusCounts.other += 1;
    }

    const gate = session && session.gate && typeof session.gate === 'object' ? session.gate : {};
    const gateActual = gate && gate.actual && typeof gate.actual === 'object' ? gate.actual : {};
    if (gate.passed === true || gate.passed === false) {
      gateKnownRuns += 1;
      if (gate.passed === true) {
        gatePassedRuns += 1;
      }
    }

    const specRate = Number(gateActual.spec_success_rate_percent);
    if (Number.isFinite(specRate)) {
      specRateValues.push(specRate);
    }

    const riskLevel = `${gateActual.risk_level || 'unknown'}`.trim().toLowerCase();
    if (risk[riskLevel] !== undefined) {
      risk[riskLevel] += 1;
    } else {
      risk.unknown += 1;
    }

    const scenePackage = session && session.scene_package_batch && typeof session.scene_package_batch === 'object'
      ? session.scene_package_batch
      : {};
    const sceneSummary = scenePackage && scenePackage.summary && typeof scenePackage.summary === 'object'
      ? scenePackage.summary
      : {};
    const scenePassedCandidate = sceneSummary.batch_gate_passed;
    if (scenePassedCandidate === true || scenePassedCandidate === false) {
      sceneKnownRuns += 1;
      if (scenePassedCandidate === true) {
        scenePassedRuns += 1;
      }
    }

    const preflight = session && session.release_gate_preflight && typeof session.release_gate_preflight === 'object'
      ? session.release_gate_preflight
      : {};
    if (preflight.blocked === true || preflight.blocked === false) {
      preflightKnownRuns += 1;
      if (preflight.blocked === true) {
        preflightBlockedRuns += 1;
      }
    }

    const expectedUnknown = Number(
      gateActual.capability_expected_unknown_count !== undefined
        ? gateActual.capability_expected_unknown_count
        : null
    );
    if (Number.isFinite(expectedUnknown)) {
      expectedUnknownKnown.push(Math.max(0, expectedUnknown));
    }
    const providedUnknown = Number(
      gateActual.capability_provided_unknown_count !== undefined
        ? gateActual.capability_provided_unknown_count
        : null
    );
    if (Number.isFinite(providedUnknown)) {
      providedUnknownKnown.push(Math.max(0, providedUnknown));
    }
  }

  const expectedUnknownPositive = expectedUnknownKnown.filter(value => value > 0).length;
  const providedUnknownPositive = providedUnknownKnown.filter(value => value > 0).length;

  return {
    total_runs: scoped.length,
    status_counts: statusCounts,
    gate_passed_runs: gatePassedRuns,
    gate_known_runs: gateKnownRuns,
    gate_pass_rate_percent: toPercent(gatePassedRuns, gateKnownRuns),
    avg_spec_success_rate_percent: toAverage(specRateValues),
    risk_levels: risk,
    scene_batch_passed_runs: scenePassedRuns,
    scene_batch_known_runs: sceneKnownRuns,
    scene_batch_pass_rate_percent: toPercent(scenePassedRuns, sceneKnownRuns),
    release_preflight_blocked_runs: preflightBlockedRuns,
    release_preflight_known_runs: preflightKnownRuns,
    release_preflight_block_rate_percent: toPercent(preflightBlockedRuns, preflightKnownRuns),
    capability_expected_unknown_positive_runs: expectedUnknownPositive,
    capability_expected_unknown_known_runs: expectedUnknownKnown.length,
    capability_expected_unknown_positive_rate_percent: toPercent(expectedUnknownPositive, expectedUnknownKnown.length),
    capability_provided_unknown_positive_runs: providedUnknownPositive,
    capability_provided_unknown_known_runs: providedUnknownKnown.length,
    capability_provided_unknown_positive_rate_percent: toPercent(providedUnknownPositive, providedUnknownKnown.length)
  };
}

function buildReleaseGateHistorySnapshot(payload, window) {
  const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
  const scoped = filterByWindow(
    entries,
    window,
    ['evaluated_at'],
    true
  );

  let gateKnown = 0;
  let gatePassed = 0;
  let preflightKnown = 0;
  let preflightBlocked = 0;
  let driftKnown = 0;
  let driftPositive = 0;
  const risk = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0
  };
  const expectedUnknownKnown = [];
  const providedUnknownKnown = [];

  for (const entry of scoped) {
    if (entry && (entry.gate_passed === true || entry.gate_passed === false)) {
      gateKnown += 1;
      if (entry.gate_passed === true) {
        gatePassed += 1;
      }
    }

    const riskLevel = `${entry && entry.risk_level ? entry.risk_level : 'unknown'}`.trim().toLowerCase();
    if (risk[riskLevel] !== undefined) {
      risk[riskLevel] += 1;
    } else {
      risk.unknown += 1;
    }

    if (entry && (entry.release_gate_preflight_blocked === true || entry.release_gate_preflight_blocked === false)) {
      preflightKnown += 1;
      if (entry.release_gate_preflight_blocked === true) {
        preflightBlocked += 1;
      }
    }

    const driftAlertCount = Number(entry && entry.drift_alert_count);
    if (Number.isFinite(driftAlertCount)) {
      driftKnown += 1;
      if (driftAlertCount > 0) {
        driftPositive += 1;
      }
    }

    const expectedUnknown = Number(entry && entry.capability_expected_unknown_count);
    if (Number.isFinite(expectedUnknown)) {
      expectedUnknownKnown.push(Math.max(0, expectedUnknown));
    }
    const providedUnknown = Number(entry && entry.capability_provided_unknown_count);
    if (Number.isFinite(providedUnknown)) {
      providedUnknownKnown.push(Math.max(0, providedUnknown));
    }
  }

  const expectedUnknownPositive = expectedUnknownKnown.filter(value => value > 0).length;
  const providedUnknownPositive = providedUnknownKnown.filter(value => value > 0).length;

  return {
    total_entries: scoped.length,
    gate_passed_runs: gatePassed,
    gate_known_runs: gateKnown,
    gate_pass_rate_percent: toPercent(gatePassed, gateKnown),
    risk_levels: risk,
    release_preflight_blocked_runs: preflightBlocked,
    release_preflight_known_runs: preflightKnown,
    release_preflight_block_rate_percent: toPercent(preflightBlocked, preflightKnown),
    drift_alert_positive_runs: driftPositive,
    drift_alert_known_runs: driftKnown,
    drift_alert_positive_rate_percent: toPercent(driftPositive, driftKnown),
    capability_expected_unknown_positive_runs: expectedUnknownPositive,
    capability_expected_unknown_known_runs: expectedUnknownKnown.length,
    capability_expected_unknown_positive_rate_percent: toPercent(expectedUnknownPositive, expectedUnknownKnown.length),
    capability_provided_unknown_positive_runs: providedUnknownPositive,
    capability_provided_unknown_known_runs: providedUnknownKnown.length,
    capability_provided_unknown_positive_rate_percent: toPercent(providedUnknownPositive, providedUnknownKnown.length)
  };
}

function buildInteractiveGovernanceSnapshot(payload, window) {
  const generatedTs = parseTimestamp(payload, ['generated_at']);
  const generatedAt = payload && payload.generated_at ? payload.generated_at : null;
  const inWindow = generatedTs === null
    ? null
    : (generatedTs >= window.from.getTime() && generatedTs <= window.to.getTime());
  const summary = payload && payload.summary && typeof payload.summary === 'object'
    ? payload.summary
    : {};
  const metrics = payload && payload.metrics && typeof payload.metrics === 'object'
    ? payload.metrics
    : {};
  return {
    generated_at: generatedAt,
    in_window: inWindow,
    status: typeof summary.status === 'string' ? summary.status : null,
    breaches: Number.isFinite(Number(summary.breaches)) ? Number(summary.breaches) : null,
    warnings: Number.isFinite(Number(summary.warnings)) ? Number(summary.warnings) : null,
    authorization_tier_total: Number.isFinite(Number(metrics.authorization_tier_total))
      ? Number(metrics.authorization_tier_total)
      : null,
    authorization_tier_deny_total: Number.isFinite(Number(metrics.authorization_tier_deny_total))
      ? Number(metrics.authorization_tier_deny_total)
      : null,
    authorization_tier_review_required_total: Number.isFinite(Number(metrics.authorization_tier_review_required_total))
      ? Number(metrics.authorization_tier_review_required_total)
      : null,
    authorization_tier_block_rate_percent: Number.isFinite(Number(metrics.authorization_tier_block_rate_percent))
      ? Number(metrics.authorization_tier_block_rate_percent)
      : null,
    dialogue_authorization_total: Number.isFinite(Number(metrics.dialogue_authorization_total))
      ? Number(metrics.dialogue_authorization_total)
      : null,
    dialogue_authorization_block_total: Number.isFinite(Number(metrics.dialogue_authorization_block_total))
      ? Number(metrics.dialogue_authorization_block_total)
      : null,
    dialogue_authorization_block_rate_percent: Number.isFinite(Number(metrics.dialogue_authorization_block_rate_percent))
      ? Number(metrics.dialogue_authorization_block_rate_percent)
      : null,
    dialogue_authorization_user_app_apply_attempt_total: Number.isFinite(
      Number(metrics.dialogue_authorization_user_app_apply_attempt_total)
    )
      ? Number(metrics.dialogue_authorization_user_app_apply_attempt_total)
      : null,
    runtime_total: Number.isFinite(Number(metrics.runtime_total))
      ? Number(metrics.runtime_total)
      : null,
    runtime_deny_total: Number.isFinite(Number(metrics.runtime_deny_total))
      ? Number(metrics.runtime_deny_total)
      : null,
    runtime_review_required_total: Number.isFinite(Number(metrics.runtime_review_required_total))
      ? Number(metrics.runtime_review_required_total)
      : null,
    runtime_block_rate_percent: Number.isFinite(Number(metrics.runtime_block_rate_percent))
      ? Number(metrics.runtime_block_rate_percent)
      : null,
    runtime_ui_mode_violation_total: Number.isFinite(Number(metrics.runtime_ui_mode_violation_total))
      ? Number(metrics.runtime_ui_mode_violation_total)
      : null,
    runtime_ui_mode_violation_rate_percent: Number.isFinite(Number(metrics.runtime_ui_mode_violation_rate_percent))
      ? Number(metrics.runtime_ui_mode_violation_rate_percent)
      : null,
    matrix_signal_total: Number.isFinite(Number(metrics.matrix_signal_total))
      ? Number(metrics.matrix_signal_total)
      : null,
    matrix_portfolio_pass_rate_percent: Number.isFinite(Number(metrics.matrix_portfolio_pass_rate_percent))
      ? Number(metrics.matrix_portfolio_pass_rate_percent)
      : null,
    matrix_regression_positive_rate_percent: Number.isFinite(Number(metrics.matrix_regression_positive_rate_percent))
      ? Number(metrics.matrix_regression_positive_rate_percent)
      : null,
    matrix_stage_error_rate_percent: Number.isFinite(Number(metrics.matrix_stage_error_rate_percent))
      ? Number(metrics.matrix_stage_error_rate_percent)
      : null
  };
}

function buildMatrixSignalSnapshot(records, window) {
  const scoped = filterByWindow(
    records,
    window,
    ['generated_at', 'timestamp', 'created_at'],
    false
  );
  let portfolioPassed = 0;
  let regressionPositive = 0;
  let stageError = 0;
  const scores = [];

  for (const entry of scoped) {
    const matrix = entry && entry.matrix && typeof entry.matrix === 'object'
      ? entry.matrix
      : null;
    if (!matrix) {
      continue;
    }
    if (matrix.portfolio_passed === true) {
      portfolioPassed += 1;
    }
    if (Number(matrix.regression_count) > 0) {
      regressionPositive += 1;
    }
    const stageStatus = `${matrix.stage_status || ''}`.trim().toLowerCase();
    if (stageStatus === 'error' || stageStatus === 'non-zero-exit') {
      stageError += 1;
    }
    const score = Number(matrix.avg_score);
    if (Number.isFinite(score)) {
      scores.push(score);
    }
  }

  return {
    total_signals: scoped.length,
    portfolio_passed_signals: portfolioPassed,
    portfolio_pass_rate_percent: toPercent(portfolioPassed, scoped.length),
    regression_positive_signals: regressionPositive,
    regression_positive_rate_percent: toPercent(regressionPositive, scoped.length),
    stage_error_signals: stageError,
    stage_error_rate_percent: toPercent(stageError, scoped.length),
    avg_score: toAverage(scores)
  };
}

function promoteRisk(current, target) {
  const rank = {
    low: 1,
    medium: 2,
    high: 3
  };
  return rank[target] > rank[current] ? target : current;
}

function buildHealth(snapshots, warnings) {
  let risk = 'low';
  const concerns = [];
  const recommendations = [];
  const seen = new Set();
  const pushConcern = (value) => {
    const text = `${value || ''}`.trim();
    if (!text || seen.has(`c:${text}`)) {
      return;
    }
    seen.add(`c:${text}`);
    concerns.push(text);
  };
  const pushRecommendation = (value) => {
    const text = `${value || ''}`.trim();
    if (!text || seen.has(`r:${text}`)) {
      return;
    }
    seen.add(`r:${text}`);
    recommendations.push(text);
  };

  if (warnings.length > 0) {
    risk = promoteRisk(risk, 'medium');
    pushConcern(`evidence inputs missing/invalid: ${warnings.length}`);
    pushRecommendation('Repair missing inputs and regenerate: `node scripts/release-ops-weekly-summary.js --json`.');
  }

  const handoff = snapshots.handoff;
  if (handoff.total_runs === 0) {
    risk = promoteRisk(risk, 'medium');
    pushConcern('handoff evidence has no runs in current window');
    pushRecommendation('Generate handoff evidence: `npx sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --profile moqui --json`.');
  }
  if (Number.isFinite(handoff.gate_pass_rate_percent) && handoff.gate_pass_rate_percent < 95) {
    risk = promoteRisk(risk, handoff.gate_pass_rate_percent < 80 ? 'high' : 'medium');
    pushConcern(`handoff gate pass rate is ${handoff.gate_pass_rate_percent}%`);
    pushRecommendation('Investigate gate regressions: `npx sce auto handoff regression --session-id latest --json`.');
  }
  if (
    Number.isFinite(handoff.capability_expected_unknown_positive_rate_percent)
    && handoff.capability_expected_unknown_positive_rate_percent > 0
  ) {
    risk = promoteRisk(risk, 'medium');
    pushConcern('handoff capability expected-unknown count is positive');
    pushRecommendation('Close capability lexicon gaps: `node scripts/moqui-lexicon-audit.js --manifest docs/handoffs/handoff-manifest.json --fail-on-gap --json`.');
  }
  if (
    Number.isFinite(handoff.capability_provided_unknown_positive_rate_percent)
    && handoff.capability_provided_unknown_positive_rate_percent > 0
  ) {
    risk = promoteRisk(risk, 'medium');
    pushConcern('handoff capability provided-unknown count is positive');
    pushRecommendation('Regenerate capability matrix and enforce semantic closure: `npx sce auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --profile moqui --fail-on-gap --json`.');
  }

  const history = snapshots.release_gate_history;
  if (history.total_entries === 0) {
    risk = promoteRisk(risk, 'medium');
    pushConcern('release gate history has no entries in current window');
    pushRecommendation('Refresh release gate history index: `npx sce auto handoff gate-index --dir .sce/reports/release-evidence --out .sce/reports/release-evidence/release-gate-history.json --json`.');
  }
  if (Number.isFinite(history.gate_pass_rate_percent) && history.gate_pass_rate_percent < 90) {
    risk = promoteRisk(risk, history.gate_pass_rate_percent < 75 ? 'high' : 'medium');
    pushConcern(`release gate history pass rate is ${history.gate_pass_rate_percent}%`);
  }
  if (
    Number.isFinite(history.release_preflight_block_rate_percent)
    && history.release_preflight_block_rate_percent >= 20
  ) {
    risk = promoteRisk(risk, 'medium');
    pushConcern(`release preflight blocked rate is ${history.release_preflight_block_rate_percent}%`);
  }

  const governance = snapshots.interactive_governance;
  if (governance.status === 'alert') {
    risk = promoteRisk(risk, governance.breaches >= 3 ? 'high' : 'medium');
    pushConcern('interactive governance report is in alert status');
    pushRecommendation('Resolve governance alerts: `node scripts/interactive-governance-report.js --period weekly --fail-on-alert --json`.');
  }
  if (
    Number.isFinite(governance.authorization_tier_block_rate_percent)
    && governance.authorization_tier_block_rate_percent > 40
  ) {
    risk = promoteRisk(risk, governance.authorization_tier_block_rate_percent >= 60 ? 'high' : 'medium');
    pushConcern(`authorization-tier block rate is ${governance.authorization_tier_block_rate_percent}%`);
    pushRecommendation('Tune dialogue profile + authorization-tier policy to reduce deny/review pressure for actionable requests.');
  }
  if (
    Number.isFinite(governance.dialogue_authorization_block_rate_percent)
    && governance.dialogue_authorization_block_rate_percent > 40
  ) {
    risk = promoteRisk(risk, governance.dialogue_authorization_block_rate_percent >= 60 ? 'high' : 'medium');
    pushConcern(`dialogue-authorization block rate is ${governance.dialogue_authorization_block_rate_percent}%`);
    pushRecommendation('Tune authorization dialogue policy and ui-mode routing to reduce blocked user intent execution.');
  }
  if (
    Number.isFinite(governance.runtime_ui_mode_violation_total)
    && governance.runtime_ui_mode_violation_total > 0
  ) {
    risk = promoteRisk(risk, governance.runtime_ui_mode_violation_total >= 3 ? 'high' : 'medium');
    pushConcern(`runtime ui-mode violations observed: ${governance.runtime_ui_mode_violation_total}`);
    pushRecommendation('Enforce dual-surface routing: user-app suggestion-only, ops-console for apply workflows.');
  }

  const matrix = snapshots.matrix_signals;
  if (matrix.total_signals === 0) {
    risk = promoteRisk(risk, 'medium');
    pushConcern('interactive matrix signals missing in current window');
    pushRecommendation('Generate matrix signals via interactive flow smoke: `npm run test:interactive-flow-smoke`.');
  } else if (
    Number.isFinite(matrix.regression_positive_rate_percent)
    && matrix.regression_positive_rate_percent > 20
  ) {
    risk = promoteRisk(risk, 'medium');
    pushConcern(`matrix regression-positive rate is ${matrix.regression_positive_rate_percent}%`);
    pushRecommendation('Run matrix remediation queue: `npm run report:matrix-remediation-queue`.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Current weekly ops metrics are stable. Keep default release and governance gates enabled.');
  }

  return {
    risk,
    concerns,
    recommendations
  };
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Release Weekly Ops Summary');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Window: ${report.period.from} -> ${report.period.to}`);
  lines.push(`- Risk: ${report.health.risk}`);
  lines.push('');
  lines.push('## Handoff');
  lines.push('');
  lines.push(`- Total runs: ${report.snapshots.handoff.total_runs}`);
  lines.push(`- Gate pass rate: ${report.snapshots.handoff.gate_pass_rate_percent == null ? 'n/a' : `${report.snapshots.handoff.gate_pass_rate_percent}%`}`);
  lines.push(`- Avg spec success: ${report.snapshots.handoff.avg_spec_success_rate_percent == null ? 'n/a' : `${report.snapshots.handoff.avg_spec_success_rate_percent}%`}`);
  lines.push(`- Scene batch pass rate: ${report.snapshots.handoff.scene_batch_pass_rate_percent == null ? 'n/a' : `${report.snapshots.handoff.scene_batch_pass_rate_percent}%`}`);
  lines.push(`- Release preflight blocked rate: ${report.snapshots.handoff.release_preflight_block_rate_percent == null ? 'n/a' : `${report.snapshots.handoff.release_preflight_block_rate_percent}%`}`);
  lines.push('');
  lines.push('## Release Gate History');
  lines.push('');
  lines.push(`- Entries: ${report.snapshots.release_gate_history.total_entries}`);
  lines.push(`- Gate pass rate: ${report.snapshots.release_gate_history.gate_pass_rate_percent == null ? 'n/a' : `${report.snapshots.release_gate_history.gate_pass_rate_percent}%`}`);
  lines.push(`- Preflight blocked rate: ${report.snapshots.release_gate_history.release_preflight_block_rate_percent == null ? 'n/a' : `${report.snapshots.release_gate_history.release_preflight_block_rate_percent}%`}`);
  lines.push(`- Drift alert positive rate: ${report.snapshots.release_gate_history.drift_alert_positive_rate_percent == null ? 'n/a' : `${report.snapshots.release_gate_history.drift_alert_positive_rate_percent}%`}`);
  lines.push('');
  lines.push('## Interactive Governance');
  lines.push('');
  lines.push(`- Status: ${report.snapshots.interactive_governance.status || 'n/a'}`);
  lines.push(`- Breaches: ${report.snapshots.interactive_governance.breaches == null ? 'n/a' : report.snapshots.interactive_governance.breaches}`);
  lines.push(`- Warnings: ${report.snapshots.interactive_governance.warnings == null ? 'n/a' : report.snapshots.interactive_governance.warnings}`);
  lines.push(`- Authorization tier signals: ${report.snapshots.interactive_governance.authorization_tier_total == null ? 'n/a' : report.snapshots.interactive_governance.authorization_tier_total}`);
  lines.push(`- Authorization tier deny total: ${report.snapshots.interactive_governance.authorization_tier_deny_total == null ? 'n/a' : report.snapshots.interactive_governance.authorization_tier_deny_total}`);
  lines.push(`- Authorization tier review-required total: ${report.snapshots.interactive_governance.authorization_tier_review_required_total == null ? 'n/a' : report.snapshots.interactive_governance.authorization_tier_review_required_total}`);
  lines.push(`- Authorization tier block rate: ${report.snapshots.interactive_governance.authorization_tier_block_rate_percent == null ? 'n/a' : `${report.snapshots.interactive_governance.authorization_tier_block_rate_percent}%`}`);
  lines.push(`- Dialogue authorization signals: ${report.snapshots.interactive_governance.dialogue_authorization_total == null ? 'n/a' : report.snapshots.interactive_governance.dialogue_authorization_total}`);
  lines.push(`- Dialogue authorization block total: ${report.snapshots.interactive_governance.dialogue_authorization_block_total == null ? 'n/a' : report.snapshots.interactive_governance.dialogue_authorization_block_total}`);
  lines.push(`- Dialogue authorization block rate: ${report.snapshots.interactive_governance.dialogue_authorization_block_rate_percent == null ? 'n/a' : `${report.snapshots.interactive_governance.dialogue_authorization_block_rate_percent}%`}`);
  lines.push(`- Dialogue user-app apply attempts: ${report.snapshots.interactive_governance.dialogue_authorization_user_app_apply_attempt_total == null ? 'n/a' : report.snapshots.interactive_governance.dialogue_authorization_user_app_apply_attempt_total}`);
  lines.push(`- Runtime signals: ${report.snapshots.interactive_governance.runtime_total == null ? 'n/a' : report.snapshots.interactive_governance.runtime_total}`);
  lines.push(`- Runtime block rate: ${report.snapshots.interactive_governance.runtime_block_rate_percent == null ? 'n/a' : `${report.snapshots.interactive_governance.runtime_block_rate_percent}%`}`);
  lines.push(`- Runtime ui-mode violations: ${report.snapshots.interactive_governance.runtime_ui_mode_violation_total == null ? 'n/a' : report.snapshots.interactive_governance.runtime_ui_mode_violation_total}`);
  lines.push('');
  lines.push('## Matrix Signals');
  lines.push('');
  lines.push(`- Total signals: ${report.snapshots.matrix_signals.total_signals}`);
  lines.push(`- Portfolio pass rate: ${report.snapshots.matrix_signals.portfolio_pass_rate_percent == null ? 'n/a' : `${report.snapshots.matrix_signals.portfolio_pass_rate_percent}%`}`);
  lines.push(`- Regression-positive rate: ${report.snapshots.matrix_signals.regression_positive_rate_percent == null ? 'n/a' : `${report.snapshots.matrix_signals.regression_positive_rate_percent}%`}`);
  lines.push(`- Stage error rate: ${report.snapshots.matrix_signals.stage_error_rate_percent == null ? 'n/a' : `${report.snapshots.matrix_signals.stage_error_rate_percent}%`}`);
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');
  lines.push('## Concerns');
  lines.push('');
  if (report.health.concerns.length === 0) {
    lines.push('- none');
  } else {
    for (const concern of report.health.concerns) {
      lines.push(`- ${concern}`);
    }
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const recommendation of report.health.recommendations) {
    lines.push(`- ${recommendation}`);
  }
  return `${lines.join('\n')}\n`;
}

async function buildReleaseOpsWeeklySummary(cwd, options, now = new Date()) {
  const window = buildWindow(options, now);
  const [evidenceInput, gateHistoryInput, governanceInput, matrixSignalsInput] = await Promise.all([
    safeReadJson(cwd, options.evidence),
    safeReadJson(cwd, options.gateHistory),
    safeReadJson(cwd, options.interactiveGovernance),
    safeReadJsonLines(cwd, options.matrixSignals)
  ]);

  const warnings = [];
  const collectWarning = (label, input) => {
    if (!input.exists) {
      warnings.push(`${label}: missing (${input.path})`);
      return;
    }
    if (input.parse_error) {
      warnings.push(`${label}: parse error (${input.path}) ${input.parse_error}`);
    }
  };
  collectWarning('evidence', evidenceInput);
  collectWarning('gate_history', gateHistoryInput);
  collectWarning('interactive_governance', governanceInput);
  collectWarning('matrix_signals', matrixSignalsInput);

  const snapshots = {
    handoff: buildHandoffSnapshot(evidenceInput.payload || {}, window),
    release_gate_history: buildReleaseGateHistorySnapshot(gateHistoryInput.payload || {}, window),
    interactive_governance: buildInteractiveGovernanceSnapshot(governanceInput.payload || {}, window),
    matrix_signals: buildMatrixSignalSnapshot(matrixSignalsInput.records || [], window)
  };

  const health = buildHealth(snapshots, warnings);
  const outPath = resolvePath(cwd, options.out);
  const markdownOutPath = resolvePath(cwd, options.markdownOut);

  const report = {
    mode: 'release-weekly-ops-summary',
    generated_at: now.toISOString(),
    period: {
      mode: window.mode,
      window_days: options.windowDays,
      from: window.from.toISOString(),
      to: window.to.toISOString()
    },
    inputs: {
      evidence: evidenceInput,
      gate_history: gateHistoryInput,
      interactive_governance: governanceInput,
      matrix_signals: {
        path: matrixSignalsInput.path,
        exists: matrixSignalsInput.exists,
        parse_error: matrixSignalsInput.parse_error
      }
    },
    warnings,
    snapshots,
    health,
    output: {
      json: path.relative(cwd, outPath) || '.',
      markdown: path.relative(cwd, markdownOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(report), 'utf8');

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const report = await buildReleaseOpsWeeklySummary(cwd, options, new Date());
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Release weekly ops summary generated (${report.health.risk}).\n`);
    process.stdout.write(`- JSON: ${report.output.json}\n`);
    process.stdout.write(`- Markdown: ${report.output.markdown}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Release weekly ops summary failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_EVIDENCE,
  DEFAULT_GATE_HISTORY,
  DEFAULT_INTERACTIVE_GOVERNANCE,
  DEFAULT_MATRIX_SIGNALS,
  DEFAULT_OUT,
  DEFAULT_MARKDOWN_OUT,
  parseArgs,
  buildWindow,
  safeReadJson,
  safeReadJsonLines,
  buildHandoffSnapshot,
  buildReleaseGateHistorySnapshot,
  buildInteractiveGovernanceSnapshot,
  buildMatrixSignalSnapshot,
  buildHealth,
  buildMarkdown,
  buildReleaseOpsWeeklySummary,
  main
};
