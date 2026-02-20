#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_GATE_REPORT = '.kiro/reports/release-evidence/release-gate.json';
const DEFAULT_OUT = '.kiro/reports/release-evidence/release-risk-remediation-bundle.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/release-evidence/release-risk-remediation-bundle.md';
const DEFAULT_LINES_OUT = '.kiro/reports/release-evidence/release-risk-remediation.commands.lines';

function parseArgs(argv) {
  const options = {
    gateReport: DEFAULT_GATE_REPORT,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    linesOut: DEFAULT_LINES_OUT,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--gate-report' && next) {
      options.gateReport = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--lines-out' && next) {
      options.linesOut = next;
      i += 1;
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
    'Usage: node scripts/release-risk-remediation-bundle.js [options]',
    '',
    'Options:',
    `  --gate-report <path>   release gate report JSON (default: ${DEFAULT_GATE_REPORT})`,
    `  --out <path>           JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    `  --lines-out <path>     Command lines output path (default: ${DEFAULT_LINES_OUT})`,
    '  --json                 Print JSON payload',
    '  -h, --help             Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeText(value) {
  return `${value || ''}`.trim();
}

function uniquePush(target, seen, value) {
  const text = normalizeText(value);
  if (!text || seen.has(text)) {
    return;
  }
  seen.add(text);
  target.push(text);
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

function buildRemediationPlan(gatePayload) {
  const commands = [];
  const recommendations = [];
  const reasons = [];
  const seenCommands = new Set();
  const seenRecommendations = new Set();
  const seenReasons = new Set();
  const addCommand = (cmd) => uniquePush(commands, seenCommands, cmd);
  const addRecommendation = (text) => uniquePush(recommendations, seenRecommendations, text);
  const addReason = (text) => uniquePush(reasons, seenReasons, text);

  const weeklyOps = gatePayload && gatePayload.weekly_ops && typeof gatePayload.weekly_ops === 'object'
    ? gatePayload.weekly_ops
    : {};
  const weeklySignals = weeklyOps && weeklyOps.signals && typeof weeklyOps.signals === 'object'
    ? weeklyOps.signals
    : {};
  const weeklyViolations = Array.isArray(weeklyOps.violations) ? weeklyOps.violations : [];
  const weeklyBlocked = weeklyOps.blocked === true;

  const drift = gatePayload && gatePayload.drift && typeof gatePayload.drift === 'object'
    ? gatePayload.drift
    : {};
  const driftAlerts = Array.isArray(drift.alerts) ? drift.alerts : [];
  const driftBlocked = drift.blocked === true;

  if (weeklyBlocked || weeklyViolations.length > 0) {
    addReason('weekly-ops-gate');
    weeklyViolations.forEach(item => addReason(item));
    addCommand('node scripts/release-ops-weekly-summary.js --json');
    addCommand('node scripts/release-weekly-ops-gate.js');
    addCommand('npx sce auto handoff evidence --file .kiro/reports/release-evidence/handoff-runs.json --json');
    addCommand('npx sce auto handoff regression --session-id latest --json');
    addRecommendation('Resolve weekly risk drivers first (handoff quality, governance breach, matrix regression trend).');
  }

  if (weeklySignals && weeklySignals.governance_status === 'alert') {
    addReason('interactive-governance-alert');
    addCommand('node scripts/interactive-governance-report.js --period weekly --fail-on-alert --json');
    addRecommendation('Clear medium/high governance breaches before next release tag.');
  }

  if (driftAlerts.length > 0 || driftBlocked) {
    addReason('release-drift-alerts');
    driftAlerts.forEach(item => addReason(item));
    addCommand('npx sce auto handoff gate-index --dir .kiro/reports/release-evidence --out .kiro/reports/release-evidence/release-gate-history.json --json');
    addCommand('node scripts/release-drift-evaluate.js');
    addCommand('node scripts/release-ops-weekly-summary.js --json');
    addRecommendation('Review drift trend before release and remediate consecutive failures/high-risk share spikes.');
  }

  if (commands.length === 0) {
    addRecommendation('No blocking weekly/drift signal found in gate report.');
  }

  const phases = [];
  if (commands.length > 0) {
    phases.push({
      id: 'diagnose',
      commands: commands.slice(0, Math.min(3, commands.length))
    });
    if (commands.length > 3) {
      phases.push({
        id: 'remediate',
        commands: commands.slice(3)
      });
    }
  }

  return {
    reasons,
    recommendations,
    commands,
    phases
  };
}

function buildMarkdown(bundle) {
  const lines = [];
  lines.push('# Release Risk Remediation Bundle');
  lines.push('');
  lines.push(`- Generated at: ${bundle.generated_at}`);
  lines.push(`- Gate report: ${bundle.input.gate_report.path}`);
  lines.push(`- Blocking signals: ${bundle.summary.blocking_signal_count}`);
  lines.push('');
  lines.push('## Reasons');
  lines.push('');
  if (bundle.plan.reasons.length === 0) {
    lines.push('- none');
  } else {
    bundle.plan.reasons.forEach(item => lines.push(`- ${item}`));
  }
  lines.push('');
  lines.push('## Commands');
  lines.push('');
  if (bundle.plan.commands.length === 0) {
    lines.push('- none');
  } else {
    bundle.plan.commands.forEach(item => lines.push(`- \`${item}\``));
  }
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  bundle.plan.recommendations.forEach(item => lines.push(`- ${item}`));
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const gateInput = await safeReadJson(cwd, options.gateReport);
  if (!gateInput.exists) {
    throw new Error(`gate report missing: ${gateInput.path}`);
  }
  if (gateInput.parse_error) {
    throw new Error(`gate report parse error: ${gateInput.parse_error}`);
  }

  const plan = buildRemediationPlan(gateInput.payload || {});
  const outPath = path.resolve(cwd, options.out);
  const markdownOutPath = path.resolve(cwd, options.markdownOut);
  const linesOutPath = path.resolve(cwd, options.linesOut);
  const blockingSignalCount = plan.reasons.filter(item =>
    item === 'weekly-ops-gate'
    || item === 'release-drift-alerts'
    || item === 'interactive-governance-alert'
  ).length;

  const bundle = {
    mode: 'release-risk-remediation-bundle',
    generated_at: new Date().toISOString(),
    input: {
      gate_report: gateInput
    },
    summary: {
      blocking_signal_count: blockingSignalCount,
      command_count: plan.commands.length,
      recommendation_count: plan.recommendations.length
    },
    plan,
    output: {
      json: path.relative(cwd, outPath) || '.',
      markdown: path.relative(cwd, markdownOutPath) || '.',
      commands_lines: path.relative(cwd, linesOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, bundle, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(bundle), 'utf8');
  await fs.ensureDir(path.dirname(linesOutPath));
  await fs.writeFile(linesOutPath, `${plan.commands.join('\n')}\n`, 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
  } else {
    process.stdout.write(`Release remediation bundle generated (${bundle.summary.command_count} commands).\n`);
    process.stdout.write(`- JSON: ${bundle.output.json}\n`);
    process.stdout.write(`- Markdown: ${bundle.output.markdown}\n`);
    process.stdout.write(`- Commands: ${bundle.output.commands_lines}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Release remediation bundle failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildRemediationPlan,
  buildMarkdown
};

