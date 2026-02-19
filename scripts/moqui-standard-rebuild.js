#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_METADATA = 'docs/moqui/metadata-catalog.json';
const DEFAULT_OUT = '.kiro/reports/recovery/moqui-standard-rebuild.json';
const DEFAULT_MARKDOWN_OUT = '.kiro/reports/recovery/moqui-standard-rebuild.md';
const DEFAULT_BUNDLE_OUT = '.kiro/reports/recovery/moqui-standard-bundle';

function parseArgs(argv) {
  const options = {
    metadata: DEFAULT_METADATA,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    bundleOut: DEFAULT_BUNDLE_OUT,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--metadata' && next) {
      options.metadata = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--bundle-out' && next) {
      options.bundleOut = next;
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
    'Usage: node scripts/moqui-standard-rebuild.js [options]',
    '',
    'Options:',
    `  --metadata <path>      Moqui metadata JSON path (default: ${DEFAULT_METADATA})`,
    `  --out <path>           Rebuild JSON report path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Rebuild markdown summary path (default: ${DEFAULT_MARKDOWN_OUT})`,
    `  --bundle-out <path>    Generated bundle directory (default: ${DEFAULT_BUNDLE_OUT})`,
    '  --json                 Print JSON payload to stdout',
    '  -h, --help             Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
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

function collectEntityModels(payload) {
  const entries = collectArrayFromPaths(payload, [
    'entities',
    'entity_catalog',
    'entity_catalog.entities',
    'catalog.entities'
  ]);
  const models = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const name = pickField(entry, ['name', 'entity', 'entity_name', 'id']);
    if (!name) {
      continue;
    }
    const normalized = normalizeIdentifier(name);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const relations = toArray(entry.relations || entry.relationships || entry.relation_refs)
      .map(item => {
        if (typeof item === 'string') {
          return normalizeText(item);
        }
        if (item && typeof item === 'object') {
          return pickField(item, ['target', 'target_entity', 'entity', 'name', 'id']);
        }
        return null;
      })
      .filter(Boolean);
    models.push({
      name,
      package: pickField(entry, ['package', 'package_name', 'group', 'module']),
      relations
    });
  }
  return models;
}

function collectServiceModels(payload) {
  const entries = collectArrayFromPaths(payload, [
    'services',
    'service_catalog',
    'service_catalog.services',
    'catalog.services'
  ]);
  const models = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const name = pickField(entry, ['name', 'service', 'service_name', 'id']);
    if (!name) {
      continue;
    }
    const normalized = normalizeIdentifier(name);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const entityRefs = toArray(entry.entities || entry.entity_refs || entry.uses_entities)
      .map(item => (typeof item === 'string' ? normalizeText(item) : pickField(item, ['name', 'entity', 'id'])))
      .filter(Boolean);
    models.push({
      name,
      verb: pickField(entry, ['verb']),
      noun: pickField(entry, ['noun']),
      entities: entityRefs
    });
  }
  return models;
}

function collectScreenModels(payload) {
  const entries = collectArrayFromPaths(payload, [
    'screens',
    'screen_catalog',
    'screen_catalog.screens',
    'catalog.screens'
  ]);
  const models = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const screenPath = pickField(entry, ['path', 'screen_path', 'name', 'id']);
    if (!screenPath) {
      continue;
    }
    const normalized = normalizeIdentifier(screenPath);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const services = toArray(entry.services || entry.service_refs)
      .map(item => (typeof item === 'string' ? normalizeText(item) : pickField(item, ['name', 'service', 'id'])))
      .filter(Boolean);
    const entities = toArray(entry.entities || entry.entity_refs)
      .map(item => (typeof item === 'string' ? normalizeText(item) : pickField(item, ['name', 'entity', 'id'])))
      .filter(Boolean);
    models.push({
      path: screenPath,
      services,
      entities
    });
  }
  return models;
}

function collectFormModels(payload) {
  const entries = collectArrayFromPaths(payload, [
    'forms',
    'form_catalog',
    'form_catalog.forms',
    'catalog.forms'
  ]);
  const models = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const name = pickField(entry, ['name', 'form', 'form_name', 'id']);
    if (!name) {
      continue;
    }
    const normalized = normalizeIdentifier(name);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const fieldCount = toArray(entry.fields || entry.field_defs || entry.columns).length;
    models.push({
      name,
      screen: pickField(entry, ['screen', 'screen_path', 'screen_ref']),
      field_count: fieldCount
    });
  }
  return models;
}

function collectNamedItems(payload, paths, itemLabel) {
  const entries = collectArrayFromPaths(payload, paths);
  const items = [];
  const seen = new Set();
  for (const entry of entries) {
    const name = typeof entry === 'string'
      ? normalizeText(entry)
      : pickField(entry, ['name', itemLabel, `${itemLabel}_name`, 'id']);
    if (!name) {
      continue;
    }
    const normalized = normalizeIdentifier(name);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(name);
  }
  return items;
}

function detectDomains(entities) {
  const domainSet = new Set();
  for (const entity of entities) {
    const packageName = normalizeText(entity && entity.package);
    if (!packageName) {
      continue;
    }
    const token = packageName.split('.')[0];
    const normalized = normalizeIdentifier(token);
    if (normalized) {
      domainSet.add(normalized);
    }
  }
  return Array.from(domainSet).sort();
}

function buildRecommendedTemplates(context) {
  const templates = [];
  const pushTemplate = (id, reason, enabled) => {
    if (!enabled) {
      return;
    }
    templates.push({ id, reason });
  };

  pushTemplate(
    'kse.scene--moqui-entity-model-core--0.1.0',
    'Recover entity catalog and relationship baseline.',
    context.entities.length > 0
  );
  pushTemplate(
    'kse.scene--moqui-service-contract-core--0.1.0',
    'Recover service contracts and entity/service bindings.',
    context.services.length > 0
  );
  pushTemplate(
    'kse.scene--moqui-screen-flow-core--0.1.0',
    'Recover screen flow and screen/service references.',
    context.screens.length > 0
  );
  pushTemplate(
    'kse.scene--moqui-form-interaction-core--0.1.0',
    'Recover form schema and page interaction fields.',
    context.forms.length > 0
  );
  pushTemplate(
    'kse.scene--moqui-rule-decision-core--0.1.0',
    'Recover business rules and decision policies.',
    context.businessRules.length > 0 || context.decisions.length > 0
  );
  pushTemplate(
    'kse.scene--moqui-page-copilot-dialog--0.1.0',
    'Inject page-level human/AI copilot dialog for in-context fix guidance.',
    context.screens.length > 0
  );
  return templates;
}

function buildCapabilities(context) {
  const capabilities = [];
  if (context.entities.length > 0) {
    capabilities.push('moqui-entity-model-core');
  }
  if (context.services.length > 0) {
    capabilities.push('moqui-service-contract-core');
  }
  if (context.screens.length > 0) {
    capabilities.push('moqui-screen-flow-core');
    capabilities.push('moqui-page-copilot-context-fix');
  }
  if (context.forms.length > 0) {
    capabilities.push('moqui-form-interaction-core');
  }
  if (context.businessRules.length > 0 || context.decisions.length > 0) {
    capabilities.push('moqui-rule-decision-core');
  }
  return capabilities;
}

function buildSpecPlan(context) {
  const specs = [];
  const pushSpec = (specId, goal, dependencies = []) => {
    specs.push({
      spec_id: specId,
      goal,
      depends_on: dependencies
    });
  };

  if (context.entities.length > 0) {
    pushSpec('moqui-01-entity-model-recovery', 'Recover entity model and relations.');
  }
  if (context.services.length > 0) {
    pushSpec(
      'moqui-02-service-contract-recovery',
      'Recover service contracts and entity bindings.',
      context.entities.length > 0 ? ['moqui-01-entity-model-recovery'] : []
    );
  }
  if (context.screens.length > 0) {
    pushSpec(
      'moqui-03-screen-flow-recovery',
      'Recover screens and navigation/service linkage.',
      context.services.length > 0 ? ['moqui-02-service-contract-recovery'] : []
    );
  }
  if (context.forms.length > 0) {
    pushSpec(
      'moqui-04-form-interaction-recovery',
      'Recover form schema and page actions.',
      context.screens.length > 0 ? ['moqui-03-screen-flow-recovery'] : []
    );
  }
  if (context.businessRules.length > 0 || context.decisions.length > 0) {
    pushSpec(
      'moqui-05-rule-decision-recovery',
      'Recover business rules and decision strategy mapping.',
      context.services.length > 0 ? ['moqui-02-service-contract-recovery'] : []
    );
  }
  if (context.screens.length > 0) {
    pushSpec(
      'moqui-06-page-copilot-integration',
      'Integrate page-level copilot dialog for contextual fix guidance.',
      ['moqui-03-screen-flow-recovery']
    );
  }
  return specs;
}

function buildOntologySeed(context) {
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();
  const edgeSet = new Set();

  const addNode = (kind, id, metadata = {}) => {
    const normalized = normalizeIdentifier(id);
    if (!normalized) {
      return null;
    }
    const key = `${kind}:${normalized}`;
    if (!nodeSet.has(key)) {
      nodeSet.add(key);
      nodes.push({
        id: key,
        kind,
        label: id,
        metadata
      });
    }
    return key;
  };

  const addEdge = (from, to, relation) => {
    if (!from || !to || !relation) {
      return;
    }
    const key = `${from}|${relation}|${to}`;
    if (edgeSet.has(key)) {
      return;
    }
    edgeSet.add(key);
    edges.push({
      from,
      to,
      relation
    });
  };

  for (const entity of context.entities) {
    addNode('entity', entity.name, { package: entity.package || null });
  }
  for (const service of context.services) {
    const serviceNode = addNode('service', service.name, { verb: service.verb || null, noun: service.noun || null });
    for (const entityName of service.entities) {
      const entityNode = addNode('entity', entityName);
      addEdge(serviceNode, entityNode, 'uses_entity');
    }
  }
  for (const screen of context.screens) {
    const screenNode = addNode('screen', screen.path);
    for (const serviceName of screen.services) {
      const serviceNode = addNode('service', serviceName);
      addEdge(screenNode, serviceNode, 'invokes_service');
    }
    for (const entityName of screen.entities) {
      const entityNode = addNode('entity', entityName);
      addEdge(screenNode, entityNode, 'reads_entity');
    }
  }
  for (const form of context.forms) {
    const formNode = addNode('form', form.name, { field_count: form.field_count || 0 });
    if (form.screen) {
      const screenNode = addNode('screen', form.screen);
      addEdge(formNode, screenNode, 'belongs_screen');
    }
  }
  for (const rule of context.businessRules) {
    addNode('business_rule', rule);
  }
  for (const decision of context.decisions) {
    addNode('decision', decision);
  }

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    summary: {
      nodes: nodes.length,
      edges: edges.length
    },
    nodes,
    edges
  };
}

function buildCopilotContract(context) {
  return {
    mode: 'moqui-page-copilot-context-fix',
    version: '1.0',
    description: (
      'Page-level human/AI copilot contract. ' +
      'Keep original Moqui stack, generate advisory/patch responses bound to current page context.'
    ),
    context: {
      page: {
        required: ['screen_path', 'route', 'module'],
        optional: ['form_name', 'widget_id', 'entity_refs', 'service_refs']
      },
      user_action: {
        required: ['intent', 'expected_outcome'],
        optional: ['last_operation', 'selection', 'filters']
      },
      runtime: {
        required: ['timestamp'],
        optional: ['error_message', 'error_stack', 'request_id', 'session_user']
      }
    },
    response: {
      policy: ['advisory', 'patch-proposal'],
      required: ['diagnosis', 'change_plan', 'risk_notes'],
      optional: ['patch_preview', 'validation_steps']
    },
    guardrails: {
      stack_policy: 'preserve-original-stack',
      write_policy: 'no-auto-apply-without-confirm',
      target_scope: 'current-page-and-direct-dependencies'
    },
    starter_prompts: [
      '这个页面为什么报错？请基于当前上下文定位根因并给出修复方案。',
      '不改变现有技术栈，给出最小修复补丁和验证步骤。',
      '如果涉及实体/服务/页面联动，请列出影响面和回滚点。'
    ],
    sample_page_refs: context.screens.slice(0, 5).map(item => item.path)
  };
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# Moqui Standard Rebuild Plan');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Metadata file: ${report.metadata_file}`);
  lines.push(`- Bundle output: ${report.output.bundle_dir}`);
  lines.push('');
  lines.push('## Inventory');
  lines.push('');
  lines.push(`- Entities: ${report.inventory.entities}`);
  lines.push(`- Services: ${report.inventory.services}`);
  lines.push(`- Screens: ${report.inventory.screens}`);
  lines.push(`- Forms: ${report.inventory.forms}`);
  lines.push(`- Business rules: ${report.inventory.business_rules}`);
  lines.push(`- Decisions: ${report.inventory.decisions}`);
  lines.push(`- Domains: ${report.inventory.domains.length > 0 ? report.inventory.domains.join(', ') : 'none'}`);
  lines.push('');
  lines.push('## Recommended Templates');
  lines.push('');
  if (report.recovery.recommended_templates.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.recovery.recommended_templates) {
      lines.push(`- ${item.id}: ${item.reason}`);
    }
  }
  lines.push('');
  lines.push('## Spec Plan');
  lines.push('');
  if (report.recovery.spec_plan.length === 0) {
    lines.push('- none');
  } else {
    for (const item of report.recovery.spec_plan) {
      const deps = Array.isArray(item.depends_on) && item.depends_on.length > 0
        ? item.depends_on.join(', ')
        : 'none';
      lines.push(`- ${item.spec_id}: ${item.goal} (depends_on: ${deps})`);
    }
  }
  lines.push('');
  lines.push('## Output');
  lines.push('');
  lines.push(`- Handoff manifest: ${report.output.handoff_manifest}`);
  lines.push(`- Ontology seed: ${report.output.ontology_seed}`);
  lines.push(`- Copilot contract: ${report.output.copilot_contract}`);
  lines.push(`- Copilot playbook: ${report.output.copilot_playbook}`);
  return `${lines.join('\n')}\n`;
}

async function writeBundle(bundleDir, payload) {
  const handoffDir = path.join(bundleDir, 'handoff');
  const ontologyDir = path.join(bundleDir, 'ontology');
  const copilotDir = path.join(bundleDir, 'copilot');
  const rebuildDir = path.join(bundleDir, 'rebuild');

  const handoffManifestPath = path.join(handoffDir, 'handoff-manifest.json');
  const ontologySeedPath = path.join(ontologyDir, 'moqui-ontology-seed.json');
  const copilotContractPath = path.join(copilotDir, 'page-context-contract.json');
  const copilotPlaybookPath = path.join(copilotDir, 'conversation-playbook.md');
  const recoverySpecPath = path.join(rebuildDir, 'recovery-spec-plan.json');

  await fs.ensureDir(handoffDir);
  await fs.ensureDir(ontologyDir);
  await fs.ensureDir(copilotDir);
  await fs.ensureDir(rebuildDir);

  await fs.writeJson(handoffManifestPath, payload.handoff_manifest, { spaces: 2 });
  await fs.writeJson(ontologySeedPath, payload.ontology_seed, { spaces: 2 });
  await fs.writeJson(copilotContractPath, payload.copilot_contract, { spaces: 2 });
  await fs.writeJson(recoverySpecPath, payload.recovery_spec_plan, { spaces: 2 });
  await fs.writeFile(
    copilotPlaybookPath,
    [
      '# Page Copilot Conversation Playbook',
      '',
      '1. Capture current page context (screen path, form, user action, error).',
      '2. Ask for diagnosis first, then ask for minimum patch proposal.',
      '3. Keep response in advisory/patch-proposal mode.',
      '4. Apply patch only after human confirmation and run validation checks.',
      '',
      'This playbook keeps original Moqui technology stack unchanged.'
    ].join('\n'),
    'utf8'
  );

  return {
    handoffManifestPath,
    ontologySeedPath,
    copilotContractPath,
    copilotPlaybookPath,
    recoverySpecPath
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const metadataPath = path.resolve(process.cwd(), options.metadata);
  const outPath = path.resolve(process.cwd(), options.out);
  const markdownPath = path.resolve(process.cwd(), options.markdownOut);
  const bundleDir = path.resolve(process.cwd(), options.bundleOut);

  if (!(await fs.pathExists(metadataPath))) {
    throw new Error(`metadata file not found: ${path.relative(process.cwd(), metadataPath)}`);
  }

  const metadata = await fs.readJson(metadataPath);

  const entities = collectEntityModels(metadata);
  const services = collectServiceModels(metadata);
  const screens = collectScreenModels(metadata);
  const forms = collectFormModels(metadata);
  const businessRules = collectNamedItems(metadata, ['business_rules', 'rules', 'rule_catalog'], 'rule');
  const decisions = collectNamedItems(metadata, ['decisions', 'decision_points', 'decision_catalog'], 'decision');
  const domains = detectDomains(entities);

  const context = {
    entities,
    services,
    screens,
    forms,
    businessRules,
    decisions
  };

  const recommendedTemplates = buildRecommendedTemplates(context);
  const capabilities = buildCapabilities(context);
  const specPlan = buildSpecPlan(context);
  const ontologySeed = buildOntologySeed(context);
  const copilotContract = buildCopilotContract(context);

  const handoffManifest = {
    timestamp: new Date().toISOString(),
    source_project: normalizeText(metadata.source_project) || normalizeText(metadata.project) || 'moqui-standard-rebuild',
    specs: specPlan.map(item => item.spec_id),
    templates: recommendedTemplates.map(item => item.id),
    capabilities,
    ontology_validation: {
      status: 'pending',
      source: 'moqui-standard-rebuild',
      generated_at: new Date().toISOString()
    },
    known_gaps: []
  };

  const bundleFiles = await writeBundle(bundleDir, {
    handoff_manifest: handoffManifest,
    ontology_seed: ontologySeed,
    copilot_contract: copilotContract,
    recovery_spec_plan: specPlan
  });

  const report = {
    mode: 'moqui-standard-rebuild',
    generated_at: new Date().toISOString(),
    metadata_file: path.relative(process.cwd(), metadataPath),
    inventory: {
      entities: entities.length,
      services: services.length,
      screens: screens.length,
      forms: forms.length,
      business_rules: businessRules.length,
      decisions: decisions.length,
      domains
    },
    recovery: {
      recommended_templates: recommendedTemplates,
      capabilities,
      spec_plan: specPlan
    },
    output: {
      bundle_dir: path.relative(process.cwd(), bundleDir),
      handoff_manifest: path.relative(process.cwd(), bundleFiles.handoffManifestPath),
      ontology_seed: path.relative(process.cwd(), bundleFiles.ontologySeedPath),
      copilot_contract: path.relative(process.cwd(), bundleFiles.copilotContractPath),
      copilot_playbook: path.relative(process.cwd(), bundleFiles.copilotPlaybookPath),
      recovery_spec_plan: path.relative(process.cwd(), bundleFiles.recoverySpecPath)
    }
  };

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownPath));
  await fs.writeFile(markdownPath, buildMarkdownReport(report), 'utf8');

  const stdoutPayload = {
    ...report,
    report_files: {
      json: path.relative(process.cwd(), outPath),
      markdown: path.relative(process.cwd(), markdownPath)
    }
  };

  if (options.json) {
    console.log(JSON.stringify(stdoutPayload, null, 2));
  } else {
    console.log('Moqui standard rebuild plan generated.');
    console.log(`  JSON: ${path.relative(process.cwd(), outPath)}`);
    console.log(`  Markdown: ${path.relative(process.cwd(), markdownPath)}`);
    console.log(`  Bundle: ${path.relative(process.cwd(), bundleDir)}`);
  }
}

main().catch((error) => {
  console.error(`Failed to build Moqui standard rebuild plan: ${error.message}`);
  process.exitCode = 1;
});
