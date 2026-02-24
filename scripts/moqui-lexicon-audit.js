#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs-extra');

const DEFAULT_MANIFEST = 'docs/handoffs/handoff-manifest.json';
const DEFAULT_TEMPLATE_DIR = '.sce/templates/scene-packages';
const DEFAULT_LEXICON = 'lib/data/moqui-capability-lexicon.json';
const DEFAULT_OUT = '.sce/reports/release-evidence/moqui-lexicon-audit.json';
const DEFAULT_MARKDOWN_OUT = '.sce/reports/release-evidence/moqui-lexicon-audit.md';

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    templateDir: DEFAULT_TEMPLATE_DIR,
    lexicon: DEFAULT_LEXICON,
    out: DEFAULT_OUT,
    markdownOut: DEFAULT_MARKDOWN_OUT,
    failOnGap: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--manifest' && next) {
      options.manifest = next;
      i += 1;
    } else if (token === '--template-dir' && next) {
      options.templateDir = next;
      i += 1;
    } else if (token === '--lexicon' && next) {
      options.lexicon = next;
      i += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      i += 1;
    } else if (token === '--markdown-out' && next) {
      options.markdownOut = next;
      i += 1;
    } else if (token === '--fail-on-gap') {
      options.failOnGap = true;
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
    'Usage: node scripts/moqui-lexicon-audit.js [options]',
    '',
    'Options:',
    `  --manifest <path>      Handoff manifest JSON path (default: ${DEFAULT_MANIFEST})`,
    `  --template-dir <path>  Scene package template root (default: ${DEFAULT_TEMPLATE_DIR})`,
    `  --lexicon <path>       Moqui capability lexicon JSON path (default: ${DEFAULT_LEXICON})`,
    `  --out <path>           JSON report path (default: ${DEFAULT_OUT})`,
    `  --markdown-out <path>  Markdown report path (default: ${DEFAULT_MARKDOWN_OUT})`,
    '  --fail-on-gap          Exit non-zero when lexicon unknowns or coverage gaps exist',
    '  --json                 Print JSON payload to stdout',
    '  -h, --help             Show this help',
  ];
  console.log(lines.join('\n'));
  process.exit(code);
}

function normalizeCapabilityToken(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

function pickCapabilityIdentifier(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidates = [
    value.capability,
    value.capability_name,
    value.name,
    value.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

function collectManifestCapabilities(manifestPayload) {
  const entries = Array.isArray(manifestPayload && manifestPayload.capabilities)
    ? manifestPayload.capabilities
    : [];
  const capabilities = [];
  const seen = new Set();

  for (const entry of entries) {
    const raw = pickCapabilityIdentifier(entry);
    const normalized = normalizeCapabilityToken(raw);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    capabilities.push(raw.trim());
  }

  return capabilities;
}

function normalizeTemplateIdentifier(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`
    .trim()
    .toLowerCase()
    .replace(/\\/g, '/');
  if (!normalized) {
    return null;
  }
  const base = normalized.split('/').pop() || normalized;
  return base.replace(/^[a-z0-9-]+\.scene--/, 'scene--');
}

function collectManifestTemplateIdentifiers(manifestPayload) {
  const entries = Array.isArray(manifestPayload && manifestPayload.templates)
    ? manifestPayload.templates
    : [];
  const identifiers = [];
  const seen = new Set();
  for (const entry of entries) {
    const candidate = typeof entry === 'string'
      ? entry
      : (
        entry && typeof entry === 'object'
          ? (entry.id || entry.template_id || entry.template || entry.name)
          : null
      );
    const normalized = normalizeTemplateIdentifier(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    identifiers.push(normalized);
  }
  return identifiers;
}

function normalizeTemplateCapabilityCandidate(value) {
  const normalizedTemplate = normalizeTemplateIdentifier(value);
  if (!normalizedTemplate) {
    return null;
  }
  let candidate = normalizedTemplate.replace(/^scene--/, '');
  candidate = candidate.replace(
    /--\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/,
    ''
  );
  candidate = candidate.replace(/--\d{4}(?:-\d{2}){1,2}(?:-[a-z0-9-]+)?$/, '');
  return normalizeCapabilityToken(candidate);
}

function inferExpectedCapabilitiesFromTemplates(templateIdentifiers = [], lexiconIndex) {
  const capabilities = [];
  const capabilitySet = new Set();
  const inferredFrom = [];
  const unresolvedTemplates = [];
  const unresolvedSet = new Set();

  for (const templateId of templateIdentifiers) {
    const candidate = normalizeTemplateCapabilityCandidate(templateId);
    if (!candidate) {
      continue;
    }
    const descriptor = resolveCapabilityDescriptor(candidate, lexiconIndex);
    if (descriptor && descriptor.is_known) {
      if (!capabilitySet.has(descriptor.canonical)) {
        capabilitySet.add(descriptor.canonical);
        capabilities.push(descriptor.canonical);
      }
      inferredFrom.push({
        template: templateId,
        normalized_template: candidate,
        capability: descriptor.canonical
      });
      continue;
    }
    if (!unresolvedSet.has(templateId)) {
      unresolvedSet.add(templateId);
      unresolvedTemplates.push(templateId);
    }
  }

  return {
    capabilities,
    inferred_from: inferredFrom,
    unresolved_templates: unresolvedTemplates
  };
}

async function collectTemplateProvidedCapabilities(templateRoot) {
  const results = [];
  if (!(await fs.pathExists(templateRoot))) {
    return results;
  }

  const names = await fs.readdir(templateRoot);
  for (const name of names) {
    const dirPath = path.join(templateRoot, name);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      continue;
    }
    const contractPath = path.join(dirPath, 'scene-package.json');
    if (!(await fs.pathExists(contractPath))) {
      continue;
    }
    let contract = null;
    try {
      contract = await fs.readJson(contractPath);
    } catch (_error) {
      continue;
    }
    const provides = Array.isArray(
      contract && contract.capabilities && contract.capabilities.provides
    )
      ? contract.capabilities.provides
      : [];

    const provided = [];
    for (const item of provides) {
      if (typeof item === 'string' && item.trim().length > 0) {
        provided.push(item.trim());
      }
    }

    results.push({
      template_id: name,
      contract_path: path.relative(process.cwd(), contractPath),
      provides: provided,
    });
  }

  return results;
}

function buildLexiconIndex(rawLexicon = {}) {
  const aliasToCanonical = new Map();
  const deprecatedAliasToCanonical = new Map();
  const canonicalSet = new Set();
  const entries = Array.isArray(rawLexicon && rawLexicon.capabilities)
    ? rawLexicon.capabilities
    : [];

  for (const entry of entries) {
    const canonical = normalizeCapabilityToken(entry && entry.canonical);
    if (!canonical) {
      continue;
    }
    canonicalSet.add(canonical);
    aliasToCanonical.set(canonical, canonical);

    const aliases = Array.isArray(entry && entry.aliases) ? entry.aliases : [];
    for (const alias of aliases) {
      const normalizedAlias = normalizeCapabilityToken(alias);
      if (!normalizedAlias) {
        continue;
      }
      aliasToCanonical.set(normalizedAlias, canonical);
    }

    const deprecatedAliases = Array.isArray(entry && entry.deprecated_aliases)
      ? entry.deprecated_aliases
      : [];
    for (const deprecatedAlias of deprecatedAliases) {
      const normalizedAlias = normalizeCapabilityToken(deprecatedAlias);
      if (!normalizedAlias) {
        continue;
      }
      aliasToCanonical.set(normalizedAlias, canonical);
      deprecatedAliasToCanonical.set(normalizedAlias, canonical);
    }
  }

  return {
    version: rawLexicon && rawLexicon.version ? `${rawLexicon.version}` : null,
    source: rawLexicon && rawLexicon.source ? `${rawLexicon.source}` : null,
    canonical_set: canonicalSet,
    alias_to_canonical: aliasToCanonical,
    deprecated_alias_to_canonical: deprecatedAliasToCanonical,
  };
}

function resolveCapabilityDescriptor(value, lexiconIndex) {
  const raw = `${value || ''}`.trim();
  const normalized = normalizeCapabilityToken(raw);
  if (!raw || !normalized) {
    return null;
  }

  const canonical = lexiconIndex.alias_to_canonical.get(normalized) || normalized;
  const isDeprecatedAlias = lexiconIndex.deprecated_alias_to_canonical.has(normalized);
  const isAlias = !isDeprecatedAlias && normalized !== canonical;
  const isKnown = lexiconIndex.canonical_set.has(canonical);

  return {
    raw,
    normalized,
    canonical,
    is_known: isKnown,
    is_alias: isAlias,
    is_deprecated_alias: isDeprecatedAlias,
  };
}

function collectUniqueDescriptors(values, lexiconIndex) {
  const descriptors = [];
  const seen = new Set();
  for (const value of values) {
    const descriptor = resolveCapabilityDescriptor(value, lexiconIndex);
    if (!descriptor || seen.has(descriptor.normalized)) {
      continue;
    }
    seen.add(descriptor.normalized);
    descriptors.push(descriptor);
  }
  return descriptors;
}

function toRate(numerator, denominator) {
  if (!Number.isFinite(Number(denominator)) || Number(denominator) <= 0) {
    return null;
  }
  return Number(((Number(numerator) / Number(denominator)) * 100).toFixed(2));
}

function buildMarkdownReport(report) {
  const summary = report.summary && typeof report.summary === 'object' ? report.summary : {};
  const coverage = report.coverage && typeof report.coverage === 'object' ? report.coverage : {};
  const expectedScope = report.expected_scope && typeof report.expected_scope === 'object'
    ? report.expected_scope
    : {};
  const lines = [];
  lines.push('# Moqui Lexicon Audit');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Manifest: ${report.manifest_path}`);
  lines.push(`- Template root: ${report.template_root}`);
  lines.push(`- Lexicon version: ${report.lexicon && report.lexicon.version ? report.lexicon.version : 'n/a'}`);
  lines.push(`- Result: ${summary.passed ? 'pass' : 'fail'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Expected capabilities: ${summary.expected_total}`);
  lines.push(`- Expected source: ${expectedScope.source || 'none'}`);
  lines.push(`- Expected inferred count: ${expectedScope.inferred_count || 0}`);
  lines.push(`- Expected unresolved templates: ${expectedScope.unresolved_template_count || 0}`);
  lines.push(`- Expected unknown: ${summary.expected_unknown_count}`);
  lines.push(`- Provided capabilities: ${summary.provided_total}`);
  lines.push(`- Provided unknown: ${summary.provided_unknown_count}`);
  lines.push(`- Canonical coverage: ${coverage.coverage_percent === null ? 'n/a' : `${coverage.coverage_percent}%`}`);
  lines.push(`- Uncovered expected: ${summary.uncovered_expected_count}`);
  lines.push('');

  if (Array.isArray(coverage.uncovered_expected) && coverage.uncovered_expected.length > 0) {
    lines.push('## Uncovered Expected Capabilities');
    lines.push('');
    for (const item of coverage.uncovered_expected) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  const expectedUnknown = report.normalization && report.normalization.expected
    ? report.normalization.expected.unknown
    : [];
  if (Array.isArray(expectedUnknown) && expectedUnknown.length > 0) {
    lines.push('## Expected Unknown');
    lines.push('');
    for (const item of expectedUnknown) {
      lines.push(`- ${item.raw}`);
    }
    lines.push('');
  }

  const providedUnknown = report.normalization && report.normalization.provided
    ? report.normalization.provided.unknown
    : [];
  if (Array.isArray(providedUnknown) && providedUnknown.length > 0) {
    lines.push('## Provided Unknown');
    lines.push('');
    for (const item of providedUnknown) {
      lines.push(`- ${item.raw}`);
    }
    lines.push('');
  }

  if (
    Array.isArray(expectedScope.unresolved_templates) &&
    expectedScope.unresolved_templates.length > 0
  ) {
    lines.push('## Expected Inference Unresolved Templates');
    lines.push('');
    for (const templateId of expectedScope.unresolved_templates) {
      lines.push(`- ${templateId}`);
    }
    lines.push('');
  }

  lines.push('## Recommendations');
  lines.push('');
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  if (recommendations.length === 0) {
    lines.push('- none');
  } else {
    for (const item of recommendations) {
      lines.push(`- ${item}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function buildRecommendations(report) {
  const recommendations = [];
  const summary = report.summary && typeof report.summary === 'object' ? report.summary : {};
  const coverage = report.coverage && typeof report.coverage === 'object' ? report.coverage : {};
  const expectedScope = report.expected_scope && typeof report.expected_scope === 'object'
    ? report.expected_scope
    : {};

  if (summary.expected_unknown_count > 0) {
    recommendations.push(
      'Normalize manifest capabilities to canonical Moqui IDs and remove unknown capability names.'
    );
  }
  if (summary.provided_unknown_count > 0) {
    recommendations.push(
      'Update scene-package capabilities.provides to canonical IDs or extend lexicon aliases/deprecations.'
    );
  }
  if (summary.uncovered_expected_count > 0) {
    recommendations.push(
      `Add/align template capability coverage for: ${(coverage.uncovered_expected || []).join(', ')}.`
    );
  }
  if (
    summary.expected_deprecated_alias_count > 0 ||
    summary.provided_deprecated_alias_count > 0
  ) {
    recommendations.push(
      'Replace deprecated capability aliases with canonical capability IDs in manifests and templates.'
    );
  }
  if (expectedScope.source === 'none') {
    recommendations.push(
      'Declare manifest capabilities or use lexicon-aligned scene template names so expected scope is not empty.'
    );
  }
  if (
    expectedScope.source === 'manifest.templates' &&
    expectedScope.unresolved_template_count > 0
  ) {
    recommendations.push(
      'Template-based capability inference has unresolved template names; align template IDs with lexicon capability names or declare manifest capabilities explicitly.'
    );
  }

  return recommendations;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), options.manifest);
  const templateRoot = path.resolve(process.cwd(), options.templateDir);
  const lexiconPath = path.resolve(process.cwd(), options.lexicon);
  const outPath = path.resolve(process.cwd(), options.out);
  const markdownPath = path.resolve(process.cwd(), options.markdownOut);

  if (!(await fs.pathExists(manifestPath))) {
    throw new Error(`manifest not found: ${path.relative(process.cwd(), manifestPath)}`);
  }
  if (!(await fs.pathExists(lexiconPath))) {
    throw new Error(`lexicon file not found: ${path.relative(process.cwd(), lexiconPath)}`);
  }

  const manifestPayload = await fs.readJson(manifestPath);
  const lexiconPayload = await fs.readJson(lexiconPath);
  const lexiconIndex = buildLexiconIndex(lexiconPayload);
  const manifestCapabilities = collectManifestCapabilities(manifestPayload);
  const manifestTemplateIdentifiers = collectManifestTemplateIdentifiers(manifestPayload);
  const capabilityInference = inferExpectedCapabilitiesFromTemplates(
    manifestTemplateIdentifiers,
    lexiconIndex
  );
  let expectedValues = manifestCapabilities;
  let expectedSource = 'manifest.capabilities';
  if (manifestCapabilities.length === 0) {
    if (capabilityInference.capabilities.length > 0) {
      expectedValues = capabilityInference.capabilities;
      expectedSource = 'manifest.templates';
    } else {
      expectedSource = 'none';
    }
  }
  const templates = await collectTemplateProvidedCapabilities(templateRoot);
  const manifestTemplateIdentifierSet = new Set(manifestTemplateIdentifiers);
  const scopedTemplates = manifestTemplateIdentifierSet.size > 0
    ? templates.filter(item => manifestTemplateIdentifierSet.has(
      normalizeTemplateIdentifier(item && item.template_id)
    ))
    : templates;
  const selectedTemplates = scopedTemplates.length > 0 ? scopedTemplates : templates;
  const providedValues = selectedTemplates.flatMap(item => item.provides || []);

  const expectedDescriptors = collectUniqueDescriptors(expectedValues, lexiconIndex);
  const providedDescriptors = collectUniqueDescriptors(providedValues, lexiconIndex);

  const expectedCanonical = Array.from(new Set(expectedDescriptors.map(item => item.canonical))).sort();
  const providedCanonical = Array.from(new Set(providedDescriptors.map(item => item.canonical))).sort();
  const providedCanonicalSet = new Set(providedCanonical);
  const uncoveredExpected = expectedCanonical.filter(item => !providedCanonicalSet.has(item));

  const expectedUnknown = expectedDescriptors.filter(item => !item.is_known);
  const providedUnknown = providedDescriptors.filter(item => !item.is_known);
  const expectedDeprecated = expectedDescriptors.filter(item => item.is_deprecated_alias);
  const providedDeprecated = providedDescriptors.filter(item => item.is_deprecated_alias);
  const expectedAliases = expectedDescriptors.filter(item => item.is_alias);
  const providedAliases = providedDescriptors.filter(item => item.is_alias);

  const coveragePercent = toRate(
    expectedCanonical.length - uncoveredExpected.length,
    expectedCanonical.length
  );
  const summary = {
    expected_total: expectedDescriptors.length,
    expected_source: expectedSource,
    expected_known_count: expectedDescriptors.length - expectedUnknown.length,
    expected_unknown_count: expectedUnknown.length,
    expected_alias_count: expectedAliases.length,
    expected_deprecated_alias_count: expectedDeprecated.length,
    provided_total: providedDescriptors.length,
    provided_known_count: providedDescriptors.length - providedUnknown.length,
    provided_unknown_count: providedUnknown.length,
    provided_alias_count: providedAliases.length,
    provided_deprecated_alias_count: providedDeprecated.length,
    uncovered_expected_count: uncoveredExpected.length,
    coverage_percent: coveragePercent,
    passed: expectedUnknown.length === 0 && providedUnknown.length === 0 && uncoveredExpected.length === 0,
  };

  const report = {
    mode: 'moqui-lexicon-audit',
    generated_at: new Date().toISOString(),
    manifest_path: path.relative(process.cwd(), manifestPath),
    template_root: path.relative(process.cwd(), templateRoot),
    template_scope: {
      manifest_templates_total: manifestTemplateIdentifiers.length,
      matched_templates_count: scopedTemplates.length,
      using_manifest_scope: manifestTemplateIdentifierSet.size > 0 && scopedTemplates.length > 0,
    },
    expected_scope: {
      source: expectedSource,
      declared_count: manifestCapabilities.length,
      effective_count: expectedValues.length,
      inferred_count: capabilityInference.capabilities.length,
      inferred_capabilities: capabilityInference.capabilities,
      inferred_from_templates: capabilityInference.inferred_from,
      unresolved_template_count: capabilityInference.unresolved_templates.length,
      unresolved_templates: capabilityInference.unresolved_templates
    },
    lexicon: {
      file: path.relative(process.cwd(), lexiconPath),
      version: lexiconIndex.version,
      source: lexiconIndex.source,
      canonical_count: lexiconIndex.canonical_set.size,
    },
    summary,
    normalization: {
      expected: {
        aliases: expectedAliases,
        deprecated_aliases: expectedDeprecated,
        unknown: expectedUnknown,
      },
      provided: {
        aliases: providedAliases,
        deprecated_aliases: providedDeprecated,
        unknown: providedUnknown,
      },
    },
    coverage: {
      expected_canonical: expectedCanonical,
      provided_canonical: providedCanonical,
      uncovered_expected: uncoveredExpected,
      coverage_percent: coveragePercent,
    },
    templates: selectedTemplates,
    recommendations: [],
  };
  report.recommendations = buildRecommendations(report);

  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, report, { spaces: 2 });
  await fs.ensureDir(path.dirname(markdownPath));
  await fs.writeFile(markdownPath, buildMarkdownReport(report), 'utf8');

  if (options.json) {
    console.log(JSON.stringify({
      ...report,
      output: {
        json: path.relative(process.cwd(), outPath),
        markdown: path.relative(process.cwd(), markdownPath),
      },
    }, null, 2));
  } else {
    console.log('Moqui lexicon audit generated.');
    console.log(`  JSON: ${path.relative(process.cwd(), outPath)}`);
    console.log(`  Markdown: ${path.relative(process.cwd(), markdownPath)}`);
    console.log(`  Result: ${summary.passed ? 'pass' : 'fail'}`);
  }

  if (options.failOnGap && !summary.passed) {
    console.error(
      'Moqui lexicon audit failed: ' +
      `expected_unknown=${summary.expected_unknown_count}, ` +
      `provided_unknown=${summary.provided_unknown_count}, ` +
      `uncovered_expected=${summary.uncovered_expected_count}`
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Failed to run moqui lexicon audit: ${error.message}`);
  process.exitCode = 1;
});
