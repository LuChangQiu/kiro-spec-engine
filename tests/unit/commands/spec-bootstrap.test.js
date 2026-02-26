const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { runSpecBootstrap } = require('../../../lib/commands/spec-bootstrap');
const { SessionStore } = require('../../../lib/runtime/session-store');

describe('spec-bootstrap command', () => {
  let tempDir;
  let originalCwd;
  let originalLog;
  let logOutput;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-bootstrap-'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'specs'));

    originalCwd = process.cwd;
    process.cwd = jest.fn(() => tempDir);

    originalLog = console.log;
    logOutput = [];
    console.log = jest.fn((...args) => {
      logOutput.push(args.join(' '));
    });

    const sessionStore = new SessionStore(tempDir);
    await sessionStore.beginSceneSession({
      sceneId: 'scene.test-default',
      objective: 'default scene for spec-bootstrap tests'
    });
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    console.log = originalLog;

    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('supports non-interactive dry-run and json output', async () => {
    const result = await runSpecBootstrap({
      name: '109-01-bootstrap-dry-run',
      template: 'rest-api',
      profile: 'backend-api',
      nonInteractive: true,
      dryRun: true,
      json: true
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.trace.template).toBe('rest-api');
    expect(result.trace.profile).toBe('backend-api');
    expect(result.preview.requirements).toContain('Requirement 1');

    const generatedPath = path.join(tempDir, '.sce', 'specs', '109-01-bootstrap-dry-run');
    expect(await fs.pathExists(generatedPath)).toBe(false);

    const output = logOutput.join('\n');
    expect(output).toContain('"specName": "109-01-bootstrap-dry-run"');
    expect(output).toContain('"dryRun": true');
  });

  test('writes requirements, design, and tasks when not dry-run', async () => {
    const specName = '109-02-bootstrap-write-mode';

    const result = await runSpecBootstrap({
      name: specName,
      profile: 'general',
      nonInteractive: true
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);

    const specDir = path.join(tempDir, '.sce', 'specs', specName);
    const requirementsPath = path.join(specDir, 'requirements.md');
    const designPath = path.join(specDir, 'design.md');
    const tasksPath = path.join(specDir, 'tasks.md');

    expect(await fs.pathExists(requirementsPath)).toBe(true);
    expect(await fs.pathExists(designPath)).toBe(true);
    expect(await fs.pathExists(tasksPath)).toBe(true);

    const requirements = await fs.readFile(requirementsPath, 'utf8');
    const design = await fs.readFile(designPath, 'utf8');
    const tasks = await fs.readFile(tasksPath, 'utf8');

    expect(requirements).toContain('## Requirements');
    expect(design).toContain('## Requirement Mapping');
    expect(tasks).toContain('**Requirement**: Requirement 1');
  });

  test('fails when non-interactive mode has no name', async () => {
    await expect(runSpecBootstrap({
      nonInteractive: true,
      dryRun: true,
      json: true
    })).rejects.toThrow('--name is required in non-interactive mode');
  });

  test('defaults to orchestrate mode for multi-spec targets', async () => {
    const runOrchestration = jest.fn(async () => ({
      status: 'completed',
      totalSpecs: 2,
      completedSpecs: 2,
      failedSpecs: 0
    }));

    const result = await runSpecBootstrap({
      specs: '109-10-bootstrap-a,109-11-bootstrap-b',
      json: true,
      maxParallel: 5
    }, {
      projectPath: tempDir,
      runOrchestration
    });

    expect(runOrchestration).toHaveBeenCalledWith(expect.objectContaining({
      specs: '109-10-bootstrap-a,109-11-bootstrap-b',
      maxParallel: 5,
      silent: true
    }), expect.any(Object));

    expect(result.mode).toBe('orchestrate');
    expect(result.status).toBe('completed');
    expect(result.spec_ids).toEqual(['109-10-bootstrap-a', '109-11-bootstrap-b']);
  });

  test('binds bootstrap spec as a child session when scene primary session is active', async () => {
    const sessionStore = new SessionStore(tempDir);
    const sceneSession = await sessionStore.beginSceneSession({
      sceneId: 'scene.bootstrap-integration',
      objective: 'bootstrap scene'
    });

    const result = await runSpecBootstrap({
      name: '109-20-bootstrap-scene-bind',
      profile: 'general',
      scene: 'scene.bootstrap-integration',
      nonInteractive: true,
      json: true
    }, {
      projectPath: tempDir,
      sessionStore
    });

    expect(result.scene_session).toEqual(expect.objectContaining({
      bound: true,
      scene_id: 'scene.bootstrap-integration',
      scene_session_id: sceneSession.session.session_id
    }));
    expect(result.scene_session.spec_session_id).toBeTruthy();

    const parent = await sessionStore.getSession(sceneSession.session.session_id);
    expect(parent.children.spec_sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spec_id: '109-20-bootstrap-scene-bind',
        status: 'completed'
      })
    ]));
  });

  test('fails when no active scene primary session exists', async () => {
    const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-bootstrap-no-scene-'));
    await fs.ensureDir(path.join(isolated, '.sce', 'specs'));
    await expect(runSpecBootstrap({
      name: '109-30-bootstrap-no-scene',
      nonInteractive: true,
      dryRun: true,
      json: true
    }, {
      projectPath: isolated
    })).rejects.toThrow('No active scene session found');
    await fs.remove(isolated);
  });
});
