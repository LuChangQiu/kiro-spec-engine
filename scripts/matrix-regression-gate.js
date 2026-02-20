#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_BASELINE = '.kiro/reports/release-evidence/moqui-template-baseline.json';
const DEFAULT_OUT = '.kiro/reports/release-evidence/matrix-regression-gate.json';

function parseArgs(argv) {
  const options = {
    baseline: DEFAULT_BASELINE,
    maxRegressions: 0,
    enforce: false,
    out: DEFAULT_OUT,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--baseline' && next) {
      options.baseline = next;
      index += 1;
    } else if (token === '--max-regressions' && next) {
      options.maxRegressions = Number(next);
      index += 1;
    } else if (token === '--enforce') {
      options.enforce = true;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.maxRegressions) || options.maxRegressions < 0) {
    throw new Error('--max-regressions must be a non-negative number.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/matrix-regression-gate.js [options]',
    '',
    'Options:',
    `  --baseline <path>         Baseline report JSON path (default: ${DEFAULT_BASELINE})`,
    '  --max-regressions <n>     Maximum allowed regression count (default: 0)',
    '  --enforce                 Exit code 2 when regressions exceed max',
    `  --out <path>              Gate report output path (default: ${DEFAULT_OUT})`,
    '  --json                    Print gate payload as JSON',
    '  -h, --help                Show this help'
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

function formatRegression(item = {}) {
  const metric = item && item.metric ? String(item.metric) : 'unknown';
  const delta = Number(item && item.delta_rate_percent);
  return {
    metric,
    delta_rate_percent: Number.isFinite(delta) ? Number(delta) : null
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const baselinePath = resolvePath(cwd, options.baseline);
  const outPath = resolvePath(cwd, options.out);
  const baselineExists = await fs.pathExists(baselinePath);
  let baselinePayload = null;
  let parseError = null;

  if (baselineExists) {
    try {
      baselinePayload = await fs.readJson(baselinePath);
    } catch (error) {
      parseError = error.message;
    }
  }

  const regressionsRaw = baselinePayload ? pickRegressions(baselinePayload) : [];
  const regressions = regressionsRaw.map(formatRegression);
  const regressionCount = regressions.length;
  const maxRegressions = Number(options.maxRegressions);
  const check = parseError || !baselineExists
    ? null
    : regressionCount <= maxRegressions;

  const payload = {
    mode: 'matrix-regression-gate',
    generated_at: new Date().toISOString(),
    baseline: {
      path: path.relative(cwd, baselinePath) || '.',
      exists: baselineExists,
      parse_error: parseError
    },
    policy: {
      max_regressions: maxRegressions,
      enforce: options.enforce === true
    },
    summary: {
      regressions: regressionCount,
      passed: check,
      status: check === null ? 'incomplete' : (check ? 'passed' : 'failed')
    },
    regressions
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Matrix regression gate: ${payload.summary.status}\n`);
    process.stdout.write(`- Baseline: ${payload.baseline.path}\n`);
    process.stdout.write(`- Regressions: ${payload.summary.regressions}\n`);
    process.stdout.write(`- Max allowed: ${payload.policy.max_regressions}\n`);
    process.stdout.write(`- Output: ${path.relative(cwd, outPath) || '.'}\n`);
  }

  if (options.enforce && check === false) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Matrix regression gate failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_BASELINE,
  DEFAULT_OUT,
  parseArgs,
  resolvePath,
  pickRegressions,
  formatRegression,
  main
};
