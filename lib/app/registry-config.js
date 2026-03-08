const path = require('path');
const fs = require('fs-extra');

const DEFAULT_APP_REGISTRY_CONFIG_PATH = path.join('.sce', 'config', 'app-registries.json');

const DEFAULT_APP_REGISTRY_CONFIG = Object.freeze({
  version: '1.0',
  bundle_registry: {
    repo_url: 'https://github.com/heguangyong/magicball-app-bundle-registry.git',
    branch: 'main',
    index_url: 'https://raw.githubusercontent.com/heguangyong/magicball-app-bundle-registry/main/bundles/index.json'
  },
  service_catalog: {
    repo_url: 'https://github.com/heguangyong/magicball-app-service-catalog.git',
    branch: 'main',
    index_url: 'https://raw.githubusercontent.com/heguangyong/magicball-app-service-catalog/main/catalog/index.json'
  }
});

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function mergeSection(base = {}, patch = {}) {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch || {}).filter(([, value]) => value !== undefined)
    )
  };
}

async function loadAppRegistryConfig(projectPath = process.cwd(), fileSystem = fs) {
  const configPath = path.join(projectPath, DEFAULT_APP_REGISTRY_CONFIG_PATH);
  let filePayload = {};
  if (await fileSystem.pathExists(configPath)) {
    filePayload = await fileSystem.readJson(configPath);
  }
  return {
    config_path: DEFAULT_APP_REGISTRY_CONFIG_PATH,
    config: {
      version: normalizeString(filePayload.version) || DEFAULT_APP_REGISTRY_CONFIG.version,
      bundle_registry: mergeSection(DEFAULT_APP_REGISTRY_CONFIG.bundle_registry, filePayload.bundle_registry),
      service_catalog: mergeSection(DEFAULT_APP_REGISTRY_CONFIG.service_catalog, filePayload.service_catalog)
    }
  };
}

async function saveAppRegistryConfig(patch = {}, projectPath = process.cwd(), fileSystem = fs) {
  const loaded = await loadAppRegistryConfig(projectPath, fileSystem);
  const nextConfig = {
    version: DEFAULT_APP_REGISTRY_CONFIG.version,
    bundle_registry: mergeSection(loaded.config.bundle_registry, patch.bundle_registry),
    service_catalog: mergeSection(loaded.config.service_catalog, patch.service_catalog)
  };
  const configPath = path.join(projectPath, DEFAULT_APP_REGISTRY_CONFIG_PATH);
  await fileSystem.ensureDir(path.dirname(configPath));
  await fileSystem.writeJson(configPath, nextConfig, { spaces: 2 });
  return {
    config_path: DEFAULT_APP_REGISTRY_CONFIG_PATH,
    config: nextConfig
  };
}

module.exports = {
  DEFAULT_APP_REGISTRY_CONFIG_PATH,
  DEFAULT_APP_REGISTRY_CONFIG,
  loadAppRegistryConfig,
  saveAppRegistryConfig
};
