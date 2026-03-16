const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {
  runSceneWorkspaceListCommand,
  runSceneWorkspaceShowCommand,
  runSceneWorkspaceApplyCommand
} = require('../../../lib/commands/scene');
const { SceStateStore } = require('../../../lib/state/sce-state-store');

describe('scene workspace commands', () => {
  let tempDir;
  let originalLog;
  let stateStore;
  const testEnv = { NODE_ENV: 'test' };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-scene-workspace-'));
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

  test('lists file-backed scene workspaces', async () => {
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    await fs.ensureDir(workspaceDir);
    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      status: 'active',
      collection_refs: ['sales-workbench'],
      items: [
        { app_key: 'crm', required: true },
        { app_key: 'quotation', required: false }
      ]
    }, { spaces: 2 });
    await fs.writeJson(path.join(workspaceDir, 'planning.json'), {
      workspace_id: 'planning',
      name: 'Planning Workspace',
      status: 'draft',
      items: [
        { app_key: 'mrp', required: true }
      ]
    }, { spaces: 2 });

    const payload = await runSceneWorkspaceListCommand({ json: true }, {
      projectRoot: tempDir,
      fileSystem: fs
    });

    expect(payload.mode).toBe('scene-workspace-list');
    expect(payload.summary.total).toBe(2);
    expect(payload.items[0]).toEqual(expect.objectContaining({
      workspace_id: 'planning'
    }));

    const activeOnly = await runSceneWorkspaceListCommand({ status: 'active', json: true }, {
      projectRoot: tempDir,
      fileSystem: fs
    });
    expect(activeOnly.items).toHaveLength(1);
    expect(activeOnly.items[0].workspace_id).toBe('sales');
  });

  test('shows one file-backed scene workspace', async () => {
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    await fs.ensureDir(workspaceDir);
    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      description: 'Workbench for sales users',
      status: 'active',
      collection_refs: ['sales-workbench'],
      default_entry: 'crm/home',
      layout_hint: 'two-column',
      items: [
        { app_key: 'crm', required: true, priority: 10 },
        { collection_id: 'sales-workbench', required: true }
      ]
    }, { spaces: 2 });

    const payload = await runSceneWorkspaceShowCommand({ workspace: 'sales', json: true }, {
      projectRoot: tempDir,
      fileSystem: fs
    });

    expect(payload.mode).toBe('scene-workspace-show');
    expect(payload.summary).toEqual(expect.objectContaining({
      workspace_id: 'sales',
      item_count: 2,
      collection_ref_count: 1
    }));
    expect(payload.workspace).toEqual(expect.objectContaining({
      default_entry: 'crm/home',
      layout_hint: 'two-column'
    }));
    expect(payload.workspace.items[0]).toEqual(expect.objectContaining({
      app_key: 'crm',
      required: true
    }));
  });

  test('builds a plan-first apply diff for one scene workspace', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    await fs.ensureDir(collectionsDir);
    await fs.ensureDir(workspaceDir);

    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true }
      ]
    }, { spaces: 2 });

    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      collection_refs: ['sales-workbench', 'missing-collection'],
      items: [
        { app_key: 'analytics', required: false }
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
      app_id: 'app.analytics',
      app_key: 'analytics',
      app_name: 'Analytics',
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

    const payload = await runSceneWorkspaceApplyCommand({
      workspace: 'sales',
      execute: true,
      json: true
    }, {
      projectRoot: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.mode).toBe('scene-workspace-apply');
    expect(payload.execute_supported).toBe(true);
    expect(payload.executed).toBe(false);
    expect(payload.execution_blocked_reason).toBe('unresolved-collections,active-release-protected');
    expect(payload.summary).toEqual(expect.objectContaining({
      desired_app_count: 2,
      install_count: 2,
      skip_count: 1
    }));
    expect(payload.plan.unresolved_collections).toContain('missing-collection');

    const decisions = Object.fromEntries(payload.plan.actions.map((item) => [item.app_key, item.decision]));
    expect(decisions.crm).toBe('install');
    expect(decisions.analytics).toBe('install');
    expect(decisions.quote).toBe('skip');
  });

  test('executes scene workspace apply when plan is non-blocked', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    await fs.ensureDir(collectionsDir);
    await fs.ensureDir(workspaceDir);

    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true }
      ]
    }, { spaces: 2 });

    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      collection_refs: ['sales-workbench']
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
      app_id: 'app.quote',
      app_key: 'quote',
      app_name: 'Quote',
      status: 'active',
      environment: 'dev',
      metadata: {
        runtime_installation: {
          status: 'installed',
          release_id: 'rel.quote.1',
          install_root: path.join(tempDir, '.sce', 'apps', 'quote', 'runtime', 'rel.quote.1')
        }
      }
    });

    const installRoot = path.join(tempDir, '.sce', 'apps', 'quote', 'runtime', 'rel.quote.1');
    await fs.ensureDir(installRoot);

    const payload = await runSceneWorkspaceApplyCommand({
      workspace: 'sales',
      execute: true,
      json: true
    }, {
      projectRoot: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.execute_supported).toBe(true);
    expect(payload.executed).toBe(true);
    expect(payload.execution_blocked_reason).toBeNull();
    expect(payload.execution.results).toHaveLength(2);
    expect(await fs.pathExists(installRoot)).toBe(false);
  });

  test('scene workspace apply respects local device override additions and removals', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    const deviceStateDir = path.join(tempDir, '.sce', 'state', 'device');
    await fs.ensureDir(collectionsDir);
    await fs.ensureDir(workspaceDir);
    await fs.ensureDir(deviceStateDir);

    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true },
        { app_key: 'quote', required: false }
      ]
    }, { spaces: 2 });

    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      collection_refs: ['sales-workbench']
    }, { spaces: 2 });

    await fs.writeJson(path.join(deviceStateDir, 'device-override.json'), {
      removed_apps: ['crm'],
      added_apps: [
        { app_key: 'notes' }
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

    const payload = await runSceneWorkspaceApplyCommand({
      workspace: 'sales',
      json: true
    }, {
      projectRoot: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.device_override.removed_apps).toContain('crm');
    const decisions = Object.fromEntries(payload.plan.actions.map((item) => [item.app_key, item.decision]));
    expect(decisions.crm).toBeUndefined();
    expect(decisions.quote).toBe('install');
    expect(decisions.notes).toBe('install');
  });

  test('scene workspace apply plans activate when installed release differs from active release', async () => {
    const collectionsDir = path.join(tempDir, '.sce', 'app', 'collections');
    const workspaceDir = path.join(tempDir, '.sce', 'app', 'scene-profiles');
    await fs.ensureDir(collectionsDir);
    await fs.ensureDir(workspaceDir);

    await fs.writeJson(path.join(collectionsDir, 'sales-workbench.json'), {
      collection_id: 'sales-workbench',
      items: [
        { app_key: 'crm', required: true }
      ]
    }, { spaces: 2 });

    await fs.writeJson(path.join(workspaceDir, 'sales.json'), {
      workspace_id: 'sales',
      name: 'Sales Workspace',
      collection_refs: ['sales-workbench']
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
            { release_id: 'rel.crm.0', runtime_version: 'v0.9.0', release_status: 'published', runtime_status: 'ready' },
            { release_id: 'rel.crm.1', runtime_version: 'v1.0.0', release_status: 'published', runtime_status: 'ready' }
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

    const payload = await runSceneWorkspaceApplyCommand({
      workspace: 'sales',
      json: true
    }, {
      projectRoot: tempDir,
      fileSystem: fs,
      env: testEnv,
      stateStore
    });

    expect(payload.summary).toEqual(expect.objectContaining({
      activate_count: 1
    }));
    expect(payload.plan.actions[0]).toEqual(expect.objectContaining({
      app_key: 'crm',
      decision: 'activate'
    }));
  });
});
