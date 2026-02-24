const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-plan-build script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-plan-build-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('generates medium-risk plan from approval-focused intent', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-plan-build.js');
    const workspace = path.join(tempDir, 'workspace');
    const intentFile = path.join(workspace, 'intent.json');
    const contextFile = path.join(workspace, 'context.json');

    await fs.ensureDir(workspace);
    await fs.writeJson(intentFile, {
      intent_id: 'intent-001',
      user_id: 'demo-user',
      context_ref: {
        product: 'moqui-experiment',
        module: 'order-management',
        page: 'approval-dashboard',
        entity: 'OrderHeader'
      },
      business_goal: 'Must optimize approval workflow and improve rule threshold consistency.',
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });
    await fs.writeJson(contextFile, {
      product: 'moqui-experiment',
      module: 'order-management',
      page: 'approval-dashboard',
      entity: 'OrderHeader'
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--intent',
        intentFile,
        '--context',
        contextFile,
        '--json'
      ],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-plan-build');
    expect(payload.plan.intent_id).toBe('intent-001');
    expect(payload.plan.risk_level).toBe('medium');
    expect(payload.plan.actions.map(item => item.type)).toEqual(
      expect.arrayContaining([
        'workflow_approval_chain_change',
        'update_rule_threshold'
      ])
    );
    expect(payload.plan.approval.status).toBe('not-required');
    expect(payload.plan.authorization.password_required).toBe(false);

    const planFile = path.join(workspace, '.sce', 'reports', 'interactive-change-plan.generated.json');
    const markdownFile = path.join(workspace, '.sce', 'reports', 'interactive-change-plan.generated.md');
    expect(await fs.pathExists(planFile)).toBe(true);
    expect(await fs.pathExists(markdownFile)).toBe(true);
  });

  test('forces high-risk pending approval for destructive/privileged goal', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-plan-build.js');
    const workspace = path.join(tempDir, 'workspace');
    const intentFile = path.join(workspace, 'intent.json');

    await fs.ensureDir(workspace);
    await fs.writeJson(intentFile, {
      intent_id: 'intent-002',
      user_id: 'demo-user',
      context_ref: {
        product: 'moqui-experiment',
        module: 'security',
        page: 'role-admin'
      },
      business_goal: 'Need to delete stale records and grant admin permission with token export.',
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--intent',
        intentFile,
        '--execution-mode',
        'apply',
        '--json'
      ],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.plan.risk_level).toBe('high');
    expect(payload.plan.approval.status).toBe('pending');
    expect(payload.plan.authorization.password_required).toBe(true);
    expect(payload.plan.authorization.password_scope).toEqual(['execute']);
    expect(payload.plan.actions.map(item => item.type)).toEqual(
      expect.arrayContaining([
        'bulk_delete_without_filter',
        'permission_grant_super_admin',
        'credential_export'
      ])
    );
  });

  test('fails when --intent is missing', () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-plan-build.js');
    const workspace = path.join(tempDir, 'workspace');
    fs.ensureDirSync(workspace);

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('--intent');
  });
});
