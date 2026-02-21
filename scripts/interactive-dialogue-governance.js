#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_POLICY = 'docs/interactive-customization/dialogue-governance-policy-baseline.json';
const DEFAULT_OUT = '.kiro/reports/interactive-dialogue-governance.json';

const BUILTIN_POLICY = {
  version: '1.0.0',
  mode: 'business-safe-assistant',
  length_policy: {
    min_chars: 12,
    max_chars: 1200,
    min_significant_tokens: 4
  },
  deny_patterns: [
    {
      id: 'credential-exfiltration',
      pattern: '\\b(export|dump|reveal|show)\\b[^.\\n]{0,80}\\b(password|secret|token|credential)\\b',
      reason: 'request attempts to expose credentials or secrets'
    },
    {
      id: 'approval-bypass',
      pattern: '\\b(skip|bypass|disable)\\b[^.\\n]{0,80}\\b(approval|review|audit|permission)\\b',
      reason: 'request attempts to bypass approval or governance flow'
    }
  ],
  clarify_patterns: [
    {
      id: 'ambiguous-improve',
      pattern: '\\b(improve|optimize|fix)\\b',
      reason: 'goal is improvement-oriented but missing measurable target'
    }
  ],
  response_rules: [
    'Use short business language and avoid deep technical jargon.',
    'Always restate objective, scope, and expected impact before any action recommendation.',
    'When risk or permission is involved, explicitly tell user what approval is required.',
    'If requirement is ambiguous, ask at most two focused clarification questions.',
    'Never propose credential export, approval bypass, or secret leakage.'
  ],
  clarification_templates: [
    'What business outcome should improve first (speed, accuracy, cost, compliance)?',
    'Which page or module should be changed first, and what should stay unchanged?'
  ]
};

function parseArgs(argv) {
  const options = {
    goal: null,
    goalFile: null,
    context: null,
    policy: DEFAULT_POLICY,
    out: DEFAULT_OUT,
    json: false,
    failOnDeny: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--goal' && next) {
      options.goal = next;
      index += 1;
    } else if (token === '--goal-file' && next) {
      options.goalFile = next;
      index += 1;
    } else if (token === '--context' && next) {
      options.context = next;
      index += 1;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--fail-on-deny') {
      options.failOnDeny = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.goal && !options.goalFile) {
    throw new Error('either --goal or --goal-file is required.');
  }
  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-dialogue-governance.js (--goal <text> | --goal-file <path>) [options]',
    '',
    'Options:',
    '  --goal <text>            User goal text',
    '  --goal-file <path>       File containing user goal text',
    '  --context <path>         Optional page context JSON file',
    `  --policy <path>          Dialogue governance policy JSON (default: ${DEFAULT_POLICY})`,
    `  --out <path>             Governance report JSON output path (default: ${DEFAULT_OUT})`,
    '  --fail-on-deny           Exit code 2 when dialogue decision is deny',
    '  --json                   Print payload JSON',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function normalizeText(value) {
  return `${value || ''}`.trim().replace(/\s+/g, ' ');
}

async function readGoal(options, cwd) {
  if (options.goal) {
    return normalizeText(options.goal);
  }
  const goalPath = resolvePath(cwd, options.goalFile);
  if (!(await fs.pathExists(goalPath))) {
    throw new Error(`goal file not found: ${goalPath}`);
  }
  const content = await fs.readFile(goalPath, 'utf8');
  const goal = normalizeText(content);
  if (!goal) {
    throw new Error('goal text is empty.');
  }
  return goal;
}

async function readJsonFile(filePath, label) {
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON in ${label}: ${error.message}`);
  }
}

function normalizeRuleList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: normalizeText(item.id || 'rule'),
      pattern: normalizeText(item.pattern),
      reason: normalizeText(item.reason || 'policy rule matched')
    }))
    .filter(item => item.pattern);
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => normalizeText(item))
    .filter(Boolean);
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizePolicy(rawPolicy) {
  const policy = rawPolicy && typeof rawPolicy === 'object' ? rawPolicy : {};
  const lengthPolicy = policy.length_policy && typeof policy.length_policy === 'object'
    ? policy.length_policy
    : {};
  const denyPatterns = Array.isArray(policy.deny_patterns) ? policy.deny_patterns : [];
  const clarifyPatterns = Array.isArray(policy.clarify_patterns) ? policy.clarify_patterns : [];
  const responseRules = Array.isArray(policy.response_rules) ? policy.response_rules : [];
  const clarificationTemplates = Array.isArray(policy.clarification_templates)
    ? policy.clarification_templates
    : [];
  return {
    version: normalizeText(policy.version || BUILTIN_POLICY.version),
    mode: normalizeText(policy.mode || BUILTIN_POLICY.mode),
    length_policy: {
      min_chars: normalizeNumber(lengthPolicy.min_chars, BUILTIN_POLICY.length_policy.min_chars),
      max_chars: normalizeNumber(lengthPolicy.max_chars, BUILTIN_POLICY.length_policy.max_chars),
      min_significant_tokens: normalizeNumber(
        lengthPolicy.min_significant_tokens,
        BUILTIN_POLICY.length_policy.min_significant_tokens
      )
    },
    deny_patterns: normalizeRuleList(denyPatterns.length > 0 ? denyPatterns : BUILTIN_POLICY.deny_patterns),
    clarify_patterns: normalizeRuleList(clarifyPatterns.length > 0 ? clarifyPatterns : BUILTIN_POLICY.clarify_patterns),
    response_rules: normalizeStringList(responseRules.length > 0 ? responseRules : BUILTIN_POLICY.response_rules),
    clarification_templates: normalizeStringList(
      clarificationTemplates.length > 0
        ? clarificationTemplates
        : BUILTIN_POLICY.clarification_templates
    )
  };
}

async function loadPolicy(policyPath, cwd) {
  const resolved = resolvePath(cwd, policyPath || DEFAULT_POLICY);
  const exists = await fs.pathExists(resolved);
  if (!exists) {
    return {
      source: 'builtin-default',
      from_file: false,
      policy: normalizePolicy(BUILTIN_POLICY)
    };
  }
  const rawPolicy = await readJsonFile(resolved, 'dialogue policy');
  return {
    source: path.relative(cwd, resolved) || '.',
    from_file: true,
    policy: normalizePolicy(rawPolicy)
  };
}

function safeRegExp(value) {
  try {
    return new RegExp(value, 'i');
  } catch (_error) {
    return null;
  }
}

function evaluatePatternRules(goal, rules) {
  const hits = [];
  for (const rule of rules) {
    const regex = safeRegExp(rule.pattern);
    if (!regex) {
      continue;
    }
    if (regex.test(goal)) {
      hits.push({
        id: rule.id || 'rule',
        reason: rule.reason || 'policy rule matched'
      });
    }
  }
  return hits;
}

function pickClarificationQuestions(policy, context = {}) {
  const questions = [];
  const templates = Array.isArray(policy.clarification_templates) ? policy.clarification_templates : [];
  if (!context.module) {
    questions.push('Which module should be changed first?');
  }
  if (!context.page) {
    questions.push('Which page or screen is currently problematic?');
  }
  for (const template of templates) {
    if (questions.length >= 2) {
      break;
    }
    if (!questions.includes(template)) {
      questions.push(template);
    }
  }
  return questions.slice(0, 2);
}

function evaluateDialogue(goal, context = {}, policy) {
  const normalizedGoal = normalizeText(goal);
  const tokens = normalizedGoal.split(/\s+/).filter(Boolean);
  const denyHits = evaluatePatternRules(normalizedGoal, policy.deny_patterns);
  const clarifyHits = evaluatePatternRules(normalizedGoal, policy.clarify_patterns);

  const reasons = [];
  if (normalizedGoal.length < policy.length_policy.min_chars) {
    reasons.push(`goal is too short (< ${policy.length_policy.min_chars} chars)`);
  }
  if (normalizedGoal.length > policy.length_policy.max_chars) {
    reasons.push(`goal is too long (> ${policy.length_policy.max_chars} chars)`);
  }
  if (tokens.length < policy.length_policy.min_significant_tokens) {
    reasons.push(`goal has too few significant tokens (< ${policy.length_policy.min_significant_tokens})`);
  }
  reasons.push(...denyHits.map(item => item.reason));
  reasons.push(...clarifyHits.map(item => item.reason));

  let decision = 'allow';
  if (denyHits.length > 0) {
    decision = 'deny';
  } else if (
    clarifyHits.length > 0 ||
    normalizedGoal.length < policy.length_policy.min_chars ||
    tokens.length < policy.length_policy.min_significant_tokens
  ) {
    decision = 'clarify';
  }

  return {
    decision,
    reasons: Array.from(new Set(reasons)),
    deny_hits: denyHits,
    clarify_hits: clarifyHits,
    response_rules: Array.isArray(policy.response_rules) ? policy.response_rules : [],
    clarification_questions: decision === 'clarify' ? pickClarificationQuestions(policy, context) : []
  };
}

function toContextRef(context) {
  const payload = context && typeof context === 'object' ? context : {};
  return {
    product: normalizeText(payload.product || payload.app || ''),
    module: normalizeText(payload.module || ''),
    page: normalizeText(payload.page || ''),
    scene_id: normalizeText(payload.scene_id || '')
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const goal = await readGoal(options, cwd);
  const context = options.context
    ? await readJsonFile(resolvePath(cwd, options.context), 'context')
    : {};
  const policyRuntime = await loadPolicy(options.policy, cwd);
  const evaluation = evaluateDialogue(goal, context, policyRuntime.policy);
  const outPath = resolvePath(cwd, options.out || DEFAULT_OUT);

  const payload = {
    mode: 'interactive-dialogue-governance',
    generated_at: new Date().toISOString(),
    policy: {
      source: policyRuntime.source,
      from_file: policyRuntime.from_file,
      version: policyRuntime.policy.version,
      mode: policyRuntime.policy.mode
    },
    input: {
      goal,
      context: options.context ? (path.relative(cwd, resolvePath(cwd, options.context)) || '.') : null,
      context_ref: toContextRef(context)
    },
    ...evaluation,
    output: {
      report: path.relative(cwd, outPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive dialogue governance: ${payload.decision}\n`);
    process.stdout.write(`- Report: ${payload.output.report}\n`);
  }

  if (options.failOnDeny && payload.decision === 'deny') {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive dialogue governance failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_OUT,
  BUILTIN_POLICY,
  parseArgs,
  resolvePath,
  normalizePolicy,
  loadPolicy,
  evaluateDialogue,
  main
};
