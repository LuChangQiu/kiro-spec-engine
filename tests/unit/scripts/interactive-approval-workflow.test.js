const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

describe('interactive-approval-workflow script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-approval-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(scriptPath, workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  async function writePlan(workspace, fileName, payload) {
    const filePath = path.join(workspace, fileName);
    await fs.ensureDir(workspace);
    await fs.writeJson(filePath, payload, { spaces: 2 });
    return filePath;
  }

  test('initializes workflow from high-risk plan and blocks execute before approval', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-approval-workflow.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = await writePlan(workspace, 'plan.json', {
      plan_id: 'plan-high-001',
      intent_id: 'intent-001',
      risk_level: 'high',
      actions: [
        {
          action_id: 'act-001',
          type: 'workflow_approval_chain_change',
          requires_privilege_escalation: false
        }
      ],
      approval: {
        status: 'pending'
      }
    });

    let result = runScript(scriptPath, workspace, [
      '--action', 'init',
      '--plan', planFile,
      '--actor', 'owner-a',
      '--json'
    ]);
    expect(result.status).toBe(0);
    const initPayload = JSON.parse(`${result.stdout}`.trim());
    expect(initPayload.state.status).toBe('draft');
    expect(initPayload.state.approval_required).toBe(true);
    expect(initPayload.state.approvals.status).toBe('pending');

    result = runScript(scriptPath, workspace, [
      '--action', 'submit',
      '--actor', 'owner-a',
      '--json'
    ]);
    expect(result.status).toBe(0);
    const submitPayload = JSON.parse(`${result.stdout}`.trim());
    expect(submitPayload.state.status).toBe('submitted');

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-a',
      '--json'
    ]);
    expect(result.status).toBe(2);
    const blockedPayload = JSON.parse(`${result.stdout}`.trim());
    expect(blockedPayload.decision).toBe('blocked');
    expect(blockedPayload.reason).toContain('approval required');
    expect(blockedPayload.state.status).toBe('submitted');
  });

  test('supports full lifecycle for low-risk plan without approval', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-approval-workflow.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = await writePlan(workspace, 'plan-low.json', {
      plan_id: 'plan-low-001',
      intent_id: 'intent-low-001',
      risk_level: 'low',
      actions: [
        {
          action_id: 'act-001',
          type: 'analysis_only',
          requires_privilege_escalation: false
        }
      ],
      approval: {
        status: 'not-required'
      }
    });

    const sequence = [
      ['init', 0, 'draft'],
      ['submit', 0, 'submitted'],
      ['execute', 0, 'executed'],
      ['verify', 0, 'verified'],
      ['archive', 0, 'archived']
    ];

    for (const [action, expectedCode, expectedStatus] of sequence) {
      const args = ['--action', action, '--actor', 'owner-b', '--json'];
      if (action === 'init') {
        args.push('--plan', planFile);
      }
      const result = runScript(scriptPath, workspace, args);
      expect(result.status).toBe(expectedCode);
      const payload = JSON.parse(`${result.stdout}`.trim());
      expect(payload.state.status).toBe(expectedStatus);
    }

    const stateFile = path.join(workspace, '.kiro', 'reports', 'interactive-approval-state.json');
    const auditFile = path.join(workspace, '.kiro', 'reports', 'interactive-approval-events.jsonl');
    expect(await fs.pathExists(stateFile)).toBe(true);
    expect(await fs.pathExists(auditFile)).toBe(true);
    const auditLines = (await fs.readFile(auditFile, 'utf8'))
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    expect(auditLines.length).toBe(5);
  });

  test('validates invalid transitions (approve before submit)', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-approval-workflow.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = await writePlan(workspace, 'plan-medium.json', {
      plan_id: 'plan-medium-001',
      intent_id: 'intent-medium-001',
      risk_level: 'medium',
      actions: [
        {
          action_id: 'act-001',
          type: 'update_rule_threshold',
          requires_privilege_escalation: false
        }
      ],
      approval: {
        status: 'not-required'
      }
    });

    let result = runScript(scriptPath, workspace, [
      '--action', 'init',
      '--plan', planFile,
      '--actor', 'owner-c',
      '--json'
    ]);
    expect(result.status).toBe(0);

    result = runScript(scriptPath, workspace, [
      '--action', 'approve',
      '--actor', 'owner-c',
      '--json'
    ]);
    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('blocked');
    expect(payload.reason).toContain('cannot approve');
    expect(payload.state.status).toBe('draft');
  });

  test('requires password authorization for execute when plan marks password_required', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-approval-workflow.js');
    const workspace = path.join(tempDir, 'workspace-auth');
    const passwordHash = crypto.createHash('sha256').update('demo-pass').digest('hex');
    const planFile = await writePlan(workspace, 'plan-auth.json', {
      plan_id: 'plan-auth-001',
      intent_id: 'intent-auth-001',
      risk_level: 'low',
      execution_mode: 'apply',
      actions: [
        {
          action_id: 'act-001',
          type: 'ui_form_field_adjust',
          requires_privilege_escalation: false
        }
      ],
      approval: {
        status: 'not-required'
      },
      authorization: {
        password_required: true,
        password_scope: ['execute'],
        password_hash: passwordHash,
        password_ttl_seconds: 600
      }
    });

    let result = runScript(scriptPath, workspace, [
      '--action', 'init',
      '--plan', planFile,
      '--actor', 'owner-auth',
      '--json'
    ]);
    expect(result.status).toBe(0);

    result = runScript(scriptPath, workspace, [
      '--action', 'submit',
      '--actor', 'owner-auth',
      '--json'
    ]);
    expect(result.status).toBe(0);

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-auth',
      '--json'
    ]);
    expect(result.status).toBe(2);
    let payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.reason).toContain('password authorization required');

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-auth',
      '--password', 'bad-pass',
      '--json'
    ]);
    expect(result.status).toBe(2);
    payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.reason).toContain('password authorization failed');

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-auth',
      '--password', 'demo-pass',
      '--json'
    ]);
    expect(result.status).toBe(0);
    payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.state.status).toBe('executed');
    expect(payload.authorization.password_verified).toBe(true);
  });

  test('enforces actor role policy when role-policy is configured', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-approval-workflow.js');
    const workspace = path.join(tempDir, 'workspace-role-policy');
    const passwordHash = crypto.createHash('sha256').update('demo-pass').digest('hex');
    const planFile = await writePlan(workspace, 'plan-role.json', {
      plan_id: 'plan-role-001',
      intent_id: 'intent-role-001',
      risk_level: 'low',
      execution_mode: 'apply',
      actions: [
        {
          action_id: 'act-001',
          type: 'ui_form_field_adjust',
          requires_privilege_escalation: false
        }
      ],
      approval: {
        status: 'not-required'
      },
      authorization: {
        password_required: true,
        password_scope: ['execute'],
        password_hash: passwordHash,
        password_ttl_seconds: 600
      }
    });
    const rolePolicyFile = path.join(workspace, 'approval-role-policy.json');
    await fs.writeJson(rolePolicyFile, {
      version: '1.0.0',
      role_requirements: {
        submit: ['product-owner'],
        execute: ['release-operator']
      }
    }, { spaces: 2 });

    let result = runScript(scriptPath, workspace, [
      '--action', 'init',
      '--plan', planFile,
      '--actor', 'owner-role',
      '--actor-role', 'product-owner',
      '--role-policy', rolePolicyFile,
      '--json'
    ]);
    expect(result.status).toBe(0);

    result = runScript(scriptPath, workspace, [
      '--action', 'submit',
      '--actor', 'owner-role',
      '--json'
    ]);
    expect(result.status).toBe(2);
    let payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.reason).toContain('actor role required for submit');

    result = runScript(scriptPath, workspace, [
      '--action', 'submit',
      '--actor', 'owner-role',
      '--actor-role', 'product-owner',
      '--json'
    ]);
    expect(result.status).toBe(0);

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-role',
      '--actor-role', 'product-owner',
      '--password', 'demo-pass',
      '--json'
    ]);
    expect(result.status).toBe(2);
    payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.reason).toContain('not allowed for execute');

    result = runScript(scriptPath, workspace, [
      '--action', 'execute',
      '--actor', 'owner-role',
      '--actor-role', 'release-operator',
      '--password', 'demo-pass',
      '--json'
    ]);
    expect(result.status).toBe(0);
    payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.state.status).toBe('executed');
  });
});
