#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_OUT_INTENT = '.kiro/reports/interactive-change-intent.json';
const DEFAULT_OUT_EXPLAIN = '.kiro/reports/interactive-page-explain.md';
const DEFAULT_AUDIT_FILE = '.kiro/reports/interactive-copilot-audit.jsonl';
const DEFAULT_CONTEXT_CONTRACT = 'docs/interactive-customization/moqui-copilot-context-contract.json';
const DEFAULT_MASK_KEYWORDS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'credential',
  'ssn',
  'bank',
  'card',
  'email',
  'phone'
];
const BUILTIN_CONTEXT_CONTRACT = {
  version: '1.1.0',
  product: 'scene-capability-engine',
  context_contract: {
    required_fields: ['product', 'module', 'page'],
    optional_fields: [
      'entity',
      'scene_id',
      'workflow_node',
      'fields',
      'current_state',
      'scene_workspace',
      'assistant_panel'
    ],
    max_field_count: 400,
    max_payload_kb: 512
  },
  security_contract: {
    mode: 'read-only',
    masking_required: true,
    sensitive_key_patterns: [
      'password',
      'secret',
      'token',
      'api_key',
      'apikey',
      'credential',
      'email',
      'phone',
      'bank',
      'card'
    ],
    forbidden_keys: [
      'raw_password',
      'private_key',
      'access_token_plaintext'
    ]
  },
  runtime_contract: {
    provider: 'ui-context-provider',
    transport: 'json',
    schema: 'docs/interactive-customization/page-context.schema.json',
    consumer: 'scripts/interactive-intent-build.js'
  }
};

function parseArgs(argv) {
  const options = {
    context: null,
    goal: null,
    goalFile: null,
    userId: 'anonymous-user',
    sessionId: null,
    outIntent: DEFAULT_OUT_INTENT,
    outExplain: DEFAULT_OUT_EXPLAIN,
    auditFile: DEFAULT_AUDIT_FILE,
    contextContract: DEFAULT_CONTEXT_CONTRACT,
    contextContractExplicit: false,
    strictContract: true,
    maskKeys: [],
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--context' && next) {
      options.context = next;
      i += 1;
    } else if (token === '--goal' && next) {
      options.goal = next;
      i += 1;
    } else if (token === '--goal-file' && next) {
      options.goalFile = next;
      i += 1;
    } else if (token === '--user-id' && next) {
      options.userId = next;
      i += 1;
    } else if (token === '--session-id' && next) {
      options.sessionId = next;
      i += 1;
    } else if (token === '--out-intent' && next) {
      options.outIntent = next;
      i += 1;
    } else if (token === '--out-explain' && next) {
      options.outExplain = next;
      i += 1;
    } else if (token === '--audit-file' && next) {
      options.auditFile = next;
      i += 1;
    } else if (token === '--context-contract' && next) {
      options.contextContract = next;
      options.contextContractExplicit = true;
      i += 1;
    } else if (token === '--no-strict-contract') {
      options.strictContract = false;
    } else if (token === '--mask-keys' && next) {
      options.maskKeys = next.split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  if (!options.context) {
    throw new Error('--context is required.');
  }
  if (!options.goal && !options.goalFile) {
    throw new Error('either --goal or --goal-file is required.');
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-intent-build.js --context <path> (--goal <text> | --goal-file <path>) [options]',
    '',
    'Options:',
    '  --context <path>         Page context JSON file (required)',
    '  --goal <text>            Business goal text',
    '  --goal-file <path>       File containing business goal text',
    '  --user-id <id>           User identifier (default: anonymous-user)',
    '  --session-id <id>        Optional session identifier',
    `  --out-intent <path>      Intent output JSON file (default: ${DEFAULT_OUT_INTENT})`,
    `  --out-explain <path>     Explain output markdown file (default: ${DEFAULT_OUT_EXPLAIN})`,
    `  --audit-file <path>      Audit events JSONL file (default: ${DEFAULT_AUDIT_FILE})`,
    `  --context-contract <path> Context contract JSON file (default: ${DEFAULT_CONTEXT_CONTRACT}, fallback to built-in baseline when missing)`,
    '  --no-strict-contract     Do not fail when context contract validation has issues',
    '  --mask-keys <csv>        Additional sensitive key names to mask',
    '  --json                   Print result JSON to stdout',
    '  -h, --help               Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolveFile(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

async function readJsonFile(absolutePath, label) {
  if (!(await fs.pathExists(absolutePath))) {
    throw new Error(`${label} not found: ${absolutePath}`);
  }
  const text = await fs.readFile(absolutePath, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${label}: ${error.message}`);
  }
}

async function readGoal(options, cwd) {
  if (typeof options.goal === 'string' && options.goal.trim().length > 0) {
    return options.goal.trim();
  }
  const goalFilePath = resolveFile(cwd, options.goalFile);
  if (!(await fs.pathExists(goalFilePath))) {
    throw new Error(`goal file not found: ${goalFilePath}`);
  }
  const text = await fs.readFile(goalFilePath, 'utf8');
  const goal = `${text || ''}`.trim();
  if (!goal) {
    throw new Error('goal text is empty.');
  }
  return goal;
}

function toStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(
    new Set(
      input
        .map(item => `${item || ''}`.trim())
        .filter(Boolean)
    )
  );
}

function toNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeContextContract(rawContract = {}) {
  const contract = rawContract && typeof rawContract === 'object'
    ? rawContract
    : {};
  const contextContract = contract.context_contract && typeof contract.context_contract === 'object'
    ? contract.context_contract
    : {};
  const securityContract = contract.security_contract && typeof contract.security_contract === 'object'
    ? contract.security_contract
    : {};

  return {
    version: `${contract.version || BUILTIN_CONTEXT_CONTRACT.version}`,
    product: `${contract.product || BUILTIN_CONTEXT_CONTRACT.product}`,
    context_contract: {
      required_fields: toStringArray(
        contextContract.required_fields || BUILTIN_CONTEXT_CONTRACT.context_contract.required_fields
      ),
      optional_fields: toStringArray(
        contextContract.optional_fields || BUILTIN_CONTEXT_CONTRACT.context_contract.optional_fields
      ),
      max_field_count: toNumberOrNull(
        contextContract.max_field_count != null
          ? contextContract.max_field_count
          : BUILTIN_CONTEXT_CONTRACT.context_contract.max_field_count
      ),
      max_payload_kb: toNumberOrNull(
        contextContract.max_payload_kb != null
          ? contextContract.max_payload_kb
          : BUILTIN_CONTEXT_CONTRACT.context_contract.max_payload_kb
      )
    },
    security_contract: {
      mode: `${securityContract.mode || BUILTIN_CONTEXT_CONTRACT.security_contract.mode}`,
      masking_required: securityContract.masking_required !== false,
      sensitive_key_patterns: toStringArray(
        securityContract.sensitive_key_patterns || BUILTIN_CONTEXT_CONTRACT.security_contract.sensitive_key_patterns
      ).map(item => item.toLowerCase()),
      forbidden_keys: toStringArray(
        securityContract.forbidden_keys || BUILTIN_CONTEXT_CONTRACT.security_contract.forbidden_keys
      ).map(item => item.toLowerCase())
    },
    runtime_contract: contract.runtime_contract && typeof contract.runtime_contract === 'object'
      ? contract.runtime_contract
      : BUILTIN_CONTEXT_CONTRACT.runtime_contract
  };
}

async function loadContextContract(options, cwd) {
  const defaultContractPath = resolveFile(cwd, DEFAULT_CONTEXT_CONTRACT);
  const contractPath = options.contextContract
    ? resolveFile(cwd, options.contextContract)
    : defaultContractPath;

  const contractExists = await fs.pathExists(contractPath);
  if (contractExists) {
    const contract = await readJsonFile(contractPath, 'context contract');
    return {
      source: path.relative(cwd, contractPath) || '.',
      source_abs: contractPath,
      from_file: true,
      contract: normalizeContextContract(contract)
    };
  }

  if (options.contextContractExplicit === true) {
    throw new Error(`context contract not found: ${contractPath}`);
  }

  return {
    source: 'builtin-default',
    source_abs: null,
    from_file: false,
    contract: normalizeContextContract(BUILTIN_CONTEXT_CONTRACT)
  };
}

function hasContextFieldValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function collectForbiddenKeyHits(input, forbiddenKeys, prefix = []) {
  if (input === null || input === undefined || typeof input !== 'object') {
    return [];
  }

  const hits = [];
  for (const [key, value] of Object.entries(input)) {
    const keyLower = `${key || ''}`.trim().toLowerCase();
    const nextPrefix = [...prefix, key];
    if (forbiddenKeys.includes(keyLower)) {
      hits.push(nextPrefix.join('.'));
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        hits.push(...collectForbiddenKeyHits(item, forbiddenKeys, [...nextPrefix, String(index)]));
      });
    } else if (value && typeof value === 'object') {
      hits.push(...collectForbiddenKeyHits(value, forbiddenKeys, nextPrefix));
    }
  }

  return hits;
}

function validateContextAgainstContract(context, contract) {
  const contextContract = contract && contract.context_contract
    ? contract.context_contract
    : {};
  const securityContract = contract && contract.security_contract
    ? contract.security_contract
    : {};
  const requiredFields = toStringArray(contextContract.required_fields);
  const maxFieldCount = toNumberOrNull(contextContract.max_field_count);
  const maxPayloadKb = toNumberOrNull(contextContract.max_payload_kb);
  const forbiddenKeys = toStringArray(securityContract.forbidden_keys).map(item => item.toLowerCase());

  const issues = [];
  const fields = Array.isArray(context && context.fields) ? context.fields : [];
  const payloadBytes = Buffer.byteLength(JSON.stringify(context || {}), 'utf8');
  const payloadKb = Number((payloadBytes / 1024).toFixed(2));

  const missingRequired = requiredFields.filter(field => !hasContextFieldValue(context && context[field]));
  if (missingRequired.length > 0) {
    issues.push(`missing required fields: ${missingRequired.join(', ')}`);
  }
  if (maxFieldCount !== null && fields.length > maxFieldCount) {
    issues.push(`fields count ${fields.length} exceeds max_field_count ${maxFieldCount}`);
  }
  if (maxPayloadKb !== null && payloadKb > maxPayloadKb) {
    issues.push(`payload size ${payloadKb}KB exceeds max_payload_kb ${maxPayloadKb}KB`);
  }

  const forbiddenKeyHits = collectForbiddenKeyHits(context, forbiddenKeys);
  if (forbiddenKeyHits.length > 0) {
    issues.push(`forbidden keys present: ${forbiddenKeyHits.slice(0, 8).join(', ')}`);
  }

  return {
    valid: issues.length === 0,
    issues,
    metrics: {
      required_fields_total: requiredFields.length,
      field_total: fields.length,
      payload_kb: payloadKb,
      max_field_count: maxFieldCount,
      max_payload_kb: maxPayloadKb,
      forbidden_key_hits: forbiddenKeyHits.length
    }
  };
}

function normalizeMaskKeywords(extraKeywords = [], contractKeywords = []) {
  const normalized = [
    ...DEFAULT_MASK_KEYWORDS,
    ...contractKeywords,
    ...extraKeywords
  ]
    .map(item => `${item || ''}`.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function isSensitiveKeyName(key, keywords) {
  const lower = `${key || ''}`.trim().toLowerCase();
  if (!lower) {
    return false;
  }
  return keywords.some(keyword => lower.includes(keyword));
}

function maskContextValue(input, keywords, parentSensitive = false) {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => maskContextValue(item, keywords, parentSensitive));
  }

  if (typeof input !== 'object') {
    return parentSensitive ? '[REDACTED]' : input;
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    const childSensitive = parentSensitive || isSensitiveKeyName(key, keywords);
    if (typeof value === 'object' && value !== null) {
      output[key] = maskContextValue(value, keywords, childSensitive);
    } else {
      output[key] = childSensitive ? '[REDACTED]' : value;
    }
  }
  return output;
}

function parseConstraints(goal) {
  const text = `${goal || ''}`.trim();
  if (!text) {
    return [];
  }

  const patterns = [
    /\bmust\b[^.?!]*/ig,
    /\bcannot\b[^.?!]*/ig,
    /\bwithout\b[^.?!]*/ig,
    /\bneed to\b[^.?!]*/ig,
    /\bshould\b[^.?!]*/ig
  ];
  const found = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    matches.forEach(item => {
      const normalized = item.trim().replace(/\s+/g, ' ');
      if (normalized.length > 0 && !found.includes(normalized)) {
        found.push(normalized);
      }
    });
  }
  return found.slice(0, 8);
}

function inferPriority(goal) {
  const text = `${goal || ''}`.toLowerCase();
  if (/(urgent|asap|immediately|critical)/.test(text)) {
    return 'high';
  }
  if (/(later|eventually|optional|nice to have)/.test(text)) {
    return 'low';
  }
  return 'medium';
}

function inferRiskHint(goal, context = {}, contextAnalysis = {}) {
  const merged = `${goal || ''} ${(context.module || '')} ${(context.entity || '')}`.toLowerCase();
  if (/(delete|drop|permission|privilege|payment|credential|secret|token)/.test(merged)) {
    return 'high';
  }
  if (Number(contextAnalysis.forbidden_key_hits || 0) > 0) {
    return 'high';
  }
  if (Number(contextAnalysis.ontology_decision_total || 0) > 0 || Number(contextAnalysis.ontology_business_rule_total || 0) > 0) {
    return 'medium';
  }
  if (/(approval|workflow|inventory|customer|order|pricing|refund)/.test(merged)) {
    return 'medium';
  }
  return 'low';
}

function analyzeContext(context, keywords) {
  const fields = Array.isArray(context && context.fields) ? context.fields : [];
  const workspace = context && context.scene_workspace && typeof context.scene_workspace === 'object'
    ? context.scene_workspace
    : {};
  const ontology = workspace.ontology && typeof workspace.ontology === 'object'
    ? workspace.ontology
    : (context && context.ontology && typeof context.ontology === 'object' ? context.ontology : {});
  const assistantPanel = workspace.assistant_panel && typeof workspace.assistant_panel === 'object'
    ? workspace.assistant_panel
    : (context && context.assistant_panel && typeof context.assistant_panel === 'object' ? context.assistant_panel : {});
  const explorer = workspace.screen_explorer && typeof workspace.screen_explorer === 'object'
    ? workspace.screen_explorer
    : {};
  const sensitiveFieldCount = fields.filter(field => {
    if (!field || typeof field !== 'object') {
      return false;
    }
    if (field.sensitive === true) {
      return true;
    }
    return isSensitiveKeyName(field.name || '', keywords);
  }).length;

  return {
    field_total: fields.length,
    sensitive_field_total: sensitiveFieldCount,
    workflow_node: context && context.workflow_node ? context.workflow_node : null,
    ontology_entity_total: Array.isArray(ontology.entities) ? ontology.entities.length : 0,
    ontology_relation_total: Array.isArray(ontology.relations) ? ontology.relations.length : 0,
    ontology_business_rule_total: Array.isArray(ontology.business_rules) ? ontology.business_rules.length : 0,
    ontology_decision_total: Array.isArray(ontology.decision_policies) ? ontology.decision_policies.length : 0,
    has_scene_workspace: Boolean(context && context.scene_workspace),
    explorer_result_total: Number.isFinite(Number(explorer.result_total)) ? Number(explorer.result_total) : null,
    explorer_selected_component: explorer.selected_component || null,
    assistant_session_id: assistantPanel.session_id || null
  };
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function buildExplainMarkdown(payload) {
  const lines = [];
  const contract = payload.contract_validation || {};
  lines.push('# Interactive Copilot Read-Only Explain');
  lines.push('');
  lines.push(`- Generated at: ${payload.generated_at}`);
  lines.push(`- Session: ${payload.session_id}`);
  lines.push(`- User: ${payload.user_id}`);
  lines.push(`- Read-only mode: yes`);
  lines.push(`- Product/module/page: ${payload.intent.context_ref.product}/${payload.intent.context_ref.module}/${payload.intent.context_ref.page || 'n/a'}`);
  lines.push(`- Entity: ${payload.intent.context_ref.entity || 'n/a'}`);
  lines.push(`- Scene: ${payload.intent.context_ref.scene_id || 'n/a'}`);
  lines.push(`- Workflow node: ${payload.intent.context_ref.workflow_node || 'n/a'}`);
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(payload.goal);
  lines.push('');
  lines.push('## Constraints');
  lines.push('');
  if (!Array.isArray(payload.intent.constraints) || payload.intent.constraints.length === 0) {
    lines.push('- none detected');
  } else {
    payload.intent.constraints.forEach(item => lines.push(`- ${item}`));
  }
  lines.push('');
  lines.push('## Context Summary');
  lines.push('');
  lines.push(`- Fields: ${payload.context_analysis.field_total}`);
  lines.push(`- Sensitive fields: ${payload.context_analysis.sensitive_field_total}`);
  lines.push(`- Ontology entities: ${payload.context_analysis.ontology_entity_total}`);
  lines.push(`- Ontology relations: ${payload.context_analysis.ontology_relation_total}`);
  lines.push(`- Business rules: ${payload.context_analysis.ontology_business_rule_total}`);
  lines.push(`- Decision policies: ${payload.context_analysis.ontology_decision_total}`);
  lines.push(`- Explorer selected component: ${payload.context_analysis.explorer_selected_component || 'n/a'}`);
  lines.push(`- Assistant session: ${payload.context_analysis.assistant_session_id || 'n/a'}`);
  lines.push(`- Risk hint: ${payload.risk_hint}`);
  lines.push('');
  lines.push('## Contract Validation');
  lines.push('');
  lines.push(`- Source: ${contract.source || 'n/a'}`);
  lines.push(`- Strict mode: ${contract.strict ? 'yes' : 'no'}`);
  lines.push(`- Result: ${contract.valid ? 'pass' : 'fail'}`);
  if (contract.metrics) {
    lines.push(`- Payload size: ${contract.metrics.payload_kb}KB`);
    lines.push(`- Max payload: ${contract.metrics.max_payload_kb == null ? 'n/a' : `${contract.metrics.max_payload_kb}KB`}`);
    lines.push(`- Forbidden key hits: ${contract.metrics.forbidden_key_hits}`);
  }
  if (Array.isArray(contract.issues) && contract.issues.length > 0) {
    lines.push('- Issues:');
    contract.issues.forEach(item => lines.push(`  - ${item}`));
  }
  lines.push('');
  lines.push('## Execution Policy');
  lines.push('');
  lines.push('- This output is read-only and suggestion-first.');
  lines.push('- No write operation is executed by this script.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const contextPath = resolveFile(cwd, options.context);
  const outIntentPath = resolveFile(cwd, options.outIntent);
  const outExplainPath = resolveFile(cwd, options.outExplain);
  const auditFilePath = resolveFile(cwd, options.auditFile);
  const goal = await readGoal(options, cwd);
  const rawContext = await readJsonFile(contextPath, 'context');
  const contractRuntime = await loadContextContract(options, cwd);
  const contractValidation = validateContextAgainstContract(rawContext, contractRuntime.contract);
  if (options.strictContract && !contractValidation.valid) {
    throw new Error(`context contract validation failed: ${contractValidation.issues.join(' | ')}`);
  }
  const contractMaskKeywords = contractRuntime.contract
    && contractRuntime.contract.security_contract
    && Array.isArray(contractRuntime.contract.security_contract.sensitive_key_patterns)
    ? contractRuntime.contract.security_contract.sensitive_key_patterns
    : [];
  const maskKeywords = normalizeMaskKeywords(options.maskKeys, contractMaskKeywords);
  const sanitizedContext = maskContextValue(rawContext, maskKeywords, false);
  const contextAnalysis = {
    ...analyzeContext(rawContext, maskKeywords),
    forbidden_key_hits: contractValidation.metrics.forbidden_key_hits
  };
  const createdAt = new Date().toISOString();
  const sessionId = options.sessionId || `session-${crypto.randomUUID()}`;
  const intentId = `intent-${crypto.randomUUID()}`;
  const riskHint = inferRiskHint(goal, rawContext, contextAnalysis);
  const workspace = rawContext && rawContext.scene_workspace && typeof rawContext.scene_workspace === 'object'
    ? rawContext.scene_workspace
    : {};
  const explorer = workspace.screen_explorer && typeof workspace.screen_explorer === 'object'
    ? workspace.screen_explorer
    : {};

  const contextRef = {
    product: `${rawContext.product || rawContext.app || 'unknown-product'}`.trim(),
    module: `${rawContext.module || 'unknown-module'}`.trim(),
    page: rawContext.page || null,
    entity: rawContext.entity || null,
    scene_id: rawContext.scene_id || null,
    workflow_node: rawContext.workflow_node || null,
    screen: rawContext.screen || explorer.selected_screen || null,
    component: rawContext.component || explorer.selected_component || null
  };

  const intent = {
    intent_id: intentId,
    session_id: sessionId,
    user_id: options.userId,
    context_ref: contextRef,
    business_goal: goal,
    constraints: parseConstraints(goal),
    priority: inferPriority(goal),
    created_at: createdAt,
    metadata: {
      mode: 'read-only',
      source: 'interactive-intent-build',
      context_summary: contextAnalysis,
      risk_hint: riskHint,
      contract_validation: {
        valid: contractValidation.valid,
        issues_count: contractValidation.issues.length,
        source: contractRuntime.source
      }
    }
  };

  const auditEvent = {
    event_id: `event-${crypto.randomUUID()}`,
    event_type: 'interactive.intent.generated',
    timestamp: createdAt,
    readonly: true,
    user_id: options.userId,
    session_id: sessionId,
    intent_id: intentId,
    context_ref: contextRef,
    risk_hint: riskHint,
    context_hash: sha256Hex(JSON.stringify(sanitizedContext)),
    contract_valid: contractValidation.valid,
    contract_source: contractRuntime.source
  };

  const payload = {
    mode: 'interactive-intent-build',
    generated_at: createdAt,
    readonly: true,
    user_id: options.userId,
    session_id: sessionId,
    goal,
    risk_hint: riskHint,
    context_analysis: contextAnalysis,
    contract_validation: {
      source: contractRuntime.source,
      from_file: contractRuntime.from_file,
      strict: options.strictContract,
      valid: contractValidation.valid,
      issues: contractValidation.issues,
      metrics: contractValidation.metrics
    },
    intent,
    sanitized_context_preview: sanitizedContext,
    output: {
      intent: path.relative(cwd, outIntentPath) || '.',
      explain: path.relative(cwd, outExplainPath) || '.',
      audit: path.relative(cwd, auditFilePath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outIntentPath));
  await fs.writeJson(outIntentPath, intent, { spaces: 2 });
  await fs.ensureDir(path.dirname(outExplainPath));
  await fs.writeFile(outExplainPath, buildExplainMarkdown(payload), 'utf8');
  await fs.ensureDir(path.dirname(auditFilePath));
  await fs.appendFile(auditFilePath, `${JSON.stringify(auditEvent)}\n`, 'utf8');

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive intent built (read-only).\n');
    process.stdout.write(`- Intent: ${payload.output.intent}\n`);
    process.stdout.write(`- Explain: ${payload.output.explain}\n`);
    process.stdout.write(`- Audit: ${payload.output.audit}\n`);
  }
}

main().catch((error) => {
  console.error(`Interactive intent build failed: ${error.message}`);
  process.exit(1);
});
