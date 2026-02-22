#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_TAXONOMY_FILE = 'docs/agent-runtime/failure-taxonomy-baseline.json';

function parseArgs(argv = []) {
  const options = {
    error: '',
    errorFile: '',
    taxonomyFile: DEFAULT_TAXONOMY_FILE,
    testFailures: 0,
    attemptedPasses: 0,
    maxRepairPasses: 1,
    tests: [],
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--error' && next) {
      options.error = next;
      index += 1;
      continue;
    }
    if (token === '--error-file' && next) {
      options.errorFile = next;
      index += 1;
      continue;
    }
    if (token === '--taxonomy-file' && next) {
      options.taxonomyFile = next;
      index += 1;
      continue;
    }
    if (token === '--test-failures' && next) {
      options.testFailures = Number(next);
      index += 1;
      continue;
    }
    if (token === '--attempted-passes' && next) {
      options.attemptedPasses = Number(next);
      index += 1;
      continue;
    }
    if (token === '--max-repair-passes' && next) {
      options.maxRepairPasses = Number(next);
      index += 1;
      continue;
    }
    if (token === '--tests' && next) {
      options.tests = next
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!Number.isFinite(options.testFailures) || options.testFailures < 0) {
    throw new Error('--test-failures must be a non-negative number.');
  }
  if (!Number.isFinite(options.attemptedPasses) || options.attemptedPasses < 0) {
    throw new Error('--attempted-passes must be a non-negative number.');
  }
  if (!Number.isFinite(options.maxRepairPasses) || options.maxRepairPasses < 0) {
    throw new Error('--max-repair-passes must be a non-negative number.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/failure-attribution-repair.js [options]',
    '',
    'Options:',
    '  --error <text>              Failure text to classify',
    '  --error-file <path>         Read failure text from file',
    `  --taxonomy-file <path>      Failure taxonomy JSON path (default: ${DEFAULT_TAXONOMY_FILE})`,
    '  --test-failures <n>         Number of failing tests (default: 0)',
    '  --attempted-passes <n>      Repair passes already consumed (default: 0)',
    '  --max-repair-passes <n>     Max repair passes (default: 1)',
    '  --tests <csv>               Targeted test commands for re-run',
    '  --json                      Print JSON payload',
    '  -h, --help                  Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function loadTextError(options) {
  if (typeof options.error === 'string' && options.error.trim()) {
    return options.error.trim();
  }
  if (typeof options.errorFile === 'string' && options.errorFile.trim()) {
    const resolvedFile = path.resolve(process.cwd(), options.errorFile);
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`error file not found: ${options.errorFile}`);
    }
    const content = fs.readFileSync(resolvedFile, 'utf8').trim();
    if (content) {
      return content;
    }
  }
  return '';
}

function loadTaxonomy(taxonomyFile) {
  const resolved = path.resolve(process.cwd(), taxonomyFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`taxonomy file not found: ${taxonomyFile}`);
  }
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  return {
    version: payload.version || 'unknown',
    default_category: payload.default_category || 'unknown',
    categories
  };
}

function normalizePattern(pattern) {
  return `${pattern || ''}`.trim().toLowerCase();
}

function classifyFailure(errorText, taxonomy) {
  const message = `${errorText || ''}`.toLowerCase();
  let bestMatch = null;

  for (const category of taxonomy.categories) {
    const patterns = Array.isArray(category.patterns) ? category.patterns : [];
    const matchedPatterns = patterns
      .map(normalizePattern)
      .filter((pattern) => pattern && message.includes(pattern));
    if (matchedPatterns.length === 0) {
      continue;
    }
    const score = matchedPatterns.length;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        category,
        matchedPatterns,
        score
      };
    }
  }

  if (!bestMatch) {
    const fallback = taxonomy.categories.find((category) => category.id === taxonomy.default_category)
      || taxonomy.categories.find((category) => category.id === 'unknown')
      || {
        id: taxonomy.default_category || 'unknown',
        repairable: false,
        default_actions: ['collect diagnostics']
      };
    return {
      category: fallback.id || 'unknown',
      confidence: 'low',
      repairable: fallback.repairable === true,
      matched_patterns: [],
      default_actions: Array.isArray(fallback.default_actions) ? fallback.default_actions : []
    };
  }

  const confidence = bestMatch.matchedPatterns.length >= 2 ? 'high' : 'medium';
  return {
    category: bestMatch.category.id || taxonomy.default_category || 'unknown',
    confidence,
    repairable: bestMatch.category.repairable === true,
    matched_patterns: bestMatch.matchedPatterns,
    default_actions: Array.isArray(bestMatch.category.default_actions)
      ? bestMatch.category.default_actions
      : []
  };
}

function buildRepairPlan({ attribution, testFailures, attemptedPasses, maxRepairPasses, tests }) {
  const remainingPasses = Math.max(0, Math.floor(maxRepairPasses) - Math.floor(attemptedPasses));
  const canRepair = attribution.repairable === true && remainingPasses > 0;

  if (!canRepair) {
    const reason = attribution.repairable !== true
      ? `category '${attribution.category}' is non-repairable in bounded mode`
      : `repair pass budget exhausted (${attemptedPasses}/${maxRepairPasses})`;
    return {
      decision: 'stop',
      reason,
      actions: [
        'emit failure summary and stop automatic retries',
        'escalate to manual review or authorization flow'
      ],
      retest: {
        required: false,
        commands: []
      },
      terminal_summary: {
        status: 'stopped',
        stop_reason: reason,
        attempted_passes: attemptedPasses,
        max_repair_passes: maxRepairPasses
      }
    };
  }

  const actionSet = new Set(attribution.default_actions || []);
  actionSet.add('apply one minimal scoped patch');
  const retestCommands = Array.isArray(tests) && tests.length > 0
    ? tests
    : (
      testFailures > 0
        ? ['run failing test subset']
        : ['run targeted verification tests']
    );
  actionSet.add('re-run targeted tests after repair pass');

  return {
    decision: 'run_repair_pass',
    reason: `category '${attribution.category}' is repairable with remaining budget`,
    actions: [...actionSet],
    retest: {
      required: true,
      commands: retestCommands
    },
    terminal_summary: {
      status: 'repair-scheduled',
      stop_reason: null,
      attempted_passes: attemptedPasses,
      max_repair_passes: maxRepairPasses,
      remaining_after_this_pass: Math.max(0, remainingPasses - 1)
    }
  };
}

function buildReport(options, errorText, taxonomy, attribution, repairPlan) {
  return {
    mode: 'failure-attribution-repair',
    generated_at: new Date().toISOString(),
    input: {
      error: errorText,
      test_failures: options.testFailures,
      attempted_passes: options.attemptedPasses,
      max_repair_passes: options.maxRepairPasses,
      tests: options.tests
    },
    taxonomy: {
      version: taxonomy.version,
      default_category: taxonomy.default_category
    },
    attribution,
    repair_policy: {
      bounded: true,
      attempted_passes: options.attemptedPasses,
      max_repair_passes: options.maxRepairPasses
    },
    repair_pass: {
      decision: repairPlan.decision,
      reason: repairPlan.reason,
      actions: repairPlan.actions
    },
    retest_plan: repairPlan.retest,
    terminal_summary: repairPlan.terminal_summary
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const errorText = loadTextError(options);
  const taxonomy = loadTaxonomy(options.taxonomyFile);
  const attribution = classifyFailure(errorText, taxonomy);
  const repairPlan = buildRepairPlan({
    attribution,
    testFailures: options.testFailures,
    attemptedPasses: options.attemptedPasses,
    maxRepairPasses: options.maxRepairPasses,
    tests: options.tests
  });
  const payload = buildReport(options, errorText, taxonomy, attribution, repairPlan);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`failure category=${payload.attribution.category}\n`);
    process.stdout.write(`repair decision=${payload.repair_pass.decision}\n`);
    process.stdout.write(`terminal status=${payload.terminal_summary.status}\n`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`failure-attribution-repair failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_TAXONOMY_FILE,
  parseArgs,
  loadTextError,
  loadTaxonomy,
  classifyFailure,
  buildRepairPlan,
  buildReport
};
