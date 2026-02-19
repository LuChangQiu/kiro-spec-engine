#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const DEFAULT_OUT_INTENT = '.kiro/reports/interactive-change-intent.json';
const DEFAULT_OUT_EXPLAIN = '.kiro/reports/interactive-page-explain.md';
const DEFAULT_AUDIT_FILE = '.kiro/reports/interactive-copilot-audit.jsonl';
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

function normalizeMaskKeywords(extraKeywords = []) {
  const normalized = [
    ...DEFAULT_MASK_KEYWORDS,
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

function inferRiskHint(goal, context = {}) {
  const merged = `${goal || ''} ${(context.module || '')} ${(context.entity || '')}`.toLowerCase();
  if (/(delete|drop|permission|privilege|payment|credential|secret|token)/.test(merged)) {
    return 'high';
  }
  if (/(approval|workflow|inventory|customer|order|pricing|refund)/.test(merged)) {
    return 'medium';
  }
  return 'low';
}

function analyzeContext(context, keywords) {
  const fields = Array.isArray(context && context.fields) ? context.fields : [];
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
    workflow_node: context && context.workflow_node ? context.workflow_node : null
  };
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function buildExplainMarkdown(payload) {
  const lines = [];
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
  lines.push(`- Risk hint: ${payload.risk_hint}`);
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
  const maskKeywords = normalizeMaskKeywords(options.maskKeys);
  const sanitizedContext = maskContextValue(rawContext, maskKeywords, false);
  const contextAnalysis = analyzeContext(rawContext, maskKeywords);
  const createdAt = new Date().toISOString();
  const sessionId = options.sessionId || `session-${crypto.randomUUID()}`;
  const intentId = `intent-${crypto.randomUUID()}`;
  const riskHint = inferRiskHint(goal, rawContext);

  const contextRef = {
    product: `${rawContext.product || rawContext.app || 'unknown-product'}`.trim(),
    module: `${rawContext.module || 'unknown-module'}`.trim(),
    page: rawContext.page || null,
    entity: rawContext.entity || null,
    scene_id: rawContext.scene_id || null,
    workflow_node: rawContext.workflow_node || null
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
      risk_hint: riskHint
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
    context_hash: sha256Hex(JSON.stringify(sanitizedContext))
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
