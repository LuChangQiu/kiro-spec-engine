#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const {
  DEFAULT_POLICY,
  DEFAULT_CATALOG,
  toUniqueList,
  normalizeRiskLevel,
  buildCheck,
  evaluatePlanGate
} = require('../lib/interactive-customization/change-plan-gate-core');
const DEFAULT_OUT = '.kiro/reports/interactive-change-plan-gate.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/interactive-change-plan-gate.md';

function parseArgs(argv) {
  const options = {
    plan: null,
    policy: DEFAULT_POLICY,
    catalog: null,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    failOnBlock: false,
    failOnNonAllow: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--plan' && next) {
      options.plan = next;
      i += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      i += 1;
    } else if (token === '--catalog' && next) {
      options.catalog = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--fail-on-block') {
      options.failOnBlock = true;
    } else if (token === '--fail-on-non-allow') {
      options.failOnNonAllow = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.plan) {
    throw new Error('--plan is required.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-change-plan-gate.js --plan <path> [options]',
    '',
    'Options:',
    '  --plan <path>            Change plan JSON file (required)',
    `  --policy <path>          Guardrail policy JSON file (default: ${DEFAULT_POLICY})`,
    `  --catalog <path>         High-risk action catalog JSON file (default: ${DEFAULT_CATALOG})`,
    `  --out <path>             Report JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>    Report markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --fail-on-block          Exit code 2 when decision is deny',
    '  --fail-on-non-allow      Exit code 2 when decision is deny/review-required',
    '  --json                   Print JSON report to stdout',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function parseJson(text, sourceLabel) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${sourceLabel}: ${error.message}`);
  }
}

async function readJsonFile(filePath, sourceLabel) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${sourceLabel} not found: ${filePath}`);
  }
  const content = await fs.readFile(filePath, 'utf8');
  return parseJson(content, sourceLabel);
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Interactive Change Plan Gate');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Decision: ${report.decision}`);
  lines.push(`- Plan: ${report.inputs.plan}`);
  lines.push(`- Policy: ${report.inputs.policy}`);
  lines.push(`- Catalog: ${report.inputs.catalog}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Checks: ${report.summary.check_total}`);
  lines.push(`- Failed checks: ${report.summary.failed_total}`);
  lines.push(`- Failed deny checks: ${report.summary.failed_deny_total}`);
  lines.push(`- Failed review checks: ${report.summary.failed_review_total}`);
  lines.push(`- Action count: ${report.summary.action_count}`);
  lines.push(`- Risk level: ${report.summary.risk_level || 'n/a'}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  lines.push('| Check | Result | Severity | Details |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of report.checks) {
    lines.push(
      `| ${check.id} | ${check.passed ? 'pass' : 'fail'} | ${check.severity} | ${check.details || 'n/a'} |`
    );
  }
  lines.push('');
  lines.push('## Reasons');
  lines.push('');
  if (!Array.isArray(report.reasons) || report.reasons.length === 0) {
    lines.push('- none');
  } else {
    for (const reason of report.reasons) {
      lines.push(`- ${reason}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function resolveReportPath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const planPath = resolveReportPath(cwd, options.plan);
  const policyPath = resolveReportPath(cwd, options.policy);
  const policy = await readJsonFile(policyPath, 'policy');
  const catalogFromPolicy = policy && policy.catalog_policy && typeof policy.catalog_policy.catalog_file === 'string'
    ? policy.catalog_policy.catalog_file
    : null;
  const catalogPath = resolveReportPath(
    cwd,
    options.catalog || catalogFromPolicy || DEFAULT_CATALOG
  );
  const [plan, catalog] = await Promise.all([
    readJsonFile(planPath, 'plan'),
    readJsonFile(catalogPath, 'catalog')
  ]);

  const evaluation = evaluatePlanGate(plan, policy, catalog);
  const outPath = resolveReportPath(cwd, options.out);
  const markdownOutPath = resolveReportPath(cwd, options.markdownOut);
  const report = {
    mode: 'interactive-change-plan-gate',
    generated_at: new Date().toISOString(),
    inputs: {
      plan: path.relative(cwd, planPath) || '.',
      policy: path.relative(cwd, policyPath) || '.',
      catalog: path.relative(cwd, catalogPath) || '.'
    },
    ...evaluation,
    output: {
      json: path.relative(cwd, outPath) || '.',
      markdown: path.relative(cwd, markdownOutPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutPath));
  await fs.writeFile(markdownOutPath, buildMarkdown(report), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive change plan gate: ${report.decision}\n`);
    process.stdout.write(`- JSON: ${report.output.json}\n`);
    process.stdout.write(`- Markdown: ${report.output.markdown}\n`);
  }

  if (options.failOnBlock && report.decision === 'deny') {
    process.exitCode = 2;
  } else if (options.failOnNonAllow && report.decision !== 'allow') {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive change plan gate failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_CATALOG,
  DEFAULT_OUT,
  DEFAULT_MARKDOWN_OUT,
  parseArgs,
  parseJson,
  readJsonFile,
  toUniqueList,
  normalizeRiskLevel,
  buildCheck,
  evaluatePlanGate,
  buildMarkdown,
  resolveReportPath,
  main
};
