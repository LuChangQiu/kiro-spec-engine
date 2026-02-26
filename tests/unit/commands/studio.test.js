const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  resolveStudioPaths,
  readLatestJob,
  runStudioPlanCommand,
  runStudioGenerateCommand,
  runStudioApplyCommand,
  runStudioVerifyCommand,
  runStudioReleaseCommand,
  runStudioResumeCommand
} = require('../../../lib/commands/studio');

describe('studio command workflow', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-studio-cmd-'));
    originalLog = console.log;
    console.log = jest.fn();
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
      projectPath: tempDir
    });
    expect(verified.status).toBe('verified');
    expect(verified.artifacts.verify_report).toContain(`verify-${planned.job_id}.json`);

    const released = await runStudioReleaseCommand({
      channel: 'prod',
      json: true
    }, {
      projectPath: tempDir
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
});
