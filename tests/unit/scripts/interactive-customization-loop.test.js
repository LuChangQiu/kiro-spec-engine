const fs = require('fs-extra');
const os = require('os');
const path = require('path');
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

    return { policyPath, catalogPath };
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
    expect(payload.gate.decision).toBe('allow');
    expect(payload.summary.status).toBe('ready-for-apply');
    expect(payload.execution.attempted).toBe(false);

    const summaryFile = path.join(workspace, payload.artifacts.summary_json);
    expect(await fs.pathExists(summaryFile)).toBe(true);
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
});
