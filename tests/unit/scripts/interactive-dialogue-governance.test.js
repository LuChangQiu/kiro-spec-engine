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
    expect(payload.authorization_dialogue.decision).toBe('allow');
    expect(Array.isArray(payload.response_rules)).toBe(true);
    expect(payload.response_rules.length).toBeGreaterThan(0);
  });

  test('returns authorization-dialogue deny for business-user apply mode', async () => {
    const workspace = path.join(tempDir, 'workspace-authz-deny');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Reduce order approval lead time by 20% on OrderEntry page',
      '--execution-mode', 'apply',
      '--profile', 'business-user',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('allow');
    expect(payload.authorization_dialogue.decision).toBe('deny');
    expect(payload.authorization_dialogue.reasons.join(' ')).toContain('does not allow execution mode');
  });

  test('returns authorization-dialogue review-required in prod for system-maintainer apply', async () => {
    const workspace = path.join(tempDir, 'workspace-authz-review');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Apply order approval workflow fix with rollback plan and ticket',
      '--execution-mode', 'apply',
      '--runtime-environment', 'prod',
      '--profile', 'system-maintainer',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.authorization_dialogue.decision).toBe('review-required');
    expect(payload.authorization_dialogue.required_inputs).toEqual(expect.arrayContaining([
      'change_ticket_id',
      'one_time_password',
      'actor_role',
      'approver_role'
    ]));
    expect(payload.authorization_dialogue.required_confirmation_steps).toEqual(expect.arrayContaining([
      'manual_review_ack',
      'role_separation'
    ]));
  });

  test('enforces user-app mode as suggestion-only even with system-maintainer profile', async () => {
    const workspace = path.join(tempDir, 'workspace-ui-mode-user-app');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Reduce order approval lead time by 20% on OrderEntry page',
      '--profile', 'system-maintainer',
      '--ui-mode', 'user-app',
      '--execution-mode', 'apply',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.authorization_dialogue.decision).toBe('deny');
    expect(payload.authorization_dialogue.reasons.join(' ')).toContain('user-app');
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

  test('fails fast for unsupported ui mode', async () => {
    const workspace = path.join(tempDir, 'workspace-invalid-ui-mode');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, [
      '--goal', 'Reduce approval lead time by 20%',
      '--ui-mode', 'operator-ui',
      '--json'
    ]);

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('--ui-mode must be one of');
  });
});
