const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const SceneLoader = require('../../../lib/scene-runtime/scene-loader');
const PlanCompiler = require('../../../lib/scene-runtime/plan-compiler');
const AuditEmitter = require('../../../lib/scene-runtime/audit-emitter');
const RuntimeExecutor = require('../../../lib/scene-runtime/runtime-executor');

function createErpScene() {
  return {
    apiVersion: 'kse.scene/v0.2',
    kind: 'scene',
    metadata: {
      obj_id: 'scene.order.query',
      obj_version: '0.2.0',
      title: 'Order Query'
    },
    spec: {
      domain: 'erp',
      intent: {
        goal: 'Query order details'
      },
      model_scope: {
        read: ['moqui.OrderHeader.orderId', 'moqui.OrderHeader.statusId'],
        write: []
      },
      capability_contract: {
        bindings: [
          {
            type: 'query',
            ref: 'spec.erp.order-query-service',
            timeout_ms: 2000,
            retry: 0
          }
        ]
      },
      governance_contract: {
        risk_level: 'low',
        approval: { required: false },
        idempotency: { required: true, key: 'orderId' }
      }
    }
  };
}

function createPluginScene() {
  return {
    apiVersion: 'kse.scene/v0.2',
    kind: 'scene',
    metadata: {
      obj_id: 'scene.custom.plugin-query',
      obj_version: '0.2.0',
      title: 'Plugin Query'
    },
    spec: {
      domain: 'erp',
      intent: {
        goal: 'Execute plugin binding'
      },
      model_scope: {
        read: ['moqui.OrderHeader.orderId'],
        write: []
      },
      capability_contract: {
        bindings: [
          {
            type: 'service',
            ref: 'spec.custom.plugin-query',
            timeout_ms: 2000,
            retry: 0
          }
        ]
      },
      governance_contract: {
        risk_level: 'low',
        approval: { required: false },
        idempotency: { required: true, key: 'orderId' }
      }
    }
  };
}

function createHybridScene() {
  return {
    apiVersion: 'kse.scene/v0.2',
    kind: 'scene',
    metadata: {
      obj_id: 'scene.fulfillment.robot-pick-confirm',
      obj_version: '0.2.0',
      title: 'Robot Pick Confirm'
    },
    spec: {
      domain: 'hybrid',
      intent: {
        goal: 'Dispatch mission and confirm in ERP'
      },
      model_scope: {
        read: ['moqui.OrderHeader.orderId'],
        write: ['moqui.OrderItem.statusId']
      },
      capability_contract: {
        bindings: [
          {
            type: 'service',
            ref: 'spec.erp.reserve-pick-items',
            side_effect: true,
            timeout_ms: 3000,
            retry: 0
          },
          {
            type: 'adapter',
            ref: 'spec.robot.dispatch-pick-mission',
            side_effect: true,
            timeout_ms: 6000,
            retry: 0
          }
        ]
      },
      governance_contract: {
        risk_level: 'high',
        approval: { required: true },
        idempotency: { required: true, key: 'orderId' }
      }
    }
  };
}

describe('Scene Runtime Execution Pilot', () => {
  let tempRoot;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-scene-runtime-'));
  });

  afterEach(async () => {
    await fs.remove(tempRoot);
  });

  test('SceneLoader validates manifest fields', async () => {
    const loader = new SceneLoader();
    const invalidManifestPath = path.join(tempRoot, 'invalid-scene.yaml');

    await fs.writeFile(invalidManifestPath, 'apiVersion: kse.scene/v0.2\nkind: scene\nmetadata: {}\nspec: {}\n', 'utf8');

    await expect(loader.loadFromFile(invalidManifestPath)).rejects.toThrow('Invalid scene manifest');
  });

  test('PlanCompiler creates Plan IR with terminal nodes', () => {
    const compiler = new PlanCompiler();
    const plan = compiler.compile(createErpScene(), { runMode: 'dry_run', traceId: 'trace-test' });

    expect(plan.nodes.length).toBeGreaterThanOrEqual(3);
    expect(plan.nodes[plan.nodes.length - 1].node_type).toBe('respond');
    expect(plan.nodes.some((node) => node.node_type === 'verify')).toBe(true);
  });

  test('dry_run executes without side effects and returns preview', async () => {
    const auditFile = path.join(tempRoot, '.kiro', 'audit', 'scene-runtime-events.jsonl');
    const executedNodes = [];

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      audit: { auditFile },
      bindingExecutor: async (node) => {
        executedNodes.push(node.node_id);
        return { status: 'success' };
      }
    });

    const result = await runtime.execute(createErpScene(), { runMode: 'dry_run', traceId: 'trace-dry-run' });

    expect(result.run_result.status).toBe('success');
    expect(result.run_result.node_results.length).toBe(result.plan.nodes.length);
    expect(executedNodes).toHaveLength(0);
  });

  test('commit delegates binding execution to binding registry when no legacy executor is set', async () => {
    const bindingRegistry = {
      execute: jest.fn().mockResolvedValue({
        status: 'success',
        provider: 'custom-registry'
      })
    };

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      bindingRegistry
    });

    const result = await runtime.execute(createErpScene(), {
      runMode: 'commit',
      traceId: 'trace-commit-registry'
    });

    expect(result.run_result.status).toBe('success');
    expect(bindingRegistry.execute).toHaveBeenCalledTimes(1);
    expect(bindingRegistry.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        node_type: 'query',
        binding_ref: 'spec.erp.order-query-service'
      }),
      expect.objectContaining({
        traceId: 'trace-commit-registry',
        runMode: 'commit'
      })
    );
  });

  test('commit loads and executes binding plugin from plugin directory', async () => {
    const pluginDir = path.join(tempRoot, '.kiro', 'plugins', 'scene-bindings');
    await fs.ensureDir(pluginDir);
    await fs.writeFile(
      path.join(pluginDir, 'custom-plugin.js'),
      `module.exports = { id: 'custom.plugin', match: { refPrefix: 'spec.custom.' }, execute: async () => ({ status: 'success', provider: 'custom-plugin' }) };\n`,
      'utf8'
    );

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      bindingPluginDir: pluginDir
    });

    const result = await runtime.execute(createPluginScene(), {
      runMode: 'commit',
      traceId: 'trace-commit-plugin'
    });

    expect(result.run_result.status).toBe('success');
    expect(result.run_result.evidence[0].output).toMatchObject({
      provider: 'custom-plugin',
      handler_id: 'custom.plugin'
    });
    expect(result.run_result.binding_plugins.handlers_loaded).toBe(1);
    expect(result.run_result.binding_plugins.manifest_path).toBeNull();
    expect(result.run_result.binding_plugins.manifest_loaded).toBe(false);
  });

  test('commit applies binding plugin manifest and exposes load metadata', async () => {
    const pluginDir = path.join(tempRoot, '.kiro', 'plugins', 'scene-bindings');
    const manifestPath = path.join(tempRoot, '.kiro', 'config', 'runtime-plugin-manifest.json');

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.dirname(manifestPath));

    await fs.writeFile(
      path.join(pluginDir, 'custom-plugin.js'),
      `module.exports = { id: 'custom.plugin', match: { refPrefix: 'spec.custom.' }, execute: async () => ({ status: 'success', provider: 'custom-plugin' }) };\n`,
      'utf8'
    );

    await fs.writeJson(manifestPath, {
      strict: true,
      enabled_by_default: false,
      plugins: [
        {
          file: 'custom-plugin.js',
          priority: 5
        }
      ]
    }, { spaces: 2 });

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      bindingPluginDir: pluginDir,
      bindingPluginManifest: manifestPath
    });

    const result = await runtime.execute(createPluginScene(), {
      runMode: 'commit',
      traceId: 'trace-commit-plugin-manifest'
    });

    expect(result.run_result.status).toBe('success');
    expect(result.run_result.binding_plugins.handlers_loaded).toBe(1);
    expect(result.run_result.binding_plugins.manifest_path).toBe(manifestPath);
    expect(result.run_result.binding_plugins.manifest_loaded).toBe(true);
    expect(result.run_result.binding_plugins.warnings).toEqual([]);
  });

  test('commit reports warning when explicit binding plugin manifest is missing', async () => {
    const pluginDir = path.join(tempRoot, '.kiro', 'plugins', 'scene-bindings');
    const missingManifestPath = path.join(tempRoot, '.kiro', 'config', 'missing-plugin-manifest.json');

    await fs.ensureDir(pluginDir);
    await fs.writeFile(
      path.join(pluginDir, 'custom-plugin.js'),
      `module.exports = { id: 'custom.plugin', match: { refPrefix: 'spec.custom.' }, execute: async () => ({ status: 'success', provider: 'custom-plugin' }) };\n`,
      'utf8'
    );

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      bindingPluginDir: pluginDir,
      bindingPluginManifest: missingManifestPath
    });

    const result = await runtime.execute(createPluginScene(), {
      runMode: 'commit',
      traceId: 'trace-commit-plugin-missing-manifest'
    });

    expect(result.run_result.status).toBe('success');
    expect(result.run_result.binding_plugins.handlers_loaded).toBe(1);
    expect(result.run_result.binding_plugins.manifest_path).toBe(missingManifestPath);
    expect(result.run_result.binding_plugins.manifest_loaded).toBe(false);
    expect(result.run_result.binding_plugins.warnings).toContain(
      `binding plugin manifest not found: ${missingManifestPath}`
    );
  });

  test('commit executes low-risk ERP scene and writes audit trail', async () => {
    const auditFile = path.join(tempRoot, '.kiro', 'audit', 'scene-runtime-events.jsonl');
    const auditEmitter = new AuditEmitter(tempRoot, { auditFile });

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      audit: { auditFile },
      bindingExecutor: async () => ({ status: 'success', data: { ok: true } })
    });

    const result = await runtime.execute(createErpScene(), { runMode: 'commit', traceId: 'trace-commit-erp' });

    expect(result.run_result.status).toBe('success');
    expect(result.eval_payload.metrics.success).toBe(true);

    const events = await auditEmitter.readAll();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => auditEmitter.verifyEvent(event))).toBe(true);
  });

  test('hybrid dry_run uses binding registry readiness by default', async () => {
    const bindingRegistry = {
      checkReadiness: jest.fn().mockResolvedValue({
        ready: false,
        checks: [{ name: 'adapter:spec.robot.dispatch-pick-mission', passed: false }]
      })
    };

    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      bindingRegistry
    });

    const result = await runtime.execute(createHybridScene(), {
      runMode: 'dry_run',
      traceId: 'trace-hybrid-registry',
      context: {
        safetyChecks: { preflight: true, stopChannel: true }
      }
    });

    expect(bindingRegistry.checkReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ obj_id: 'scene.fulfillment.robot-pick-confirm' })
      }),
      expect.objectContaining({
        traceId: 'trace-hybrid-registry'
      })
    );
    expect(result.run_result.status).toBe('blocked');
    expect(result.run_result.adapter_readiness.ready).toBe(false);
  });

  test('hybrid dry_run performs adapter readiness checks', async () => {
    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot,
      adapterReadinessChecker: async () => ({
        ready: false,
        checks: [{ name: 'preflight', passed: false }]
      })
    });

    const result = await runtime.execute(createHybridScene(), {
      runMode: 'dry_run',
      traceId: 'trace-hybrid-dry-run',
      context: {
        approved: true,
        safetyChecks: { preflight: true, stopChannel: true }
      }
    });

    expect(result.run_result.status).toBe('blocked');
    expect(result.run_result.adapter_readiness.ready).toBe(false);
  });

  test('hybrid commit is denied in pilot runtime', async () => {
    const runtime = new RuntimeExecutor({
      projectRoot: tempRoot
    });

    const result = await runtime.execute(createHybridScene(), {
      runMode: 'commit',
      traceId: 'trace-hybrid-commit',
      context: {
        approved: true,
        safetyChecks: { preflight: true, stopChannel: true }
      }
    });

    expect(result.run_result.status).toBe('denied');
    expect(result.run_result.policy.allowed).toBe(false);
    expect(result.run_result.policy.reasons).toContain('hybrid commit is disabled in runtime pilot');
  });
});
