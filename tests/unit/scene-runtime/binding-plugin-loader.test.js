const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const { loadBindingPlugins } = require('../../../lib/scene-runtime/binding-plugin-loader');

async function writePlugin(pluginDir, fileName, pluginId, refPrefix) {
  await fs.writeFile(
    path.join(pluginDir, fileName),
    `module.exports = { id: '${pluginId}', match: { refPrefix: '${refPrefix}' }, execute: async () => ({ status: 'success', provider: '${pluginId}' }) };\n`,
    'utf8'
  );
}

describe('BindingPluginLoader', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-binding-plugin-loader-'));
  });

  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  test('loads handlers from explicit plugin directory', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    await fs.ensureDir(pluginDir);
    await writePlugin(pluginDir, 'custom-plugin.js', 'custom.plugin', 'spec.custom.');

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers).toHaveLength(1);
    expect(loaded.handlers[0]).toMatchObject({
      id: 'custom.plugin'
    });
    expect(loaded.plugin_dirs).toContain(pluginDir);
    expect(loaded.manifest_path).toBeNull();
    expect(loaded.manifest_loaded).toBe(false);
    expect(loaded.warnings).toEqual([]);
  });

  test('adds warning for malformed plugin export', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    await fs.ensureDir(pluginDir);
    await fs.writeFile(
      path.join(pluginDir, 'bad-plugin.js'),
      'module.exports = 123;\n',
      'utf8'
    );

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers).toHaveLength(0);
    expect(loaded.warnings.length).toBeGreaterThan(0);
    expect(loaded.warnings[0]).toContain('binding plugin export must be object/array/function');
  });

  test('discovers plugins from default auto-discovery directory', async () => {
    const pluginDir = path.join(tempRoot, '.sce', 'plugins', 'scene-bindings');
    await fs.ensureDir(pluginDir);
    await writePlugin(pluginDir, 'auto-plugin.js', 'auto.plugin', 'spec.auto.');

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot
    });

    expect(loaded.handlers).toHaveLength(1);
    expect(loaded.handlers[0]).toMatchObject({ id: 'auto.plugin' });
    expect(loaded.plugin_dirs).toContain(pluginDir);
  });

  test('applies manifest allow and block rules when loading plugins', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    const manifestPath = path.join(tempRoot, '.sce', 'config', 'scene-binding-plugins.json');

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.dirname(manifestPath));

    await writePlugin(pluginDir, 'allowed.js', 'allowed.plugin', 'spec.allowed.');
    await writePlugin(pluginDir, 'blocked.js', 'blocked.plugin', 'spec.blocked.');
    await writePlugin(pluginDir, 'extra.js', 'extra.plugin', 'spec.extra.');

    await fs.writeJson(manifestPath, {
      allowed_files: ['allowed.js'],
      blocked_files: ['blocked.js']
    }, { spaces: 2 });

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers.map((handler) => handler.id)).toEqual(['allowed.plugin']);
    expect(loaded.manifest_loaded).toBe(true);
    expect(loaded.manifest_path).toBe(manifestPath);
    expect(loaded.warnings).toContain(`binding plugin blocked by manifest: ${path.join(pluginDir, 'blocked.js')}`);
    expect(loaded.warnings).toContain(`binding plugin skipped (not allowed): ${path.join(pluginDir, 'extra.js')}`);
  });

  test('applies manifest strict mode and disabled-by-default policy', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    const manifestPath = path.join(tempRoot, '.sce', 'config', 'scene-binding-plugins.json');

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.dirname(manifestPath));

    await writePlugin(pluginDir, 'declared.js', 'declared.plugin', 'spec.declared.');
    await writePlugin(pluginDir, 'undeclared.js', 'undeclared.plugin', 'spec.undeclared.');

    await fs.writeJson(manifestPath, {
      strict: true,
      enabled_by_default: false,
      plugins: [
        {
          file: 'declared.js',
          priority: 20
        }
      ]
    }, { spaces: 2 });

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers.map((handler) => handler.id)).toEqual(['declared.plugin']);
    expect(loaded.warnings).toContain(`binding plugin skipped by manifest policy: ${path.join(pluginDir, 'undeclared.js')}`);
  });

  test('orders loaded plugins by manifest priority', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    const manifestPath = path.join(tempRoot, '.sce', 'config', 'scene-binding-plugins.json');

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.dirname(manifestPath));

    await writePlugin(pluginDir, 'alpha.js', 'alpha.plugin', 'spec.alpha.');
    await writePlugin(pluginDir, 'beta.js', 'beta.plugin', 'spec.beta.');

    await fs.writeJson(manifestPath, {
      plugins: [
        {
          file: 'beta.js',
          priority: 10
        },
        {
          file: 'alpha.js',
          priority: 20
        }
      ]
    }, { spaces: 2 });

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers.map((handler) => handler.id)).toEqual(['beta.plugin', 'alpha.plugin']);
  });

  test('warns when manifest declares a missing plugin file', async () => {
    const pluginDir = path.join(tempRoot, 'plugins');
    const manifestPath = path.join(tempRoot, '.sce', 'config', 'scene-binding-plugins.json');

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.dirname(manifestPath));

    await writePlugin(pluginDir, 'present.js', 'present.plugin', 'spec.present.');

    await fs.writeJson(manifestPath, {
      plugins: [
        {
          file: 'present.js',
          priority: 10
        },
        {
          file: 'missing.js',
          priority: 20
        }
      ]
    }, { spaces: 2 });

    const loaded = loadBindingPlugins({
      projectRoot: tempRoot,
      pluginDir
    });

    expect(loaded.handlers.map((handler) => handler.id)).toEqual(['present.plugin']);
    expect(loaded.warnings).toContain(`binding plugin declared but missing: ${path.join(pluginDir, 'missing.js')}`);
  });
});
