const fs = require('fs-extra');
const os = require('os');
const path = require('path');

function createTempWorkspace() {
  const workspaceRoot = path.join(
    os.tmpdir(),
    `sce-test-orch-status-events-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
  fs.mkdirpSync(path.join(workspaceRoot, '.kiro', 'specs', 'spec-a'));
  return workspaceRoot;
}

function registerModuleMocks() {
  jest.doMock('../../lib/orchestrator/orchestrator-config', () => ({
    OrchestratorConfig: class {
      async getConfig() {
        return {
          maxParallel: 1,
          maxRetries: 0,
        };
      }
    },
  }));

  jest.doMock('../../lib/orchestrator/bootstrap-prompt-builder', () => ({
    BootstrapPromptBuilder: class {},
  }));

  jest.doMock('../../lib/orchestrator/agent-spawner', () => ({
    AgentSpawner: class {},
  }));

  jest.doMock('../../lib/orchestrator/status-monitor', () => ({
    StatusMonitor: class {
      getOrchestrationStatus() {
        return { status: 'idle' };
      }
    },
  }));

  jest.doMock('../../lib/collab/dependency-manager', () => {
    return class DependencyManager {};
  });
  jest.doMock('../../lib/collab/metadata-manager', () => {
    return class MetadataManager {};
  });
  jest.doMock('../../lib/collab/agent-registry', () => ({
    AgentRegistry: class {},
  }));
  jest.doMock('../../lib/collab/spec-lifecycle-manager', () => ({
    SpecLifecycleManager: class {},
  }));
  jest.doMock('../../lib/lock/machine-identifier', () => ({
    MachineIdentifier: class {},
  }));
  jest.doMock('../../lib/steering/context-sync-manager', () => ({
    ContextSyncManager: class {},
  }));

  jest.doMock('../../lib/orchestrator/orchestration-engine', () => {
    const { EventEmitter } = require('events');
    return {
      OrchestrationEngine: class extends EventEmitter {
        constructor() {
          super();
          this._status = { status: 'running', marker: 0 };
        }

        getStatus() {
          return { ...this._status };
        }

        async start() {
          this._status = { status: 'running', marker: 1, event: 'spec:rate-limited' };
          this.emit('spec:rate-limited', {
            specName: 'spec-a',
            retryCount: 0,
            retryDelayMs: 1000,
            error: '429 Too Many Requests',
          });

          this._status = { status: 'running', marker: 2, event: 'parallel:throttled' };
          this.emit('parallel:throttled', {
            reason: 'rate-limit',
            previousMaxParallel: 4,
            effectiveMaxParallel: 2,
            floor: 1,
          });

          this._status = { status: 'running', marker: 3, event: 'parallel:recovered' };
          this.emit('parallel:recovered', {
            previousMaxParallel: 2,
            effectiveMaxParallel: 3,
            maxParallel: 4,
          });

          this._status = { status: 'completed', marker: 4 };
          return { status: 'completed' };
        }
      },
    };
  });
}

describe('runOrchestration status persistence events', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('persists status when rate-limit and adaptive parallel events are emitted', async () => {
    const workspaceRoot = createTempWorkspace();
    registerModuleMocks();

    let runOrchestration;
    jest.isolateModules(() => {
      ({ runOrchestration } = require('../../lib/commands/orchestrate'));
    });

    const onStatus = jest.fn();
    const result = await runOrchestration({
      specNames: ['spec-a'],
      silent: true,
      statusIntervalMs: 60000,
      onStatus,
    }, { workspaceRoot });

    expect(result.status).toBe('completed');
    expect(onStatus).toHaveBeenCalledTimes(4);

    const persisted = await fs.readJson(
      path.join(workspaceRoot, '.kiro', 'config', 'orchestration-status.json')
    );
    expect(persisted.marker).toBe(4);
  });
});
