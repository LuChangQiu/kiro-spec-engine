const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-moqui-adapter script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-moqui-adapter-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-moqui-adapter.js');
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

  async function writePolicyBundle(workspace) {
    const docsDir = path.join(workspace, 'docs', 'interactive-customization');
    await fs.ensureDir(docsDir);

    await fs.writeJson(path.join(docsDir, 'guardrail-policy-baseline.json'), {
      version: '1.0.0',
      mode: 'advice-first',
      approval_policy: {
        require_approval_for_risk_levels: ['high'],
        max_actions_without_approval: 5,
        require_dual_approval_for_privilege_escalation: true
      },
      security_policy: {
        require_masking_when_sensitive_data: true,
        forbid_plaintext_secrets: true,
        require_backup_for_irreversible_actions: true
      },
      catalog_policy: {
        catalog_file: 'docs/interactive-customization/high-risk-action-catalog.json'
      }
    }, { spaces: 2 });

    await fs.writeJson(path.join(docsDir, 'high-risk-action-catalog.json'), {
      version: '1.0.0',
      catalog: {
        deny_action_types: ['credential_export'],
        review_required_action_types: ['workflow_approval_chain_change']
      }
    }, { spaces: 2 });
  }

  test('returns capability contract', async () => {
    const workspace = path.join(tempDir, 'workspace-capabilities');
    await fs.ensureDir(workspace);

    const result = runScript(workspace, ['--action', 'capabilities', '--json']);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-moqui-adapter');
    expect(payload.payload.capabilities.adapter_type).toBe('moqui-interactive-adapter');
    expect(payload.payload.capabilities.interfaces).toEqual(
      expect.arrayContaining(['capabilities', 'plan', 'validate', 'apply', 'rollback'])
    );
  });

  test('builds plan and validates allow decision for low risk intent', async () => {
    const workspace = path.join(tempDir, 'workspace-plan-validate');
    await writePolicyBundle(workspace);

    const intentFile = path.join(workspace, 'intent.json');
    const planFile = path.join(workspace, 'plan.json');
    await fs.writeJson(intentFile, {
      intent_id: 'intent-low-001',
      user_id: 'demo-user',
      business_goal: 'Adjust order screen field layout for clearer input flow',
      context_ref: {
        product: 'moqui-experiment',
        module: 'order',
        page: 'OrderEntry',
        entity: 'OrderHeader',
        scene_id: 'scene-order-entry'
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    let result = runScript(workspace, [
      '--action', 'plan',
      '--intent', intentFile,
      '--execution-mode', 'suggestion',
      '--out-plan', planFile,
      '--json'
    ]);
    expect(result.status).toBe(0);
    const planPayload = JSON.parse(`${result.stdout}`.trim());
    expect(planPayload.payload.plan.plan_id).toMatch(/^plan-/);
    expect(planPayload.payload.plan.risk_level).toBe('low');

    result = runScript(workspace, [
      '--action', 'validate',
      '--plan', planFile,
      '--json'
    ]);
    expect(result.status).toBe(0);
    const validatePayload = JSON.parse(`${result.stdout}`.trim());
    expect(validatePayload.payload.validation.decision).toBe('allow');
  });

  test('blocks apply when policy decision is deny', async () => {
    const workspace = path.join(tempDir, 'workspace-apply-deny');
    await writePolicyBundle(workspace);

    const planFile = path.join(workspace, 'plan-deny.json');
    await fs.writeJson(planFile, {
      plan_id: 'plan-deny-001',
      intent_id: 'intent-deny-001',
      risk_level: 'high',
      execution_mode: 'apply',
      actions: [
        {
          action_id: 'act-001',
          type: 'credential_export',
          touches_sensitive_data: true,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      approval: {
        status: 'pending',
        dual_approved: false
      },
      security: {
        masking_applied: false,
        plaintext_secrets_in_payload: true
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--action', 'apply',
      '--plan', planFile,
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.payload.execution_record.result).toBe('failed');
    expect(payload.payload.execution_record.policy_decision).toBe('deny');
  });

  test('low-risk-apply blocks medium-risk plan even when gate is allow', async () => {
    const workspace = path.join(tempDir, 'workspace-low-risk-apply-blocked');
    await writePolicyBundle(workspace);

    const planFile = path.join(workspace, 'plan-medium.json');
    await fs.writeJson(planFile, {
      plan_id: 'plan-medium-001',
      intent_id: 'intent-medium-001',
      risk_level: 'medium',
      execution_mode: 'apply',
      actions: [
        {
          action_id: 'act-001',
          type: 'update_rule_threshold',
          touches_sensitive_data: false,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      approval: {
        status: 'not-required',
        dual_approved: false
      },
      security: {
        masking_applied: false,
        plaintext_secrets_in_payload: false
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--action', 'low-risk-apply',
      '--plan', planFile,
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.payload.execution_record.result).toBe('skipped');
    expect(payload.payload.reason).toContain('low-risk apply');
  });

  test('applies low risk plan and supports rollback by execution id', async () => {
    const workspace = path.join(tempDir, 'workspace-apply-rollback');
    await writePolicyBundle(workspace);

    const planFile = path.join(workspace, 'plan-allow.json');
    await fs.writeJson(planFile, {
      plan_id: 'plan-allow-001',
      intent_id: 'intent-allow-001',
      risk_level: 'low',
      execution_mode: 'apply',
      actions: [
        {
          action_id: 'act-001',
          type: 'analysis_only',
          touches_sensitive_data: false,
          requires_privilege_escalation: false,
          irreversible: false
        }
      ],
      approval: {
        status: 'not-required',
        dual_approved: false
      },
      security: {
        masking_applied: false,
        plaintext_secrets_in_payload: false
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    let result = runScript(workspace, [
      '--action', 'apply',
      '--plan', planFile,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const applyPayload = JSON.parse(`${result.stdout}`.trim());
    expect(applyPayload.payload.execution_record.result).toBe('success');
    const executionId = applyPayload.payload.execution_record.execution_id;
    expect(executionId).toMatch(/^exec-/);

    result = runScript(workspace, [
      '--action', 'rollback',
      '--execution-id', executionId,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const rollbackPayload = JSON.parse(`${result.stdout}`.trim());
    expect(rollbackPayload.payload.execution_record.result).toBe('rolled-back');
    expect(rollbackPayload.payload.execution_record.rollback_ref).toBe(executionId);

    const ledgerFile = path.join(
      workspace,
      '.kiro',
      'reports',
      'interactive-execution-ledger.jsonl'
    );
    expect(await fs.pathExists(ledgerFile)).toBe(true);
    const lines = (await fs.readFile(ledgerFile, 'utf8'))
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
