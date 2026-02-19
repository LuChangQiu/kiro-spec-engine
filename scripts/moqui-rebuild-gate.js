#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const { spawnSync } = require('child_process');

const DEFAULT_METADATA = 'tests/fixtures/moqui-standard-rebuild/metadata.json';
const DEFAULT_OUT = '.kiro/reports/ci/moqui-rebuild-gate.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/ci/moqui-rebuild-gate.md';
const DEFAULT_BUNDLE_OUT = '.kiro/reports/ci/moqui-rebuild-bundle';
const DEFAULT_MIN_READY = 6;
const DEFAULT_MAX_PARTIAL = 0;
const DEFAULT_MAX_GAP = 0;

function parseArgs(argv) {
  const options = {
    metadata: DEFAULT_METADATA,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    bundleOut: DEFAULT_BUNDLE_OUT,
    minReady: DEFAULT_MIN_READY,
    maxPartial: DEFAULT_MAX_PARTIAL,
    maxGap: DEFAULT_MAX_GAP
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--metadata' && next) {
      options.metadata = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--bundle-out' && next) {
      options.bundleOut = next;
      i += 1;
    } else if (token === '--min-ready' && next) {
      options.minReady = Number(next);
      i += 1;
    } else if (token === '--max-partial' && next) {
      options.maxPartial = Number(next);
      i += 1;
    } else if (token === '--max-gap' && next) {
      options.maxGap = Number(next);
      i += 1;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-rebuild-gate.js [options]',
    '',
    'Options:',
    `  --metadata <path>      Metadata JSON for rebuild (default: ${DEFAULT_METADATA})`,
    `  --out <path>           Rebuild JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Rebuild markdown output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    `  --bundle-out <path>    Rebuild bundle output directory (default: ${DEFAULT_BUNDLE_OUT})`,
    `  --min-ready <n>        Minimum ready template count (default: ${DEFAULT_MIN_READY})`,
    `  --max-partial <n>      Maximum partial template count (default: ${DEFAULT_MAX_PARTIAL})`,
    `  --max-gap <n>          Maximum gap template count (default: ${DEFAULT_MAX_GAP})`,
    '  -h, --help             Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function runRebuild(options) {
  const projectRoot = process.cwd();
  const scriptPath = path.resolve(projectRoot, 'scripts', 'moqui-standard-rebuild.js');
  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      '--metadata',
      options.metadata,
      '--out',
      options.out,
      '--markdown-out',
      options.markdownOut,
      '--bundle-out',
      options.bundleOut,
      '--json'
    ],
    {
      cwd: projectRoot,
      encoding: 'utf8'
    }
  );

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(
      `moqui-standard-rebuild failed (${result.status}): ${stderr || stdout || 'unknown error'}`
    );
  }

  const payloadText = `${result.stdout || ''}`.trim();
  if (!payloadText) {
    throw new Error('moqui-standard-rebuild returned empty stdout');
  }
  return JSON.parse(payloadText);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!isFiniteNumber(options.minReady) || !isFiniteNumber(options.maxPartial) || !isFiniteNumber(options.maxGap)) {
    throw new Error('gate thresholds must be finite numbers');
  }

  const payload = runRebuild(options);
  const summary = payload && payload.recovery && payload.recovery.readiness_summary
    ? payload.recovery.readiness_summary
    : {};
  const ready = Number(summary.ready) || 0;
  const partial = Number(summary.partial) || 0;
  const gap = Number(summary.gap) || 0;

  const checks = [
    { id: 'min_ready', expected: Number(options.minReady), actual: ready, passed: ready >= Number(options.minReady) },
    { id: 'max_partial', expected: Number(options.maxPartial), actual: partial, passed: partial <= Number(options.maxPartial) },
    { id: 'max_gap', expected: Number(options.maxGap), actual: gap, passed: gap <= Number(options.maxGap) }
  ];
  const passed = checks.every(item => item.passed);

  const report = {
    mode: 'moqui-rebuild-gate',
    generated_at: new Date().toISOString(),
    rebuild_report: {
      json: path.relative(process.cwd(), path.resolve(process.cwd(), options.out)),
      markdown: path.relative(process.cwd(), path.resolve(process.cwd(), options.markdownOut)),
      bundle: path.relative(process.cwd(), path.resolve(process.cwd(), options.bundleOut))
    },
    readiness_summary: summary,
    checks,
    passed
  };

  const gateOut = path.resolve(process.cwd(), '.kiro/reports/ci/moqui-rebuild-gate-check.json');
  await fs.ensureDir(path.dirname(gateOut));
  await fs.writeJson(gateOut, report, { spaces: 2 });

  console.log(JSON.stringify(report, null, 2));
  if (!passed) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Failed to run moqui rebuild gate: ${error.message}`);
  process.exitCode = 1;
});

