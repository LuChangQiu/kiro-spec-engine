const { Command } = require('commander');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

jest.mock('../../../lib/auto/close-loop-runner', () => ({
  runAutoCloseLoop: jest.fn()
}));

const { runAutoCloseLoop } = require('../../../lib/auto/close-loop-runner');
const { registerAutoCommands } = require('../../../lib/commands/auto');

describe('auto close-loop command', () => {
  let exitSpy;
  let errorSpy;
  let logSpy;
  let cwdSpy;
  let tempDir;

  beforeEach(async () => {
    jest.resetAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-auto-command-'));
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    cwdSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function buildProgram() {
    const program = new Command();
    program.exitOverride();
    registerAutoCommands(program);
    return program;
  }

  test('allows --resume latest without goal argument', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await program.parseAsync(['node', 'kse', 'auto', 'close-loop', '--resume', 'latest']);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resume: 'latest'
      })
    );
  });

  test('allows --resume interrupted without goal argument', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await program.parseAsync(['node', 'kse', 'auto', 'close-loop', '--resume', 'interrupted']);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resume: 'interrupted'
      })
    );
  });

  test('supports close-loop continue shorthand without --resume', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await program.parseAsync(['node', 'kse', 'auto', 'close-loop', 'continue']);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resume: 'interrupted'
      })
    );
  });

  test('supports close-loop 继续 shorthand without --resume', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await program.parseAsync(['node', 'kse', 'auto', 'close-loop', '继续']);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resume: 'interrupted'
      })
    );
  });

  test('supports auto continue command as interrupted resume', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await program.parseAsync(['node', 'kse', 'auto', 'continue']);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        resume: 'interrupted'
      })
    );
  });

  test('requires goal when --resume is not provided', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'prepared' });
    const program = buildProgram();

    await expect(
      program.parseAsync(['node', 'kse', 'auto', 'close-loop'])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Goal is required unless --resume is provided.');
  });

  test('forwards goal and replan/session options to close-loop runner', async () => {
    runAutoCloseLoop.mockResolvedValue({ status: 'completed' });
    const program = buildProgram();

    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop',
      'deliver kse autonomous close-loop',
      '--replan-strategy',
      'fixed',
      '--replan-attempts',
      '2',
      '--replan-no-progress-window',
      '4',
      '--session-keep',
      '5',
      '--session-older-than-days',
      '14'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledWith(
      'deliver kse autonomous close-loop',
      expect.objectContaining({
        replanStrategy: 'fixed',
        replanAttempts: 2,
        replanNoProgressWindow: 4,
        sessionKeep: 5,
        sessionOlderThanDays: 14
      })
    );
  });

  test('runs close-loop-batch with json goals file and writes summary', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const outFile = path.join(tempDir, 'batch-summary.json');
    await fs.writeJson(goalsFile, {
      goals: ['first autonomous goal', 'second autonomous goal']
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({
        status: 'completed',
        portfolio: { master_spec: '121-00-first', sub_specs: ['121-01-a', '121-02-b'] }
      })
      .mockResolvedValueOnce({
        status: 'completed',
        portfolio: { master_spec: '122-00-second', sub_specs: ['122-01-a', '122-02-b'] }
      });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--json',
      '--out',
      outFile
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(
      1,
      'first autonomous goal',
      expect.objectContaining({
        quiet: true,
        run: true,
        stream: false
      })
    );
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(
      2,
      'second autonomous goal',
      expect.objectContaining({
        quiet: true
      })
    );

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.mode).toBe('auto-close-loop-batch');
    expect(summary.status).toBe('completed');
    expect(summary.total_goals).toBe(2);
    expect(summary.processed_goals).toBe(2);
    expect(summary.completed_goals).toBe(2);
    expect(summary.failed_goals).toBe(0);
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      agent_budget: null,
      effective_goal_parallel: 1
    }));
    expect(summary.output_file).toBe(outFile);

    const summaryFile = await fs.readJson(outFile);
    expect(summaryFile.mode).toBe('auto-close-loop-batch');
    expect(summaryFile.results).toHaveLength(2);
  });

  test('parses line-based goals file in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.txt');
    await fs.writeFile(
      goalsFile,
      [
        '# comment',
        'first line goal',
        '',
        '  second line goal  '
      ].join('\n'),
      'utf8'
    );

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--format',
      'lines',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'first line goal', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'second line goal', expect.any(Object));
  });

  test('supports concurrent goal execution with --batch-parallel', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three', 'goal four']
    }, { spaces: 2 });

    let inFlight = 0;
    let maxInFlight = 0;
    runAutoCloseLoop.mockImplementation(async goal => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 30));
      inFlight -= 1;
      return {
        status: 'completed',
        portfolio: {
          master_spec: `master-${goal.replace(/\s+/g, '-')}`,
          sub_specs: []
        }
      };
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '2',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(4);
    expect(maxInFlight).toBe(2);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_parallel).toBe(2);
    expect(summary.status).toBe('completed');
    expect(summary.processed_goals).toBe(4);
  });

  test('allocates unique prefixes per goal for parallel close-loop-batch runs', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three']
    }, { spaces: 2 });
    await fs.ensureDir(path.join(tempDir, '.kiro', 'specs', '210-00-existing'));

    runAutoCloseLoop.mockImplementation(async (_goal, options) => ({
      status: 'completed',
      portfolio: {
        master_spec: `master-${options.prefix}`,
        sub_specs: []
      }
    }));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '2',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const prefixes = runAutoCloseLoop.mock.calls
      .map(call => call[1].prefix)
      .sort((a, b) => a - b);
    expect(prefixes).toEqual([211, 212, 213]);
    expect(new Set(prefixes).size).toBe(3);
  });

  test('applies batch agent budget to per-goal maxParallel', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two']
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '2',
      '--batch-agent-budget',
      '6',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(
      1,
      'goal one',
      expect.objectContaining({
        maxParallel: 3
      })
    );
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(
      2,
      'goal two',
      expect.objectContaining({
        maxParallel: 3
      })
    );

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_parallel).toBe(2);
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      agent_budget: 6,
      per_goal_max_parallel: 3,
      effective_goal_parallel: 2
    }));
  });

  test('caps effective batch parallelism when batch agent budget is lower', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three']
    }, { spaces: 2 });

    let inFlight = 0;
    let maxInFlight = 0;
    runAutoCloseLoop.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 20));
      inFlight -= 1;
      return {
        status: 'completed',
        portfolio: {
          master_spec: '121-00-ok',
          sub_specs: []
        }
      };
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '3',
      '--batch-agent-budget',
      '2',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(2);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_parallel).toBe(2);
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      agent_budget: 2,
      effective_goal_parallel: 2,
      per_goal_max_parallel: 1
    }));
  });

  test('uses complexity-weighted scheduling under batch agent budget', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const complexGoal = [
      'deliver orchestration integration migration observability and security resilience,',
      'plus quality compliance governance and performance hardening,',
      'with closed-loop remediation and parallel master sub coordination.'
    ].join(' ');
    await fs.writeJson(goalsFile, {
      goals: [complexGoal, 'simple goal']
    }, { spaces: 2 });

    let inFlight = 0;
    let maxInFlight = 0;
    runAutoCloseLoop.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 20));
      inFlight -= 1;
      return {
        status: 'completed',
        portfolio: {
          master_spec: '121-00-ok',
          sub_specs: []
        }
      };
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '2',
      '--batch-agent-budget',
      '2',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      weighted_scheduling_enabled: true,
      max_concurrent_goals: 1
    }));
    expect(summary.resource_plan.goal_complexity_summary.max).toBeGreaterThanOrEqual(2);
    expect(summary.results[0].goal_weight).toBeGreaterThanOrEqual(2);
  });

  test('resumes pending goals from previous batch summary', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const summaryFile = path.join(tempDir, 'old-summary.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three']
    }, { spaces: 2 });
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      goals_file: goalsFile,
      total_goals: 3,
      processed_goals: 1,
      stopped_early: true,
      results: [
        {
          index: 1,
          goal: 'goal one',
          status: 'failed',
          master_spec: '121-00-one',
          sub_spec_count: 2,
          error: null
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-c', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      summaryFile,
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'goal one', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'goal two', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(3, 'goal three', expect.any(Object));

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.resumed_from_summary).toEqual(expect.objectContaining({
      file: summaryFile,
      strategy: 'pending'
    }));
    expect(summary.total_goals).toBe(3);
    expect(summary.processed_goals).toBe(3);
  });

  test('supports --resume-strategy failed-only for summary resume', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const summaryFile = path.join(tempDir, 'old-summary.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three']
    }, { spaces: 2 });
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      goals_file: goalsFile,
      total_goals: 3,
      processed_goals: 1,
      stopped_early: true,
      results: [
        {
          index: 1,
          goal: 'goal one',
          status: 'failed',
          master_spec: '121-00-one',
          sub_spec_count: 2,
          error: null
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      summaryFile,
      '--resume-strategy',
      'failed-only',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(1);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'goal one', expect.any(Object));

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.resumed_from_summary).toEqual(expect.objectContaining({
      strategy: 'failed-only'
    }));
    expect(summary.total_goals).toBe(1);
    expect(summary.processed_goals).toBe(1);
  });

  test('supports --resume-from-summary latest using persisted batch session summaries', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const summaryDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const latestSummaryFile = path.join(summaryDir, 'batch-latest.json');
    await fs.ensureDir(summaryDir);
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two']
    }, { spaces: 2 });
    await fs.writeJson(latestSummaryFile, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      goals_file: goalsFile,
      total_goals: 2,
      processed_goals: 1,
      stopped_early: true,
      results: [
        {
          index: 1,
          goal: 'goal one',
          status: 'failed',
          master_spec: '121-00-one',
          sub_spec_count: 0,
          error: null
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      'latest',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.resumed_from_summary).toEqual(expect.objectContaining({
      file: latestSummaryFile
    }));
  });

  test('persists batch session summary by default', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-a', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_session).toBeDefined();
    expect(summary.batch_session.id).toContain('batch-');
    expect(await fs.pathExists(summary.batch_session.file)).toBe(true);
  });

  test('supports disabling batch session persistence with --no-batch-session', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-a', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--no-batch-session',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_session).toBeUndefined();

    const summaryDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    expect(await fs.pathExists(summaryDir)).toBe(false);
  });

  test('runs close-loop-program with autonomous defaults and generated goals', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-10-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-10-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-10-c', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'build autonomous close-loop, master/sub decomposition, orchestration and quality rollout for kse',
      '--program-goals',
      '3',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.mode).toBe('auto-close-loop-program');
    expect(summary.total_goals).toBe(3);
    expect(summary.generated_from_goal).toEqual(expect.objectContaining({
      strategy: 'semantic-clause-and-category',
      produced_goal_count: 3
    }));
    expect(summary.autonomous_policy).toEqual(expect.objectContaining({
      enabled: true,
      profile: 'closed-loop'
    }));
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      max_rounds: 10
    }));
    expect(summary.program_kpi).toEqual(expect.objectContaining({
      convergence_state: 'converged',
      risk_level: 'low',
      completion_rate_percent: 100,
      failure_rate_percent: 0
    }));
    expect(summary.program_diagnostics).toEqual(expect.objectContaining({
      failed_goal_count: 0
    }));
    expect(summary.program_diagnostics.failure_clusters).toEqual([]);
    expect(summary.program_diagnostics.remediation_actions[0]).toEqual(expect.objectContaining({
      priority: 'monitor'
    }));
  });

  test('supports close-loop-program with explicit retry max rounds', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-11-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-11-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'build autonomous close-loop and orchestrate multi-spec program',
      '--program-goals',
      '2',
      '--batch-retry-max-rounds',
      '3',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.mode).toBe('auto-close-loop-program');
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      max_rounds: 3
    }));
  });

  test('writes close-loop-program KPI snapshot with --program-kpi-out', async () => {
    const kpiOutFile = path.join(tempDir, 'program-kpi.json');
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'build autonomous close-loop and orchestrate multi-spec program',
      '--program-goals',
      '2',
      '--program-kpi-out',
      kpiOutFile,
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.program_kpi_file).toBe(kpiOutFile);
    expect(await fs.pathExists(kpiOutFile)).toBe(true);

    const kpiPayload = await fs.readJson(kpiOutFile);
    expect(kpiPayload.mode).toBe('auto-close-loop-program-kpi');
    expect(kpiPayload.program_kpi).toEqual(expect.objectContaining({
      convergence_state: 'converged',
      risk_level: 'low'
    }));
    expect(kpiPayload.program_diagnostics).toEqual(expect.objectContaining({
      failed_goal_count: 0
    }));
  });

  test('writes program audit file with recovery and coordination trace', async () => {
    const auditOutFile = path.join(tempDir, 'program-audit.json');
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'build autonomous close-loop and orchestrate multi-spec program',
      '--program-goals',
      '2',
      '--program-audit-out',
      auditOutFile,
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_audit_file).toBe(auditOutFile);
    expect(await fs.pathExists(auditOutFile)).toBe(true);
    const auditPayload = await fs.readJson(auditOutFile);
    expect(auditPayload.mode).toBe('auto-close-loop-program-audit');
    expect(auditPayload.program_coordination).toEqual(expect.objectContaining({
      topology: 'master-sub'
    }));
  });

  test('fails program convergence gate when max risk policy is stricter than actual risk', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-gate-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-gate-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-gate-r3', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-goals',
        '2',
        '--batch-retry-rounds',
        '1',
        '--program-max-risk-level',
        'low',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.program_kpi.risk_level).toBe('medium');
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false
    }));
  });

  test('fails program convergence gate when max agent budget policy is stricter than actual budget', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-budget-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-budget-r2', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-goals',
        '2',
        '--batch-agent-budget',
        '4',
        '--program-max-agent-budget',
        '2',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_agent_budget: 2
      }),
      actual: expect.objectContaining({
        agent_budget: 4
      })
    }));
    expect(summary.program_gate.reasons.join(' ')).toContain('agent_budget');
  });

  test('fails program convergence gate when max total sub-specs policy is stricter than actual', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({
        status: 'completed',
        portfolio: { master_spec: '122-12-subspec-r1', sub_specs: ['a', 'b', 'c'] }
      })
      .mockResolvedValueOnce({
        status: 'completed',
        portfolio: { master_spec: '122-12-subspec-r2', sub_specs: ['d', 'e', 'f'] }
      });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-goals',
        '2',
        '--program-max-total-sub-specs',
        '4',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_total_sub_specs: 4
      }),
      actual: expect.objectContaining({
        total_sub_specs: 6
      })
    }));
    expect(summary.program_gate.reasons.join(' ')).toContain('total_sub_specs');
  });

  test('fails program convergence gate when max elapsed policy is stricter than actual runtime', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-time-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-time-r2', sub_specs: [] } });

    const nowSpy = jest.spyOn(Date, 'now');
    let ticks = 0;
    nowSpy.mockImplementation(() => {
      ticks += 1;
      return 1700000000000 + (ticks * 90000);
    });

    try {
      const program = buildProgram();
      await expect(
        program.parseAsync([
          'node',
          'kse',
          'auto',
          'close-loop-program',
          'deliver resilient autonomous rollout',
          '--program-goals',
          '2',
          '--program-max-elapsed-minutes',
          '1',
          '--json'
        ])
      ).rejects.toThrow('process.exit called');
    } finally {
      nowSpy.mockRestore();
    }

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_elapsed_minutes: 1
      }),
      actual: expect.objectContaining({
        elapsed_minutes: expect.any(Number)
      })
    }));
    expect(summary.program_gate.actual.elapsed_minutes).toBeGreaterThan(1);
    expect(summary.program_gate.reasons.join(' ')).toContain('program_elapsed_minutes');
  });

  test('validates --program-max-elapsed-minutes range in close-loop-program', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-max-elapsed-minutes',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-max-elapsed-minutes must be an integer between 1 and 10080.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --program-max-agent-budget range in close-loop-program', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-max-agent-budget',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-max-agent-budget must be an integer between 1 and 500.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --program-max-total-sub-specs range in close-loop-program', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-max-total-sub-specs',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-max-total-sub-specs must be an integer between 1 and 500000.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --program-govern-max-rounds range in close-loop-program', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-govern-until-stable',
        '--program-govern-max-rounds',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-govern-max-rounds must be an integer between 1 and 20.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --program-govern-use-action range in close-loop-program', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-govern-until-stable',
        '--program-govern-use-action',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-govern-use-action must be an integer between 1 and 20.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('governance loop replays program with remediation patch until gate is stable', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-r1a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-r1b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-r2a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-r2b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver resilient autonomous rollout',
      '--program-goals',
      '2',
      '--batch-agent-budget',
      '2',
      '--program-max-agent-budget',
      '1',
      '--program-govern-until-stable',
      '--program-govern-max-rounds',
      '2',
      '--program-govern-max-minutes',
      '10',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(4);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_gate_effective).toEqual(expect.objectContaining({
      passed: true
    }));
    expect(summary.program_governance).toEqual(expect.objectContaining({
      enabled: true,
      performed_rounds: 1,
      converged: true
    }));
    expect(summary.program_governance.history[0]).toEqual(expect.objectContaining({
      execution_mode: 'program-replay',
      applied_patch: expect.objectContaining({
        batchAgentBudget: 1
      })
    }));
  });

  test('governance loop auto-selects remediation action and applies strategy patch in recover cycle', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-govern-act-r1a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-act-r1b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-act-r2a', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver resilient autonomous rollout',
      '--program-goals',
      '2',
      '--batch-retry-rounds',
      '0',
      '--no-program-auto-recover',
      '--program-govern-until-stable',
      '--program-govern-use-action',
      '1',
      '--program-govern-max-rounds',
      '2',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_governance).toEqual(expect.objectContaining({
      enabled: true,
      action_selection_enabled: true,
      pinned_action_index: 1,
      performed_rounds: 1
    }));
    expect(summary.program_governance.history[0]).toEqual(expect.objectContaining({
      execution_mode: 'recover-cycle',
      selected_action_index: 1,
      selected_action: expect.stringContaining('Resume unresolved goals'),
      applied_patch: expect.objectContaining({
        batchRetryUntilComplete: true
      })
    }));
  });

  test('governance replay can run without action selection when --no-program-govern-auto-action is set', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-noact-r1a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-noact-r1b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-noact-r2a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-govern-noact-r2b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver resilient autonomous rollout',
      '--program-goals',
      '2',
      '--batch-agent-budget',
      '2',
      '--program-max-agent-budget',
      '1',
      '--program-govern-until-stable',
      '--no-program-govern-auto-action',
      '--program-govern-max-rounds',
      '2',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_governance).toEqual(expect.objectContaining({
      enabled: true,
      action_selection_enabled: false,
      performed_rounds: 1
    }));
    expect(summary.program_governance.history[0]).toEqual(expect.objectContaining({
      execution_mode: 'program-replay',
      selected_action_index: null,
      action_selection_source: null
    }));
  });

  test('validates --dequeue-limit range in close-loop-controller', async () => {
    const queueFile = path.join(tempDir, 'controller-goals.lines');
    await fs.writeFile(queueFile, 'deliver goal one\n', 'utf8');
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-controller',
        queueFile,
        '--dequeue-limit',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--dequeue-limit must be an integer between 1 and 100.');
  });

  test('drains controller queue and runs close-loop-program autonomously', async () => {
    runAutoCloseLoop
      .mockResolvedValue({ status: 'completed', portfolio: { master_spec: '200-00-controller', sub_specs: [] } });

    const queueFile = path.join(tempDir, 'controller-goals.lines');
    await fs.writeFile(queueFile, 'deliver goal one\ndeliver goal two\n', 'utf8');
    const doneFile = path.join(tempDir, 'controller-done.lines');

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-controller',
      queueFile,
      '--program-goals',
      '2',
      '--dequeue-limit',
      '2',
      '--max-cycles',
      '1',
      '--controller-done-file',
      doneFile,
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(4);
    const queueAfter = await fs.readFile(queueFile, 'utf8');
    expect(queueAfter.trim()).toBe('');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary).toEqual(expect.objectContaining({
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 2,
      completed_goals: 2,
      failed_goals: 0,
      pending_goals: 0
    }));
    expect(summary.done_archive_file).toBeTruthy();
    expect(await fs.pathExists(doneFile)).toBe(true);
  });

  test('deduplicates duplicate controller goals by default', async () => {
    runAutoCloseLoop
      .mockResolvedValue({ status: 'completed', portfolio: { master_spec: '200-00-controller', sub_specs: [] } });

    const queueFile = path.join(tempDir, 'controller-goals.lines');
    await fs.writeFile(queueFile, 'deliver goal one\ndeliver goal one\n', 'utf8');

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-controller',
      queueFile,
      '--dequeue-limit',
      '10',
      '--max-cycles',
      '1',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary).toEqual(expect.objectContaining({
      mode: 'auto-close-loop-controller',
      processed_goals: 1,
      pending_goals: 0,
      dedupe_enabled: true
    }));
    expect(summary.dedupe_dropped_goals).toBeGreaterThanOrEqual(1);
  });

  test('supports --controller-resume latest to continue queue from persisted controller session', async () => {
    runAutoCloseLoop
      .mockResolvedValue({ status: 'completed', portfolio: { master_spec: '200-00-controller', sub_specs: [] } });

    const queueFile = path.join(tempDir, 'resume-controller-goals.lines');
    await fs.writeFile(queueFile, 'deliver resume goal one\n', 'utf8');
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const sessionFile = path.join(sessionDir, 'controller-resume.json');
    await fs.writeJson(sessionFile, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      queue_file: queueFile,
      queue_format: 'lines',
      controller_session: {
        id: 'controller-resume',
        file: sessionFile
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-controller',
      '--controller-resume',
      'latest',
      '--dequeue-limit',
      '1',
      '--max-cycles',
      '1',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary).toEqual(expect.objectContaining({
      mode: 'auto-close-loop-controller',
      processed_goals: 1,
      pending_goals: 0
    }));
    expect(summary.resumed_from_controller_session).toEqual(expect.objectContaining({
      id: 'controller-resume'
    }));
  });

  test('fails close-loop-controller when queue lock is already held', async () => {
    runAutoCloseLoop
      .mockResolvedValue({ status: 'completed', portfolio: { master_spec: '200-00-controller', sub_specs: [] } });

    const queueFile = path.join(tempDir, 'controller-goals.lines');
    await fs.writeFile(queueFile, 'deliver goal one\n', 'utf8');
    await fs.writeJson(`${queueFile}.lock`, {
      token: 'existing-token',
      pid: 12345,
      host: 'test-host',
      acquired_at: new Date().toISOString(),
      touched_at: new Date().toISOString()
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-controller',
        queueFile
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Controller lock is held');
  });

  test('applies program gate profile defaults when explicit thresholds are omitted', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-prof-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-prof-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-prof-r3', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'deliver resilient autonomous rollout',
        '--program-goals',
        '2',
        '--batch-retry-rounds',
        '1',
        '--program-gate-profile',
        'prod',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        profile: 'prod',
        max_risk_level: 'low'
      })
    }));
  });

  test('uses fallback gate profile when primary gate fails', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-fallback-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-fallback-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-fallback-r3', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver resilient autonomous rollout',
      '--program-goals',
      '2',
      '--batch-retry-rounds',
      '1',
      '--program-gate-profile',
      'prod',
      '--program-gate-fallback-profile',
      'staging',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({ profile: 'prod' })
    }));
    expect(summary.program_gate_fallback).toEqual(expect.objectContaining({
      passed: true,
      policy: expect.objectContaining({ profile: 'staging' })
    }));
    expect(summary.program_gate_effective).toEqual(expect.objectContaining({
      passed: true,
      source: 'fallback-chain'
    }));
  });

  test('uses fallback gate chain and accepts later profile when earlier fallback fails', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-fallback-chain-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-fallback-chain-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-fallback-chain-r3', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver resilient autonomous rollout',
      '--program-goals',
      '2',
      '--batch-retry-rounds',
      '1',
      '--program-gate-profile',
      'prod',
      '--program-gate-fallback-chain',
      'prod,staging',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.program_gate_fallbacks).toHaveLength(2);
    expect(summary.program_gate_fallbacks[0].passed).toBe(false);
    expect(summary.program_gate_fallbacks[1].passed).toBe(true);
    expect(summary.program_gate_effective).toEqual(expect.objectContaining({
      passed: true,
      source: 'fallback-chain',
      fallback_profile: 'staging',
      attempted_fallback_count: 2
    }));
  });

  test('auto-recovers close-loop-program to completion without manual recover command', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-12-a', sub_specs: ['122-12-a-1'] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-12-a-fix', sub_specs: ['122-12-a-fix-1'] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-program',
      'deliver autonomous close-loop with master/sub multi-spec execution and quality guardrails',
      '--program-goals',
      '2',
      '--batch-retry-rounds',
      '0',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.mode).toBe('auto-close-loop-program');
    expect(summary.status).toBe('completed');
    expect(summary.failed_goals).toBe(0);
    expect(summary.auto_recovery).toEqual(expect.objectContaining({
      enabled: true,
      triggered: true,
      recover_until_complete: true,
      converged: true
    }));
    expect(summary.program_coordination).toEqual(expect.objectContaining({
      topology: 'master-sub',
      unresolved_goal_count: 0
    }));
  });

  test('emits failure clusters and remediation actions for failed close-loop-program', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-13-a', sub_specs: [] } })
      .mockRejectedValueOnce(new Error('orchestration timeout while waiting for agent response'));

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-program',
        'build autonomous close-loop and orchestrate multi-spec program',
        '--program-goals',
        '2',
        '--batch-retry-rounds',
        '0',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.mode).toBe('auto-close-loop-program');
    expect(summary.status).toMatch(/failed/);
    expect(summary.program_diagnostics).toEqual(expect.objectContaining({
      failed_goal_count: 2
    }));
    expect(summary.program_diagnostics.failure_clusters.length).toBeGreaterThan(0);
    expect(summary.program_diagnostics.remediation_actions.length).toBeGreaterThan(0);
    expect(summary.program_diagnostics.remediation_actions[0]).toEqual(expect.objectContaining({
      priority: 'high'
    }));
  });

  test('reuses learned remediation action when --use-action is omitted in close-loop-recover', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 2,
      processed_goals: 2,
      completed_goals: 0,
      failed_goals: 2,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        },
        {
          index: 2,
          goal: 'recover goal two',
          status: 'error',
          error: 'agent timed out before completion'
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-13-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-13-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-13-a-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-13-b-r2', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-recover',
      summaryFile,
      '--use-action',
      '2',
      '--recovery-memory-scope',
      'kse-scope-a',
      '--dry-run',
      '--json'
    ]);

    logSpy.mockClear();

    const secondProgram = buildProgram();
    await secondProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-recover',
      summaryFile,
      '--recovery-memory-scope',
      'kse-scope-a',
      '--dry-run',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.recovered_from_summary).toEqual(expect.objectContaining({
      selected_action_index: 2
    }));
    expect(summary.recovery_plan).toEqual(expect.objectContaining({
      selection_source: 'memory'
    }));
    expect(summary.recovery_plan.selection_explain).toEqual(expect.objectContaining({
      mode: 'memory'
    }));
    expect(summary.recovery_memory).toEqual(expect.objectContaining({
      scope: 'kse-scope-a',
      selection_source: 'memory',
      selected_action_index: 2
    }));
  });

  test('recovers from summary with selected remediation action via close-loop-recover', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 2,
      processed_goals: 2,
      completed_goals: 0,
      failed_goals: 2,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        },
        {
          index: 2,
          goal: 'recover goal two',
          status: 'error',
          error: 'agent timed out before completion'
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-14-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-14-b', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-recover',
      summaryFile,
      '--use-action',
      '2',
      '--dry-run',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.mode).toBe('auto-close-loop-recover');
    expect(summary.recovered_from_summary).toEqual(expect.objectContaining({
      file: summaryFile,
      selected_action_index: 2
    }));
    expect(summary.recovery_plan).toEqual(expect.objectContaining({
      applied_patch: expect.objectContaining({
        batchParallel: 2,
        batchAgentBudget: 2
      })
    }));
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      agent_budget: 2
    }));
    expect(summary.recovery_cycle).toEqual(expect.objectContaining({
      enabled: false,
      performed_rounds: 1,
      converged: true
    }));
  });

  test('applies program gate budget policy in close-loop-recover', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const summaryFile = path.join(tempDir, 'summary-for-recover-gate.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      goals_file: goalsFile,
      total_goals: 1,
      processed_goals: 1,
      failed_goals: 1,
      results: [
        {
          index: 1,
          goal: 'goal one',
          status: 'failed',
          master_spec: '121-00-a',
          sub_spec_count: 0
        }
      ],
      program_diagnostics: {
        remediation_actions: []
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-fixed', sub_specs: [] }
    });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-recover',
        summaryFile,
        '--batch-agent-budget',
        '2',
        '--program-max-agent-budget',
        '1',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.mode).toBe('auto-close-loop-recover');
    expect(summary.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_agent_budget: 1
      }),
      actual: expect.objectContaining({
        agent_budget: 2
      })
    }));
  });

  test('runs multi-round close-loop-recover until completion', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 2,
      processed_goals: 2,
      completed_goals: 0,
      failed_goals: 2,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        },
        {
          index: 2,
          goal: 'recover goal two',
          status: 'error',
          error: 'agent timed out before completion'
        }
      ]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '122-15-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-15-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-15-a-fix', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-recover',
      summaryFile,
      '--use-action',
      '2',
      '--recover-until-complete',
      '--recover-max-rounds',
      '3',
      '--batch-retry-rounds',
      '0',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.mode).toBe('auto-close-loop-recover');
    expect(summary.status).toBe('completed');
    expect(summary.recovery_cycle).toEqual(expect.objectContaining({
      enabled: true,
      max_rounds: 3,
      performed_rounds: 2,
      converged: true,
      exhausted: false
    }));
    expect(summary.recovery_cycle.history).toHaveLength(2);
  });

  test('validates --use-action range in close-loop-recover', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 1,
      processed_goals: 1,
      completed_goals: 0,
      failed_goals: 1,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        }
      ]
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-recover',
        summaryFile,
        '--use-action',
        '9',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toContain('--use-action 9 is out of range.');
  });

  test('rejects --recover-max-rounds without --recover-until-complete in close-loop-recover', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 1,
      processed_goals: 1,
      completed_goals: 0,
      failed_goals: 1,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        }
      ]
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-recover',
        summaryFile,
        '--recover-max-rounds',
        '2',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).not.toHaveBeenCalled();
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toContain('--recover-max-rounds requires --recover-until-complete.');
  });

  test('validates --recover-max-minutes range in close-loop-recover', async () => {
    const summaryFile = path.join(tempDir, 'program-failed-summary.json');
    await fs.writeJson(summaryFile, {
      mode: 'auto-close-loop-program',
      status: 'failed',
      total_goals: 1,
      processed_goals: 1,
      completed_goals: 0,
      failed_goals: 1,
      results: [
        {
          index: 1,
          goal: 'recover goal one',
          status: 'failed',
          error: 'orchestration timeout while waiting for agent response'
        }
      ]
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-recover',
        summaryFile,
        '--recover-max-minutes',
        '0',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toContain('--recover-max-minutes must be an integer between 1 and 10080.');
  });

  test('fails close-loop-batch when goals file is missing', async () => {
    const program = buildProgram();

    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        'missing-goals.json'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Goals file not found');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('requires goals file when --resume-from-summary is not provided', async () => {
    const program = buildProgram();

    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('<goals-file> is required unless --resume-from-summary or --decompose-goal is provided.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('runs close-loop-batch from --decompose-goal without goals file', async () => {
    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-c', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      '--decompose-goal',
      'build autonomous close-loop, master/sub decomposition, orchestration, and quality gate rollout for kse',
      '--program-goals',
      '3',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.total_goals).toBe(3);
    expect(summary.generated_from_goal).toEqual(expect.objectContaining({
      strategy: 'semantic-clause-and-category',
      target_goal_count: 3,
      produced_goal_count: 3
    }));
  });

  test('auto-refines decomposed goals when quality score threshold is not met', async () => {
    runAutoCloseLoop.mockResolvedValue({
      status: 'planned',
      portfolio: { master_spec: '122-00-refine', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      '--decompose-goal',
      'orchestration, quality, docs',
      '--program-goals',
      '12',
      '--program-min-quality-score',
      '99',
      '--dry-run',
      '--json'
    ]);

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.generated_from_goal.quality.refinement).toEqual(expect.objectContaining({
      attempted: true,
      min_score: 99
    }));
  });

  test('fails decomposition quality gate when score remains below threshold', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        '--decompose-goal',
        'orchestration, quality, docs',
        '--program-goals',
        '12',
        '--program-min-quality-score',
        '99',
        '--program-quality-gate',
        '--dry-run',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('Decomposition quality score');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('rejects mixing goals file with --decompose-goal', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--decompose-goal',
        'split this into multiple goals'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Provide either <goals-file> or --decompose-goal, not both.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('rejects mixing --resume-from-summary with --decompose-goal', async () => {
    const summaryFile = path.join(tempDir, 'summary.json');
    await fs.writeJson(summaryFile, { mode: 'auto-close-loop-batch', results: [] }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        '--resume-from-summary',
        summaryFile,
        '--decompose-goal',
        'split this into multiple goals'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Provide either --resume-from-summary or --decompose-goal, not both.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('rejects --program-goals without --decompose-goal', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--program-goals',
        '4'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-goals requires --decompose-goal.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --program-goals range in close-loop-batch', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        '--decompose-goal',
        'split this into multiple goals',
        '--program-goals',
        '1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--program-goals must be an integer between 2 and 12.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('rejects using goals file and --resume-from-summary together', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const summaryFile = path.join(tempDir, 'summary.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    await fs.writeJson(summaryFile, { mode: 'auto-close-loop-batch', results: [] }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--resume-from-summary',
        summaryFile
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('Provide either <goals-file> or --resume-from-summary, not both.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --resume-strategy when resuming from summary', async () => {
    const summaryFile = path.join(tempDir, 'summary.json');
    await fs.writeJson(summaryFile, { mode: 'auto-close-loop-batch', results: [] }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        '--resume-from-summary',
        summaryFile,
        '--resume-strategy',
        'random-mode'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--resume-strategy must be one of: pending, failed-only');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-parallel range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-parallel',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-parallel must be an integer between 1 and 20.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-agent-budget range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-agent-budget',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-agent-budget must be an integer between 1 and 500.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-priority strategy in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-priority',
        'random-order'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-priority must be one of: fifo, complex-first, complex-last, critical-first.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-aging-factor range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-aging-factor',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-aging-factor must be an integer between 0 and 100.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-retry-rounds range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-rounds',
        '6'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-retry-rounds must be an integer between 0 and 5.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-retry-strategy in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-strategy',
        'random'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-retry-strategy must be one of: adaptive, strict.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('rejects --batch-retry-max-rounds without --batch-retry-until-complete', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-max-rounds',
        '3'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-retry-max-rounds requires --batch-retry-until-complete.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-retry-max-rounds range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-until-complete',
        '--batch-retry-max-rounds',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-retry-max-rounds must be an integer between 1 and 20.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --batch-session-keep range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-session-keep',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-session-keep must be an integer between 0 and 1000.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('enables autonomous batch closed-loop policy with --batch-autonomous', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, {
      goals: ['goal one', 'goal two', 'goal three']
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-a', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-b', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-c', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-autonomous',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.autonomous_policy).toEqual(expect.objectContaining({
      enabled: true,
      profile: 'closed-loop'
    }));
    expect(summary.batch_parallel).toBe(3);
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      scheduling_strategy: 'complex-first',
      aging_factor: 2
    }));
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      enabled: true,
      until_complete: true,
      configured_rounds: 0,
      max_rounds: 10
    }));
  });

  test('allows --batch-retry-max-rounds with --batch-autonomous', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-a', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-autonomous',
      '--batch-retry-max-rounds',
      '3',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      max_rounds: 3
    }));
  });

  test('validates --batch-session-older-than-days range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-session-older-than-days',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--batch-session-older-than-days must be an integer between 0 and 36500.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --spec-session-keep range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-keep',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--keep must be an integer between 0 and 5000.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --spec-session-protect-window-days range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-protect-window-days',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-protect-window-days must be an integer between 0 and 36500.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --spec-session-max-total range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-total',
        '0'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-max-total must be an integer between 1 and 500000.');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('fails close-loop-batch when duplicate goal guard exceeds configured threshold', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['same goal', 'same goal'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-duplicate-goals',
        '0',
        '--spec-session-budget-hard-fail',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Goal input duplicate guard exceeded');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('validates --spec-session-max-created range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-created',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-max-created must be an integer between 0 and 500000.');
  });

  test('validates --spec-session-max-created-per-goal range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-created-per-goal',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-max-created-per-goal must be a number between 0 and 1000.');
  });

  test('validates --spec-session-max-duplicate-goals range in close-loop-batch', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-duplicate-goals',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-max-duplicate-goals must be an integer between 0 and 500000.');
  });

  test('prioritizes complex goals first with --batch-priority complex-first', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const complexGoal = [
      'deliver orchestration integration migration observability and security resilience,',
      'plus quality compliance governance and performance hardening,',
      'with closed-loop remediation and parallel master sub coordination.'
    ].join(' ');
    await fs.writeJson(goalsFile, {
      goals: ['simple goal', complexGoal]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-complex', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-simple', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-priority',
      'complex-first',
      '--batch-parallel',
      '1',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, complexGoal, expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'simple goal', expect.any(Object));
  });

  test('prioritizes critical goals first with --batch-priority critical-first', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const criticalGoal = 'build core platform schema baseline and dependency contracts for master orchestration';
    await fs.writeJson(goalsFile, {
      goals: ['polish release notes and docs wording', criticalGoal]
    }, { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-critical', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-non-critical', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-priority',
      'critical-first',
      '--batch-parallel',
      '1',
      '--continue-on-error',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, criticalGoal, expect.any(Object));
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      scheduling_strategy: 'critical-first'
    }));
  });

  test('reports priority and aging metadata in batch resource plan', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    const heavyGoalOne = [
      'deliver orchestration integration migration observability and security resilience,',
      'plus quality compliance governance and performance hardening,',
      'with closed-loop remediation and parallel master sub coordination.'
    ].join(' ');
    const heavyGoalTwo = [
      'build autonomous governance compliance and resilience hardening across orchestration,',
      'with integrated observability dashboards and quality gate automation,',
      'plus closed-loop remediation and dependency-aware parallel execution.'
    ].join(' ');
    await fs.writeJson(goalsFile, {
      goals: [heavyGoalOne, heavyGoalTwo, 'simple goal']
    }, { spaces: 2 });

    runAutoCloseLoop.mockImplementation(async goal => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return {
        status: 'completed',
        portfolio: {
          master_spec: `master-${goal.slice(0, 12).replace(/\s+/g, '-')}`,
          sub_specs: []
        }
      };
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-priority',
      'complex-first',
      '--batch-aging-factor',
      '3',
      '--batch-parallel',
      '3',
      '--batch-agent-budget',
      '5',
      '--continue-on-error',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const summary = JSON.parse(output.trim());
    expect(summary.resource_plan).toEqual(expect.objectContaining({
      scheduling_strategy: 'complex-first',
      aging_factor: 3
    }));
    expect(summary.resource_plan.max_wait_ticks).toBeGreaterThanOrEqual(1);
    expect(summary.resource_plan.starvation_wait_events).toBeGreaterThanOrEqual(1);
    expect(summary.results.some(item => item.wait_ticks > 0)).toBe(true);
    expect(summary.results.every(item => Number.isFinite(item.base_priority))).toBe(true);
  });

  test('stops on first failed goal in close-loop-batch by default', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['first failed goal', 'second should not run'], { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-pass', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-parallel',
      '1',
      '--json'
    ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).toHaveBeenCalled();
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.failed_goals).toBeGreaterThanOrEqual(1);
    expect(summary.status).not.toBe('completed');
  });

  test('continues on error in close-loop-batch with --continue-on-error', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['first throws', 'second still runs'], { spaces: 2 });

    runAutoCloseLoop
      .mockRejectedValueOnce(new Error('runner exploded'))
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '122-00-pass', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--continue-on-error',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.processed_goals).toBe(2);
    expect(summary.completed_goals).toBe(1);
    expect(summary.failed_goals).toBe(1);
    expect(summary.stopped_early).toBe(false);
    expect(summary.status).toBe('partial-failed');
  });

  test('auto-retries failed goals in close-loop-batch with --batch-retry-rounds', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['first flaky goal', 'second stable goal'], { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-flaky', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-stable', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-flaky-fixed', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--continue-on-error',
      '--batch-retry-rounds',
      '1',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'first flaky goal', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'second stable goal', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(3, 'first flaky goal', expect.any(Object));

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.failed_goals).toBe(0);
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      enabled: true,
      configured_rounds: 1,
      performed_rounds: 1,
      exhausted: false
    }));
    expect(summary.results).toHaveLength(2);
    expect(summary.results[0].status).toBe('completed');
    expect(summary.results[0].batch_attempt).toBe(2);
    expect(summary.results[1].status).toBe('completed');
    expect(summary.results[1].batch_attempt).toBe(1);
  });

  test('uses adaptive retry strategy to drain unprocessed goals after stop-on-error', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['first always fails', 'second should eventually run'], { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-pass-r2', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-rounds',
        '1',
        '--batch-retry-strategy',
        'adaptive',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'first always fails', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'first always fails', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(3, 'second should eventually run', expect.any(Object));

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('partial-failed');
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      strategy: 'adaptive',
      configured_rounds: 1,
      performed_rounds: 1
    }));
    expect(summary.batch_retry.history[1]).toEqual(expect.objectContaining({
      round: 2,
      continue_on_error: true
    }));
    expect(summary.results[1].status).toBe('completed');
    expect(summary.results[1].batch_attempt).toBe(2);
  });

  test('uses strict retry strategy to keep stop-on-error behavior across retry rounds', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['first always fails', 'second remains blocked'], { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r2', sub_specs: [] } });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--batch-retry-rounds',
        '1',
        '--batch-retry-strategy',
        'strict',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(1, 'first always fails', expect.any(Object));
    expect(runAutoCloseLoop).toHaveBeenNthCalledWith(2, 'first always fails', expect.any(Object));

    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('failed');
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      strategy: 'strict',
      configured_rounds: 1,
      performed_rounds: 1,
      exhausted: true
    }));
    expect(summary.batch_retry.history[1]).toEqual(expect.objectContaining({
      round: 2,
      continue_on_error: false
    }));
    expect(summary.results[1].status).toBe('stopped');
  });

  test('supports --batch-retry-until-complete without explicit retry rounds', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['single flaky goal'], { spaces: 2 });

    runAutoCloseLoop
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r1', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'failed', portfolio: { master_spec: '121-00-fail-r2', sub_specs: [] } })
      .mockResolvedValueOnce({ status: 'completed', portfolio: { master_spec: '121-00-pass-r3', sub_specs: [] } });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--batch-retry-until-complete',
      '--batch-retry-max-rounds',
      '3',
      '--json'
    ]);

    expect(runAutoCloseLoop).toHaveBeenCalledTimes(3);
    const summary = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(summary.status).toBe('completed');
    expect(summary.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      configured_rounds: 0,
      max_rounds: 3,
      performed_rounds: 2,
      exhausted: false
    }));
    expect(summary.results[0].status).toBe('completed');
    expect(summary.results[0].batch_attempt).toBe(3);
  });

  test('lists close-loop sessions in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const sessionPath = path.join(sessionDir, 'demo-session.json');
    await fs.writeJson(sessionPath, {
      session_id: 'demo-session',
      updated_at: '2026-02-14T10:00:00.000Z',
      status: 'completed',
      goal: 'demo goal',
      portfolio: {
        master_spec: '121-00-demo',
        sub_specs: ['121-01-a', '121-02-b']
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'session', 'list', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual([]);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ completed: 1 }));
    expect(parsed.sessions[0].id).toBe('demo-session');
    expect(parsed.sessions[0].master_spec).toBe('121-00-demo');
  });

  test('filters close-loop sessions by status in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'session-completed.json');
    const failedSession = path.join(sessionDir, 'session-failed.json');
    await fs.writeJson(completedSession, {
      session_id: 'session-completed',
      status: 'completed',
      portfolio: { sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(failedSession, {
      session_id: 'session-failed',
      status: 'failed',
      portfolio: { sub_specs: [] }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'session', 'list', '--status', 'completed', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual(['completed']);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ completed: 1 }));
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].id).toBe('session-completed');
  });

  test('aggregates close-loop session stats in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'session-stats-completed.json');
    const failedSession = path.join(sessionDir, 'session-stats-failed.json');
    await fs.writeJson(completedSession, {
      session_id: 'session-stats-completed',
      status: 'completed',
      goal: 'completed goal',
      portfolio: {
        master_spec: '121-00-completed',
        sub_specs: ['121-01-a', '121-02-b']
      }
    }, { spaces: 2 });
    await fs.writeJson(failedSession, {
      session_id: 'session-stats-failed',
      status: 'failed',
      goal: 'failed goal',
      portfolio: {
        master_spec: '121-00-failed',
        sub_specs: ['121-03-c']
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'session', 'stats', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-session-stats');
    expect(parsed.total_sessions).toBe(2);
    expect(parsed.completed_sessions).toBe(1);
    expect(parsed.failed_sessions).toBe(1);
    expect(parsed.completion_rate_percent).toBe(50);
    expect(parsed.failure_rate_percent).toBe(50);
    expect(parsed.sub_spec_count_sum).toBe(3);
    expect(parsed.unique_master_spec_count).toBe(2);
    expect(parsed.status_counts).toEqual(expect.objectContaining({
      completed: 1,
      failed: 1
    }));
    expect(parsed.master_spec_counts).toEqual(expect.objectContaining({
      '121-00-completed': 1,
      '121-00-failed': 1
    }));
    expect(Array.isArray(parsed.latest_sessions)).toBe(true);
    expect(parsed.latest_sessions.length).toBe(2);
  });

  test('filters close-loop session stats by days and status', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'session-stats-old.json');
    const freshSession = path.join(sessionDir, 'session-stats-fresh.json');
    await fs.writeJson(oldSession, {
      session_id: 'session-stats-old',
      status: 'completed',
      portfolio: { master_spec: '121-00-old', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(freshSession, {
      session_id: 'session-stats-fresh',
      status: 'completed',
      portfolio: { master_spec: '121-00-fresh', sub_specs: ['121-01-a'] }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    const now = new Date();
    await fs.utimes(freshSession, now, now);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'session',
      'stats',
      '--days',
      '30',
      '--status',
      'completed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-session-stats');
    expect(parsed.criteria.days).toBe(30);
    expect(parsed.criteria.status_filter).toEqual(['completed']);
    expect(parsed.total_sessions).toBe(1);
    expect(parsed.sub_spec_count_sum).toBe(1);
    expect(parsed.latest_sessions[0].id).toBe('session-stats-fresh');
  });

  test('lists spec-session directories in json mode', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const specA = path.join(specsDir, '121-00-demo-a');
    const specB = path.join(specsDir, '121-01-demo-b');
    await fs.ensureDir(specA);
    await fs.ensureDir(specB);
    await fs.utimes(specA, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));
    await fs.utimes(specB, new Date('2026-01-02T00:00:00.000Z'), new Date('2026-01-02T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'spec-session', 'list', '--limit', '1', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-spec-session-list');
    expect(parsed.total).toBe(2);
    expect(parsed.specs).toHaveLength(1);
    expect(parsed.specs[0].id).toBe('121-01-demo-b');
  });

  test('prunes spec-session directories with keep policy', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const oldSpec = path.join(specsDir, '121-00-old-spec');
    const newSpec = path.join(specsDir, '122-00-new-spec');
    await fs.ensureDir(oldSpec);
    await fs.ensureDir(newSpec);
    await fs.utimes(oldSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSpec, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'spec-session', 'prune', '--keep', '1', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(newSpec)).toBe(true);
    expect(await fs.pathExists(oldSpec)).toBe(false);
  });

  test('protects active spec-session directories by default', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const activeSpec = path.join(specsDir, '121-00-active');
    const staleSpec = path.join(specsDir, '121-01-stale');
    await fs.ensureDir(activeSpec);
    await fs.ensureDir(staleSpec);
    await fs.writeJson(path.join(activeSpec, 'collaboration.json'), {
      status: 'in-progress'
    }, { spaces: 2 });
    await fs.utimes(activeSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(staleSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(parsed.protect_active).toBe(true);
    expect(parsed.protected_count).toBeGreaterThanOrEqual(1);
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(activeSpec)).toBe(true);
    expect(await fs.pathExists(staleSpec)).toBe(false);
  });

  test('allows pruning active specs with --no-protect-active', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const activeSpec = path.join(specsDir, '121-00-active');
    await fs.ensureDir(activeSpec);
    await fs.writeJson(path.join(activeSpec, 'collaboration.json'), {
      status: 'in-progress'
    }, { spaces: 2 });
    await fs.utimes(activeSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--no-protect-active',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(parsed.protect_active).toBe(false);
    expect(parsed.protected_count).toBe(0);
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(activeSpec)).toBe(false);
  });

  test('supports custom protection window in spec-session prune output', async () => {
    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--protect-window-days',
      '0',
      '--dry-run',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(parsed.protect_window_days).toBe(0);
  });

  test('includes protection ranking top in spec-session prune output', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const activeSpec = path.join(specsDir, '121-00-active');
    const staleSpec = path.join(specsDir, '121-01-stale');
    await fs.ensureDir(activeSpec);
    await fs.ensureDir(staleSpec);
    await fs.writeJson(path.join(activeSpec, 'collaboration.json'), {
      status: 'in-progress'
    }, { spaces: 2 });
    await fs.utimes(activeSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(staleSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(Array.isArray(parsed.protection_ranking_top)).toBe(true);
    expect(parsed.protection_ranking_top).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spec: '121-00-active',
        total_references: 1
      })
    ]));
    expect(parsed.protection_ranking).toBeUndefined();
    expect(parsed.protected_specs[0].reasons).toBeUndefined();
  });

  test('shows detailed protection reasons when requested in spec-session prune', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const activeSpec = path.join(specsDir, '121-00-active');
    const staleSpec = path.join(specsDir, '121-01-stale');
    await fs.ensureDir(activeSpec);
    await fs.ensureDir(staleSpec);
    await fs.writeJson(path.join(activeSpec, 'collaboration.json'), {
      status: 'in-progress'
    }, { spaces: 2 });
    await fs.utimes(activeSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(staleSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--show-protection-reasons',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-spec-session-prune');
    expect(parsed.protected_specs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '121-00-active',
        reasons: expect.objectContaining({
          total_references: 1,
          collaboration_active: 1
        })
      })
    ]));
    expect(parsed.protection_ranking).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spec: '121-00-active',
        total_references: 1,
        reasons: expect.objectContaining({
          collaboration_active: 1
        })
      })
    ]));
  });

  test('protects specs referenced by controller sessions during spec-session prune', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const activeSpec = path.join(specsDir, '121-00-controller-active');
    const staleSpec = path.join(specsDir, '121-01-stale');
    await fs.ensureDir(activeSpec);
    await fs.ensureDir(staleSpec);
    await fs.utimes(activeSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(staleSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(batchSessionDir);
    const nestedBatchSummary = path.join(batchSessionDir, 'controller-protected-summary.json');
    await fs.writeJson(nestedBatchSummary, {
      mode: 'auto-close-loop-program',
      status: 'partial-failed',
      results: [
        {
          index: 1,
          goal: 'controller derived goal',
          status: 'failed',
          master_spec: '121-00-controller-active'
        }
      ]
    }, { spaces: 2 });

    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(controllerSessionDir);
    const controllerSessionFile = path.join(controllerSessionDir, 'controller-protected-session.json');
    await fs.writeJson(controllerSessionFile, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      results: [
        {
          goal: 'controller goal',
          status: 'failed',
          batch_session_file: nestedBatchSummary
        }
      ],
      controller_session: {
        id: 'controller-protected-session',
        file: controllerSessionFile
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--show-protection-reasons',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.protected_specs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '121-00-controller-active',
        reasons: expect.objectContaining({
          controller_session_recent_or_incomplete: 1
        })
      })
    ]));
    expect(await fs.pathExists(activeSpec)).toBe(true);
    expect(await fs.pathExists(staleSpec)).toBe(false);
  });

  test('applies automatic spec-session retention policy in close-loop-batch summary', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const oldSpec = path.join(specsDir, '121-00-old');
    const newSpec = path.join(specsDir, '122-00-new');
    await fs.ensureDir(oldSpec);
    await fs.ensureDir(newSpec);
    await fs.utimes(oldSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSpec, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-new', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--spec-session-keep',
      '1',
      '--spec-session-older-than-days',
      '1',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.spec_session_prune).toEqual(expect.objectContaining({
      mode: 'auto-spec-session-prune',
      deleted_count: 1,
      protect_active: true
    }));
    expect(await fs.pathExists(newSpec)).toBe(true);
    expect(await fs.pathExists(oldSpec)).toBe(false);
  });

  test('reports spec-session budget telemetry in close-loop-batch summary', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    await fs.ensureDir(path.join(specsDir, '121-00-existing-a'));
    await fs.ensureDir(path.join(specsDir, '121-01-existing-b'));

    runAutoCloseLoop.mockResolvedValueOnce({
      status: 'completed',
      portfolio: { master_spec: '122-00-new', sub_specs: [] }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'close-loop-batch',
      goalsFile,
      '--spec-session-max-total',
      '1',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.spec_session_budget).toEqual(expect.objectContaining({
      enabled: true,
      max_total: 1,
      hard_fail: false,
      total_before: 2,
      total_after: 2,
      over_limit_before: true,
      over_limit_after: true,
      hard_fail_triggered: false
    }));
  });

  test('fails close-loop-batch after run when spec growth guard exceeds max-created with hard-fail', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    await fs.ensureDir(path.join(specsDir, '121-00-existing-a'));

    runAutoCloseLoop.mockImplementationOnce(async () => {
      await fs.ensureDir(path.join(specsDir, '122-00-created-during-run'));
      return {
        status: 'completed',
        portfolio: { master_spec: '122-00-created-during-run', sub_specs: [] }
      };
    });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-created',
        '0',
        '--spec-session-budget-hard-fail',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.status).toBe('completed');
    expect(parsed.spec_session_growth_guard).toEqual(expect.objectContaining({
      enabled: true,
      max_created: 0,
      estimated_created: 1,
      over_limit: true,
      hard_fail_triggered: true
    }));
  });

  test('fails close-loop-batch before run when spec-session budget is already exceeded with hard-fail', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    await fs.ensureDir(path.join(specsDir, '121-00-existing-a'));
    await fs.ensureDir(path.join(specsDir, '121-01-existing-b'));

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-total',
        '1',
        '--spec-session-budget-hard-fail',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain('Spec session budget exceeded before run');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('fails close-loop-batch after run when spec-session budget exceeds limit with hard-fail', async () => {
    const goalsFile = path.join(tempDir, 'goals.json');
    await fs.writeJson(goalsFile, ['goal one'], { spaces: 2 });
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    await fs.ensureDir(path.join(specsDir, '121-00-existing-a'));

    runAutoCloseLoop.mockImplementationOnce(async () => {
      await fs.ensureDir(path.join(specsDir, '122-00-created-during-run'));
      return {
        status: 'completed',
        portfolio: { master_spec: '122-00-created-during-run', sub_specs: [] }
      };
    });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'close-loop-batch',
        goalsFile,
        '--spec-session-max-total',
        '1',
        '--spec-session-budget-hard-fail',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.status).toBe('completed');
    expect(parsed.spec_session_budget).toEqual(expect.objectContaining({
      enabled: true,
      hard_fail: true,
      total_before: 1,
      total_after: 2,
      over_limit_after: true,
      hard_fail_triggered: true
    }));
  });

  test('validates --keep range in spec-session prune', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'spec-session',
        'prune',
        '--keep',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--keep must be an integer between 0 and 5000.');
  });

  test('validates --protect-window-days range in spec-session prune', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'spec-session',
        'prune',
        '--protect-window-days',
        '-1'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--spec-session-protect-window-days must be an integer between 0 and 36500.');
  });

  test('lists close-loop-batch summary sessions in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const sessionPath = path.join(sessionDir, 'demo-batch-session.json');
    await fs.writeJson(sessionPath, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      goals_file: '.kiro/goals.json',
      total_goals: 2,
      processed_goals: 2,
      updated_at: '2026-02-14T10:00:00.000Z',
      batch_session: {
        id: 'demo-batch-session',
        file: sessionPath
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'batch-session', 'list', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-batch-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual([]);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ completed: 1 }));
    expect(parsed.sessions[0].id).toBe('demo-batch-session');
    expect(parsed.sessions[0].status).toBe('completed');
  });

  test('filters close-loop-batch summary sessions by status in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'batch-completed.json');
    const failedSession = path.join(sessionDir, 'batch-failed.json');
    await fs.writeJson(completedSession, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      batch_session: { id: 'batch-completed', file: completedSession }
    }, { spaces: 2 });
    await fs.writeJson(failedSession, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      batch_session: { id: 'batch-failed', file: failedSession }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'batch-session',
      'list',
      '--status',
      'failed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-batch-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual(['failed']);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ failed: 1 }));
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].id).toBe('batch-failed');
  });

  test('aggregates close-loop-batch summary session stats in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'batch-stats-completed.json');
    const failedSession = path.join(sessionDir, 'batch-stats-failed.json');
    await fs.writeJson(completedSession, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 4,
      processed_goals: 4,
      batch_session: { id: 'batch-stats-completed', file: completedSession }
    }, { spaces: 2 });
    await fs.writeJson(failedSession, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 3,
      processed_goals: 1,
      batch_session: { id: 'batch-stats-failed', file: failedSession }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'batch-session', 'stats', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-batch-session-stats');
    expect(parsed.total_sessions).toBe(2);
    expect(parsed.completed_sessions).toBe(1);
    expect(parsed.failed_sessions).toBe(1);
    expect(parsed.completion_rate_percent).toBe(50);
    expect(parsed.failure_rate_percent).toBe(50);
    expect(parsed.total_goals_sum).toBe(7);
    expect(parsed.processed_goals_sum).toBe(5);
    expect(parsed.unprocessed_goals_sum).toBe(2);
    expect(parsed.average_processed_ratio_percent).toBeCloseTo(71.43, 2);
    expect(parsed.status_counts).toEqual(expect.objectContaining({
      completed: 1,
      failed: 1
    }));
    expect(Array.isArray(parsed.latest_sessions)).toBe(true);
    expect(parsed.latest_sessions.length).toBe(2);
  });

  test('filters close-loop-batch summary session stats by days and status', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'batch-stats-old.json');
    const freshSession = path.join(sessionDir, 'batch-stats-fresh.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 5,
      processed_goals: 2,
      batch_session: { id: 'batch-stats-old', file: oldSession }
    }, { spaces: 2 });
    await fs.writeJson(freshSession, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 6,
      processed_goals: 1,
      batch_session: { id: 'batch-stats-fresh', file: freshSession }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    const now = new Date();
    await fs.utimes(freshSession, now, now);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'batch-session',
      'stats',
      '--days',
      '30',
      '--status',
      'failed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-batch-session-stats');
    expect(parsed.criteria.days).toBe(30);
    expect(parsed.criteria.status_filter).toEqual(['failed']);
    expect(parsed.total_sessions).toBe(1);
    expect(parsed.total_goals_sum).toBe(6);
    expect(parsed.processed_goals_sum).toBe(1);
    expect(parsed.latest_sessions[0].id).toBe('batch-stats-fresh');
  });

  test('prunes sessions with keep policy', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'old-session.json');
    const newSession = path.join(sessionDir, 'new-session.json');
    await fs.writeJson(oldSession, { session_id: 'old-session', portfolio: { sub_specs: [] } }, { spaces: 2 });
    await fs.writeJson(newSession, { session_id: 'new-session', portfolio: { sub_specs: [] } }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSession, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'session', 'prune', '--keep', '1', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-session-prune');
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(newSession)).toBe(true);
    expect(await fs.pathExists(oldSession)).toBe(false);
  });

  test('supports prune dry-run without deleting files', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const candidate = path.join(sessionDir, 'candidate.json');
    await fs.writeJson(candidate, { session_id: 'candidate', portfolio: { sub_specs: [] } }, { spaces: 2 });
    await fs.utimes(candidate, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--dry-run',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.dry_run).toBe(true);
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(candidate)).toBe(true);
  });

  test('prunes close-loop-batch summary sessions with keep policy', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'old-batch-session.json');
    const newSession = path.join(sessionDir, 'new-batch-session.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-close-loop-batch',
      batch_session: { id: 'old-batch-session', file: oldSession }
    }, { spaces: 2 });
    await fs.writeJson(newSession, {
      mode: 'auto-close-loop-batch',
      batch_session: { id: 'new-batch-session', file: newSession }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSession, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'batch-session', 'prune', '--keep', '1', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-batch-session-prune');
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(newSession)).toBe(true);
    expect(await fs.pathExists(oldSession)).toBe(false);
  });

  test('lists close-loop-controller summary sessions in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const sessionPath = path.join(sessionDir, 'demo-controller-session.json');
    await fs.writeJson(sessionPath, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      queue_file: '.kiro/auto/controller-goals.lines',
      queue_format: 'lines',
      processed_goals: 2,
      pending_goals: 0,
      updated_at: '2026-02-14T10:00:00.000Z',
      controller_session: {
        id: 'demo-controller-session',
        file: sessionPath
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'controller-session', 'list', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-controller-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual([]);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ completed: 1 }));
    expect(parsed.sessions[0].id).toBe('demo-controller-session');
    expect(parsed.sessions[0].status).toBe('completed');
  });

  test('filters close-loop-controller summary sessions by status in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'controller-completed.json');
    const partialFailedSession = path.join(sessionDir, 'controller-partial-failed.json');
    await fs.writeJson(completedSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      controller_session: { id: 'controller-completed', file: completedSession }
    }, { spaces: 2 });
    await fs.writeJson(partialFailedSession, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      controller_session: { id: 'controller-partial-failed', file: partialFailedSession }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'controller-session',
      'list',
      '--status',
      'partial-failed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-controller-session-list');
    expect(parsed.total).toBe(1);
    expect(parsed.status_filter).toEqual(['partial-failed']);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ 'partial-failed': 1 }));
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0].id).toBe('controller-partial-failed');
  });

  test('aggregates close-loop-controller session stats in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const completedSession = path.join(sessionDir, 'controller-stats-completed.json');
    const failedSession = path.join(sessionDir, 'controller-stats-partial-failed.json');
    await fs.writeJson(completedSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      queue_format: 'lines',
      processed_goals: 3,
      pending_goals: 0,
      controller_session: { id: 'controller-stats-completed', file: completedSession }
    }, { spaces: 2 });
    await fs.writeJson(failedSession, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      queue_format: 'json',
      processed_goals: 1,
      pending_goals: 2,
      controller_session: { id: 'controller-stats-partial-failed', file: failedSession }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'controller-session', 'stats', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-controller-session-stats');
    expect(parsed.total_sessions).toBe(2);
    expect(parsed.completed_sessions).toBe(1);
    expect(parsed.failed_sessions).toBe(1);
    expect(parsed.completion_rate_percent).toBe(50);
    expect(parsed.failure_rate_percent).toBe(50);
    expect(parsed.processed_goals_sum).toBe(4);
    expect(parsed.pending_goals_sum).toBe(2);
    expect(parsed.status_counts).toEqual(expect.objectContaining({
      completed: 1,
      'partial-failed': 1
    }));
    expect(parsed.queue_format_counts).toEqual(expect.objectContaining({
      lines: 1,
      json: 1
    }));
    expect(Array.isArray(parsed.latest_sessions)).toBe(true);
    expect(parsed.latest_sessions.length).toBe(2);
  });

  test('filters close-loop-controller session stats by days and status', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'controller-stats-old.json');
    const freshSession = path.join(sessionDir, 'controller-stats-fresh.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 2,
      pending_goals: 0,
      controller_session: { id: 'controller-stats-old', file: oldSession }
    }, { spaces: 2 });
    await fs.writeJson(freshSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 5,
      pending_goals: 1,
      controller_session: { id: 'controller-stats-fresh', file: freshSession }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    const now = new Date();
    await fs.utimes(freshSession, now, now);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'controller-session',
      'stats',
      '--days',
      '30',
      '--status',
      'completed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-controller-session-stats');
    expect(parsed.criteria.days).toBe(30);
    expect(parsed.criteria.status_filter).toEqual(['completed']);
    expect(parsed.total_sessions).toBe(1);
    expect(parsed.processed_goals_sum).toBe(5);
    expect(parsed.pending_goals_sum).toBe(1);
    expect(parsed.status_counts).toEqual(expect.objectContaining({ completed: 1 }));
    expect(parsed.latest_sessions[0].id).toBe('controller-stats-fresh');
  });

  test('aggregates governance stats across session archives in json mode', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const closeLoopFile = path.join(closeLoopSessionDir, 'governance-session.json');
    await fs.writeJson(closeLoopFile, {
      session_id: 'governance-session',
      status: 'completed',
      goal: 'governance goal',
      portfolio: {
        master_spec: '121-00-governance',
        sub_specs: ['121-01-a', '121-02-b']
      }
    }, { spaces: 2 });

    const batchFile = path.join(batchSessionDir, 'governance-batch.json');
    await fs.writeJson(batchFile, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 4,
      processed_goals: 2,
      batch_session: { id: 'governance-batch', file: batchFile }
    }, { spaces: 2 });

    const controllerFile = path.join(controllerSessionDir, 'governance-controller.json');
    await fs.writeJson(controllerFile, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      queue_format: 'lines',
      processed_goals: 3,
      pending_goals: 0,
      controller_session: { id: 'governance-controller', file: controllerFile }
    }, { spaces: 2 });

    const recoveryMemoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(recoveryMemoryFile));
    await fs.writeJson(recoveryMemoryFile, {
      version: 1,
      signatures: {
        'signature-governance': {
          signature: 'signature-governance',
          scope: 'scope-governance',
          attempts: 2,
          successes: 1,
          failures: 1,
          last_used_at: '2026-02-14T10:00:00.000Z',
          actions: {
            '1': {
              index: 1,
              title: 'retry latest',
              attempts: 2,
              successes: 1,
              failures: 1,
              last_used_at: '2026-02-14T10:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'governance', 'stats', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-stats');
    expect(parsed.totals).toEqual(expect.objectContaining({
      total_sessions: 3,
      completed_sessions: 2,
      failed_sessions: 1,
      completion_rate_percent: 66.67,
      failure_rate_percent: 33.33
    }));
    expect(parsed.throughput).toEqual(expect.objectContaining({
      sub_spec_count_sum: 2,
      batch_total_goals_sum: 4,
      batch_processed_goals_sum: 2,
      controller_processed_goals_sum: 3,
      controller_pending_goals_sum: 0
    }));
    expect(parsed.health.risk_level).toBe('medium');
    expect(Array.isArray(parsed.health.concerns)).toBe(true);
    expect(parsed.top_master_specs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: '121-00-governance',
        count: 1
      })
    ]));
    expect(parsed.recovery_memory).toEqual(expect.objectContaining({
      signature_count: 1,
      action_count: 1
    }));
    expect(parsed.archives.session.total_sessions).toBe(1);
    expect(parsed.archives.batch_session.total_sessions).toBe(1);
    expect(parsed.archives.controller_session.total_sessions).toBe(1);
  });

  test('filters governance stats by days and status', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const oldCloseLoop = path.join(closeLoopSessionDir, 'governance-old-session.json');
    const newCloseLoop = path.join(closeLoopSessionDir, 'governance-new-session.json');
    await fs.writeJson(oldCloseLoop, {
      session_id: 'governance-old-session',
      status: 'failed',
      portfolio: { master_spec: '121-00-old', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(newCloseLoop, {
      session_id: 'governance-new-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-new', sub_specs: ['121-01-new'] }
    }, { spaces: 2 });

    const oldBatch = path.join(batchSessionDir, 'governance-old-batch.json');
    const newBatch = path.join(batchSessionDir, 'governance-new-batch.json');
    await fs.writeJson(oldBatch, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 5,
      processed_goals: 1,
      batch_session: { id: 'governance-old-batch', file: oldBatch }
    }, { spaces: 2 });
    await fs.writeJson(newBatch, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 2,
      processed_goals: 2,
      batch_session: { id: 'governance-new-batch', file: newBatch }
    }, { spaces: 2 });

    const oldController = path.join(controllerSessionDir, 'governance-old-controller.json');
    const newController = path.join(controllerSessionDir, 'governance-new-controller.json');
    await fs.writeJson(oldController, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      processed_goals: 1,
      pending_goals: 2,
      controller_session: { id: 'governance-old-controller', file: oldController }
    }, { spaces: 2 });
    await fs.writeJson(newController, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 3,
      pending_goals: 0,
      controller_session: { id: 'governance-new-controller', file: newController }
    }, { spaces: 2 });

    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(oldCloseLoop, oldDate, oldDate);
    await fs.utimes(oldBatch, oldDate, oldDate);
    await fs.utimes(oldController, oldDate, oldDate);
    const now = new Date();
    await fs.utimes(newCloseLoop, now, now);
    await fs.utimes(newBatch, now, now);
    await fs.utimes(newController, now, now);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'stats',
      '--days',
      '30',
      '--status',
      'completed',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-stats');
    expect(parsed.criteria.days).toBe(30);
    expect(parsed.criteria.status_filter).toEqual(['completed']);
    expect(parsed.totals).toEqual(expect.objectContaining({
      total_sessions: 3,
      completed_sessions: 3,
      failed_sessions: 0,
      completion_rate_percent: 100,
      failure_rate_percent: 0
    }));
    expect(parsed.archives.session.total_sessions).toBe(1);
    expect(parsed.archives.batch_session.total_sessions).toBe(1);
    expect(parsed.archives.controller_session.total_sessions).toBe(1);
    expect(parsed.health.risk_level).toBe('low');
  });

  test('plans governance maintenance actions in json mode without apply', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    const sessionFile = path.join(closeLoopSessionDir, 'governance-maintain-plan-session.json');
    await fs.writeJson(sessionFile, {
      session_id: 'governance-maintain-plan-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-plan', sub_specs: [] }
    }, { spaces: 2 });

    const recoveryMemoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(recoveryMemoryFile));
    await fs.writeJson(recoveryMemoryFile, {
      version: 1,
      signatures: {
        'maintain-plan-signature': {
          signature: 'maintain-plan-signature',
          scope: 'maintain-plan',
          attempts: 1,
          successes: 1,
          failures: 0,
          last_used_at: '2026-02-14T10:00:00.000Z',
          actions: {
            '1': {
              index: 1,
              title: 'reuse',
              attempts: 1,
              successes: 1,
              failures: 0,
              last_used_at: '2026-02-14T10:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'maintain',
      '--session-keep',
      '0',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-maintain');
    expect(parsed.apply).toBe(false);
    expect(parsed.summary.planned_actions).toBeGreaterThanOrEqual(2);
    expect(parsed.summary.applied_actions).toBe(0);
    expect(parsed.executed_actions).toEqual([]);
    expect(parsed.plan).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'session-prune',
        enabled: true,
        apply_supported: true
      }),
      expect.objectContaining({
        id: 'recovery-memory-prune',
        enabled: true,
        apply_supported: true
      })
    ]));
  });

  test('applies governance maintenance actions and returns after assessment', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const sessionOld = path.join(closeLoopSessionDir, 'governance-maintain-old-session.json');
    const sessionNew = path.join(closeLoopSessionDir, 'governance-maintain-new-session.json');
    await fs.writeJson(sessionOld, {
      session_id: 'governance-maintain-old-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-old', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(sessionNew, {
      session_id: 'governance-maintain-new-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-new', sub_specs: [] }
    }, { spaces: 2 });

    const batchOld = path.join(batchSessionDir, 'governance-maintain-old-batch.json');
    const batchNew = path.join(batchSessionDir, 'governance-maintain-new-batch.json');
    await fs.writeJson(batchOld, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 2,
      processed_goals: 2,
      batch_session: { id: 'governance-maintain-old-batch', file: batchOld }
    }, { spaces: 2 });
    await fs.writeJson(batchNew, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 2,
      processed_goals: 2,
      batch_session: { id: 'governance-maintain-new-batch', file: batchNew }
    }, { spaces: 2 });

    const controllerOld = path.join(controllerSessionDir, 'governance-maintain-old-controller.json');
    const controllerNew = path.join(controllerSessionDir, 'governance-maintain-new-controller.json');
    await fs.writeJson(controllerOld, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: { id: 'governance-maintain-old-controller', file: controllerOld }
    }, { spaces: 2 });
    await fs.writeJson(controllerNew, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: { id: 'governance-maintain-new-controller', file: controllerNew }
    }, { spaces: 2 });

    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(sessionOld, oldDate, oldDate);
    await fs.utimes(batchOld, oldDate, oldDate);
    await fs.utimes(controllerOld, oldDate, oldDate);
    const now = new Date();
    await fs.utimes(sessionNew, now, now);
    await fs.utimes(batchNew, now, now);
    await fs.utimes(controllerNew, now, now);

    const recoveryMemoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(recoveryMemoryFile));
    await fs.writeJson(recoveryMemoryFile, {
      version: 1,
      signatures: {
        'maintain-apply-signature': {
          signature: 'maintain-apply-signature',
          scope: 'maintain-apply',
          attempts: 1,
          successes: 0,
          failures: 1,
          last_used_at: '2020-01-01T00:00:00.000Z',
          actions: {
            '1': {
              index: 1,
              title: 'legacy',
              attempts: 1,
              successes: 0,
              failures: 1,
              last_used_at: '2020-01-01T00:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'maintain',
      '--apply',
      '--session-keep',
      '1',
      '--batch-session-keep',
      '1',
      '--controller-session-keep',
      '1',
      '--recovery-memory-older-than-days',
      '30',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-maintain');
    expect(parsed.apply).toBe(true);
    expect(parsed.summary.applied_actions).toBe(4);
    expect(parsed.summary.failed_actions).toBe(0);
    expect(parsed.executed_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'session-prune', status: 'applied' }),
      expect.objectContaining({ id: 'batch-session-prune', status: 'applied' }),
      expect.objectContaining({ id: 'controller-session-prune', status: 'applied' }),
      expect.objectContaining({ id: 'recovery-memory-prune', status: 'applied' })
    ]));
    expect(parsed.after_assessment).toEqual(expect.objectContaining({
      mode: 'auto-governance-stats'
    }));
    expect(parsed.after_assessment.archives.session.total_sessions).toBe(1);
    expect(parsed.after_assessment.archives.batch_session.total_sessions).toBe(1);
    expect(parsed.after_assessment.archives.controller_session.total_sessions).toBe(1);
    expect(parsed.after_assessment.recovery_memory.signature_count).toBe(0);

    expect(await fs.pathExists(sessionOld)).toBe(false);
    expect(await fs.pathExists(batchOld)).toBe(false);
    expect(await fs.pathExists(controllerOld)).toBe(false);
    expect(await fs.pathExists(sessionNew)).toBe(true);
    expect(await fs.pathExists(batchNew)).toBe(true);
    expect(await fs.pathExists(controllerNew)).toBe(true);
  });

  test('runs governance close-loop in plan-only mode', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    const failedSession = path.join(closeLoopSessionDir, 'governance-close-loop-plan-failed.json');
    await fs.writeJson(failedSession, {
      session_id: 'governance-close-loop-plan-failed',
      status: 'failed',
      portfolio: { master_spec: '121-00-close-loop', sub_specs: [] }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--plan-only',
      '--max-rounds',
      '3',
      '--target-risk',
      'low',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-close-loop');
    expect(parsed.plan_only).toBe(true);
    expect(parsed.apply).toBe(false);
    expect(parsed.performed_rounds).toBe(1);
    expect(parsed.stop_reason).toBe('non-mutating-mode');
    expect(Array.isArray(parsed.rounds)).toBe(true);
    expect(parsed.rounds).toHaveLength(1);
  });

  test('runs governance close-loop with apply and converges to target risk', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const sessionOld = path.join(closeLoopSessionDir, 'governance-close-loop-apply-old-session.json');
    const sessionNew = path.join(closeLoopSessionDir, 'governance-close-loop-apply-new-session.json');
    await fs.writeJson(sessionOld, {
      session_id: 'governance-close-loop-apply-old-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-old', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(sessionNew, {
      session_id: 'governance-close-loop-apply-new-session',
      status: 'completed',
      portfolio: { master_spec: '121-00-new', sub_specs: [] }
    }, { spaces: 2 });

    const batchOld = path.join(batchSessionDir, 'governance-close-loop-apply-old-batch.json');
    const batchNew = path.join(batchSessionDir, 'governance-close-loop-apply-new-batch.json');
    await fs.writeJson(batchOld, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 2,
      processed_goals: 2,
      batch_session: { id: 'governance-close-loop-apply-old-batch', file: batchOld }
    }, { spaces: 2 });
    await fs.writeJson(batchNew, {
      mode: 'auto-close-loop-batch',
      status: 'completed',
      total_goals: 2,
      processed_goals: 2,
      batch_session: { id: 'governance-close-loop-apply-new-batch', file: batchNew }
    }, { spaces: 2 });

    const controllerOld = path.join(controllerSessionDir, 'governance-close-loop-apply-old-controller.json');
    const controllerNew = path.join(controllerSessionDir, 'governance-close-loop-apply-new-controller.json');
    await fs.writeJson(controllerOld, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: { id: 'governance-close-loop-apply-old-controller', file: controllerOld }
    }, { spaces: 2 });
    await fs.writeJson(controllerNew, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: { id: 'governance-close-loop-apply-new-controller', file: controllerNew }
    }, { spaces: 2 });

    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(sessionOld, oldDate, oldDate);
    await fs.utimes(batchOld, oldDate, oldDate);
    await fs.utimes(controllerOld, oldDate, oldDate);
    const now = new Date();
    await fs.utimes(sessionNew, now, now);
    await fs.utimes(batchNew, now, now);
    await fs.utimes(controllerNew, now, now);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--max-rounds',
      '3',
      '--target-risk',
      'low',
      '--session-keep',
      '1',
      '--batch-session-keep',
      '1',
      '--controller-session-keep',
      '1',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-close-loop');
    expect(parsed.apply).toBe(true);
    expect(parsed.plan_only).toBe(false);
    expect(parsed.converged).toBe(true);
    expect(parsed.stop_reason).toBe('target-risk-reached');
    expect(parsed.performed_rounds).toBeGreaterThanOrEqual(1);
    expect(parsed.final_assessment.health.risk_level).toBe('low');

    expect(await fs.pathExists(sessionOld)).toBe(false);
    expect(await fs.pathExists(batchOld)).toBe(false);
    expect(await fs.pathExists(controllerOld)).toBe(false);
    expect(await fs.pathExists(sessionNew)).toBe(true);
    expect(await fs.pathExists(batchNew)).toBe(true);
    expect(await fs.pathExists(controllerNew)).toBe(true);
  });

  test('runs governance close-loop with advisory execution enabled', async () => {
    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: { master_spec: '121-00-advisory', sub_specs: ['121-01-advisory'] }
    });

    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    const controllerQueueFile = path.join(tempDir, '.kiro', 'auto', 'controller-queue.lines');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);
    await fs.ensureDir(path.dirname(controllerQueueFile));

    await fs.writeJson(path.join(closeLoopSessionDir, 'governance-advisory-failed-session.json'), {
      session_id: 'governance-advisory-failed-session',
      status: 'failed',
      portfolio: { master_spec: '121-00-advisory-master', sub_specs: [] }
    }, { spaces: 2 });

    const failedSummary = path.join(batchSessionDir, 'governance-advisory-failed-summary.json');
    await fs.writeJson(failedSummary, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      total_goals: 1,
      processed_goals: 1,
      completed_goals: 0,
      failed_goals: 1,
      results: [
        {
          index: 1,
          goal: 'governance advisory recover goal',
          status: 'failed',
          error: 'timeout'
        }
      ],
      batch_session: {
        id: 'governance-advisory-failed-summary',
        file: failedSummary
      }
    }, { spaces: 2 });

    const controllerSessionFile = path.join(controllerSessionDir, 'governance-advisory-controller.json');
    await fs.writeJson(controllerSessionFile, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      queue_file: controllerQueueFile,
      queue_format: 'lines',
      processed_goals: 0,
      pending_goals: 1,
      controller_session: {
        id: 'governance-advisory-controller',
        file: controllerSessionFile
      }
    }, { spaces: 2 });
    await fs.writeFile(controllerQueueFile, 'controller advisory queued goal\n', 'utf8');

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--max-rounds',
      '1',
      '--target-risk',
      'high',
      '--execute-advisory',
      '--advisory-recover-max-rounds',
      '2',
      '--advisory-controller-max-cycles',
      '1',
      '--dry-run',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-close-loop');
    expect(parsed.execute_advisory).toBe(true);
    expect(parsed.stop_reason).toBe('non-mutating-mode');
    expect(parsed.advisory_policy).toEqual(expect.objectContaining({
      recover_max_rounds: 2,
      controller_max_cycles: 1
    }));
    expect(parsed.advisory_summary).toEqual(expect.objectContaining({
      planned_actions: 2,
      executed_actions: 2,
      failed_actions: 0
    }));
    expect(parsed.rounds[0]).toEqual(expect.objectContaining({
      advisory_planned_actions: 2,
      advisory_executed_actions: 2,
      advisory_failed_actions: 0
    }));
    expect(Array.isArray(parsed.rounds[0].advisory_actions)).toBe(true);
    expect(parsed.rounds[0].advisory_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recover-latest', status: 'applied' }),
      expect.objectContaining({ id: 'controller-resume-latest', status: 'applied' })
    ]));
  });

  test('skips unavailable advisory sources without failing governance close-loop', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.writeJson(path.join(closeLoopSessionDir, 'governance-advisory-skip-failed-session.json'), {
      session_id: 'governance-advisory-skip-failed-session',
      status: 'failed',
      portfolio: { master_spec: '121-00-advisory-skip', sub_specs: [] }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--max-rounds',
      '2',
      '--target-risk',
      'low',
      '--execute-advisory',
      '--json'
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-close-loop');
    expect(parsed.execute_advisory).toBe(true);
    expect(parsed.stop_reason).toBe('no-applicable-actions');
    expect(parsed.advisory_summary).toEqual(expect.objectContaining({
      planned_actions: 1,
      executed_actions: 0,
      failed_actions: 0,
      skipped_actions: 1
    }));
    expect(parsed.rounds[0]).toEqual(expect.objectContaining({
      advisory_planned_actions: 1,
      advisory_executed_actions: 0,
      advisory_failed_actions: 0,
      advisory_skipped_actions: 1
    }));
    expect(parsed.rounds[0].advisory_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'recover-latest', status: 'skipped' })
    ]));
  });

  test('persists and resumes governance close-loop session', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.writeJson(path.join(closeLoopSessionDir, 'governance-resume-failed-session.json'), {
      session_id: 'governance-resume-failed-session',
      status: 'failed',
      portfolio: { master_spec: '121-00-governance-resume', sub_specs: [] }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--plan-only',
      '--max-rounds',
      '3',
      '--governance-session-id',
      'gov-resume-session',
      '--json'
    ]);

    const firstOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const firstPayload = JSON.parse(firstOutput.trim());
    expect(firstPayload.mode).toBe('auto-governance-close-loop');
    expect(firstPayload.governance_session).toEqual(expect.objectContaining({
      id: 'gov-resume-session'
    }));
    expect(firstPayload.performed_rounds).toBe(1);
    expect(firstPayload.stop_reason).toBe('non-mutating-mode');

    const governanceSessionFile = firstPayload.governance_session.file;
    expect(await fs.pathExists(governanceSessionFile)).toBe(true);

    logSpy.mockClear();
    const resumedProgram = buildProgram();
    await resumedProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--governance-resume',
      'gov-resume-session',
      '--plan-only',
      '--max-rounds',
      '3',
      '--json'
    ]);

    const resumedOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const resumedPayload = JSON.parse(resumedOutput.trim());
    expect(resumedPayload.mode).toBe('auto-governance-close-loop');
    expect(resumedPayload.resumed_from_governance_session).toEqual(expect.objectContaining({
      id: 'gov-resume-session'
    }));
    expect(resumedPayload.governance_session).toEqual(expect.objectContaining({
      id: 'gov-resume-session'
    }));
    expect(resumedPayload.performed_rounds).toBe(2);
    expect(resumedPayload.rounds).toHaveLength(2);
    expect(resumedPayload.stop_reason).toBe('non-mutating-mode');
  });

  test('inherits persisted governance policy defaults on resume', async () => {
    const firstProgram = buildProgram();
    await firstProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--plan-only',
      '--max-rounds',
      '3',
      '--target-risk',
      'medium',
      '--execute-advisory',
      '--advisory-recover-max-rounds',
      '5',
      '--advisory-controller-max-cycles',
      '30',
      '--governance-session-id',
      'gov-resume-policy-defaults',
      '--json'
    ]);

    logSpy.mockClear();
    const resumedProgram = buildProgram();
    await resumedProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--governance-resume',
      'gov-resume-policy-defaults',
      '--plan-only',
      '--max-rounds',
      '4',
      '--json'
    ]);

    const resumedOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const resumedPayload = JSON.parse(resumedOutput.trim());
    expect(resumedPayload.mode).toBe('auto-governance-close-loop');
    expect(resumedPayload.target_risk).toBe('medium');
    expect(resumedPayload.execute_advisory).toBe(true);
    expect(resumedPayload.advisory_policy).toEqual(expect.objectContaining({
      recover_max_rounds: 5,
      controller_max_cycles: 30
    }));
  });

  test('guards governance resume option drift unless override is enabled', async () => {
    const firstProgram = buildProgram();
    await firstProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--plan-only',
      '--max-rounds',
      '3',
      '--target-risk',
      'low',
      '--governance-session-id',
      'gov-resume-drift-guard',
      '--json'
    ]);

    logSpy.mockClear();
    errorSpy.mockClear();
    const rejectedProgram = buildProgram();
    await expect(
      rejectedProgram.parseAsync([
        'node',
        'kse',
        'auto',
        'governance',
        'close-loop',
        '--governance-resume',
        'gov-resume-drift-guard',
        '--plan-only',
        '--target-risk',
        'high',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');
    const driftOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const driftPayload = JSON.parse(driftOutput.trim());
    expect(driftPayload.success).toBe(false);
    expect(driftPayload.error).toContain('Governance resume option drift detected');
    expect(driftPayload.error).toContain('--governance-resume-allow-drift');

    logSpy.mockClear();
    errorSpy.mockClear();
    const overrideProgram = buildProgram();
    await overrideProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--governance-resume',
      'gov-resume-drift-guard',
      '--governance-resume-allow-drift',
      '--plan-only',
      '--target-risk',
      'high',
      '--json'
    ]);
    const overrideOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const overridePayload = JSON.parse(overrideOutput.trim());
    expect(overridePayload.target_risk).toBe('high');
    expect(overridePayload.mode).toBe('auto-governance-close-loop');
  });

  test('applies governance session retention policy after close-loop run', async () => {
    const governanceSessionDir = path.join(tempDir, '.kiro', 'auto', 'governance-close-loop-sessions');
    await fs.ensureDir(governanceSessionDir);
    const staleFile = path.join(governanceSessionDir, 'governance-retention-stale.json');
    await fs.writeJson(staleFile, {
      mode: 'auto-governance-close-loop',
      status: 'stopped',
      governance_session: {
        id: 'governance-retention-stale',
        file: staleFile
      }
    }, { spaces: 2 });

    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(staleFile, oldDate, oldDate);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'close-loop',
      '--plan-only',
      '--governance-session-id',
      'governance-retention-current',
      '--governance-session-keep',
      '0',
      '--json'
    ]);
    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-governance-close-loop');
    expect(parsed.governance_session_prune).toEqual(expect.objectContaining({
      mode: 'auto-governance-session-prune',
      deleted_count: 1
    }));
    expect(parsed.governance_session_prune.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'governance-retention-stale' })
    ]));
    expect(await fs.pathExists(staleFile)).toBe(false);
    const currentFile = path.join(governanceSessionDir, 'governance-retention-current.json');
    expect(await fs.pathExists(currentFile)).toBe(true);
  });

  test('lists, stats, and prunes governance close-loop sessions in json mode', async () => {
    const governanceSessionDir = path.join(tempDir, '.kiro', 'auto', 'governance-close-loop-sessions');
    await fs.ensureDir(governanceSessionDir);

    const oldSession = path.join(governanceSessionDir, 'governance-session-old.json');
    const newSession = path.join(governanceSessionDir, 'governance-session-new.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-governance-close-loop',
      status: 'failed',
      target_risk: 'low',
      max_rounds: 3,
      performed_rounds: 3,
      converged: false,
      stop_reason: 'max-rounds-exhausted',
      execute_advisory: true,
      advisory_summary: {
        planned_actions: 2,
        executed_actions: 1,
        failed_actions: 1,
        skipped_actions: 0
      },
      final_assessment: { health: { risk_level: 'high' } },
      governance_session: {
        id: 'governance-session-old',
        file: oldSession
      }
    }, { spaces: 2 });
    await fs.writeJson(newSession, {
      mode: 'auto-governance-close-loop',
      status: 'completed',
      target_risk: 'low',
      max_rounds: 3,
      performed_rounds: 1,
      converged: true,
      stop_reason: 'target-risk-reached',
      execute_advisory: false,
      advisory_summary: {
        planned_actions: 0,
        executed_actions: 0,
        failed_actions: 0,
        skipped_actions: 0
      },
      final_assessment: { health: { risk_level: 'low' } },
      governance_session: {
        id: 'governance-session-new',
        file: newSession
      },
      resumed_from_governance_session: {
        id: 'governance-session-old',
        file: oldSession
      }
    }, { spaces: 2 });

    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSession, new Date(), new Date());

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'session',
      'list',
      '--status',
      'failed',
      '--json'
    ]);
    const listOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const listPayload = JSON.parse(listOutput.trim());
    expect(listPayload.mode).toBe('auto-governance-session-list');
    expect(listPayload.total).toBe(1);
    expect(listPayload.resume_only).toBe(false);
    expect(listPayload.resumed_sessions).toBe(0);
    expect(listPayload.fresh_sessions).toBe(1);
    expect(listPayload.status_counts).toEqual(expect.objectContaining({
      failed: 1
    }));
    expect(listPayload.sessions).toHaveLength(1);
    expect(listPayload.sessions[0].id).toBe('governance-session-old');

    logSpy.mockClear();
    const resumedListProgram = buildProgram();
    await resumedListProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'session',
      'list',
      '--resume-only',
      '--json'
    ]);
    const resumedListOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const resumedListPayload = JSON.parse(resumedListOutput.trim());
    expect(resumedListPayload.mode).toBe('auto-governance-session-list');
    expect(resumedListPayload.total).toBe(1);
    expect(resumedListPayload.resume_only).toBe(true);
    expect(resumedListPayload.resumed_sessions).toBe(1);
    expect(resumedListPayload.fresh_sessions).toBe(0);
    expect(resumedListPayload.sessions).toHaveLength(1);
    expect(resumedListPayload.sessions[0].id).toBe('governance-session-new');

    logSpy.mockClear();
    const statsProgram = buildProgram();
    await statsProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'session',
      'stats',
      '--json'
    ]);
    const statsOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const statsPayload = JSON.parse(statsOutput.trim());
    expect(statsPayload.mode).toBe('auto-governance-session-stats');
    expect(statsPayload.total_sessions).toBe(2);
    expect(statsPayload.resumed_sessions).toBe(1);
    expect(statsPayload.fresh_sessions).toBe(1);
    expect(statsPayload.resumed_rate_percent).toBe(50);
    expect(statsPayload.completed_sessions).toBe(1);
    expect(statsPayload.failed_sessions).toBe(1);
    expect(statsPayload.converged_sessions).toBe(1);
    expect(statsPayload.resumed_from_counts).toEqual(expect.objectContaining({
      'governance-session-old': 1
    }));
    expect(statsPayload.final_risk_counts).toEqual(expect.objectContaining({
      high: 1,
      low: 1
    }));

    logSpy.mockClear();
    const pruneProgram = buildProgram();
    await pruneProgram.parseAsync([
      'node',
      'kse',
      'auto',
      'governance',
      'session',
      'prune',
      '--keep',
      '1',
      '--json'
    ]);
    const pruneOutput = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const prunePayload = JSON.parse(pruneOutput.trim());
    expect(prunePayload.mode).toBe('auto-governance-session-prune');
    expect(prunePayload.deleted_count).toBe(1);
    expect(prunePayload.errors).toEqual([]);
    expect(await fs.pathExists(oldSession)).toBe(false);
    expect(await fs.pathExists(newSession)).toBe(true);
  });

  test('prunes close-loop-controller summary sessions with keep policy', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'old-controller-session.json');
    const newSession = path.join(sessionDir, 'new-controller-session.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-close-loop-controller',
      controller_session: { id: 'old-controller-session', file: oldSession }
    }, { spaces: 2 });
    await fs.writeJson(newSession, {
      mode: 'auto-close-loop-controller',
      controller_session: { id: 'new-controller-session', file: newSession }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSession, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'controller-session', 'prune', '--keep', '1', '--json']);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    const parsed = JSON.parse(output.trim());
    expect(parsed.mode).toBe('auto-controller-session-prune');
    expect(parsed.deleted_count).toBe(1);
    expect(await fs.pathExists(newSession)).toBe(true);
    expect(await fs.pathExists(oldSession)).toBe(false);
  });

  test('aggregates weekly autonomous KPI trend in json mode', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const fileA = path.join(sessionDir, 'week-a.json');
    const fileB = path.join(sessionDir, 'week-b.json');
    await fs.writeJson(fileA, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-14T10:00:00.000Z',
      total_goals: 2,
      processed_goals: 2,
      failed_goals: 0,
      metrics: {
        success_rate_percent: 100,
        total_sub_specs: 8
      },
      program_kpi: {
        completion_rate_percent: 100
      },
      program_gate_effective: {
        passed: true
      },
      spec_session_budget: {
        estimated_created: 2
      }
    }, { spaces: 2 });
    await fs.writeJson(fileB, {
      mode: 'auto-close-loop-recover',
      status: 'partial-failed',
      updated_at: '2026-02-13T10:00:00.000Z',
      total_goals: 2,
      processed_goals: 2,
      failed_goals: 1,
      metrics: {
        success_rate_percent: 50,
        total_sub_specs: 4
      },
      program_kpi: {
        completion_rate_percent: 50
      },
      program_gate_effective: {
        passed: false
      },
      spec_session_budget: {
        estimated_created: 1
      }
    }, { spaces: 2 });
    await fs.utimes(fileA, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));
    await fs.utimes(fileB, new Date('2026-02-13T10:00:00.000Z'), new Date('2026-02-13T10:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-kpi-trend');
    expect(parsed.total_runs).toBe(2);
    expect(parsed.mode_breakdown).toEqual(expect.objectContaining({
      program: 1,
      recover: 1
    }));
    expect(parsed.overall).toEqual(expect.objectContaining({
      runs: 2,
      success_rate_percent: 75
    }));
    expect(Array.isArray(parsed.trend)).toBe(true);
    expect(parsed.trend.length).toBeGreaterThan(0);
    expect(parsed.period_unit).toBe('week');
    expect(Array.isArray(parsed.anomalies)).toBe(true);
  });

  test('aggregates daily autonomous KPI trend in json mode and flags anomalies', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const fileA = path.join(sessionDir, 'day-a.json');
    const fileB = path.join(sessionDir, 'day-b.json');
    const fileC = path.join(sessionDir, 'day-c.json');
    await fs.writeJson(fileA, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-12T10:00:00.000Z',
      failed_goals: 0,
      metrics: { success_rate_percent: 100, total_sub_specs: 5 },
      program_kpi: { completion_rate_percent: 100 },
      program_gate_effective: { passed: true },
      spec_session_budget: { estimated_created: 1 }
    }, { spaces: 2 });
    await fs.writeJson(fileB, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-13T10:00:00.000Z',
      failed_goals: 0,
      metrics: { success_rate_percent: 100, total_sub_specs: 5 },
      program_kpi: { completion_rate_percent: 100 },
      program_gate_effective: { passed: true },
      spec_session_budget: { estimated_created: 1 }
    }, { spaces: 2 });
    await fs.writeJson(fileC, {
      mode: 'auto-close-loop-recover',
      status: 'partial-failed',
      updated_at: '2026-02-14T10:00:00.000Z',
      failed_goals: 4,
      metrics: { success_rate_percent: 40, total_sub_specs: 10 },
      program_kpi: { completion_rate_percent: 40 },
      program_gate_effective: { passed: false },
      spec_session_budget: { estimated_created: 7 }
    }, { spaces: 2 });
    await fs.utimes(fileA, new Date('2026-02-12T10:00:00.000Z'), new Date('2026-02-12T10:00:00.000Z'));
    await fs.utimes(fileB, new Date('2026-02-13T10:00:00.000Z'), new Date('2026-02-13T10:00:00.000Z'));
    await fs.utimes(fileC, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--period',
      'day',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-kpi-trend');
    expect(parsed.period_unit).toBe('day');
    expect(parsed.total_runs).toBe(3);
    expect(parsed.trend.map(item => item.period)).toEqual(
      expect.arrayContaining(['2026-02-12', '2026-02-13', '2026-02-14'])
    );
    expect(parsed.anomaly_detection).toEqual(expect.objectContaining({
      enabled: true,
      latest_period: '2026-02-14'
    }));
    expect(parsed.anomalies).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'success-rate-drop' }),
      expect.objectContaining({ type: 'failed-goals-spike' }),
      expect.objectContaining({ type: 'spec-growth-spike' })
    ]));
  });

  test('aggregates controller autonomous KPI trend in controller mode', async () => {
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const nestedProgramSummary = path.join(batchSessionDir, 'nested-program-summary.json');
    await fs.writeJson(nestedProgramSummary, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      metrics: {
        total_sub_specs: 6
      },
      spec_session_budget: {
        estimated_created: 3
      }
    }, { spaces: 2 });

    const controllerSummary = path.join(controllerSessionDir, 'controller-a.json');
    await fs.writeJson(controllerSummary, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      updated_at: '2026-02-14T10:00:00.000Z',
      processed_goals: 2,
      completed_goals: 1,
      failed_goals: 1,
      pending_goals: 0,
      results: [
        {
          goal: 'deliver one controller goal',
          status: 'failed',
          batch_session_file: nestedProgramSummary
        }
      ]
    }, { spaces: 2 });
    await fs.utimes(controllerSummary, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--mode',
      'controller',
      '--json'
    ]);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-kpi-trend');
    expect(parsed.mode_filter).toBe('controller');
    expect(parsed.total_runs).toBe(1);
    expect(parsed.mode_breakdown).toEqual(expect.objectContaining({
      controller: 1
    }));
    expect(parsed.overall).toEqual(expect.objectContaining({
      success_rate_percent: 50,
      completion_rate_percent: 100,
      average_failed_goals: 1,
      average_total_sub_specs: 6,
      average_estimated_spec_created: 3
    }));
  });

  test('supports autonomous KPI trend csv output and csv file export', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(sessionDir);
    const outputPath = path.join(tempDir, 'kpi-trend.csv');
    const fileA = path.join(sessionDir, 'csv-a.json');
    const fileB = path.join(sessionDir, 'csv-b.json');
    await fs.writeJson(fileA, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-14T10:00:00.000Z',
      failed_goals: 0,
      metrics: { success_rate_percent: 100, total_sub_specs: 4 },
      program_kpi: { completion_rate_percent: 100 },
      program_gate_effective: { passed: true },
      spec_session_budget: { estimated_created: 1 }
    }, { spaces: 2 });
    await fs.writeJson(fileB, {
      mode: 'auto-close-loop-recover',
      status: 'partial-failed',
      updated_at: '2026-02-13T10:00:00.000Z',
      failed_goals: 1,
      metrics: { success_rate_percent: 50, total_sub_specs: 2 },
      program_kpi: { completion_rate_percent: 50 },
      program_gate_effective: { passed: false },
      spec_session_budget: { estimated_created: 2 }
    }, { spaces: 2 });
    await fs.utimes(fileA, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));
    await fs.utimes(fileB, new Date('2026-02-13T10:00:00.000Z'), new Date('2026-02-13T10:00:00.000Z'));

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--csv',
      '--out',
      outputPath
    ]);

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('period,runs,completed_runs');
    expect(output).toContain('overall');
    expect(await fs.pathExists(outputPath)).toBe(true);
    const outputFile = await fs.readFile(outputPath, 'utf8');
    expect(outputFile).toContain('period,runs,completed_runs');
    expect(outputFile).toContain('overall');
  });

  test('validates kpi trend period option', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'kpi',
        'trend',
        '--period',
        'month'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--period must be one of: week, day.');
  });

  test('validates kpi trend mode option', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'kpi',
        'trend',
        '--mode',
        'unknown'
      ])
    ).rejects.toThrow('process.exit called');

    const errorOutput = errorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorOutput).toContain('--mode must be one of: all, batch, program, recover, controller.');
  });

  test('shows recovery memory stats in json mode', async () => {
    const memoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(memoryFile));
    await fs.writeJson(memoryFile, {
      version: 1,
      signatures: {
        'sig-a': {
          attempts: 2,
          successes: 1,
          failures: 1,
          last_used_at: '2026-02-14T10:00:00.000Z',
          actions: {
            'action-1|resume': {
              attempts: 2,
              successes: 1,
              failures: 1,
              last_used_at: '2026-02-14T10:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'recovery-memory', 'show', '--json']);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-recovery-memory-show');
    expect(parsed.stats).toEqual(expect.objectContaining({
      signature_count: 1,
      action_count: 1
    }));
  });

  test('prunes and clears recovery memory through commands', async () => {
    const memoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(memoryFile));
    await fs.writeJson(memoryFile, {
      version: 1,
      signatures: {
        'sig-old': {
          attempts: 1,
          successes: 0,
          failures: 1,
          last_used_at: '2020-01-01T00:00:00.000Z',
          actions: {
            'action-1|old': {
              attempts: 1,
              successes: 0,
              failures: 1,
              last_used_at: '2020-01-01T00:00:00.000Z'
            }
          }
        },
        'sig-new': {
          attempts: 1,
          successes: 1,
          failures: 0,
          last_used_at: '2026-01-01T00:00:00.000Z',
          actions: {
            'action-1|new': {
              attempts: 1,
              successes: 1,
              failures: 0,
              last_used_at: '2026-01-01T00:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'recovery-memory',
      'prune',
      '--older-than-days',
      '365',
      '--json'
    ]);

    const pruned = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(pruned.mode).toBe('auto-recovery-memory-prune');
    expect(pruned.signatures_removed).toBeGreaterThanOrEqual(1);

    logSpy.mockClear();
    await program.parseAsync(['node', 'kse', 'auto', 'recovery-memory', 'clear', '--json']);
    const cleared = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(cleared.mode).toBe('auto-recovery-memory-clear');
    expect(await fs.pathExists(memoryFile)).toBe(false);
  });

  test('filters and prunes recovery memory by scope', async () => {
    const memoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(memoryFile));
    await fs.writeJson(memoryFile, {
      version: 1,
      signatures: {
        'scope-a|sig-old': {
          scope: 'scope-a',
          attempts: 1,
          successes: 0,
          failures: 1,
          last_used_at: '2020-01-01T00:00:00.000Z',
          actions: {
            'action-1|old': {
              attempts: 1,
              successes: 0,
              failures: 1,
              last_used_at: '2020-01-01T00:00:00.000Z'
            }
          }
        },
        'scope-b|sig-new': {
          scope: 'scope-b',
          attempts: 1,
          successes: 1,
          failures: 0,
          last_used_at: '2026-01-01T00:00:00.000Z',
          actions: {
            'action-1|new': {
              attempts: 1,
              successes: 1,
              failures: 0,
              last_used_at: '2026-01-01T00:00:00.000Z'
            }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'recovery-memory',
      'show',
      '--scope',
      'scope-a',
      '--json'
    ]);
    const shown = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(shown.scope).toBe('scope-a');
    expect(shown.stats.signature_count).toBe(1);

    logSpy.mockClear();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'recovery-memory',
      'prune',
      '--scope',
      'scope-a',
      '--older-than-days',
      '365',
      '--json'
    ]);
    const pruned = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(pruned.scope).toBe('scope-a');
    expect(pruned.signatures_removed).toBe(1);

    const payload = await fs.readJson(memoryFile);
    expect(Object.keys(payload.signatures)).toEqual(expect.arrayContaining(['scope-b|sig-new']));
    expect(payload.signatures['scope-a|sig-old']).toBeUndefined();
  });

  test('shows recovery memory scope aggregates', async () => {
    const memoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(path.dirname(memoryFile));
    await fs.writeJson(memoryFile, {
      version: 1,
      signatures: {
        'scope-a|sig-1': {
          scope: 'scope-a',
          attempts: 4,
          successes: 3,
          failures: 1,
          actions: {
            'action-1|a': { attempts: 4, successes: 3, failures: 1 }
          }
        },
        'scope-b|sig-1': {
          scope: 'scope-b',
          attempts: 2,
          successes: 1,
          failures: 1,
          actions: {
            'action-1|b': { attempts: 2, successes: 1, failures: 1 }
          }
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'recovery-memory', 'scopes', '--json']);
    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-recovery-memory-scopes');
    expect(parsed.total_scopes).toBe(2);
    expect(parsed.scopes[0]).toEqual(expect.objectContaining({
      scope: 'scope-a',
      signature_count: 1
    }));
  });

  test('builds unified observability snapshot in json mode', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    const governanceSessionDir = path.join(tempDir, '.kiro', 'auto', 'governance-close-loop-sessions');
    const recoveryMemoryFile = path.join(tempDir, '.kiro', 'auto', 'close-loop-recovery-memory.json');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);
    await fs.ensureDir(governanceSessionDir);
    await fs.ensureDir(path.dirname(recoveryMemoryFile));

    const closeLoopFile = path.join(closeLoopSessionDir, 'obs-close-loop.json');
    await fs.writeJson(closeLoopFile, {
      session_id: 'obs-close-loop',
      status: 'completed',
      goal: 'observability close-loop',
      portfolio: {
        master_spec: '121-00-obs',
        sub_specs: ['121-01-a']
      },
      schema_version: '1.0'
    }, { spaces: 2 });

    const batchFile = path.join(batchSessionDir, 'obs-batch.json');
    await fs.writeJson(batchFile, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      total_goals: 1,
      processed_goals: 1,
      completed_goals: 1,
      failed_goals: 0,
      program_started_at: '2026-02-01T00:00:00.000Z',
      program_completed_at: '2026-02-01T00:05:00.000Z',
      batch_session: { id: 'obs-batch', file: batchFile },
      schema_version: '1.0'
    }, { spaces: 2 });

    const controllerFile = path.join(controllerSessionDir, 'obs-controller.json');
    await fs.writeJson(controllerFile, {
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: { id: 'obs-controller', file: controllerFile },
      schema_version: '1.0'
    }, { spaces: 2 });

    const governanceFile = path.join(governanceSessionDir, 'obs-governance.json');
    await fs.writeJson(governanceFile, {
      mode: 'auto-governance-close-loop',
      status: 'completed',
      target_risk: 'medium',
      converged: true,
      governance_session: { id: 'obs-governance', file: governanceFile },
      final_assessment: {
        health: {
          risk_level: 'low'
        }
      },
      schema_version: '1.0'
    }, { spaces: 2 });

    await fs.writeJson(recoveryMemoryFile, {
      version: 1,
      signatures: {}
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'observability', 'snapshot', '--json']);

    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-observability-snapshot');
    expect(parsed.highlights.total_sessions).toBeGreaterThanOrEqual(4);
    expect(parsed.snapshots.close_loop_session.total_sessions).toBeGreaterThanOrEqual(1);
    expect(parsed.snapshots.kpi_trend).toEqual(expect.objectContaining({
      mode: 'auto-kpi-trend',
      mode_filter: 'all'
    }));
  });

  test('provides spec status and instructions json interfaces', async () => {
    const specDir = path.join(tempDir, '.kiro', 'specs', '121-00-agent-interface');
    await fs.ensureDir(specDir);
    await fs.writeFile(path.join(specDir, 'requirements.md'), '# Requirements\n\nDeliver feature X.\n', 'utf8');
    await fs.writeFile(path.join(specDir, 'design.md'), '# Design\n\nUse modular design.\n', 'utf8');
    await fs.writeFile(path.join(specDir, 'tasks.md'), [
      '- [x] bootstrap',
      '- [ ] implement API',
      '- [ ] add tests'
    ].join('\n'), 'utf8');
    await fs.writeJson(path.join(specDir, 'collaboration.json'), {
      type: 'sub',
      dependencies: [{ spec: '121-00-foundation', type: 'requires-completion' }],
      status: {
        current: 'in-progress'
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node', 'kse', 'auto', 'spec', 'status', '121-00-agent-interface', '--json'
    ]);
    const statusPayload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(statusPayload.mode).toBe('auto-spec-status');
    expect(statusPayload.docs.all_required_present).toBe(true);
    expect(statusPayload.task_progress.total).toBe(3);
    expect(statusPayload.task_progress.closed).toBe(1);
    expect(statusPayload.collaboration.status).toBe('in-progress');

    logSpy.mockClear();
    await program.parseAsync([
      'node', 'kse', 'auto', 'spec', 'instructions', '121-00-agent-interface', '--json'
    ]);
    const instructionsPayload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(instructionsPayload.mode).toBe('auto-spec-instructions');
    expect(instructionsPayload.instructions.next_actions.length).toBeGreaterThanOrEqual(2);
    expect(instructionsPayload.instructions.priority_open_tasks).toEqual(expect.arrayContaining([
      'implement API',
      'add tests'
    ]));
  });

  test('checks schema compatibility across autonomous archives', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    const governanceSessionDir = path.join(tempDir, '.kiro', 'auto', 'governance-close-loop-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);
    await fs.ensureDir(governanceSessionDir);

    await fs.writeJson(path.join(closeLoopSessionDir, 'schema-missing.json'), {
      session_id: 'schema-missing',
      status: 'completed',
      portfolio: { master_spec: '121-00-a', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(path.join(batchSessionDir, 'schema-compatible.json'), {
      schema_version: '1.0',
      status: 'completed'
    }, { spaces: 2 });
    await fs.writeJson(path.join(controllerSessionDir, 'schema-incompatible.json'), {
      schema_version: '0.9',
      status: 'completed'
    }, { spaces: 2 });
    await fs.writeFile(path.join(governanceSessionDir, 'schema-invalid.json'), '{ invalid json', 'utf8');

    const program = buildProgram();
    await program.parseAsync(['node', 'kse', 'auto', 'schema', 'check', '--json']);
    const parsed = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(parsed.mode).toBe('auto-schema-check');
    expect(parsed.summary.total_files).toBe(4);
    expect(parsed.summary.compatible_files).toBe(1);
    expect(parsed.summary.missing_schema_version_files).toBe(1);
    expect(parsed.summary.incompatible_files).toBe(1);
    expect(parsed.summary.parse_error_files).toBe(1);
  });

  test('migrates schema_version in dry-run and apply modes', async () => {
    const closeLoopSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-sessions');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(closeLoopSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const closeLoopFile = path.join(closeLoopSessionDir, 'migrate-close-loop.json');
    const controllerFile = path.join(controllerSessionDir, 'migrate-controller.json');
    await fs.writeJson(closeLoopFile, {
      session_id: 'migrate-close-loop',
      status: 'completed',
      portfolio: { master_spec: '121-00-m', sub_specs: [] }
    }, { spaces: 2 });
    await fs.writeJson(controllerFile, {
      schema_version: '0.9',
      status: 'completed'
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'schema',
      'migrate',
      '--only',
      'close-loop-session,controller-session',
      '--json'
    ]);
    const dryRunPayload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(dryRunPayload.mode).toBe('auto-schema-migrate');
    expect(dryRunPayload.dry_run).toBe(true);
    expect(dryRunPayload.summary.candidate_files).toBe(2);
    expect((await fs.readJson(closeLoopFile)).schema_version).toBeUndefined();

    logSpy.mockClear();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'schema',
      'migrate',
      '--only',
      'close-loop-session,controller-session',
      '--apply',
      '--json'
    ]);
    const applyPayload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(applyPayload.dry_run).toBe(false);
    expect(applyPayload.summary.updated_files).toBe(2);
    expect((await fs.readJson(closeLoopFile)).schema_version).toBe('1.0');
    expect((await fs.readJson(controllerFile)).schema_version).toBe('1.0');
  });

  test('builds handoff integration plan from manifest in json mode', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: [
        { name: '60-06-project-wbs-management' },
        '60-02-sales-lifecycle-enhancement'
      ],
      templates: [
        { name: 'moqui-domain-extension' }
      ],
      known_gaps: ['project milestone approval rule not fully automated']
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'plan',
      '--manifest',
      manifestFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-plan');
    expect(payload.source_project).toBe('E:/workspace/331-poc');
    expect(payload.handoff.spec_count).toBe(2);
    expect(payload.handoff.template_count).toBe(1);
    expect(payload.validation.is_valid).toBe(true);
    expect(payload.phases).toHaveLength(4);
    expect(payload.phases[1]).toEqual(expect.objectContaining({
      id: 'spec-validation'
    }));
    expect(payload.phases[1].commands).toEqual(expect.arrayContaining([
      'kse auto spec status 60-06-project-wbs-management --json',
      'kse scene package-validate --spec 60-06-project-wbs-management --spec-package custom/scene-package.json --strict --json'
    ]));
  });

  test('builds dependency batches from handoff spec descriptors in plan output', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: [
        {
          name: '60-21-dependent-spec',
          depends_on: ['60-20-base-spec']
        },
        {
          name: '60-20-base-spec'
        }
      ],
      templates: ['moqui-domain-extension']
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'plan',
      '--manifest',
      manifestFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-plan');
    expect(payload.handoff.dependency_batches.batch_count).toBe(2);
    expect(payload.handoff.dependency_batches.batches[0].specs).toEqual(['60-20-base-spec']);
    expect(payload.handoff.dependency_batches.batches[1].specs).toEqual(['60-21-dependent-spec']);
  });

  test('generates handoff queue goals and writes queue file', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    const queueFile = path.join(tempDir, '.kiro', 'auto', 'handoff-goals.lines');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-07-service-support-repair'],
      templates: ['moqui-full-capability-closure-program'],
      known_gaps: ['service SLA exception policy']
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'queue',
      '--manifest',
      manifestFile,
      '--out',
      queueFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-queue');
    expect(payload.goal_count).toBeGreaterThanOrEqual(4);
    expect(payload.output_file).toBe(queueFile);
    const queueContent = await fs.readFile(queueFile, 'utf8');
    expect(queueContent).toContain('integrate handoff spec 60-07-service-support-repair');
    expect(queueContent).toContain('remediate handoff known gap: service SLA exception policy');
  });

  test('supports dry-run queue generation without known gaps', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    const queueFile = path.join(tempDir, '.kiro', 'auto', 'handoff-goals.lines');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-11-reporting-audit-ops'],
      templates: ['moqui-domain-extension'],
      known_gaps: ['auditing KPI mismatch']
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'queue',
      '--manifest',
      manifestFile,
      '--out',
      queueFile,
      '--no-include-known-gaps',
      '--dry-run',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-queue');
    expect(payload.dry_run).toBe(true);
    expect(payload.include_known_gaps).toBe(false);
    expect(payload.goals.join('\n')).not.toContain('auditing KPI mismatch');
    expect(await fs.pathExists(queueFile)).toBe(false);
  });

  test('diffs handoff templates against local template registry', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-22-template-diff-spec'],
      templates: ['tpl-a', 'tpl-b']
    }, { spaces: 2 });

    await fs.ensureDir(path.join(tempDir, '.kiro', 'templates', 'exports', 'tpl-a'));
    await fs.ensureDir(path.join(tempDir, '.kiro', 'templates', 'scene-packages', 'tpl-c'));
    await fs.writeJson(
      path.join(tempDir, '.kiro', 'templates', 'scene-packages', 'registry.json'),
      {
        templates: [
          { name: 'tpl-c' },
          { name: 'tpl-d' }
        ]
      },
      { spaces: 2 }
    );

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'template-diff',
      '--manifest',
      manifestFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-template-diff');
    expect(payload.compatibility).toBe('needs-sync');
    expect(payload.diff.matched).toContain('tpl-a');
    expect(payload.diff.missing_in_local).toContain('tpl-b');
    expect(payload.diff.extra_in_local).toEqual(expect.arrayContaining(['tpl-c', 'tpl-d']));
  });

  test('runs handoff pipeline end-to-end and archives run report', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    const queueFile = path.join(tempDir, '.kiro', 'auto', 'handoff-goals.lines');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-08-inventory-procurement'],
      templates: ['moqui-domain-extension'],
      known_gaps: ['inventory reconciliation pending'],
      ontology_validation: {
        status: 'passed',
        executed_at: '2026-02-16T08:00:00.000Z'
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '160-00-handoff',
        sub_specs: ['160-01-sub']
      }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--queue-out',
      queueFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.gates.passed).toBe(true);
    expect(payload.queue.output_file).toBe(queueFile);
    expect(payload.output_file).toContain(path.join('.kiro', 'reports', 'handoff-runs'));
    expect(Array.isArray(payload.recommendations)).toBe(true);
    expect(payload.recommendations.some(item => item.includes('kse auto handoff regression --session-id'))).toBe(true);
    expect(payload.release_evidence).toEqual(expect.objectContaining({
      mode: 'auto-handoff-release-evidence',
      merged: true,
      updated_existing: false,
      latest_session_id: payload.session_id,
      total_runs: 1
    }));
    expect(await fs.pathExists(payload.output_file)).toBe(true);
    expect(await fs.pathExists(queueFile)).toBe(true);
    expect(runAutoCloseLoop).toHaveBeenCalledTimes(payload.queue.goal_count);
    const releaseEvidenceFile = path.join(tempDir, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    expect(payload.release_evidence.file).toBe(releaseEvidenceFile);
    expect(await fs.pathExists(releaseEvidenceFile)).toBe(true);
    const releaseEvidence = await fs.readJson(releaseEvidenceFile);
    expect(releaseEvidence.mode).toBe('auto-handoff-release-evidence');
    expect(releaseEvidence.total_runs).toBe(1);
    expect(releaseEvidence.latest_session_id).toBe(payload.session_id);
    expect(releaseEvidence.sessions[0]).toEqual(expect.objectContaining({
      session_id: payload.session_id,
      status: 'completed',
      manifest_path: manifestFile
    }));
    expect(releaseEvidence.sessions[0].handoff_report_file).toContain('.kiro/reports/handoff-runs/');
  });

  test('runs handoff by dependency batches before post-spec goals', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: [
        {
          name: '60-31-dependent-spec',
          depends_on: ['60-30-base-spec']
        },
        {
          name: '60-30-base-spec'
        }
      ],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '161-00-handoff',
        sub_specs: []
      }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.dependency_execution.dependency_plan.batch_count).toBe(2);
    expect(runAutoCloseLoop.mock.calls[0][0]).toContain('integrate handoff spec 60-30-base-spec');
    expect(runAutoCloseLoop.mock.calls[1][0]).toContain('integrate handoff spec 60-31-dependent-spec');
  });

  test('updates existing release evidence entry when session id repeats', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-32-repeatable-session'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '161-10-handoff-repeat',
        sub_specs: []
      }
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-16T12:34:56.000Z'));
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.42424);

    try {
      const firstProgram = buildProgram();
      await firstProgram.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--json'
      ]);
      const firstPayload = JSON.parse(`${logSpy.mock.calls[logSpy.mock.calls.length - 1][0]}`);

      logSpy.mockClear();
      const secondProgram = buildProgram();
      await secondProgram.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--json'
      ]);
      const secondPayload = JSON.parse(`${logSpy.mock.calls[logSpy.mock.calls.length - 1][0]}`);

      expect(secondPayload.session_id).toBe(firstPayload.session_id);
      expect(secondPayload.release_evidence).toEqual(expect.objectContaining({
        mode: 'auto-handoff-release-evidence',
        merged: true,
        updated_existing: true,
        total_runs: 1
      }));
      const releaseEvidenceFile = path.join(tempDir, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
      const releaseEvidence = await fs.readJson(releaseEvidenceFile);
      expect(releaseEvidence.total_runs).toBe(1);
      expect(releaseEvidence.sessions).toHaveLength(1);
      expect(releaseEvidence.sessions[0].session_id).toBe(firstPayload.session_id);
    } finally {
      randomSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  test('continues handoff run from latest report with pending goals only', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-40-base-spec', '60-41-dependent-spec'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-previous.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-previous',
      manifest_path: manifestFile,
      status: 'failed',
      batch_summary: {
        status: 'partial-failed',
        total_goals: 4,
        processed_goals: 4,
        completed_goals: 2,
        failed_goals: 1,
        results: [
          {
            index: 1,
            goal: 'integrate handoff spec 60-40-base-spec with scene package validation, ontology consistency checks, and close-loop completion',
            status: 'completed'
          },
          {
            index: 2,
            goal: 'integrate handoff spec 60-41-dependent-spec with scene package validation, ontology consistency checks, and close-loop completion',
            status: 'failed'
          },
          {
            index: 3,
            goal: 'validate handoff template moqui-domain-extension for template registry compatibility and release readiness',
            status: 'completed'
          },
          {
            index: 4,
            goal: 'generate unified observability snapshot and governance follow-up recommendations for this handoff batch',
            status: 'planned'
          }
        ]
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '162-00-handoff-continue',
        sub_specs: []
      }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--continue-from',
      'latest',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.continued_from).toEqual(expect.objectContaining({
      session_id: 'handoff-previous',
      strategy: 'pending'
    }));
    expect(payload.recommendations.some(item => item.includes(`--continue-from ${payload.session_id}`))).toBe(false);
    expect(payload.queue.goal_count).toBe(2);
    expect(runAutoCloseLoop).toHaveBeenCalledTimes(2);
    expect(runAutoCloseLoop.mock.calls[0][0]).toContain('integrate handoff spec 60-41-dependent-spec');
    expect(runAutoCloseLoop.mock.calls[1][0]).toContain('generate unified observability snapshot');
  });

  test('supports failed-only continue strategy for handoff run', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-42-service-spec'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-failed-only.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-failed-only',
      manifest_path: manifestFile,
      status: 'failed',
      batch_summary: {
        status: 'partial-failed',
        total_goals: 2,
        processed_goals: 2,
        completed_goals: 0,
        failed_goals: 1,
        results: [
          {
            index: 1,
            goal: 'integrate handoff spec 60-42-service-spec with scene package validation, ontology consistency checks, and close-loop completion',
            status: 'failed'
          },
          {
            index: 2,
            goal: 'generate unified observability snapshot and governance follow-up recommendations for this handoff batch',
            status: 'planned'
          }
        ]
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '163-00-handoff-continue',
        sub_specs: []
      }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--continue-from',
      'handoff-failed-only',
      '--continue-strategy',
      'failed-only',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.queue.goal_count).toBe(1);
    expect(payload.continued_from).toEqual(expect.objectContaining({
      session_id: 'handoff-failed-only',
      strategy: 'failed-only'
    }));
    expect(runAutoCloseLoop).toHaveBeenCalledTimes(1);
    expect(runAutoCloseLoop.mock.calls[0][0]).toContain('integrate handoff spec 60-42-service-spec');
  });

  test('auto continue strategy resolves to failed-only when only failed goals remain', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-44-only-failed'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-auto-failed-only.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-auto-failed-only',
      manifest_path: manifestFile,
      status: 'failed',
      batch_summary: {
        status: 'failed',
        total_goals: 1,
        processed_goals: 1,
        completed_goals: 0,
        failed_goals: 1,
        results: [
          {
            index: 1,
            goal: 'integrate handoff spec 60-44-only-failed with scene package validation, ontology consistency checks, and close-loop completion',
            status: 'failed'
          }
        ]
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '164-00-handoff-continue',
        sub_specs: []
      }
    });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--continue-from',
      'handoff-auto-failed-only',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.queue.goal_count).toBe(1);
    expect(payload.continued_from).toEqual(expect.objectContaining({
      session_id: 'handoff-auto-failed-only',
      strategy: 'failed-only',
      strategy_requested: 'auto'
    }));
    expect(runAutoCloseLoop).toHaveBeenCalledTimes(1);
    expect(runAutoCloseLoop.mock.calls[0][0]).toContain('integrate handoff spec 60-44-only-failed');
  });

  test('fails handoff continue-from when manifest does not match previous run', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    const anotherManifest = path.join(tempDir, 'handoff-manifest-other.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-43-current-spec'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });
    await fs.writeJson(anotherManifest, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-43-previous-spec'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-mismatch.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-mismatch',
      manifest_path: anotherManifest,
      status: 'failed',
      batch_summary: {
        status: 'failed',
        total_goals: 1,
        processed_goals: 1,
        completed_goals: 0,
        failed_goals: 1,
        results: [
          {
            index: 1,
            goal: 'integrate handoff spec 60-43-previous-spec with scene package validation, ontology consistency checks, and close-loop completion',
            status: 'failed'
          }
        ]
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--continue-from',
        'handoff-mismatch',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('failed');
    expect(payload.error).toContain('--continue-from manifest mismatch');
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('supports handoff run dry-run without executing close-loop-batch', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    const queueFile = path.join(tempDir, '.kiro', 'auto', 'handoff-goals.lines');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-09-order-fulfillment'],
      templates: ['moqui-domain-extension'],
      known_gaps: ['delivery anomaly triage']
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--queue-out',
      queueFile,
      '--dry-run',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('dry-run');
    expect(payload.phases.find(item => item.id === 'execution').status).toBe('skipped');
    expect(payload.phases.find(item => item.id === 'observability').status).toBe('skipped');
    expect(await fs.pathExists(queueFile)).toBe(false);
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
    expect(await fs.pathExists(payload.output_file)).toBe(true);
    expect(payload.release_evidence).toEqual(expect.objectContaining({
      mode: 'auto-handoff-release-evidence',
      merged: false,
      skipped: true,
      reason: 'dry-run'
    }));
    const releaseEvidenceFile = path.join(tempDir, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    expect(await fs.pathExists(releaseEvidenceFile)).toBe(false);
  });

  test('does not fail handoff run when release evidence merge errors', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-13-evidence-merge-resilience'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockResolvedValue({
      status: 'completed',
      portfolio: {
        master_spec: '160-13-evidence-merge-resilience',
        sub_specs: []
      }
    });

    const blockedEvidenceFile = path.join(tempDir, '.kiro', 'reports', 'release-evidence', 'handoff-runs.json');
    await fs.ensureDir(blockedEvidenceFile);

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'run',
      '--manifest',
      manifestFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('completed');
    expect(payload.release_evidence).toEqual(expect.objectContaining({
      mode: 'auto-handoff-release-evidence',
      merged: false,
      file: blockedEvidenceFile
    }));
    expect(payload.release_evidence.error).toContain('failed to read release evidence JSON');
    expect(Array.isArray(payload.warnings)).toBe(true);
    expect(payload.warnings.some(item => item.includes('release evidence merge failed'))).toBe(true);
    expect(await fs.pathExists(payload.output_file)).toBe(true);
  });

  test('fails handoff run early when ontology validation gate is required but missing', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-10-service-quality'],
      templates: ['moqui-domain-extension'],
      known_gaps: ['quality baseline missing']
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--require-ontology-validation',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('failed');
    expect(payload.error).toContain('handoff ontology validation gate failed');
    expect(payload.recommendations.some(item => item.includes('--require-ontology-validation'))).toBe(true);
    expect(payload.recommendations.some(item => item.includes('--continue-from'))).toBe(false);
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('fails handoff run early when ontology quality score is below threshold', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-11-ontology-quality'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed',
        quality_score: 62,
        business_rules: {
          total: 4,
          mapped: 3
        },
        decision_logic: {
          total: 3,
          resolved: 2
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--min-ontology-score',
        '80',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('failed');
    expect(payload.error).toContain('ontology_quality_score');
    expect(payload.recommendations.some(item => item.includes('--min-ontology-score 80'))).toBe(true);
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('fails handoff run early when unmapped rules and undecided decisions exceed thresholds', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-11-ontology-governance'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed',
        quality_score: 88,
        business_rules: {
          total: 5,
          mapped: 4
        },
        decision_logic: {
          total: 4,
          resolved: 3
        }
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--max-unmapped-rules',
        '0',
        '--max-undecided-decisions',
        '0',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('failed');
    expect(payload.error).toContain('business_rule_unmapped');
    expect(payload.error).toContain('decision_undecided');
    expect(payload.recommendations.some(item => item.includes('--max-unmapped-rules 0'))).toBe(true);
    expect(payload.recommendations.some(item => item.includes('--max-undecided-decisions 0'))).toBe(true);
    expect(runAutoCloseLoop).not.toHaveBeenCalled();
  });

  test('fails handoff run gate when spec success rate is below threshold', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-12-warranty-claims'],
      templates: ['moqui-domain-extension'],
      known_gaps: ['claims SLA overdue'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    runAutoCloseLoop.mockImplementation(async goal => {
      if (`${goal}`.startsWith('integrate handoff spec 60-12-warranty-claims')) {
        return {
          status: 'failed',
          portfolio: {
            master_spec: '160-00-warranty',
            sub_specs: []
          }
        };
      }
      return {
        status: 'completed',
        portfolio: {
          master_spec: '160-00-generic',
          sub_specs: []
        }
      };
    });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--min-spec-success-rate',
        '90',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-run');
    expect(payload.status).toBe('failed');
    expect(payload.gates.passed).toBe(false);
    expect(payload.gates.reasons.join(' ')).toContain('spec_success_rate_percent');
    expect(payload.recommendations.some(item => item.includes(`--continue-from ${payload.session_id}`))).toBe(true);
    expect(runAutoCloseLoop).toHaveBeenCalled();
  });

  test('validates handoff ontology gate option ranges', async () => {
    const manifestFile = path.join(tempDir, 'handoff-manifest.json');
    await fs.writeJson(manifestFile, {
      timestamp: '2026-02-16T00:00:00.000Z',
      source_project: 'E:/workspace/331-poc',
      specs: ['60-11-ontology-validation-options'],
      templates: ['moqui-domain-extension'],
      ontology_validation: {
        status: 'passed'
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--min-ontology-score',
        '120',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');
    let payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.error).toContain('--min-ontology-score must be a number between 0 and 100.');

    logSpy.mockClear();
    const secondProgram = buildProgram();
    await expect(
      secondProgram.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'run',
        '--manifest',
        manifestFile,
        '--max-unmapped-rules',
        '-1',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');
    payload = JSON.parse(`${logSpy.mock.calls[logSpy.mock.calls.length - 1][0]}`);
    expect(payload.error).toContain('--max-unmapped-rules must be an integer >= 0.');
  });

  test('builds handoff regression by comparing latest run report with previous one', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-old.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-old',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      elapsed_ms: 5000,
      spec_status: {
        success_rate_percent: 80
      },
      gates: {
        actual: {
          risk_level: 'medium'
        }
      },
      batch_summary: {
        failed_goals: 2
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-new.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-new',
      status: 'completed',
      generated_at: '2026-02-16T01:00:00.000Z',
      elapsed_ms: 4000,
      spec_status: {
        success_rate_percent: 100
      },
      gates: {
        actual: {
          risk_level: 'low'
        }
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--session-id',
      'latest',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.current.session_id).toBe('handoff-new');
    expect(payload.previous.session_id).toBe('handoff-old');
    expect(payload.trend).toBe('improved');
    expect(payload.delta.spec_success_rate_percent).toBe(20);
    expect(payload.delta.risk_level_rank).toBe(-1);
  });

  test('includes ontology quality and rule/decision metrics in handoff regression output', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-old-ontology.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-old-ontology',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 90
      },
      ontology_validation: {
        quality_score: 72,
        metrics: {
          business_rule_unmapped: 2,
          decision_undecided: 1,
          business_rule_pass_rate_percent: 75,
          decision_resolved_rate_percent: 70
        }
      },
      batch_summary: {
        failed_goals: 1
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-new-ontology.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-new-ontology',
      status: 'completed',
      generated_at: '2026-02-16T01:00:00.000Z',
      spec_status: {
        success_rate_percent: 96
      },
      ontology_validation: {
        quality_score: 88,
        metrics: {
          business_rule_unmapped: 0,
          decision_undecided: 0,
          business_rule_pass_rate_percent: 100,
          decision_resolved_rate_percent: 100
        }
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--session-id',
      'latest',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.current.ontology_quality_score).toBe(88);
    expect(payload.current.ontology_unmapped_rules).toBe(0);
    expect(payload.current.ontology_undecided_decisions).toBe(0);
    expect(payload.delta.ontology_quality_score).toBe(16);
    expect(payload.delta.ontology_unmapped_rules).toBe(-2);
    expect(payload.delta.ontology_undecided_decisions).toBe(-1);
    expect(payload.aggregates.avg_ontology_quality_score).toBe(80);
  });

  test('builds handoff regression trend series within custom window', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-oldest.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-oldest',
      status: 'completed',
      generated_at: '2026-02-15T22:00:00.000Z',
      elapsed_ms: 7000,
      spec_status: {
        success_rate_percent: 70
      },
      gates: {
        actual: {
          risk_level: 'high'
        }
      },
      batch_summary: {
        failed_goals: 3
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-middle.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-middle',
      status: 'completed',
      generated_at: '2026-02-15T23:00:00.000Z',
      elapsed_ms: 5200,
      spec_status: {
        success_rate_percent: 80
      },
      gates: {
        actual: {
          risk_level: 'medium'
        }
      },
      batch_summary: {
        failed_goals: 1
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-latest.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-latest',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      elapsed_ms: 4300,
      spec_status: {
        success_rate_percent: 90
      },
      gates: {
        actual: {
          risk_level: 'low'
        }
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--session-id',
      'latest',
      '--window',
      '3',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.window).toEqual(expect.objectContaining({
      requested: 3,
      actual: 3
    }));
    expect(payload.series).toHaveLength(3);
    expect(payload.current.session_id).toBe('handoff-latest');
    expect(payload.previous.session_id).toBe('handoff-middle');
    expect(payload.window_trend.trend).toBe('improved');
    expect(payload.window_trend.delta.spec_success_rate_percent).toBe(20);
    expect(payload.window_trend.delta.risk_level_rank).toBe(-2);
    expect(payload.aggregates).toEqual(expect.objectContaining({
      avg_spec_success_rate_percent: 80,
      min_spec_success_rate_percent: 70,
      max_spec_success_rate_percent: 90
    }));
    expect(payload.aggregates.risk_levels).toEqual(expect.objectContaining({
      low: 1,
      medium: 1,
      high: 1
    }));
    expect(payload.risk_layers).toEqual(expect.objectContaining({
      low: expect.objectContaining({
        count: 1,
        sessions: ['handoff-latest'],
        avg_spec_success_rate_percent: 90
      }),
      medium: expect.objectContaining({
        count: 1,
        sessions: ['handoff-middle'],
        avg_spec_success_rate_percent: 80
      }),
      high: expect.objectContaining({
        count: 1,
        sessions: ['handoff-oldest'],
        avg_spec_success_rate_percent: 70
      })
    }));
  });

  test('validates regression window range', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-one.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-one',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 100
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'regression',
        '--window',
        '1',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.error).toContain('--window must be an integer between 2 and 50.');
  });

  test('adds regression recommendations when trend degrades', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-good.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-good',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 100
      },
      gates: {
        actual: {
          risk_level: 'low'
        }
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-bad.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-bad',
      status: 'failed',
      generated_at: '2026-02-16T01:00:00.000Z',
      spec_status: {
        success_rate_percent: 80
      },
      gates: {
        actual: {
          risk_level: 'high'
        }
      },
      batch_summary: {
        failed_goals: 3
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--session-id',
      'latest',
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.trend).toBe('degraded');
    expect(payload.recommendations.some(item => item.includes('--continue-from handoff-bad'))).toBe(true);
    expect(payload.recommendations).toContain('kse auto governance stats --days 14 --json');
  });

  test('supports handoff regression out file option', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    const outFile = path.join(tempDir, '.kiro', 'reports', 'handoff-regression.json');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-old.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-old',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 90
      },
      batch_summary: {
        failed_goals: 1
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-new.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-new',
      status: 'completed',
      generated_at: '2026-02-16T01:00:00.000Z',
      spec_status: {
        success_rate_percent: 100
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--out',
      outFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.output_file).toBe(outFile);
    expect(await fs.pathExists(outFile)).toBe(true);
    const saved = await fs.readJson(outFile);
    expect(saved.mode).toBe('auto-handoff-regression');
    expect(saved.current.session_id).toBe('handoff-new');
  });

  test('supports handoff regression markdown format output file', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    const outFile = path.join(tempDir, '.kiro', 'reports', 'handoff-regression.md');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-old.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-old',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 90
      },
      batch_summary: {
        failed_goals: 1
      }
    }, { spaces: 2 });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fs.writeJson(path.join(reportDir, 'handoff-new.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-new',
      status: 'completed',
      generated_at: '2026-02-16T01:00:00.000Z',
      spec_status: {
        success_rate_percent: 100
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await program.parseAsync([
      'node',
      'kse',
      'auto',
      'handoff',
      'regression',
      '--format',
      'markdown',
      '--out',
      outFile,
      '--json'
    ]);

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.mode).toBe('auto-handoff-regression');
    expect(payload.report_format).toBe('markdown');
    expect(payload.output_file).toBe(outFile);
    expect(await fs.pathExists(outFile)).toBe(true);
    const markdown = await fs.readFile(outFile, 'utf8');
    expect(markdown).toContain('# Auto Handoff Regression Report');
    expect(markdown).toContain('- Session: handoff-new');
    expect(markdown).toContain('## Trend Series');
    expect(markdown).toContain('## Risk Layer View');
    expect(markdown).toContain('success=');
    expect(markdown).toContain('low: count=');
    expect(markdown).toContain('## Recommendations');
  });

  test('validates regression format option', async () => {
    const reportDir = path.join(tempDir, '.kiro', 'reports', 'handoff-runs');
    await fs.ensureDir(reportDir);
    await fs.writeJson(path.join(reportDir, 'handoff-one.json'), {
      mode: 'auto-handoff-run',
      session_id: 'handoff-one',
      status: 'completed',
      generated_at: '2026-02-16T00:00:00.000Z',
      spec_status: {
        success_rate_percent: 100
      },
      batch_summary: {
        failed_goals: 0
      }
    }, { spaces: 2 });

    const program = buildProgram();
    await expect(
      program.parseAsync([
        'node',
        'kse',
        'auto',
        'handoff',
        'regression',
        '--format',
        'html',
        '--json'
      ])
    ).rejects.toThrow('process.exit called');

    const payload = JSON.parse(`${logSpy.mock.calls[0][0]}`);
    expect(payload.error).toContain('--format must be one of: json, markdown.');
  });
});
