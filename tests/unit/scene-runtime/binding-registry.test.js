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
});
