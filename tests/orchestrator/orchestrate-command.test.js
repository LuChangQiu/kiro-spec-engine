/**
 * Orchestrate CLI Command Unit Tests
 *
 * Validates: Requirements 6.1-6.5
 * - 6.1: sce orchestrate run --specs --max-parallel
 * - 6.2: sce orchestrate status
 * - 6.3: sce orchestrate stop
 * - 6.4: Spec existence validation
 * - 6.5: maxParallel validation
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { Command } = require('commander');

// We test registerOrchestrateCommands by attaching it to a fresh Commander program
// and inspecting the registered subcommands. For action tests we mock the
// orchestrator/collab modules and exercise the run/status/stop actions.

let tempDir;

beforeEach(() => {
  tempDir = path.join(
    os.tmpdir(),
    `sce-test-orch-cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  fs.mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.removeSync(tempDir);
  }
  jest.restoreAllMocks();
});

describe('registerOrchestrateCommands', () => {
  const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');

  test('registers orchestrate command with run, status, stop, profile subcommands', () => {
    const program = new Command();
    program.exitOverride(); // prevent process.exit in tests
    registerOrchestrateCommands(program);

    const orchestrate = program.commands.find(c => c.name() === 'orchestrate');
    expect(orchestrate).toBeDefined();
    expect(orchestrate.description()).toBe('Manage agent orchestration for parallel Spec execution');

    const subNames = orchestrate.commands.map(c => c.name());
    expect(subNames).toContain('run');
    expect(subNames).toContain('status');
    expect(subNames).toContain('stop');
    expect(subNames).toContain('profile');
  });

  test('run subcommand has --specs as required option', () => {
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    const orchestrate = program.commands.find(c => c.name() === 'orchestrate');
    const run = orchestrate.commands.find(c => c.name() === 'run');
    expect(run).toBeDefined();

    const specsOpt = run.options.find(o => o.long === '--specs');
    expect(specsOpt).toBeDefined();
    expect(specsOpt.mandatory).toBe(true);
  });

  test('run subcommand has --max-parallel, --rate-limit-profile and --json options', () => {
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    const orchestrate = program.commands.find(c => c.name() === 'orchestrate');
    const run = orchestrate.commands.find(c => c.name() === 'run');

    const maxParOpt = run.options.find(o => o.long === '--max-parallel');
    expect(maxParOpt).toBeDefined();

    const profileOpt = run.options.find(o => o.long === '--rate-limit-profile');
    expect(profileOpt).toBeDefined();

    const jsonOpt = run.options.find(o => o.long === '--json');
    expect(jsonOpt).toBeDefined();
  });

  test('status subcommand has --json option', () => {
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    const orchestrate = program.commands.find(c => c.name() === 'orchestrate');
    const status = orchestrate.commands.find(c => c.name() === 'status');

    const jsonOpt = status.options.find(o => o.long === '--json');
    expect(jsonOpt).toBeDefined();
  });
});

describe('orchestrate run — parameter validation', () => {
  // We test the run action by mocking process.exit and process.cwd,
  // and intercepting console output.

  let exitSpy;
  let errorSpy;
  let logSpy;
  let cwdSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  test('rejects empty specs list', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync(['node', 'sce', 'orchestrate', 'run', '--specs', '  ,  , '])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('rejects maxParallel < 1', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync(['node', 'sce', 'orchestrate', 'run', '--specs', 'spec-a', '--max-parallel', '0'])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('rejects non-numeric maxParallel', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync(['node', 'sce', 'orchestrate', 'run', '--specs', 'spec-a', '--max-parallel', 'abc'])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('rejects non-existent specs (Req 6.4)', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync(['node', 'sce', 'orchestrate', 'run', '--specs', 'nonexistent-spec-xyz'])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
    // Should mention the missing spec name
    const errorOutput = errorSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(errorOutput).toContain('nonexistent-spec-xyz');
  });

  test('rejects non-existent specs in JSON mode', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync(['node', 'sce', 'orchestrate', 'run', '--specs', 'missing-spec', '--json'])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const jsonOutput = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(jsonOutput).toContain('missing-spec');
  });

  test('rejects invalid rate-limit profile', async () => {
    const specDir = path.join(tempDir, '.sce', 'specs', 'spec-a');
    fs.mkdirSync(specDir, { recursive: true });

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await expect(
      program.parseAsync([
        'node', 'sce', 'orchestrate', 'run',
        '--specs', 'spec-a',
        '--rate-limit-profile', 'ultra'
      ])
    ).rejects.toThrow();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const errorOutput = errorSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(errorOutput).toContain('--rate-limit-profile must be one of');
  });
});

describe('orchestrate profile commands', () => {
  let exitSpy;
  let errorSpy;
  let logSpy;
  let cwdSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  test('profile list returns available profiles in json mode', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'profile', 'list', '--json']);
    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    const parsed = JSON.parse(output.trim());
    expect(parsed.profiles).toEqual(
      expect.arrayContaining(['conservative', 'balanced', 'aggressive'])
    );
  });

  test('profile set persists rateLimitProfile only by default', async () => {
    const configDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
      rateLimitLaunchBudgetPerMinute: 99
    });

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'profile', 'set', 'conservative']);

    const saved = fs.readJsonSync(path.join(configDir, 'orchestrator.json'));
    expect(saved.rateLimitProfile).toBe('conservative');
    expect(saved.rateLimitLaunchBudgetPerMinute).toBe(99);
  });

  test('profile set with --reset-overrides writes preset values', async () => {
    const configDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
      rateLimitLaunchBudgetPerMinute: 99
    });

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync([
      'node',
      'sce',
      'orchestrate',
      'profile',
      'set',
      'aggressive',
      '--reset-overrides'
    ]);

    const saved = fs.readJsonSync(path.join(configDir, 'orchestrator.json'));
    expect(saved.rateLimitProfile).toBe('aggressive');
    expect(saved.rateLimitLaunchBudgetPerMinute).toBe(16);
    expect(saved.rateLimitSignalThreshold).toBe(4);
  });

  test('profile show reports active profile and override keys', async () => {
    const configDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeJsonSync(path.join(configDir, 'orchestrator.json'), {
      rateLimitProfile: 'conservative',
      rateLimitLaunchBudgetPerMinute: 9
    });

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'profile', 'show', '--json']);
    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    const parsed = JSON.parse(output.trim());
    expect(parsed.profile).toBe('conservative');
    expect(parsed.explicit_overrides).toContain('rateLimitLaunchBudgetPerMinute');
    expect(parsed.effective.rateLimitLaunchBudgetPerMinute).toBe(9);
  });
});

describe('orchestrate status', () => {
  let exitSpy;
  let errorSpy;
  let logSpy;
  let cwdSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  test('shows idle message when no status file exists', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('No orchestration data found');
  });

  test('shows idle message in JSON mode when no status file', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status', '--json']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    const parsed = JSON.parse(output.trim());
    expect(parsed.status).toBe('idle');
  });

  test('displays persisted status data', async () => {
    // Write a status file
    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    const statusData = {
      status: 'completed',
      totalSpecs: 2,
      completedSpecs: 2,
      failedSpecs: 0,
      runningSpecs: 0,
      currentBatch: 1,
      totalBatches: 1,
      specs: {
        'spec-a': { status: 'completed', error: null },
        'spec-b': { status: 'completed', error: null },
      },
    };
    fs.writeJsonSync(path.join(statusDir, 'orchestration-status.json'), statusData);

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('Orchestration Status');
    expect(output).toContain('spec-a');
    expect(output).toContain('spec-b');
  });

  test('shows active rate-limit launch hold in status output', async () => {
    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    const statusData = {
      status: 'running',
      rateLimit: {
        signalCount: 2,
        totalBackoffMs: 3000,
        lastSignalAt: new Date(now - 500).toISOString(),
        lastLaunchHoldMs: 2000,
      },
      specs: {},
    };
    fs.writeJsonSync(path.join(statusDir, 'orchestration-status.json'), statusData);

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('Rate-limit launch hold: 1500ms remaining');
    nowSpy.mockRestore();
  });

  test('shows active launch-budget hold in status output', async () => {
    const now = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    const statusData = {
      status: 'running',
      rateLimit: {
        signalCount: 0,
        totalBackoffMs: 0,
        launchBudgetPerMinute: 12,
        launchBudgetWindowMs: 60000,
        launchBudgetUsed: 12,
        launchBudgetHoldCount: 1,
        lastLaunchBudgetHoldMs: 3000,
        lastLaunchBudgetHoldAt: new Date(now - 1000).toISOString(),
      },
      specs: {},
    };
    fs.writeJsonSync(path.join(statusDir, 'orchestration-status.json'), statusData);

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('Launch budget: 12/12 in 60000ms (holds: 1)');
    expect(output).toContain('Launch budget hold: 2000ms remaining');
    nowSpy.mockRestore();
  });

  test('displays persisted status in JSON mode', async () => {
    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    const statusData = {
      status: 'running',
      totalSpecs: 3,
      completedSpecs: 1,
      failedSpecs: 0,
      runningSpecs: 2,
    };
    fs.writeJsonSync(path.join(statusDir, 'orchestration-status.json'), statusData);

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'status', '--json']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    const parsed = JSON.parse(output.trim());
    expect(parsed.status).toBe('running');
    expect(parsed.totalSpecs).toBe(3);
  });
});

describe('orchestrate stop', () => {
  let exitSpy;
  let errorSpy;
  let logSpy;
  let cwdSpy;

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  test('shows message when no running orchestration', async () => {
    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'stop']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('No running orchestration');
  });

  test('sends stop signal when orchestration is running', async () => {
    // Write a running status
    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    const statusPath = path.join(statusDir, 'orchestration-status.json');
    fs.writeJsonSync(statusPath, { status: 'running', totalSpecs: 2 });

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'stop']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('Stop signal sent');

    // Verify status file was updated
    const updated = fs.readJsonSync(statusPath);
    expect(updated.status).toBe('stopped');
    expect(updated.completedAt).toBeDefined();
  });

  test('shows message when orchestration already completed', async () => {
    const statusDir = path.join(tempDir, '.sce', 'config');
    fs.mkdirSync(statusDir, { recursive: true });
    fs.writeJsonSync(
      path.join(statusDir, 'orchestration-status.json'),
      { status: 'completed' }
    );

    const { registerOrchestrateCommands } = require('../../lib/commands/orchestrate');
    const program = new Command();
    program.exitOverride();
    registerOrchestrateCommands(program);

    await program.parseAsync(['node', 'sce', 'orchestrate', 'stop']);

    const output = logSpy.mock.calls.map(c => c.join(' ')).join(' ');
    expect(output).toContain('No running orchestration');
  });
});
