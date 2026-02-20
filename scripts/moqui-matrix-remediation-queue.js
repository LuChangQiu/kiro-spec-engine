#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_BASELINE = '.kiro/reports/release-evidence/moqui-template-baseline.json';
const DEFAULT_OUT = '.kiro/reports/release-evidence/matrix-remediation-plan.json';
const DEFAULT_LINES_OUT = '.kiro/auto/matrix-remediation.lines';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/release-evidence/matrix-remediation-plan.md';

function parseArgs(argv) {
  const options = {
    baseline: DEFAULT_BASELINE,
    out: DEFAULT_OUT,
    linesOut: DEFAULT_LINES_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    minDeltaAbs: 0,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--baseline' && next) {
      options.baseline = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--lines-out' && next) {
      options.linesOut = next;
      index += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      index += 1;
    } else if (token === '--min-delta-abs' && next) {
      options.minDeltaAbs = Number(next);
      index += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.minDeltaAbs) || options.minDeltaAbs < 0) {
    throw new Error('--min-delta-abs must be a non-negative number.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-matrix-remediation-queue.js [options]',
    '',
    'Options:',
    `  --baseline <path>      Baseline report JSON path (default: ${DEFAULT_BASELINE})`,
    `  --out <path>           Remediation plan JSON output (default: ${DEFAULT_OUT})`,
    `  --lines-out <path>     Queue lines output for close-loop-batch (default: ${DEFAULT_LINES_OUT})`,
    `  --markdown-out <path>  Remediation markdown output (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --min-delta-abs <n>    Skip regressions with absolute delta < n (default: 0)',
    '  --json                 Print payload as JSON',
    '  -h, --help             Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function pickRegressions(payload) {
  const compare = payload && payload.compare && typeof payload.compare === 'object'
    ? payload.compare
    : {};
  if (Array.isArray(compare.coverage_matrix_regressions)) {
    return compare.coverage_matrix_regressions;
  }
  if (Array.isArray(compare.regressions)) {
    return compare.regressions;
  }
  return [];
}

function metricToFocus(metric = '') {
  const normalized = `${metric || ''}`.trim().toLowerCase();
  const map = {
    graph_valid: 'ontology graph consistency',
    score_passed: 'semantic score uplift',
    entity_coverage: 'entity modeling coverage',
    relation_coverage: 'relation modeling coverage',
    business_rule_coverage: 'business rule extraction coverage',
    business_rule_closed: 'business rule mapping closure',
    decision_coverage: 'decision logic extraction coverage',
    decision_closed: 'decision closure completeness',
    baseline_passed: 'portfolio baseline closure'
  };
  return map[normalized] || 'template quality closure';
}

function buildQueueItem(regression = {}, index = 0) {
  const metric = regression && regression.metric ? String(regression.metric) : 'unknown_metric';
  const delta = Number(regression && regression.delta_rate_percent);
  const deltaValue = Number.isFinite(delta) ? Number(delta.toFixed(2)) : null;
  const focus = metricToFocus(metric);
  const priority = Number.isFinite(deltaValue) && deltaValue <= -20 ? 'high' : 'medium';
  const goal = `Recover matrix regression for ${metric} (${deltaValue == null ? 'n/a' : `${deltaValue}%`}) by closing ${focus} in Moqui scene templates.`;
  return {
    id: `matrix-remediate-${index + 1}`,
    metric,
    delta_rate_percent: deltaValue,
    focus,
    priority,
    goal
  };
}

function buildMarkdown(payload) {
  const lines = [];
  lines.push('# Matrix Remediation Plan');
  lines.push('');
  lines.push(`- Generated at: ${payload.generated_at}`);
  lines.push(`- Baseline: ${payload.baseline.path}`);
  lines.push(`- Regressions selected: ${payload.summary.selected_regressions}`);
  lines.push(`- Queue lines: ${payload.artifacts.lines_out}`);
  lines.push('');
  lines.push('## Queue');
  lines.push('');
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }
  for (const item of payload.items) {
    lines.push(`- [${item.priority}] ${item.goal}`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const baselinePath = resolvePath(cwd, options.baseline);
  const outPath = resolvePath(cwd, options.out);
  const linesOutPath = resolvePath(cwd, options.linesOut);
  const markdownOutPath = resolvePath(cwd, options.markdownOut);
  const baselineExists = await fs.pathExists(baselinePath);
  if (!baselineExists) {
    throw new Error(`baseline file not found: ${path.relative(cwd, baselinePath) || baselinePath}`);
  }

  const baselinePayload = await fs.readJson(baselinePath);
  const regressions = pickRegressions(baselinePayload);
  const minDeltaAbs = Number(options.minDeltaAbs);
  const filtered = regressions.filter((item) => {
    const delta = Number(item && item.delta_rate_percent);
    return Number.isFinite(delta) && Math.abs(delta) >= minDeltaAbs;
  });
  const items = filtered.map((item, index) => buildQueueItem(item, index));
  const queueLines = items.map(item => item.goal);

  const payload = {
    mode: 'moqui-matrix-remediation-queue',
    generated_at: new Date().toISOString(),
    baseline: {
      path: path.relative(cwd, baselinePath) || '.'
    },
    policy: {
      min_delta_abs: minDeltaAbs
    },
    summary: {
      regressions_total: regressions.length,
      selected_regressions: items.length
    },
    items,
    artifacts: {
      out: path.relative(cwd, outPath) || '.',
      lines_out: path.relative(cwd, linesOutPath) || '.',
      markdown_out: path.relative(cwd, markdownOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(linesOutPath));
  await fs.writeFile(linesOutPath, queueLines.join('\n') + (queueLines.length > 0 ? '\n' : ''), 'utf8');
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(payload), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write('Moqui matrix remediation queue generated.\n');
    process.stdout.write(`- Regressions selected: ${payload.summary.selected_regressions}\n`);
    process.stdout.write(`- Queue lines: ${payload.artifacts.lines_out}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Moqui matrix remediation queue failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_BASELINE,
  DEFAULT_OUT,
  DEFAULT_LINES_OUT,
  DEFAULT_MARKDOWN_OUT,
  parseArgs,
  resolvePath,
  pickRegressions,
  metricToFocus,
  buildQueueItem,
  buildMarkdown,
  main
};
