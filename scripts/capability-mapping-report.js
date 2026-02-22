#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

function parseArgs(argv = []) {
  const options = {
    input: '',
    inputFile: '',
    changesFile: '',
    templatesFile: '',
    ontologyFile: '',
    out: '',
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--input' && next) {
      options.input = next;
      index += 1;
      continue;
    }
    if (token === '--input-file' && next) {
      options.inputFile = next;
      index += 1;
      continue;
    }
    if (token === '--changes-file' && next) {
      options.changesFile = next;
      index += 1;
      continue;
    }
    if (token === '--templates-file' && next) {
      options.templatesFile = next;
      index += 1;
      continue;
    }
    if (token === '--ontology-file' && next) {
      options.ontologyFile = next;
      index += 1;
      continue;
    }
    if (token === '--out' && next) {
      options.out = next;
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

  return options;
}

function printHelpAndExit(code) {
  const lines = [
    'Usage: node scripts/capability-mapping-report.js [options]',
    '',
    'Options:',
    '  --input <json>            Inline input payload (changes/templates/ontology)',
    '  --input-file <path>       Input JSON file (changes/templates/ontology)',
    '  --changes-file <path>     Changes JSON file (array)',
    '  --templates-file <path>   Template catalog JSON file (array)',
    '  --ontology-file <path>    Ontology model JSON file',
    '  --out <path>              Output report path',
    '  --json                    Print JSON payload',
    '  -h, --help                Show this help'
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

async function readJsonIfExists(filePath) {
  if (!filePath) {
    return null;
  }
  const resolved = path.resolve(process.cwd(), filePath);
  if (!(await fs.pathExists(resolved))) {
    throw new Error(`file not found: ${filePath}`);
  }
  return fs.readJson(resolved);
}

function normalizeChanges(changes) {
  const array = Array.isArray(changes) ? changes : [];
  return array
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const type = `${item.type || item.node_type || ''}`.trim().toLowerCase();
      const name = `${item.name || item.ref || item.id || ''}`.trim();
      const changeId = `${item.change_id || item.id || (type && name ? `${type}:${name}` : name || type || 'unknown')}`;
      return {
        change_id: changeId,
        type: type || 'unknown',
        name: name || changeId,
        operation: `${item.operation || item.action || 'update'}`.trim().toLowerCase()
      };
    });
}

function normalizeTemplates(templates) {
  const array = Array.isArray(templates) ? templates : [];
  return array
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: `${item.id || item.template_id || item.name || 'unknown-template'}`.trim(),
      capabilities: Array.isArray(item.capabilities)
        ? item.capabilities.map((capability) => `${capability}`.trim().toLowerCase()).filter(Boolean)
        : []
    }));
}

function normalizeOntology(ontology = {}) {
  const pickNames = (values) => {
    if (!Array.isArray(values)) {
      return new Set();
    }
    return new Set(
      values
        .map((value) => {
          if (typeof value === 'string') {
            return value.trim().toLowerCase();
          }
          if (value && typeof value === 'object') {
            return `${value.name || value.ref || value.id || ''}`.trim().toLowerCase();
          }
          return '';
        })
        .filter(Boolean)
    );
  };

  return {
    entities: pickNames(ontology.entities),
    business_rules: pickNames(ontology.business_rules),
    decision_strategies: pickNames(ontology.decision_strategies),
    relations: Array.isArray(ontology.relations) ? ontology.relations : []
  };
}

function normalizeCapability(type, name) {
  const loweredName = `${name || ''}`.trim().toLowerCase();
  if (!loweredName) {
    return 'unknown:unknown';
  }
  if (type === 'entity') {
    return `entity:${loweredName}`;
  }
  if (type === 'business_rule' || type === 'rule') {
    return `rule:${loweredName}`;
  }
  if (type === 'decision_strategy' || type === 'decision') {
    return `decision:${loweredName}`;
  }
  if (type === 'service') {
    return `service:${loweredName}`;
  }
  if (type === 'scene') {
    return `scene:${loweredName}`;
  }
  return `${type || 'unknown'}:${loweredName}`;
}

function capabilityMatches(capability, templateCapability) {
  if (!capability || !templateCapability) {
    return false;
  }
  if (templateCapability === capability) {
    return true;
  }
  if (templateCapability.endsWith('*')) {
    const prefix = templateCapability.slice(0, -1);
    return capability.startsWith(prefix);
  }
  return false;
}

function findMappedTemplates(capability, templates) {
  const mapped = [];
  for (const template of templates) {
    if (template.capabilities.some((item) => capabilityMatches(capability, item))) {
      mapped.push(template.id);
    }
  }
  return mapped;
}

function checkOntologyCoverage(type, name, ontology) {
  const loweredName = `${name || ''}`.trim().toLowerCase();
  if (!loweredName) {
    return false;
  }
  if (type === 'entity') {
    return ontology.entities.has(loweredName);
  }
  if (type === 'business_rule' || type === 'rule') {
    return ontology.business_rules.has(loweredName);
  }
  if (type === 'decision_strategy' || type === 'decision') {
    return ontology.decision_strategies.has(loweredName);
  }
  return true;
}

function buildMappingReport({ changes, templates, ontology }) {
  const mappingReport = [];
  const missingCapabilities = [];
  const recommendedTemplates = new Set();
  const ontologyGaps = [];

  for (const change of changes) {
    const capability = normalizeCapability(change.type, change.name);
    const mappedTemplates = findMappedTemplates(capability, templates);
    const ontologyCovered = checkOntologyCoverage(change.type, change.name, ontology);

    for (const templateId of mappedTemplates) {
      recommendedTemplates.add(templateId);
    }

    if (mappedTemplates.length === 0) {
      missingCapabilities.push(capability);
    }
    if (!ontologyCovered) {
      ontologyGaps.push({
        change_id: change.change_id,
        type: change.type,
        name: change.name,
        capability
      });
    }

    const status = mappedTemplates.length > 0
      ? 'mapped'
      : (ontologyCovered ? 'missing_template' : 'missing_template_and_ontology_gap');

    mappingReport.push({
      change_id: change.change_id,
      capability,
      mapped_templates: mappedTemplates,
      ontology_status: ontologyCovered ? 'covered' : 'gap',
      status
    });
  }

  const totalChanges = mappingReport.length;
  const mappedChanges = mappingReport.filter((item) => item.mapped_templates.length > 0).length;
  const coveragePercent = totalChanges === 0
    ? 100
    : Number(((mappedChanges / totalChanges) * 100).toFixed(2));

  return {
    mode: 'capability-mapping-report',
    generated_at: new Date().toISOString(),
    mapping_report: mappingReport,
    missing_capabilities: [...new Set(missingCapabilities)],
    recommended_templates: [...recommendedTemplates],
    ontology_gaps: ontologyGaps,
    summary: {
      total_changes: totalChanges,
      mapped_changes: mappedChanges,
      missing_capabilities: [...new Set(missingCapabilities)].length,
      ontology_gaps: ontologyGaps.length,
      coverage_percent: coveragePercent
    }
  };
}

async function loadInput(options) {
  const inline = options.input ? JSON.parse(options.input) : null;
  const inputFilePayload = options.inputFile ? await readJsonIfExists(options.inputFile) : null;
  const changesPayload = options.changesFile ? await readJsonIfExists(options.changesFile) : null;
  const templatesPayload = options.templatesFile ? await readJsonIfExists(options.templatesFile) : null;
  const ontologyPayload = options.ontologyFile ? await readJsonIfExists(options.ontologyFile) : null;

  const source = inline || inputFilePayload || {};
  const changes = normalizeChanges(
    changesPayload || source.changes || source.change_set || source.mapping_input
  );
  const templates = normalizeTemplates(
    templatesPayload || source.templates || source.template_catalog || source.scene_templates
  );
  const ontology = normalizeOntology(
    ontologyPayload || source.ontology || source.ontology_model || {}
  );

  return {
    changes,
    templates,
    ontology
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await loadInput(options);
  const payload = buildMappingReport(input);

  if (options.out) {
    const outPath = path.resolve(process.cwd(), options.out);
    await fs.ensureDir(path.dirname(outPath));
    await fs.writeJson(outPath, payload, { spaces: 2 });
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`capability mapping coverage=${payload.summary.coverage_percent}%\n`);
    process.stdout.write(`missing_capabilities=${payload.summary.missing_capabilities}\n`);
    process.stdout.write(`ontology_gaps=${payload.summary.ontology_gaps}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`capability-mapping-report failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  normalizeChanges,
  normalizeTemplates,
  normalizeOntology,
  normalizeCapability,
  capabilityMatches,
  findMappedTemplates,
  checkOntologyCoverage,
  buildMappingReport,
  loadInput
};
