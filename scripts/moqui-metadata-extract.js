#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_PROJECT_DIR = '.';
const DEFAULT_OUT = 'docs/moqui/metadata-catalog.json';
const DEFAULT_MARKDOWN_OUT = 'docs/moqui/metadata-catalog.md';
const DEFAULT_HANDOFF_MANIFEST = 'docs/handoffs/handoff-manifest.json';
const DEFAULT_CAPABILITY_MATRIX = 'docs/handoffs/capability-matrix.md';
const DEFAULT_EVIDENCE_DIR = 'docs/handoffs/evidence';
const DEFAULT_SALVAGE_DIR = '.kiro/recovery/salvage';
const MAX_HINT_ITEMS = 64;

function parseArgs(argv) {
  const options = {
    projectDir: DEFAULT_PROJECT_DIR,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--project-dir' && next) {
      options.projectDir = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--json') {
      options.json = true;
    } else if (token === '--help' || token === '-h') {
      printHelpAndExit(0);
    }
  }

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/moqui-metadata-extract.js [options]',
    '',
    'Options:',
    `  --project-dir <path>   Moqui project root to scan (default: ${DEFAULT_PROJECT_DIR})`,
    `  --out <path>           Metadata JSON output path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Metadata markdown summary path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --json                 Print JSON payload to stdout',
    '  -h, --help             Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = `${value}`.trim();
  return text.length > 0 ? text : null;
}

function normalizeIdentifier(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeEntityName(entityName, packageName) {
  const entity = normalizeText(entityName);
  if (!entity) {
    return null;
  }
  if (entity.includes('.')) {
    return entity;
  }
  const pkg = normalizeText(packageName);
  return pkg ? `${pkg}.${entity}` : entity;
}

function parseAttributes(tagText) {
  const attrs = {};
  if (!tagText) {
    return attrs;
  }
  const pattern = /([a-zA-Z0-9:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match = pattern.exec(tagText);
  while (match) {
    const key = `${match[1]}`.trim();
    const value = normalizeText(match[3] !== undefined ? match[3] : match[4]);
    if (key && value !== null) {
      attrs[key] = value;
    }
    match = pattern.exec(tagText);
  }
  return attrs;
}

function firstDefined(source, keys) {
  for (const key of keys) {
    const value = source && Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : undefined;
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function readPathValue(payload, pathText) {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const segments = `${pathText || ''}`
    .split('.')
    .map(token => token.trim())
    .filter(Boolean);
  let cursor = payload;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function collectArrayFromPaths(payload, paths) {
  for (const pathText of paths) {
    const raw = readPathValue(payload, pathText);
    if (Array.isArray(raw)) {
      return raw;
    }
  }
  return [];
}

function pickField(source, candidates) {
  for (const candidate of candidates) {
    const value = readPathValue(source, candidate);
    const text = normalizeText(value);
    if (text) {
      return text;
    }
  }
  return null;
}

function readNumberFirst(payload, paths) {
  for (const pathText of paths) {
    const value = readPathValue(payload, pathText);
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }
  return 0;
}

function collectEntityModels(content, sourceFile) {
  const models = [];
  const blocks = content.match(/<entity\b[\s\S]*?<\/entity>/gi) || [];
  for (const block of blocks) {
    const openTagMatch = block.match(/<entity\b[^>]*>/i);
    if (!openTagMatch) {
      continue;
    }
    const attrs = parseAttributes(openTagMatch[0]);
    const name = firstDefined(attrs, ['entity-name', 'name']);
    const packageName = firstDefined(attrs, ['package-name', 'package']);
    const fullName = normalizeEntityName(name, packageName);
    if (!fullName) {
      continue;
    }

    const relations = [];
    const relationPattern = /<relationship\b[^>]*>/gi;
    let relationMatch = relationPattern.exec(block);
    while (relationMatch) {
      const relationAttrs = parseAttributes(relationMatch[0]);
      const related = firstDefined(relationAttrs, [
        'related-entity-name',
        'related-entity',
        'related',
        'entity-name'
      ]);
      const normalizedRelated = normalizeText(related);
      if (normalizedRelated) {
        relations.push(normalizedRelated);
      }
      relationMatch = relationPattern.exec(block);
    }

    models.push({
      name: fullName,
      package: packageName,
      relations,
      source_file: sourceFile
    });
  }
  return models;
}

function collectServiceModels(content, sourceFile) {
  const models = [];
  const blocks = content.match(/<service\b[\s\S]*?<\/service>/gi) || [];
  for (const block of blocks) {
    const openTagMatch = block.match(/<service\b[^>]*>/i);
    if (!openTagMatch) {
      continue;
    }
    const attrs = parseAttributes(openTagMatch[0]);
    const verb = firstDefined(attrs, ['verb']);
    const noun = firstDefined(attrs, ['noun']);
    const explicitName = firstDefined(attrs, ['service-name', 'name']);
    let name = explicitName;
    if (!name && (verb || noun)) {
      name = `${verb || 'service'}#${noun || 'operation'}`;
    }
    if (!name) {
      continue;
    }

    const entities = [];
    const entityRefPattern = /entity-name\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let entityMatch = entityRefPattern.exec(block);
    while (entityMatch) {
      const value = normalizeText(entityMatch[2] !== undefined ? entityMatch[2] : entityMatch[3]);
      if (value) {
        entities.push(value);
      }
      entityMatch = entityRefPattern.exec(block);
    }

    models.push({
      name,
      verb,
      noun,
      entities,
      source_file: sourceFile
    });
  }
  return models;
}

function collectScreenModels(content, sourceFile) {
  const hasScreen = /<screen\b/i.test(content);
  if (!hasScreen) {
    return [];
  }

  const screenTagMatch = content.match(/<screen\b[^>]*>/i);
  const screenAttrs = parseAttributes(screenTagMatch ? screenTagMatch[0] : '');
  const screenPath = firstDefined(screenAttrs, ['name', 'location']) || sourceFile;

  const services = [];
  const servicePattern = /service-name\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let serviceMatch = servicePattern.exec(content);
  while (serviceMatch) {
    const value = normalizeText(serviceMatch[2] !== undefined ? serviceMatch[2] : serviceMatch[3]);
    if (value) {
      services.push(value);
    }
    serviceMatch = servicePattern.exec(content);
  }

  const entities = [];
  const entityPattern = /entity-name\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let entityMatch = entityPattern.exec(content);
  while (entityMatch) {
    const value = normalizeText(entityMatch[2] !== undefined ? entityMatch[2] : entityMatch[3]);
    if (value) {
      entities.push(value);
    }
    entityMatch = entityPattern.exec(content);
  }

  return [{
    path: screenPath,
    services,
    entities,
    source_file: sourceFile
  }];
}

function collectFormModels(content, sourceFile) {
  const models = [];
  const blocks = content.match(/<(form-single|form-list|form)\b[\s\S]*?<\/\1>/gi) || [];
  for (const block of blocks) {
    const openTagMatch = block.match(/<(form-single|form-list|form)\b[^>]*>/i);
    if (!openTagMatch) {
      continue;
    }
    const attrs = parseAttributes(openTagMatch[0]);
    const name = firstDefined(attrs, ['name']) || `${sourceFile}#form`;
    const fieldCount = (block.match(/<field\b/gi) || []).length;
    models.push({
      name,
      screen: sourceFile,
      field_count: fieldCount,
      source_file: sourceFile
    });
  }

  const selfClosing = content.match(/<(form-single|form-list|form)\b[^>]*\/>/gi) || [];
  for (const tag of selfClosing) {
    const attrs = parseAttributes(tag);
    const name = firstDefined(attrs, ['name']);
    if (!name) {
      continue;
    }
    models.push({
      name,
      screen: sourceFile,
      field_count: 0,
      source_file: sourceFile
    });
  }

  return models;
}

function collectNamedTags(content, tagName, fieldLabel, sourceFile) {
  const items = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match = pattern.exec(content);
  while (match) {
    const attrs = parseAttributes(match[0]);
    const value = firstDefined(attrs, ['name', 'id', fieldLabel]);
    if (value) {
      items.push({
        name: value,
        source_file: sourceFile
      });
    }
    match = pattern.exec(content);
  }
  return items;
}

function parseNamedArray(entries, fieldCandidates, sourceFile) {
  const result = [];
  for (const entry of toArray(entries)) {
    const value = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, fieldCandidates);
    if (!value) {
      continue;
    }
    result.push({
      name: value,
      source_file: sourceFile
    });
  }
  return result;
}

function collectModelsFromScenePackage(payload, sourceFile) {
  if (!payload || typeof payload !== 'object') {
    return {
      entities: [],
      services: [],
      screens: [],
      forms: [],
      businessRules: [],
      decisions: [],
      templateRefs: [],
      capabilityRefs: []
    };
  }

  const ontologyModel = payload.ontology_model && typeof payload.ontology_model === 'object'
    ? payload.ontology_model
    : {};
  const capabilityContract = payload.capability_contract && typeof payload.capability_contract === 'object'
    ? payload.capability_contract
    : {};
  const governanceContract = payload.governance_contract && typeof payload.governance_contract === 'object'
    ? payload.governance_contract
    : {};
  const capabilities = payload.capabilities && typeof payload.capabilities === 'object'
    ? payload.capabilities
    : {};
  const artifacts = payload.artifacts && typeof payload.artifacts === 'object'
    ? payload.artifacts
    : {};
  const metadata = payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata
    : {};
  const agentHints = payload.agent_hints && typeof payload.agent_hints === 'object'
    ? payload.agent_hints
    : {};

  const entities = [];
  const services = [];
  const screens = [];
  const forms = [];
  const businessRules = [];
  const decisions = [];

  const ontologyEntities = toArray(ontologyModel.entities);
  for (const item of ontologyEntities) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const id = pickField(item, ['id', 'name', 'ref', 'entity']);
    if (!id) {
      continue;
    }
    const type = normalizeIdentifier(pickField(item, ['type'])) || '';
    if (type === 'entity' || /^entity:/i.test(id)) {
      entities.push({
        name: id.replace(/^entity:/i, ''),
        package: null,
        relations: [],
        source_file: sourceFile
      });
      continue;
    }
    if (['query', 'invoke', 'service', 'action', 'command', 'operation'].includes(type)) {
      services.push({
        name: id,
        verb: null,
        noun: null,
        entities: [],
        source_file: sourceFile
      });
    }
  }

  for (const binding of toArray(capabilityContract.bindings)) {
    if (!binding || typeof binding !== 'object') {
      continue;
    }
    const ref = pickField(binding, ['ref', 'service', 'service_name', 'name', 'id']);
    if (!ref) {
      continue;
    }
    services.push({
      name: ref,
      verb: pickField(binding, ['verb']),
      noun: pickField(binding, ['noun']),
      entities: [],
      source_file: sourceFile
    });
  }

  const entryScene = pickField(artifacts, ['entry_scene', 'entryScene', 'scene']);
  if (entryScene) {
    screens.push({
      path: entryScene,
      services: [],
      entities: [],
      source_file: sourceFile
    });
  } else {
    const sceneName = pickField(metadata, ['name', 'summary']);
    if (sceneName) {
      screens.push({
        path: `scene/${normalizeIdentifier(sceneName)}`,
        services: [],
        entities: [],
        source_file: sourceFile
      });
    }
  }

  const parameterCount = toArray(payload.parameters).length;
  if (parameterCount > 0) {
    const formName = pickField(metadata, ['name']) || normalizeIdentifier(sourceFile) || 'scene-form';
    forms.push({
      name: `${formName}-input-form`,
      screen: entryScene || sourceFile,
      field_count: parameterCount,
      source_file: sourceFile
    });
  }

  businessRules.push(...parseNamedArray(governanceContract.business_rules, ['name', 'id', 'rule', 'description'], sourceFile));
  businessRules.push(...parseNamedArray(ontologyModel.business_rules, ['name', 'id', 'rule', 'description'], sourceFile));
  decisions.push(...parseNamedArray(governanceContract.decision_logic, ['name', 'id', 'decision', 'description'], sourceFile));
  decisions.push(...parseNamedArray(ontologyModel.decision_logic, ['name', 'id', 'decision', 'description'], sourceFile));
  decisions.push(...parseNamedArray(agentHints.decision_logic, ['name', 'id', 'decision'], sourceFile));

  const templateRefs = [];
  const templateName = pickField(metadata, ['name']);
  if (templateName) {
    templateRefs.push(templateName);
  }
  const capabilityRefs = toArray(capabilities.provides)
    .concat(toArray(capabilities.requires))
    .map(item => (typeof item === 'string' ? normalizeText(item) : pickField(item, ['name', 'id'])))
    .filter(Boolean);

  return {
    entities,
    services,
    screens,
    forms,
    businessRules,
    decisions,
    templateRefs,
    capabilityRefs
  };
}

function collectModelsFromGenericJson(payload, sourceFile) {
  if (!payload || typeof payload !== 'object') {
    return {
      entities: [],
      services: [],
      screens: [],
      forms: [],
      businessRules: [],
      decisions: [],
      businessRuleTotalHint: 0,
      decisionTotalHint: 0
    };
  }

  const entities = collectArrayFromPaths(payload, [
    'entities',
    'entity_catalog',
    'entity_catalog.entities',
    'catalog.entities'
  ]).map((entry) => {
    const name = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['name', 'id', 'entity', 'entity_name', 'ref']);
    if (!name) {
      return null;
    }
    return {
      name,
      package: typeof entry === 'object' ? pickField(entry, ['package', 'package_name']) : null,
      relations: [],
      source_file: sourceFile
    };
  }).filter(Boolean);

  const services = collectArrayFromPaths(payload, [
    'services',
    'service_catalog',
    'service_catalog.services',
    'catalog.services',
    'capability_contract.bindings'
  ]).map((entry) => {
    const name = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['name', 'id', 'service', 'service_name', 'ref']);
    if (!name) {
      return null;
    }
    return {
      name,
      verb: typeof entry === 'object' ? pickField(entry, ['verb']) : null,
      noun: typeof entry === 'object' ? pickField(entry, ['noun']) : null,
      entities: [],
      source_file: sourceFile
    };
  }).filter(Boolean);

  const screens = collectArrayFromPaths(payload, [
    'screens',
    'screen_catalog',
    'screen_catalog.screens',
    'catalog.screens',
    'scenes',
    'pages'
  ]).map((entry) => {
    const screenPath = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['path', 'screen_path', 'name', 'id', 'ref']);
    if (!screenPath) {
      return null;
    }
    return {
      path: screenPath,
      services: [],
      entities: [],
      source_file: sourceFile
    };
  }).filter(Boolean);

  const forms = collectArrayFromPaths(payload, [
    'forms',
    'form_catalog',
    'form_catalog.forms',
    'catalog.forms'
  ]).map((entry) => {
    const name = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['name', 'id', 'form', 'form_name', 'ref']);
    if (!name) {
      return null;
    }
    const fieldCount = typeof entry === 'object'
      ? toArray(entry.fields || entry.field_defs || entry.columns).length
      : 0;
    return {
      name,
      screen: typeof entry === 'object' ? pickField(entry, ['screen', 'screen_path', 'screen_ref']) : null,
      field_count: fieldCount,
      source_file: sourceFile
    };
  }).filter(Boolean);

  const businessRules = []
    .concat(parseNamedArray(collectArrayFromPaths(payload, ['business_rules', 'rules', 'rule_catalog']), ['name', 'id', 'rule'], sourceFile))
    .concat(parseNamedArray(readPathValue(payload, 'governance_contract.business_rules'), ['name', 'id', 'rule', 'description'], sourceFile))
    .concat(parseNamedArray(readPathValue(payload, 'ontology_model.business_rules'), ['name', 'id', 'rule', 'description'], sourceFile));
  const decisions = []
    .concat(parseNamedArray(collectArrayFromPaths(payload, ['decisions', 'decision_logic', 'decision_catalog']), ['name', 'id', 'decision'], sourceFile))
    .concat(parseNamedArray(readPathValue(payload, 'governance_contract.decision_logic'), ['name', 'id', 'decision', 'description'], sourceFile))
    .concat(parseNamedArray(readPathValue(payload, 'ontology_model.decision_logic'), ['name', 'id', 'decision', 'description'], sourceFile));

  const businessRuleTotalHint = readNumberFirst(payload, [
    'business_rules.total',
    'coverage.business_rules.total',
    'metrics.business_rules.total',
    'ontology_validation.business_rules.total'
  ]);
  const decisionTotalHint = readNumberFirst(payload, [
    'decision_logic.total',
    'coverage.decision_logic.total',
    'metrics.decision_logic.total',
    'ontology_validation.decision_logic.total'
  ]);

  return {
    entities,
    services,
    screens,
    forms,
    businessRules,
    decisions,
    businessRuleTotalHint,
    decisionTotalHint
  };
}

function collectHandoffHints(payload, sourceFile) {
  if (!payload || typeof payload !== 'object') {
    return {
      templates: [],
      capabilities: [],
      specScenePackagePaths: [],
      businessRuleTotalHint: 0,
      decisionTotalHint: 0
    };
  }

  const templates = toArray(payload.templates)
    .map(entry => (typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['id', 'name', 'template', 'template_id', 'path'])))
    .filter(Boolean);
  const capabilities = toArray(payload.capabilities)
    .map(entry => (typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['id', 'name', 'capability', 'ref'])))
    .filter(Boolean);

  const specScenePackagePaths = toArray(payload.specs)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      return pickField(entry, ['scene_package', 'spec_package', 'package', 'specPackage']);
    })
    .filter(Boolean);

  const businessRuleTotalHint = readNumberFirst(payload, [
    'ontology_validation.business_rules.total',
    'business_rules.total',
    'coverage.business_rules.total',
    'metrics.business_rules.total'
  ]);
  const decisionTotalHint = readNumberFirst(payload, [
    'ontology_validation.decision_logic.total',
    'decision_logic.total',
    'coverage.decision_logic.total',
    'metrics.decision_logic.total'
  ]);

  const knownGaps = parseNamedArray(payload.known_gaps, ['name', 'id', 'gap'], sourceFile)
    .map(item => item.name)
    .filter(Boolean);

  return {
    templates,
    capabilities,
    specScenePackagePaths,
    businessRuleTotalHint,
    decisionTotalHint,
    knownGaps
  };
}

function classifyMatrixToken(token) {
  const text = normalizeText(token);
  if (!text) {
    return null;
  }
  const lower = text.toLowerCase();
  if (/(scene--|template)/.test(lower)) return 'template';
  if (/(decision|routing|strategy)/.test(lower)) return 'decision';
  if (/(rule|policy|governance|compliance)/.test(lower)) return 'business_rule';
  if (/(form|entry)/.test(lower)) return 'form';
  if (/(screen|scene|ui|page|dashboard|panel|dialog)/.test(lower)) return 'screen';
  if (/(service|workflow|approval|invoke|query|report|ops)/.test(lower)) return 'service';
  return 'entity';
}

function collectMatrixHints(content, sourceFile) {
  const entities = [];
  const services = [];
  const screens = [];
  const forms = [];
  const businessRules = [];
  const decisions = [];
  const templates = [];
  const capabilities = [];

  const lines = `${content || ''}`.split(/\r?\n/);
  for (const line of lines) {
    const text = normalizeText(line);
    if (!text || !text.startsWith('|')) {
      continue;
    }
    if (/^\|\s*-+\s*\|/.test(text)) {
      continue;
    }
    const columns = text
      .split('|')
      .map(item => item.trim())
      .filter(Boolean);
    if (columns.length < 3) {
      continue;
    }
    const normalizedColumns = columns.map(item => (item || '').toLowerCase());
    const headerLabels = new Set([
      'priority',
      'track',
      'item',
      'spec',
      'moqui capability',
      'capability focus',
      'sce scene pattern',
      'template id',
      'ontology anchors',
      'governance/gate focus',
      'status',
      'result'
    ]);
    const headerMatches = normalizedColumns.filter(item => headerLabels.has(item)).length;
    if (headerMatches >= 2) {
      continue;
    }
    const lowerLine = text.toLowerCase();
    if (/priority|capability|template id|status/.test(lowerLine) && /---/.test(lowerLine)) {
      continue;
    }

    const inlineTokens = [];
    const tokenPattern = /`([^`]+)`/g;
    let match = tokenPattern.exec(text);
    while (match) {
      const token = normalizeText(match[1]);
      if (token) {
        inlineTokens.push(token);
      }
      match = tokenPattern.exec(text);
    }

    for (const token of inlineTokens) {
      const kind = classifyMatrixToken(token);
      if (kind === 'template') {
        templates.push(token);
      } else if (kind === 'service') {
        services.push({
          name: token,
          verb: null,
          noun: null,
          entities: [],
          source_file: sourceFile
        });
      } else if (kind === 'screen') {
        screens.push({
          path: token,
          services: [],
          entities: [],
          source_file: sourceFile
        });
      } else if (kind === 'form') {
        forms.push({
          name: token,
          screen: sourceFile,
          field_count: 0,
          source_file: sourceFile
        });
      } else if (kind === 'business_rule') {
        businessRules.push({
          name: token,
          source_file: sourceFile
        });
      } else if (kind === 'decision') {
        decisions.push({
          name: token,
          source_file: sourceFile
        });
      } else if (kind === 'entity') {
        entities.push({
          name: token,
          package: null,
          relations: [],
          source_file: sourceFile
        });
      }
    }

    if (columns.length >= 3) {
      const capabilityText = normalizeText(columns[2]);
      if (capabilityText && !/^(full|pass|in progress|template-ready|matrix-intake-ready)$/i.test(capabilityText)) {
        capabilities.push(capabilityText);
      }
    }
  }

  return {
    entities,
    services,
    screens,
    forms,
    businessRules,
    decisions,
    templates,
    capabilities
  };
}

function inferModelsFromHints(hints, sourceFile) {
  const entities = [];
  const services = [];
  const screens = [];
  const forms = [];
  const businessRules = [];
  const decisions = [];

  const hintRefs = deduplicateBy(
    toArray(hints.templates).concat(toArray(hints.capabilities)).map(item => ({ name: item })),
    item => item && item.name
  )
    .map(item => item.name)
    .slice(0, MAX_HINT_ITEMS);

  const addRule = (name) => {
    const text = normalizeText(name);
    if (!text) {
      return;
    }
    businessRules.push({ name: text, source_file: sourceFile });
  };
  const addDecision = (name) => {
    const text = normalizeText(name);
    if (!text) {
      return;
    }
    decisions.push({ name: text, source_file: sourceFile });
  };

  for (const rawRef of hintRefs) {
    const ref = normalizeText(rawRef);
    if (!ref) {
      continue;
    }
    const slug = normalizeIdentifier(ref);
    if (!slug) {
      continue;
    }
    const lower = ref.toLowerCase();

    if (/(entity|model|master|party|product|order|inventory|procurement|shipment|return|rma|quality|bom|routing|equipment|cost|invoice|employee|calendar|project|wbs|engineering)/.test(lower)) {
      entities.push({
        name: `hint.${slug}`,
        package: 'hint',
        relations: [],
        source_file: sourceFile
      });
    }
    if (/(service|workflow|approval|invoke|action|orchestration|query|report|ops|governance|runtime)/.test(lower)) {
      services.push({
        name: `hint.service.${slug}`,
        verb: null,
        noun: null,
        entities: [],
        source_file: sourceFile
      });
    }
    if (/(screen|scene|ui|page|panel|dialog|dashboard|hub)/.test(lower)) {
      screens.push({
        path: `hint/${slug}`,
        services: [],
        entities: [],
        source_file: sourceFile
      });
    }
    if (/(form|entry)/.test(lower)) {
      forms.push({
        name: `hint-${slug}-form`,
        screen: `hint/${slug}`,
        field_count: 0,
        source_file: sourceFile
      });
    }
    if (/(rule|governance|policy|compliance|audit)/.test(lower)) {
      addRule(`hint.rule.${slug}`);
    }
    if (/(decision|routing|strategy|approval)/.test(lower)) {
      addDecision(`hint.decision.${slug}`);
    }
  }

  const ruleTotalHint = Number(hints.businessRuleTotalHint) || 0;
  for (let i = businessRules.length; i < ruleTotalHint; i += 1) {
    addRule(`hint.rule.inferred-${i + 1}`);
  }
  const decisionTotalHint = Number(hints.decisionTotalHint) || 0;
  for (let i = decisions.length; i < decisionTotalHint; i += 1) {
    addDecision(`hint.decision.inferred-${i + 1}`);
  }

  return {
    entities,
    services,
    screens,
    forms,
    businessRules,
    decisions
  };
}

async function listProjectFiles(projectDir) {
  const xmlFiles = [];
  const scenePackageFiles = [];
  const evidenceJsonFiles = [];
  const salvageJsonFiles = [];
  const stack = [projectDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current).catch(() => []);
    for (const name of entries) {
      const fullPath = path.join(current, name);
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat) {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!stat.isFile()) {
        continue;
      }
      const relativePath = path.relative(projectDir, fullPath).replace(/\\/g, '/');
      const normalizedRelative = relativePath.toLowerCase();
      if (/\.xml$/i.test(name)) {
        xmlFiles.push(fullPath);
        continue;
      }
      if (/^scene-package\.json$/i.test(name)) {
        scenePackageFiles.push(fullPath);
      }
      if (/\.json$/i.test(name) && normalizedRelative.startsWith(`${DEFAULT_EVIDENCE_DIR.toLowerCase()}/`)) {
        evidenceJsonFiles.push(fullPath);
      }
      if (/\.json$/i.test(name) && normalizedRelative.startsWith(`${DEFAULT_SALVAGE_DIR.toLowerCase()}/`)) {
        salvageJsonFiles.push(fullPath);
      }
    }
  }

  xmlFiles.sort();
  scenePackageFiles.sort();
  evidenceJsonFiles.sort();
  salvageJsonFiles.sort();
  return {
    xmlFiles,
    scenePackageFiles,
    evidenceJsonFiles,
    salvageJsonFiles
  };
}

function deduplicateBy(items, keySelector) {
  const result = [];
  const seen = new Set();
  for (const item of items) {
    const key = normalizeIdentifier(keySelector(item));
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# Moqui Metadata Catalog');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Source project: ${report.source_project}`);
  lines.push(`- XML files scanned: ${report.scan.xml_file_count}`);
  lines.push(`- Scene packages scanned: ${report.scan.scene_package_file_count}`);
  lines.push(`- Handoff manifest: ${report.scan.handoff_manifest_found ? 'found' : 'not found'}`);
  lines.push(`- Capability matrix: ${report.scan.capability_matrix_found ? 'found' : 'not found'}`);
  lines.push(`- Evidence JSON scanned: ${report.scan.evidence_json_file_count}`);
  lines.push(`- Salvage JSON scanned: ${report.scan.salvage_json_file_count}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Entities: ${report.summary.entities}`);
  lines.push(`- Services: ${report.summary.services}`);
  lines.push(`- Screens: ${report.summary.screens}`);
  lines.push(`- Forms: ${report.summary.forms}`);
  lines.push(`- Business rules: ${report.summary.business_rules}`);
  lines.push(`- Decisions: ${report.summary.decisions}`);
  lines.push('');

  const samples = [
    ['Entities', report.entities.map(item => item.name)],
    ['Services', report.services.map(item => item.name)],
    ['Screens', report.screens.map(item => item.path)],
    ['Forms', report.forms.map(item => item.name)],
    ['Business Rules', report.business_rules.map(item => item.name)],
    ['Decisions', report.decisions.map(item => item.name)]
  ];

  for (const [title, values] of samples) {
    lines.push(`## ${title}`);
    lines.push('');
    if (!values || values.length === 0) {
      lines.push('- none');
      lines.push('');
      continue;
    }
    for (const value of values.slice(0, 10)) {
      lines.push(`- ${value}`);
    }
    if (values.length > 10) {
      lines.push(`- ... (+${values.length - 10} more)`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(process.cwd(), options.projectDir);
  const outPath = path.resolve(process.cwd(), options.out);
  const markdownPath = path.resolve(process.cwd(), options.markdownOut);
  const handoffManifestPath = path.resolve(projectDir, DEFAULT_HANDOFF_MANIFEST);
  const capabilityMatrixPath = path.resolve(projectDir, DEFAULT_CAPABILITY_MATRIX);

  if (!(await fs.pathExists(projectDir))) {
    throw new Error(`project directory not found: ${path.relative(process.cwd(), projectDir)}`);
  }

  const scannedFiles = await listProjectFiles(projectDir);
  const xmlFiles = scannedFiles.xmlFiles;
  const entitiesRaw = [];
  const servicesRaw = [];
  const screensRaw = [];
  const formsRaw = [];
  const businessRulesRaw = [];
  const decisionsRaw = [];
  const hintTemplates = [];
  const hintCapabilities = [];
  const hintKnownGaps = [];
  let businessRuleTotalHint = 0;
  let decisionTotalHint = 0;
  const parsedScenePackageFiles = new Set();

  for (const filePath of xmlFiles) {
    const sourceFile = path.relative(projectDir, filePath).replace(/\\/g, '/');
    const content = await fs.readFile(filePath, 'utf8');
    entitiesRaw.push(...collectEntityModels(content, sourceFile));
    servicesRaw.push(...collectServiceModels(content, sourceFile));
    screensRaw.push(...collectScreenModels(content, sourceFile));
    formsRaw.push(...collectFormModels(content, sourceFile));
    businessRulesRaw.push(...collectNamedTags(content, 'rule', 'rule', sourceFile));
    decisionsRaw.push(...collectNamedTags(content, 'decision', 'decision', sourceFile));
  }

  for (const filePath of scannedFiles.scenePackageFiles) {
    const sourceFile = path.relative(projectDir, filePath).replace(/\\/g, '/');
    const payload = await fs.readJson(filePath).catch(() => null);
    if (!payload) {
      continue;
    }
    const models = collectModelsFromScenePackage(payload, sourceFile);
    entitiesRaw.push(...models.entities);
    servicesRaw.push(...models.services);
    screensRaw.push(...models.screens);
    formsRaw.push(...models.forms);
    businessRulesRaw.push(...models.businessRules);
    decisionsRaw.push(...models.decisions);
    hintTemplates.push(...models.templateRefs);
    hintCapabilities.push(...models.capabilityRefs);
    parsedScenePackageFiles.add(path.resolve(filePath).toLowerCase());
  }

  const handoffManifestFound = await fs.pathExists(handoffManifestPath);
  if (handoffManifestFound) {
    const payload = await fs.readJson(handoffManifestPath).catch(() => null);
    if (payload) {
      const sourceFile = path.relative(projectDir, handoffManifestPath).replace(/\\/g, '/');
      const hints = collectHandoffHints(payload, sourceFile);
      hintTemplates.push(...hints.templates);
      hintCapabilities.push(...hints.capabilities);
      hintKnownGaps.push(...toArray(hints.knownGaps));
      businessRuleTotalHint = Math.max(businessRuleTotalHint, Number(hints.businessRuleTotalHint) || 0);
      decisionTotalHint = Math.max(decisionTotalHint, Number(hints.decisionTotalHint) || 0);

      for (const scenePackageRelative of hints.specScenePackagePaths) {
        const resolved = path.resolve(projectDir, scenePackageRelative);
        const resolvedKey = resolved.toLowerCase();
        if (parsedScenePackageFiles.has(resolvedKey)) {
          continue;
        }
        if (!(await fs.pathExists(resolved))) {
          continue;
        }
        const packagePayload = await fs.readJson(resolved).catch(() => null);
        if (!packagePayload) {
          continue;
        }
        const sceneSourceFile = path.relative(projectDir, resolved).replace(/\\/g, '/');
        const models = collectModelsFromScenePackage(packagePayload, sceneSourceFile);
        entitiesRaw.push(...models.entities);
        servicesRaw.push(...models.services);
        screensRaw.push(...models.screens);
        formsRaw.push(...models.forms);
        businessRulesRaw.push(...models.businessRules);
        decisionsRaw.push(...models.decisions);
        hintTemplates.push(...models.templateRefs);
        hintCapabilities.push(...models.capabilityRefs);
        parsedScenePackageFiles.add(resolvedKey);
      }
    }
  }

  const capabilityMatrixFound = await fs.pathExists(capabilityMatrixPath);
  if (capabilityMatrixFound) {
    const content = await fs.readFile(capabilityMatrixPath, 'utf8').catch(() => null);
    if (content) {
      const sourceFile = path.relative(projectDir, capabilityMatrixPath).replace(/\\/g, '/');
      const matrixHints = collectMatrixHints(content, sourceFile);
      entitiesRaw.push(...matrixHints.entities);
      servicesRaw.push(...matrixHints.services);
      screensRaw.push(...matrixHints.screens);
      formsRaw.push(...matrixHints.forms);
      businessRulesRaw.push(...matrixHints.businessRules);
      decisionsRaw.push(...matrixHints.decisions);
      hintTemplates.push(...matrixHints.templates);
      hintCapabilities.push(...matrixHints.capabilities);
    }
  }

  for (const filePath of scannedFiles.evidenceJsonFiles.concat(scannedFiles.salvageJsonFiles)) {
    const sourceFile = path.relative(projectDir, filePath).replace(/\\/g, '/');
    const payload = await fs.readJson(filePath).catch(() => null);
    if (!payload) {
      continue;
    }
    const models = collectModelsFromGenericJson(payload, sourceFile);
    entitiesRaw.push(...models.entities);
    servicesRaw.push(...models.services);
    screensRaw.push(...models.screens);
    formsRaw.push(...models.forms);
    businessRulesRaw.push(...models.businessRules);
    decisionsRaw.push(...models.decisions);
    businessRuleTotalHint = Math.max(businessRuleTotalHint, Number(models.businessRuleTotalHint) || 0);
    decisionTotalHint = Math.max(decisionTotalHint, Number(models.decisionTotalHint) || 0);
  }

  const inferred = inferModelsFromHints({
    templates: hintTemplates,
    capabilities: hintCapabilities,
    businessRuleTotalHint,
    decisionTotalHint
  }, `${DEFAULT_HANDOFF_MANIFEST}#inferred`);
  entitiesRaw.push(...inferred.entities);
  servicesRaw.push(...inferred.services);
  screensRaw.push(...inferred.screens);
  formsRaw.push(...inferred.forms);
  businessRulesRaw.push(...inferred.businessRules);
  decisionsRaw.push(...inferred.decisions);

  const entities = deduplicateBy(entitiesRaw, item => item && item.name).map(item => ({
    name: item.name,
    package: item.package || null,
    relations: deduplicateBy((item.relations || []).map(name => ({ name })), relation => relation.name).map(
      relation => relation.name
    ),
    source_file: item.source_file
  }));
  const services = deduplicateBy(servicesRaw, item => item && item.name).map(item => ({
    name: item.name,
    verb: item.verb || null,
    noun: item.noun || null,
    entities: deduplicateBy((item.entities || []).map(name => ({ name })), ref => ref.name).map(ref => ref.name),
    source_file: item.source_file
  }));
  const screens = deduplicateBy(screensRaw, item => item && item.path).map(item => ({
    path: item.path,
    services: deduplicateBy((item.services || []).map(name => ({ name })), ref => ref.name).map(ref => ref.name),
    entities: deduplicateBy((item.entities || []).map(name => ({ name })), ref => ref.name).map(ref => ref.name),
    source_file: item.source_file
  }));
  const forms = deduplicateBy(formsRaw, item => item && item.name).map(item => ({
    name: item.name,
    screen: item.screen || null,
    field_count: Number(item.field_count) || 0,
    source_file: item.source_file
  }));
  const businessRules = deduplicateBy(businessRulesRaw, item => item && item.name).slice(0, MAX_HINT_ITEMS * 4);
  const decisions = deduplicateBy(decisionsRaw, item => item && item.name).slice(0, MAX_HINT_ITEMS * 4);

  const report = {
    mode: 'moqui-metadata-extract',
    generated_at: new Date().toISOString(),
    source_project: projectDir.replace(/\\/g, '/'),
    scan: {
      xml_file_count: xmlFiles.length,
      scene_package_file_count: scannedFiles.scenePackageFiles.length,
      handoff_manifest_found: handoffManifestFound,
      capability_matrix_found: capabilityMatrixFound,
      evidence_json_file_count: scannedFiles.evidenceJsonFiles.length,
      salvage_json_file_count: scannedFiles.salvageJsonFiles.length,
      xml_files: xmlFiles.map(file => path.relative(projectDir, file).replace(/\\/g, '/')),
      scene_package_files: scannedFiles.scenePackageFiles.map(file => path.relative(projectDir, file).replace(/\\/g, '/'))
    },
    hints: {
      templates: deduplicateBy(hintTemplates.map(name => ({ name })), item => item.name)
        .map(item => item.name)
        .slice(0, MAX_HINT_ITEMS),
      capabilities: deduplicateBy(hintCapabilities.map(name => ({ name })), item => item.name)
        .map(item => item.name)
        .slice(0, MAX_HINT_ITEMS),
      known_gaps: deduplicateBy(hintKnownGaps.map(name => ({ name })), item => item.name)
        .map(item => item.name)
        .slice(0, Math.floor(MAX_HINT_ITEMS / 2)),
      business_rule_total_hint: businessRuleTotalHint,
      decision_total_hint: decisionTotalHint
    },
    summary: {
      entities: entities.length,
      services: services.length,
      screens: screens.length,
      forms: forms.length,
      business_rules: businessRules.length,
      decisions: decisions.length
    },
    entities,
    services,
    screens,
    forms,
    business_rules: businessRules,
    decisions
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownPath));
  await fs.writeFile(markdownPath, buildMarkdownReport(report), 'utf8');

  const stdoutPayload = {
    ...report,
    output: {
      json: path.relative(process.cwd(), outPath),
      markdown: path.relative(process.cwd(), markdownPath)
    }
  };

  if (options.json) {
    console.log(JSON.stringify(stdoutPayload, null, 2));
  } else {
    console.log('Moqui metadata catalog extracted.');
    console.log(`  JSON: ${path.relative(process.cwd(), outPath)}`);
    console.log(`  Markdown: ${path.relative(process.cwd(), markdownPath)}`);
    console.log(`  XML scanned: ${report.scan.xml_file_count}`);
  }
}

main().catch((error) => {
  console.error(`Failed to extract Moqui metadata catalog: ${error.message}`);
  process.exitCode = 1;
});
