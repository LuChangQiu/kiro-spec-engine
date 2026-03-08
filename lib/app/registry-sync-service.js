const path = require('path');
const fs = require('fs-extra');
const { loadAppRegistryConfig } = require('./registry-config');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

async function readJsonResource(resourceRef, dependencies = {}) {
  const fileSystem = dependencies.fileSystem || fs;
  const fetchImpl = dependencies.fetchImpl || global.fetch;
  const normalized = normalizeString(resourceRef);
  if (!normalized) {
    throw new Error('resource reference is required');
  }
  if (/^https?:\/\//i.test(normalized)) {
    if (typeof fetchImpl !== 'function') {
      throw new Error(`fetch unavailable for remote resource: ${normalized}`);
    }
    const response = await fetchImpl(normalized);
    if (!response || response.ok !== true) {
      const status = response && typeof response.status !== 'undefined' ? response.status : 'unknown';
      throw new Error(`failed to fetch ${normalized} (status=${status})`);
    }
    return response.json();
  }
  const resolvedPath = path.isAbsolute(normalized)
    ? normalized
    : path.join(dependencies.projectPath || process.cwd(), normalized);
  return fileSystem.readJson(resolvedPath);
}

function resolveChildResource(parentRef, childRef) {
  const normalizedParent = normalizeString(parentRef);
  const normalizedChild = normalizeString(childRef);
  if (!normalizedChild) {
    return normalizedParent;
  }
  if (/^https?:\/\//i.test(normalizedChild) || path.isAbsolute(normalizedChild)) {
    return normalizedChild;
  }
  if (/^https?:\/\//i.test(normalizedParent)) {
    return new URL(normalizedChild, normalizedParent).toString();
  }
  return path.join(path.dirname(normalizedParent), normalizedChild);
}

function graphToRegisterPayload(graph = {}) {
  const bundle = graph.bundle || {};
  const runtimeRelease = graph.runtime_release || {};
  const ontologyBundle = graph.ontology_bundle || {};
  const engineeringProject = graph.engineering_project || {};
  return {
    app_id: bundle.app_id,
    app_key: bundle.app_key,
    app_name: bundle.app_name,
    app_slug: bundle.app_slug || undefined,
    workspace_id: bundle.workspace_id || undefined,
    runtime_release_id: bundle.runtime_release_id || undefined,
    ontology_bundle_id: bundle.ontology_bundle_id || undefined,
    engineering_project_id: bundle.engineering_project_id || undefined,
    default_scene_id: bundle.default_scene_id || undefined,
    environment: bundle.environment || undefined,
    status: bundle.status || undefined,
    source_origin: bundle.source_origin || undefined,
    tags: Array.isArray(bundle.tags) ? bundle.tags : [],
    metadata: bundle.metadata && typeof bundle.metadata === 'object' ? { ...bundle.metadata } : {},
    runtime: runtimeRelease && runtimeRelease.release_id ? {
      release_id: runtimeRelease.release_id,
      runtime_version: runtimeRelease.runtime_version,
      release_channel: runtimeRelease.release_channel,
      release_status: runtimeRelease.release_status,
      entrypoint: runtimeRelease.entrypoint,
      runtime_status: runtimeRelease.runtime_status,
      release_notes_file: runtimeRelease.release_notes_file,
      release_evidence_file: runtimeRelease.release_evidence_file,
      published_at: runtimeRelease.published_at,
      source_updated_at: runtimeRelease.source_updated_at,
      metadata: runtimeRelease.metadata || {}
    } : undefined,
    ontology: ontologyBundle && ontologyBundle.ontology_bundle_id ? {
      ontology_bundle_id: ontologyBundle.ontology_bundle_id,
      ontology_version: ontologyBundle.ontology_version,
      template_version: ontologyBundle.template_version,
      capability_catalog_version: ontologyBundle.capability_catalog_version,
      triad_revision: ontologyBundle.triad_revision,
      triad_status: ontologyBundle.triad_status,
      publish_readiness: ontologyBundle.publish_readiness,
      template_source: ontologyBundle.template_source,
      capability_set: Array.isArray(ontologyBundle.capability_set) ? ontologyBundle.capability_set : [],
      summary: ontologyBundle.summary || {},
      metadata: ontologyBundle.metadata || {}
    } : undefined,
    engineering: engineeringProject && engineeringProject.engineering_project_id ? {
      engineering_project_id: engineeringProject.engineering_project_id,
      project_key: engineeringProject.project_key,
      project_name: engineeringProject.project_name,
      repo_url: engineeringProject.repo_url,
      repo_provider: engineeringProject.repo_provider,
      default_branch: engineeringProject.default_branch,
      current_branch: engineeringProject.current_branch,
      commit_sha: engineeringProject.commit_sha,
      workspace_path: engineeringProject.workspace_path,
      code_version: engineeringProject.code_version,
      synced_runtime_release_id: engineeringProject.synced_runtime_release_id,
      dirty_state: engineeringProject.dirty_state === true,
      auth_policy: engineeringProject.auth_policy || {},
      metadata: engineeringProject.metadata || {}
    } : undefined,
    scene_bindings: Array.isArray(graph.scene_bindings)
      ? graph.scene_bindings.map((item) => ({
        scene_id: item.scene_id,
        binding_role: item.binding_role,
        source: item.source,
        metadata: item.metadata || {}
      }))
      : []
  };
}

async function syncBundleRegistry(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const stateStore = dependencies.stateStore;
  const loadedConfig = await loadAppRegistryConfig(projectPath, fileSystem);
  const indexRef = normalizeString(options.indexUrl) || normalizeString(loadedConfig.config.bundle_registry.index_url);
  const indexPayload = await readJsonResource(indexRef, dependencies);
  const bundleItems = Array.isArray(indexPayload && indexPayload.bundles) ? indexPayload.bundles : [];
  const synced = [];
  for (const item of bundleItems) {
    const resourceRef = normalizeString(item && item.url) || resolveChildResource(indexRef, item && item.file);
    const bundlePayload = await readJsonResource(resourceRef, dependencies);
    const graph = await stateStore.registerAppBundle(bundlePayload);
    synced.push({
      app_id: graph && graph.bundle ? graph.bundle.app_id : null,
      app_key: graph && graph.bundle ? graph.bundle.app_key : null,
      source: resourceRef
    });
  }
  return {
    mode: 'app-registry-sync-bundles',
    index_url: indexRef,
    source_generated_at: indexPayload && indexPayload.generated_at ? indexPayload.generated_at : null,
    synced_count: synced.length,
    items: synced
  };
}

async function syncServiceCatalog(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const stateStore = dependencies.stateStore;
  const loadedConfig = await loadAppRegistryConfig(projectPath, fileSystem);
  const indexRef = normalizeString(options.indexUrl) || normalizeString(loadedConfig.config.service_catalog.index_url);
  const indexPayload = await readJsonResource(indexRef, dependencies);
  const appItems = Array.isArray(indexPayload && indexPayload.apps) ? indexPayload.apps : [];
  const synced = [];
  for (const item of appItems) {
    const resourceRef = normalizeString(item && item.url) || resolveChildResource(indexRef, item && item.file);
    const appPayload = await readJsonResource(resourceRef, dependencies);
    const appId = normalizeString(appPayload && appPayload.app_id);
    const appKey = normalizeString(appPayload && appPayload.app_key);
    const appName = normalizeString(appPayload && appPayload.app_name);
    let graph = await stateStore.getAppBundleGraph(appId || appKey);
    if (!graph) {
      graph = await stateStore.registerAppBundle({
        app_id: appId,
        app_key: appKey,
        app_name: appName || appKey || appId,
        status: 'active',
        environment: normalizeString(appPayload && appPayload.environment) || null,
        source_origin: 'app-service-catalog-sync'
      });
    }
    const nextPayload = graphToRegisterPayload(graph);
    const releases = Array.isArray(appPayload && appPayload.releases) ? appPayload.releases : [];
    const defaultReleaseId = normalizeString(appPayload && appPayload.default_release_id) || (releases[0] && normalizeString(releases[0].release_id)) || null;
    const activeRelease = releases.find((entry) => normalizeString(entry && entry.release_id) === defaultReleaseId) || releases[0] || null;
    nextPayload.metadata = nextPayload.metadata || {};
    nextPayload.metadata.service_catalog = {
      synced_at: new Date().toISOString(),
      source: resourceRef,
      app_name: appName || null,
      default_release_id: defaultReleaseId,
      releases
    };
    if (activeRelease) {
      nextPayload.runtime_release_id = normalizeString(activeRelease.release_id);
      nextPayload.runtime = {
        release_id: normalizeString(activeRelease.release_id),
        runtime_version: normalizeString(activeRelease.runtime_version),
        release_channel: normalizeString(activeRelease.release_channel) || null,
        release_status: normalizeString(activeRelease.release_status) || 'published',
        entrypoint: normalizeString(activeRelease.entrypoint) || null,
        runtime_status: normalizeString(activeRelease.runtime_status) || null,
        release_notes_file: normalizeString(activeRelease.release_notes_file) || null,
        release_evidence_file: normalizeString(activeRelease.release_evidence_file) || null,
        published_at: normalizeString(activeRelease.published_at) || null,
        metadata: activeRelease.metadata && typeof activeRelease.metadata === 'object' ? activeRelease.metadata : {}
      };
    }
    const updated = await stateStore.registerAppBundle(nextPayload);
    synced.push({
      app_id: updated && updated.bundle ? updated.bundle.app_id : appId,
      app_key: updated && updated.bundle ? updated.bundle.app_key : appKey,
      source: resourceRef,
      release_count: releases.length,
      default_release_id: defaultReleaseId || null
    });
  }
  return {
    mode: 'app-registry-sync-service-catalog',
    index_url: indexRef,
    source_generated_at: indexPayload && indexPayload.generated_at ? indexPayload.generated_at : null,
    synced_count: synced.length,
    items: synced
  };
}

module.exports = {
  readJsonResource,
  resolveChildResource,
  syncBundleRegistry,
  syncServiceCatalog
};
