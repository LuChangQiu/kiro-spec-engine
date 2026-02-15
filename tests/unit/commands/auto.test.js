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
    expect(parsed.sessions[0].id).toBe('demo-session');
    expect(parsed.sessions[0].master_spec).toBe('121-00-demo');
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
    expect(parsed.sessions[0].id).toBe('demo-batch-session');
    expect(parsed.sessions[0].status).toBe('completed');
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
});
