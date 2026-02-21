const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

describe('interactive-flow script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-flow-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-flow.js');
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

  async function writeProviderPayload(workspace) {
    const payloadPath = path.join(workspace, 'moqui-context-provider.json');
    await fs.writeJson(payloadPath, {
      product: 'moqui-suite',
      workspace: {
        module: 'order',
        page: 'OrderEntry',
        scene: {
          id: 'scene-order-entry',
          name: 'Order Entry',
          type: 'screen-analysis',
          workflow_node: 'approval-check'
        },
        screen_explorer: {
          active_tab: 'Overview',
          selected_screen: 'OrderEntry',
          selected_component: 'Form',
          filters: ['AI Components'],
          result_total: 1
        },
        ontology: {
          entities: ['OrderHeader'],
          relations: ['OrderHeader_has_OrderItem'],
          business_rules: ['order_amount_threshold'],
          decision_policies: ['approval_routing_policy']
        }
      },
      fields: [
        { name: 'orderId', type: 'string' },
        { name: 'note', type: 'string' }
      ],
      current_state: {
        orderId: 'OH10001'
      },
      assistant: {
        sessionId: 'session-1771',
        model: 'Spec-Expert'
      }
    }, { spaces: 2 });
    return payloadPath;
  }

  test('runs bridge + loop flow and returns ready-for-apply summary', async () => {
    const workspace = path.join(tempDir, 'workspace-basic-flow');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const payloadPath = await writeProviderPayload(workspace);

    const result = runScript(workspace, [
      '--input', payloadPath,
      '--provider', 'moqui',
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--user-id', 'biz-user',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-flow');
    expect(payload.pipeline.bridge.exit_code).toBe(0);
    expect(payload.pipeline.loop.exit_code).toBe(0);
    expect(payload.pipeline.matrix.enabled).toBe(true);
    expect(payload.pipeline.matrix.exit_code).toBe(0);
    expect(payload.pipeline.matrix.status).toBe('completed');
    expect(payload.summary.status).toBe('ready-for-apply');
    expect(payload.summary.dialogue_decision).toBe('allow');
    expect(payload.summary.matrix_status).toBe('completed');

    const bridgeContextFile = path.join(workspace, payload.artifacts.bridge_context_json);
    const flowSummaryFile = path.join(workspace, payload.artifacts.flow_summary_json);
    const matrixSummaryFile = path.join(workspace, payload.artifacts.matrix_summary_json);
    const matrixMarkdownFile = path.join(workspace, payload.artifacts.matrix_summary_markdown);
    const matrixSignalFile = path.join(workspace, payload.artifacts.matrix_signal_json);
    const matrixSignalsFile = path.join(workspace, payload.artifacts.matrix_signals_jsonl);
    expect(await fs.pathExists(bridgeContextFile)).toBe(true);
    expect(await fs.pathExists(flowSummaryFile)).toBe(true);
    expect(await fs.pathExists(matrixSummaryFile)).toBe(true);
    expect(await fs.pathExists(matrixMarkdownFile)).toBe(true);
    expect(await fs.pathExists(matrixSignalFile)).toBe(true);
    expect(await fs.pathExists(matrixSignalsFile)).toBe(true);

    const signals = (await fs.readFile(matrixSignalsFile, 'utf8'))
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => JSON.parse(line));
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[signals.length - 1].session_id).toBe(payload.session_id);
  });

  test('supports low-risk auto execute in apply mode', async () => {
    const workspace = path.join(tempDir, 'workspace-apply-flow');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const payloadPath = await writeProviderPayload(workspace);

    const result = runScript(workspace, [
      '--input', payloadPath,
      '--provider', 'moqui',
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--execution-mode', 'apply',
      '--auto-execute-low-risk',
      '--auth-password-hash', crypto.createHash('sha256').update('demo-pass').digest('hex'),
      '--auth-password', 'demo-pass',
      '--feedback-score', '5',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.status).toBe('completed');
    expect(payload.summary.execution_result).toBe('success');
    expect(payload.summary.authorization_password_verified).toBe(true);
    expect(payload.pipeline.loop.payload.feedback.logged).toBe(true);
  });

  test('allows disabling matrix stage explicitly', async () => {
    const workspace = path.join(tempDir, 'workspace-no-matrix');
    await fs.ensureDir(workspace);
    const { policyPath, catalogPath } = await writePolicyBundle(workspace);
    const payloadPath = await writeProviderPayload(workspace);

    const result = runScript(workspace, [
      '--input', payloadPath,
      '--provider', 'moqui',
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--policy', policyPath,
      '--catalog', catalogPath,
      '--no-matrix',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.pipeline.matrix.enabled).toBe(false);
    expect(payload.pipeline.matrix.status).toBe('skipped');
    expect(payload.pipeline.matrix.exit_code).toBe(null);
    expect(payload.artifacts.matrix_summary_json).toBe(null);
    expect(payload.artifacts.matrix_signal_json).toBe(null);

    const matrixSignalsFile = path.join(workspace, '.kiro', 'reports', 'interactive-matrix-signals.jsonl');
    expect(await fs.pathExists(matrixSignalsFile)).toBe(false);
  });

  test('fails in strict mode when provider payload violates contract', async () => {
    const workspace = path.join(tempDir, 'workspace-contract-fail');
    await fs.ensureDir(workspace);
    const payloadPath = await writeProviderPayload(workspace);

    const rawPayload = await fs.readJson(payloadPath);
    rawPayload.current_state = { private_key: 'should-not-pass' };
    await fs.writeJson(payloadPath, rawPayload, { spaces: 2 });

    const contractPath = path.join(workspace, 'context-contract.json');
    await fs.writeJson(contractPath, {
      version: '1.1.0',
      context_contract: {
        required_fields: ['product', 'module', 'page'],
        max_payload_kb: 64
      },
      security_contract: {
        forbidden_keys: ['private_key']
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--input', payloadPath,
      '--provider', 'moqui',
      '--goal', 'Adjust order screen field layout for clearer input flow',
      '--context-contract', contractPath,
      '--json'
    ]);

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('context contract validation failed');
  });
});
