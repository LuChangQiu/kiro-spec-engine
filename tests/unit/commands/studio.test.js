const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  resolveStudioPaths,
  readLatestJob,
  readStudioEvents,
  runStudioPlanCommand,
  runStudioGenerateCommand,
  runStudioApplyCommand,
  runStudioVerifyCommand,
  runStudioReleaseCommand,
  runStudioRollbackCommand,
  runStudioEventsCommand,
  runStudioResumeCommand
} = require('../../../lib/commands/studio');

describe('studio command workflow', () => {
  let tempDir;
  let originalLog;
  let successRunner;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-studio-cmd-'));
    originalLog = console.log;
    console.log = jest.fn();
    successRunner = jest.fn(async () => ({
      status: 0,
      stdout: 'ok',
      stderr: '',
      duration_ms: 1
    }));
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('creates a plan job and writes latest pointer', async () => {
    const payload = await runStudioPlanCommand({
      fromChat: 'session-001',
      goal: 'Build customer-order-inventory demo',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(payload.mode).toBe('studio-plan');
    expect(payload.status).toBe('planned');
    expect(payload.job_id).toContain('studio-');
    expect(payload.next_action).toContain('sce studio generate');

    const paths = resolveStudioPaths(tempDir);
    const latestJobId = await readLatestJob(paths);
    expect(latestJobId).toBe(payload.job_id);

    const jobPath = path.join(paths.jobsDir, `${payload.job_id}.json`);
    expect(await fs.pathExists(jobPath)).toBe(true);
  });

  test('supports end-to-end stage flow from generate to release', async () => {
    const planned = await runStudioPlanCommand({
      fromChat: 'session-002',
      json: true
    }, {
      projectPath: tempDir
    });

    const generated = await runStudioGenerateCommand({
      scene: 'scene.customer-order-inventory',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(generated.status).toBe('generated');
    expect(generated.artifacts.patch_bundle_id).toContain('patch-scene.customer-order-inventory-');

    const applied = await runStudioApplyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    });
    expect(applied.status).toBe('applied');

    const verified = await runStudioVerifyCommand({
      profile: 'standard',
      json: true
    }, {
      projectPath: tempDir,
      commandRunner: successRunner
    });
    expect(verified.status).toBe('verified');
    expect(verified.artifacts.verify_report).toContain(`verify-${planned.job_id}.json`);

    const released = await runStudioReleaseCommand({
      channel: 'prod',
      json: true
    }, {
      projectPath: tempDir,
      commandRunner: successRunner
    });
    expect(released.status).toBe('released');
    expect(released.next_action).toBe('complete');

    const resumed = await runStudioResumeCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    });
    expect(resumed.status).toBe('released');
    expect(resumed.progress.percent).toBe(100);
  });

  test('fails generate when no plan job exists', async () => {
    await expect(runStudioGenerateCommand({
      scene: 'scene.demo',
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('No studio job found');
  });

  test('fails release on invalid channel', async () => {
    await runStudioPlanCommand({
      fromChat: 'session-003',
      json: true
    }, {
      projectPath: tempDir
    });

    await expect(runStudioReleaseCommand({
      channel: 'staging',
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('Invalid --channel');
  });

  test('fails verify when required gate command fails', async () => {
    const packageJsonPath = path.join(tempDir, 'package.json');
    await fs.writeJson(packageJsonPath, {
      name: 'studio-verify-fixture',
      version: '1.0.0',
      scripts: {
        'test:unit': 'echo test'
      }
    }, { spaces: 2 });

    const planned = await runStudioPlanCommand({
      fromChat: 'session-006',
      json: true
    }, {
      projectPath: tempDir
    });
    await runStudioGenerateCommand({
      job: planned.job_id,
      scene: 'scene.verify-fail',
      json: true
    }, {
      projectPath: tempDir
    });
    await runStudioApplyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    });

    const failRunner = jest.fn(async () => ({
      status: 2,
      stdout: '',
      stderr: 'boom',
      duration_ms: 3
    }));

    await expect(runStudioVerifyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir,
      commandRunner: failRunner
    })).rejects.toThrow('studio verify failed');

    const paths = resolveStudioPaths(tempDir);
    const job = await fs.readJson(path.join(paths.jobsDir, `${planned.job_id}.json`));
    expect(job.status).toBe('verify_failed');
    expect(job.stages.verify.status).toBe('failed');
  });

  test('enforces stage order constraints', async () => {
    const planned = await runStudioPlanCommand({
      fromChat: 'session-004',
      json: true
    }, {
      projectPath: tempDir
    });

    await expect(runStudioApplyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('stage "generate" is not completed');

    await runStudioGenerateCommand({
      job: planned.job_id,
      scene: 'scene.order',
      json: true
    }, {
      projectPath: tempDir
    });

    await expect(runStudioReleaseCommand({
      job: planned.job_id,
      channel: 'dev',
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('stage "verify" is not completed');
  });

  test('records studio events and supports rollback', async () => {
    const planned = await runStudioPlanCommand({
      fromChat: 'session-005',
      json: true
    }, {
      projectPath: tempDir
    });

    await runStudioGenerateCommand({
      job: planned.job_id,
      scene: 'scene.inventory',
      json: true
    }, {
      projectPath: tempDir
    });
    await runStudioApplyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    });

    const rolledBack = await runStudioRollbackCommand({
      job: planned.job_id,
      reason: 'manual-check-failed',
      json: true
    }, {
      projectPath: tempDir
    });
    expect(rolledBack.status).toBe('rolled_back');
    expect(rolledBack.next_action).toContain('sce studio plan');

    const eventsPayload = await runStudioEventsCommand({
      job: planned.job_id,
      limit: '10',
      json: true
    }, {
      projectPath: tempDir
    });
    expect(eventsPayload.events.length).toBeGreaterThanOrEqual(4);
    expect(eventsPayload.events[eventsPayload.events.length - 1].event_type).toBe('job.rolled_back');

    const paths = resolveStudioPaths(tempDir);
    const rawEvents = await readStudioEvents(paths, planned.job_id, { limit: 100 });
    expect(rawEvents.some((event) => event.event_type === 'stage.apply.completed')).toBe(true);

    await expect(runStudioVerifyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir
    })).rejects.toThrow('is rolled back');
  });

  test('requires authorization for protected actions when policy is enabled', async () => {
    const secureEnv = {
      ...process.env,
      SCE_STUDIO_REQUIRE_AUTH: '1',
      SCE_STUDIO_AUTH_PASSWORD: 'top-secret'
    };

    const planned = await runStudioPlanCommand({
      fromChat: 'session-007',
      json: true
    }, {
      projectPath: tempDir
    });

    await runStudioGenerateCommand({
      job: planned.job_id,
      scene: 'scene.secure',
      json: true
    }, {
      projectPath: tempDir
    });

    await expect(runStudioApplyCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir,
      env: secureEnv
    })).rejects.toThrow('Authorization required for studio apply');

    const applied = await runStudioApplyCommand({
      job: planned.job_id,
      authPassword: 'top-secret',
      json: true
    }, {
      projectPath: tempDir,
      env: secureEnv
    });
    expect(applied.status).toBe('applied');

    await expect(runStudioRollbackCommand({
      job: planned.job_id,
      json: true
    }, {
      projectPath: tempDir,
      env: secureEnv
    })).rejects.toThrow('Authorization required for studio rollback');

    const rolledBack = await runStudioRollbackCommand({
      job: planned.job_id,
      authPassword: 'top-secret',
      reason: 'auth-test',
      json: true
    }, {
      projectPath: tempDir,
      env: secureEnv
    });
    expect(rolledBack.status).toBe('rolled_back');
  });
});
