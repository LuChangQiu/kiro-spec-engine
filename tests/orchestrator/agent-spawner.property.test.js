/**
 * Property 1: 进程退出码 → 状态映射属性测试
 *
 * *对于任何* 子 agent 进程，如果退出码为 0 则最终状态应为 completed，
 * 如果退出码非 0 则最终状态应为 failed。退出码与状态之间存在确定性映射。
 *
 * **Validates: Requirements 1.4, 1.5**
 */

const fc = require('fast-check');
const { EventEmitter } = require('events');

// --- Mock child_process.spawn ---
let mockChildProcess;

function mockCreateChildProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn();
  child.pid = 12345;
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
const flushPromises = () => new Promise((r) => process.nextTick(r));

describe('Property 1: 进程退出码 → 状态映射 (Exit Code → Status Mapping)', () => {
  let spawner;
  let mockConfig;
  let mockRegistry;
  let mockPromptBuilder;
  let savedApiKey;

  beforeEach(() => {
    savedApiKey = process.env.CODEX_API_KEY;
    process.env.CODEX_API_KEY = 'test-api-key-pbt';
    mockChildProcess = null;

    mockConfig = {
      getConfig: jest.fn().mockResolvedValue({
        agentBackend: 'codex',
        maxParallel: 3,
        timeoutSeconds: 0, // disable timeout for property tests
        maxRetries: 2,
        apiKeyEnvVar: 'CODEX_API_KEY',
        bootstrapTemplate: null,
        codexArgs: [],
      }),
    };

    mockRegistry = {
      register: jest.fn().mockResolvedValue({ agentId: 'pbt-agent-1' }),
      deregister: jest.fn().mockResolvedValue({ success: true }),
    };

    mockPromptBuilder = {
      buildPrompt: jest.fn().mockResolvedValue('Execute Spec pbt-spec.'),
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

  test('exit code 0 always maps to completed status', async () => {
    /**
     * **Validates: Requirements 1.4**
     *
     * For any spawn, when the process exits with code 0,
     * the agent status must be 'completed'.
     */
    await fc.assert(
      fc.asyncProperty(fc.constant(0), async (exitCode) => {
        const agent = await spawner.spawn('test-spec');
        const child = mockChildProcess;

        child.emit('close', exitCode);
        await flushPromises();

        expect(agent.status).toBe('completed');
        expect(agent.exitCode).toBe(0);
        expect(agent.completedAt).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  test('any non-zero exit code always maps to failed status', async () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * For any non-zero exit code, the agent status must be 'failed'.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer().filter((code) => code !== 0),
        async (exitCode) => {
          const agent = await spawner.spawn('test-spec');
          const child = mockChildProcess;

          child.emit('close', exitCode);
          await flushPromises();

          expect(agent.status).toBe('failed');
          expect(agent.exitCode).toBe(exitCode);
          expect(agent.completedAt).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('exit code → status mapping is deterministic: same code always yields same status', async () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     *
     * For any exit code, spawning twice with the same code must produce
     * the same status both times — the mapping is a pure function of the exit code.
     */
    await fc.assert(
      fc.asyncProperty(fc.integer(), async (exitCode) => {
        // First spawn
        const agent1 = await spawner.spawn('spec-a');
        const child1 = mockChildProcess;
        child1.emit('close', exitCode);
        await flushPromises();

        // Second spawn
        const agent2 = await spawner.spawn('spec-b');
        const child2 = mockChildProcess;
        child2.emit('close', exitCode);
        await flushPromises();

        expect(agent1.status).toBe(agent2.status);
        expect(agent1.exitCode).toBe(agent2.exitCode);
      }),
      { numRuns: 100 }
    );
  });

  test('status is always either completed or failed for any integer exit code', async () => {
    /**
     * **Validates: Requirements 1.4, 1.5**
     *
     * For any integer exit code, the resulting status must be one of
     * exactly two values: 'completed' or 'failed'. No other status is possible.
     */
    await fc.assert(
      fc.asyncProperty(fc.integer(), async (exitCode) => {
        const agent = await spawner.spawn('test-spec');
        const child = mockChildProcess;

        child.emit('close', exitCode);
        await flushPromises();

        expect(['completed', 'failed']).toContain(agent.status);

        // Verify the exact mapping
        if (exitCode === 0) {
          expect(agent.status).toBe('completed');
        } else {
          expect(agent.status).toBe('failed');
        }
      }),
      { numRuns: 100 }
    );
  });
});
