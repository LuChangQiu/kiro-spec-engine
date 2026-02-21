#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_POLICY = 'docs/interactive-customization/authorization-tier-policy-baseline.json';
const DEFAULT_OUT = '.kiro/reports/interactive-authorization-tier.json';
const DIALOGUE_PROFILES = new Set(['business-user', 'system-maintainer']);
const RUNTIME_ENVIRONMENTS = new Set(['dev', 'staging', 'prod']);

const BUILTIN_POLICY = {
  version: '1.0.0',
  defaults: {
    profile: 'business-user'
  },
  profiles: {
    'business-user': {
      allow_execution_modes: ['suggestion'],
      auto_execute_allowed: false,
      allow_live_apply: false
    },
    'system-maintainer': {
      allow_execution_modes: ['suggestion', 'apply'],
      auto_execute_allowed: true,
      allow_live_apply: true
    }
  },
  environments: {
    dev: {
      require_secondary_authorization: false,
      require_password_for_apply: false,
      require_role_policy: false,
      require_distinct_actor_roles: false,
      manual_review_required_for_apply: false
    },
    staging: {
      require_secondary_authorization: true,
      require_password_for_apply: true,
      require_role_policy: false,
      require_distinct_actor_roles: false,
      manual_review_required_for_apply: false
    },
    prod: {
      require_secondary_authorization: true,
      require_password_for_apply: true,
      require_role_policy: true,
      require_distinct_actor_roles: true,
      manual_review_required_for_apply: true
    }
  }
};

function parseArgs(argv) {
  const options = {
    executionMode: 'suggestion',
    dialogueProfile: 'business-user',
    runtimeMode: null,
    runtimeEnvironment: 'staging',
    autoExecuteLowRisk: false,
    liveApply: false,
    policy: DEFAULT_POLICY,
    out: DEFAULT_OUT,
    failOnNonAllow: false,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--execution-mode' && next) {
      options.executionMode = next;
      index += 1;
    } else if (token === '--dialogue-profile' && next) {
      options.dialogueProfile = next;
      index += 1;
    } else if (token === '--runtime-mode' && next) {
      options.runtimeMode = next;
      index += 1;
    } else if (token === '--runtime-environment' && next) {
      options.runtimeEnvironment = next;
      index += 1;
    } else if (token === '--auto-execute-low-risk') {
      options.autoExecuteLowRisk = true;
    } else if (token === '--live-apply') {
      options.liveApply = true;
    } else if (token === '--policy' && next) {
      options.policy = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    } else if (token === '--fail-on-non-allow') {
      options.failOnNonAllow = true;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  options.executionMode = `${options.executionMode || ''}`.trim().toLowerCase() || 'suggestion';
  options.dialogueProfile = `${options.dialogueProfile || ''}`.trim().toLowerCase() || 'business-user';
  options.runtimeEnvironment = `${options.runtimeEnvironment || ''}`.trim().toLowerCase() || 'staging';

  if (!['suggestion', 'apply'].includes(options.executionMode)) {
    throw new Error('--execution-mode must be one of: suggestion, apply');
  }
  if (!DIALOGUE_PROFILES.has(options.dialogueProfile)) {
    throw new Error(`--dialogue-profile must be one of: ${Array.from(DIALOGUE_PROFILES).join(', ')}`);
  }
  if (!RUNTIME_ENVIRONMENTS.has(options.runtimeEnvironment)) {
    throw new Error(`--runtime-environment must be one of: ${Array.from(RUNTIME_ENVIRONMENTS).join(', ')}`);
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-authorization-tier-evaluate.js [options]',
    '',
    'Options:',
    '  --execution-mode <mode>         suggestion|apply (default: suggestion)',
    '  --dialogue-profile <name>       business-user|system-maintainer (default: business-user)',
    '  --runtime-mode <name>           Runtime mode context (optional)',
    '  --runtime-environment <name>    dev|staging|prod (default: staging)',
    '  --auto-execute-low-risk         Evaluate low-risk auto execute request',
    '  --live-apply                    Evaluate live apply request',
    `  --policy <path>                 Authorization tier policy JSON (default: ${DEFAULT_POLICY})`,
    `  --out <path>                    Output JSON report path (default: ${DEFAULT_OUT})`,
    '  --fail-on-non-allow             Exit code 2 when decision is deny/review-required',
    '  --json                          Print payload as JSON',
    '  -h, --help                      Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function normalizeStringList(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(item => `${item || ''}`.trim().toLowerCase())
      .filter(Boolean)
  ));
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

function normalizeProfilePolicy(rawProfile = {}) {
  const profile = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  return {
    allow_execution_modes: normalizeStringList(profile.allow_execution_modes),
    auto_execute_allowed: profile.auto_execute_allowed === true,
    allow_live_apply: profile.allow_live_apply === true
  };
}

function normalizeEnvironmentPolicy(rawEnvironment = {}) {
  const environment = rawEnvironment && typeof rawEnvironment === 'object' ? rawEnvironment : {};
  return {
    require_secondary_authorization: environment.require_secondary_authorization === true,
    require_password_for_apply: environment.require_password_for_apply === true,
    require_role_policy: environment.require_role_policy === true,
    require_distinct_actor_roles: environment.require_distinct_actor_roles === true,
    manual_review_required_for_apply: environment.manual_review_required_for_apply === true
  };
}

function normalizePolicy(rawPolicy = {}) {
  const policy = rawPolicy && typeof rawPolicy === 'object' ? rawPolicy : {};
  const defaults = policy.defaults && typeof policy.defaults === 'object' ? policy.defaults : {};
  const inputProfiles = policy.profiles && typeof policy.profiles === 'object' ? policy.profiles : {};
  const inputEnvironments = policy.environments && typeof policy.environments === 'object' ? policy.environments : {};

  const profiles = {};
  for (const [name, config] of Object.entries(BUILTIN_POLICY.profiles)) {
    profiles[name] = normalizeProfilePolicy(config);
  }
  for (const [name, config] of Object.entries(inputProfiles)) {
    const key = `${name || ''}`.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const normalizedConfig = normalizeProfilePolicy(config);
    profiles[key] = {
      ...profiles[key],
      ...normalizedConfig,
      allow_execution_modes: normalizedConfig.allow_execution_modes.length > 0
        ? normalizedConfig.allow_execution_modes
        : (profiles[key] && profiles[key].allow_execution_modes) || []
    };
  }

  const environments = {};
  for (const [name, config] of Object.entries(BUILTIN_POLICY.environments)) {
    environments[name] = normalizeEnvironmentPolicy(config);
  }
  for (const [name, config] of Object.entries(inputEnvironments)) {
    const key = `${name || ''}`.trim().toLowerCase();
    if (!key) {
      continue;
    }
    environments[key] = {
      ...environments[key],
      ...normalizeEnvironmentPolicy(config)
    };
  }

  const defaultProfile = `${defaults.profile || BUILTIN_POLICY.defaults.profile || 'business-user'}`.trim().toLowerCase() || 'business-user';
  return {
    version: `${policy.version || BUILTIN_POLICY.version || '1.0.0'}`.trim() || '1.0.0',
    defaults: {
      profile: profiles[defaultProfile] ? defaultProfile : 'business-user'
    },
    profiles,
    environments
  };
}

async function loadPolicy(policyPath, cwd) {
  const resolved = resolvePath(cwd, policyPath || DEFAULT_POLICY);
  if (!(await fs.pathExists(resolved))) {
    return {
      source: 'builtin-default',
      from_file: false,
      policy: normalizePolicy(BUILTIN_POLICY)
    };
  }
  const raw = await readJsonFile(resolved, 'authorization tier policy');
  return {
    source: path.relative(cwd, resolved) || '.',
    from_file: true,
    policy: normalizePolicy(raw)
  };
}

function addViolation(violations, severity, code, message, details = {}) {
  violations.push({
    severity,
    code,
    message,
    details
  });
}

function decideFromViolations(violations = []) {
  if (violations.some(item => item && item.severity === 'deny')) {
    return 'deny';
  }
  if (violations.some(item => item && item.severity === 'review')) {
    return 'review-required';
  }
  return 'allow';
}

function evaluateAuthorizationTier(options, policy) {
  const activeProfile = options.dialogueProfile || policy.defaults.profile || 'business-user';
  const profileConfig = policy.profiles[activeProfile];
  if (!profileConfig) {
    throw new Error(`profile not found in policy: ${activeProfile}`);
  }
  const environmentConfig = policy.environments[options.runtimeEnvironment];
  if (!environmentConfig) {
    throw new Error(`runtime environment not found in policy: ${options.runtimeEnvironment}`);
  }

  const violations = [];
  const executionModeAllowed = profileConfig.allow_execution_modes.includes(options.executionMode);

  if (!executionModeAllowed) {
    addViolation(
      violations,
      'deny',
      'profile-execution-mode-not-allowed',
      `dialogue profile "${activeProfile}" does not allow execution_mode "${options.executionMode}"`,
      {
        dialogue_profile: activeProfile,
        execution_mode: options.executionMode,
        allow_execution_modes: profileConfig.allow_execution_modes
      }
    );
  }
  if (options.autoExecuteLowRisk && profileConfig.auto_execute_allowed !== true) {
    addViolation(
      violations,
      'deny',
      'profile-auto-execute-not-allowed',
      `dialogue profile "${activeProfile}" does not allow low-risk auto execute`,
      { dialogue_profile: activeProfile }
    );
  }
  if (options.liveApply && profileConfig.allow_live_apply !== true) {
    addViolation(
      violations,
      'deny',
      'profile-live-apply-not-allowed',
      `dialogue profile "${activeProfile}" does not allow live apply`,
      { dialogue_profile: activeProfile }
    );
  }
  if (options.executionMode === 'apply' && environmentConfig.manual_review_required_for_apply === true) {
    addViolation(
      violations,
      'review',
      'environment-manual-review-required',
      `runtime environment "${options.runtimeEnvironment}" requires manual review for apply`,
      { runtime_environment: options.runtimeEnvironment }
    );
  }

  const decision = decideFromViolations(violations);
  const requirements = {
    apply_allowed: executionModeAllowed,
    auto_execute_allowed: decision === 'allow' && profileConfig.auto_execute_allowed === true,
    live_apply_allowed: decision === 'allow' && profileConfig.allow_live_apply === true,
    require_secondary_authorization: environmentConfig.require_secondary_authorization === true,
    require_password_for_apply: environmentConfig.require_password_for_apply === true,
    require_role_policy: environmentConfig.require_role_policy === true,
    require_distinct_actor_roles: environmentConfig.require_distinct_actor_roles === true,
    manual_review_required_for_apply: environmentConfig.manual_review_required_for_apply === true
  };

  return {
    decision,
    reasons: violations.map(item => item.message),
    violations,
    context: {
      execution_mode: options.executionMode,
      dialogue_profile: activeProfile,
      runtime_mode: options.runtimeMode || null,
      runtime_environment: options.runtimeEnvironment,
      auto_execute_low_risk: options.autoExecuteLowRisk === true,
      live_apply: options.liveApply === true
    },
    requirements
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const outPath = resolvePath(cwd, options.out || DEFAULT_OUT);
  const policyRuntime = await loadPolicy(options.policy, cwd);
  const evaluation = evaluateAuthorizationTier(options, policyRuntime.policy);

  const payload = {
    mode: 'interactive-authorization-tier-evaluate',
    generated_at: new Date().toISOString(),
    policy: {
      source: policyRuntime.source,
      from_file: policyRuntime.from_file,
      version: policyRuntime.policy.version,
      default_profile: policyRuntime.policy.defaults.profile
    },
    ...evaluation,
    output: {
      json: path.relative(cwd, outPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, payload, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`Interactive authorization-tier decision: ${payload.decision}\n`);
    process.stdout.write(`- Profile: ${payload.context.dialogue_profile}\n`);
    process.stdout.write(`- Runtime: ${payload.context.runtime_environment}\n`);
    process.stdout.write(`- Output: ${payload.output.json}\n`);
  }

  if (options.failOnNonAllow && payload.decision !== 'allow') {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive authorization-tier evaluate failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_OUT,
  DIALOGUE_PROFILES,
  RUNTIME_ENVIRONMENTS,
  BUILTIN_POLICY,
  parseArgs,
  resolvePath,
  readJsonFile,
  normalizePolicy,
  loadPolicy,
  evaluateAuthorizationTier,
  main
};
