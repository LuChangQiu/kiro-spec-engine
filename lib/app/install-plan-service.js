const { getAppCollection } = require('./collection-store');
const { getSceneWorkspace } = require('./scene-workspace-store');

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

function getBundleRuntimeState(bundle = {}) {
  const metadata = bundle.metadata && typeof bundle.metadata === 'object' ? bundle.metadata : {};
  const installation = metadata.runtime_installation && typeof metadata.runtime_installation === 'object'
    ? metadata.runtime_installation
    : {};
  const runtimeActivation = metadata.runtime_activation && typeof metadata.runtime_activation === 'object'
    ? metadata.runtime_activation
    : {};
  const installStatus = normalizeString(installation.status) || 'not-installed';
  const installedReleaseId = installStatus === 'installed'
    ? (normalizeString(installation.release_id) || null)
    : null;
  const activeReleaseId = normalizeString(
    bundle.runtime_release_id || runtimeActivation.active_release_id
  ) || null;
  return {
    install_status: installStatus,
    installed_release_id: installedReleaseId,
    active_release_id: activeReleaseId
  };
}

function desiredKeyFromItem(item = {}) {
  return normalizeString(item.app_id) || normalizeString(item.app_key);
}

function mergeDesiredItem(target = {}, incoming = {}, sourceRef = '') {
  const sources = normalizeStringArray([...(target.sources || []), sourceRef]);
  const capabilityTags = normalizeStringArray([
    ...(target.capability_tags || []),
    ...(incoming.capability_tags || [])
  ]);
  const numericPriority = [target.priority, incoming.priority]
    .filter((value) => Number.isFinite(Number(value)))
    .map((value) => Number(value));
  return {
    app_id: normalizeString(target.app_id) || normalizeString(incoming.app_id) || null,
    app_key: normalizeString(target.app_key) || normalizeString(incoming.app_key) || null,
    required: Boolean(target.required || incoming.required),
    allow_local_remove: target.allow_local_remove === false || incoming.allow_local_remove === false ? false : true,
    priority: numericPriority.length > 0 ? Math.min(...numericPriority) : null,
    default_entry: normalizeString(target.default_entry) || normalizeString(incoming.default_entry) || null,
    capability_tags: capabilityTags,
    metadata: {
      ...(target.metadata && typeof target.metadata === 'object' ? target.metadata : {}),
      ...(incoming.metadata && typeof incoming.metadata === 'object' ? incoming.metadata : {})
    },
    sources
  };
}

function createBundleIndex(bundles = []) {
  const byId = new Map();
  const byKey = new Map();
  for (const bundle of bundles) {
    const appId = normalizeString(bundle.app_id);
    const appKey = normalizeString(bundle.app_key);
    if (appId) {
      byId.set(appId, bundle);
    }
    if (appKey) {
      byKey.set(appKey, bundle);
    }
  }
  return { byId, byKey };
}

function matchesDeviceCapabilities(item = {}, currentDevice = {}) {
  const requiredTags = normalizeStringArray(item.capability_tags || []);
  if (requiredTags.length === 0) {
    return true;
  }
  const deviceTags = new Set(normalizeStringArray(currentDevice.capability_tags || []));
  return requiredTags.some((tag) => deviceTags.has(tag));
}

function buildDesiredActionEntry(item = {}, bundle = null, currentDevice = {}) {
  if (!matchesDeviceCapabilities(item, currentDevice)) {
    return {
      app_id: item.app_id || null,
      app_key: item.app_key || null,
      app_name: bundle && bundle.app_name ? bundle.app_name : null,
      decision: 'skip',
      reason: 'device-capability-mismatch',
      install_status: bundle ? getBundleRuntimeState(bundle).install_status : 'unknown',
      installed_release_id: bundle ? getBundleRuntimeState(bundle).installed_release_id : null,
      active_release_id: bundle ? getBundleRuntimeState(bundle).active_release_id : null,
      required: item.required === true,
      sources: item.sources || []
    };
  }
  const runtimeState = getBundleRuntimeState(bundle || {});
  if (!bundle) {
    return {
      app_id: item.app_id || null,
      app_key: item.app_key || null,
      app_name: null,
      decision: 'skip',
      reason: 'app-bundle-not-found',
      install_status: 'unknown',
      installed_release_id: null,
      active_release_id: null,
      required: item.required === true,
      sources: item.sources || []
    };
  }
  if (runtimeState.install_status !== 'installed') {
    return {
      app_id: bundle.app_id || null,
      app_key: bundle.app_key || null,
      app_name: bundle.app_name || null,
      decision: 'install',
      reason: 'desired-app-not-installed',
      install_status: runtimeState.install_status,
      installed_release_id: runtimeState.installed_release_id,
      active_release_id: runtimeState.active_release_id,
      required: item.required === true,
      sources: item.sources || []
    };
  }
  if (runtimeState.installed_release_id && runtimeState.active_release_id !== runtimeState.installed_release_id) {
    return {
      app_id: bundle.app_id || null,
      app_key: bundle.app_key || null,
      app_name: bundle.app_name || null,
      decision: 'activate',
      reason: 'installed-release-not-active',
      install_status: runtimeState.install_status,
      installed_release_id: runtimeState.installed_release_id,
      active_release_id: runtimeState.active_release_id,
      required: item.required === true,
      sources: item.sources || []
    };
  }
  return {
    app_id: bundle.app_id || null,
    app_key: bundle.app_key || null,
    app_name: bundle.app_name || null,
    decision: 'keep',
    reason: 'desired-app-already-installed',
    install_status: runtimeState.install_status,
    installed_release_id: runtimeState.installed_release_id,
    active_release_id: runtimeState.active_release_id,
    required: item.required === true,
    sources: item.sources || []
  };
}

function buildRemovalAction(bundle = {}) {
  const runtimeState = getBundleRuntimeState(bundle);
  if (runtimeState.install_status !== 'installed') {
    return {
      app_id: bundle.app_id || null,
      app_key: bundle.app_key || null,
      app_name: bundle.app_name || null,
      decision: 'keep',
      reason: 'not-desired-and-not-installed',
      install_status: runtimeState.install_status,
      installed_release_id: runtimeState.installed_release_id,
      active_release_id: runtimeState.active_release_id,
      required: false,
      sources: []
    };
  }
  if (runtimeState.active_release_id && runtimeState.active_release_id === runtimeState.installed_release_id) {
    return {
      app_id: bundle.app_id || null,
      app_key: bundle.app_key || null,
      app_name: bundle.app_name || null,
      decision: 'skip',
      reason: 'active-release-protected',
      install_status: runtimeState.install_status,
      installed_release_id: runtimeState.installed_release_id,
      active_release_id: runtimeState.active_release_id,
      required: false,
      sources: []
    };
  }
  return {
    app_id: bundle.app_id || null,
    app_key: bundle.app_key || null,
    app_name: bundle.app_name || null,
    decision: 'uninstall',
    reason: 'not-desired-on-current-device',
    install_status: runtimeState.install_status,
    installed_release_id: runtimeState.installed_release_id,
    active_release_id: runtimeState.active_release_id,
    required: false,
    sources: []
  };
}

async function expandCollectionDefinition(projectPath, collectionRef, fileSystem, desiredMap, unresolvedCollections, sourceRef) {
  const collection = await getAppCollection(projectPath, collectionRef, { fileSystem });
  if (!collection) {
    unresolvedCollections.push(collectionRef);
    return null;
  }
  for (const item of collection.items) {
    const key = desiredKeyFromItem(item);
    if (!key) {
      continue;
    }
    desiredMap.set(key, mergeDesiredItem(desiredMap.get(key), item, sourceRef || `collection:${collection.collection_id}`));
  }
  return collection;
}

function applyDeviceOverride(desiredMap = new Map(), deviceOverride = {}) {
  const removedRefs = normalizeStringArray(deviceOverride.removed_apps || []);
  for (const removedRef of removedRefs) {
    desiredMap.delete(removedRef);
    for (const [key, item] of desiredMap.entries()) {
      if (normalizeString(item.app_id) === removedRef || normalizeString(item.app_key) === removedRef) {
        desiredMap.delete(key);
      }
    }
  }

  const addedApps = Array.isArray(deviceOverride.added_apps) ? deviceOverride.added_apps : [];
  for (const item of addedApps) {
    const key = desiredKeyFromItem(item);
    if (!key) {
      continue;
    }
    desiredMap.set(key, mergeDesiredItem(desiredMap.get(key), item, 'device-override:add'));
  }
}

function summarizeActions(actions = []) {
  const counts = {
    install: 0,
    uninstall: 0,
    activate: 0,
    keep: 0,
    skip: 0
  };
  for (const item of actions) {
    const key = normalizeString(item.decision);
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] += 1;
    }
  }
  return counts;
}

async function buildCollectionApplyPlan(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem;
  const store = options.store;
  const currentDevice = options.currentDevice || {};
  const deviceOverride = options.deviceOverride || {};
  const collectionRef = normalizeString(options.collectionRef);
  const collection = await getAppCollection(projectPath, collectionRef, { fileSystem });
  if (!collection) {
    throw new Error(`app collection not found: ${collectionRef}`);
  }
  const desiredMap = new Map();
  for (const item of collection.items) {
    const key = desiredKeyFromItem(item);
    if (!key) {
      continue;
    }
    desiredMap.set(key, mergeDesiredItem(desiredMap.get(key), item, `collection:${collection.collection_id}`));
  }
  applyDeviceOverride(desiredMap, deviceOverride);

  const bundles = await store.listAppBundles({ limit: 1000 });
  const bundleIndex = createBundleIndex(Array.isArray(bundles) ? bundles : []);
  const actions = [];
  const desiredBundleIds = new Set();

  for (const desired of desiredMap.values()) {
    const bundle = bundleIndex.byId.get(normalizeString(desired.app_id)) || bundleIndex.byKey.get(normalizeString(desired.app_key)) || null;
    if (bundle && bundle.app_id) {
      desiredBundleIds.add(bundle.app_id);
    }
    actions.push(buildDesiredActionEntry(desired, bundle, currentDevice));
  }

  for (const bundle of Array.isArray(bundles) ? bundles : []) {
    if (desiredBundleIds.has(bundle.app_id)) {
      continue;
    }
    const removal = buildRemovalAction(bundle);
    if (removal.decision === 'keep' && removal.reason === 'not-desired-and-not-installed') {
      continue;
    }
    actions.push(removal);
  }

  const counts = summarizeActions(actions);
  return {
    source: {
      type: 'app-collection',
      id: collection.collection_id,
      name: collection.name
    },
    current_device: currentDevice,
    device_override: deviceOverride,
    desired_apps: [...desiredMap.values()],
    unresolved_collections: [],
    unresolved_apps: actions.filter((item) => item.reason === 'app-bundle-not-found').map((item) => item.app_id || item.app_key),
    actions,
    counts
  };
}

async function buildSceneWorkspaceApplyPlan(projectPath = process.cwd(), options = {}) {
  const fileSystem = options.fileSystem;
  const store = options.store;
  const currentDevice = options.currentDevice || {};
  const deviceOverride = options.deviceOverride || {};
  const workspaceRef = normalizeString(options.workspaceRef);
  const workspace = await getSceneWorkspace(projectPath, workspaceRef, { fileSystem });
  if (!workspace) {
    throw new Error(`scene workspace not found: ${workspaceRef}`);
  }

  const desiredMap = new Map();
  const unresolvedCollections = [];

  for (const collectionRef of workspace.collection_refs) {
    await expandCollectionDefinition(projectPath, collectionRef, fileSystem, desiredMap, unresolvedCollections, `workspace:${workspace.workspace_id}:collection:${collectionRef}`);
  }

  for (const item of workspace.items) {
    if (item.collection_id && !item.app_id && !item.app_key) {
      await expandCollectionDefinition(projectPath, item.collection_id, fileSystem, desiredMap, unresolvedCollections, `workspace:${workspace.workspace_id}:collection:${item.collection_id}`);
      continue;
    }
    const key = desiredKeyFromItem(item);
    if (!key) {
      continue;
    }
    desiredMap.set(key, mergeDesiredItem(desiredMap.get(key), item, `workspace:${workspace.workspace_id}`));
  }
  applyDeviceOverride(desiredMap, deviceOverride);

  const bundles = await store.listAppBundles({ limit: 1000 });
  const bundleIndex = createBundleIndex(Array.isArray(bundles) ? bundles : []);
  const actions = [];
  const desiredBundleIds = new Set();

  for (const desired of desiredMap.values()) {
    const bundle = bundleIndex.byId.get(normalizeString(desired.app_id)) || bundleIndex.byKey.get(normalizeString(desired.app_key)) || null;
    if (bundle && bundle.app_id) {
      desiredBundleIds.add(bundle.app_id);
    }
    actions.push(buildDesiredActionEntry(desired, bundle, currentDevice));
  }

  for (const bundle of Array.isArray(bundles) ? bundles : []) {
    if (desiredBundleIds.has(bundle.app_id)) {
      continue;
    }
    const removal = buildRemovalAction(bundle);
    if (removal.decision === 'keep' && removal.reason === 'not-desired-and-not-installed') {
      continue;
    }
    actions.push(removal);
  }

  const counts = summarizeActions(actions);
  return {
    source: {
      type: 'scene-workspace',
      id: workspace.workspace_id,
      name: workspace.name
    },
    current_device: currentDevice,
    device_override: deviceOverride,
    desired_apps: [...desiredMap.values()],
    unresolved_collections: normalizeStringArray(unresolvedCollections),
    unresolved_apps: actions.filter((item) => item.reason === 'app-bundle-not-found').map((item) => item.app_id || item.app_key),
    actions,
    counts
  };
}

module.exports = {
  buildCollectionApplyPlan,
  buildSceneWorkspaceApplyPlan
};
