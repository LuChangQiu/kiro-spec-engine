#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs-extra');

const DEFAULT_WORKSPACE = 'tests/fixtures/moqui-core-regression/workspace';
const DEFAULT_OUT = '.sce/reports/release-evidence/moqui-core-regression-suite.json';
const DEFAULT_MARKDOWN_OUT = '.sce/reports/release-evidence/moqui-core-regression-suite.md';

function parseArgs(argv) {
  const options = {
    workspace: DEFAULT_WORKSPACE,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    json: false,
    failOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--workspace' && next) {
      options.workspace = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--no-fail-on-error') {
      options.failOnError = false;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-core-regression-suite.js [options]',
    '',
    'Options:',
    `  --workspace <path>     Regression fixture workspace (default: ${DEFAULT_WORKSPACE})`,
    `  --out <path>           JSON summary output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Markdown summary output path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --json                 Print JSON summary to stdout',
    '  --no-fail-on-error     Keep exit code 0 when suite fails',
    '  -h, --help             Show this help',
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizePathForReport(projectRoot, filePath) {
  const relative = path.relative(projectRoot, filePath);
  return relative && !relative.startsWith('..') ? relative.replace(/\\/g, '/') : filePath;
}

function parseJsonFromStdout(stdout) {
  const text = `${stdout || ''}`.trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    // fall through
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function runNodeCommand(args, cwd) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ended = Date.now();

  return {
    command: [process.execPath, ...args],
    cwd,
    exit_code: Number.isInteger(result.status) ? result.status : 1,
    duration_ms: Math.max(0, ended - started),
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    json: parseJsonFromStdout(result.stdout || ''),
  };
}

function summarizeStageOutput(stage) {
  const payload = stage.json && typeof stage.json === 'object' ? stage.json : {};
  if (stage.name === 'moqui-baseline') {
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    return {
      portfolio_passed: summary.portfolio_passed === true,
      avg_score: Number(summary.avg_score),
      valid_rate_percent: Number(summary.valid_rate_percent),
      baseline_failed: Number(summary.baseline_failed),
    };
  }
  if (stage.name === 'scene-package-publish-batch-dry-run') {
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    const batchGate = payload.batch_ontology_gate && typeof payload.batch_ontology_gate === 'object'
      ? payload.batch_ontology_gate
      : {};
    return {
      success: payload.success === true,
      failed: Number(summary.failed),
      selected: Number(summary.selected),
      batch_gate_passed: batchGate.passed === true,
    };
  }
  if (stage.name === 'moqui-lexicon-audit') {
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    return {
      passed: summary.passed === true,
      expected_unknown_count: Number(summary.expected_unknown_count),
      provided_unknown_count: Number(summary.provided_unknown_count),
      uncovered_expected_count: Number(summary.uncovered_expected_count),
      coverage_percent: Number(summary.coverage_percent),
    };
  }
  if (stage.name === 'auto-handoff-dry-run') {
    const gates = payload.gates && typeof payload.gates === 'object' ? payload.gates : {};
    return {
      status: typeof payload.status === 'string' ? payload.status : null,
      gate_passed: gates.passed === true,
      spec_success_rate_percent: gates.actual ? Number(gates.actual.spec_success_rate_percent) : null,
    };
  }
  return {};
}

function evaluateStage(stage) {
  if (stage.exit_code !== 0) {
    return {
      passed: false,
      reason: `process exited with code ${stage.exit_code}`,
    };
  }

  const payload = stage.json;
  if (!payload || typeof payload !== 'object') {
    return {
      passed: false,
      reason: 'stdout did not include a valid JSON payload',
    };
  }

  if (stage.name === 'moqui-baseline') {
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    if (summary.portfolio_passed !== true) {
      return {
        passed: false,
        reason: 'portfolio baseline gate failed',
      };
    }
  } else if (stage.name === 'moqui-lexicon-audit') {
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    if (summary.passed !== true) {
      return {
        passed: false,
        reason: (
          'moqui lexicon audit gate failed: ' +
          `expected_unknown=${Number(summary.expected_unknown_count) || 0}, ` +
          `provided_unknown=${Number(summary.provided_unknown_count) || 0}, ` +
          `uncovered_expected=${Number(summary.uncovered_expected_count) || 0}`
        ),
      };
    }
  } else if (stage.name === 'scene-package-publish-batch-dry-run') {
    const batchGate = payload.batch_ontology_gate && typeof payload.batch_ontology_gate === 'object'
      ? payload.batch_ontology_gate
      : {};
    if (payload.success !== true || batchGate.passed !== true) {
      return {
        passed: false,
        reason: 'scene package publish-batch dry-run gate failed',
      };
    }
  } else if (stage.name === 'auto-handoff-dry-run') {
    const status = typeof payload.status === 'string' ? payload.status : '';
    const gates = payload.gates && typeof payload.gates === 'object' ? payload.gates : {};
    if (!['dry-run', 'completed'].includes(status) || gates.passed !== true) {
      return {
        passed: false,
        reason: 'auto handoff dry-run gate failed',
      };
    }
  }

  return { passed: true, reason: null };
}

function buildMarkdownSummary(report) {
  const lines = [];
  lines.push('# Moqui Core Regression Suite');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Workspace: ${report.workspace}`);
  lines.push(`- Overall result: ${report.success ? 'pass' : 'fail'}`);
  lines.push(`- Failed stages: ${report.failed_stages.length === 0 ? 'none' : report.failed_stages.join(', ')}`);
  lines.push('');
  lines.push('## Stages');
  lines.push('');
  lines.push('| Stage | Result | Exit | Duration(ms) | Notes |');
  lines.push('| --- | --- | ---: | ---: | --- |');
  for (const stage of report.stages) {
    const note = stage.reason || 'ok';
    lines.push(`| ${stage.name} | ${stage.passed ? 'pass' : 'fail'} | ${stage.exit_code} | ${stage.duration_ms} | ${note} |`);
  }
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- JSON: ${report.output.json}`);
  lines.push(`- Markdown: ${report.output.markdown}`);
  for (const stage of report.stages) {
    if (stage.artifact_json) {
      lines.push(`- ${stage.name} JSON: ${stage.artifact_json}`);
    }
    if (stage.artifact_markdown) {
      lines.push(`- ${stage.name} Markdown: ${stage.artifact_markdown}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(__dirname, '..');
  const workspace = path.resolve(projectRoot, options.workspace);
  const outFile = path.resolve(projectRoot, options.out);
  const markdownOutFile = path.resolve(projectRoot, options.markdownOut);

  if (!(await fs.pathExists(workspace))) {
    throw new Error(`regression workspace not found: ${workspace}`);
  }

  const stageArtifactDir = path.join(workspace, '.sce', 'reports', 'moqui-core-regression');
  await fs.ensureDir(stageArtifactDir);

  const baselineJsonFile = path.join(stageArtifactDir, 'moqui-template-baseline.json');
  const baselineMarkdownFile = path.join(stageArtifactDir, 'moqui-template-baseline.md');
  const lexiconAuditJsonFile = path.join(stageArtifactDir, 'moqui-lexicon-audit.json');
  const lexiconAuditMarkdownFile = path.join(stageArtifactDir, 'moqui-lexicon-audit.md');

  const stageDefinitions = [
    {
      name: 'moqui-baseline',
      args: [
        path.join(projectRoot, 'scripts', 'moqui-template-baseline-report.js'),
        '--template-dir', '.sce/templates/scene-packages',
        '--out', baselineJsonFile,
        '--markdown-out', baselineMarkdownFile,
        '--include-all',
        '--fail-on-portfolio-fail',
        '--json',
      ],
      artifact_json: baselineJsonFile,
      artifact_markdown: baselineMarkdownFile,
    },
    {
      name: 'scene-package-publish-batch-dry-run',
      args: [
        path.join(projectRoot, 'bin', 'scene-capability-engine.js'),
        'scene',
        'package-publish-batch',
        '--manifest',
        'docs/handoffs/handoff-manifest.json',
        '--dry-run',
        '--json',
      ],
      artifact_json: null,
      artifact_markdown: null,
    },
    {
      name: 'moqui-lexicon-audit',
      args: [
        path.join(projectRoot, 'scripts', 'moqui-lexicon-audit.js'),
        '--manifest', 'docs/handoffs/handoff-manifest.json',
        '--template-dir', '.sce/templates/scene-packages',
        '--lexicon', path.join(projectRoot, 'lib', 'data', 'moqui-capability-lexicon.json'),
        '--out', lexiconAuditJsonFile,
        '--markdown-out', lexiconAuditMarkdownFile,
        '--json',
      ],
      artifact_json: lexiconAuditJsonFile,
      artifact_markdown: lexiconAuditMarkdownFile,
    },
    {
      name: 'auto-handoff-dry-run',
      args: [
        path.join(projectRoot, 'bin', 'scene-capability-engine.js'),
        'auto',
        'handoff',
        'run',
        '--manifest',
        'docs/handoffs/handoff-manifest.json',
        '--dry-run',
        '--no-require-release-gate-preflight',
        '--json',
      ],
      artifact_json: null,
      artifact_markdown: null,
    },
  ];

  const stages = [];
  for (const definition of stageDefinitions) {
    const rawStage = runNodeCommand(definition.args, workspace);
    const gate = evaluateStage({
      name: definition.name,
      ...rawStage,
    });

    const stage = {
      name: definition.name,
      command: rawStage.command.join(' '),
      cwd: normalizePathForReport(projectRoot, rawStage.cwd),
      exit_code: rawStage.exit_code,
      duration_ms: rawStage.duration_ms,
      passed: gate.passed,
      reason: gate.reason,
      summary: summarizeStageOutput({
        name: definition.name,
        ...rawStage,
      }),
      artifact_json: definition.artifact_json
        ? normalizePathForReport(projectRoot, definition.artifact_json)
        : null,
      artifact_markdown: definition.artifact_markdown
        ? normalizePathForReport(projectRoot, definition.artifact_markdown)
        : null,
      stdout_preview: rawStage.stdout.trim().slice(0, 400),
      stderr_preview: rawStage.stderr.trim().slice(0, 400),
    };
    stages.push(stage);
  }

  const failedStages = stages.filter((stage) => !stage.passed).map((stage) => stage.name);
  const report = {
    mode: 'moqui-core-regression-suite',
    generated_at: new Date().toISOString(),
    workspace: normalizePathForReport(projectRoot, workspace),
    success: failedStages.length === 0,
    failed_stages: failedStages,
    stages,
    output: {
      json: normalizePathForReport(projectRoot, outFile),
      markdown: normalizePathForReport(projectRoot, markdownOutFile),
    },
  };

  await fs.ensureDir(path.dirname(outFile));
  await fs.writeJson(outFile, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownOutFile));
  await fs.writeFile(markdownOutFile, buildMarkdownSummary(report), 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const status = report.success ? 'PASS' : 'FAIL';
    process.stdout.write(`Moqui core regression suite: ${status}\n`);
    process.stdout.write(`- JSON: ${report.output.json}\n`);
    process.stdout.write(`- Markdown: ${report.output.markdown}\n`);
  }

  if (!report.success && options.failOnError) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Moqui core regression suite failed: ${error.message}`);
  process.exit(1);
});
