const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function runCli(args, options = {}) {
  const binPath = path.join(__dirname, '..', '..', 'bin', 'kiro-spec-engine.js');
  const cwd = options.cwd || process.cwd();
  const timeoutMs = options.timeoutMs || 60000;
  const nodeArgs = Array.isArray(options.nodeArgs) ? options.nodeArgs : [];
  const env = options.env
    ? { ...process.env, ...options.env }
    : process.env;

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(
      'node',
      [...nodeArgs, binPath, '--no-version-check', '--skip-steering-check', ...args],
      {
        cwd,
        env,
        shell: false
      }
    );

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('close', code => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`CLI command timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({
        exitCode: typeof code === 'number' ? code : 1,
        stdout,
        stderr
      });
    });

    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function parseJsonOutput(stdout) {
  return JSON.parse((stdout || '').trim());
}

describe('auto close-loop CLI integration', () => {
  let tempDir;
  let originalCwd;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-auto-close-loop-cli-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  test('supports close-loop no-run and resume latest end-to-end', async () => {
    const firstRun = await runCli([
      'auto',
      'close-loop',
      'build autonomous close loop resume e2e',
      '--no-run',
      '--json'
    ], { cwd: tempDir });

    expect(firstRun.exitCode).toBe(0);
    const firstPayload = parseJsonOutput(firstRun.stdout);
    expect(firstPayload.mode).toBe('auto-close-loop');
    expect(firstPayload.resumed).toBe(false);
    expect(firstPayload.session).toBeDefined();
    expect(await fs.pathExists(firstPayload.session.file)).toBe(true);

    const resumedRun = await runCli([
      'auto',
      'close-loop',
      '--resume',
      'latest',
      '--no-run',
      '--json'
    ], { cwd: tempDir });

    expect(resumedRun.exitCode).toBe(0);
    const resumedPayload = parseJsonOutput(resumedRun.stdout);
    expect(resumedPayload.resumed).toBe(true);
    expect(resumedPayload.resumed_from_session.id).toBe(firstPayload.session.id);
    expect(resumedPayload.portfolio.master_spec).toBe(firstPayload.portfolio.master_spec);
  });

  test('supports session list and prune lifecycle through CLI', async () => {
    const firstRun = await runCli([
      'auto',
      'close-loop',
      'build autonomous close loop session lifecycle one',
      '--no-run',
      '--json'
    ], { cwd: tempDir });
    expect(firstRun.exitCode).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 20));

    const secondRun = await runCli([
      'auto',
      'close-loop',
      'build autonomous close loop session lifecycle two',
      '--no-run',
      '--json'
    ], { cwd: tempDir });
    expect(secondRun.exitCode).toBe(0);

    const listed = await runCli([
      'auto',
      'session',
      'list',
      '--limit',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(listed.exitCode).toBe(0);
    const listPayload = parseJsonOutput(listed.stdout);
    expect(listPayload.mode).toBe('auto-session-list');
    expect(listPayload.total).toBe(2);
    expect(listPayload.sessions).toHaveLength(1);

    const pruned = await runCli([
      'auto',
      'session',
      'prune',
      '--keep',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.mode).toBe('auto-session-prune');
    expect(prunePayload.deleted_count).toBe(1);
    expect(prunePayload.errors).toEqual([]);

    const listedAfter = await runCli([
      'auto',
      'session',
      'list',
      '--json'
    ], { cwd: tempDir });
    expect(listedAfter.exitCode).toBe(0);
    const listAfterPayload = parseJsonOutput(listedAfter.stdout);
    expect(listAfterPayload.total).toBe(1);
  });

  test('supports automatic session retention policy in close-loop CLI', async () => {
    const firstRun = await runCli([
      'auto',
      'close-loop',
      'build autonomous close loop auto retention one',
      '--no-run',
      '--json'
    ], { cwd: tempDir });
    expect(firstRun.exitCode).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 20));

    const secondRun = await runCli([
      'auto',
      'close-loop',
      'build autonomous close loop auto retention two',
      '--no-run',
      '--session-keep',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(secondRun.exitCode).toBe(0);

    const secondPayload = parseJsonOutput(secondRun.stdout);
    expect(secondPayload.session_prune).toEqual(expect.objectContaining({
      enabled: true,
      keep: 1
    }));

    const listed = await runCli([
      'auto',
      'session',
      'list',
      '--json'
    ], { cwd: tempDir });
    expect(listed.exitCode).toBe(0);
    const listPayload = parseJsonOutput(listed.stdout);
    expect(listPayload.total).toBe(1);
  });

  test('supports spec-session list and prune lifecycle through CLI', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const oldSpec = path.join(specsDir, '121-00-old');
    const newSpec = path.join(specsDir, '122-00-new');
    await fs.ensureDir(oldSpec);
    await fs.ensureDir(newSpec);
    await fs.utimes(oldSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSpec, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const listed = await runCli([
      'auto',
      'spec-session',
      'list',
      '--limit',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(listed.exitCode).toBe(0);
    const listPayload = parseJsonOutput(listed.stdout);
    expect(listPayload.mode).toBe('auto-spec-session-list');
    expect(listPayload.total).toBe(2);
    expect(listPayload.specs).toHaveLength(1);
    expect(listPayload.specs[0].id).toBe('122-00-new');

    const pruned = await runCli([
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.mode).toBe('auto-spec-session-prune');
    expect(prunePayload.deleted_count).toBe(1);
    expect(prunePayload.errors).toEqual([]);
    expect(await fs.pathExists(newSpec)).toBe(true);
    expect(await fs.pathExists(oldSpec)).toBe(false);
  });

  test('exposes protection reason details for spec-session prune through CLI', async () => {
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

    const pruned = await runCli([
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--show-protection-reasons',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.protection_ranking_top).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spec: '121-00-active',
        total_references: 1
      })
    ]));
    expect(prunePayload.protected_specs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '121-00-active',
        reasons: expect.objectContaining({
          collaboration_active: 1
        })
      })
    ]));
    expect(await fs.pathExists(activeSpec)).toBe(true);
    expect(await fs.pathExists(staleSpec)).toBe(false);
  });

  test('protects controller-referenced specs in spec-session prune through CLI', async () => {
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

    const pruned = await runCli([
      'auto',
      'spec-session',
      'prune',
      '--keep',
      '0',
      '--older-than-days',
      '1',
      '--show-protection-reasons',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.protected_specs).toEqual(expect.arrayContaining([
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

  test('applies automatic spec-session retention policy in close-loop-batch CLI', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    const oldSpec = path.join(specsDir, '121-00-old');
    const newSpec = path.join(specsDir, '122-00-new');
    await fs.ensureDir(oldSpec);
    await fs.ensureDir(newSpec);
    await fs.utimes(oldSpec, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSpec, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['retention policy goal']
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--spec-session-keep',
      '1',
      '--spec-session-older-than-days',
      '1',
      '--spec-session-protect-window-days',
      '0',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.spec_session_prune).toEqual(expect.objectContaining({
      mode: 'auto-spec-session-prune',
      deleted_count: 1,
      protect_active: true,
      protect_window_days: 0
    }));
    expect(await fs.pathExists(newSpec)).toBe(true);
    expect(await fs.pathExists(oldSpec)).toBe(false);
  });

  test('fails close-loop-batch when spec-session budget hard-fail threshold is exceeded', async () => {
    const specsDir = path.join(tempDir, '.kiro', 'specs');
    await fs.ensureDir(path.join(specsDir, '121-00-existing-a'));
    await fs.ensureDir(path.join(specsDir, '121-01-existing-b'));

    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['budget guard goal']
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--spec-session-max-total',
      '1',
      '--spec-session-budget-hard-fail',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(1);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Spec session budget exceeded before run');
  });

  test('auto-scales to five sub-specs for highly complex goals in dry-run mode', async () => {
    const complexGoal = [
      'kse should deliver closed-loop automation and master/sub decomposition,',
      'parallel orchestration runtime and scheduler resilience,',
      'quality gate with observability KPI plus test evidence,',
      'and documentation rollout with migration and operator enablement.'
    ].join(' ');

    const run = await runCli([
      'auto',
      'close-loop',
      complexGoal,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.status).toBe('planned');
    expect(payload.portfolio.sub_specs).toHaveLength(5);
    expect(payload.strategy.subSpecCount).toBe(5);
  });

  test('supports close-loop-batch in dry-run mode through CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: [
        'deliver autonomous close-loop for scenario one',
        'deliver autonomous close-loop for scenario two'
      ]
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.status).toBe('completed');
    expect(payload.total_goals).toBe(2);
    expect(payload.processed_goals).toBe(2);
    expect(payload.batch_parallel).toBe(1);
    expect(payload.results).toHaveLength(2);
    expect(payload.results[0]).toEqual(expect.objectContaining({
      index: 1,
      status: 'planned'
    }));
    expect(payload.results[1]).toEqual(expect.objectContaining({
      index: 2,
      status: 'planned'
    }));
  });

  test('supports close-loop-batch goal decomposition from one broad goal through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-batch',
      '--decompose-goal',
      'kse should deliver autonomous close-loop progression, master/sub decomposition, parallel orchestration, quality gate and observability rollout',
      '--program-goals',
      '3',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.status).toBe('completed');
    expect(payload.total_goals).toBe(3);
    expect(payload.generated_from_goal).toEqual(expect.objectContaining({
      strategy: 'semantic-clause-and-category',
      target_goal_count: 3,
      produced_goal_count: 3
    }));
    expect(payload.results).toHaveLength(3);
  });

  test('supports close-loop-program autonomous execution through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition, parallel orchestration, quality gate and observability rollout',
      '--program-goals',
      '3',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-program');
    expect(payload.status).toBe('completed');
    expect(payload.total_goals).toBe(3);
    expect(payload.generated_from_goal).toEqual(expect.objectContaining({
      strategy: 'semantic-clause-and-category',
      target_goal_count: 3,
      produced_goal_count: 3
    }));
    expect(payload.autonomous_policy).toEqual(expect.objectContaining({
      enabled: true,
      profile: 'closed-loop'
    }));
    expect(payload.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      max_rounds: 10
    }));
    expect(payload.program_kpi).toEqual(expect.objectContaining({
      convergence_state: 'converged',
      risk_level: 'low'
    }));
    expect(payload.program_diagnostics).toEqual(expect.objectContaining({
      failed_goal_count: 0
    }));
    expect(payload.program_coordination).toEqual(expect.objectContaining({
      topology: 'master-sub'
    }));
    expect(payload.auto_recovery).toEqual(expect.objectContaining({
      enabled: true,
      triggered: false,
      converged: true
    }));
    expect(payload.program_gate).toEqual(expect.objectContaining({
      passed: true
    }));
  });

  test('supports close-loop-program gate profile policy through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--program-gate-profile',
      'staging',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate).toEqual(expect.objectContaining({
      passed: true,
      policy: expect.objectContaining({
        profile: 'staging',
        max_risk_level: 'medium'
      })
    }));
  });

  test('fails close-loop-program gate on strict agent budget policy through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--batch-agent-budget',
      '4',
      '--program-max-agent-budget',
      '2',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(1);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_agent_budget: 2
      }),
      actual: expect.objectContaining({
        agent_budget: 4
      })
    }));
  });

  test('stabilizes close-loop-program via governance replay loop through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--batch-agent-budget',
      '4',
      '--program-max-agent-budget',
      '2',
      '--program-govern-until-stable',
      '--program-govern-max-rounds',
      '2',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate_effective).toEqual(expect.objectContaining({
      passed: true
    }));
    expect(payload.program_governance).toEqual(expect.objectContaining({
      enabled: true,
      performed_rounds: 1,
      converged: true
    }));
    expect(payload.program_governance.history[0]).toEqual(expect.objectContaining({
      execution_mode: 'program-replay'
    }));
  });

  test('applies governance remediation action selection through recover cycle via CLI', async () => {
    const hookPath = path.join(__dirname, 'fixtures', 'program-gate-fallback-hook.js');
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
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
    ], {
      cwd: tempDir,
      nodeArgs: ['--require', hookPath],
      env: {
        KSE_TEST_MOCK_CLOSE_LOOP_RUNNER: '1'
      }
    });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_governance).toEqual(expect.objectContaining({
      enabled: true,
      action_selection_enabled: true,
      pinned_action_index: 1,
      performed_rounds: 1
    }));
    expect(payload.program_governance.history[0]).toEqual(expect.objectContaining({
      execution_mode: 'recover-cycle',
      selected_action_index: 1,
      selected_action: expect.stringContaining('Resume unresolved goals'),
      applied_patch: expect.objectContaining({
        batchRetryUntilComplete: true
      })
    }));
  });

  test('drains close-loop-controller queue through CLI', async () => {
    const queueFile = path.join(tempDir, 'controller-goals.lines');
    await fs.writeFile(queueFile, [
      'deliver autonomous controller goal one',
      'deliver autonomous controller goal two'
    ].join('\n'), 'utf8');

    const run = await runCli([
      'auto',
      'close-loop-controller',
      queueFile,
      '--program-goals',
      '2',
      '--dequeue-limit',
      '2',
      '--max-cycles',
      '1',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload).toEqual(expect.objectContaining({
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 2,
      completed_goals: 2,
      failed_goals: 0,
      pending_goals: 0
    }));

    const queueAfter = await fs.readFile(queueFile, 'utf8');
    expect(queueAfter.trim()).toBe('');
  });

  test('supports close-loop-controller --controller-resume latest through CLI', async () => {
    const queueFile = path.join(tempDir, 'controller-resume-goals.lines');
    await fs.writeFile(queueFile, 'deliver autonomous resumed controller goal\n', 'utf8');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(controllerSessionDir);
    const controllerSessionFile = path.join(controllerSessionDir, 'controller-resume.json');
    await fs.writeJson(controllerSessionFile, {
      mode: 'auto-close-loop-controller',
      status: 'partial-failed',
      queue_file: queueFile,
      queue_format: 'lines',
      controller_session: {
        id: 'controller-resume',
        file: controllerSessionFile
      },
      updated_at: new Date().toISOString()
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-controller',
      '--controller-resume',
      'latest',
      '--dequeue-limit',
      '1',
      '--max-cycles',
      '1',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload).toEqual(expect.objectContaining({
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0
    }));
    expect(payload.resumed_from_controller_session).toEqual(expect.objectContaining({
      id: 'controller-resume'
    }));
  });

  test('supports auto kpi trend controller mode through CLI', async () => {
    const batchSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    const controllerSessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(batchSessionDir);
    await fs.ensureDir(controllerSessionDir);

    const nestedProgramSummary = path.join(batchSessionDir, 'nested-program-summary.json');
    await fs.writeJson(nestedProgramSummary, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      metrics: {
        total_sub_specs: 4
      },
      spec_session_budget: {
        estimated_created: 2
      }
    }, { spaces: 2 });

    const controllerSummary = path.join(controllerSessionDir, 'controller-kpi-summary.json');
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
          goal: 'controller-kpi-goal',
          status: 'failed',
          batch_session_file: nestedProgramSummary
        }
      ]
    }, { spaces: 2 });
    await fs.utimes(controllerSummary, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));

    const run = await runCli([
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--mode',
      'controller',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload).toEqual(expect.objectContaining({
      mode: 'auto-kpi-trend',
      mode_filter: 'controller',
      total_runs: 1
    }));
    expect(payload.mode_breakdown).toEqual(expect.objectContaining({
      controller: 1
    }));
    expect(payload.overall).toEqual(expect.objectContaining({
      success_rate_percent: 50,
      average_total_sub_specs: 4,
      average_estimated_spec_created: 2
    }));
  });

  test('supports close-loop-program gate fallback profile through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--program-gate-profile',
      'prod',
      '--program-gate-fallback-profile',
      'staging',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate_effective).toEqual(expect.objectContaining({
      passed: true,
      source: 'primary',
      attempted_fallback_count: 0
    }));
    expect(payload.program_gate_effective.fallback_chain).toEqual(['staging']);
    expect(payload.program_gate_effective.fallback_profile).toBeNull();
  });

  test('supports close-loop-program gate fallback chain through CLI', async () => {
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--program-gate-profile',
      'prod',
      '--program-gate-fallback-chain',
      'prod,staging',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate_effective).toEqual(expect.objectContaining({
      passed: true,
      source: 'primary',
      attempted_fallback_count: 0
    }));
    expect(payload.program_gate_fallbacks).toHaveLength(0);
    expect(payload.program_gate_effective.fallback_chain).toEqual(['prod', 'staging']);
    expect(payload.program_gate_effective.fallback_profile).toBeNull();
  });

  test('supports non-dry-run fallback-chain acceptance when primary gate fails on risk policy', async () => {
    const hookPath = path.join(__dirname, 'fixtures', 'program-gate-fallback-hook.js');
    const run = await runCli([
      'auto',
      'close-loop-program',
      'deliver autonomous close-loop progression, master/sub decomposition and quality rollout',
      '--program-goals',
      '2',
      '--program-gate-profile',
      'prod',
      '--program-gate-fallback-chain',
      'staging',
      '--batch-retry-rounds',
      '1',
      '--json'
    ], {
      cwd: tempDir,
      nodeArgs: ['--require', hookPath],
      env: {
        KSE_TEST_MOCK_CLOSE_LOOP_RUNNER: '1'
      }
    });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.status).toBe('completed');
    expect(payload.batch_retry).toEqual(expect.objectContaining({
      performed_rounds: 1
    }));
    expect(payload.program_kpi).toEqual(expect.objectContaining({
      risk_level: 'medium'
    }));
    expect(payload.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        profile: 'prod',
        max_risk_level: 'low'
      }),
      actual: expect.objectContaining({
        risk_level: 'medium'
      })
    }));
    expect(payload.program_gate_effective).toEqual(expect.objectContaining({
      passed: true,
      source: 'fallback-chain',
      fallback_profile: 'staging',
      attempted_fallback_count: 1
    }));
  });

  test('writes close-loop-program KPI snapshot file through CLI', async () => {
    const kpiOutPath = path.join(tempDir, 'program-kpi.json');
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression, master/sub decomposition, parallel orchestration and quality gate rollout',
      '--program-goals',
      '2',
      '--program-kpi-out',
      kpiOutPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_kpi_file).toBe(kpiOutPath);
    expect(await fs.pathExists(kpiOutPath)).toBe(true);

    const kpiPayload = await fs.readJson(kpiOutPath);
    expect(kpiPayload.mode).toBe('auto-close-loop-program-kpi');
    expect(kpiPayload.program_kpi).toEqual(expect.objectContaining({
      convergence_state: 'converged'
    }));
    expect(kpiPayload.program_diagnostics).toEqual(expect.objectContaining({
      failed_goal_count: 0
    }));
  });

  test('writes close-loop-program audit file through CLI', async () => {
    const auditOutPath = path.join(tempDir, 'program-audit.json');
    const run = await runCli([
      'auto',
      'close-loop-program',
      'kse should deliver autonomous close-loop progression and master/sub orchestration',
      '--program-goals',
      '2',
      '--program-audit-out',
      auditOutPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_audit_file).toBe(auditOutPath);
    expect(await fs.pathExists(auditOutPath)).toBe(true);
    const auditPayload = await fs.readJson(auditOutPath);
    expect(auditPayload.mode).toBe('auto-close-loop-program-audit');
    expect(auditPayload.program_coordination).toEqual(expect.objectContaining({
      topology: 'master-sub'
    }));
  });

  test('reports decomposition quality refinement metadata through CLI', async () => {
    const run = await runCli([
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
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.generated_from_goal.quality.refinement).toEqual(expect.objectContaining({
      attempted: true,
      min_score: 99
    }));
  });

  test('fails decomposition quality gate when threshold is enforced through CLI', async () => {
    const run = await runCli([
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
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(1);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Decomposition quality score');
  });

  test('supports close-loop-recover through CLI with remediation action selection', async () => {
    const summaryPath = path.join(tempDir, 'failed-program-summary.json');
    await fs.writeJson(summaryPath, {
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

    const run = await runCli([
      'auto',
      'close-loop-recover',
      summaryPath,
      '--use-action',
      '2',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-recover');
    expect(payload.recovered_from_summary).toEqual(expect.objectContaining({
      file: summaryPath,
      selected_action_index: 2
    }));
    expect(payload.recovery_plan).toEqual(expect.objectContaining({
      applied_patch: expect.objectContaining({
        batchParallel: 2,
        batchAgentBudget: 2
      })
    }));
  });

  test('supports close-loop-recover until-complete mode metadata through CLI', async () => {
    const summaryPath = path.join(tempDir, 'failed-program-summary.json');
    await fs.writeJson(summaryPath, {
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

    const run = await runCli([
      'auto',
      'close-loop-recover',
      summaryPath,
      '--recover-until-complete',
      '--recover-max-rounds',
      '2',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-recover');
    expect(payload.recovery_cycle).toEqual(expect.objectContaining({
      enabled: true,
      max_rounds: 2,
      performed_rounds: 1,
      converged: true,
      exhausted: false
    }));
  });

  test('applies program gate budget policy in close-loop-recover through CLI', async () => {
    const summaryPath = path.join(tempDir, 'failed-program-summary.json');
    await fs.writeJson(summaryPath, {
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

    const run = await runCli([
      'auto',
      'close-loop-recover',
      summaryPath,
      '--batch-agent-budget',
      '2',
      '--program-max-agent-budget',
      '1',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(1);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.program_gate).toEqual(expect.objectContaining({
      passed: false,
      policy: expect.objectContaining({
        max_agent_budget: 1
      }),
      actual: expect.objectContaining({
        agent_budget: 2
      })
    }));
  });

  test('supports batch session persistence and --resume-from-summary latest through CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['latest resume goal one', 'latest resume goal two']
    }, { spaces: 2 });

    const firstRun = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(firstRun.exitCode).toBe(0);
    const firstPayload = parseJsonOutput(firstRun.stdout);
    expect(firstPayload.batch_session).toBeDefined();
    expect(await fs.pathExists(firstPayload.batch_session.file)).toBe(true);

    const resumedRun = await runCli([
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      'latest',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(resumedRun.exitCode).toBe(0);
    const resumedPayload = parseJsonOutput(resumedRun.stdout);
    expect(resumedPayload.resumed_from_summary).toEqual(expect.objectContaining({
      file: firstPayload.batch_session.file
    }));
    expect(resumedPayload.total_goals).toBe(2);
  });

  test('emits batch retry metadata in close-loop-batch CLI summary', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['retry metadata goal one', 'retry metadata goal two']
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--batch-retry-rounds',
      '2',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.batch_retry).toEqual(expect.objectContaining({
      enabled: true,
      strategy: 'adaptive',
      until_complete: false,
      configured_rounds: 2,
      max_rounds: 2,
      performed_rounds: 0,
      exhausted: false
    }));
  });

  test('supports until-complete retry mode metadata in close-loop-batch CLI summary', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['until-complete goal one', 'until-complete goal two']
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--batch-retry-until-complete',
      '--batch-retry-max-rounds',
      '4',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.batch_retry).toEqual(expect.objectContaining({
      enabled: true,
      strategy: 'adaptive',
      until_complete: true,
      configured_rounds: 0,
      max_rounds: 4,
      performed_rounds: 0,
      exhausted: false
    }));
  });

  test('supports autonomous batch policy in close-loop-batch CLI summary', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['autonomous goal one', 'autonomous goal two']
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--batch-autonomous',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.autonomous_policy).toEqual(expect.objectContaining({
      enabled: true,
      profile: 'closed-loop'
    }));
    expect(payload.batch_parallel).toBe(2);
    expect(payload.resource_plan).toEqual(expect.objectContaining({
      scheduling_strategy: 'complex-first',
      aging_factor: 2
    }));
    expect(payload.batch_retry).toEqual(expect.objectContaining({
      until_complete: true,
      max_rounds: 10
    }));
  });

  test('applies batch agent budget in close-loop-batch CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: [
        'budget goal one',
        'budget goal two',
        'budget goal three'
      ]
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--continue-on-error',
      '--batch-parallel',
      '3',
      '--batch-agent-budget',
      '2',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.status).toBe('completed');
    expect(payload.batch_parallel).toBe(2);
    expect(payload.resource_plan).toEqual(expect.objectContaining({
      agent_budget: 2,
      base_goal_parallel: 3,
      effective_goal_parallel: 2,
      per_goal_max_parallel: 1
    }));
  });

  test('exposes batch priority and aging strategy in CLI summary resource plan', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: [
        [
          'deliver orchestration integration migration observability and security resilience,',
          'plus quality compliance governance and performance hardening,',
          'with closed-loop remediation and parallel master sub coordination.'
        ].join(' '),
        'simple goal'
      ]
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--continue-on-error',
      '--batch-priority',
      'complex-first',
      '--batch-aging-factor',
      '4',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.resource_plan).toEqual(expect.objectContaining({
      scheduling_strategy: 'complex-first',
      aging_factor: 4
    }));
  });

  test('supports close-loop-batch resume-from-summary through CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    const summaryPath = path.join(tempDir, 'batch-old-summary.json');
    await fs.writeJson(goalsPath, {
      goals: [
        'resume goal one',
        'resume goal two',
        'resume goal three'
      ]
    }, { spaces: 2 });
    await fs.writeJson(summaryPath, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      goals_file: goalsPath,
      total_goals: 3,
      processed_goals: 1,
      stopped_early: true,
      results: [
        {
          index: 1,
          goal: 'resume goal one',
          status: 'failed',
          master_spec: '121-00-resume-one',
          sub_spec_count: 2,
          error: null
        }
      ]
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      summaryPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.status).toBe('completed');
    expect(payload.processed_goals).toBe(3);
    expect(payload.total_goals).toBe(3);
    expect(payload.resumed_from_summary).toEqual(expect.objectContaining({
      file: summaryPath,
      strategy: 'pending'
    }));
    expect(payload.results).toHaveLength(3);
    expect(payload.results[0].goal).toBe('resume goal one');
    expect(payload.results[1].goal).toBe('resume goal two');
    expect(payload.results[2].goal).toBe('resume goal three');
  });

  test('supports failed-only resume strategy in close-loop-batch CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    const summaryPath = path.join(tempDir, 'batch-old-summary.json');
    await fs.writeJson(goalsPath, {
      goals: [
        'resume goal one',
        'resume goal two',
        'resume goal three'
      ]
    }, { spaces: 2 });
    await fs.writeJson(summaryPath, {
      mode: 'auto-close-loop-batch',
      status: 'failed',
      goals_file: goalsPath,
      total_goals: 3,
      processed_goals: 1,
      stopped_early: true,
      results: [
        {
          index: 1,
          goal: 'resume goal one',
          status: 'failed',
          master_spec: '121-00-resume-one',
          sub_spec_count: 2,
          error: null
        }
      ]
    }, { spaces: 2 });

    const run = await runCli([
      'auto',
      'close-loop-batch',
      '--resume-from-summary',
      summaryPath,
      '--resume-strategy',
      'failed-only',
      '--dry-run',
      '--json'
    ], { cwd: tempDir });

    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-close-loop-batch');
    expect(payload.status).toBe('completed');
    expect(payload.processed_goals).toBe(1);
    expect(payload.total_goals).toBe(1);
    expect(payload.resumed_from_summary).toEqual(expect.objectContaining({
      file: summaryPath,
      strategy: 'failed-only'
    }));
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].goal).toBe('resume goal one');
  });

  test('aggregates autonomous KPI trend through CLI', async () => {
    const summaryDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(summaryDir);
    const fileA = path.join(summaryDir, 'trend-a.json');
    const fileB = path.join(summaryDir, 'trend-b.json');
    await fs.writeJson(fileA, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-14T10:00:00.000Z',
      failed_goals: 0,
      metrics: { success_rate_percent: 100, total_sub_specs: 6 },
      program_kpi: { completion_rate_percent: 100 },
      program_gate_effective: { passed: true },
      spec_session_budget: { estimated_created: 2 }
    }, { spaces: 2 });
    await fs.writeJson(fileB, {
      mode: 'auto-close-loop-recover',
      status: 'partial-failed',
      updated_at: '2026-02-13T10:00:00.000Z',
      failed_goals: 1,
      metrics: { success_rate_percent: 50, total_sub_specs: 2 },
      program_kpi: { completion_rate_percent: 50 },
      program_gate_effective: { passed: false },
      spec_session_budget: { estimated_created: 1 }
    }, { spaces: 2 });
    await fs.utimes(fileA, new Date('2026-02-14T10:00:00.000Z'), new Date('2026-02-14T10:00:00.000Z'));
    await fs.utimes(fileB, new Date('2026-02-13T10:00:00.000Z'), new Date('2026-02-13T10:00:00.000Z'));

    const run = await runCli([
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--json'
    ], { cwd: tempDir });
    expect(run.exitCode).toBe(0);
    const payload = parseJsonOutput(run.stdout);
    expect(payload.mode).toBe('auto-kpi-trend');
    expect(payload.total_runs).toBe(2);
    expect(payload.overall).toEqual(expect.objectContaining({
      runs: 2,
      success_rate_percent: 75
    }));
    expect(payload.period_unit).toBe('week');
    expect(Array.isArray(payload.anomalies)).toBe(true);
  });

  test('supports daily KPI trend csv output through CLI', async () => {
    const summaryDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-batch-summaries');
    await fs.ensureDir(summaryDir);
    const outputPath = path.join(tempDir, 'kpi-trend.csv');
    const fileA = path.join(summaryDir, 'trend-day-a.json');
    const fileB = path.join(summaryDir, 'trend-day-b.json');
    await fs.writeJson(fileA, {
      mode: 'auto-close-loop-program',
      status: 'completed',
      updated_at: '2026-02-12T10:00:00.000Z',
      failed_goals: 0,
      metrics: { success_rate_percent: 100, total_sub_specs: 6 },
      program_kpi: { completion_rate_percent: 100 },
      program_gate_effective: { passed: true },
      spec_session_budget: { estimated_created: 2 }
    }, { spaces: 2 });
    await fs.writeJson(fileB, {
      mode: 'auto-close-loop-recover',
      status: 'partial-failed',
      updated_at: '2026-02-13T10:00:00.000Z',
      failed_goals: 2,
      metrics: { success_rate_percent: 40, total_sub_specs: 3 },
      program_kpi: { completion_rate_percent: 40 },
      program_gate_effective: { passed: false },
      spec_session_budget: { estimated_created: 5 }
    }, { spaces: 2 });
    await fs.utimes(fileA, new Date('2026-02-12T10:00:00.000Z'), new Date('2026-02-12T10:00:00.000Z'));
    await fs.utimes(fileB, new Date('2026-02-13T10:00:00.000Z'), new Date('2026-02-13T10:00:00.000Z'));

    const run = await runCli([
      'auto',
      'kpi',
      'trend',
      '--weeks',
      '52',
      '--period',
      'day',
      '--csv',
      '--out',
      outputPath
    ], { cwd: tempDir });
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('period,runs,completed_runs');
    expect(run.stdout).toContain('overall');
    expect(await fs.pathExists(outputPath)).toBe(true);
    const outputFile = await fs.readFile(outputPath, 'utf8');
    expect(outputFile).toContain('period,runs,completed_runs');
    expect(outputFile).toContain('overall');
  });

  test('supports batch-session list and prune lifecycle through CLI', async () => {
    const goalsPath = path.join(tempDir, 'batch-goals.json');
    await fs.writeJson(goalsPath, {
      goals: ['batch session lifecycle one']
    }, { spaces: 2 });

    const firstRun = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });
    expect(firstRun.exitCode).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 20));

    await fs.writeJson(goalsPath, {
      goals: ['batch session lifecycle two']
    }, { spaces: 2 });
    const secondRun = await runCli([
      'auto',
      'close-loop-batch',
      goalsPath,
      '--dry-run',
      '--json'
    ], { cwd: tempDir });
    expect(secondRun.exitCode).toBe(0);

    const listed = await runCli([
      'auto',
      'batch-session',
      'list',
      '--limit',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(listed.exitCode).toBe(0);
    const listPayload = parseJsonOutput(listed.stdout);
    expect(listPayload.mode).toBe('auto-batch-session-list');
    expect(listPayload.total).toBe(2);
    expect(listPayload.sessions).toHaveLength(1);

    const pruned = await runCli([
      'auto',
      'batch-session',
      'prune',
      '--keep',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.mode).toBe('auto-batch-session-prune');
    expect(prunePayload.deleted_count).toBe(1);
    expect(prunePayload.errors).toEqual([]);

    const listedAfter = await runCli([
      'auto',
      'batch-session',
      'list',
      '--json'
    ], { cwd: tempDir });
    expect(listedAfter.exitCode).toBe(0);
    const listAfterPayload = parseJsonOutput(listedAfter.stdout);
    expect(listAfterPayload.total).toBe(1);
  });

  test('supports controller-session list and prune lifecycle through CLI', async () => {
    const sessionDir = path.join(tempDir, '.kiro', 'auto', 'close-loop-controller-sessions');
    await fs.ensureDir(sessionDir);
    const oldSession = path.join(sessionDir, 'old-controller-session.json');
    const newSession = path.join(sessionDir, 'new-controller-session.json');
    await fs.writeJson(oldSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: {
        id: 'old-controller-session',
        file: oldSession
      }
    }, { spaces: 2 });
    await fs.writeJson(newSession, {
      mode: 'auto-close-loop-controller',
      status: 'completed',
      processed_goals: 1,
      pending_goals: 0,
      controller_session: {
        id: 'new-controller-session',
        file: newSession
      }
    }, { spaces: 2 });
    await fs.utimes(oldSession, new Date('2020-01-01T00:00:00.000Z'), new Date('2020-01-01T00:00:00.000Z'));
    await fs.utimes(newSession, new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.000Z'));

    const listed = await runCli([
      'auto',
      'controller-session',
      'list',
      '--limit',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(listed.exitCode).toBe(0);
    const listPayload = parseJsonOutput(listed.stdout);
    expect(listPayload.mode).toBe('auto-controller-session-list');
    expect(listPayload.total).toBe(2);
    expect(listPayload.sessions).toHaveLength(1);

    const pruned = await runCli([
      'auto',
      'controller-session',
      'prune',
      '--keep',
      '1',
      '--json'
    ], { cwd: tempDir });
    expect(pruned.exitCode).toBe(0);
    const prunePayload = parseJsonOutput(pruned.stdout);
    expect(prunePayload.mode).toBe('auto-controller-session-prune');
    expect(prunePayload.deleted_count).toBe(1);
    expect(prunePayload.errors).toEqual([]);

    const listedAfter = await runCli([
      'auto',
      'controller-session',
      'list',
      '--json'
    ], { cwd: tempDir });
    expect(listedAfter.exitCode).toBe(0);
    const listAfterPayload = parseJsonOutput(listedAfter.stdout);
    expect(listAfterPayload.total).toBe(1);
  });
});
