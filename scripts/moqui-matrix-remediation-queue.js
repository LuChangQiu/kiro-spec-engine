#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_BASELINE = '.kiro/reports/release-evidence/moqui-template-baseline.json';
const DEFAULT_OUT = '.kiro/reports/release-evidence/matrix-remediation-plan.json';
const DEFAULT_LINES_OUT = '.kiro/auto/matrix-remediation.lines';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/release-evidence/matrix-remediation-plan.md';
const DEFAULT_BATCH_JSON_OUT = '.kiro/auto/matrix-remediation.goals.json';
const DEFAULT_COMMANDS_OUT = '.kiro/reports/release-evidence/matrix-remediation-commands.md';
const DEFAULT_TOP_TEMPLATES = 5;

function parseArgs(argv) {
  const options = {
    baseline: DEFAULT_BASELINE,
    out: DEFAULT_OUT,
    linesOut: DEFAULT_LINES_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    batchJsonOut: DEFAULT_BATCH_JSON_OUT,
    commandsOut: DEFAULT_COMMANDS_OUT,
    minDeltaAbs: 0,
    topTemplates: DEFAULT_TOP_TEMPLATES,
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
    } else if (token === '--batch-json-out' && next) {
      options.batchJsonOut = next;
      index += 1;
    } else if (token === '--commands-out' && next) {
      options.commandsOut = next;
      index += 1;
    } else if (token === '--min-delta-abs' && next) {
      options.minDeltaAbs = Number(next);
      index += 1;
    } else if (token === '--top-templates' && next) {
      options.topTemplates = Number(next);
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
  if (!Number.isFinite(options.topTemplates) || options.topTemplates < 1) {
    throw new Error('--top-templates must be a positive number.');
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
    `  --batch-json-out <path> Batch goals JSON output for close-loop-batch (default: ${DEFAULT_BATCH_JSON_OUT})`,
    `  --commands-out <path>  Suggested command list markdown (default: ${DEFAULT_COMMANDS_OUT})`,
    '  --min-delta-abs <n>    Skip regressions with absolute delta < n (default: 0)',
    `  --top-templates <n>    Max affected templates listed per remediation (default: ${DEFAULT_TOP_TEMPLATES})`,
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

function metricToFlag(metric = '') {
  const normalized = `${metric || ''}`.trim().toLowerCase();
  const map = {
    graph_valid: 'graph_valid',
    score_passed: 'score_passed',
    entity_coverage: 'entity_coverage',
    relation_coverage: 'relation_coverage',
    business_rule_coverage: 'business_rule_coverage',
    business_rule_closed: 'business_rule_closed',
    decision_coverage: 'decision_coverage',
    decision_closed: 'decision_closed',
    baseline_passed: 'baseline_passed'
  };
  return map[normalized] || null;
}

function deriveCapabilitiesFromTemplateId(templateId = '') {
  const text = `${templateId || ''}`.toLowerCase();
  const normalized = text
    .replace(/^sce\.scene--/g, '')
    .replace(/^kse\.scene--/g, '')
    .replace(/--\d+\.\d+\.\d+$/g, '')
    .replace(/[._]/g, '-');
  const parts = normalized
    .split('-')
    .map(item => item.trim())
    .filter(item => item.length > 2 && !['scene', 'template', 'moqui', 'suite', 'erp'].includes(item));
  return Array.from(new Set(parts)).slice(0, 6);
}

function collectTemplateCandidates(baselinePayload = {}, metric = '', topTemplates = DEFAULT_TOP_TEMPLATES) {
  const templates = Array.isArray(baselinePayload && baselinePayload.templates)
    ? baselinePayload.templates
    : [];
  const flagName = metricToFlag(metric);
  const filtered = templates.filter((item) => {
    if (!item || !item.baseline || !item.baseline.flags) {
      return false;
    }
    if (!flagName) {
      return item.baseline.flags.baseline_passed !== true;
    }
    return item.baseline.flags[flagName] !== true;
  });

  const scored = filtered.map((item) => {
    const score = Number(item && item.semantic ? item.semantic.score : null);
    const gaps = Array.isArray(item && item.baseline ? item.baseline.gaps : [])
      ? item.baseline.gaps
      : [];
    const capabilities = Array.isArray(item && item.capabilities_provides)
      ? item.capabilities_provides
      : deriveCapabilitiesFromTemplateId(item && item.template_id ? item.template_id : '');
    return {
      template_id: item && item.template_id ? item.template_id : null,
      score: Number.isFinite(score) ? score : null,
      gaps,
      capabilities
    };
  });

  scored.sort((a, b) => {
    const scoreA = Number.isFinite(Number(a.score)) ? Number(a.score) : 999;
    const scoreB = Number.isFinite(Number(b.score)) ? Number(b.score) : 999;
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return (b.gaps.length || 0) - (a.gaps.length || 0);
  });

  return scored.slice(0, Math.max(1, Number(topTemplates)));
}

function buildQueueItem(regression = {}, index = 0, baselinePayload = {}, topTemplates = DEFAULT_TOP_TEMPLATES) {
  const metric = regression && regression.metric ? String(regression.metric) : 'unknown_metric';
  const delta = Number(regression && regression.delta_rate_percent);
  const deltaValue = Number.isFinite(delta) ? Number(delta.toFixed(2)) : null;
  const focus = metricToFocus(metric);
  const priority = Number.isFinite(deltaValue) && deltaValue <= -20 ? 'high' : 'medium';
  const templates = collectTemplateCandidates(baselinePayload, metric, topTemplates);
  const templateIds = templates
    .map(item => item.template_id)
    .filter(Boolean);
  const capabilityFocus = Array.from(new Set(
    templates.flatMap(item => Array.isArray(item.capabilities) ? item.capabilities : [])
  )).slice(0, 10);
  const goal = `Recover matrix regression for ${metric} (${deltaValue == null ? 'n/a' : `${deltaValue}%`}) by closing ${focus} in templates: ${templateIds.length > 0 ? templateIds.join(', ') : 'TBD'}.`;
  return {
    id: `matrix-remediate-${index + 1}`,
    metric,
    delta_rate_percent: deltaValue,
    focus,
    priority,
    template_candidates: templates,
    capability_focus: capabilityFocus,
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
    const capabilities = Array.isArray(item.capability_focus) && item.capability_focus.length > 0
      ? item.capability_focus.join(', ')
      : 'n/a';
    lines.push(`- [${item.priority}] ${item.goal}`);
    lines.push(`  - capability focus: ${capabilities}`);
  }
  return `${lines.join('\n')}\n`;
}

function quoteCliArg(value = '') {
  const text = `${value || ''}`;
  if (!text) {
    return '""';
  }
  if (/^[\w./\\:-]+$/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '\\"')}"`;
}

function buildBatchGoalsPayload(items = []) {
  return {
    goals: (Array.isArray(items) ? items : [])
      .map(item => item && item.goal ? String(item.goal).trim() : '')
      .filter(Boolean)
  };
}

function buildCommandsMarkdown(payload = {}) {
  const lines = [];
  const artifacts = payload && payload.artifacts ? payload.artifacts : {};
  const linesOut = artifacts.lines_out || DEFAULT_LINES_OUT;
  const batchJsonOut = artifacts.batch_json_out || DEFAULT_BATCH_JSON_OUT;
  lines.push('# Matrix Remediation Commands');
  lines.push('');
  lines.push('## Batch Mode');
  lines.push('');
  lines.push(`- JSON goals: \`sce auto close-loop-batch ${quoteCliArg(batchJsonOut)} --format json --json\``);
  lines.push(`- Lines goals: \`sce auto close-loop-batch ${quoteCliArg(linesOut)} --format lines --json\``);
  lines.push('');
  lines.push('## Per Goal');
  lines.push('');
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }
  for (const item of payload.items) {
    const goal = item && item.goal ? String(item.goal) : '';
    lines.push(`- \`sce auto close-loop ${quoteCliArg(goal)} --json\``);
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
  const batchJsonOutPath = resolvePath(cwd, options.batchJsonOut);
  const commandsOutPath = resolvePath(cwd, options.commandsOut);
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
  const items = filtered.map((item, index) => buildQueueItem(item, index, baselinePayload, options.topTemplates));
  const queueLines = items.map(item => item.goal);

  const payload = {
    mode: 'moqui-matrix-remediation-queue',
    generated_at: new Date().toISOString(),
    baseline: {
      path: path.relative(cwd, baselinePath) || '.'
    },
    policy: {
      min_delta_abs: minDeltaAbs,
      top_templates: Number(options.topTemplates)
    },
    summary: {
      regressions_total: regressions.length,
      selected_regressions: items.length
    },
    items,
    artifacts: {
      out: path.relative(cwd, outPath) || '.',
      lines_out: path.relative(cwd, linesOutPath) || '.',
      markdown_out: path.relative(cwd, markdownOutPath) || '.',
      batch_json_out: path.relative(cwd, batchJsonOutPath) || '.',
      commands_out: path.relative(cwd, commandsOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(linesOutPath));
  await fs.writeFile(linesOutPath, queueLines.join('\n') + (queueLines.length > 0 ? '\n' : ''), 'utf8');
  await fs.ensureDir(path.dirname(batchJsonOutPath));
  await fs.writeJson(batchJsonOutPath, buildBatchGoalsPayload(items), { spaces: 2 });
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(payload), 'utf8');
  await fs.ensureDir(path.dirname(commandsOutPath));
  await fs.writeFile(commandsOutPath, buildCommandsMarkdown(payload), 'utf8');

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
  DEFAULT_BATCH_JSON_OUT,
  DEFAULT_COMMANDS_OUT,
  DEFAULT_TOP_TEMPLATES,
  parseArgs,
  resolvePath,
  pickRegressions,
  metricToFocus,
  metricToFlag,
  deriveCapabilitiesFromTemplateId,
  collectTemplateCandidates,
  buildQueueItem,
  buildMarkdown,
  quoteCliArg,
  buildBatchGoalsPayload,
  buildCommandsMarkdown,
  main
};
