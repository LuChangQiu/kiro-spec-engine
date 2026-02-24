const path = require('path');
const fs = require('fs-extra');

const DEFAULT_BINDING_PLUGIN_DIRS = [
  '.sce/plugins/scene-bindings',
  '.sce/config/scene-bindings'
];
const DEFAULT_BINDING_PLUGIN_MANIFEST = '.sce/config/scene-binding-plugins.json';

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePath(projectRoot, targetPath) {
  if (!targetPath) {
    return null;
  }

  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return path.join(projectRoot, targetPath);
}

function normalizePluginFileToken(value) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) {
    return null;
  }

  return path.posix.basename(normalized);
}

function extractPluginDefinitions(exportedValue, filePath, warnings = []) {
  let value = exportedValue;

  if (value && isPlainObject(value) && value.__esModule && value.default) {
    value = value.default;
  }

  if (typeof value === 'function') {
    try {
      value = value();
    } catch (error) {
      warnings.push(`binding plugin factory failed: ${filePath} (${error.message})`);
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (isPlainObject(value)) {
    return [value];
  }

  warnings.push(`binding plugin export must be object/array/function: ${filePath}`);
  return [];
}

function normalizePluginHandler(handler, fallbackId) {
  if (!isPlainObject(handler) || typeof handler.execute !== 'function') {
    return null;
  }

  return {
    ...handler,
    id: handler.id || fallbackId
  };
}

function normalizePluginManifest(rawManifest, manifestPath, warnings = []) {
  if (!isPlainObject(rawManifest)) {
    warnings.push(`binding plugin manifest must be a JSON object: ${manifestPath}`);
    return null;
  }

  const strict = rawManifest.strict === true;
  const enabledByDefault = rawManifest.enabled_by_default !== false;
  const defaultPriority = Number.isFinite(rawManifest.default_priority) ? Number(rawManifest.default_priority) : 1000;

  const allowedFiles = new Set(
    (Array.isArray(rawManifest.allowed_files) ? rawManifest.allowed_files : [])
      .map(normalizePluginFileToken)
      .filter(Boolean)
  );

  const blockedFiles = new Set(
    (Array.isArray(rawManifest.blocked_files) ? rawManifest.blocked_files : [])
      .map(normalizePluginFileToken)
      .filter(Boolean)
  );

  const pluginEntries = new Map();

  if (Array.isArray(rawManifest.plugins)) {
    let order = 0;

    for (const entry of rawManifest.plugins) {
      order += 1;

      if (!isPlainObject(entry)) {
        warnings.push(`invalid plugin manifest entry ignored at index ${order}: ${manifestPath}`);
        continue;
      }

      const fileToken = normalizePluginFileToken(entry.file);
      if (!fileToken) {
        warnings.push(`plugin manifest entry missing file at index ${order}: ${manifestPath}`);
        continue;
      }

      pluginEntries.set(fileToken, {
        enabled: entry.enabled !== false,
        priority: Number.isFinite(entry.priority) ? Number(entry.priority) : defaultPriority,
        order
      });
    }
  }

  return {
    strict,
    enabledByDefault,
    defaultPriority,
    allowedFiles,
    blockedFiles,
    pluginEntries,
    manifestPath
  };
}

function loadPluginManifest(projectRoot, options = {}, warnings = []) {
  const manifestEnabled = options.manifestEnabled !== false;
  if (!manifestEnabled) {
    return {
      manifest: null,
      manifestPath: null,
      manifestLoaded: false
    };
  }

  const explicitManifestPath = typeof options.manifestPath === 'string' && options.manifestPath.trim().length > 0;
  const manifestPath = explicitManifestPath
    ? normalizePath(projectRoot, options.manifestPath)
    : path.join(projectRoot, DEFAULT_BINDING_PLUGIN_MANIFEST);

  if (!manifestPath || !fs.pathExistsSync(manifestPath)) {
    if (explicitManifestPath) {
      warnings.push(`binding plugin manifest not found: ${manifestPath}`);
    }

    return {
      manifest: null,
      manifestPath: explicitManifestPath ? manifestPath : null,
      manifestLoaded: false
    };
  }

  try {
    const rawManifest = fs.readJsonSync(manifestPath);
    const manifest = normalizePluginManifest(rawManifest, manifestPath, warnings);

    if (!manifest) {
      return {
        manifest: null,
        manifestPath,
        manifestLoaded: false
      };
    }

    return {
      manifest,
      manifestPath,
      manifestLoaded: true
    };
  } catch (error) {
    warnings.push(`failed to read binding plugin manifest: ${manifestPath} (${error.message})`);

    return {
      manifest: null,
      manifestPath,
      manifestLoaded: false
    };
  }
}

function resolvePluginFilePlan(discoveredFiles = [], manifest = null, candidateDir = '', warnings = []) {
  const orderedFiles = [];
  const discoveredSet = new Set(discoveredFiles);

  if (!manifest) {
    for (const fileName of discoveredFiles) {
      orderedFiles.push({ fileName, priority: 1000, order: Number.MAX_SAFE_INTEGER });
    }

    return orderedFiles
      .sort((left, right) => left.fileName.localeCompare(right.fileName))
      .map((item) => item.fileName);
  }

  for (const fileName of discoveredFiles) {
    const entry = manifest.pluginEntries.get(fileName);

    if (manifest.blockedFiles.has(fileName)) {
      warnings.push(`binding plugin blocked by manifest: ${path.join(candidateDir, fileName)}`);
      continue;
    }

    if (manifest.allowedFiles.size > 0 && !manifest.allowedFiles.has(fileName)) {
      warnings.push(`binding plugin skipped (not allowed): ${path.join(candidateDir, fileName)}`);
      continue;
    }

    if (entry && entry.enabled === false) {
      continue;
    }

    if (!entry && (manifest.strict || !manifest.enabledByDefault)) {
      warnings.push(`binding plugin skipped by manifest policy: ${path.join(candidateDir, fileName)}`);
      continue;
    }

    orderedFiles.push({
      fileName,
      priority: entry ? entry.priority : manifest.defaultPriority,
      order: entry ? entry.order : Number.MAX_SAFE_INTEGER
    });
  }

  for (const declaredFile of manifest.pluginEntries.keys()) {
    if (!discoveredSet.has(declaredFile)) {
      warnings.push(`binding plugin declared but missing: ${path.join(candidateDir, declaredFile)}`);
    }
  }

  return orderedFiles
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.fileName.localeCompare(right.fileName);
    })
    .map((item) => item.fileName);
}

function loadBindingPlugins(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const pluginDir = options.pluginDir || null;
  const autoDiscovery = options.autoDiscovery !== false;

  const warnings = [];
  const pluginDirs = [];
  const pluginFiles = [];
  const handlers = [];

  const manifestResolution = loadPluginManifest(projectRoot, {
    manifestPath: options.manifestPath,
    manifestEnabled: options.manifestEnabled !== false
  }, warnings);

  const candidateDirs = [];

  if (pluginDir) {
    const resolved = normalizePath(projectRoot, pluginDir);
    if (resolved) {
      candidateDirs.push(resolved);
    }
  } else if (autoDiscovery) {
    for (const relativeDir of DEFAULT_BINDING_PLUGIN_DIRS) {
      candidateDirs.push(path.join(projectRoot, relativeDir));
    }
  }

  for (const candidateDir of candidateDirs) {
    if (!candidateDir || !fs.pathExistsSync(candidateDir)) {
      continue;
    }

    pluginDirs.push(candidateDir);

    let entries = [];
    try {
      entries = fs.readdirSync(candidateDir, { withFileTypes: true });
    } catch (error) {
      warnings.push(`failed to list binding plugin dir: ${candidateDir} (${error.message})`);
      continue;
    }

    const discoveredFiles = entries
      .filter((entry) => entry && typeof entry.isFile === 'function' && entry.isFile() && /\.(js|cjs)$/i.test(entry.name || ''))
      .map((entry) => normalizePluginFileToken(entry.name))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    const filesToLoad = resolvePluginFilePlan(
      discoveredFiles,
      manifestResolution.manifest,
      candidateDir,
      warnings
    );

    for (const fileName of filesToLoad) {
      const absolutePath = path.join(candidateDir, fileName);

      try {
        const resolvedPath = require.resolve(absolutePath);
        delete require.cache[resolvedPath];
        const pluginExport = require(resolvedPath);
        const rawHandlers = extractPluginDefinitions(pluginExport, absolutePath, warnings);

        let localIndex = 0;
        for (const rawHandler of rawHandlers) {
          localIndex += 1;
          const handler = normalizePluginHandler(rawHandler, `${path.basename(fileName, path.extname(fileName))}-${localIndex}`);
          if (!handler) {
            warnings.push(`invalid binding handler in plugin: ${absolutePath}`);
            continue;
          }

          handlers.push(handler);
        }

        pluginFiles.push(absolutePath);
      } catch (error) {
        warnings.push(`failed to load binding plugin: ${absolutePath} (${error.message})`);
      }
    }
  }

  return {
    handlers,
    warnings,
    plugin_dirs: pluginDirs,
    plugin_files: pluginFiles,
    manifest_path: manifestResolution.manifestPath,
    manifest_loaded: manifestResolution.manifestLoaded
  };
}

module.exports = {
  DEFAULT_BINDING_PLUGIN_DIRS,
  DEFAULT_BINDING_PLUGIN_MANIFEST,
  loadBindingPlugins
};
