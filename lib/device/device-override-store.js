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

function normalizeOverrideItem(item = {}) {
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

function overrideItemKey(item = {}) {
  return normalizeString(item.app_id) || normalizeString(item.app_key);
}

function normalizeDeviceOverride(raw = {}, filePath = null) {
  const addedApps = Array.isArray(raw.added_apps || raw.addedApps)
    ? (raw.added_apps || raw.addedApps)
      .filter((item) => item && typeof item === 'object')
      .map((item) => normalizeOverrideItem(item))
      .filter((item) => item.app_id || item.app_key)
    : [];

  const dedupedAddedApps = [];
  const seen = new Set();
  for (const item of addedApps) {
    const key = overrideItemKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    dedupedAddedApps.push(item);
  }

  return {
    removed_apps: normalizeStringArray(raw.removed_apps || raw.removedApps),
    added_apps: dedupedAddedApps,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    source_file: filePath
  };
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function mergeDeviceOverride(existing = {}, patch = {}, filePath = null) {
  const normalizedExisting = normalizeDeviceOverride(existing, filePath);
  const nextRaw = {
    removed_apps: normalizedExisting.removed_apps,
    added_apps: normalizedExisting.added_apps,
    metadata: normalizedExisting.metadata
  };

  if (hasOwn(patch, 'removed_apps') || hasOwn(patch, 'removedApps')) {
    nextRaw.removed_apps = patch.removed_apps || patch.removedApps;
  }

  if (hasOwn(patch, 'added_apps') || hasOwn(patch, 'addedApps')) {
    nextRaw.added_apps = patch.added_apps || patch.addedApps;
  }

  if (hasOwn(patch, 'metadata')) {
    const patchMetadata = patch.metadata && typeof patch.metadata === 'object' ? patch.metadata : {};
    nextRaw.metadata = {
      ...normalizedExisting.metadata,
      ...patchMetadata
    };
  }

  return normalizeDeviceOverride(nextRaw, filePath);
}

async function loadDeviceOverride(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem || fs;
  const filePath = options.filePath || path.join(projectPath, '.sce', 'state', 'device', 'device-override.json');
  if (!await fileSystem.pathExists(filePath)) {
    return normalizeDeviceOverride({}, null);
  }
  const raw = await fileSystem.readJson(filePath);
  return normalizeDeviceOverride(raw, filePath);
}

async function saveDeviceOverride(projectPath = process.cwd(), override = {}, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const filePath = options.filePath || path.join(projectPath, '.sce', 'state', 'device', 'device-override.json');
  const normalized = normalizeDeviceOverride(override, filePath);
  await fileSystem.ensureDir(path.dirname(filePath));
  await fileSystem.writeJson(filePath, {
    removed_apps: normalized.removed_apps,
    added_apps: normalized.added_apps,
    metadata: normalized.metadata
  }, { spaces: 2 });
  return normalizeDeviceOverride({
    removed_apps: normalized.removed_apps,
    added_apps: normalized.added_apps,
    metadata: normalized.metadata
  }, filePath);
}

async function upsertDeviceOverride(projectPath = process.cwd(), patch = {}, options = {}) {
  const fileSystem = options.fileSystem || fs;
  const filePath = options.filePath || path.join(projectPath, '.sce', 'state', 'device', 'device-override.json');
  const existing = await loadDeviceOverride(projectPath, {
    fileSystem,
    filePath
  });
  const merged = mergeDeviceOverride(existing, patch, filePath);
  return saveDeviceOverride(projectPath, merged, {
    fileSystem,
    filePath
  });
}

module.exports = {
  loadDeviceOverride,
  normalizeDeviceOverride,
  mergeDeviceOverride,
  saveDeviceOverride,
  upsertDeviceOverride
};
