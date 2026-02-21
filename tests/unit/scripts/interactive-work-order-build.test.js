const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-work-order-build script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-work-order-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-work-order-build.js');
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

  async function writeInputs(workspace, overrides = {}) {
    const dialoguePath = path.join(workspace, 'dialogue.json');
    const intentPath = path.join(workspace, 'intent.json');
    const planPath = path.join(workspace, 'plan.json');
    const gatePath = path.join(workspace, 'gate.json');
    const runtimePath = path.join(workspace, 'runtime.json');
    const approvalStatePath = path.join(workspace, 'approval-state.json');

    await fs.writeJson(dialoguePath, {
      decision: 'allow',
      reasons: []
    }, { spaces: 2 });
    await fs.writeJson(intentPath, {
      intent_id: 'intent-1',
      business_goal: 'Adjust order screen field layout for clearer input flow'
    }, { spaces: 2 });
    await fs.writeJson(planPath, {
      plan_id: 'plan-1',
      intent_id: 'intent-1',
      risk_level: 'low',
      scope: {
        product: 'moqui-suite',
        module: 'order',
        page: 'OrderEntry',
        entity: 'OrderHeader',
        scene_id: 'scene-order-entry'
      },
      actions: [
        {
          action_id: 'act-1',
          type: 'ui_form_field_adjust',
          touches_sensitive_data: false,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      verification_checks: ['ui field rendering smoke'],
      rollback_plan: {
        type: 'config-revert',
        reference: 'snapshot-1',
        note: 'revert config'
      }
    }, { spaces: 2 });
    await fs.writeJson(gatePath, {
      decision: 'allow'
    }, { spaces: 2 });
    await fs.writeJson(runtimePath, {
      decision: 'allow',
      runtime_mode: 'ops-fix',
      runtime_environment: 'staging',
      requirements: {
        require_work_order: true
      }
    }, { spaces: 2 });
    await fs.writeJson(approvalStatePath, {
      workflow_id: 'wf-1',
      status: 'approved'
    }, { spaces: 2 });

    return {
      dialoguePath,
      intentPath,
      planPath,
      gatePath,
      runtimePath,
      approvalStatePath,
      ...overrides
    };
  }

  test('builds completed work-order for successful execution', async () => {
    const workspace = path.join(tempDir, 'workspace-completed');
    await fs.ensureDir(workspace);
    const inputs = await writeInputs(workspace);

    const result = runScript(workspace, [
      '--dialogue', inputs.dialoguePath,
      '--intent', inputs.intentPath,
      '--plan', inputs.planPath,
      '--gate', inputs.gatePath,
      '--runtime', inputs.runtimePath,
      '--approval-state', inputs.approvalStatePath,
      '--session-id', 'session-1',
      '--execution-attempted',
      '--execution-result', 'success',
      '--execution-id', 'exec-1',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-work-order-build');
    expect(payload.work_order.status).toBe('completed');
    expect(payload.work_order.execution.execution_id).toBe('exec-1');
    expect(payload.work_order.runtime.mode).toBe('ops-fix');
  });

  test('builds blocked work-order when gate/runtime deny', async () => {
    const workspace = path.join(tempDir, 'workspace-blocked');
    await fs.ensureDir(workspace);
    const inputs = await writeInputs(workspace);
    await fs.writeJson(inputs.gatePath, { decision: 'deny' }, { spaces: 2 });
    await fs.writeJson(inputs.runtimePath, {
      decision: 'deny',
      runtime_mode: 'user-assist',
      runtime_environment: 'staging',
      requirements: { require_work_order: true }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--dialogue', inputs.dialoguePath,
      '--intent', inputs.intentPath,
      '--plan', inputs.planPath,
      '--gate', inputs.gatePath,
      '--runtime', inputs.runtimePath,
      '--approval-state', inputs.approvalStatePath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.work_order.status).toBe('blocked');
    expect(payload.work_order.priority).toBe('high');
  });
});
