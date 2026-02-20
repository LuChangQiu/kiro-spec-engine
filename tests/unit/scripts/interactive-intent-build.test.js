const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-intent-build script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-intent-build-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('builds read-only intent, explain output, and audit event', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-intent-build.js');
    const workspace = path.join(tempDir, 'workspace');
    const contextFile = path.join(workspace, 'page-context.json');
    const goal = 'Must reduce manual approval time without changing payment authorization flow.';

    await fs.ensureDir(workspace);
    await fs.writeJson(contextFile, {
      product: 'moqui-experiment',
      module: 'order-management',
      page: 'order-approval-dashboard',
      entity: 'OrderHeader',
      workflow_node: 'approval-review',
      fields: [
        { name: 'order_id', type: 'string', sensitive: false },
        { name: 'customer_email', type: 'string', sensitive: true },
        { name: 'payment_token', type: 'string', sensitive: true }
      ],
      current_state: {
        order_id: 'OH10001',
        customer_email: 'customer@example.com',
        payment_token: 'tok_live_abc'
      },
      scene_workspace: {
        ontology: {
          entities: ['OrderHeader', 'OrderItem'],
          relations: ['OrderHeader_has_OrderItem'],
          business_rules: ['approval_limit_rule'],
          decision_policies: ['approval_routing_policy']
        },
        screen_explorer: {
          selected_component: 'Form',
          result_total: 1
        }
      },
      assistant_panel: {
        session_id: 'session-777'
      }
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--context',
        contextFile,
        '--goal',
        goal,
        '--user-id',
        'demo-user',
        '--json'
      ],
      {
        cwd: workspace,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-intent-build');
    expect(payload.readonly).toBe(true);
    expect(payload.intent).toEqual(expect.objectContaining({
      user_id: 'demo-user',
      business_goal: goal
    }));
    expect(payload.intent.constraints.length).toBeGreaterThan(0);
    expect(payload.sanitized_context_preview.current_state.customer_email).toBe('[REDACTED]');
    expect(payload.sanitized_context_preview.current_state.payment_token).toBe('[REDACTED]');
    expect(payload.context_analysis.ontology_entity_total).toBe(2);
    expect(payload.context_analysis.assistant_session_id).toBe('session-777');
    expect(payload.contract_validation.valid).toBe(true);
    expect(payload.contract_validation.strict).toBe(true);

    const intentFile = path.join(workspace, '.kiro', 'reports', 'interactive-change-intent.json');
    const explainFile = path.join(workspace, '.kiro', 'reports', 'interactive-page-explain.md');
    const auditFile = path.join(workspace, '.kiro', 'reports', 'interactive-copilot-audit.jsonl');
    expect(await fs.pathExists(intentFile)).toBe(true);
    expect(await fs.pathExists(explainFile)).toBe(true);
    expect(await fs.pathExists(auditFile)).toBe(true);

    const intentPayload = await fs.readJson(intentFile);
    expect(intentPayload.metadata.mode).toBe('read-only');
    expect(intentPayload.context_ref.product).toBe('moqui-experiment');
    expect(intentPayload.metadata.contract_validation.valid).toBe(true);

    const auditLines = (await fs.readFile(auditFile, 'utf8'))
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    expect(auditLines.length).toBe(1);
    const auditEntry = JSON.parse(auditLines[0]);
    expect(auditEntry.event_type).toBe('interactive.intent.generated');
    expect(auditEntry.readonly).toBe(true);
  });

  test('supports goal-file input and explicit session id', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-intent-build.js');
    const workspace = path.join(tempDir, 'workspace');
    const contextFile = path.join(workspace, 'page-context.json');
    const goalFile = path.join(workspace, 'goal.txt');

    await fs.ensureDir(workspace);
    await fs.writeJson(contextFile, {
      product: 'moqui-experiment',
      module: 'inventory',
      page: 'inventory-adjustment',
      fields: [{ name: 'warehouse_id', type: 'string' }]
    }, { spaces: 2 });
    await fs.writeFile(goalFile, 'Need to improve inventory adjustment auditability.', 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--context',
        contextFile,
        '--goal-file',
        goalFile,
        '--session-id',
        'session-fixed-001',
        '--json'
      ],
      {
        cwd: workspace,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.session_id).toBe('session-fixed-001');
    expect(payload.intent.session_id).toBe('session-fixed-001');
    expect(payload.intent.business_goal).toContain('improve inventory adjustment auditability');
  });

  test('fails when neither goal nor goal-file is provided', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-intent-build.js');
    const workspace = path.join(tempDir, 'workspace');
    const contextFile = path.join(workspace, 'page-context.json');

    await fs.ensureDir(workspace);
    await fs.writeJson(contextFile, {
      product: 'moqui-experiment',
      module: 'order-management',
      page: 'order-list'
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--context',
        contextFile,
        '--json'
      ],
      {
        cwd: workspace,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('goal');
  });

  test('fails in strict mode when context violates explicit contract', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-intent-build.js');
    const workspace = path.join(tempDir, 'workspace-contract-fail');
    const contextFile = path.join(workspace, 'page-context.json');
    const contractFile = path.join(workspace, 'context-contract.json');

    await fs.ensureDir(workspace);
    await fs.writeJson(contextFile, {
      product: 'moqui-experiment',
      module: 'order-management',
      page: 'order-list',
      current_state: {
        private_key: 'secret-value-should-not-pass'
      }
    }, { spaces: 2 });
    await fs.writeJson(contractFile, {
      version: '1.1.0',
      context_contract: {
        required_fields: ['product', 'module', 'page'],
        max_payload_kb: 64
      },
      security_contract: {
        forbidden_keys: ['private_key']
      }
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--context',
        contextFile,
        '--goal',
        'Improve list readability without changing approval policy',
        '--context-contract',
        contractFile,
        '--json'
      ],
      {
        cwd: workspace,
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(1);
    expect(`${result.stderr}`.toLowerCase()).toContain('context contract validation failed');
    expect(`${result.stderr}`.toLowerCase()).toContain('forbidden keys present');
  });
});
