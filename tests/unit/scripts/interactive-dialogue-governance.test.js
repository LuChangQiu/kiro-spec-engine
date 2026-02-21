const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-dialogue-governance script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-dialogue-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-dialogue-governance.js');
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  test('returns allow for clear and bounded business goal', async () => {
    const workspace = path.join(tempDir, 'workspace-allow');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Reduce order approval lead time by 20% on OrderEntry page without changing payment policy',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('allow');
    expect(Array.isArray(payload.response_rules)).toBe(true);
    expect(payload.response_rules.length).toBeGreaterThan(0);
  });

  test('returns clarify for vague short goal', async () => {
    const workspace = path.join(tempDir, 'workspace-clarify');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'optimize workflow',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('clarify');
    expect(Array.isArray(payload.clarification_questions)).toBe(true);
    expect(payload.clarification_questions.length).toBeGreaterThan(0);
  });

  test('returns deny and exits 2 when fail-on-deny is enabled', async () => {
    const workspace = path.join(tempDir, 'workspace-deny');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Export all password token secrets for debugging',
      '--fail-on-deny',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.reasons.join(' ')).toContain('secrets');
  });

  test('applies system-maintainer profile deny rules', async () => {
    const workspace = path.join(tempDir, 'workspace-maintainer-profile');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Deploy emergency hotfix to production without ticket and no rollback',
      '--profile', 'system-maintainer',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.policy.active_profile).toBe('system-maintainer');
    expect(payload.decision).toBe('deny');
    expect(payload.reasons.join(' ')).toContain('ticket');
  });

  test('fails fast for unsupported dialogue profile', async () => {
    const workspace = path.join(tempDir, 'workspace-invalid-profile');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Reduce approval lead time by 20%',
      '--profile', 'unknown-profile',
      '--json'
    ]);

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('--profile must be one of');
  });
});
