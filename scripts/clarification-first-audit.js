#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_CHECKS = [
  {
    path: 'scripts/interactive-dialogue-governance.js',
    requiredSnippets: [
      'contextHasBusinessScope',
      'goalMentionsBusinessScope',
      'business scene/module/page/entity context is missing; clarify scope before fallback or execution',
      'Which module/page/entity is affected first?'
    ]
  },
  {
    path: 'scripts/symbol-evidence-locate.js',
    requiredSnippets: [
      'clarify_business_scope',
      'Clarify target module/page/entity and business constraints before deciding whether scoped writes are safe.'
    ]
  },
  {
    path: 'lib/workspace/takeover-baseline.js',
    requiredSnippets: [
      'CLARIFICATION_FIRST_CORE_PRINCIPLE_HEADING',
      '_reconcileCorePrinciplesBaseline',
      '这条规则适用于所有接入 SCE 的项目、模式和交互面，不允许按项目例外绕过。'
    ]
  },
  {
    path: 'docs/interactive-customization/dialogue-governance-policy-baseline.json',
    requiredSnippets: [
      'clarify and narrow scope before using any fallback restriction; do not replace understanding with blanket disable',
      'Which entity or business rule is affected, and what constraint must stay intact?'
    ]
  },
  {
    path: '.sce/steering/CORE_PRINCIPLES.md',
    requiredSnippets: [
      '业务场景未知时必须先澄清，禁止直接彻底禁用',
      '这条规则适用于所有接入 SCE 的项目、模式和交互面，不允许按项目例外绕过。'
    ]
  },
  {
    path: 'template/.sce/steering/CORE_PRINCIPLES.md',
    requiredSnippets: [
      '业务场景未知时先澄清，不得直接彻底禁用',
      '这条规则适用于所有使用 SCE 的项目，不设项目级例外。'
    ]
  },
  {
    path: 'README.md',
    requiredSnippets: [
      'When business scene/module/page/entity context is missing, SCE must route to clarification first; unknown business scope must not be turned into blanket disable.'
    ]
  },
  {
    path: 'README.zh.md',
    requiredSnippets: [
      '缺少业务场景/模块/页面/实体上下文时，SCE 必须先进入澄清，而不是把未知业务范围直接变成一刀切禁用'
    ]
  },
  {
    path: 'docs/security-governance-default-baseline.md',
    requiredSnippets: [
      'Missing business scene/module/page/entity context must route to clarification first; unknown scope is never a valid reason for blanket disable.',
      'This clarification-first rule applies to every SCE-integrated project and surface with no project-specific exception.'
    ]
  },
  {
    path: 'docs/starter-kit/README.md',
    requiredSnippets: [
      'This baseline applies to every onboarded project with no project-specific exception.',
      'missing business scope is handled through clarification, not blanket disable fallback.'
    ]
  },
  {
    path: 'docs/command-reference.md',
    requiredSnippets: [
      'Missing business scene/module/page/entity context defaults to `clarify`; unknown scope must not be converted into blanket disable fallback.'
    ]
  }
];

const PROHIBITED_SNIPPETS = [
  {
    value: 'block_high_risk_write',
    allowedPaths: [
      'scripts/clarification-first-audit.js',
      'tests/unit/scripts/clarification-first-audit.test.js'
    ]
  },
  {
    value: 'Fallback to answer-only mode and block high-risk writes.',
    allowedPaths: [
      'scripts/clarification-first-audit.js',
      'tests/unit/scripts/clarification-first-audit.test.js'
    ]
  }
];

const SEARCH_DIRECTORIES = ['lib', 'scripts', 'docs', '.sce', 'template', 'tests'];
const SEARCH_EXTENSIONS = new Set(['.js', '.md', '.json', '.txt', '.yaml', '.yml']);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    projectPath: process.cwd(),
    json: false,
    failOnViolation: false,
    out: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--project-path' && next) {
      options.projectPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--fail-on-violation') {
      options.failOnViolation = true;
      continue;
    }
    if (token === '--out' && next) {
      options.out = path.resolve(next);
      index += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/clarification-first-audit.js [options]',
    '',
    'Options:',
    '  --project-path <path>   Project root to audit (default: current directory)',
    '  --json                  Print JSON payload',
    '  --fail-on-violation     Exit code 2 when any violation is found',
    '  --out <path>            Write JSON payload to file',
    '  -h, --help              Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeSlashes(value) {
  return `${value || ''}`.replace(/\\/g, '/');
}

function pushViolation(violations, severity, rule, file, message) {
  violations.push({
    severity,
    rule,
    file,
    message
  });
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectFilesRecursive(rootDir, relativeRoot = '') {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  const results = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    const relativePath = normalizeSlashes(path.join(relativeRoot, entry.name));
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      results.push(...collectFilesRecursive(absolutePath, relativePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!SEARCH_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    results.push({
      absolutePath,
      relativePath
    });
  }
  return results;
}

function auditClarificationFirst(options = {}) {
  const projectPath = path.resolve(options.projectPath || process.cwd());
  const violations = [];
  const checkedFiles = [];

  for (const check of REQUIRED_CHECKS) {
    const relativePath = normalizeSlashes(check.path);
    const absolutePath = path.join(projectPath, relativePath);
    checkedFiles.push(relativePath);
    if (!fs.existsSync(absolutePath)) {
      pushViolation(
        violations,
        'error',
        'missing_required_file',
        relativePath,
        `Required clarification-first baseline file is missing: ${relativePath}`
      );
      continue;
    }

    const content = readText(absolutePath);
    for (const snippet of check.requiredSnippets) {
      if (!content.includes(snippet)) {
        pushViolation(
          violations,
          'error',
          'missing_required_snippet',
          relativePath,
          `Missing required clarification-first snippet: ${snippet}`
        );
      }
    }
  }

  const searchableFiles = SEARCH_DIRECTORIES.flatMap((dirName) => {
    const absoluteDir = path.join(projectPath, dirName);
    return collectFilesRecursive(absoluteDir, dirName);
  });

  for (const file of searchableFiles) {
    const content = readText(file.absolutePath);
    for (const rule of PROHIBITED_SNIPPETS) {
      if (!content.includes(rule.value)) {
        continue;
      }
      const allowedPaths = Array.isArray(rule.allowedPaths) ? rule.allowedPaths.map(normalizeSlashes) : [];
      if (allowedPaths.includes(file.relativePath)) {
        continue;
      }
      pushViolation(
        violations,
        'error',
        'prohibited_legacy_disable_phrase',
        file.relativePath,
        `Prohibited legacy fallback phrase found: ${rule.value}`
      );
    }
  }

  const errorCount = violations.filter((item) => item.severity === 'error').length;
  return {
    mode: 'clarification-first-audit',
    project_path: projectPath,
    checked_files: checkedFiles,
    searched_file_count: searchableFiles.length,
    violation_count: violations.length,
    error_count: errorCount,
    passed: violations.length === 0,
    violations
  };
}

function writeReportIfNeeded(report, outPath) {
  if (!outPath) {
    return;
  }
  const resolved = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = auditClarificationFirst(options);
  writeReportIfNeeded(report, options.out);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.passed) {
    console.log('[clarification-first-audit] passed');
  } else {
    console.error(`[clarification-first-audit] failed with ${report.violation_count} violation(s)`);
    for (const violation of report.violations) {
      console.error(`[clarification-first-audit] ${violation.rule} ${violation.file}: ${violation.message}`);
    }
  }

  if (options.failOnViolation && !report.passed) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[clarification-first-audit] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  REQUIRED_CHECKS,
  PROHIBITED_SNIPPETS,
  parseArgs,
  auditClarificationFirst
};
