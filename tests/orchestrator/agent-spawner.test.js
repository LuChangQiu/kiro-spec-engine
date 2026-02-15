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
const path = require('path');

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
  spawnSync: jest.fn(() => ({ status: 0 })),
}));

const { spawn: mockSpawn, spawnSync: mockSpawnSync } = require('child_process');
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
  let savedPlatform;

  beforeEach(() => {
    savedApiKey = process.env.CODEX_API_KEY;
    process.env.CODEX_API_KEY = 'test-api-key-123';
    mockChildren.length = 0;
    mockChildProcess = null;

    // Force non-Windows platform for most tests so they exercise the direct
    // codex spawn path.  Windows-specific tests override this explicitly.
    savedPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    mockConfig = {
      getConfig: jest.fn().mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 0,
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
    mockSpawnSync.mockClear();
    mockSpawnSync.mockReturnValue({ status: 0 });
  });

  afterEach(() => {
    // Restore platform
    if (savedPlatform) {
      Object.defineProperty(process, 'platform', savedPlatform);
    }

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
      const promptArg = args[args.length - 1];
      expect(promptArg).toBe('Execute Spec test-spec with full context.');
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

    test('throws when bootstrap prompt is undefined and does not spawn process', async () => {
      mockPromptBuilder.buildPrompt.mockResolvedValue(undefined);

      await expect(spawner.spawn('my-spec')).rejects.toThrow(
        'Invalid bootstrap prompt'
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('throws when API key is not available from env or auth file', async () => {
      delete process.env.CODEX_API_KEY;
      spawner._readCodexAuthFile = jest.fn().mockReturnValue(null);

      await expect(spawner.spawn('my-spec')).rejects.toThrow(
        'Cannot find API key'
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    test('reads API key from ~/.codex/auth.json when env var is missing', async () => {
      delete process.env.CODEX_API_KEY;

      // Mock the _readCodexAuthFile method to return a key
      spawner._readCodexAuthFile = jest.fn().mockReturnValue('auth-file-key-789');

      await spawner.spawn('my-spec');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.CODEX_API_KEY).toBe('auth-file-key-789');
    });

    test('prefers env var over auth file', async () => {
      spawner._readCodexAuthFile = jest.fn().mockReturnValue('auth-file-key');

      await spawner.spawn('my-spec');

      const [, , opts] = mockSpawn.mock.calls[0];
      expect(opts.env.CODEX_API_KEY).toBe('test-api-key-123');
      expect(spawner._readCodexAuthFile).not.toHaveBeenCalled();
    });

    test('uses custom apiKeyEnvVar from config', async () => {
      process.env.MY_CUSTOM_KEY = 'custom-key-456';
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 0,
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
        timeoutSeconds: 0,
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

    test('uses codexCommand from config when specified', async () => {
      mockConfig.getConfig.mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 0,
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
        codexCommand: 'npx @openai/codex',
      });

      await spawner.spawn('my-spec');

      const [cmd, args] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('npx');
      expect(args[0]).toBe('@openai/codex');
      expect(args).toContain('exec');
      expect(args).toContain('--json');
    });

    test('defaults to "codex" when codexCommand is not set', async () => {
      await spawner.spawn('my-spec');

      const [cmd] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('codex');
    });

    test('falls back to npx @openai/codex when codex is unavailable', async () => {
      mockSpawnSync.mockImplementation((_lookupCmd, args) => {
        const target = args[0];
        if (target === 'codex') return { status: 1 };
        if (target === 'npx') return { status: 0 };
        return { status: 1 };
      });

      await spawner.spawn('my-spec');

      const [cmd, args, opts] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('npx');
      expect(args[0]).toBe('@openai/codex');
      expect(opts.shell).toBe(true);
    });

    test('keeps codex as final fallback when neither codex nor npx is available', async () => {
      mockSpawnSync.mockReturnValue({ status: 1 });

      await spawner.spawn('my-spec');

      const [cmd] = mockSpawn.mock.calls[0];
      expect(cmd).toBe('codex');
    });

    test('on Windows, spawns via powershell.exe with temp file prompt', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      // Mock fs.writeFileSync to capture temp file write
      const originalWriteFileSync = require('fs').writeFileSync;
      let capturedTmpPath = null;
      let capturedTmpContent = null;
      require('fs').writeFileSync = jest.fn((p, c) => {
        capturedTmpPath = p;
        capturedTmpContent = c;
      });

      try {
        await spawner.spawn('my-spec');
        const [cmd, args, opts] = mockSpawn.mock.calls[0];

        // Should spawn powershell.exe, not codex
        expect(cmd).toBe('powershell.exe');
        expect(args[0]).toBe('-NoProfile');
        expect(args[1]).toBe('-Command');
        // The PowerShell command should contain the codex invocation
        expect(args[2]).toContain('codex');
        expect(args[2]).toContain('exec');
        expect(args[2]).toContain('Get-Content');
        expect(args[2]).toContain('| &');
        expect(args[2].trim().endsWith(' -')).toBe(true);
        // shell should be false (spawning powershell directly)
        expect(opts.shell).toBe(false);
        // Temp file should have been written with the prompt
        expect(capturedTmpContent).toBe('Execute Spec test-spec with full context.');
        expect(capturedTmpPath).toMatch(/kse-prompt-/);
      } finally {
        require('fs').writeFileSync = originalWriteFileSync;
      }
    });

    test('on Windows, sanitizes agentId before creating prompt temp file', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockRegistry.register.mockResolvedValue({ agentId: 'zeno-v4/uuid:1\\child*?' });

      const fsModule = require('fs');
      const originalWriteFileSync = fsModule.writeFileSync;
      let capturedTmpPath = null;
      fsModule.writeFileSync = jest.fn((p) => { capturedTmpPath = p; });

      try {
        await spawner.spawn('my-spec');
        const tmpFilename = path.basename(capturedTmpPath);
        expect(tmpFilename).toMatch(/^kse-prompt-/);
        expect(tmpFilename).not.toMatch(/[<>:"/\\|?*]/);
      } finally {
        fsModule.writeFileSync = originalWriteFileSync;
      }
    });

    test('on Windows, throws on empty prompt before temp file write', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockPromptBuilder.buildPrompt.mockResolvedValue('   ');

      const fsModule = require('fs');
      const originalWriteFileSync = fsModule.writeFileSync;
      fsModule.writeFileSync = jest.fn();

      try {
        await expect(spawner.spawn('my-spec')).rejects.toThrow(
          'Invalid bootstrap prompt'
        );
        expect(fsModule.writeFileSync).not.toHaveBeenCalled();
        expect(mockSpawn).not.toHaveBeenCalled();
      } finally {
        fsModule.writeFileSync = originalWriteFileSync;
      }
    });

    test('on Windows, cleans up temp file on process close', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const fsModule = require('fs');
      const originalWriteFileSync = fsModule.writeFileSync;
      const originalUnlinkSync = fsModule.unlinkSync;
      let capturedTmpPath = null;
      fsModule.writeFileSync = jest.fn((p) => { capturedTmpPath = p; });
      fsModule.unlinkSync = jest.fn();

      try {
        const agent = await spawner.spawn('my-spec');
        expect(agent._promptTmpFile).toBeTruthy();
        expect(capturedTmpPath).toBeTruthy();

        // Simulate process close
        mockChildProcess.emit('close', 0);
        await flushPromises();

        expect(fsModule.unlinkSync).toHaveBeenCalledWith(capturedTmpPath);
        expect(agent._promptTmpFile).toBeNull();
      } finally {
        fsModule.writeFileSync = originalWriteFileSync;
        fsModule.unlinkSync = originalUnlinkSync;
      }
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
      jest.clearAllTimers();
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

    test('clears terminate timers after close to avoid timer leaks', async () => {
      jest.useFakeTimers({ legacyFakeTimers: true });
      try {
        await spawner.spawn('my-spec');

        const killPromise = spawner.kill('test-agent-1');
        mockChildProcess.emit('close', 0);
        await killPromise;

        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
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
