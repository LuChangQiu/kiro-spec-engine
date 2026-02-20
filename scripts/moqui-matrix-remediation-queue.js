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
const DEFAULT_PHASE_HIGH_PARALLEL = 1;
const DEFAULT_PHASE_HIGH_AGENT_BUDGET = 2;
const DEFAULT_PHASE_MEDIUM_PARALLEL = 1;
const DEFAULT_PHASE_MEDIUM_AGENT_BUDGET = 2;
const DEFAULT_PHASE_COOLDOWN_SECONDS = 30;

function parseArgs(argv) {
  const options = {
    baseline: DEFAULT_BASELINE,
    out: DEFAULT_OUT,
    linesOut: DEFAULT_LINES_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    batchJsonOut: DEFAULT_BATCH_JSON_OUT,
    commandsOut: DEFAULT_COMMANDS_OUT,
    phaseSplit: true,
    phaseHighLinesOut: null,
    phaseMediumLinesOut: null,
    phaseHighGoalsOut: null,
    phaseMediumGoalsOut: null,
    phaseHighParallel: DEFAULT_PHASE_HIGH_PARALLEL,
    phaseHighAgentBudget: DEFAULT_PHASE_HIGH_AGENT_BUDGET,
    phaseMediumParallel: DEFAULT_PHASE_MEDIUM_PARALLEL,
    phaseMediumAgentBudget: DEFAULT_PHASE_MEDIUM_AGENT_BUDGET,
    phaseCooldownSeconds: DEFAULT_PHASE_COOLDOWN_SECONDS,
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
    } else if (token === '--no-phase-split') {
      options.phaseSplit = false;
    } else if (token === '--phase-high-lines-out' && next) {
      options.phaseHighLinesOut = next;
      index += 1;
    } else if (token === '--phase-medium-lines-out' && next) {
      options.phaseMediumLinesOut = next;
      index += 1;
    } else if (token === '--phase-high-goals-out' && next) {
      options.phaseHighGoalsOut = next;
      index += 1;
    } else if (token === '--phase-medium-goals-out' && next) {
      options.phaseMediumGoalsOut = next;
      index += 1;
    } else if (token === '--phase-high-parallel' && next) {
      options.phaseHighParallel = Number(next);
      index += 1;
    } else if (token === '--phase-high-agent-budget' && next) {
      options.phaseHighAgentBudget = Number(next);
      index += 1;
    } else if (token === '--phase-medium-parallel' && next) {
      options.phaseMediumParallel = Number(next);
      index += 1;
    } else if (token === '--phase-medium-agent-budget' && next) {
      options.phaseMediumAgentBudget = Number(next);
      index += 1;
    } else if (token === '--phase-cooldown-seconds' && next) {
      options.phaseCooldownSeconds = Number(next);
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
  if (!Number.isFinite(options.phaseHighParallel) || options.phaseHighParallel < 1) {
    throw new Error('--phase-high-parallel must be a positive number.');
  }
  if (!Number.isFinite(options.phaseHighAgentBudget) || options.phaseHighAgentBudget < 1) {
    throw new Error('--phase-high-agent-budget must be a positive number.');
  }
  if (!Number.isFinite(options.phaseMediumParallel) || options.phaseMediumParallel < 1) {
    throw new Error('--phase-medium-parallel must be a positive number.');
  }
  if (!Number.isFinite(options.phaseMediumAgentBudget) || options.phaseMediumAgentBudget < 1) {
    throw new Error('--phase-medium-agent-budget must be a positive number.');
  }
  if (!Number.isFinite(options.phaseCooldownSeconds) || options.phaseCooldownSeconds < 0) {
    throw new Error('--phase-cooldown-seconds must be a non-negative number.');
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
    '  --no-phase-split       Disable priority split outputs (high/medium phase files)',
    '  --phase-high-lines-out <path>  High-priority queue lines output path',
    '  --phase-medium-lines-out <path> Medium-priority queue lines output path',
    '  --phase-high-goals-out <path>  High-priority goals JSON output path',
    '  --phase-medium-goals-out <path> Medium-priority goals JSON output path',
    `  --phase-high-parallel <n>      Suggested close-loop-batch parallel for high phase (default: ${DEFAULT_PHASE_HIGH_PARALLEL})`,
    `  --phase-high-agent-budget <n>  Suggested agent budget for high phase (default: ${DEFAULT_PHASE_HIGH_AGENT_BUDGET})`,
    `  --phase-medium-parallel <n>    Suggested close-loop-batch parallel for medium phase (default: ${DEFAULT_PHASE_MEDIUM_PARALLEL})`,
    `  --phase-medium-agent-budget <n> Suggested agent budget for medium phase (default: ${DEFAULT_PHASE_MEDIUM_AGENT_BUDGET})`,
    `  --phase-cooldown-seconds <n>   Suggested cooldown seconds between phases (default: ${DEFAULT_PHASE_COOLDOWN_SECONDS})`,
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

function derivePhasePath(basePath, phaseName) {
  const parsed = path.parse(basePath);
  return path.join(parsed.dir, `${parsed.name}.${phaseName}${parsed.ext}`);
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
  const executionPolicy = payload && payload.execution_policy ? payload.execution_policy : {};
  const baselinePath = payload && payload.baseline && payload.baseline.path
    ? payload.baseline.path
    : DEFAULT_BASELINE;
  const linesOut = artifacts.lines_out || DEFAULT_LINES_OUT;
  const batchJsonOut = artifacts.batch_json_out || DEFAULT_BATCH_JSON_OUT;
  const highLinesOut = artifacts.phase_high_lines_out || null;
  const mediumLinesOut = artifacts.phase_medium_lines_out || null;
  const highGoalsOut = artifacts.phase_high_goals_out || null;
  const mediumGoalsOut = artifacts.phase_medium_goals_out || null;
  const highParallel = Number.isFinite(Number(executionPolicy.phase_high_parallel))
    ? Number(executionPolicy.phase_high_parallel)
    : DEFAULT_PHASE_HIGH_PARALLEL;
  const highAgentBudget = Number.isFinite(Number(executionPolicy.phase_high_agent_budget))
    ? Number(executionPolicy.phase_high_agent_budget)
    : DEFAULT_PHASE_HIGH_AGENT_BUDGET;
  const mediumParallel = Number.isFinite(Number(executionPolicy.phase_medium_parallel))
    ? Number(executionPolicy.phase_medium_parallel)
    : DEFAULT_PHASE_MEDIUM_PARALLEL;
  const mediumAgentBudget = Number.isFinite(Number(executionPolicy.phase_medium_agent_budget))
    ? Number(executionPolicy.phase_medium_agent_budget)
    : DEFAULT_PHASE_MEDIUM_AGENT_BUDGET;
  const cooldownSeconds = Number.isFinite(Number(executionPolicy.phase_cooldown_seconds))
    ? Number(executionPolicy.phase_cooldown_seconds)
    : DEFAULT_PHASE_COOLDOWN_SECONDS;
  lines.push('# Matrix Remediation Commands');
  lines.push('');
  lines.push('## Batch Mode');
  lines.push('');
  lines.push(`- JSON goals: \`sce auto close-loop-batch ${quoteCliArg(batchJsonOut)} --format json --json\``);
  lines.push(`- Lines goals: \`sce auto close-loop-batch ${quoteCliArg(linesOut)} --format lines --json\``);
  if (highLinesOut && mediumLinesOut && highGoalsOut && mediumGoalsOut) {
    lines.push('');
    lines.push('## Rate-Limit Safe Phased Mode');
    lines.push('');
    lines.push('1. High-priority phase (low parallel):');
    lines.push(`   - \`sce auto close-loop-batch ${quoteCliArg(highGoalsOut)} --format json --batch-parallel ${highParallel} --batch-agent-budget ${highAgentBudget} --batch-retry-until-complete --batch-retry-max-rounds 3 --json\``);
    lines.push('2. Cooldown before next phase:');
    lines.push(`   - \`sleep ${cooldownSeconds}\``);
    lines.push('3. Medium-priority phase:');
    lines.push(`   - \`sce auto close-loop-batch ${quoteCliArg(mediumGoalsOut)} --format json --batch-parallel ${mediumParallel} --batch-agent-budget ${mediumAgentBudget} --batch-retry-until-complete --batch-retry-max-rounds 2 --json\``);
    lines.push('4. Optional lines fallback:');
    lines.push(`   - high: \`sce auto close-loop-batch ${quoteCliArg(highLinesOut)} --format lines --json\``);
    lines.push(`   - medium: \`sce auto close-loop-batch ${quoteCliArg(mediumLinesOut)} --format lines --json\``);
    lines.push('5. One-shot phased runner:');
    lines.push(`   - \`node scripts/moqui-matrix-remediation-phased-runner.js --high-goals ${quoteCliArg(highGoalsOut)} --medium-goals ${quoteCliArg(mediumGoalsOut)} --high-lines ${quoteCliArg(highLinesOut)} --medium-lines ${quoteCliArg(mediumLinesOut)} --phase-high-parallel ${highParallel} --phase-high-agent-budget ${highAgentBudget} --phase-medium-parallel ${mediumParallel} --phase-medium-agent-budget ${mediumAgentBudget} --phase-cooldown-seconds ${cooldownSeconds} --json\``);
    lines.push('6. One-shot from baseline (prepare + run):');
    lines.push(`   - \`node scripts/moqui-matrix-remediation-phased-runner.js --baseline ${quoteCliArg(baselinePath)} --high-goals ${quoteCliArg(highGoalsOut)} --medium-goals ${quoteCliArg(mediumGoalsOut)} --high-lines ${quoteCliArg(highLinesOut)} --medium-lines ${quoteCliArg(mediumLinesOut)} --phase-high-parallel ${highParallel} --phase-high-agent-budget ${highAgentBudget} --phase-medium-parallel ${mediumParallel} --phase-medium-agent-budget ${mediumAgentBudget} --phase-cooldown-seconds ${cooldownSeconds} --json\``);
  }
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
  const phaseHighLinesOutPath = options.phaseHighLinesOut
    ? resolvePath(cwd, options.phaseHighLinesOut)
    : derivePhasePath(linesOutPath, 'high');
  const phaseMediumLinesOutPath = options.phaseMediumLinesOut
    ? resolvePath(cwd, options.phaseMediumLinesOut)
    : derivePhasePath(linesOutPath, 'medium');
  const phaseHighGoalsOutPath = options.phaseHighGoalsOut
    ? resolvePath(cwd, options.phaseHighGoalsOut)
    : derivePhasePath(batchJsonOutPath, 'high');
  const phaseMediumGoalsOutPath = options.phaseMediumGoalsOut
    ? resolvePath(cwd, options.phaseMediumGoalsOut)
    : derivePhasePath(batchJsonOutPath, 'medium');
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
  const highItems = items.filter(item => item && item.priority === 'high');
  const mediumItems = items.filter(item => !item || item.priority !== 'high');
  const queueLines = items.map(item => item.goal);
  const highQueueLines = highItems.map(item => item.goal);
  const mediumQueueLines = mediumItems.map(item => item.goal);

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
    execution_policy: {
      phase_split: options.phaseSplit === true,
      phase_high_parallel: Number(options.phaseHighParallel),
      phase_high_agent_budget: Number(options.phaseHighAgentBudget),
      phase_medium_parallel: Number(options.phaseMediumParallel),
      phase_medium_agent_budget: Number(options.phaseMediumAgentBudget),
      phase_cooldown_seconds: Number(options.phaseCooldownSeconds)
    },
    summary: {
      regressions_total: regressions.length,
      selected_regressions: items.length,
      phase_high_count: highItems.length,
      phase_medium_count: mediumItems.length
    },
    items,
    artifacts: {
      out: path.relative(cwd, outPath) || '.',
      lines_out: path.relative(cwd, linesOutPath) || '.',
      markdown_out: path.relative(cwd, markdownOutPath) || '.',
      batch_json_out: path.relative(cwd, batchJsonOutPath) || '.',
      commands_out: path.relative(cwd, commandsOutPath) || '.',
      phase_high_lines_out: options.phaseSplit ? (path.relative(cwd, phaseHighLinesOutPath) || '.') : null,
      phase_medium_lines_out: options.phaseSplit ? (path.relative(cwd, phaseMediumLinesOutPath) || '.') : null,
      phase_high_goals_out: options.phaseSplit ? (path.relative(cwd, phaseHighGoalsOutPath) || '.') : null,
      phase_medium_goals_out: options.phaseSplit ? (path.relative(cwd, phaseMediumGoalsOutPath) || '.') : null
    }
  };

  await fs.ensureDir(path.dirname(linesOutPath));
  await fs.writeFile(linesOutPath, queueLines.join('\n') + (queueLines.length > 0 ? '\n' : ''), 'utf8');
  await fs.ensureDir(path.dirname(batchJsonOutPath));
  await fs.writeJson(batchJsonOutPath, buildBatchGoalsPayload(items), { spaces: 2 });
  if (options.phaseSplit) {
    await fs.ensureDir(path.dirname(phaseHighLinesOutPath));
    await fs.writeFile(phaseHighLinesOutPath, highQueueLines.join('\n') + (highQueueLines.length > 0 ? '\n' : ''), 'utf8');
    await fs.ensureDir(path.dirname(phaseMediumLinesOutPath));
    await fs.writeFile(phaseMediumLinesOutPath, mediumQueueLines.join('\n') + (mediumQueueLines.length > 0 ? '\n' : ''), 'utf8');
    await fs.ensureDir(path.dirname(phaseHighGoalsOutPath));
    await fs.writeJson(phaseHighGoalsOutPath, buildBatchGoalsPayload(highItems), { spaces: 2 });
    await fs.ensureDir(path.dirname(phaseMediumGoalsOutPath));
    await fs.writeJson(phaseMediumGoalsOutPath, buildBatchGoalsPayload(mediumItems), { spaces: 2 });
  }
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
  DEFAULT_PHASE_HIGH_PARALLEL,
  DEFAULT_PHASE_HIGH_AGENT_BUDGET,
  DEFAULT_PHASE_MEDIUM_PARALLEL,
  DEFAULT_PHASE_MEDIUM_AGENT_BUDGET,
  DEFAULT_PHASE_COOLDOWN_SECONDS,
  parseArgs,
  resolvePath,
  derivePhasePath,
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
