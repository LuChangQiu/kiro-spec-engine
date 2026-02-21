const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

describe('interactive-customization-loop script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-loop-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-customization-loop.js');
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

    const policyPath = path.join(docsDir, 'guardrail-policy-baseline.json');
    const catalogPath = path.join(docsDir, 'high-risk-action-catalog.json');
    const runtimePolicyPath = path.join(docsDir, 'runtime-mode-policy-baseline.json');
    const approvalRolePolicyPath = path.join(docsDir, 'approval-role-policy-baseline.json');

    await fs.writeJson(policyPath, {
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

    await fs.writeJson(catalogPath, {
      version: '1.0.0',
      catalog: {
        deny_action_types: ['credential_export'],
        review_required_action_types: ['workflow_approval_chain_change']
      }
    }, { spaces: 2 });

    await fs.writeJson(runtimePolicyPath, {
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
        },
        'feature-dev': {
          allow_execution_modes: ['suggestion', 'apply'],
          allow_mutating_apply: true,
          deny_action_types: ['credential_export'],
          review_required_action_types: ['workflow_approval_chain_change'],
          require_work_order: true
        }
      },
      environments: {
        dev: {
          allow_live_apply: true,
          require_dry_run_before_live_apply: false,
          require_password_for_apply_mutations: true,
          require_approval_for_risk_levels: ['high'],
          max_risk_level_for_apply: 'high',
          max_auto_execute_risk_level: 'medium',
          manual_review_required_for_apply: false
        },
        staging: {
          allow_live_apply: true,
          require_dry_run_before_live_apply: true,
          require_password_for_apply_mutations: true,
          require_approval_for_risk_levels: ['medium', 'high'],
          max_risk_level_for_apply: 'high',
          max_auto_execute_risk_level: 'low',
          manual_review_required_for_apply: false
        },
        prod: {
          allow_live_apply: false,
          require_dry_run_before_live_apply: true,
          require_password_for_apply_mutations: true,
          require_approval_for_risk_levels: ['medium', 'high'],
          max_risk_level_for_apply: 'medium',
          max_auto_execute_risk_level: 'low',
          manual_review_required_for_apply: true
        }
      }
    }, { spaces: 2 });

    await fs.writeJson(approvalRolePolicyPath, {
      version: '1.0.0',
      role_requirements: {
        submit: ['product-owner'],
        approve: ['product-owner', 'security-admin'],
        execute: ['release-operator'],
        verify: ['qa-owner']
      }
    }, { spaces: 2 });

    return { policyPath, catalogPath, runtimePolicyPath, approvalRolePolicyPath };
  }

  async function writeContext(workspace) {
    const contextPath = path.join(workspace, 'page-context.json');
    await fs.writeJson(contextPath, {
      product: 'moqui-suite',
      module: 'order',
      page: 'OrderEntry',
      entity: 'OrderHeader',
      scene_id: 'scene-order-entry',
      workflow_node: 'approval-check',
      fields: [
        { name: 'orderId', type: 'string', sensitive: false },
        { name: 'note', type: 'string', sensitive: false }
      ]
    }, { spaces: 2 });
    return contextPath;
  }

  async function writeContextContract(workspace) {
    const contractPath = path.join(workspace, 'context-contract.json');
    await fs.writeJson(contractPath, {
      version: '1.1.0',
      context_contract: {
        required_fields: ['product', 'module', 'page'],
        max_payload_kb: 128
      },
      security_contract: {
        forbidden_keys: ['private_key']
      }
    }, { spaces: 2 });
    return contractPath;
  }

  test('runs end-to-end loop and returns ready-for-apply summary', async () => {
    const workspace = path.join(tempDir, 'workspace-basic-loop');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-customization-loop');
    expect(payload.dialogue.decision).toBe('allow');
    expect(payload.gate.decision).toBe('allow');
    expect(payload.runtime.decision).toBe('allow');
    expect(payload.work_order).toBeTruthy();
    expect(payload.summary.status).toBe('ready-for-apply');
    expect(payload.execution.attempted).toBe(false);

    const summaryFile = path.join(workspace, payload.artifacts.summary_json);
    const runtimeFile = path.join(workspace, payload.artifacts.runtime_json);
    const workOrderFile = path.join(workspace, payload.artifacts.work_order_json);
    expect(await fs.pathExists(summaryFile)).toBe(true);
    expect(await fs.pathExists(runtimeFile)).toBe(true);
    expect(await fs.pathExists(workOrderFile)).toBe(true);
  });

  test('auto executes low-risk path in apply mode', async () => {
    const workspace = path.join(tempDir, 'workspace-auto-exec');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--auto-execute-low-risk',
      '--auth-password-hash', crypto.createHash('sha256').update('demo-pass').digest('hex'),
      '--auth-password', 'demo-pass',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.execution.attempted).toBe(true);
    expect(payload.execution.blocked).toBe(false);
    expect(payload.execution.result).toBe('success');
    expect(payload.summary.status).toBe('completed');
    expect(payload.approval.authorization.password_required).toBe(true);
    expect(payload.approval.authorization.password_verified).toBe(true);

    const adapterOutput = path.join(workspace, payload.artifacts.adapter_json);
    expect(await fs.pathExists(adapterOutput)).toBe(true);
  });

  test('fails with exit code 2 when gate is non-allow and fail flag is enabled', async () => {
    const workspace = path.join(tempDir, 'workspace-gate-fail');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Export credential secret token dump for operations troubleshooting',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--fail-on-gate-non-allow',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.gate.decision).toBe('deny');
    expect(payload.summary.status).toBe('blocked');
  });

  test('logs feedback into session feedback file when score is provided', async () => {
    const workspace = path.join(tempDir, 'workspace-feedback');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--auto-execute-low-risk',
      '--auth-password-hash', crypto.createHash('sha256').update('demo-pass').digest('hex'),
      '--auth-password', 'demo-pass',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--feedback-score', '4.5',
      '--feedback-comment', 'Flow is clearer and safer now.',
      '--feedback-tags', 'moqui,ux',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.feedback.requested).toBe(true);
    expect(payload.feedback.logged).toBe(true);
    expect(payload.feedback.score).toBe(4.5);
    expect(payload.feedback.feedback_id).toMatch(/^feedback-/);

    const feedbackFile = path.join(workspace, payload.artifacts.feedback_jsonl);
    const globalFeedbackFile = path.join(workspace, payload.artifacts.feedback_global_jsonl);
    expect(await fs.pathExists(feedbackFile)).toBe(true);
    expect(await fs.pathExists(globalFeedbackFile)).toBe(true);
    const lines = (await fs.readFile(feedbackFile, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const globalLines = (await fs.readFile(globalFeedbackFile, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(globalLines.length).toBeGreaterThanOrEqual(1);
    const feedbackRecord = JSON.parse(lines[0]);
    const globalFeedbackRecord = JSON.parse(globalLines[globalLines.length - 1]);
    expect(feedbackRecord.score).toBe(4.5);
    expect(feedbackRecord.user_id).toBe('biz-user');
    expect(feedbackRecord.tags).toEqual(expect.arrayContaining(['moqui', 'ux']));
    expect(globalFeedbackRecord.feedback_id).toBe(feedbackRecord.feedback_id);
  });

  test('allows non-strict contract mode and surfaces intent contract issues', async () => {
    const workspace = path.join(tempDir, 'workspace-non-strict-contract');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);
    const contractPath = await writeContextContract(workspace);

    const rawContext = await fs.readJson(contextPath);
    rawContext.current_state = {
      private_key: 'should-trigger-contract-issue'
    };
    await fs.writeJson(contextPath, rawContext, { spaces: 2 });

    const result = runScript(workspace, [
      '--context', contextPath,
      '--context-contract', contractPath,
      '--no-strict-contract',
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('ready-for-apply');
    expect(Array.isArray(payload.steps)).toBe(true);
    const intentStep = payload.steps.find(step => step && step.name === 'intent');
    expect(intentStep).toBeTruthy();
    expect(intentStep.payload.contract_validation.valid).toBe(false);
    expect(intentStep.payload.contract_validation.issues.length).toBeGreaterThan(0);
  });

  test('fails with exit code 2 when runtime policy is non-allow and fail flag is enabled', async () => {
    const workspace = path.join(tempDir, 'workspace-runtime-fail');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--runtime-mode', 'user-assist',
      '--runtime-environment', 'staging',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--fail-on-runtime-non-allow',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.runtime.decision).toBe('deny');
    expect(payload.summary.status).toBe('blocked');
  });

  test('blocks auto execute when approver role is not allowed by role policy', async () => {
    const workspace = path.join(tempDir, 'workspace-role-block');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath, approvalRolePolicyPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--auto-approve-low-risk',
      '--auto-execute-low-risk',
      '--approval-role-policy', approvalRolePolicyPath,
      '--approval-actor-role', 'product-owner',
      '--approver-actor-role', 'product-owner',
      '--auth-password-hash', crypto.createHash('sha256').update('demo-pass').digest('hex'),
      '--auth-password', 'demo-pass',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--fail-on-execute-blocked',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('apply-blocked');
    expect(payload.summary.execution_block_reason_category).toBe('role-policy');
    expect(payload.summary.execution_block_remediation_hint).toContain('actor role');
    expect(payload.execution.attempted).toBe(true);
    expect(payload.execution.blocked).toBe(true);
    expect(payload.execution.reason).toContain('not allowed for execute');
    expect(payload.approval.authorization.role_requirements.execute).toEqual(['release-operator']);
    expect(payload.summary.next_actions).toEqual(expect.arrayContaining([
      expect.stringContaining('--approval-role-policy'),
      expect.stringContaining('--approver-actor-role')
    ]));
  });

  test('categorizes password authorization block and emits remediation hint', async () => {
    const workspace = path.join(tempDir, 'workspace-password-block');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const contextPath = await writeContext(workspace);

    const result = runScript(workspace, [
      '--context', contextPath,
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--auto-execute-low-risk',
      '--auth-password-hash', crypto.createHash('sha256').update('demo-pass').digest('hex'),
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('apply-blocked');
    expect(payload.execution.blocked).toBe(true);
    expect(payload.execution.reason).toContain('password authorization required');
    expect(payload.summary.execution_block_reason_category).toBe('password-authorization');
    expect(payload.summary.execution_block_remediation_hint).toContain('password authorization');
    expect(payload.summary.next_actions).toEqual(expect.arrayContaining([
      expect.stringContaining('--auth-password')
    ]));
  });
});
