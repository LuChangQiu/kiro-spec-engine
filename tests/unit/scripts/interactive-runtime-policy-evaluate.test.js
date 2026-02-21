const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-runtime-policy-evaluate script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-runtime-policy-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-runtime-policy-evaluate.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  async function writePolicy(workspace) {
    const policyPath = path.join(workspace, 'runtime-policy.json');
    await fs.writeJson(policyPath, {
      version: '1.0.0',
      defaults: {
        runtime_mode: 'ops-fix',
        runtime_environment: 'staging'
      },
      modes: {
        'user-assist': {
          allow_execution_modes: ['suggestion', 'apply'],
          allow_mutating_apply: false,
          deny_action_types: ['credential_export'],
          review_required_action_types: ['workflow_approval_chain_change'],
          require_work_order: true
        },
        'ops-fix': {
          allow_execution_modes: ['suggestion', 'apply'],
          allow_mutating_apply: true,
          deny_action_types: ['credential_export'],
          review_required_action_types: ['workflow_approval_chain_change'],
          require_work_order: true
        }
      },
      ui_modes: {
        'user-app': {
          allow_runtime_modes: ['user-assist', 'ops-fix'],
          allow_execution_modes: ['suggestion'],
          deny_execution_modes: ['apply']
        },
        'ops-console': {
          allow_runtime_modes: ['ops-fix'],
          allow_execution_modes: ['suggestion', 'apply']
        }
      },
      environments: {
        staging: {
          allow_live_apply: true,
          require_dry_run_before_live_apply: true,
          require_password_for_apply_mutations: true,
          require_approval_for_risk_levels: ['medium', 'high'],
          max_risk_level_for_apply: 'high',
          max_auto_execute_risk_level: 'low',
          manual_review_required_for_apply: false
        }
      }
    }, { spaces: 2 });
    return policyPath;
  }

  async function writePlan(workspace, overrides = {}) {
    const planPath = path.join(workspace, 'plan.json');
    await fs.writeJson(planPath, {
      plan_id: 'plan-demo',
      execution_mode: 'apply',
      risk_level: 'low',
      actions: [
        {
          action_id: 'act-1',
          type: 'ui_form_field_adjust',
          touches_sensitive_data: false,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      approval: {
        status: 'approved'
      },
      authorization: {
        password_required: true
      },
      ...overrides
    }, { spaces: 2 });
    return planPath;
  }

  test('returns allow for low-risk apply in ops-fix mode', async () => {
    const workspace = path.join(tempDir, 'workspace-allow');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);
    const planPath = await writePlan(workspace);

    const result = runScript(workspace, [
      '--plan', planPath,
      '--policy', policyPath,
      '--ui-mode', 'ops-console',
      '--runtime-mode', 'ops-fix',
      '--runtime-environment', 'staging',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-runtime-policy-evaluate');
    expect(payload.decision).toBe('allow');
    expect(payload.requirements.auto_execute_allowed).toBe(true);
  });

  test('returns review-required for review action type', async () => {
    const workspace = path.join(tempDir, 'workspace-review');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);
    const planPath = await writePlan(workspace, {
      risk_level: 'medium',
      actions: [
        {
          action_id: 'act-1',
          type: 'workflow_approval_chain_change',
          touches_sensitive_data: false,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      approval: {
        status: 'pending'
      }
    });

    const result = runScript(workspace, [
      '--plan', planPath,
      '--policy', policyPath,
      '--runtime-mode', 'ops-fix',
      '--runtime-environment', 'staging',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('review-required');
    expect(payload.violations.some(item => item.code === 'review-action-type-hit')).toBe(true);
  });

  test('returns deny and exits 2 with fail-on-non-allow', async () => {
    const workspace = path.join(tempDir, 'workspace-deny');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);
    const planPath = await writePlan(workspace);

    const result = runScript(workspace, [
      '--plan', planPath,
      '--policy', policyPath,
      '--runtime-mode', 'user-assist',
      '--runtime-environment', 'staging',
      '--fail-on-non-allow',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.violations.some(item => item.code === 'mutating-apply-not-allowed')).toBe(true);
  });

  test('returns deny when ui mode disallows apply execution', async () => {
    const workspace = path.join(tempDir, 'workspace-ui-mode-apply-deny');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);
    const planPath = await writePlan(workspace);

    const result = runScript(workspace, [
      '--plan', planPath,
      '--policy', policyPath,
      '--ui-mode', 'user-app',
      '--runtime-mode', 'ops-fix',
      '--runtime-environment', 'staging',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.violations.some(item => item.code === 'ui-mode-execution-mode-denied')).toBe(true);
  });

  test('returns deny when ui mode disallows runtime mode', async () => {
    const workspace = path.join(tempDir, 'workspace-ui-mode-runtime-deny');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);
    const planPath = await writePlan(workspace, {
      execution_mode: 'suggestion',
      approval: {
        status: 'not-required'
      }
    });

    const result = runScript(workspace, [
      '--plan', planPath,
      '--policy', policyPath,
      '--ui-mode', 'ops-console',
      '--runtime-mode', 'user-assist',
      '--runtime-environment', 'staging',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.violations.some(item => item.code === 'ui-mode-runtime-mode-not-allowed')).toBe(true);
  });
});
