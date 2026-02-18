const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const BindingRegistry = require('../../../lib/scene-runtime/binding-registry');

describe('BindingRegistry', () => {
  test('resolves handler by ref prefix and executes custom handler', async () => {
    const registry = new BindingRegistry({ useDefaultHandlers: false });

    registry.register({
      id: 'custom-erp',
      match: { refPrefix: 'spec.erp.' },
      execute: async (node) => ({
        status: 'success',
        binding_ref: node.binding_ref,
        provider: 'custom-erp'
      })
    });

    const result = await registry.execute({
      node_type: 'query',
      binding_ref: 'spec.erp.order-query-service'
    });

    expect(result).toMatchObject({
      status: 'success',
      provider: 'custom-erp',
      handler_id: 'custom-erp'
    });
  });

  test('falls back to default handler when no custom handler matches', async () => {
    const registry = new BindingRegistry({ useDefaultHandlers: false });

    const result = await registry.execute({
      node_type: 'service',
      binding_ref: 'spec.custom.unknown'
    });

    expect(result).toMatchObject({
      status: 'success',
      provider: 'default',
      handler_id: 'builtin.default'
    });
  });

  test('default robot readiness enforces preflight and stop channel', async () => {
    const registry = new BindingRegistry();

    const sceneManifest = {
      spec: {
        capability_contract: {
          bindings: [
            {
              type: 'adapter',
              ref: 'spec.robot.dispatch-pick-mission'
            }
          ]
        }
      }
    };

    const readiness = await registry.checkReadiness(sceneManifest, {
      context: {
        safetyChecks: {
          preflight: true,
          stopChannel: false
        }
      }
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.checks[0]).toMatchObject({
      passed: false,
      reason: 'missing-stop-channel'
    });
  });

  test('default handlers fall back to erp-sim when moqui config is missing', () => {
    const registry = new BindingRegistry({
      projectRoot: path.join(os.tmpdir(), `sce-binding-registry-missing-${Date.now()}`)
    });

    const handler = registry.resolve({
      node_type: 'query',
      binding_ref: 'spec.erp.order-query-service'
    });

    expect(handler.id).toBe('builtin.erp-sim');
  });

  test('default handlers prefer moqui adapter for spec.erp refs when config is present', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-binding-registry-'));

    try {
      await fs.writeJson(path.join(tempRoot, 'moqui-adapter.json'), {
        baseUrl: 'http://localhost:8080',
        credentials: {
          username: 'demo',
          password: 'demo'
        }
      }, { spaces: 2 });

      const registry = new BindingRegistry({ projectRoot: tempRoot });
      const handler = registry.resolve({
        node_type: 'query',
        binding_ref: 'spec.erp.order-query-service'
      });

      expect(handler.id).toBe('moqui.adapter');
    } finally {
      await fs.remove(tempRoot);
    }
  });

  test('default handlers route moqui refs to moqui adapter even without config', () => {
    const registry = new BindingRegistry({
      projectRoot: path.join(os.tmpdir(), `sce-binding-registry-moqui-${Date.now()}`)
    });

    const handler = registry.resolve({
      node_type: 'query',
      binding_ref: 'moqui.OrderHeader.list'
    });

    expect(handler.id).toBe('moqui.adapter');
  });
});
