const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-feedback-log script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-feedback-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-feedback-log.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args = []) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  test('appends one feedback entry to JSONL and returns payload', async () => {
    const workspace = path.join(tempDir, 'workspace-success');
    await fs.ensureDir(workspace);
    const feedbackFile = path.join(workspace, '.kiro', 'reports', 'interactive-user-feedback.jsonl');

    const result = runScript(workspace, [
      '--score', '4.5',
      '--comment', 'Great flow, less manual review needed.',
      '--user-id', 'biz-owner',
      '--session-id', 'session-001',
      '--intent-id', 'intent-001',
      '--plan-id', 'plan-001',
      '--execution-id', 'exec-001',
      '--channel', 'ui',
      '--tags', 'moqui,fast-track,moqui',
      '--product', 'moqui-suite',
      '--module', 'order',
      '--page', 'approval',
      '--scene-id', 'scene-moqui-interactive',
      '--feedback-file', feedbackFile,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-feedback-log');
    expect(payload.record.score).toBe(4.5);
    expect(payload.record.sentiment).toBe('positive');
    expect(payload.record.tags).toEqual(['moqui', 'fast-track']);
    expect(payload.record.context_ref).toEqual({
      product: 'moqui-suite',
      module: 'order',
      page: 'approval',
      scene_id: 'scene-moqui-interactive'
    });

    const lines = (await fs.readFile(feedbackFile, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record.user_id).toBe('biz-owner');
    expect(record.plan_id).toBe('plan-001');
    expect(record.channel).toBe('ui');
    expect(record.sentiment).toBe('positive');
  });

  test('fails when score is missing', async () => {
    const workspace = path.join(tempDir, 'workspace-missing-score');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, ['--json']);

    expect(result.status).toBe(1);
    expect(`${result.stderr}`).toContain('--score is required');
  });

  test('fails when score is out of range', async () => {
    const workspace = path.join(tempDir, 'workspace-invalid-score');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, ['--score', '9']);

    expect(result.status).toBe(1);
    expect(`${result.stderr}`).toContain('--score must be between 0 and 5');
  });
});
