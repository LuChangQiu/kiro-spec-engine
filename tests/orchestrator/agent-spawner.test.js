/**
 * AgentSpawner Unit Tests
 *
 * Validates: Requirements 1.1-1.7
 * - 1.1: Spawn Codex CLI via child_process.spawn
 * - 1.2: Pass CODEX_API_KEY via environment
 * - 1.3: Include --json flag
 * - 1.4: Exit code 0 → completed status
 * - 1.5: Exit code non-0 → failed status
 * - 1.6: Timeout → terminate process
 * - 1.7: Register in AgentRegistry
 */

const { EventEmitter } = require('events');

// --- Mock child_process.spawn ---
let mockChildProcess;
const mockChildren = [];

function mockCreateChildProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  child.pid = 12345 + mockChildren.length;
  mockChildren.push(child);
  return child;
}

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    mockChildProcess = mockCreateChildProcess();
    return mockChildProcess;
  }),
}));

const { spawn: mockSpawn } = require('child_process');
const { AgentSpawner } = require('../../lib/orchestrator/agent-spawner');

// Helper: flush microtask queue
function flushPromises() {
  return new Promise((resolve) => process.nextTick(resolve));
}

describe('AgentSpawner', () => {
  let spawner;
  let mockConfig;
  let mockRegistry;
  let mockPromptBuilder;
  let savedApiKey;

  beforeEach(() => {
    savedApiKey = process.env.CODEX_API_KEY;
    process.env.CODEX_API_KEY = 'test-api-key-123';
    mockChildren.length = 0;
    mockChildProcess = null;

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
      register: jest.fn().mockResolvedValue({ agentId: 'test-agent-1' }),
      deregister: jest.fn().mockResolvedValue({ success: true }),
    };

    mockPromptBuilder = {
      buildPrompt: jest.fn().mockResolvedValue('Execute Spec test-spec with full context.'),
    };

    spawner = new AgentSpawner('/workspace', mockConfig, mockRegistry, mockPromptBuilder);
    mockSpawn.mockClear();
  });

  afterEach(() => {
    if (savedApiKey !== undefined) {
      process.env.CODEX_API_KEY = savedApiKey;
    } else {
      delete process.env.CODEX_API_KEY;
    }
  });

  // -------------------------------------------------------------------------
  // spawn() — process creation and arguments
  // -------------------------------------------------------------------------

  describe('spawn()', () => {
    test('creates child process with correct command and arguments (Req 1.1)', async () => {
      await spawner.spawn('my-spec');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args, opts] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('codex');
      expect(args).toContain('exec');
      expect(args).toContain('--full-auto');
      expect(args).toContain('--sandbox');
      expect(args).toContain('danger-full-access');
    });

    test('passes CODEX_API_KEY via environment (Req 1.2)', async () => {
      await spawner.spawn('my-spec');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env).toBeDefined();
      expect(opts.env.CODEX_API_KEY).toBe('test-api-key-123');
    });

    test('includes --json flag for structured output (Req 1.3)', async () => {
      await spawner.spawn('my-spec');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--json');
    });

    test('passes the bootstrap prompt as the last argument', async () => {
      await spawner.spawn('my-spec');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args[args.length - 1]).toBe('Execute Spec test-spec with full context.');
      expect(mockPromptBuilder.buildPrompt).toHaveBeenCalledWith('my-spec');
    });

    test('registers agent in AgentRegistry (Req 1.7)', async () => {
      const agent = await spawner.spawn('my-spec');

      expect(mockRegistry.register).toHaveBeenCalledWith({
        currentTask: { specName: 'my-spec' },
      });
      expect(agent.agentId).toBe('test-agent-1');
    });

    test('returns a SpawnedAgent record with correct initial state', async () => {
      const agent = await spawner.spawn('my-spec');

      expect(agent.specName).toBe('my-spec');
      expect(agent.status).toBe('running');
      expect(agent.exitCode).toBeNull();
      expect(agent.completedAt).toBeNull();
      expect(agent.retryCount).toBe(0);
      expect(agent.stderr).toBe('');
      expect(agent.events).toEqual([]);
      expect(agent.startedAt).toBeDefined();
    });

    test('throws when API key env var is not set', async () => {
      delete process.env.CODEX_API_KEY;

      await expect(spawner.spawn('my-spec')).rejects.toThrow(
        'Environment variable CODEX_API_KEY is not set'
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('uses custom apiKeyEnvVar from config', async () => {
      process.env.MY_CUSTOM_KEY = 'custom-key-456';
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 600,
        maxRetries: 2,
        apiKeyEnvVar: 'MY_CUSTOM_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      await spawner.spawn('my-spec');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.MY_CUSTOM_KEY).toBe('custom-key-456');

      delete process.env.MY_CUSTOM_KEY;
    });

    test('appends extra codexArgs from config', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 600,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: ['--model', 'gpt-4'],
      });

      await spawner.spawn('my-spec');

      const [, args] = mockSpawn.mock.calls[0];
      expect(args).toContain('--model');
      expect(args).toContain('gpt-4');
    });

    test('sets cwd to workspaceRoot', async () => {
      await spawner.spawn('my-spec');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.cwd).toBe('/workspace');
    });
  });

  // -------------------------------------------------------------------------
  // Process close — status transitions
  // -------------------------------------------------------------------------

  describe('process close — status transitions', () => {
    test('exit code 0 → completed status + agent:completed event (Req 1.4)', async () => {
      const completedHandler = jest.fn();
      spawner.on('agent:completed', completedHandler);

      const agent = await spawner.spawn('my-spec');
      mockChildProcess.emit('close', 0);
      await flushPromises();

      expect(agent.status).toBe('completed');
      expect(agent.exitCode).toBe(0);
      expect(agent.completedAt).toBeDefined();
      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          specName: 'my-spec',
          exitCode: 0,
        })
      );
    });

    test('exit code non-0 → failed status + agent:failed event with stderr (Req 1.5)', async () => {
      const failedHandler = jest.fn();
      spawner.on('agent:failed', failedHandler);

      const agent = await spawner.spawn('my-spec');

      mockChildProcess.stderr.emit('data', Buffer.from('Error: something went wrong'));
      mockChildProcess.emit('close', 1);
      await flushPromises();

      expect(agent.status).toBe('failed');
      expect(agent.exitCode).toBe(1);
      expect(agent.completedAt).toBeDefined();
      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          specName: 'my-spec',
          exitCode: 1,
          stderr: 'Error: something went wrong',
        })
      );
    });

    test('deregisters from AgentRegistry on completion', async () => {
      await spawner.spawn('my-spec');
      mockChildProcess.emit('close', 0);
      await flushPromises();

      expect(mockRegistry.deregister).toHaveBeenCalledWith('test-agent-1');
    });

    test('deregisters from AgentRegistry on failure', async () => {
      await spawner.spawn('my-spec');
      mockChildProcess.emit('close', 1);
      await flushPromises();

      expect(mockRegistry.deregister).toHaveBeenCalledWith('test-agent-1');
    });

    test('ignores close event if status is no longer running', async () => {
      const completedHandler = jest.fn();
      spawner.on('agent:completed', completedHandler);

      const agent = await spawner.spawn('my-spec');

      // Manually set status to simulate timeout already handled
      agent.status = 'timeout';
      mockChildProcess.emit('close', 0);
      await flushPromises();

      expect(agent.status).toBe('timeout');
      expect(completedHandler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Spawn error handling
  // -------------------------------------------------------------------------

  describe('spawn error (command not found)', () => {
    test('spawn error → failed status + agent:failed event', async () => {
      const failedHandler = jest.fn();
      spawner.on('agent:failed', failedHandler);

      const agent = await spawner.spawn('my-spec');
      mockChildProcess.emit('error', new Error('spawn codex ENOENT'));
      await flushPromises();

      expect(agent.status).toBe('failed');
      expect(agent.completedAt).toBeDefined();
      expect(agent.stderr).toContain('Spawn error: spawn codex ENOENT');
      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          specName: 'my-spec',
          error: 'spawn codex ENOENT',
        })
      );
    });

    test('spawn error deregisters from AgentRegistry', async () => {
      await spawner.spawn('my-spec');
      mockChildProcess.emit('error', new Error('spawn codex ENOENT'));
      await flushPromises();

      expect(mockRegistry.deregister).toHaveBeenCalledWith('test-agent-1');
    });
  });

  // -------------------------------------------------------------------------
  // Timeout handling (uses fake timers)
  // -------------------------------------------------------------------------

  describe('timeout handling (Req 1.6)', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('timeout → timeout status + agent:timeout event + SIGTERM', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 10,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      const timeoutHandler = jest.fn();
      spawner.on('agent:timeout', timeoutHandler);

      const agent = await spawner.spawn('my-spec');

      jest.advanceTimersByTime(10 * 1000);

      expect(agent.status).toBe('timeout');
      expect(agent.completedAt).toBeDefined();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(timeoutHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          specName: 'my-spec',
          timeoutSeconds: 10,
        })
      );
    });

    test('timeout sends SIGKILL after 5s grace period', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 10,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      await spawner.spawn('my-spec');

      // Trigger timeout
      jest.advanceTimersByTime(10 * 1000);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Advance 5s for SIGKILL
      jest.advanceTimersByTime(5000);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    test('timeout deregisters from AgentRegistry', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 10,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      await spawner.spawn('my-spec');

      jest.advanceTimersByTime(10 * 1000);

      // deregister is async — need to flush
      await Promise.resolve();
      expect(mockRegistry.deregister).toHaveBeenCalledWith('test-agent-1');
    });

    test('no timeout when timeoutSeconds is 0', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 0,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      const timeoutHandler = jest.fn();
      spawner.on('agent:timeout', timeoutHandler);

      const agent = await spawner.spawn('my-spec');

      jest.advanceTimersByTime(999999);

      expect(agent.status).toBe('running');
      expect(timeoutHandler).not.toHaveBeenCalled();
    });

    test('close event clears timeout timer', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 60,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      });

      const timeoutHandler = jest.fn();
      spawner.on('agent:timeout', timeoutHandler);

      const agent = await spawner.spawn('my-spec');

      // Process completes before timeout
      mockChildProcess.emit('close', 0);

      // Advance past the timeout — should not fire
      jest.advanceTimersByTime(60 * 1000);

      expect(agent.status).toBe('completed');
      expect(timeoutHandler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // kill() and killAll()
  // -------------------------------------------------------------------------

  describe('kill()', () => {
    test('sends SIGTERM to specific agent', async () => {
      await spawner.spawn('my-spec');

      // Start kill — _terminateProcess sends SIGTERM then waits for close
      const killPromise = spawner.kill('test-agent-1');

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Simulate process closing so the promise resolves
      mockChildProcess.emit('close', 0);
      await killPromise;
    });

    test('does nothing for non-existent agent', async () => {
      await spawner.kill('non-existent-agent');
      // Should not throw
    });

    test('does nothing for already completed agent', async () => {
      await spawner.spawn('my-spec');
      mockChildProcess.emit('close', 0);
      await flushPromises();

      mockChildProcess.kill.mockClear();
      await spawner.kill('test-agent-1');
      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('killAll()', () => {
    test('terminates all running agents', async () => {
      let agentCount = 0;
      mockRegistry.register.mockImplementation(() => {
        agentCount++;
        return Promise.resolve({ agentId: `agent-${agentCount}` });
      });

      await spawner.spawn('spec-a');
      const child1 = mockChildren[mockChildren.length - 1];
      await spawner.spawn('spec-b');
      const child2 = mockChildren[mockChildren.length - 1];

      const killAllPromise = spawner.killAll();

      expect(child1.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child2.kill).toHaveBeenCalledWith('SIGTERM');

      // Simulate both closing
      child1.emit('close', 0);
      child2.emit('close', 0);
      await killAllPromise;
    });

    test('skips already completed agents', async () => {
      let agentCount = 0;
      mockRegistry.register.mockImplementation(() => {
        agentCount++;
        return Promise.resolve({ agentId: `agent-${agentCount}` });
      });

      await spawner.spawn('spec-a');
      const child1 = mockChildren[mockChildren.length - 1];
      await spawner.spawn('spec-b');
      const child2 = mockChildren[mockChildren.length - 1];

      // Complete first agent
      child1.emit('close', 0);
      await flushPromises();

      child1.kill.mockClear();

      const killAllPromise = spawner.killAll();

      // Only second agent should receive SIGTERM
      expect(child1.kill).not.toHaveBeenCalled();
      expect(child2.kill).toHaveBeenCalledWith('SIGTERM');

      child2.emit('close', 0);
      await killAllPromise;
    });
  });

  // -------------------------------------------------------------------------
  // getActiveAgents()
  // -------------------------------------------------------------------------

  describe('getActiveAgents()', () => {
    test('returns empty map initially', () => {
      const agents = spawner.getActiveAgents();
      expect(agents).toBeInstanceOf(Map);
      expect(agents.size).toBe(0);
    });

    test('returns agent map after spawn', async () => {
      await spawner.spawn('my-spec');

      const agents = spawner.getActiveAgents();
      expect(agents.size).toBe(1);
      expect(agents.has('test-agent-1')).toBe(true);
      expect(agents.get('test-agent-1').specName).toBe('my-spec');
    });

    test('returns a copy (not the internal map)', async () => {
      await spawner.spawn('my-spec');

      const agents = spawner.getActiveAgents();
      agents.delete('test-agent-1');

      const agentsAgain = spawner.getActiveAgents();
      expect(agentsAgain.size).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // stdout JSON Lines parsing → agent:output events
  // -------------------------------------------------------------------------

  describe('stdout JSON Lines parsing', () => {
    test('parses valid JSON Lines and emits agent:output events', async () => {
      const outputHandler = jest.fn();
      spawner.on('agent:output', outputHandler);

      const agent = await spawner.spawn('my-spec');

      const event1 = { type: 'thread.started', timestamp: '2025-01-01T00:00:00Z' };
      const event2 = { type: 'turn.completed', timestamp: '2025-01-01T00:01:00Z' };

      mockChildProcess.stdout.emit('data', Buffer.from(
        JSON.stringify(event1) + '\n' + JSON.stringify(event2) + '\n'
      ));

      expect(outputHandler).toHaveBeenCalledTimes(2);
      expect(outputHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-1',
          specName: 'my-spec',
          event: event1,
        })
      );
      expect(agent.events).toHaveLength(2);
      expect(agent.events[0]).toEqual(event1);
      expect(agent.events[1]).toEqual(event2);
    });

    test('handles partial lines across chunks', async () => {
      const outputHandler = jest.fn();
      spawner.on('agent:output', outputHandler);

      await spawner.spawn('my-spec');

      const event = { type: 'turn.started' };
      const json = JSON.stringify(event);
      const half = Math.floor(json.length / 2);

      mockChildProcess.stdout.emit('data', Buffer.from(json.substring(0, half)));
      expect(outputHandler).not.toHaveBeenCalled();

      mockChildProcess.stdout.emit('data', Buffer.from(json.substring(half) + '\n'));
      expect(outputHandler).toHaveBeenCalledTimes(1);
      expect(outputHandler).toHaveBeenCalledWith(
        expect.objectContaining({ event })
      );
    });

    test('silently ignores non-JSON lines', async () => {
      const outputHandler = jest.fn();
      spawner.on('agent:output', outputHandler);

      await spawner.spawn('my-spec');

      mockChildProcess.stdout.emit('data', Buffer.from('not json at all\n'));
      expect(outputHandler).not.toHaveBeenCalled();
    });

    test('skips empty lines', async () => {
      const outputHandler = jest.fn();
      spawner.on('agent:output', outputHandler);

      await spawner.spawn('my-spec');

      mockChildProcess.stdout.emit('data', Buffer.from('\n\n\n'));
      expect(outputHandler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // stderr buffering
  // -------------------------------------------------------------------------

  describe('stderr buffering', () => {
    test('buffers stderr output', async () => {
      const agent = await spawner.spawn('my-spec');

      mockChildProcess.stderr.emit('data', Buffer.from('Warning: something\n'));
      mockChildProcess.stderr.emit('data', Buffer.from('Error: fatal\n'));

      expect(agent.stderr).toBe('Warning: something\nError: fatal\n');
    });
  });

  // -------------------------------------------------------------------------
  // AgentRegistry deregister failure handling
  // -------------------------------------------------------------------------

  describe('AgentRegistry deregister failure', () => {
    test('logs warning but does not throw on deregister failure', async () => {
      mockRegistry.deregister.mockRejectedValue(new Error('Registry unavailable'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await spawner.spawn('my-spec');
      mockChildProcess.emit('close', 0);
      await flushPromises();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to deregister agent test-agent-1')
      );
      warnSpy.mockRestore();
    });
  });
});
