/**
 * Orchestrator Integration Tests
 *
 * Tests component interactions rather than individual unit behaviour.
 * 1. Module exports: all classes importable from lib/orchestrator/index.js
 * 2. AgentSpawner events → StatusMonitor state updates
 * 3. OrchestrationEngine coordinates components correctly
 * 4. Failure in one component doesn't crash others
 */

const { EventEmitter } = require('events');

// --- Mock child_process.spawn (shared across tests) ---
let mockChildren = [];
function mockCreateChildProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  child.pid = 10000 + mockChildren.length;
  mockChildren.push(child);
  return child;
}

jest.mock('child_process', () => ({
  spawn: jest.fn(() => mockCreateChildProcess()),
}));

// --- Mock fs-utils for OrchestrationEngine spec validation ---
jest.mock('../../lib/utils/fs-utils', () => ({
  pathExists: jest.fn().mockResolvedValue(true),
  readJSON: jest.fn().mockResolvedValue({}),
  writeJSON: jest.fn().mockResolvedValue(undefined),
  ensureDirectory: jest.fn().mockResolvedValue(undefined),
}));

// --- Mock fs-extra for BootstrapPromptBuilder / OrchestratorConfig ---
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(undefined),
  ensureDir: jest.fn().mockResolvedValue(undefined),
}));

const { spawn: mockSpawn } = require('child_process');

// Helper: flush microtask queue
function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

// ============================================================================
// 1. Module Exports
// ============================================================================

describe('Module exports (lib/orchestrator/index.js)', () => {
  test('exports all five orchestrator classes', () => {
    const mod = require('../../lib/orchestrator/index');

    expect(mod.OrchestratorConfig).toBeDefined();
    expect(mod.BootstrapPromptBuilder).toBeDefined();
    expect(mod.AgentSpawner).toBeDefined();
    expect(mod.StatusMonitor).toBeDefined();
    expect(mod.OrchestrationEngine).toBeDefined();
  });

  test('exported classes are constructors', () => {
    const mod = require('../../lib/orchestrator/index');

    expect(typeof mod.OrchestratorConfig).toBe('function');
    expect(typeof mod.BootstrapPromptBuilder).toBe('function');
    expect(typeof mod.AgentSpawner).toBe('function');
    expect(typeof mod.StatusMonitor).toBe('function');
    expect(typeof mod.OrchestrationEngine).toBe('function');
  });

  test('classes match direct imports from individual modules', () => {
    const barrel = require('../../lib/orchestrator/index');
    const { OrchestratorConfig } = require('../../lib/orchestrator/orchestrator-config');
    const { BootstrapPromptBuilder } = require('../../lib/orchestrator/bootstrap-prompt-builder');
    const { AgentSpawner } = require('../../lib/orchestrator/agent-spawner');
    const { StatusMonitor } = require('../../lib/orchestrator/status-monitor');
    const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');

    expect(barrel.OrchestratorConfig).toBe(OrchestratorConfig);
    expect(barrel.BootstrapPromptBuilder).toBe(BootstrapPromptBuilder);
    expect(barrel.AgentSpawner).toBe(AgentSpawner);
    expect(barrel.StatusMonitor).toBe(StatusMonitor);
    expect(barrel.OrchestrationEngine).toBe(OrchestrationEngine);
  });
});

// ============================================================================
// 2. AgentSpawner events → StatusMonitor state flow
// ============================================================================

describe('AgentSpawner → StatusMonitor event integration', () => {
  let spawner;
  let statusMonitor;
  let mockConfig;
  let mockRegistry;
  let mockPromptBuilder;
  let mockSLM;
  let mockCSM;
  let savedApiKey;

  beforeEach(() => {
    savedApiKey = process.env.CODEX_API_KEY;
    process.env.CODEX_API_KEY = 'integration-test-key';
    mockChildren = [];
    mockSpawn.mockClear();

    mockConfig = {
      getConfig: jest.fn().mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 600,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      }),
    };

    mockRegistry = {
      register: jest.fn().mockResolvedValue({ agentId: 'int-agent-1' }),
      deregister: jest.fn().mockResolvedValue({ success: true }),
    };

    mockPromptBuilder = {
      buildPrompt: jest.fn().mockResolvedValue('Integration test prompt'),
    };

    mockSLM = {
      transition: jest.fn().mockResolvedValue({ success: true }),
    };

    mockCSM = {
      updateSpecProgress: jest.fn().mockResolvedValue(undefined),
    };

    const { AgentSpawner } = require('../../lib/orchestrator/agent-spawner');
    const { StatusMonitor } = require('../../lib/orchestrator/status-monitor');

    spawner = new AgentSpawner('/workspace', mockConfig, mockRegistry, mockPromptBuilder);
    statusMonitor = new StatusMonitor(mockSLM, mockCSM);
  });

  afterEach(() => {
    if (savedApiKey !== undefined) {
      process.env.CODEX_API_KEY = savedApiKey;
    } else {
      delete process.env.CODEX_API_KEY;
    }
  });

  test('agent:output events flow into StatusMonitor.handleEvent', async () => {
    // Wire spawner output events to statusMonitor
    spawner.on('agent:output', ({ agentId, event }) => {
      statusMonitor.handleEvent(agentId, event);
    });

    statusMonitor.initSpec('test-spec', 0);
    statusMonitor.updateSpecStatus('test-spec', 'running', 'int-agent-1');

    await spawner.spawn('test-spec');
    const child = mockChildren[0];

    // Simulate Codex JSON Lines output
    const event = { type: 'turn.completed', timestamp: new Date().toISOString() };
    child.stdout.emit('data', Buffer.from(JSON.stringify(event) + '\n'));

    // StatusMonitor should have processed the event without error
    const specStatus = statusMonitor.getSpecStatus('test-spec');
    expect(specStatus).toBeDefined();
    expect(specStatus.status).toBe('running');
  });

  test('agent completion updates StatusMonitor via wiring', async () => {
    statusMonitor.initSpec('test-spec', 0);
    statusMonitor.updateSpecStatus('test-spec', 'running', 'int-agent-1');

    // Wire spawner completion to statusMonitor
    spawner.on('agent:completed', ({ agentId, specName }) => {
      statusMonitor.updateSpecStatus(specName, 'completed', agentId);
    });

    await spawner.spawn('test-spec');
    const child = mockChildren[0];

    child.emit('close', 0);
    await flushPromises();

    const specStatus = statusMonitor.getSpecStatus('test-spec');
    expect(specStatus.status).toBe('completed');
  });

  test('agent failure updates StatusMonitor via wiring', async () => {
    statusMonitor.initSpec('test-spec', 0);
    statusMonitor.updateSpecStatus('test-spec', 'running', 'int-agent-1');

    spawner.on('agent:failed', ({ agentId, specName, stderr }) => {
      statusMonitor.updateSpecStatus(specName, 'failed', agentId, stderr);
    });

    await spawner.spawn('test-spec');
    const child = mockChildren[0];

    child.stderr.emit('data', Buffer.from('Something broke'));
    child.emit('close', 1);
    await flushPromises();

    const specStatus = statusMonitor.getSpecStatus('test-spec');
    expect(specStatus.status).toBe('failed');
  });

  test('StatusMonitor orchestration status reflects multiple specs', async () => {
    let agentCount = 0;
    mockRegistry.register.mockImplementation(() => {
      agentCount++;
      return Promise.resolve({ agentId: `int-agent-${agentCount}` });
    });

    statusMonitor.initSpec('spec-a', 0);
    statusMonitor.initSpec('spec-b', 0);
    statusMonitor.setOrchestrationState('running');
    statusMonitor.setBatchInfo(0, 1);

    spawner.on('agent:completed', ({ specName, agentId }) => {
      statusMonitor.updateSpecStatus(specName, 'completed', agentId);
    });
    spawner.on('agent:failed', ({ specName, agentId, stderr }) => {
      statusMonitor.updateSpecStatus(specName, 'failed', agentId, stderr);
    });

    await spawner.spawn('spec-a');
    const childA = mockChildren[0];
    await spawner.spawn('spec-b');
    const childB = mockChildren[1];

    // spec-a succeeds, spec-b fails
    statusMonitor.updateSpecStatus('spec-a', 'running', 'int-agent-1');
    statusMonitor.updateSpecStatus('spec-b', 'running', 'int-agent-2');

    childA.emit('close', 0);
    childB.stderr.emit('data', Buffer.from('fail'));
    childB.emit('close', 1);
    await flushPromises();

    const overall = statusMonitor.getOrchestrationStatus();
    expect(overall.specs['spec-a'].status).toBe('completed');
    expect(overall.specs['spec-b'].status).toBe('failed');
  });
});

// ============================================================================
// 3. OrchestrationEngine + components coordination
// ============================================================================

describe('OrchestrationEngine component coordination', () => {
  let engine;
  let mockSpawnerEmitter;
  let mockDependencyManager;
  let mockSLM;
  let mockStatusMonitor;
  let mockConfig;
  let mockRegistry;
  let spawnCounter;

  beforeEach(() => {
    spawnCounter = 0;

    // Real EventEmitter-based mock spawner so engine can listen for events
    mockSpawnerEmitter = new EventEmitter();
    mockSpawnerEmitter.spawn = jest.fn().mockImplementation((specName) => {
      spawnCounter++;
      const agentId = `coord-agent-${spawnCounter}`;
      // Auto-complete after a tick
      process.nextTick(() => {
        mockSpawnerEmitter.emit('agent:completed', { agentId, specName, exitCode: 0 });
      });
      return Promise.resolve({ agentId, specName, status: 'running' });
    });
    mockSpawnerEmitter.kill = jest.fn().mockResolvedValue(undefined);
    mockSpawnerEmitter.killAll = jest.fn().mockResolvedValue(undefined);

    mockDependencyManager = {
      buildDependencyGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
      detectCircularDependencies: jest.fn().mockReturnValue(null),
    };

    mockSLM = {
      transition: jest.fn().mockResolvedValue({ success: true }),
    };

    mockStatusMonitor = {
      initSpec: jest.fn(),
      updateSpecStatus: jest.fn(),
      incrementRetry: jest.fn(),
      setOrchestrationState: jest.fn(),
      setBatchInfo: jest.fn(),
      getOrchestrationStatus: jest.fn().mockReturnValue({
        status: 'idle',
        totalSpecs: 0,
        completedSpecs: 0,
        failedSpecs: 0,
        runningSpecs: 0,
        currentBatch: 0,
        totalBatches: 0,
        specs: {},
      }),
      syncExternalStatus: jest.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      getConfig: jest.fn().mockResolvedValue({
        maxParallel: 3,
        maxRetries: 0,
        timeoutSeconds: 600,
      }),
    };

    mockRegistry = {
      register: jest.fn().mockResolvedValue({ agentId: 'coord-agent-1' }),
      deregister: jest.fn().mockResolvedValue({ success: true }),
    };

    const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');
    engine = new OrchestrationEngine('/workspace', {
      agentSpawner: mockSpawnerEmitter,
      dependencyManager: mockDependencyManager,
      specLifecycleManager: mockSLM,
      statusMonitor: mockStatusMonitor,
      orchestratorConfig: mockConfig,
      agentRegistry: mockRegistry,
    });
  });

  test('engine transitions SLM states: assigned → in-progress → completed', async () => {
    await engine.start(['spec-x']);

    // Should have called transition for assigned, in-progress, completed
    const calls = mockSLM.transition.mock.calls.map(([name, status]) => status);
    expect(calls).toContain('assigned');
    expect(calls).toContain('in-progress');
    expect(calls).toContain('completed');
  });

  test('engine initialises specs in StatusMonitor before execution', async () => {
    await engine.start(['spec-a', 'spec-b']);

    expect(mockStatusMonitor.initSpec).toHaveBeenCalledWith('spec-a', 0);
    expect(mockStatusMonitor.initSpec).toHaveBeenCalledWith('spec-b', 0);
    expect(mockStatusMonitor.setBatchInfo).toHaveBeenCalledWith(0, 1);
  });

  test('engine sets orchestration state to running then completed', async () => {
    await engine.start(['spec-a']);

    const states = mockStatusMonitor.setOrchestrationState.mock.calls.map(([s]) => s);
    expect(states[0]).toBe('running');
    expect(states[states.length - 1]).toBe('completed');
  });

  test('engine syncs external status on spec completion', async () => {
    await engine.start(['spec-a']);

    expect(mockStatusMonitor.syncExternalStatus).toHaveBeenCalledWith('spec-a', 'completed');
  });

  test('engine emits orchestration:complete event', async () => {
    const handler = jest.fn();
    engine.on('orchestration:complete', handler);

    await engine.start(['spec-a']);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  test('engine handles spec failure and propagates to StatusMonitor', async () => {
    mockSpawnerEmitter.spawn.mockImplementation((specName) => {
      spawnCounter++;
      const agentId = `coord-agent-${spawnCounter}`;
      process.nextTick(() => {
        mockSpawnerEmitter.emit('agent:failed', {
          agentId,
          specName,
          exitCode: 1,
          stderr: 'build error',
          error: 'build error',
        });
      });
      return Promise.resolve({ agentId, specName, status: 'running' });
    });

    const result = await engine.start(['spec-fail']);

    expect(result.status).toBe('failed');
    expect(mockStatusMonitor.updateSpecStatus).toHaveBeenCalledWith(
      'spec-fail', 'failed', expect.any(String), expect.any(String)
    );
  });
});

// ============================================================================
// 4. Failure isolation — one component error doesn't crash others
// ============================================================================

describe('Failure isolation', () => {
  test('SLM transition failure does not crash OrchestrationEngine', async () => {
    const mockSpawnerEmitter = new EventEmitter();
    mockSpawnerEmitter.spawn = jest.fn().mockImplementation((specName) => {
      const agentId = `iso-agent-1`;
      process.nextTick(() => {
        mockSpawnerEmitter.emit('agent:completed', { agentId, specName, exitCode: 0 });
      });
      return Promise.resolve({ agentId, specName, status: 'running' });
    });
    mockSpawnerEmitter.kill = jest.fn().mockResolvedValue(undefined);
    mockSpawnerEmitter.killAll = jest.fn().mockResolvedValue(undefined);

    const failingSLM = {
      transition: jest.fn().mockRejectedValue(new Error('SLM unavailable')),
    };

    const mockStatusMonitor = {
      initSpec: jest.fn(),
      updateSpecStatus: jest.fn(),
      incrementRetry: jest.fn(),
      setOrchestrationState: jest.fn(),
      setBatchInfo: jest.fn(),
      getOrchestrationStatus: jest.fn().mockReturnValue({ status: 'idle', specs: {} }),
      syncExternalStatus: jest.fn().mockResolvedValue(undefined),
    };

    const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');
    const engine = new OrchestrationEngine('/workspace', {
      agentSpawner: mockSpawnerEmitter,
      dependencyManager: {
        buildDependencyGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        detectCircularDependencies: jest.fn().mockReturnValue(null),
      },
      specLifecycleManager: failingSLM,
      statusMonitor: mockStatusMonitor,
      orchestratorConfig: {
        getConfig: jest.fn().mockResolvedValue({ maxParallel: 3, maxRetries: 0, timeoutSeconds: 600 }),
      },
      agentRegistry: {
        register: jest.fn().mockResolvedValue({ agentId: 'iso-agent-1' }),
        deregister: jest.fn().mockResolvedValue({ success: true }),
      },
    });

    // Should not throw despite SLM failures
    const result = await engine.start(['spec-a']);
    expect(result.status).toBe('completed');
  });

  test('StatusMonitor syncExternalStatus failure does not crash engine', async () => {
    const mockSpawnerEmitter = new EventEmitter();
    mockSpawnerEmitter.spawn = jest.fn().mockImplementation((specName) => {
      const agentId = `iso-agent-2`;
      process.nextTick(() => {
        mockSpawnerEmitter.emit('agent:completed', { agentId, specName, exitCode: 0 });
      });
      return Promise.resolve({ agentId, specName, status: 'running' });
    });
    mockSpawnerEmitter.kill = jest.fn().mockResolvedValue(undefined);
    mockSpawnerEmitter.killAll = jest.fn().mockResolvedValue(undefined);

    const failingSyncMonitor = {
      initSpec: jest.fn(),
      updateSpecStatus: jest.fn(),
      incrementRetry: jest.fn(),
      setOrchestrationState: jest.fn(),
      setBatchInfo: jest.fn(),
      getOrchestrationStatus: jest.fn().mockReturnValue({ status: 'idle', specs: {} }),
      syncExternalStatus: jest.fn().mockRejectedValue(new Error('CSM down')),
    };

    const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');
    const engine = new OrchestrationEngine('/workspace', {
      agentSpawner: mockSpawnerEmitter,
      dependencyManager: {
        buildDependencyGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
        detectCircularDependencies: jest.fn().mockReturnValue(null),
      },
      specLifecycleManager: {
        transition: jest.fn().mockResolvedValue({ success: true }),
      },
      statusMonitor: failingSyncMonitor,
      orchestratorConfig: {
        getConfig: jest.fn().mockResolvedValue({ maxParallel: 3, maxRetries: 0, timeoutSeconds: 600 }),
      },
      agentRegistry: {
        register: jest.fn().mockResolvedValue({ agentId: 'iso-agent-2' }),
        deregister: jest.fn().mockResolvedValue({ success: true }),
      },
    });

    // Should not throw despite sync failure
    const result = await engine.start(['spec-a']);
    expect(result.status).toBe('completed');
  });

  test('AgentRegistry deregister failure does not crash AgentSpawner', async () => {
    process.env.CODEX_API_KEY = 'test-key';
    mockChildren = [];
    mockSpawn.mockClear();

    const failingRegistry = {
      register: jest.fn().mockResolvedValue({ agentId: 'iso-agent-3' }),
      deregister: jest.fn().mockRejectedValue(new Error('Registry down')),
    };

    const { AgentSpawner } = require('../../lib/orchestrator/agent-spawner');
    const spawner = new AgentSpawner('/workspace', {
      getConfig: jest.fn().mockResolvedValue({
        agentBackend: 'codex', maxParallel: 3, timeoutSeconds: 600,
        maxRetries: 2, apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null, codexArgs: [],
      }),
    }, failingRegistry, {
      buildPrompt: jest.fn().mockResolvedValue('test prompt'),
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await spawner.spawn('test-spec');
    const child = mockChildren[mockChildren.length - 1];
    child.emit('close', 0);
    await flushPromises();

    // Should warn but not throw
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
