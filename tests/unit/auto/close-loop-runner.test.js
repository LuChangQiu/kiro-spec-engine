const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { runAutoCloseLoop } = require('../../../lib/auto/close-loop-runner');

describe('close-loop-runner', () => {
  let tempDir;
  let originalLog;
  let output;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-close-loop-runner-'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'specs'));

    originalLog = console.log;
    output = [];
    console.log = jest.fn((...args) => {
      output.push(args.join(' '));
    });
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('creates master/sub specs, collaboration metadata, and runs orchestration', async () => {
    const mockRunOrchestration = jest.fn(async ({ specNames, onStatus }) => {
      if (typeof onStatus === 'function') {
        onStatus({
          status: 'running',
          currentBatch: 1,
          totalBatches: 2,
          completedSpecs: 1,
          failedSpecs: 0,
          runningSpecs: 2,
          specs: {
            [specNames[0]]: { status: 'completed' },
            [specNames[1]]: { status: 'running' }
          }
        });
      }

      return {
        status: 'completed',
        completed: specNames,
        failed: [],
        skipped: []
      };
    });

    const result = await runAutoCloseLoop(
      'Build closed-loop and multi-spec master/sub execution in sce',
      {
        maxParallel: 4
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(result.status).toBe('completed');
    expect(result.dod).toBeDefined();
    expect(result.dod.passed).toBe(true);
    expect(result.strategy_memory).toEqual(expect.objectContaining({
      enabled: true
    }));
    expect(result.portfolio.sub_specs).toHaveLength(3);
    expect(result.portfolio.execution_plan).toEqual(expect.objectContaining({
      conflict_governance_enabled: true,
      ontology_guidance_enabled: true
    }));
    expect(Array.isArray(result.portfolio.assignments)).toBe(true);
    expect(result.portfolio.assignments.length).toBe(result.portfolio.sub_specs.length + 1);
    expect(mockRunOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      maxParallel: 4,
      silent: true,
      onStatus: expect.any(Function)
    }), expect.objectContaining({
      workspaceRoot: tempDir
    }));

    const masterSpec = result.portfolio.master_spec;
    const masterPath = path.join(tempDir, '.sce', 'specs', masterSpec);
    expect(await fs.pathExists(path.join(masterPath, 'requirements.md'))).toBe(true);
    expect(await fs.pathExists(path.join(masterPath, 'design.md'))).toBe(true);
    expect(await fs.pathExists(path.join(masterPath, 'tasks.md'))).toBe(true);

    const masterCollab = await fs.readJson(path.join(masterPath, 'collaboration.json'));
    expect(masterCollab.type).toBe('master');
    expect(masterCollab.dependencies).toHaveLength(result.portfolio.sub_specs.length);
    expect(masterCollab.status.current).toBe('completed');
    expect(await fs.pathExists(path.join(masterPath, 'custom', 'agent-sync-plan.md'))).toBe(true);

    const defaultDodReportPath = path.join(masterPath, 'custom', 'dod-report.json');
    expect(result.dod_report_file).toBe(defaultDodReportPath);
    expect(await fs.pathExists(defaultDodReportPath)).toBe(true);
    const dodReport = await fs.readJson(defaultDodReportPath);
    expect(dodReport.mode).toBe('auto-close-loop-dod-report');
    expect(dodReport.portfolio.master_spec).toBe(masterSpec);
    expect(dodReport.dod.passed).toBe(true);

    const strategyMemoryFile = path.join(tempDir, '.sce', 'auto', 'close-loop-strategy-memory.json');
    expect(await fs.pathExists(strategyMemoryFile)).toBe(true);
  });

  test('enforces DoD risk, completion KPI, and baseline drop thresholds', async () => {
    const baselineSessionDir = path.join(tempDir, '.sce', 'auto', 'close-loop-sessions');
    await fs.ensureDir(baselineSessionDir);
    const baselineFile = path.join(baselineSessionDir, 'baseline.json');
    await fs.writeJson(baselineFile, {
      session_id: 'baseline',
      status: 'completed',
      portfolio: {
        master_spec: '120-00-baseline',
        sub_specs: ['120-01-a', '120-02-b']
      }
    }, { spaces: 2 });

    const result = await runAutoCloseLoop(
      'Close-loop DoD threshold hardening',
      {
        run: false,
        dodMaxRiskLevel: 'medium',
        dodKpiMinCompletionRate: 100,
        dodMaxSuccessRateDrop: 20,
        dodBaselineWindow: 1
      },
      {
        projectPath: tempDir
      }
    );

    expect(result.status).toBe('failed');
    expect(result.dod.passed).toBe(false);
    expect(result.dod.failed_checks).toEqual(expect.arrayContaining([
      'risk-level-threshold',
      'kpi-completion-rate-threshold',
      'kpi-baseline-drop-threshold'
    ]));
  });

  test('fails close-loop when DoD test command fails', async () => {
    const mockRunCommand = jest.fn(async () => ({
      success: false,
      code: 1,
      stdout: '',
      stderr: 'test failure'
    }));

    const mockRunOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'completed',
      completed: specNames,
      failed: [],
      skipped: []
    }));

    const result = await runAutoCloseLoop(
      'Close-loop with strict DoD test command',
      {
        dodTests: 'npm run test:smoke'
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration,
        runCommand: mockRunCommand
      }
    );

    expect(result.status).toBe('failed');
    expect(result.dod.passed).toBe(false);
    expect(result.dod.failed_checks).toContain('tests-command');
    expect(mockRunCommand).toHaveBeenCalledWith('npm run test:smoke', expect.objectContaining({
      cwd: tempDir
    }));
  });

  test('supports strict DoD gate requiring tasks checklist closure', async () => {
    const result = await runAutoCloseLoop(
      'Close-loop with tasks closure gate',
      {
        run: false,
        dodTasksClosed: true
      },
      {
        projectPath: tempDir
      }
    );

    expect(result.status).toBe('failed');
    expect(result.dod.passed).toBe(false);
    expect(result.dod.failed_checks).toContain('tasks-checklist-closed');
  });

  test('supports disabling all DoD gates with --no-dod semantics', async () => {
    const mockRunCommand = jest.fn(async () => ({
      success: false,
      code: 1,
      stdout: '',
      stderr: 'should not execute when DoD is disabled'
    }));

    const mockRunOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'completed',
      completed: specNames,
      failed: [],
      skipped: []
    }));

    const result = await runAutoCloseLoop(
      'Close-loop with DoD disabled',
      {
        dod: false,
        dodTests: 'npm run test:smoke',
        dodTasksClosed: true
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration,
        runCommand: mockRunCommand
      }
    );

    expect(result.status).toBe('completed');
    expect(result.dod.enabled).toBe(false);
    expect(result.dod.passed).toBe(true);
    expect(result.dod.checks).toEqual([]);
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  test('supports disabling DoD report archive', async () => {
    const mockRunOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'completed',
      completed: specNames,
      failed: [],
      skipped: []
    }));

    const result = await runAutoCloseLoop(
      'Close-loop without DoD report archive',
      {
        dodReport: false
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(result.dod_report_file).toBeUndefined();
    const reportPath = path.join(
      tempDir,
      '.sce',
      'specs',
      result.portfolio.master_spec,
      'custom',
      'dod-report.json'
    );
    expect(await fs.pathExists(reportPath)).toBe(false);
  });

  test('supports custom DoD report path', async () => {
    const mockRunOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'completed',
      completed: specNames,
      failed: [],
      skipped: []
    }));

    const result = await runAutoCloseLoop(
      'Close-loop with custom DoD report path',
      {
        dodReport: '.sce/reports/custom-dod-report.json'
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    const customPath = path.join(tempDir, '.sce', 'reports', 'custom-dod-report.json');
    expect(result.dod_report_file).toBe(customPath);
    expect(await fs.pathExists(customPath)).toBe(true);
  });

  test('persists close-loop session snapshot and supports resume by id', async () => {
    const first = await runAutoCloseLoop(
      'Close-loop session baseline',
      {
        run: false,
        sessionId: 'session-resume-id'
      },
      {
        projectPath: tempDir
      }
    );

    expect(first.session).toBeDefined();
    expect(first.session.id).toBe('session-resume-id');
    expect(first.session.resumed).toBe(false);
    expect(await fs.pathExists(first.session.file)).toBe(true);

    const resumed = await runAutoCloseLoop(
      undefined,
      {
        run: false,
        resume: 'session-resume-id'
      },
      {
        projectPath: tempDir
      }
    );

    expect(resumed.resumed).toBe(true);
    expect(resumed.resumed_from_session).toEqual(expect.objectContaining({
      id: 'session-resume-id'
    }));
    expect(resumed.portfolio.master_spec).toBe(first.portfolio.master_spec);
    expect(resumed.portfolio.sub_specs).toEqual(first.portfolio.sub_specs);
    expect(resumed.session.id).toBe('session-resume-id');
    expect(resumed.session.resumed).toBe(true);
  });

  test('supports adaptive replan strategy with expanded budget', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: specNames.filter(name => name !== specNames[specNames.length - 1]),
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'completed',
        completed: specNames,
        failed: [],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with adaptive replan budget',
      {
        replanStrategy: 'adaptive',
        replanAttempts: 1
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('completed');
    expect(result.replan.strategy).toBe('adaptive');
    expect(result.replan.effective_max_attempts).toBeGreaterThanOrEqual(2);
    expect(result.replan.performed).toBe(2);
  });

  test('supports fixed replan strategy with strict retry budget', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: specNames.filter(name => name !== specNames[specNames.length - 1]),
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with fixed replan budget',
      {
        replanStrategy: 'fixed',
        replanAttempts: 1
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('failed');
    expect(result.replan.strategy).toBe('fixed');
    expect(result.replan.effective_max_attempts).toBe(1);
    expect(result.replan.performed).toBe(1);
    expect(result.replan.exhausted).toBe(true);
  });

  test('supports resume from latest close-loop session', async () => {
    await runAutoCloseLoop(
      'Close-loop latest session source',
      {
        run: false,
        sessionId: 'latest-source'
      },
      {
        projectPath: tempDir
      }
    );

    const resumed = await runAutoCloseLoop(
      'Resume latest',
      {
        run: false,
        resume: 'latest'
      },
      {
        projectPath: tempDir
      }
    );

    expect(resumed.resumed).toBe(true);
    expect(resumed.resumed_from_session.id).toBe('latest-source');
  });

  test('supports resume from latest interrupted close-loop session', async () => {
    await runAutoCloseLoop(
      'Close-loop interrupted session source',
      {
        run: false,
        sessionId: 'interrupted-source'
      },
      {
        projectPath: tempDir
      }
    );

    const completedOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'completed',
      completed: specNames,
      failed: [],
      skipped: []
    }));
    await runAutoCloseLoop(
      'Close-loop completed newer source',
      {
        sessionId: 'completed-source'
      },
      {
        projectPath: tempDir,
        runOrchestration: completedOrchestration
      }
    );

    const resumed = await runAutoCloseLoop(
      undefined,
      {
        run: false,
        resume: 'interrupted'
      },
      {
        projectPath: tempDir
      }
    );

    expect(resumed.resumed).toBe(true);
    expect(resumed.resumed_from_session).toEqual(expect.objectContaining({
      id: 'interrupted-source'
    }));
  });

  test('writes running session checkpoint before orchestration for interruption resume', async () => {
    const failOnOrchestration = jest.fn(async () => {
      throw new Error('upstream account quota exhausted');
    });

    await expect(
      runAutoCloseLoop(
        'Close-loop interruption checkpoint',
        {
          sessionId: 'interruption-checkpoint'
        },
        {
          projectPath: tempDir,
          runOrchestration: failOnOrchestration
        }
      )
    ).rejects.toThrow('upstream account quota exhausted');

    const sessionFile = path.join(
      tempDir,
      '.sce',
      'auto',
      'close-loop-sessions',
      'interruption-checkpoint.json'
    );
    expect(await fs.pathExists(sessionFile)).toBe(true);
    const payload = await fs.readJson(sessionFile);
    expect(payload.session_id).toBe('interruption-checkpoint');
    expect(payload.status).toBe('running');
    expect(payload.portfolio).toEqual(expect.objectContaining({
      master_spec: expect.any(String),
      sub_specs: expect.any(Array)
    }));
  });

  test('throws clear error when resume session is missing', async () => {
    await expect(
      runAutoCloseLoop(
        'Resume missing session',
        {
          run: false,
          resume: 'session-not-found'
        },
        {
          projectPath: tempDir
        }
      )
    ).rejects.toThrow('Close-loop session not found');
  });

  test('throws clear error when interrupted resume session is missing', async () => {
    await expect(
      runAutoCloseLoop(
        'Resume missing interrupted session',
        {
          run: false,
          resume: 'interrupted'
        },
        {
          projectPath: tempDir
        }
      )
    ).rejects.toThrow('Close-loop interrupted session not found');
  });

  test('supports disabling close-loop session persistence', async () => {
    const result = await runAutoCloseLoop(
      'Close-loop without session persistence',
      {
        run: false,
        session: false
      },
      {
        projectPath: tempDir
      }
    );

    expect(result.session).toBeUndefined();
    const sessionDir = path.join(tempDir, '.sce', 'auto', 'close-loop-sessions');
    expect(await fs.pathExists(sessionDir)).toBe(false);
  });

  test('supports automatic session retention prune by keep count', async () => {
    const first = await runAutoCloseLoop(
      'Close-loop session retention first',
      {
        run: false,
        sessionId: 'retention-first'
      },
      {
        projectPath: tempDir
      }
    );

    const second = await runAutoCloseLoop(
      'Close-loop session retention second',
      {
        run: false,
        sessionId: 'retention-second',
        sessionKeep: 1
      },
      {
        projectPath: tempDir
      }
    );

    expect(await fs.pathExists(second.session.file)).toBe(true);
    expect(await fs.pathExists(first.session.file)).toBe(false);
    expect(second.session_prune).toEqual(expect.objectContaining({
      enabled: true,
      keep: 1,
      deleted_count: 1
    }));
  });

  test('supports automatic session retention prune by age filter', async () => {
    const sessionDir = path.join(tempDir, '.sce', 'auto', 'close-loop-sessions');
    await fs.ensureDir(sessionDir);
    const staleFile = path.join(sessionDir, 'stale-manual-session.json');
    await fs.writeJson(staleFile, {
      session_id: 'stale-manual-session',
      portfolio: {
        master_spec: '00-00-stale',
        sub_specs: []
      }
    }, { spaces: 2 });
    await fs.utimes(staleFile, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));

    const result = await runAutoCloseLoop(
      'Close-loop session retention age filter',
      {
        run: false,
        sessionId: 'retention-age-current',
        sessionOlderThanDays: 1
      },
      {
        projectPath: tempDir
      }
    );

    expect(await fs.pathExists(staleFile)).toBe(false);
    expect(await fs.pathExists(result.session.file)).toBe(true);
    expect(result.session_prune.deleted_count).toBe(1);
    expect(result.session_prune.older_than_days).toBe(1);
  });

  test('validates session retention options', async () => {
    await expect(
      runAutoCloseLoop(
        'Close-loop invalid session keep',
        {
          run: false,
          sessionKeep: -1
        },
        {
          projectPath: tempDir
        }
      )
    ).rejects.toThrow('--session-keep must be an integer between 0 and 1000');

    await expect(
      runAutoCloseLoop(
        'Close-loop invalid session age',
        {
          run: false,
          sessionOlderThanDays: -1
        },
        {
          projectPath: tempDir
        }
      )
    ).rejects.toThrow('--session-older-than-days must be an integer between 0 and 36500');
  });

  test('auto-replans failed orchestration by adding remediation spec and retrying', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: specNames.filter(name => !name.includes('master-sub-spec-decomposition')),
        failed: specNames.filter(name => name.includes('master-sub-spec-decomposition')),
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'completed',
        completed: specNames,
        failed: [],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with automatic replan recovery',
      {
        replanAttempts: 1
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('completed');
    expect(result.replan.enabled).toBe(true);
    expect(result.replan.performed).toBe(1);
    expect(result.replan.attempts).toHaveLength(1);
    expect(result.replan.attempts[0].added_specs).toHaveLength(1);

    const remediationSpecName = result.replan.attempts[0].added_specs[0];
    expect(result.portfolio.sub_specs).toContain(remediationSpecName);
    expect(await fs.pathExists(path.join(tempDir, '.sce', 'specs', remediationSpecName, 'tasks.md'))).toBe(true);
  });

  test('supports disabling automatic replan attempts', async () => {
    const mockRunOrchestration = jest.fn(async ({ specNames }) => ({
      status: 'failed',
      completed: [],
      failed: [specNames[0]],
      skipped: []
    }));

    const result = await runAutoCloseLoop(
      'Close-loop without replan',
      {
        replan: false
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('failed');
    expect(result.replan.enabled).toBe(false);
    expect(result.replan.performed).toBe(0);
  });

  test('marks replan budget as exhausted when retries still fail', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with exhausted replan budget',
      {
        replanAttempts: 1
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('failed');
    expect(result.replan.performed).toBe(1);
    expect(result.replan.exhausted).toBe(true);
    expect(result.next_actions[0]).toContain('Automatic replan attempts exhausted');
  });

  test('stops replan early when failed-spec signature repeats', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with repeated failed signature',
      {
        replanAttempts: 3,
        replanStrategy: 'fixed'
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('failed');
    expect(result.replan.performed).toBe(1);
    expect(result.replan.exhausted).toBe(true);
    expect(result.replan.stalled_signature).toContain(result.portfolio.sub_specs[0]);
  });

  test('stops replan when no progress window is reached', async () => {
    const mockRunOrchestration = jest
      .fn()
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[0]],
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[1]],
        skipped: []
      }))
      .mockImplementationOnce(async ({ specNames }) => ({
        status: 'failed',
        completed: [],
        failed: [specNames[2]],
        skipped: []
      }));

    const result = await runAutoCloseLoop(
      'Close-loop with no-progress replan stall guard',
      {
        replanAttempts: 4,
        replanStrategy: 'fixed',
        replanNoProgressWindow: 2
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('failed');
    expect(result.replan.performed).toBe(2);
    expect(result.replan.exhausted).toBe(true);
    expect(result.replan.stalled_signature).toBeNull();
    expect(result.replan.stalled_no_progress_cycles).toBe(2);
    expect(result.next_actions[0]).toContain('no progress was detected');
  });

  test('validates replan no-progress window option', async () => {
    await expect(
      runAutoCloseLoop(
        'Close-loop invalid no-progress window',
        {
          run: false,
          replanNoProgressWindow: 0
        },
        {
          projectPath: tempDir
        }
      )
    ).rejects.toThrow('--replan-no-progress-window must be an integer between 1 and 10');
  });

  test('supports dry-run planning without writing files or running orchestration', async () => {
    const mockRunOrchestration = jest.fn();

    const result = await runAutoCloseLoop(
      'Autonomous close-loop planning only',
      {
        dryRun: true,
        json: true
      },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(result.status).toBe('planned');
    expect(result.dry_run).toBe(true);
    expect(mockRunOrchestration).not.toHaveBeenCalled();

    const specsPath = path.join(tempDir, '.sce', 'specs');
    const specs = await fs.readdir(specsPath);
    expect(specs).toEqual([]);
  });

  test('allows disabling live stream reporter', async () => {
    const mockRunOrchestration = jest.fn(async ({ specNames, onStatus }) => {
      expect(onStatus).toBeNull();
      return {
        status: 'completed',
        completed: specNames,
        failed: [],
        skipped: []
      };
    });

    await runAutoCloseLoop(
      'Autonomous close-loop execution without stream',
      { stream: false },
      {
        projectPath: tempDir,
        runOrchestration: mockRunOrchestration
      }
    );

    expect(mockRunOrchestration).toHaveBeenCalledTimes(1);
  });
});
