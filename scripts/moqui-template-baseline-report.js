#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const {
  buildOntologyFromManifest,
  validateOntology,
  evaluateOntologySemanticQuality
} = require('../lib/scene-runtime/scene-ontology');

const DEFAULT_TEMPLATE_DIR = '.sce/templates/scene-packages';
const DEFAULT_OUT = '.sce/reports/moqui-template-baseline.json';
const DEFAULT_MARKDOWN_OUT = '.sce/reports/moqui-template-baseline.md';
const DEFAULT_MATCH = '(moqui|erp|suite|playbook|runbook|decision|action|governance)';
const DEFAULT_MIN_SCORE = 70;
const DEFAULT_MIN_VALID_RATE = 100;

function parseArgs(argv) {
  const options = {
    templateDir: DEFAULT_TEMPLATE_DIR,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    match: DEFAULT_MATCH,
    includeAll: false,
    minScore: DEFAULT_MIN_SCORE,
    minValidRate: DEFAULT_MIN_VALID_RATE,
    compareWith: null,
    failOnPortfolioFail: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--template-dir' && next) {
      options.templateDir = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--match' && next) {
      options.match = next;
      i += 1;
    } else if (token === '--min-score' && next) {
      options.minScore = Number(next);
      i += 1;
    } else if (token === '--min-valid-rate' && next) {
      options.minValidRate = Number(next);
      i += 1;
    } else if (token === '--compare-with' && next) {
      options.compareWith = next;
      i += 1;
    } else if (token === '--include-all') {
      options.includeAll = true;
    } else if (token === '--fail-on-portfolio-fail') {
      options.failOnPortfolioFail = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.minScore) || options.minScore < 0 || options.minScore > 100) {
    throw new Error('--min-score must be a number between 0 and 100');
  }
  if (!Number.isFinite(options.minValidRate) || options.minValidRate < 0 || options.minValidRate > 100) {
    throw new Error('--min-valid-rate must be a number between 0 and 100');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-template-baseline-report.js [options]',
    '',
    'Options:',
    `  --template-dir <path>   Template root (default: ${DEFAULT_TEMPLATE_DIR})`,
    `  --out <path>            JSON report path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>   Markdown report path (default: ${DEFAULT_MARKDOWN_OUT})`,
    `  --match <regex>         Template selector regex (default: ${DEFAULT_MATCH})`,
    '  --include-all           Disable selector filter and score all templates',
    `  --min-score <n>         Baseline min semantic score (default: ${DEFAULT_MIN_SCORE})`,
    `  --min-valid-rate <n>    Baseline min ontology valid-rate % (default: ${DEFAULT_MIN_VALID_RATE})`,
    '  --compare-with <path>   Compare against a previous baseline JSON report',
    '  --fail-on-portfolio-fail Exit non-zero when portfolio baseline gate fails',
    '  --json                  Print JSON payload to stdout',
    '  -h, --help              Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function toRate(numerator, denominator) {
  if (!Number.isFinite(Number(denominator)) || Number(denominator) <= 0) {
    return null;
  }
  return Number(((Number(numerator) / Number(denominator)) * 100).toFixed(2));
}

function computeTemplateFlags(ontologyValidation, quality, minScore) {
  const metrics = quality && quality.metrics ? quality.metrics : {};
  const entityCoverage = Number(metrics.entity_count) > 0;
  const relationCoverage = Number(metrics.relation_count) > 0;
  const businessRuleCoverage = Number(metrics.business_rule_total) > 0;
  const decisionCoverage = Number(metrics.decision_total) > 0;
  const businessRuleClosed = businessRuleCoverage && Number(metrics.business_rule_unmapped) === 0;
  const decisionClosed = decisionCoverage && Number(metrics.decision_undecided) === 0;
  const scorePassed = Number(quality && quality.score) >= Number(minScore);
  const graphValid = Boolean(ontologyValidation && ontologyValidation.valid === true);
  const baselinePassed = (
    graphValid &&
    scorePassed &&
    entityCoverage &&
    relationCoverage &&
    businessRuleCoverage &&
    businessRuleClosed &&
    decisionCoverage &&
    decisionClosed
  );

  return {
    graph_valid: graphValid,
    score_passed: scorePassed,
    entity_coverage: entityCoverage,
    relation_coverage: relationCoverage,
    business_rule_coverage: businessRuleCoverage,
    business_rule_closed: businessRuleClosed,
    decision_coverage: decisionCoverage,
    decision_closed: decisionClosed,
    baseline_passed: baselinePassed
  };
}

function collectGapReasons(flags) {
  const gaps = [];
  if (!flags.graph_valid) gaps.push('ontology graph invalid');
  if (!flags.score_passed) gaps.push('semantic score below threshold');
  if (!flags.entity_coverage) gaps.push('entity model missing');
  if (!flags.relation_coverage) gaps.push('relation model missing');
  if (!flags.business_rule_coverage) gaps.push('business rules missing');
  if (flags.business_rule_coverage && !flags.business_rule_closed) gaps.push('unmapped business rules remain');
  if (!flags.decision_coverage) gaps.push('decision logic missing');
  if (flags.decision_coverage && !flags.decision_closed) gaps.push('undecided decisions remain');
  return gaps;
}

function detectTemplateScope(templateId) {
  const text = `${templateId || ''}`.toLowerCase();
  if (/(moqui|erp)/.test(text)) {
    return 'moqui_erp';
  }
  if (/(scene|suite|playbook|runbook|decision|action|governance)/.test(text)) {
    return 'scene_orchestration';
  }
  return 'other';
}

function summarizeScopeBreakdown(templates) {
  const breakdown = {
    moqui_erp: 0,
    scene_orchestration: 0,
    other: 0
  };
  for (const item of templates) {
    const scope = detectTemplateScope(item && item.template_id);
    breakdown[scope] = Number(breakdown[scope] || 0) + 1;
  }
  return breakdown;
}

function countFlag(templates, flagName) {
  return templates.filter(
    (item) => item && item.baseline && item.baseline.flags && item.baseline.flags[flagName] === true
  ).length;
}

function buildCoverageMatrix(templates) {
  const total = templates.length;
  const entityCoverage = countFlag(templates, 'entity_coverage');
  const relationCoverage = countFlag(templates, 'relation_coverage');
  const businessRuleCoverage = countFlag(templates, 'business_rule_coverage');
  const businessRuleClosed = countFlag(templates, 'business_rule_closed');
  const decisionCoverage = countFlag(templates, 'decision_coverage');
  const decisionClosed = countFlag(templates, 'decision_closed');
  const graphValid = countFlag(templates, 'graph_valid');
  const scorePassed = countFlag(templates, 'score_passed');
  const baselinePassed = countFlag(templates, 'baseline_passed');

  return {
    total_templates: total,
    graph_valid: {
      count: graphValid,
      rate_percent: toRate(graphValid, total)
    },
    score_passed: {
      count: scorePassed,
      rate_percent: toRate(scorePassed, total)
    },
    entity_coverage: {
      count: entityCoverage,
      rate_percent: toRate(entityCoverage, total)
    },
    relation_coverage: {
      count: relationCoverage,
      rate_percent: toRate(relationCoverage, total)
    },
    business_rule_coverage: {
      count: businessRuleCoverage,
      rate_percent: toRate(businessRuleCoverage, total)
    },
    business_rule_closed: {
      count: businessRuleClosed,
      rate_percent: toRate(businessRuleClosed, total),
      among_covered_rate_percent: toRate(businessRuleClosed, businessRuleCoverage)
    },
    decision_coverage: {
      count: decisionCoverage,
      rate_percent: toRate(decisionCoverage, total)
    },
    decision_closed: {
      count: decisionClosed,
      rate_percent: toRate(decisionClosed, total),
      among_covered_rate_percent: toRate(decisionClosed, decisionCoverage)
    },
    baseline_passed: {
      count: baselinePassed,
      rate_percent: toRate(baselinePassed, total)
    }
  };
}

function buildGapFrequency(templates) {
  const counter = new Map();
  for (const item of templates) {
    const gaps = Array.isArray(item && item.baseline && item.baseline.gaps)
      ? item.baseline.gaps
      : [];
    for (const gap of gaps) {
      const key = `${gap || ''}`.trim();
      if (!key) {
        continue;
      }
      counter.set(key, Number(counter.get(key) || 0) + 1);
    }
  }

  return Array.from(counter.entries())
    .map(([gap, count]) => ({ gap, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.gap.localeCompare(b.gap);
    });
}

function toDelta(currentValue, previousValue) {
  if (!Number.isFinite(Number(currentValue)) || !Number.isFinite(Number(previousValue))) {
    return null;
  }
  return Number((Number(currentValue) - Number(previousValue)).toFixed(2));
}

function formatDeltaPercent(metric = {}) {
  const value = metric && Number.isFinite(Number(metric.rate_percent))
    ? Number(metric.rate_percent)
    : null;
  return value === null ? 'n/a' : `${value}%`;
}

function metricLabel(metricName) {
  const labels = {
    graph_valid: 'graph-valid',
    score_passed: 'score-passed',
    entity_coverage: 'entity-coverage',
    relation_coverage: 'relation-coverage',
    business_rule_coverage: 'business-rule-coverage',
    business_rule_closed: 'business-rule-closed',
    decision_coverage: 'decision-coverage',
    decision_closed: 'decision-closed',
    baseline_passed: 'baseline-passed'
  };
  return labels[metricName] || metricName;
}

function readCoverageMetric(summary = {}, metricName = '') {
  const matrix = summary && summary.coverage_matrix && typeof summary.coverage_matrix === 'object'
    ? summary.coverage_matrix
    : {};
  return matrix && matrix[metricName] && typeof matrix[metricName] === 'object'
    ? matrix[metricName]
    : {};
}

function buildCoverageMatrixDeltas(currentSummary = {}, previousSummary = {}) {
  const metricNames = [
    'graph_valid',
    'score_passed',
    'entity_coverage',
    'relation_coverage',
    'business_rule_coverage',
    'business_rule_closed',
    'decision_coverage',
    'decision_closed',
    'baseline_passed'
  ];
  const deltas = {};

  for (const metricName of metricNames) {
    const currentMetric = readCoverageMetric(currentSummary, metricName);
    const previousMetric = readCoverageMetric(previousSummary, metricName);
    const metricDelta = {
      count: toDelta(currentMetric.count, previousMetric.count),
      rate_percent: toDelta(currentMetric.rate_percent, previousMetric.rate_percent)
    };
    if (
      Number.isFinite(Number(currentMetric.among_covered_rate_percent))
      || Number.isFinite(Number(previousMetric.among_covered_rate_percent))
    ) {
      metricDelta.among_covered_rate_percent = toDelta(
        currentMetric.among_covered_rate_percent,
        previousMetric.among_covered_rate_percent
      );
    }
    deltas[metricName] = metricDelta;
  }
  return deltas;
}

function buildCoverageMatrixRegressions(coverageMatrixDeltas = {}) {
  const regressions = [];
  const deltaMatrix = coverageMatrixDeltas && typeof coverageMatrixDeltas === 'object'
    ? coverageMatrixDeltas
    : {};
  for (const [metric, value] of Object.entries(deltaMatrix)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const deltaRate = Number(value.rate_percent);
    if (!Number.isFinite(deltaRate) || deltaRate >= 0) {
      continue;
    }
    regressions.push({
      metric,
      label: metricLabel(metric),
      delta_rate_percent: Number(deltaRate.toFixed(2))
    });
  }

  return regressions.sort((a, b) => {
    if (a.delta_rate_percent !== b.delta_rate_percent) {
      return a.delta_rate_percent - b.delta_rate_percent;
    }
    return a.metric.localeCompare(b.metric);
  });
}

function readFailedTemplates(report) {
  const templates = Array.isArray(report && report.templates) ? report.templates : [];
  return templates
    .filter((item) => !(item && item.baseline && item.baseline.flags && item.baseline.flags.baseline_passed))
    .map((item) => item && item.template_id)
    .filter((id) => typeof id === 'string' && id.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

function buildComparison(report, previousReport) {
  const currentSummary = report && report.summary ? report.summary : {};
  const previousSummary = previousReport && previousReport.summary ? previousReport.summary : {};
  const currentFailedTemplates = readFailedTemplates(report);
  const previousFailedTemplates = readFailedTemplates(previousReport);
  const previousFailedSet = new Set(previousFailedTemplates);
  const currentFailedSet = new Set(currentFailedTemplates);
  const newlyFailed = currentFailedTemplates
    .filter((item) => !previousFailedSet.has(item))
    .sort((a, b) => a.localeCompare(b));
  const recovered = previousFailedTemplates
    .filter((item) => !currentFailedSet.has(item))
    .sort((a, b) => a.localeCompare(b));
  const coverageMatrixDeltas = buildCoverageMatrixDeltas(currentSummary, previousSummary);

  return {
    previous_generated_at: previousReport && previousReport.generated_at ? previousReport.generated_at : null,
    previous_template_root: previousReport && previousReport.template_root ? previousReport.template_root : null,
    deltas: {
      scoped_templates: toDelta(currentSummary.scoped_templates, previousSummary.scoped_templates),
      avg_score: toDelta(currentSummary.avg_score, previousSummary.avg_score),
      valid_rate_percent: toDelta(currentSummary.valid_rate_percent, previousSummary.valid_rate_percent),
      baseline_passed: toDelta(currentSummary.baseline_passed, previousSummary.baseline_passed),
      baseline_failed: toDelta(currentSummary.baseline_failed, previousSummary.baseline_failed)
    },
    coverage_matrix_deltas: coverageMatrixDeltas,
    coverage_matrix_regressions: buildCoverageMatrixRegressions(coverageMatrixDeltas),
    portfolio: {
      previous_passed: previousSummary.portfolio_passed === true,
      current_passed: currentSummary.portfolio_passed === true,
      changed: (previousSummary.portfolio_passed === true) !== (currentSummary.portfolio_passed === true)
    },
    failed_templates: {
      previous: previousFailedTemplates,
      current: currentFailedTemplates,
      newly_failed: newlyFailed,
      recovered
    }
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# Moqui Template Baseline Report');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Template root: ${report.template_root}`);
  lines.push(`- Filter: ${report.filter.include_all ? 'all templates' : report.filter.match}`);
  lines.push(`- Baseline thresholds: score>=${report.baseline.min_score}, valid-rate>=${report.baseline.min_valid_rate_percent}%`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total templates scanned: ${report.summary.total_templates}`);
  lines.push(`- Templates in scope: ${report.summary.scoped_templates}`);
  lines.push(`- Avg score: ${report.summary.avg_score === null ? 'n/a' : report.summary.avg_score}`);
  lines.push(`- Ontology valid-rate: ${report.summary.valid_rate_percent === null ? 'n/a' : `${report.summary.valid_rate_percent}%`}`);
  lines.push(`- Baseline passed: ${report.summary.baseline_passed}`);
  lines.push(`- Baseline failed: ${report.summary.baseline_failed}`);
  lines.push(`- Portfolio pass: ${report.summary.portfolio_passed ? 'yes' : 'no'}`);
  if (report.summary.scope_breakdown) {
    const scopes = report.summary.scope_breakdown;
    lines.push(`- Scope mix: moqui/erp=${scopes.moqui_erp || 0}, scene-orchestration=${scopes.scene_orchestration || 0}, other=${scopes.other || 0}`);
  }
  lines.push('');
  lines.push('## Capability Matrix');
  lines.push('');
  lines.push('| Dimension | Count | Rate |');
  lines.push('| --- | ---: | ---: |');
  const matrix = report.summary.coverage_matrix || {};
  const matrixRows = [
    ['Graph valid', matrix.graph_valid],
    ['Score passed', matrix.score_passed],
    ['Entity coverage', matrix.entity_coverage],
    ['Relation coverage', matrix.relation_coverage],
    ['Business-rule coverage', matrix.business_rule_coverage],
    ['Business-rule closed', matrix.business_rule_closed],
    ['Decision coverage', matrix.decision_coverage],
    ['Decision closed', matrix.decision_closed],
    ['Baseline passed', matrix.baseline_passed]
  ];
  for (const [name, item] of matrixRows) {
    const count = item && Number.isFinite(Number(item.count)) ? Number(item.count) : 0;
    const rate = item && Number.isFinite(Number(item.rate_percent)) ? `${item.rate_percent}%` : 'n/a';
    lines.push(`| ${name} | ${count} | ${rate} |`);
  }
  lines.push('');
  lines.push('## Templates');
  lines.push('');
  lines.push('| Template | Score | Graph | Baseline | Gaps |');
  lines.push('| --- | ---: | --- | --- | --- |');
  for (const item of report.templates) {
    lines.push(`| ${item.template_id} | ${item.semantic.score} | ${item.ontology.valid ? 'valid' : 'invalid'} | ${item.baseline.flags.baseline_passed ? 'pass' : 'fail'} | ${item.baseline.gaps.join(', ') || 'none'} |`);
  }
  lines.push('');
  lines.push('## Top Gaps');
  lines.push('');
  if (Array.isArray(report.summary.gap_frequency) && report.summary.gap_frequency.length > 0) {
    for (const item of report.summary.gap_frequency.slice(0, 10)) {
      lines.push(`- ${item.gap}: ${item.count}`);
    }
  } else {
    lines.push('- none');
  }
  if (report.compare) {
    const compare = report.compare;
    const deltas = compare.deltas || {};
    const matrixDeltas = compare.coverage_matrix_deltas || {};
    const matrixRegressions = Array.isArray(compare.coverage_matrix_regressions)
      ? compare.coverage_matrix_regressions
      : [];
    const failedTemplates = compare.failed_templates || {};
    lines.push('');
    lines.push('## Trend vs Previous');
    lines.push('');
    lines.push(`- Previous generated at: ${compare.previous_generated_at || 'n/a'}`);
    lines.push(`- Previous template root: ${compare.previous_template_root || 'n/a'}`);
    lines.push(`- Delta scoped templates: ${deltas.scoped_templates === null ? 'n/a' : deltas.scoped_templates}`);
    lines.push(`- Delta avg score: ${deltas.avg_score === null ? 'n/a' : deltas.avg_score}`);
    lines.push(`- Delta valid-rate: ${deltas.valid_rate_percent === null ? 'n/a' : `${deltas.valid_rate_percent}%`}`);
    lines.push(`- Delta baseline passed: ${deltas.baseline_passed === null ? 'n/a' : deltas.baseline_passed}`);
    lines.push(`- Delta baseline failed: ${deltas.baseline_failed === null ? 'n/a' : deltas.baseline_failed}`);
    lines.push(`- Delta entity coverage: ${formatDeltaPercent(matrixDeltas.entity_coverage)}`);
    lines.push(`- Delta business-rule closed: ${formatDeltaPercent(matrixDeltas.business_rule_closed)}`);
    lines.push(`- Delta decision closed: ${formatDeltaPercent(matrixDeltas.decision_closed)}`);
    lines.push(
      `- Matrix regressions: ${matrixRegressions.length > 0
        ? matrixRegressions.slice(0, 5).map(item => `${item.label}:${item.delta_rate_percent}%`).join(' | ')
        : 'none'}`
    );
    lines.push(`- Portfolio transition: ${compare.portfolio.previous_passed ? 'pass' : 'fail'} -> ${compare.portfolio.current_passed ? 'pass' : 'fail'}`);
    lines.push(`- Newly failed templates: ${failedTemplates.newly_failed && failedTemplates.newly_failed.length > 0 ? failedTemplates.newly_failed.join(', ') : 'none'}`);
    lines.push(`- Recovered templates: ${failedTemplates.recovered && failedTemplates.recovered.length > 0 ? failedTemplates.recovered.join(', ') : 'none'}`);
  }
  return `${lines.join('\n')}\n`;
}

async function readTemplateContracts(templateRoot) {
  const results = [];
  if (!(await fs.pathExists(templateRoot))) {
    return results;
  }
  const directories = await fs.readdir(templateRoot);
  for (const name of directories) {
    const dirPath = path.join(templateRoot, name);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      continue;
    }
    const contractPath = path.join(dirPath, 'scene-package.json');
    if (!(await fs.pathExists(contractPath))) {
      continue;
    }
    const contract = await fs.readJson(contractPath);
    results.push({
      templateId: name,
      templatePath: dirPath,
      contractPath,
      contract
    });
  }
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const templateRoot = path.resolve(process.cwd(), options.templateDir);
  const outPath = path.resolve(process.cwd(), options.out);
  const markdownPath = path.resolve(process.cwd(), options.markdownOut);
  const compareWithPath = options.compareWith
    ? path.resolve(process.cwd(), options.compareWith)
    : null;

  const selector = new RegExp(options.match, 'i');
  const contracts = await readTemplateContracts(templateRoot);
  const scoped = contracts.filter((item) => {
    if (options.includeAll) {
      return true;
    }
    const metadata = item.contract && item.contract.metadata ? item.contract.metadata : {};
    const provides = item.contract && item.contract.capabilities && Array.isArray(item.contract.capabilities.provides)
      ? item.contract.capabilities.provides.join(' ')
      : '';
    const haystack = [item.templateId, metadata.name || '', metadata.group || '', provides].join(' ');
    return selector.test(haystack);
  });

  const templates = scoped.map((item) => {
    const ontologyGraph = buildOntologyFromManifest(item.contract);
    const ontologyValidation = validateOntology(ontologyGraph);
    const semantic = evaluateOntologySemanticQuality(item.contract);
    const flags = computeTemplateFlags(ontologyValidation, semantic, options.minScore);
    const gaps = collectGapReasons(flags);
    return {
      template_id: item.templateId,
      template_path: path.relative(process.cwd(), item.templatePath),
      contract_path: path.relative(process.cwd(), item.contractPath),
      capabilities_provides: item.contract
        && item.contract.capabilities
        && Array.isArray(item.contract.capabilities.provides)
        ? item.contract.capabilities.provides
        : [],
      ontology: {
        valid: ontologyValidation.valid,
        error_count: Array.isArray(ontologyValidation.errors) ? ontologyValidation.errors.length : 0
      },
      semantic: {
        score: semantic.score,
        level: semantic.level,
        metrics: semantic.metrics
      },
      baseline: {
        flags,
        gaps
      }
    };
  });

  const validCount = templates.filter((item) => item.ontology.valid).length;
  const scores = templates.map((item) => Number(item.semantic.score)).filter((value) => Number.isFinite(value));
  const baselinePassedCount = templates.filter((item) => item.baseline.flags.baseline_passed).length;
  const coverageMatrix = buildCoverageMatrix(templates);
  const gapFrequency = buildGapFrequency(templates);
  const summary = {
    total_templates: contracts.length,
    scoped_templates: templates.length,
    avg_score: scores.length > 0
      ? Number((scores.reduce((acc, value) => acc + value, 0) / scores.length).toFixed(2))
      : null,
    valid_rate_percent: toRate(validCount, templates.length),
    baseline_passed: baselinePassedCount,
    baseline_failed: templates.length - baselinePassedCount,
    scope_breakdown: summarizeScopeBreakdown(templates),
    coverage_matrix: coverageMatrix,
    gap_frequency: gapFrequency,
    portfolio_passed: (
      templates.length > 0 &&
      Number(toRate(validCount, templates.length)) >= Number(options.minValidRate) &&
      scores.length > 0 &&
      Number((scores.reduce((acc, value) => acc + value, 0) / scores.length).toFixed(2)) >= Number(options.minScore)
    )
  };

  const report = {
    mode: 'moqui-template-baseline',
    generated_at: new Date().toISOString(),
    template_root: path.relative(process.cwd(), templateRoot) || '.',
    filter: {
      include_all: options.includeAll,
      match: options.match
    },
    baseline: {
      min_score: options.minScore,
      min_valid_rate_percent: options.minValidRate
    },
    summary,
    templates
  };

  if (compareWithPath) {
    if (!(await fs.pathExists(compareWithPath))) {
      throw new Error(`--compare-with file not found: ${path.relative(process.cwd(), compareWithPath)}`);
    }
    const previousReport = await fs.readJson(compareWithPath);
    report.compare = buildComparison(report, previousReport);
  }

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });

  const markdown = buildMarkdownReport(report);
  await fs.ensureDir(path.dirname(markdownPath));
  await fs.writeFile(markdownPath, markdown, 'utf8');

  if (options.json) {
    console.log(JSON.stringify({
      ...report,
      output: {
        json: path.relative(process.cwd(), outPath),
        markdown: path.relative(process.cwd(), markdownPath)
      }
    }, null, 2));
  } else {
    console.log('Moqui template baseline report generated.');
    console.log(`  JSON: ${path.relative(process.cwd(), outPath)}`);
    console.log(`  Markdown: ${path.relative(process.cwd(), markdownPath)}`);
    console.log(`  Scope: ${summary.scoped_templates}/${summary.total_templates}`);
    console.log(`  Avg score: ${summary.avg_score === null ? 'n/a' : summary.avg_score}`);
    console.log(`  Valid-rate: ${summary.valid_rate_percent === null ? 'n/a' : `${summary.valid_rate_percent}%`}`);
    console.log(`  Baseline passed: ${summary.baseline_passed}`);
    if (report.compare) {
      const deltas = report.compare.deltas || {};
      console.log(`  Delta avg score: ${deltas.avg_score === null ? 'n/a' : deltas.avg_score}`);
      console.log(`  Delta valid-rate: ${deltas.valid_rate_percent === null ? 'n/a' : `${deltas.valid_rate_percent}%`}`);
    }
  }

  if (options.failOnPortfolioFail && !summary.portfolio_passed) {
    const reason = (
      `portfolio baseline gate failed (avg_score=${summary.avg_score === null ? 'n/a' : summary.avg_score}, `
      + `valid_rate=${summary.valid_rate_percent === null ? 'n/a' : `${summary.valid_rate_percent}%`}, `
      + `thresholds score>=${options.minScore}, valid-rate>=${options.minValidRate}%)`
    );
    console.error(`Moqui template baseline failed: ${reason}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Failed to generate Moqui template baseline report: ${error.message}`);
  process.exitCode = 1;
});
