#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_PROVIDER = 'moqui';
const DEFAULT_CONTEXT_CONTRACT = 'docs/interactive-customization/moqui-copilot-context-contract.json';
const DEFAULT_OUT_CONTEXT = '.kiro/reports/interactive-page-context.normalized.json';
const DEFAULT_OUT_REPORT = '.kiro/reports/interactive-context-bridge.json';
const SUPPORTED_PROVIDERS = new Set(['moqui', 'generic']);
const SENSITIVE_NAME_PATTERN = /(password|secret|token|api[_-]?key|credential|email|phone|bank|card)/i;
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
    input: null,
    provider: DEFAULT_PROVIDER,
    outContext: DEFAULT_OUT_CONTEXT,
    outReport: DEFAULT_OUT_REPORT,
    contextContract: DEFAULT_CONTEXT_CONTRACT,
    strictContract: true,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--input' && next) {
      options.input = next;
      index += 1;
    } else if (token === '--provider' && next) {
      options.provider = next;
      index += 1;
    } else if (token === '--out-context' && next) {
      options.outContext = next;
      index += 1;
    } else if (token === '--out-report' && next) {
      options.outReport = next;
      index += 1;
    } else if (token === '--context-contract' && next) {
      options.contextContract = next;
      index += 1;
    } else if (token === '--no-strict-contract') {
      options.strictContract = false;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  options.input = `${options.input || ''}`.trim();
  options.provider = `${options.provider || ''}`.trim().toLowerCase() || DEFAULT_PROVIDER;
  options.outContext = `${options.outContext || ''}`.trim() || DEFAULT_OUT_CONTEXT;
  options.outReport = `${options.outReport || ''}`.trim() || DEFAULT_OUT_REPORT;
  options.contextContract = `${options.contextContract || ''}`.trim() || DEFAULT_CONTEXT_CONTRACT;

  if (!options.input) {
    throw new Error('--input is required.');
  }
  if (!SUPPORTED_PROVIDERS.has(options.provider)) {
    throw new Error(`--provider must be one of: ${Array.from(SUPPORTED_PROVIDERS).join(', ')}`);
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/interactive-context-bridge.js --input <path> [options]',
    '',
    'Options:',
    '  --input <path>             Raw provider payload JSON path (required)',
    `  --provider <name>          Provider dialect (moqui|generic, default: ${DEFAULT_PROVIDER})`,
    `  --out-context <path>       Normalized page-context output (default: ${DEFAULT_OUT_CONTEXT})`,
    `  --out-report <path>        Bridge report output (default: ${DEFAULT_OUT_REPORT})`,
    `  --context-contract <path>  Context contract JSON (default: ${DEFAULT_CONTEXT_CONTRACT}, fallback built-in baseline when absent)`,
    '  --no-strict-contract       Keep exit code 0 even when contract validation fails',
    '  --json                     Print bridge report as JSON',
    '  -h, --help                 Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function resolvePath(cwd, value) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
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

function firstNonEmpty(...values) {
  for (const value of values) {
    const candidate = `${value || ''}`.trim();
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function normalizeNameToken(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function inferSensitiveFromName(name) {
  return SENSITIVE_NAME_PATTERN.test(`${name || ''}`);
}

function normalizeFieldItem(item) {
  if (typeof item === 'string') {
    const name = `${item}`.trim();
    if (!name) {
      return null;
    }
    return {
      name,
      type: 'string',
      sensitive: inferSensitiveFromName(name)
    };
  }
  if (!item || typeof item !== 'object') {
    return null;
  }

  const name = firstNonEmpty(item.name, item.key, item.id, item.field, item.field_name);
  if (!name) {
    return null;
  }

  const type = firstNonEmpty(item.type, item.data_type, item.datatype, item.kind, 'string');
  const explicitSensitive = item.sensitive === true || item.is_sensitive === true;

  return {
    name,
    type,
    sensitive: explicitSensitive || inferSensitiveFromName(name),
    description: firstNonEmpty(item.description, item.label, item.hint)
  };
}

function normalizeFieldArray(input) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const normalized = normalizeFieldItem(entry);
    if (!normalized) {
      continue;
    }
    const key = normalizeNameToken(normalized.name);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeListValues(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const values = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const value = `${item}`.trim();
      if (value) {
        values.push(value);
      }
      continue;
    }
    if (item && typeof item === 'object') {
      const value = firstNonEmpty(item.name, item.id, item.code, item.key, item.label);
      if (value) {
        values.push(value);
      }
    }
  }
  return Array.from(new Set(values));
}

function normalizeAssistantPanel(raw = {}) {
  const workspace = raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : {};
  const source = (
    (raw.assistant_panel && typeof raw.assistant_panel === 'object' && raw.assistant_panel)
    || (raw.assistant && typeof raw.assistant === 'object' && raw.assistant)
    || (workspace.assistant_panel && typeof workspace.assistant_panel === 'object' && workspace.assistant_panel)
    || {}
  );

  return {
    session_id: firstNonEmpty(source.session_id, source.sessionId),
    agent_id: firstNonEmpty(source.agent_id, source.agentId, source.agent, source.codename),
    model: firstNonEmpty(source.model, source.model_id, source.modelId),
    mode: firstNonEmpty(source.mode, source.permission_mode, source.permissionMode),
    current_page_context: firstNonEmpty(
      source.current_page_context,
      source.currentPageContext,
      source.prompt,
      source.initial_prompt
    )
  };
}

function normalizeScreenExplorer(raw = {}) {
  const workspace = raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : {};
  const sceneWorkspace = raw.scene_workspace && typeof raw.scene_workspace === 'object' ? raw.scene_workspace : {};
  const source = (
    (sceneWorkspace.screen_explorer && typeof sceneWorkspace.screen_explorer === 'object' && sceneWorkspace.screen_explorer)
    || (workspace.screen_explorer && typeof workspace.screen_explorer === 'object' && workspace.screen_explorer)
    || (raw.screen_explorer && typeof raw.screen_explorer === 'object' && raw.screen_explorer)
    || {}
  );

  return {
    active_tab: firstNonEmpty(source.active_tab, source.activeTab),
    selected_screen: firstNonEmpty(source.selected_screen, source.selectedScreen),
    selected_component: firstNonEmpty(source.selected_component, source.selectedComponent),
    filters: toStringArray(source.filters),
    result_total: toNumberOrNull(source.result_total != null ? source.result_total : source.resultTotal)
  };
}

function normalizeOntology(raw = {}) {
  const workspace = raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : {};
  const sceneWorkspace = raw.scene_workspace && typeof raw.scene_workspace === 'object' ? raw.scene_workspace : {};
  const source = (
    (sceneWorkspace.ontology && typeof sceneWorkspace.ontology === 'object' && sceneWorkspace.ontology)
    || (workspace.ontology && typeof workspace.ontology === 'object' && workspace.ontology)
    || (raw.ontology && typeof raw.ontology === 'object' && raw.ontology)
    || {}
  );

  return {
    entities: normalizeListValues(source.entities),
    relations: normalizeListValues(source.relations),
    business_rules: normalizeListValues(source.business_rules || source.businessRules),
    decision_policies: normalizeListValues(source.decision_policies || source.decisionPolicies)
  };
}

function pickCurrentState(raw = {}) {
  const workspace = raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : {};
  return raw.current_state
    || workspace.current_state
    || raw.page_state
    || raw.state
    || {};
}

function buildNormalizedContext(raw = {}, provider = DEFAULT_PROVIDER) {
  const workspace = raw.workspace && typeof raw.workspace === 'object' ? raw.workspace : {};
  const scene = (
    (workspace.scene && typeof workspace.scene === 'object' && workspace.scene)
    || (raw.scene && typeof raw.scene === 'object' && raw.scene)
    || {}
  );
  const explorer = normalizeScreenExplorer(raw);
  const ontology = normalizeOntology(raw);
  const assistantPanel = normalizeAssistantPanel(raw);

  const candidateFields = [
    raw.fields,
    raw.page_fields,
    workspace.fields,
    workspace.field_catalog,
    raw.field_catalog,
    raw.scene_workspace && raw.scene_workspace.fields
  ];

  let fields = [];
  for (const candidate of candidateFields) {
    fields = normalizeFieldArray(candidate);
    if (fields.length > 0) {
      break;
    }
  }

  if (provider === 'generic' && fields.length === 0) {
    fields = normalizeFieldArray(raw.attributes);
  }

  return {
    product: firstNonEmpty(raw.product, raw.app, workspace.product),
    module: firstNonEmpty(raw.module, workspace.module, raw.domain),
    page: firstNonEmpty(raw.page, workspace.page, raw.route, explorer.selected_screen),
    entity: firstNonEmpty(raw.entity, workspace.entity, explorer.selected_component),
    scene_id: firstNonEmpty(raw.scene_id, scene.id, scene.scene_id),
    workflow_node: firstNonEmpty(raw.workflow_node, scene.workflow_node, workspace.workflow_node),
    fields,
    current_state: pickCurrentState(raw),
    scene_workspace: {
      scene_name: firstNonEmpty(scene.name, raw.scene_name, workspace.scene_name),
      scene_type: firstNonEmpty(scene.type, raw.scene_type, workspace.scene_type),
      screen_explorer: explorer,
      ontology
    },
    assistant_panel: assistantPanel
  };
}

function pruneObject(input) {
  if (Array.isArray(input)) {
    return input.map(item => pruneObject(item)).filter(item => item !== undefined);
  }
  if (!input || typeof input !== 'object') {
    if (input === null || input === undefined || input === '') {
      return undefined;
    }
    return input;
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = pruneObject(value);
    if (normalized === undefined) {
      continue;
    }
    if (Array.isArray(normalized) && normalized.length === 0) {
      continue;
    }
    if (normalized && typeof normalized === 'object' && !Array.isArray(normalized) && Object.keys(normalized).length === 0) {
      continue;
    }
    output[key] = normalized;
  }
  return Object.keys(output).length === 0 ? undefined : output;
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
    context_contract: {
      required_fields: toStringArray(
        contextContract.required_fields || BUILTIN_CONTEXT_CONTRACT.context_contract.required_fields
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
      forbidden_keys: toStringArray(
        securityContract.forbidden_keys || BUILTIN_CONTEXT_CONTRACT.security_contract.forbidden_keys
      ).map(item => item.toLowerCase())
    }
  };
}

async function loadContextContract(contractPath) {
  if (await fs.pathExists(contractPath)) {
    const content = await fs.readFile(contractPath, 'utf8');
    let parsed = {};
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`invalid JSON in context contract: ${error.message}`);
    }
    return {
      source: contractPath,
      from_file: true,
      contract: normalizeContextContract(parsed)
    };
  }

  return {
    source: 'builtin-default',
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
  const requiredFields = toStringArray(contract.context_contract && contract.context_contract.required_fields);
  const maxFieldCount = toNumberOrNull(contract.context_contract && contract.context_contract.max_field_count);
  const maxPayloadKb = toNumberOrNull(contract.context_contract && contract.context_contract.max_payload_kb);
  const forbiddenKeys = toStringArray(contract.security_contract && contract.security_contract.forbidden_keys).map(item => item.toLowerCase());
  const fields = Array.isArray(context && context.fields) ? context.fields : [];
  const payloadBytes = Buffer.byteLength(JSON.stringify(context || {}), 'utf8');
  const payloadKb = Number((payloadBytes / 1024).toFixed(2));

  const issues = [];
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const inputPath = resolvePath(cwd, options.input);
  const outContextPath = resolvePath(cwd, options.outContext);
  const outReportPath = resolvePath(cwd, options.outReport);
  const contextContractPath = resolvePath(cwd, options.contextContract);

  if (!(await fs.pathExists(inputPath))) {
    throw new Error(`input not found: ${inputPath}`);
  }

  const rawText = await fs.readFile(inputPath, 'utf8');
  let rawPayload;
  try {
    rawPayload = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`invalid JSON in input payload: ${error.message}`);
  }

  const normalizedContext = pruneObject(buildNormalizedContext(rawPayload, options.provider)) || {};
  const contractRuntime = await loadContextContract(contextContractPath);
  const validation = validateContextAgainstContract(normalizedContext, contractRuntime.contract);

  if (options.strictContract && !validation.valid) {
    throw new Error(`context contract validation failed: ${validation.issues.join(' | ')}`);
  }

  const generatedAt = new Date().toISOString();
  const report = {
    mode: 'interactive-context-bridge',
    generated_at: generatedAt,
    provider: options.provider,
    strict_contract: options.strictContract,
    contract_source: contractRuntime.from_file
      ? (path.relative(cwd, contractRuntime.source) || '.')
      : contractRuntime.source,
    validation,
    summary: {
      has_scene_workspace: Boolean(normalizedContext.scene_workspace),
      has_assistant_panel: Boolean(normalizedContext.assistant_panel),
      ontology_entity_total: Array.isArray(
        normalizedContext.scene_workspace
        && normalizedContext.scene_workspace.ontology
        && normalizedContext.scene_workspace.ontology.entities
      ) ? normalizedContext.scene_workspace.ontology.entities.length : 0
    },
    input: path.relative(cwd, inputPath) || '.',
    output: {
      context: path.relative(cwd, outContextPath) || '.',
      report: path.relative(cwd, outReportPath) || '.'
    }
  };

  await fs.ensureDir(path.dirname(outContextPath));
  await fs.writeJson(outContextPath, normalizedContext, { spaces: 2 });
  await fs.ensureDir(path.dirname(outReportPath));
  await fs.writeJson(outReportPath, report, { spaces: 2 });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write('Interactive context bridge completed.\n');
    process.stdout.write(`- Provider: ${report.provider}\n`);
    process.stdout.write(`- Contract valid: ${validation.valid ? 'yes' : 'no'}\n`);
    process.stdout.write(`- Context: ${report.output.context}\n`);
    process.stdout.write(`- Report: ${report.output.report}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Interactive context bridge failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_PROVIDER,
  DEFAULT_CONTEXT_CONTRACT,
  DEFAULT_OUT_CONTEXT,
  DEFAULT_OUT_REPORT,
  SUPPORTED_PROVIDERS,
  parseArgs,
  resolvePath,
  buildNormalizedContext,
  validateContextAgainstContract,
  main
};
