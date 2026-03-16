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

function normalizeWorkspaceItem(item = {}) {
  return {
    app_id: normalizeString(item.app_id || item.appId) || null,
    app_key: normalizeString(item.app_key || item.appKey) || null,
    collection_id: normalizeString(item.collection_id || item.collectionId) || null,
    required: normalizeBoolean(item.required, false),
    allow_local_remove: normalizeBoolean(item.allow_local_remove ?? item.allowLocalRemove, true),
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : null,
    default_entry: normalizeString(item.default_entry || item.defaultEntry) || null,
    capability_tags: normalizeStringArray(item.capability_tags || item.capabilityTags),
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  };
}

function normalizeSceneWorkspace(raw = {}, filePath = '') {
  const fileName = normalizeString(path.basename(filePath, path.extname(filePath)));
  const workspaceId = normalizeString(raw.workspace_id || raw.workspaceId || raw.scene_profile_id || raw.sceneProfileId || raw.id) || fileName;
  if (!workspaceId) {
    throw new Error(`invalid scene workspace file: missing workspace_id (${filePath})`);
  }
  const items = Array.isArray(raw.items)
    ? raw.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => normalizeWorkspaceItem(item))
      .filter((item) => item.app_id || item.app_key || item.collection_id)
    : [];

  return {
    workspace_id: workspaceId,
    name: normalizeString(raw.name) || workspaceId,
    description: normalizeString(raw.description) || null,
    status: normalizeString(raw.status) || 'active',
    tags: normalizeStringArray(raw.tags),
    collection_refs: normalizeStringArray(raw.collection_refs || raw.collectionRefs || raw.collections),
    default_entry: normalizeString(raw.default_entry || raw.defaultEntry) || null,
    layout_hint: normalizeString(raw.layout_hint || raw.layoutHint) || null,
    item_count: items.length,
    items,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    source_file: filePath
  };
}

async function listSceneWorkspaces(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem || fs;
  const workspaceDir = path.join(projectPath, '.sce', 'app', 'scene-profiles');
  if (!await fileSystem.pathExists(workspaceDir)) {
    return [];
  }

  const entries = await fileSystem.readdir(workspaceDir);
  const query = normalizeString(options.query).toLowerCase();
  const status = normalizeString(options.status);
  const normalized = [];

  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.json')) {
      continue;
    }
    const absolutePath = path.join(workspaceDir, entry);
    const raw = await fileSystem.readJson(absolutePath);
    const workspace = normalizeSceneWorkspace(raw, absolutePath);
    if (status && workspace.status !== status) {
      continue;
    }
    if (query) {
      const haystack = [
        workspace.workspace_id,
        workspace.name,
        workspace.description,
        ...workspace.tags,
        ...workspace.collection_refs
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) {
        continue;
      }
    }
    normalized.push(workspace);
  }

  normalized.sort((left, right) => left.workspace_id.localeCompare(right.workspace_id));
  return normalized;
}

async function getSceneWorkspace(projectPath = process.cwd(), workspaceRef = '', options = {}) {
  const normalizedRef = normalizeString(workspaceRef);
  if (!normalizedRef) {
    return null;
  }
  const workspaces = await listSceneWorkspaces(projectPath, options);
  return workspaces.find((item) => item.workspace_id === normalizedRef || path.basename(item.source_file, '.json') === normalizedRef) || null;
}

module.exports = {
  normalizeSceneWorkspace,
  listSceneWorkspaces,
  getSceneWorkspace
};
