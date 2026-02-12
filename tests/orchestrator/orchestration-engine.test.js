/**
 * OrchestrationEngine Unit Tests
 *
 * Validates: Requirements 3.1-3.7, 5.1-5.6
 * - 3.1: Build dependency graph (DAG)
 * - 3.2: Circular dependency detection
 * - 3.3: Batch computation (topological sort)
 * - 3.5: Parallel control (maxParallel)
 * - 3.6: Failure propagation (skip dependents)
 * - 3.7: DependencyManager integration
 * - 5.1: Crash detection
 * - 5.2: Retry on failure
 * - 5.3: Final failure after maxRetries
 * - 5.5: Graceful stop
 * - 5.6: Deregister on completion
 */

const { EventEmitter } = require('events');

// --- Mock fs-utils (pathExists for spec validation) ---
jest.mock('../../lib/utils/fs-utils', () => ({
  pathExists: jest.fn(),
}));

const fsUtils = require('../../lib/utils/fs-utils');
const { OrchestrationEngine } = require('../../lib/orchestrator/orchestration-engine');

// Helper: flush microtask queue
function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

describe('OrchestrationEngine', () => {
  let engine;
  let mockSpawner;
  let mockDependencyManager;
  let mockSLM;
  let mockStatusMonitor;
  let mockConfig;
  let mockRegistry;
  let spawnCounter;

  beforeEach(() => {
    spawnCounter = 0;

    // --- MockAgentSpawner (EventEmitter) ---
    mockSpawner = new EventEmitter();
    mockSpawner.spawn = jest.fn().mockImplementation((specName) => {
      spawnCounter++;
      const agentId = `agent-${specName}`;
      // Default: emit completion after a tick
      process.nextTick(() => {
        mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
      });
      return Promise.resolve({ agentId, specName, status: 'running' });
    });
    mockSpawner.kill = jest.fn().mockResolvedValue(undefined);
    mockSpawner.killAll = jest.fn().mockResolvedValue(undefined);

    // --- MockDependencyManager ---
    mockDependencyManager = {
      buildDependencyGraph: jest.fn().mockResolvedValue({ nodes: [], edges: [] }),
      detectCircularDependencies: jest.fn().mockReturnValue(null),
    };

    // --- MockSpecLifecycleManager ---
    mockSLM = {
      transition: jest.fn().mockResolvedValue({ success: true }),
    };

    // --- MockStatusMonitor ---
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

    // --- MockOrchestratorConfig ---
    mockConfig = {
      getConfig: jest.fn().mockResolvedValue({
        maxParallel: 3,
        maxRetries: 2,
        timeoutSeconds: 600,
      }),
    };

    // --- MockAgentRegistry ---
    mockRegistry = {};

    // All specs exist by default
    fsUtils.pathExists.mockResolvedValue(true);

    engine = new OrchestrationEngine('/workspace', {
      agentSpawner: mockSpawner,
      dependencyManager: mockDependencyManager,
      specLifecycleManager: mockSLM,
      statusMonitor: mockStatusMonitor,
      orchestratorConfig: mockConfig,
      agentRegistry: mockRegistry,
    });
  });

  afterEach(() => {
    engine.removeAllListeners();
    mockSpawner.removeAllListeners();
  });

  // -------------------------------------------------------------------------
  // Batch Computation (Req 3.1, 3.3)
  // -------------------------------------------------------------------------

  describe('batch computation (Req 3.1, 3.3)', () => {
    test('independent specs → single batch', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b', 'spec-c'],
        edges: [],
      });

      const result = await engine.start(['spec-a', 'spec-b', 'spec-c']);

      expect(result.status).not.toBe('failed');
      expect(result.plan).toBeDefined();
      expect(result.plan.batches).toHaveLength(1);
      expect(result.plan.batches[0]).toEqual(
        expect.arrayContaining(['spec-a', 'spec-b', 'spec-c'])
      );
    });

    test('linear dependency chain → sequential batches', async () => {
      // A → B → C (C depends on B, B depends on A)
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b', 'spec-c'],
        edges: [
          { from: 'spec-b', to: 'spec-a' },
          { from: 'spec-c', to: 'spec-b' },
        ],
      });

      const result = await engine.start(['spec-a', 'spec-b', 'spec-c']);

      expect(result.plan.batches).toHaveLength(3);
      expect(result.plan.batches[0]).toEqual(['spec-a']);
      expect(result.plan.batches[1]).toEqual(['spec-b']);
      expect(result.plan.batches[2]).toEqual(['spec-c']);
    });

    test('diamond dependency → correct batch grouping', async () => {
      // A → B, A → C, B → D, C → D (D depends on B and C, B and C depend on A)
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b', 'spec-c', 'spec-d'],
        edges: [
          { from: 'spec-b', to: 'spec-a' },
          { from: 'spec-c', to: 'spec-a' },
          { from: 'spec-d', to: 'spec-b' },
          { from: 'spec-d', to: 'spec-c' },
        ],
      });

      const result = await engine.start(['spec-a', 'spec-b', 'spec-c', 'spec-d']);

      expect(result.plan.batches).toHaveLength(3);
      expect(result.plan.batches[0]).toEqual(['spec-a']);
      expect(result.plan.batches[1]).toEqual(
        expect.arrayContaining(['spec-b', 'spec-c'])
      );
      expect(result.plan.batches[2]).toEqual(['spec-d']);
    });
  });

  // -------------------------------------------------------------------------
  // Circular Dependency Detection (Req 3.2)
  // -------------------------------------------------------------------------

  describe('circular dependency detection (Req 3.2)', () => {
    test('circular dependency → returns failed result with cycle path', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b'],
        edges: [
          { from: 'spec-a', to: 'spec-b' },
          { from: 'spec-b', to: 'spec-a' },
        ],
      });
      mockDependencyManager.detectCircularDependencies.mockReturnValue([
        'spec-a', 'spec-b', 'spec-a',
      ]);

      const result = await engine.start(['spec-a', 'spec-b']);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Circular dependency detected');
      expect(result.error).toContain('spec-a');
      expect(result.error).toContain('spec-b');
      expect(result.plan.hasCycle).toBe(true);
      expect(result.plan.cyclePath).toEqual(['spec-a', 'spec-b', 'spec-a']);
      // Should NOT have spawned any agents
      expect(mockSpawner.spawn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Parallel Control (Req 3.5)
  // -------------------------------------------------------------------------

  describe('parallel control (Req 3.5)', () => {
    test('maxParallel limits concurrent spawns', async () => {
      // 5 independent specs, maxParallel = 2
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['s1', 's2', 's3', 's4', 's5'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 2, maxRetries: 0 });

      // Track concurrent spawns
      let concurrentCount = 0;
      let maxConcurrent = 0;

      mockSpawner.spawn.mockImplementation((specName) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        const agentId = `agent-${specName}`;

        // Emit completion after a small delay
        setTimeout(() => {
          concurrentCount--;
          mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
        }, 10);

        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['s1', 's2', 's3', 's4', 's5']);

      expect(result.status).not.toBe('failed');
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(mockSpawner.spawn).toHaveBeenCalledTimes(5);
    });

    test('maxParallel from options overrides config', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['s1', 's2', 's3'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 10, maxRetries: 0 });

      let maxConcurrent = 0;
      let concurrentCount = 0;

      mockSpawner.spawn.mockImplementation((specName) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        const agentId = `agent-${specName}`;
        setTimeout(() => {
          concurrentCount--;
          mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
        }, 10);
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      await engine.start(['s1', 's2', 's3'], { maxParallel: 1 });

      expect(maxConcurrent).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // Failure Propagation (Req 3.6)
  // -------------------------------------------------------------------------

  describe('failure propagation (Req 3.6)', () => {
    test('failed spec → dependents marked as skipped', async () => {
      // A → B (B depends on A). A fails → B skipped
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b'],
        edges: [{ from: 'spec-b', to: 'spec-a' }],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 0 });

      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        process.nextTick(() => {
          if (specName === 'spec-a') {
            mockSpawner.emit('agent:failed', {
              agentId, specName, exitCode: 1, stderr: 'error',
            });
          } else {
            mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
          }
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['spec-a', 'spec-b']);

      expect(result.failed).toContain('spec-a');
      expect(result.skipped).toContain('spec-b');
      // spec-b should never have been spawned
      const spawnedSpecs = mockSpawner.spawn.mock.calls.map(c => c[0]);
      expect(spawnedSpecs).not.toContain('spec-b');
    });

    test('indirect dependents also skipped', async () => {
      // A → B → C (C depends on B, B depends on A). A fails → B,C skipped
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b', 'spec-c'],
        edges: [
          { from: 'spec-b', to: 'spec-a' },
          { from: 'spec-c', to: 'spec-b' },
        ],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 0 });

      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        process.nextTick(() => {
          mockSpawner.emit('agent:failed', {
            agentId, specName, exitCode: 1, stderr: 'error',
          });
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['spec-a', 'spec-b', 'spec-c']);

      expect(result.failed).toContain('spec-a');
      expect(result.skipped).toContain('spec-b');
      expect(result.skipped).toContain('spec-c');
    });
  });

  // -------------------------------------------------------------------------
  // Retry (Req 5.2, 5.3)
  // -------------------------------------------------------------------------

  describe('retry (Req 5.2, 5.3)', () => {
    test('failed spec retried up to maxRetries', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 2 });

      let callCount = 0;
      mockSpawner.spawn.mockImplementation((specName) => {
        callCount++;
        const agentId = `agent-${specName}-${callCount}`;
        process.nextTick(() => {
          if (callCount <= 2) {
            // First 2 calls fail (original + 1 retry)
            mockSpawner.emit('agent:failed', {
              agentId, specName, exitCode: 1, stderr: 'error',
            });
          } else {
            // Third call (2nd retry) succeeds
            mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
          }
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['spec-a']);

      // spawn called 3 times: original + 2 retries
      expect(mockSpawner.spawn).toHaveBeenCalledTimes(3);
      expect(result.completed).toContain('spec-a');
      expect(result.failed).not.toContain('spec-a');
    });

    test('after maxRetries exhausted → final failure', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 1 });

      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        process.nextTick(() => {
          mockSpawner.emit('agent:failed', {
            agentId, specName, exitCode: 1, stderr: 'always fails',
          });
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['spec-a']);

      // spawn called 2 times: original + 1 retry
      expect(mockSpawner.spawn).toHaveBeenCalledTimes(2);
      expect(result.failed).toContain('spec-a');
      expect(result.status).toBe('failed');
    });

    test('incrementRetry called on StatusMonitor during retry', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 1 });

      let callCount = 0;
      mockSpawner.spawn.mockImplementation((specName) => {
        callCount++;
        const agentId = `agent-${specName}-${callCount}`;
        process.nextTick(() => {
          if (callCount === 1) {
            mockSpawner.emit('agent:failed', {
              agentId, specName, exitCode: 1, stderr: 'error',
            });
          } else {
            mockSpawner.emit('agent:completed', { agentId, specName, exitCode: 0 });
          }
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      await engine.start(['spec-a']);

      expect(mockStatusMonitor.incrementRetry).toHaveBeenCalledWith('spec-a');
    });
  });

  // -------------------------------------------------------------------------
  // Stop (Req 5.5)
  // -------------------------------------------------------------------------

  describe('stop (Req 5.5)', () => {
    test('stop() calls killAll and marks as stopped', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      // Spawn but never complete — hold the agent running
      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        // Do NOT emit completion — agent stays running
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      // Start orchestration in background
      const startPromise = engine.start(['spec-a']);

      // Wait for spawn to be called
      await flushPromises();

      // Now stop
      await engine.stop();

      expect(mockSpawner.killAll).toHaveBeenCalled();
      expect(mockStatusMonitor.setOrchestrationState).toHaveBeenCalledWith('stopped');

      // The start promise should eventually resolve with stopped status
      // Emit completion so _waitForAgent resolves
      mockSpawner.emit('agent:completed', {
        agentId: 'agent-spec-a', specName: 'spec-a', exitCode: 0,
      });

      const result = await startPromise;
      expect(result.status).toBe('stopped');
    });

    test('stop() when not running is a no-op', async () => {
      await engine.stop();
      expect(mockSpawner.killAll).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Spec Existence Validation (Req 6.4)
  // -------------------------------------------------------------------------

  describe('spec existence validation (Req 6.4)', () => {
    test('missing specs → failed result listing missing specs', async () => {
      fsUtils.pathExists.mockImplementation((specDir) => {
        if (specDir.includes('missing-spec')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const result = await engine.start(['good-spec', 'missing-spec']);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('missing-spec');
      expect(mockSpawner.spawn).not.toHaveBeenCalled();
    });

    test('all specs exist → proceeds normally', async () => {
      fsUtils.pathExists.mockResolvedValue(true);
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      const result = await engine.start(['spec-a']);

      expect(result.status).not.toBe('failed');
      expect(mockSpawner.spawn).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  describe('events', () => {
    test('emits batch:start and batch:complete', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      const batchStartHandler = jest.fn();
      const batchCompleteHandler = jest.fn();
      engine.on('batch:start', batchStartHandler);
      engine.on('batch:complete', batchCompleteHandler);

      await engine.start(['spec-a']);

      expect(batchStartHandler).toHaveBeenCalledWith(
        expect.objectContaining({ batch: 0, specs: ['spec-a'] })
      );
      expect(batchCompleteHandler).toHaveBeenCalledWith(
        expect.objectContaining({ batch: 0 })
      );
    });

    test('emits spec:start and spec:complete on success', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      const specStartHandler = jest.fn();
      const specCompleteHandler = jest.fn();
      engine.on('spec:start', specStartHandler);
      engine.on('spec:complete', specCompleteHandler);

      await engine.start(['spec-a']);

      expect(specStartHandler).toHaveBeenCalledWith(
        expect.objectContaining({ specName: 'spec-a' })
      );
      expect(specCompleteHandler).toHaveBeenCalledWith(
        expect.objectContaining({ specName: 'spec-a', agentId: 'agent-spec-a' })
      );
    });

    test('emits spec:failed on failure', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 0 });

      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        process.nextTick(() => {
          mockSpawner.emit('agent:failed', {
            agentId, specName, exitCode: 1, stderr: 'boom',
          });
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const specFailedHandler = jest.fn();
      engine.on('spec:failed', specFailedHandler);

      await engine.start(['spec-a']);

      expect(specFailedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          specName: 'spec-a',
          agentId: 'agent-spec-a',
          error: expect.any(String),
        })
      );
    });

    test('emits orchestration:complete', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      const orchCompleteHandler = jest.fn();
      engine.on('orchestration:complete', orchCompleteHandler);

      await engine.start(['spec-a']);

      expect(orchCompleteHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          plan: expect.any(Object),
          completed: expect.any(Array),
          failed: expect.any(Array),
          skipped: expect.any(Array),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // SLM Integration (Req 8.1, 8.2)
  // -------------------------------------------------------------------------

  describe('SLM integration (Req 8.1, 8.2)', () => {
    test('transitions through assigned → in-progress → completed', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      await engine.start(['spec-a']);

      const transitionCalls = mockSLM.transition.mock.calls.map(c => c);
      // Should have: assigned, in-progress, completed
      expect(transitionCalls).toEqual(
        expect.arrayContaining([
          ['spec-a', 'assigned'],
          ['spec-a', 'in-progress'],
          ['spec-a', 'completed'],
        ])
      );
    });

    test('SLM transition failure is non-fatal', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockSLM.transition.mockRejectedValue(new Error('SLM unavailable'));

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await engine.start(['spec-a']);

      // Should still complete despite SLM failures
      expect(result.completed).toContain('spec-a');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // StatusMonitor Integration
  // -------------------------------------------------------------------------

  describe('StatusMonitor integration', () => {
    test('initSpec called for each spec with batch index', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a', 'spec-b'],
        edges: [{ from: 'spec-b', to: 'spec-a' }],
      });

      await engine.start(['spec-a', 'spec-b']);

      expect(mockStatusMonitor.initSpec).toHaveBeenCalledWith('spec-a', 0);
      expect(mockStatusMonitor.initSpec).toHaveBeenCalledWith('spec-b', 1);
    });

    test('setBatchInfo called with batch progress', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      await engine.start(['spec-a']);

      // Initial setBatchInfo(0, 1) then setBatchInfo(1, 1) during execution
      expect(mockStatusMonitor.setBatchInfo).toHaveBeenCalledWith(0, 1);
      expect(mockStatusMonitor.setBatchInfo).toHaveBeenCalledWith(1, 1);
    });

    test('updateSpecStatus called with running then completed', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      await engine.start(['spec-a']);

      expect(mockStatusMonitor.updateSpecStatus).toHaveBeenCalledWith('spec-a', 'running');
      expect(mockStatusMonitor.updateSpecStatus).toHaveBeenCalledWith(
        'spec-a', 'completed', 'agent-spec-a'
      );
    });

    test('syncExternalStatus called on completion', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      await engine.start(['spec-a']);

      expect(mockStatusMonitor.syncExternalStatus).toHaveBeenCalledWith('spec-a', 'completed');
    });

    test('setOrchestrationState tracks lifecycle', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      await engine.start(['spec-a']);

      const states = mockStatusMonitor.setOrchestrationState.mock.calls.map(c => c[0]);
      expect(states[0]).toBe('running');
      expect(states[states.length - 1]).toBe('completed');
    });
  });

  // -------------------------------------------------------------------------
  // getStatus()
  // -------------------------------------------------------------------------

  describe('getStatus()', () => {
    test('delegates to StatusMonitor.getOrchestrationStatus', () => {
      const mockStatus = { status: 'running', totalSpecs: 5 };
      mockStatusMonitor.getOrchestrationStatus.mockReturnValue(mockStatus);

      const status = engine.getStatus();

      expect(status).toBe(mockStatus);
      expect(mockStatusMonitor.getOrchestrationStatus).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Already running guard
  // -------------------------------------------------------------------------

  describe('already running guard', () => {
    test('throws if start() called while already running', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });

      // Hold the agent running so orchestration stays in 'running' state
      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      // Start first orchestration (will hang waiting for agent)
      const firstStart = engine.start(['spec-a']);
      await flushPromises();

      // Try to start again
      await expect(engine.start(['spec-a'])).rejects.toThrow(
        'Orchestration is already running'
      );

      // Cleanup: emit completion so first start resolves
      mockSpawner.emit('agent:completed', {
        agentId: 'agent-spec-a', specName: 'spec-a', exitCode: 0,
      });
      await firstStart;
    });
  });

  // -------------------------------------------------------------------------
  // Timeout handling (via agent:timeout event)
  // -------------------------------------------------------------------------

  describe('timeout handling (Req 5.4)', () => {
    test('agent timeout treated as failure', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 0 });

      mockSpawner.spawn.mockImplementation((specName) => {
        const agentId = `agent-${specName}`;
        process.nextTick(() => {
          mockSpawner.emit('agent:timeout', {
            agentId, specName, timeoutSeconds: 600,
          });
        });
        return Promise.resolve({ agentId, specName, status: 'running' });
      });

      const result = await engine.start(['spec-a']);

      expect(result.failed).toContain('spec-a');
      expect(result.status).toBe('failed');
    });
  });

  // -------------------------------------------------------------------------
  // Spawn failure (Req 5.1)
  // -------------------------------------------------------------------------

  describe('spawn failure (Req 5.1)', () => {
    test('spawn rejection triggers retry then failure', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockConfig.getConfig.mockResolvedValue({ maxParallel: 3, maxRetries: 0 });

      mockSpawner.spawn.mockRejectedValue(new Error('spawn failed'));

      const result = await engine.start(['spec-a']);

      expect(result.failed).toContain('spec-a');
      expect(result.status).toBe('failed');
    });
  });

  // -------------------------------------------------------------------------
  // External sync failure is non-fatal
  // -------------------------------------------------------------------------

  describe('external sync failure', () => {
    test('syncExternalStatus failure is non-fatal', async () => {
      mockDependencyManager.buildDependencyGraph.mockResolvedValue({
        nodes: ['spec-a'],
        edges: [],
      });
      mockStatusMonitor.syncExternalStatus.mockRejectedValue(
        new Error('sync failed')
      );

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await engine.start(['spec-a']);

      expect(result.completed).toContain('spec-a');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
