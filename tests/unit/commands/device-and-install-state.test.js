const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SceStateStore } = require('../../../lib/state/sce-state-store');
const {
  runDeviceCurrentCommand,
  runDeviceOverrideShowCommand,
  runDeviceOverrideUpsertCommand
} = require('../../../lib/commands/device');
const {
  runAppCollectionListCommand,
  runAppCollectionShowCommand,
  runAppCollectionApplyCommand,
  runAppInstallStateListCommand,
  runAppRuntimeInstallCommand
} = require('../../../lib/commands/app');

describe('device and app install-state commands', () => {
  let tempDir;
  let originalLog;
  let stateStore;
  const testEnv = { NODE_ENV: 'test' };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-device-command-'));
    originalLog = console.log;
    console.log = jest.fn();
    stateStore = new SceStateStore(tempDir, {
      fileSystem: fs,
      env: testEnv,
      sqliteModule: {}
    });
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('device current is read-only when no persistent machine id exists', async () => {
    const machineIdFile = path.join(tempDir, '.sce', 'config', 'machine-id.json');
    expect(await fs.pathExists(machineIdFile)).toBe(false);

    const payload = await runDeviceCurrentCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.mode).toBe('device-current');
    expect(payload.device).toEqual(expect.objectContaining({
      device_id: expect.any(String),
      identity_source: 'ephemeral-device-fingerprint',
      persistent_id_available: false
    }));
    expect(payload.device.capability_tags.length).toBeGreaterThan(0);
    expect(await fs.pathExists(machineIdFile)).toBe(false);
  });

  test('device override show returns normalized empty payload when local override file is missing', async () => {
    const payload = await runDeviceOverrideShowCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.mode).toBe('device-override-show');
    expect(payload.summary).toEqual(expect.objectContaining({
      source_file: null,
      removed_app_count: 0,
      added_app_count: 0
    }));
    expect(payload.override).toEqual(expect.objectContaining({
      removed_apps: [],
      added_apps: []
    }));
  });

  test('device override upsert merges only explicit fields and persists normalized output', async () => {
    const deviceStateDir = path.join(tempDir, '.sce', 'state', 'device');
    await fs.ensureDir(deviceStateDir);
    await fs.writeJson(path.join(deviceStateDir, 'device-override.json'), {
      removed_apps: ['crm'],
      added_apps: [
        { app_key: 'notes', required: false }
      ],
      metadata: {
        source: 'existing',
        keep: true
      }
    }, { spaces: 2 });

    const inputFile = path.join(tempDir, 'device-override-patch.json');
    await fs.writeJson(inputFile, {
      added_apps: [
        { app_key: 'quote', required: true },
        { app_key: 'quote', required: false },
        { app_id: 'app.analytics', required: false }
      ],
      metadata: {
        updated_by: 'test'
      }
    }, { spaces: 2 });

    const payload = await runDeviceOverrideUpsertCommand({
      input: inputFile,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv
    });

    expect(payload.mode).toBe('device-override-upsert');
    expect(payload.success).toBe(true);
    expect(payload.summary).toEqual(expect.objectContaining({
      removed_app_count: 1,
      added_app_count: 2
    }));
    expect(payload.override.removed_apps).toEqual(['crm']);
    expect(payload.override.added_apps).toEqual([
      expect.objectContaining({ app_key: 'quote', required: true }),
      expect.objectContaining({ app_id: 'app.analytics' })
    ]);
    expect(payload.override.metadata).toEqual({
      source: 'existing',
      keep: true,
      updated_by: 'test'
    });

    const saved = await fs.readJson(path.join(deviceStateDir, 'device-override.json'));
    expect(saved.removed_apps).toEqual(['crm']);
    expect(saved.added_apps).toHaveLength(2);
    expect(saved.metadata).toEqual({
      source: 'existing',
      keep: true,
      updated_by: 'test'
    });
  });

  test('app install-state list reports current device install facts', async () => {
    await stateStore.registerAppBundle({
      app_id: 'app.demo',
      app_key: 'demo',
      app_name: 'Demo App',
      status: 'active',
      environment: 'dev',
      runtime_release_id: 'rel.demo.2026030801',
      metadata: {
        service_catalog: {
          default_release_id: 'rel.demo.2026030801',
          releases: [
            {
              release_id: 'rel.demo.2026030801',
              runtime_version: 'v0.1.0',
              release_channel: 'dev',
              release_status: 'published',
              runtime_status: 'ready'
            },
            {
              release_id: 'rel.demo.2026030802',
              runtime_version: 'v0.1.1',
              release_channel: 'beta',
              release_status: 'published',
              runtime_status: 'ready'
            }
          ]
        }
      },
      runtime: {
        release_id: 'rel.demo.2026030801',
        runtime_version: 'v0.1.0',
        release_channel: 'dev',
        release_status: 'published',
        runtime_status: 'ready'
      }
    });

    await stateStore.registerAppBundle({
      app_id: 'app.todo',
      app_key: 'todo',
      app_name: 'Todo App',
      status: 'active',
      environment: 'dev'
    });

    const installRoot = path.join(tempDir, '.sce', 'apps', 'demo', 'runtime', 'rel.demo.2026030802');
    const installed = await runAppRuntimeInstallCommand({
      app: 'demo',
      release: 'rel.demo.2026030802',
      installRoot,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(installed.runtime_installation).toEqual(expect.objectContaining({
      status: 'installed',
      machine_id: expect.any(String),
      hostname: expect.any(String)
    }));
    expect(await fs.pathExists(path.join(tempDir, '.sce', 'config', 'machine-id.json'))).toBe(true);

    const payload = await runAppInstallStateListCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.mode).toBe('app-install-state-list');
    expect(payload.summary).toEqual(expect.objectContaining({
      total: 2,
      installed_count: 1,
      not_installed_count: 1,
      active_count: 1,
      current_device_id: installed.runtime_installation.machine_id
    }));

    const demoItem = payload.items.find((item) => item.app_key === 'demo');
    const todoItem = payload.items.find((item) => item.app_key === 'todo');

    expect(demoItem).toEqual(expect.objectContaining({
      install_status: 'installed',
      installed_release_id: 'rel.demo.2026030802',
      active_release_id: 'rel.demo.2026030801',
      machine_scope: 'current-device',
      machine_id: installed.runtime_installation.machine_id
    }));
    expect(todoItem).toEqual(expect.objectContaining({
      install_status: 'not-installed',
      installed_release_id: null
    }));

    const installedOnly = await runAppInstallStateListCommand({
      installStatus: 'installed',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(installedOnly.items).toHaveLength(1);
    expect(installedOnly.items[0].app_key).toBe('demo');
  });

  test('app collection list and show read file-backed collection intent', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    await fs.ensureDir(collectionsDir);
    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      name: 'Sales Workbench',
      description: 'Apps for sales follow-up and quotation',
      status: 'active',
      tags: ['sales', 'crm'],
      items: [
        { app_key: 'crm', required: true, priority: 10 },
        { app_key: 'quotation', required: false, allow_local_remove: true, priority: 20 }
      ]
    }, { spaces: 2 });

    await fs.writeJson(path.join(collectionsDir, 'planning-workbench.json'), {
      collection_id: 'planning-workbench',
      name: 'Planning Workbench',
      status: 'draft',
      items: [
        { app_key: 'mrp', required: true }
      ]
    }, { spaces: 2 });

    const listed = await runAppCollectionListCommand({ json: true }, {
      projectPath: tempDir,
      fileSystem: fs
    });
    expect(listed.mode).toBe('app-collection-list');
    expect(listed.summary.total).toBe(2);

    const shown = await runAppCollectionShowCommand({
      collection: 'sales-workbench',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(shown.summary).toEqual(expect.objectContaining({
      collection_id: 'sales-workbench',
      item_count: 2,
      status: 'active'
    }));
    expect(shown.collection.items[0]).toEqual(expect.objectContaining({
      app_key: 'crm',
      required: true
    }));

    const activeOnly = await runAppCollectionListCommand({
      status: 'active',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });
    expect(activeOnly.items).toHaveLength(1);
    expect(activeOnly.items[0].collection_id).toBe('sales-workbench');
  });

  test('app collection apply blocks execute when plan still contains unresolved skip actions', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    await fs.ensureDir(collectionsDir);
    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      name: 'Sales Workbench',
      status: 'active',
      items: [
        { app_key: 'crm', required: true },
        { app_key: 'quote', required: false },
        { app_key: 'missing-app', required: false }
      ]
    }, { spaces: 2 });

    await stateStore.registerAppBundle({
      app_id: 'app.crm',
      app_key: 'crm',
      app_name: 'CRM',
      status: 'active',
      environment: 'dev'
    });
    await stateStore.registerAppBundle({
      app_id: 'app.quote',
      app_key: 'quote',
      app_name: 'Quote',
      status: 'active',
      environment: 'dev',
      runtime_release_id: 'rel.quote.1',
      metadata: {
        runtime_installation: {
          status: 'installed',
          release_id: 'rel.quote.1',
          install_root: path.join(tempDir, '.sce', 'apps', 'quote', 'runtime', 'rel.quote.1')
        },
        runtime_activation: {
          active_release_id: 'rel.quote.1'
        }
      }
    });
    await stateStore.registerAppBundle({
      app_id: 'app.todo',
      app_key: 'todo',
      app_name: 'Todo',
      status: 'active',
      environment: 'dev',
      metadata: {
        runtime_installation: {
          status: 'installed',
          release_id: 'rel.todo.1',
          install_root: path.join(tempDir, '.sce', 'apps', 'todo', 'runtime', 'rel.todo.1')
        }
      }
    });

    const payload = await runAppCollectionApplyCommand({
      collection: 'sales-workbench',
      execute: true,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.mode).toBe('app-collection-apply');
    expect(payload.execute_supported).toBe(true);
    expect(payload.executed).toBe(false);
    expect(payload.execution_blocked_reason).toBe('unresolved-app-bundles');
    expect(payload.summary).toEqual(expect.objectContaining({
      desired_app_count: 3,
      install_count: 1,
      uninstall_count: 1,
      keep_count: 1,
      skip_count: 1
    }));

    const decisions = Object.fromEntries(payload.plan.actions.map((item) => [item.app_key, item.decision]));
    expect(decisions.crm).toBe('install');
    expect(decisions.quote).toBe('keep');
    expect(decisions.todo).toBe('uninstall');
    expect(decisions['missing-app']).toBe('skip');
  });

  test('app collection apply executes non-blocked install and uninstall actions explicitly', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    await fs.ensureDir(collectionsDir);
    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      name: 'Sales Workbench',
      status: 'active',
      items: [
        { app_key: 'crm', required: true }
      ]
    }, { spaces: 2 });

    await stateStore.registerAppBundle({
      app_id: 'app.crm',
      app_key: 'crm',
      app_name: 'CRM',
      status: 'active',
      environment: 'dev',
      metadata: {
        service_catalog: {
          default_release_id: 'rel.crm.1',
          releases: [
            {
              release_id: 'rel.crm.1',
              runtime_version: 'v1.0.0',
              release_status: 'published',
              runtime_status: 'ready'
            }
          ]
        }
      }
    });
    await stateStore.registerAppBundle({
      app_id: 'app.todo',
      app_key: 'todo',
      app_name: 'Todo',
      status: 'active',
      environment: 'dev',
      metadata: {
        runtime_installation: {
          status: 'installed',
          release_id: 'rel.todo.1',
          install_root: path.join(tempDir, '.sce', 'apps', 'todo', 'runtime', 'rel.todo.1')
        }
      }
    });

    const installRoot = path.join(tempDir, '.sce', 'apps', 'todo', 'runtime', 'rel.todo.1');
    await fs.ensureDir(installRoot);

    const payload = await runAppCollectionApplyCommand({
      collection: 'sales-workbench',
      execute: true,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.execute_supported).toBe(true);
    expect(payload.executed).toBe(true);
    expect(payload.execution_blocked_reason).toBeNull();
    expect(payload.execution.results).toHaveLength(2);

    const installItem = payload.execution.results.find((item) => item.decision === 'install');
    const uninstallItem = payload.execution.results.find((item) => item.decision === 'uninstall');
    expect(installItem.app_ref).toBe('crm');
    expect(uninstallItem.app_ref).toBe('todo');

    const crmShown = await runAppInstallStateListCommand({ installStatus: 'installed', json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(crmShown.items.some((item) => item.app_key === 'crm')).toBe(true);
    expect(await fs.pathExists(installRoot)).toBe(false);
  });

  test('app collection apply respects capability tags and device override file', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    const deviceStateDir = path.join(tempDir, '.sce', 'state', 'device');
    await fs.ensureDir(collectionsDir);
    await fs.ensureDir(deviceStateDir);
    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true },
        { app_key: 'tablet-only', capability_tags: ['tablet'] },
        { app_key: 'quote', required: false }
      ]
    }, { spaces: 2 });
    await fs.writeJson(path.join(deviceStateDir, 'device-override.json'), {
      removed_apps: ['crm'],
      added_apps: [
        { app_key: 'notes', required: false }
      ]
    }, { spaces: 2 });

    await stateStore.registerAppBundle({
      app_id: 'app.crm',
      app_key: 'crm',
      app_name: 'CRM',
      status: 'active',
      environment: 'dev'
    });
    await stateStore.registerAppBundle({
      app_id: 'app.quote',
      app_key: 'quote',
      app_name: 'Quote',
      status: 'active',
      environment: 'dev'
    });
    await stateStore.registerAppBundle({
      app_id: 'app.notes',
      app_key: 'notes',
      app_name: 'Notes',
      status: 'active',
      environment: 'dev'
    });
    await stateStore.registerAppBundle({
      app_id: 'app.tablet-only',
      app_key: 'tablet-only',
      app_name: 'Tablet Only',
      status: 'active',
      environment: 'dev'
    });

    const payload = await runAppCollectionApplyCommand({
      collection: 'sales-workbench',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.device_override).toEqual(expect.objectContaining({
      removed_apps: ['crm']
    }));
    const decisions = Object.fromEntries(payload.plan.actions.map((item) => [item.app_key, item.decision]));
    const reasons = Object.fromEntries(payload.plan.actions.map((item) => [item.app_key, item.reason]));
    expect(decisions.crm).toBeUndefined();
    expect(decisions.notes).toBe('install');
    expect(decisions.quote).toBe('install');
    expect(decisions['tablet-only']).toBe('skip');
    expect(reasons['tablet-only']).toBe('device-capability-mismatch');
  });

  test('app collection apply plans and executes activate when installed release is not active', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    await fs.ensureDir(collectionsDir);
    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true }
      ]
    }, { spaces: 2 });

    await stateStore.registerAppBundle({
      app_id: 'app.crm',
      app_key: 'crm',
      app_name: 'CRM',
      status: 'active',
      environment: 'dev',
      runtime_release_id: 'rel.crm.0',
      metadata: {
        service_catalog: {
          default_release_id: 'rel.crm.1',
          releases: [
            {
              release_id: 'rel.crm.0',
              runtime_version: 'v0.9.0',
              release_status: 'published',
              runtime_status: 'ready'
            },
            {
              release_id: 'rel.crm.1',
              runtime_version: 'v1.0.0',
              release_status: 'published',
              runtime_status: 'ready'
            }
          ]
        },
        runtime_installation: {
          status: 'installed',
          release_id: 'rel.crm.1',
          install_root: path.join(tempDir, '.sce', 'apps', 'crm', 'runtime', 'rel.crm.1')
        },
        runtime_activation: {
          active_release_id: 'rel.crm.0'
        }
      },
      runtime: {
        release_id: 'rel.crm.0',
        runtime_version: 'v0.9.0',
        release_status: 'published',
        runtime_status: 'ready'
      }
    });

    const planned = await runAppCollectionApplyCommand({
      collection: 'sales-workbench',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(planned.summary).toEqual(expect.objectContaining({
      install_count: 0,
      activate_count: 1,
      keep_count: 0
    }));
    expect(planned.plan.actions[0]).toEqual(expect.objectContaining({
      app_key: 'crm',
      decision: 'activate',
      installed_release_id: 'rel.crm.1',
      active_release_id: 'rel.crm.0'
    }));

    const executed = await runAppCollectionApplyCommand({
      collection: 'sales-workbench',
      execute: true,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(executed.executed).toBe(true);
    expect(executed.execution.results).toHaveLength(1);
    expect(executed.execution.results[0]).toEqual(expect.objectContaining({
      decision: 'activate',
      app_ref: 'crm'
    }));

    const shown = await runAppInstallStateListCommand({ installStatus: 'installed', json: true }, {
      projectPath: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });
    expect(shown.items.find((item) => item.app_key === 'crm')).toEqual(expect.objectContaining({
      active_release_id: 'rel.crm.1',
      installed_release_id: 'rel.crm.1'
    }));
  });
});
