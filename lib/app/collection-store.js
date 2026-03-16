const path = require('path');
const fs = require('fs-extra');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function normalizeCollectionItem(item = {}) {
  return {
    app_id: normalizeString(item.app_id || item.appId) || null,
    app_key: normalizeString(item.app_key || item.appKey) || null,
    required: normalizeBoolean(item.required, false),
    allow_local_remove: normalizeBoolean(item.allow_local_remove ?? item.allowLocalRemove, true),
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : null,
    default_entry: normalizeString(item.default_entry || item.defaultEntry) || null,
    capability_tags: normalizeStringArray(item.capability_tags || item.capabilityTags),
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  };
}

function normalizeAppCollection(raw = {}, filePath = '') {
  const fileName = normalizeString(path.basename(filePath, path.extname(filePath)));
  const collectionId = normalizeString(raw.collection_id || raw.collectionId || raw.id) || fileName;
  if (!collectionId) {
    throw new Error(`invalid app collection file: missing collection_id (${filePath})`);
  }
  const items = Array.isArray(raw.items)
    ? raw.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => normalizeCollectionItem(item))
      .filter((item) => item.app_id || item.app_key)
    : [];

  return {
    collection_id: collectionId,
    name: normalizeString(raw.name) || collectionId,
    description: normalizeString(raw.description) || null,
    status: normalizeString(raw.status) || 'active',
    tags: normalizeStringArray(raw.tags),
    item_count: items.length,
    items,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    source_file: filePath
  };
}

async function listAppCollections(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem || fs;
  const collectionsDir = path.join(projectPath, '.sce', 'app', 'collections');
  if (!await fileSystem.pathExists(collectionsDir)) {
    return [];
  }

  const entries = await fileSystem.readdir(collectionsDir);
  const query = normalizeString(options.query).toLowerCase();
  const status = normalizeString(options.status);
  const normalized = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.json')) {
      continue;
    }
    const absolutePath = path.join(collectionsDir, entry);
    const raw = await fileSystem.readJson(absolutePath);
    const collection = normalizeAppCollection(raw, absolutePath);
    if (status && collection.status !== status) {
      continue;
    }
    if (query) {
      const haystack = [
        collection.collection_id,
        collection.name,
        collection.description,
        ...collection.tags
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) {
        continue;
      }
    }
    normalized.push(collection);
  }

  normalized.sort((left, right) => left.collection_id.localeCompare(right.collection_id));
  return normalized;
}

async function getAppCollection(projectPath = process.cwd(), collectionRef = '', options = {}) {
  const normalizedRef = normalizeString(collectionRef);
  if (!normalizedRef) {
    return null;
  }
  const collections = await listAppCollections(projectPath, options);
  return collections.find((item) => item.collection_id === normalizedRef || path.basename(item.source_file, '.json') === normalizedRef) || null;
}

module.exports = {
  normalizeAppCollection,
  listAppCollections,
  getAppCollection
};
