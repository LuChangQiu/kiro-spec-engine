const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  parseArgs,
  buildNormalizedContext
} = require('../../../scripts/interactive-context-bridge');

describe('interactive-context-bridge script', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-context-bridge-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('parseArgs keeps defaults and validates required input', () => {
    expect(() => parseArgs([])).toThrow('--input is required');

    const options = parseArgs(['--input', 'payload.json']);
    expect(options.provider).toBe('moqui');
    expect(options.strictContract).toBe(true);
  });

  test('buildNormalizedContext maps Moqui workbench payload to page-context', () => {
    const context = buildNormalizedContext({
      product: '331-moqui-poc',
      workspace: {
        module: 'governance-platform',
        page: 'screen-explorer',
        scene: {
          id: 'sce.scene--platform-screen-explorer-assist--0.1.0',
          name: 'Screen explorer',
          type: 'screen-analysis',
          workflow_node: 'screen-analysis'
        },
        screen_explorer: {
          selected_component: 'Entity'
        },
        ontology: {
          entities: [{ name: 'Screen' }]
        }
      },
      assistant: {
        sessionId: 'session-1771',
        model: 'Spec-Expert'
      }
    }, 'moqui');

    expect(context.product).toBe('331-moqui-poc');
    expect(context.module).toBe('governance-platform');
    expect(context.page).toBe('screen-explorer');
    expect(context.scene_id).toBe('sce.scene--platform-screen-explorer-assist--0.1.0');
    expect(context.assistant_panel.session_id).toBe('session-1771');
    expect(context.scene_workspace.ontology.entities).toEqual(['Screen']);
  });

  test('runs bridge and outputs valid normalized context report', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-context-bridge.js');
    const workspace = path.join(tempDir, 'workspace-ok');
    const inputFile = path.join(workspace, 'moqui-context-provider.json');
    await fs.ensureDir(workspace);
    await fs.writeJson(inputFile, {
      product: '331-moqui-poc',
      workspace: {
        module: 'governance-platform',
        page: 'screen-explorer-workbench',
        scene: {
          id: 'sce.scene--platform-screen-explorer-assist--0.1.0',
          name: 'Screen explorer',
          type: 'screen-analysis',
          workflow_node: 'screen-analysis'
        },
        screen_explorer: {
          active_tab: 'Overview',
          selected_screen: 'Screen Explorer',
          selected_component: 'Entity',
          filters: ['AI Components'],
          result_total: 0
        },
        ontology: {
          entities: ['Screen', 'Form'],
          relations: ['Screen_has_Form'],
          business_rules: ['screen_name_unique'],
          decision_policies: ['publish_requires_risk_review']
        }
      },
      fields: [
        { name: 'screen_name', type: 'string' },
        { name: 'api_token', type: 'string', sensitive: true }
      ],
      current_state: {
        screen_name: 'Screen Explorer'
      },
      assistant: {
        sessionId: 'session-1771',
        agentId: 'codex',
        model: 'Spec-Expert',
        mode: 'read-only'
      }
    }, { spaces: 2 });

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--input', inputFile, '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-context-bridge');
    expect(payload.validation.valid).toBe(true);
    expect(payload.summary.has_scene_workspace).toBe(true);
    expect(payload.summary.has_assistant_panel).toBe(true);

    const contextOutFile = path.join(workspace, payload.output.context);
    const reportOutFile = path.join(workspace, payload.output.report);
    expect(await fs.pathExists(contextOutFile)).toBe(true);
    expect(await fs.pathExists(reportOutFile)).toBe(true);
    const normalizedContext = await fs.readJson(contextOutFile);
    expect(normalizedContext.module).toBe('governance-platform');
    expect(normalizedContext.scene_workspace.ontology.entities).toEqual(['Screen', 'Form']);
  });

  test('strict contract mode fails on forbidden keys, non-strict mode keeps report', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const scriptPath = path.join(projectRoot, 'scripts', 'interactive-context-bridge.js');
    const workspace = path.join(tempDir, 'workspace-contract');
    const inputFile = path.join(workspace, 'moqui-context-provider.json');
    const contractFile = path.join(workspace, 'contract.json');
    await fs.ensureDir(workspace);
    await fs.writeJson(inputFile, {
      product: '331-moqui-poc',
      module: 'governance-platform',
      page: 'screen-explorer-workbench',
      current_state: {
        private_key: 'should-not-pass'
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

    const strictResult = spawnSync(
      process.execPath,
      [scriptPath, '--input', inputFile, '--context-contract', contractFile, '--json'],
      { cwd: workspace, encoding: 'utf8' }
    );
    expect(strictResult.status).toBe(1);
    expect(`${strictResult.stderr}`.toLowerCase()).toContain('context contract validation failed');

    const softResult = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--input', inputFile,
        '--context-contract', contractFile,
        '--no-strict-contract',
        '--json'
      ],
      { cwd: workspace, encoding: 'utf8' }
    );
    expect(softResult.status).toBe(0);
    const payload = JSON.parse(`${softResult.stdout}`.trim());
    expect(payload.validation.valid).toBe(false);
    expect(payload.validation.issues.join(' ')).toContain('forbidden keys present');
  });
});
