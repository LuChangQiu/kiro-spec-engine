#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_POLICY = 'docs/interactive-customization/dialogue-governance-policy-baseline.json';
const DEFAULT_OUT = '.kiro/reports/interactive-dialogue-governance.json';
const DEFAULT_PROFILE = 'business-user';
const DIALOGUE_PROFILES = new Set(['business-user', 'system-maintainer']);

const BUILTIN_POLICY = {
  version: '1.0.0',
  mode: 'business-safe-assistant',
  default_profile: DEFAULT_PROFILE,
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
  ],
  profiles: {
    'business-user': {
      mode: 'business-safe-assistant',
      response_rules: [
        'Prefer business outcomes and measurable impact language over implementation details.'
      ]
    },
    'system-maintainer': {
      mode: 'maintenance-safe-assistant',
      length_policy: {
        min_chars: 8,
        max_chars: 1600,
        min_significant_tokens: 3
      },
      deny_patterns: [
        {
          id: 'prod-change-without-ticket',
          pattern: '\\b(prod|production)\\b[^.\\n]{0,120}\\b(without ticket|no ticket|skip ticket)\\b',
          reason: 'production maintenance request is missing approved change ticket'
        },
        {
          id: 'maintenance-no-rollback',
          pattern: '\\b(hotfix|patch|change|deploy)\\b[^.\\n]{0,120}\\b(without rollback|no rollback)\\b',
          reason: 'maintenance request lacks rollback safeguard'
        }
      ],
      response_rules: [
        'For maintenance requests, require change ticket, rollback plan, and approval role before execution.',
        'If request targets production, require staged validation evidence first.'
      ],
      clarification_templates: [
        'What is the approved change ticket id and rollback plan reference?',
        'Which environment should run first (dev/staging/prod), and who is the approver role?'
      ]
    }
  }
};

function parseArgs(argv) {
  const options = {
    goal: null,
    goalFile: null,
    context: null,
    policy: DEFAULT_POLICY,
    profile: DEFAULT_PROFILE,
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
    } else if (token === '--profile' && next) {
      options.profile = next;
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
  options.profile = normalizeText(options.profile || DEFAULT_PROFILE).toLowerCase() || DEFAULT_PROFILE;
  if (!DIALOGUE_PROFILES.has(options.profile)) {
    throw new Error(`--profile must be one of: ${Array.from(DIALOGUE_PROFILES).join(', ')}`);
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
    `  --profile <name>         Dialogue profile (business-user|system-maintainer, default: ${DEFAULT_PROFILE})`,
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

function normalizeOptionalNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeProfileConfig(rawProfile) {
  const profile = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const lengthPolicy = profile.length_policy && typeof profile.length_policy === 'object'
    ? profile.length_policy
    : {};
  return {
    mode: normalizeText(profile.mode || ''),
    length_policy: {
      min_chars: normalizeOptionalNumber(lengthPolicy.min_chars),
      max_chars: normalizeOptionalNumber(lengthPolicy.max_chars),
      min_significant_tokens: normalizeOptionalNumber(lengthPolicy.min_significant_tokens)
    },
    deny_patterns: normalizeRuleList(profile.deny_patterns),
    clarify_patterns: normalizeRuleList(profile.clarify_patterns),
    response_rules: normalizeStringList(profile.response_rules),
    clarification_templates: normalizeStringList(profile.clarification_templates)
  };
}

function normalizeProfileMap(rawProfiles, fallbackProfiles = {}) {
  const profiles = rawProfiles && typeof rawProfiles === 'object' ? rawProfiles : {};
  const normalized = {};
  for (const [profileName, profileConfig] of Object.entries(fallbackProfiles)) {
    const key = normalizeText(profileName).toLowerCase();
    if (!key) {
      continue;
    }
    normalized[key] = normalizeProfileConfig(profileConfig);
  }
  for (const [profileName, profileConfig] of Object.entries(profiles)) {
    const key = normalizeText(profileName).toLowerCase();
    if (!key) {
      continue;
    }
    normalized[key] = normalizeProfileConfig(profileConfig);
  }
  return normalized;
}

function uniqueStrings(values) {
  return Array.from(new Set(Array.isArray(values) ? values : []));
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
  const profiles = normalizeProfileMap(policy.profiles, BUILTIN_POLICY.profiles);
  const defaultProfile = normalizeText(policy.default_profile || BUILTIN_POLICY.default_profile).toLowerCase() || DEFAULT_PROFILE;
  if (!profiles[defaultProfile]) {
    profiles[DEFAULT_PROFILE] = normalizeProfileConfig(BUILTIN_POLICY.profiles[DEFAULT_PROFILE]);
  }
  return {
    version: normalizeText(policy.version || BUILTIN_POLICY.version),
    mode: normalizeText(policy.mode || BUILTIN_POLICY.mode),
    default_profile: profiles[defaultProfile] ? defaultProfile : DEFAULT_PROFILE,
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
    ),
    profiles
  };
}

function mergePolicyWithProfile(policy, profile) {
  const base = policy && typeof policy === 'object' ? policy : normalizePolicy(BUILTIN_POLICY);
  const profileConfig = profile && typeof profile === 'object' ? profile : {};
  const profileLength = profileConfig.length_policy && typeof profileConfig.length_policy === 'object'
    ? profileConfig.length_policy
    : {};
  return {
    ...base,
    mode: normalizeText(profileConfig.mode || base.mode),
    length_policy: {
      min_chars: Number.isFinite(profileLength.min_chars) ? profileLength.min_chars : base.length_policy.min_chars,
      max_chars: Number.isFinite(profileLength.max_chars) ? profileLength.max_chars : base.length_policy.max_chars,
      min_significant_tokens: Number.isFinite(profileLength.min_significant_tokens)
        ? profileLength.min_significant_tokens
        : base.length_policy.min_significant_tokens
    },
    deny_patterns: [...base.deny_patterns, ...(Array.isArray(profileConfig.deny_patterns) ? profileConfig.deny_patterns : [])],
    clarify_patterns: [...base.clarify_patterns, ...(Array.isArray(profileConfig.clarify_patterns) ? profileConfig.clarify_patterns : [])],
    response_rules: uniqueStrings([...base.response_rules, ...(Array.isArray(profileConfig.response_rules) ? profileConfig.response_rules : [])]),
    clarification_templates: uniqueStrings([
      ...base.clarification_templates,
      ...(Array.isArray(profileConfig.clarification_templates) ? profileConfig.clarification_templates : [])
    ])
  };
}

function resolvePolicyProfile(policy, requestedProfile) {
  const normalizedPolicy = policy && typeof policy === 'object' ? policy : normalizePolicy(BUILTIN_POLICY);
  const profileMap = normalizedPolicy.profiles && typeof normalizedPolicy.profiles === 'object'
    ? normalizedPolicy.profiles
    : {};
  const selectedProfile = normalizeText(requestedProfile || normalizedPolicy.default_profile || DEFAULT_PROFILE).toLowerCase() || DEFAULT_PROFILE;
  const profileConfig = profileMap[selectedProfile];
  if (!profileConfig) {
    const available = Object.keys(profileMap);
    throw new Error(`dialogue profile not found: ${selectedProfile}${available.length > 0 ? ` (available: ${available.join(', ')})` : ''}`);
  }
  return {
    requested_profile: selectedProfile,
    active_profile: selectedProfile,
    policy: mergePolicyWithProfile(normalizedPolicy, profileConfig)
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
  const profileRuntime = resolvePolicyProfile(policyRuntime.policy, options.profile);
  const evaluation = evaluateDialogue(goal, context, profileRuntime.policy);
  const outPath = resolvePath(cwd, options.out || DEFAULT_OUT);

  const payload = {
    mode: 'interactive-dialogue-governance',
    generated_at: new Date().toISOString(),
    policy: {
      source: policyRuntime.source,
      from_file: policyRuntime.from_file,
      version: policyRuntime.policy.version,
      mode: profileRuntime.policy.mode,
      default_profile: policyRuntime.policy.default_profile || DEFAULT_PROFILE,
      requested_profile: profileRuntime.requested_profile,
      active_profile: profileRuntime.active_profile
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
  normalizeProfileConfig,
  normalizeProfileMap,
  mergePolicyWithProfile,
  resolvePolicyProfile,
  loadPolicy,
  evaluateDialogue,
  main
};
