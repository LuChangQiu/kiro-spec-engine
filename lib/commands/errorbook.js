const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const Table = require('cli-table3');

const ERRORBOOK_INDEX_API_VERSION = 'sce.errorbook.index/v0.1';
const ERRORBOOK_ENTRY_API_VERSION = 'sce.errorbook.entry/v0.1';
const ERRORBOOK_STATUSES = Object.freeze(['candidate', 'verified', 'promoted', 'deprecated']);
const STATUS_RANK = Object.freeze({
  deprecated: 0,
  candidate: 1,
  verified: 2,
  promoted: 3
});
const ERRORBOOK_ONTOLOGY_TAGS = Object.freeze([
  'entity',
  'relation',
  'business_rule',
  'decision_policy',
  'execution_flow'
]);
const ONTOLOGY_TAG_ALIASES = Object.freeze({
  entities: 'entity',
  relations: 'relation',
  rule: 'business_rule',
  rules: 'business_rule',
  business_rules: 'business_rule',
  decision: 'decision_policy',
  decisions: 'decision_policy',
  policy: 'decision_policy',
  policies: 'decision_policy',
  execution: 'execution_flow',
  flow: 'execution_flow',
  workflow: 'execution_flow',
  workflows: 'execution_flow',
  action_chain: 'execution_flow'
});
const DEFAULT_PROMOTE_MIN_QUALITY = 75;

function resolveErrorbookPaths(projectPath = process.cwd()) {
  const baseDir = path.join(projectPath, '.sce', 'errorbook');
  return {
    projectPath,
    baseDir,
    entriesDir: path.join(baseDir, 'entries'),
    indexFile: path.join(baseDir, 'index.json')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeCsv(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeStringList(...rawInputs) {
  const merged = [];
  for (const raw of rawInputs) {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const normalized = normalizeText(`${item}`);
        if (normalized) {
          merged.push(normalized);
        }
      }
      continue;
    }

    if (typeof raw === 'string') {
      for (const item of normalizeCsv(raw)) {
        const normalized = normalizeText(item);
        if (normalized) {
          merged.push(normalized);
        }
      }
    }
  }

  return Array.from(new Set(merged));
}

function normalizeOntologyTags(...rawInputs) {
  const normalized = normalizeStringList(...rawInputs).map((item) => item.toLowerCase());
  const mapped = normalized.map((item) => ONTOLOGY_TAG_ALIASES[item] || item);
  const valid = mapped.filter((item) => ERRORBOOK_ONTOLOGY_TAGS.includes(item));
  return Array.from(new Set(valid));
}

function normalizeStatus(input, fallback = 'candidate') {
  const normalized = normalizeText(`${input || ''}`).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (!ERRORBOOK_STATUSES.includes(normalized)) {
    throw new Error(`status must be one of: ${ERRORBOOK_STATUSES.join(', ')}`);
  }

  return normalized;
}

function selectStatus(...candidates) {
  let selected = 'candidate';
  for (const candidate of candidates) {
    const status = normalizeStatus(candidate, 'candidate');
    if ((STATUS_RANK[status] || 0) > (STATUS_RANK[selected] || 0)) {
      selected = status;
    }
  }
  return selected;
}

function createFingerprint(input = {}) {
  const explicit = normalizeText(input.fingerprint);
  if (explicit) {
    return explicit;
  }

  const basis = [
    normalizeText(input.title).toLowerCase(),
    normalizeText(input.symptom).toLowerCase(),
    normalizeText(input.root_cause || input.rootCause).toLowerCase()
  ].join('|');

  const digest = crypto.createHash('sha1').update(basis).digest('hex').slice(0, 16);
  return `fp-${digest}`;
}

function buildDefaultIndex() {
  return {
    api_version: ERRORBOOK_INDEX_API_VERSION,
    updated_at: nowIso(),
    total_entries: 0,
    entries: []
  };
}

async function ensureErrorbookStorage(paths, fileSystem = fs) {
  await fileSystem.ensureDir(paths.entriesDir);
  if (!await fileSystem.pathExists(paths.indexFile)) {
    await fileSystem.writeJson(paths.indexFile, buildDefaultIndex(), { spaces: 2 });
  }
}

async function readErrorbookIndex(paths, fileSystem = fs) {
  await ensureErrorbookStorage(paths, fileSystem);
  const index = await fileSystem.readJson(paths.indexFile);
  if (!index || typeof index !== 'object' || !Array.isArray(index.entries)) {
    return buildDefaultIndex();
  }

  return {
    api_version: index.api_version || ERRORBOOK_INDEX_API_VERSION,
    updated_at: index.updated_at || nowIso(),
    total_entries: Number.isInteger(index.total_entries) ? index.total_entries : index.entries.length,
    entries: index.entries
  };
}

async function writeErrorbookIndex(paths, index, fileSystem = fs) {
  const payload = {
    ...index,
    api_version: ERRORBOOK_INDEX_API_VERSION,
    updated_at: nowIso(),
    total_entries: Array.isArray(index.entries) ? index.entries.length : 0
  };
  await fileSystem.ensureDir(path.dirname(paths.indexFile));
  await fileSystem.writeJson(paths.indexFile, payload, { spaces: 2 });
  return payload;
}

function buildEntryFilePath(paths, entryId) {
  return path.join(paths.entriesDir, `${entryId}.json`);
}

async function readErrorbookEntry(paths, entryId, fileSystem = fs) {
  const entryPath = buildEntryFilePath(paths, entryId);
  if (!await fileSystem.pathExists(entryPath)) {
    return null;
  }
  return fileSystem.readJson(entryPath);
}

async function writeErrorbookEntry(paths, entry, fileSystem = fs) {
  const entryPath = buildEntryFilePath(paths, entry.id);
  await fileSystem.ensureDir(path.dirname(entryPath));
  await fileSystem.writeJson(entryPath, entry, { spaces: 2 });
  return entryPath;
}

function scoreQuality(entry = {}) {
  let score = 0;

  if (normalizeText(entry.title)) {
    score += 10;
  }
  if (normalizeText(entry.symptom)) {
    score += 10;
  }
  if (normalizeText(entry.fingerprint)) {
    score += 10;
  }
  if (normalizeText(entry.root_cause)) {
    score += 20;
  }
  if (Array.isArray(entry.fix_actions) && entry.fix_actions.length > 0) {
    score += 20;
  }
  if (Array.isArray(entry.verification_evidence) && entry.verification_evidence.length > 0) {
    score += 20;
  }
  if (Array.isArray(entry.ontology_tags) && entry.ontology_tags.length > 0) {
    score += 5;
  }
  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    score += 3;
  }
  if (normalizeText(entry.symptom).length >= 24 && normalizeText(entry.root_cause).length >= 24) {
    score += 2;
  }

  return Math.max(0, Math.min(100, score));
}

function validateRecordPayload(payload) {
  if (!normalizeText(payload.title)) {
    throw new Error('--title is required');
  }
  if (!normalizeText(payload.symptom)) {
    throw new Error('--symptom is required');
  }
  if (!normalizeText(payload.root_cause)) {
    throw new Error('--root-cause is required');
  }
  if (!Array.isArray(payload.fix_actions) || payload.fix_actions.length === 0) {
    throw new Error('at least one --fix-action is required');
  }

  const status = normalizeStatus(payload.status, 'candidate');
  if (status === 'promoted') {
    throw new Error('record does not accept status=promoted. Use "sce errorbook promote <id>"');
  }
  if (status === 'verified' && (!Array.isArray(payload.verification_evidence) || payload.verification_evidence.length === 0)) {
    throw new Error('status=verified requires at least one --verification evidence');
  }
}

function normalizeRecordPayload(options = {}, fromFilePayload = {}) {
  const payload = {
    title: normalizeText(options.title || fromFilePayload.title),
    symptom: normalizeText(options.symptom || fromFilePayload.symptom),
    root_cause: normalizeText(options.rootCause || options.root_cause || fromFilePayload.root_cause || fromFilePayload.rootCause),
    fix_actions: normalizeStringList(fromFilePayload.fix_actions, fromFilePayload.fixActions, options.fixAction, options.fixActions),
    verification_evidence: normalizeStringList(
      fromFilePayload.verification_evidence,
      fromFilePayload.verificationEvidence,
      options.verification,
      options.verificationEvidence
    ),
    tags: normalizeStringList(fromFilePayload.tags, options.tags),
    ontology_tags: normalizeOntologyTags(fromFilePayload.ontology_tags, fromFilePayload.ontology, options.ontology),
    status: normalizeStatus(options.status || fromFilePayload.status || 'candidate'),
    source: {
      spec: normalizeText(options.spec || fromFilePayload?.source?.spec),
      files: normalizeStringList(fromFilePayload?.source?.files, options.files),
      tests: normalizeStringList(fromFilePayload?.source?.tests, options.tests)
    },
    notes: normalizeText(options.notes || fromFilePayload.notes),
    fingerprint: createFingerprint({
      fingerprint: options.fingerprint || fromFilePayload.fingerprint,
      title: options.title || fromFilePayload.title,
      symptom: options.symptom || fromFilePayload.symptom,
      root_cause: options.rootCause || options.root_cause || fromFilePayload.root_cause || fromFilePayload.rootCause
    })
  };

  return payload;
}

function createEntryId() {
  return `eb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function buildIndexSummary(entry) {
  return {
    id: entry.id,
    fingerprint: entry.fingerprint,
    title: entry.title,
    status: entry.status,
    quality_score: entry.quality_score,
    tags: entry.tags,
    ontology_tags: entry.ontology_tags,
    occurrences: entry.occurrences || 1,
    created_at: entry.created_at,
    updated_at: entry.updated_at
  };
}

function findSummaryById(index, id) {
  const normalized = normalizeText(id);
  if (!normalized) {
    return null;
  }

  const exact = index.entries.find((item) => item.id === normalized);
  if (exact) {
    return exact;
  }

  const startsWith = index.entries.filter((item) => item.id.startsWith(normalized));
  if (startsWith.length === 1) {
    return startsWith[0];
  }
  if (startsWith.length > 1) {
    throw new Error(`entry id prefix "${normalized}" is ambiguous (${startsWith.length} matches)`);
  }
  return null;
}

function mergeEntry(existingEntry, incomingPayload) {
  const merged = {
    ...existingEntry,
    title: normalizeText(incomingPayload.title) || existingEntry.title,
    symptom: normalizeText(incomingPayload.symptom) || existingEntry.symptom,
    root_cause: normalizeText(incomingPayload.root_cause) || existingEntry.root_cause,
    fix_actions: normalizeStringList(existingEntry.fix_actions, incomingPayload.fix_actions),
    verification_evidence: normalizeStringList(existingEntry.verification_evidence, incomingPayload.verification_evidence),
    tags: normalizeStringList(existingEntry.tags, incomingPayload.tags),
    ontology_tags: normalizeOntologyTags(existingEntry.ontology_tags, incomingPayload.ontology_tags),
    status: selectStatus(existingEntry.status, incomingPayload.status),
    notes: normalizeText(incomingPayload.notes) || existingEntry.notes || '',
    source: {
      spec: normalizeText(incomingPayload?.source?.spec) || normalizeText(existingEntry?.source?.spec),
      files: normalizeStringList(existingEntry?.source?.files, incomingPayload?.source?.files),
      tests: normalizeStringList(existingEntry?.source?.tests, incomingPayload?.source?.tests)
    },
    occurrences: Number(existingEntry.occurrences || 1) + 1,
    updated_at: nowIso()
  };
  merged.quality_score = scoreQuality(merged);
  return merged;
}

async function loadRecordPayloadFromFile(projectPath, sourcePath, fileSystem = fs) {
  const normalized = normalizeText(sourcePath);
  if (!normalized) {
    return {};
  }

  const absolutePath = path.isAbsolute(normalized)
    ? normalized
    : path.join(projectPath, normalized);

  if (!await fileSystem.pathExists(absolutePath)) {
    throw new Error(`record source file not found: ${sourcePath}`);
  }

  try {
    const payload = await fileSystem.readJson(absolutePath);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('record source JSON must be an object');
    }
    return payload;
  } catch (error) {
    throw new Error(`failed to parse record source file (${sourcePath}): ${error.message}`);
  }
}

function printRecordSummary(result) {
  const action = result.created ? 'Recorded new entry' : 'Updated duplicate fingerprint';
  console.log(chalk.green(`✓ ${action}`));
  console.log(chalk.gray(`  id: ${result.entry.id}`));
  console.log(chalk.gray(`  status: ${result.entry.status}`));
  console.log(chalk.gray(`  quality: ${result.entry.quality_score}`));
  console.log(chalk.gray(`  fingerprint: ${result.entry.fingerprint}`));
}

function printListSummary(payload) {
  if (payload.entries.length === 0) {
    console.log(chalk.gray('No errorbook entries found'));
    return;
  }

  const table = new Table({
    head: ['ID', 'Status', 'Quality', 'Title', 'Updated', 'Occurrences'].map((item) => chalk.cyan(item)),
    colWidths: [16, 12, 10, 44, 22, 12]
  });

  payload.entries.forEach((entry) => {
    table.push([
      entry.id,
      entry.status,
      entry.quality_score,
      entry.title.length > 40 ? `${entry.title.slice(0, 40)}...` : entry.title,
      entry.updated_at,
      entry.occurrences || 1
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`Total: ${payload.total_results} (stored: ${payload.total_entries})`));
}

function scoreSearchMatch(entry, queryTokens) {
  const title = normalizeText(entry.title).toLowerCase();
  const symptom = normalizeText(entry.symptom).toLowerCase();
  const rootCause = normalizeText(entry.root_cause).toLowerCase();
  const fingerprint = normalizeText(entry.fingerprint).toLowerCase();
  const tagText = normalizeStringList(entry.tags, entry.ontology_tags).join(' ').toLowerCase();
  const fixText = normalizeStringList(entry.fix_actions).join(' ').toLowerCase();

  let score = 0;
  for (const token of queryTokens) {
    if (!token) {
      continue;
    }
    if (title.includes(token)) {
      score += 8;
    }
    if (symptom.includes(token)) {
      score += 5;
    }
    if (rootCause.includes(token)) {
      score += 5;
    }
    if (fixText.includes(token)) {
      score += 3;
    }
    if (tagText.includes(token)) {
      score += 2;
    }
    if (fingerprint.includes(token)) {
      score += 1;
    }
  }

  score += (Number(entry.quality_score) || 0) / 20;
  score += STATUS_RANK[entry.status] || 0;
  return Number(score.toFixed(3));
}

function validatePromoteCandidate(entry, minQuality = DEFAULT_PROMOTE_MIN_QUALITY) {
  const missing = [];
  if (!normalizeText(entry.root_cause)) {
    missing.push('root_cause');
  }
  if (!Array.isArray(entry.fix_actions) || entry.fix_actions.length === 0) {
    missing.push('fix_actions');
  }
  if (!Array.isArray(entry.verification_evidence) || entry.verification_evidence.length === 0) {
    missing.push('verification_evidence');
  }
  if (!Array.isArray(entry.ontology_tags) || entry.ontology_tags.length === 0) {
    missing.push('ontology_tags');
  }
  if ((Number(entry.quality_score) || 0) < minQuality) {
    missing.push(`quality_score>=${minQuality}`);
  }
  if (entry.status === 'deprecated') {
    missing.push('status!=deprecated');
  }
  return missing;
}

async function runErrorbookRecordCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveErrorbookPaths(projectPath);

  const fromFilePayload = await loadRecordPayloadFromFile(projectPath, options.from, fileSystem);
  const normalized = normalizeRecordPayload(options, fromFilePayload);
  validateRecordPayload(normalized);

  const index = await readErrorbookIndex(paths, fileSystem);
  const existingSummary = index.entries.find((entry) => entry.fingerprint === normalized.fingerprint);
  const timestamp = nowIso();

  let entry;
  let created = false;
  let deduplicated = false;

  if (existingSummary) {
    const existingEntry = await readErrorbookEntry(paths, existingSummary.id, fileSystem);
    if (!existingEntry) {
      throw new Error(`errorbook index references missing entry: ${existingSummary.id}`);
    }
    entry = mergeEntry(existingEntry, normalized);
    deduplicated = true;
  } else {
    entry = {
      api_version: ERRORBOOK_ENTRY_API_VERSION,
      id: createEntryId(),
      created_at: timestamp,
      updated_at: timestamp,
      fingerprint: normalized.fingerprint,
      title: normalized.title,
      symptom: normalized.symptom,
      root_cause: normalized.root_cause,
      fix_actions: normalized.fix_actions,
      verification_evidence: normalized.verification_evidence,
      tags: normalized.tags,
      ontology_tags: normalized.ontology_tags,
      status: normalized.status,
      source: normalized.source,
      notes: normalized.notes || '',
      occurrences: 1
    };
    entry.quality_score = scoreQuality(entry);
    created = true;
  }

  entry.updated_at = nowIso();
  entry.quality_score = scoreQuality(entry);
  await writeErrorbookEntry(paths, entry, fileSystem);

  const summary = buildIndexSummary(entry);
  const summaryIndex = index.entries.findIndex((item) => item.id === summary.id);
  if (summaryIndex >= 0) {
    index.entries[summaryIndex] = summary;
  } else {
    index.entries.push(summary);
  }
  index.entries.sort((left, right) => `${right.updated_at}`.localeCompare(`${left.updated_at}`));
  await writeErrorbookIndex(paths, index, fileSystem);

  const result = {
    mode: 'errorbook-record',
    created,
    deduplicated,
    entry
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    printRecordSummary(result);
  }

  return result;
}

async function runErrorbookListCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveErrorbookPaths(projectPath);
  const index = await readErrorbookIndex(paths, fileSystem);

  const requestedStatus = options.status ? normalizeStatus(options.status) : null;
  const requestedTag = normalizeText(options.tag).toLowerCase();
  const requestedOntology = normalizeOntologyTags(options.ontology)[0] || '';
  const minQuality = Number.isFinite(Number(options.minQuality)) ? Number(options.minQuality) : null;
  const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Number(options.limit)
    : 20;

  let filtered = [...index.entries];
  if (requestedStatus) {
    filtered = filtered.filter((entry) => entry.status === requestedStatus);
  }
  if (requestedTag) {
    filtered = filtered.filter((entry) => normalizeStringList(entry.tags).some((tag) => tag.toLowerCase() === requestedTag));
  }
  if (requestedOntology) {
    filtered = filtered.filter((entry) => normalizeOntologyTags(entry.ontology_tags).includes(requestedOntology));
  }
  if (minQuality !== null) {
    filtered = filtered.filter((entry) => Number(entry.quality_score || 0) >= minQuality);
  }

  filtered.sort((left, right) => {
    const qualityDiff = Number(right.quality_score || 0) - Number(left.quality_score || 0);
    if (qualityDiff !== 0) {
      return qualityDiff;
    }
    return `${right.updated_at}`.localeCompare(`${left.updated_at}`);
  });

  const result = {
    mode: 'errorbook-list',
    total_entries: index.entries.length,
    total_results: filtered.length,
    entries: filtered.slice(0, limit).map((entry) => ({
      ...entry,
      tags: normalizeStringList(entry.tags),
      ontology_tags: normalizeOntologyTags(entry.ontology_tags)
    }))
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    printListSummary(result);
  }

  return result;
}

async function runErrorbookShowCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveErrorbookPaths(projectPath);
  const index = await readErrorbookIndex(paths, fileSystem);

  const id = normalizeText(options.id || options.entryId);
  if (!id) {
    throw new Error('entry id is required');
  }

  const summary = findSummaryById(index, id);
  if (!summary) {
    throw new Error(`errorbook entry not found: ${id}`);
  }

  const entry = await readErrorbookEntry(paths, summary.id, fileSystem);
  if (!entry) {
    throw new Error(`errorbook entry file not found: ${summary.id}`);
  }

  const result = {
    mode: 'errorbook-show',
    entry
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    console.log(chalk.cyan.bold(entry.title));
    console.log(chalk.gray(`id: ${entry.id}`));
    console.log(chalk.gray(`status: ${entry.status}`));
    console.log(chalk.gray(`quality: ${entry.quality_score}`));
    console.log(chalk.gray(`fingerprint: ${entry.fingerprint}`));
    console.log(chalk.gray(`symptom: ${entry.symptom}`));
    console.log(chalk.gray(`root_cause: ${entry.root_cause}`));
    console.log(chalk.gray(`fix_actions: ${entry.fix_actions.join(' | ')}`));
    console.log(chalk.gray(`verification: ${entry.verification_evidence.join(' | ') || '(none)'}`));
    console.log(chalk.gray(`ontology: ${entry.ontology_tags.join(', ') || '(none)'}`));
  }

  return result;
}

async function runErrorbookFindCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveErrorbookPaths(projectPath);
  const index = await readErrorbookIndex(paths, fileSystem);

  const query = normalizeText(options.query);
  if (!query) {
    throw new Error('--query is required');
  }

  const requestedStatus = options.status ? normalizeStatus(options.status) : null;
  const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Number(options.limit)
    : 10;
  const tokens = query.toLowerCase().split(/[\s,;|]+/).map((item) => item.trim()).filter(Boolean);

  const candidates = [];
  for (const summary of index.entries) {
    if (requestedStatus && summary.status !== requestedStatus) {
      continue;
    }
    const entry = await readErrorbookEntry(paths, summary.id, fileSystem);
    if (!entry) {
      continue;
    }
    const matchScore = scoreSearchMatch(entry, tokens);
    if (matchScore <= 0) {
      continue;
    }
    candidates.push({
      id: entry.id,
      status: entry.status,
      quality_score: entry.quality_score,
      title: entry.title,
      fingerprint: entry.fingerprint,
      tags: normalizeStringList(entry.tags),
      ontology_tags: normalizeOntologyTags(entry.ontology_tags),
      match_score: matchScore,
      updated_at: entry.updated_at
    });
  }

  candidates.sort((left, right) => {
    const scoreDiff = Number(right.match_score) - Number(left.match_score);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return `${right.updated_at}`.localeCompare(`${left.updated_at}`);
  });

  const result = {
    mode: 'errorbook-find',
    query,
    total_results: candidates.length,
    entries: candidates.slice(0, limit)
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    printListSummary({
      entries: result.entries,
      total_results: result.total_results,
      total_entries: index.entries.length
    });
  }

  return result;
}

async function runErrorbookPromoteCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const paths = resolveErrorbookPaths(projectPath);
  const index = await readErrorbookIndex(paths, fileSystem);

  const id = normalizeText(options.id || options.entryId);
  if (!id) {
    throw new Error('entry id is required');
  }

  const summary = findSummaryById(index, id);
  if (!summary) {
    throw new Error(`errorbook entry not found: ${id}`);
  }

  const entry = await readErrorbookEntry(paths, summary.id, fileSystem);
  if (!entry) {
    throw new Error(`errorbook entry file not found: ${summary.id}`);
  }

  entry.quality_score = scoreQuality(entry);
  const missing = validatePromoteCandidate(entry, DEFAULT_PROMOTE_MIN_QUALITY);
  if (missing.length > 0) {
    throw new Error(`promote gate failed: ${missing.join(', ')}`);
  }

  entry.status = 'promoted';
  entry.promoted_at = nowIso();
  entry.updated_at = entry.promoted_at;
  await writeErrorbookEntry(paths, entry, fileSystem);

  const updatedSummary = buildIndexSummary(entry);
  const targetIndex = index.entries.findIndex((item) => item.id === entry.id);
  if (targetIndex >= 0) {
    index.entries[targetIndex] = updatedSummary;
  } else {
    index.entries.push(updatedSummary);
  }
  index.entries.sort((left, right) => `${right.updated_at}`.localeCompare(`${left.updated_at}`));
  await writeErrorbookIndex(paths, index, fileSystem);

  const result = {
    mode: 'errorbook-promote',
    promoted: true,
    entry
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    console.log(chalk.green('✓ Promoted errorbook entry'));
    console.log(chalk.gray(`  id: ${entry.id}`));
    console.log(chalk.gray(`  quality: ${entry.quality_score}`));
    console.log(chalk.gray(`  promoted_at: ${entry.promoted_at}`));
  }

  return result;
}

function collectOptionValue(value, previous = []) {
  const next = Array.isArray(previous) ? previous : [];
  next.push(value);
  return next;
}

function emitCommandError(error, json) {
  if (json) {
    console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
  } else {
    console.error(chalk.red('Error:'), error.message);
  }
  process.exit(1);
}

function registerErrorbookCommands(program) {
  const errorbook = program
    .command('errorbook')
    .description('Curated failure-remediation knowledge base');

  errorbook
    .command('record')
    .description('Record a high-signal failure remediation entry')
    .option('--title <text>', 'Entry title')
    .option('--symptom <text>', 'Observed symptom')
    .option('--root-cause <text>', 'Validated root cause')
    .option('--fix-action <text>', 'Concrete fix action (repeatable)', collectOptionValue, [])
    .option('--verification <text>', 'Verification evidence (repeatable)', collectOptionValue, [])
    .option('--tags <csv>', 'Tags, comma-separated')
    .option('--ontology <csv>', `Ontology focus tags (${ERRORBOOK_ONTOLOGY_TAGS.join(', ')})`)
    .option('--status <status>', 'candidate|verified', 'candidate')
    .option('--fingerprint <text>', 'Custom deduplication fingerprint')
    .option('--from <path>', 'Load payload from JSON file')
    .option('--spec <spec>', 'Related spec id/name')
    .option('--json', 'Emit machine-readable JSON')
    .action(async (options) => {
      try {
        await runErrorbookRecordCommand(options);
      } catch (error) {
        emitCommandError(error, options.json);
      }
    });

  errorbook
    .command('list')
    .description('List curated errorbook entries')
    .option('--status <status>', `Filter by status (${ERRORBOOK_STATUSES.join(', ')})`)
    .option('--tag <tag>', 'Filter by tag')
    .option('--ontology <tag>', `Filter by ontology tag (${ERRORBOOK_ONTOLOGY_TAGS.join(', ')})`)
    .option('--min-quality <n>', 'Minimum quality score', parseInt)
    .option('--limit <n>', 'Maximum entries returned', parseInt, 20)
    .option('--json', 'Emit machine-readable JSON')
    .action(async (options) => {
      try {
        await runErrorbookListCommand(options);
      } catch (error) {
        emitCommandError(error, options.json);
      }
    });

  errorbook
    .command('show <id>')
    .description('Show a single errorbook entry')
    .option('--json', 'Emit machine-readable JSON')
    .action(async (id, options) => {
      try {
        await runErrorbookShowCommand({ ...options, id });
      } catch (error) {
        emitCommandError(error, options.json);
      }
    });

  errorbook
    .command('find')
    .description('Search curated entries with ranking')
    .requiredOption('--query <text>', 'Search query')
    .option('--status <status>', `Filter by status (${ERRORBOOK_STATUSES.join(', ')})`)
    .option('--limit <n>', 'Maximum entries returned', parseInt, 10)
    .option('--json', 'Emit machine-readable JSON')
    .action(async (options) => {
      try {
        await runErrorbookFindCommand(options);
      } catch (error) {
        emitCommandError(error, options.json);
      }
    });

  errorbook
    .command('promote <id>')
    .description('Promote entry after strict quality gate')
    .option('--json', 'Emit machine-readable JSON')
    .action(async (id, options) => {
      try {
        await runErrorbookPromoteCommand({ ...options, id });
      } catch (error) {
        emitCommandError(error, options.json);
      }
    });
}

module.exports = {
  ERRORBOOK_STATUSES,
  ERRORBOOK_ONTOLOGY_TAGS,
  DEFAULT_PROMOTE_MIN_QUALITY,
  resolveErrorbookPaths,
  normalizeOntologyTags,
  normalizeRecordPayload,
  scoreQuality,
  runErrorbookRecordCommand,
  runErrorbookListCommand,
  runErrorbookShowCommand,
  runErrorbookFindCommand,
  runErrorbookPromoteCommand,
  registerErrorbookCommands
};
