#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_PROJECT_DIR = '.';
const DEFAULT_OUT = 'docs/moqui/metadata-catalog.json';
const DEFAULT_MARKDOWN_OUT = 'docs/moqui/metadata-catalog.md';

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

async function listXmlFiles(projectDir) {
  const files = [];
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
      if (stat.isFile() && /\.xml$/i.test(name)) {
        files.push(fullPath);
      }
    }
  }

  files.sort();
  return files;
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
    ['Forms', report.forms.map(item => item.name)]
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

  if (!(await fs.pathExists(projectDir))) {
    throw new Error(`project directory not found: ${path.relative(process.cwd(), projectDir)}`);
  }

  const xmlFiles = await listXmlFiles(projectDir);
  const entitiesRaw = [];
  const servicesRaw = [];
  const screensRaw = [];
  const formsRaw = [];
  const businessRulesRaw = [];
  const decisionsRaw = [];

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
  const businessRules = deduplicateBy(businessRulesRaw, item => item && item.name);
  const decisions = deduplicateBy(decisionsRaw, item => item && item.name);

  const report = {
    mode: 'moqui-metadata-extract',
    generated_at: new Date().toISOString(),
    source_project: projectDir.replace(/\\/g, '/'),
    scan: {
      xml_file_count: xmlFiles.length,
      xml_files: xmlFiles.map(file => path.relative(projectDir, file).replace(/\\/g, '/'))
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
