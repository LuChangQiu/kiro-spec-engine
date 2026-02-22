const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('capability-mapping-report script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-capability-mapping-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'capability-mapping-report.js');
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

  test('maps capability coverage and reports ontology gaps', async () => {
    const workspace = path.join(tempDir, 'workspace-map');
    await fs.ensureDir(workspace);

    const inputFile = path.join(workspace, 'mapping-input.json');
    await fs.writeJson(inputFile, {
      changes: [
        { type: 'entity', name: 'Order' },
        { type: 'business_rule', name: 'credit-check' },
        { type: 'decision_strategy', name: 'price-discount' }
      ],
      templates: [
        { id: 'scene-moqui-order-core', capabilities: ['entity:order'] },
        { id: 'scene-moqui-pricing', capabilities: ['decision:price-discount'] }
      ],
      ontology: {
        entities: [{ name: 'Order' }],
        business_rules: [],
        decision_strategies: [{ name: 'price-discount' }]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--input-file', inputFile,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('capability-mapping-report');
    expect(payload.summary.total_changes).toBe(3);
    expect(payload.summary.missing_capabilities).toBe(1);
    expect(payload.summary.ontology_gaps).toBe(1);
    expect(payload.missing_capabilities).toContain('rule:credit-check');
    expect(payload.recommended_templates).toEqual(expect.arrayContaining([
      'scene-moqui-order-core',
      'scene-moqui-pricing'
    ]));
  });

  test('returns 100 percent coverage on empty input set', async () => {
    const workspace = path.join(tempDir, 'workspace-empty');
    await fs.ensureDir(workspace);
    const inputFile = path.join(workspace, 'empty-input.json');
    await fs.writeJson(inputFile, {
      changes: [],
      templates: [],
      ontology: {}
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--input-file', inputFile,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.total_changes).toBe(0);
    expect(payload.summary.coverage_percent).toBe(100);
    expect(payload.mapping_report).toHaveLength(0);
  });
});
