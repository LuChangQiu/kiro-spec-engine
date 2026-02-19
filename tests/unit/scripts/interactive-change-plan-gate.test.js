const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-change-plan-gate script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-plan-gate-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  async function writePolicyBundle(workspace, policyOverrides = {}, catalogOverrides = {}) {
    const docsDir = path.join(workspace, 'docs', 'interactive-customization');
    const policyFile = path.join(docsDir, 'guardrail-policy-baseline.json');
    const catalogFile = path.join(docsDir, 'high-risk-action-catalog.json');
    await fs.ensureDir(docsDir);

    await fs.writeJson(policyFile, {
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
      },
      ...policyOverrides
    }, { spaces: 2 });

    await fs.writeJson(catalogFile, {
      version: '1.0.0',
      catalog: {
        deny_action_types: ['credential_export'],
        review_required_action_types: ['workflow_approval_chain_change']
      },
      ...catalogOverrides
    }, { spaces: 2 });

    return { policyFile, catalogFile };
  }

  test('returns allow when plan passes baseline checks', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-change-plan-gate.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = path.join(workspace, 'change-plan.json');

    await writePolicyBundle(workspace);
    await fs.writeJson(planFile, {
      plan_id: 'plan-1',
      intent_id: 'intent-1',
      risk_level: 'low',
      actions: [
        {
          action_id: 'a-1',
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

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--plan', planFile, '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-change-plan-gate');
    expect(payload.decision).toBe('allow');
    expect(payload.summary.failed_total).toBe(0);
  });

  test('returns review-required and exits 2 with --fail-on-non-allow', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-change-plan-gate.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = path.join(workspace, 'change-plan.json');

    await writePolicyBundle(workspace);
    await fs.writeJson(planFile, {
      plan_id: 'plan-2',
      intent_id: 'intent-2',
      risk_level: 'high',
      actions: [
        {
          action_id: 'a-2',
          type: 'workflow_approval_chain_change',
          touches_sensitive_data: false,
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
        plaintext_secrets_in_payload: false
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--plan', planFile, '--fail-on-non-allow', '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('review-required');
    expect(payload.failed_review_checks).toEqual(expect.arrayContaining([
      'risk-approval',
      'review-action-types'
    ]));
  });

  test('returns deny when blocked actions or security violations are present', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-change-plan-gate.js');
    const workspace = path.join(tempDir, 'workspace');
    const planFile = path.join(workspace, 'change-plan.json');

    await writePolicyBundle(workspace);
    await fs.writeJson(planFile, {
      plan_id: 'plan-3',
      intent_id: 'intent-3',
      risk_level: 'medium',
      actions: [
        {
          action_id: 'a-3',
          type: 'credential_export',
          touches_sensitive_data: true,
          requires_privilege_escalation: false,
          irreversible: true
        }
      ],
      approval: {
        status: 'approved',
        dual_approved: false
      },
      security: {
        masking_applied: false,
        plaintext_secrets_in_payload: true,
        backup_reference: ''
      },
      created_at: '2026-02-19T00:00:00.000Z'
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--plan', planFile, '--fail-on-block', '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.failed_deny_checks).toEqual(expect.arrayContaining([
      'deny-action-types',
      'sensitive-data-masking',
      'plaintext-secrets',
      'irreversible-backup'
    ]));
  });
});
