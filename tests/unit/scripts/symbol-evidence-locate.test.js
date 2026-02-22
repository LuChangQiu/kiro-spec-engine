const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('symbol-evidence-locate script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-symbol-evidence-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'symbol-evidence-locate.js');
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

  test('returns reliable symbol evidence for matching query', async () => {
    const workspace = path.join(tempDir, 'workspace-match');
    await fs.ensureDir(path.join(workspace, 'src'));
    await fs.writeFile(
      path.join(workspace, 'src', 'order-service.js'),
      [
        'function approveOrder(orderId, actorId) {',
        '  return { orderId, actorId, status: "approved" };',
        '}'
      ].join('\n'),
      'utf8'
    );

    const result = runScript(workspace, [
      '--workspace', workspace,
      '--query', 'approve order',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('symbol-evidence-locate');
    expect(payload.evidence.reliable).toBe(true);
    expect(payload.evidence.fallback_action).toBe('allow_write');
    expect(payload.hits.length).toBeGreaterThan(0);
    expect(payload.hits[0]).toEqual(expect.objectContaining({
      file: 'src/order-service.js',
      symbol: 'approveOrder'
    }));
  });

  test('blocks high-risk write when reliable evidence is not found', async () => {
    const workspace = path.join(tempDir, 'workspace-no-match');
    await fs.ensureDir(path.join(workspace, 'src'));
    await fs.writeFile(
      path.join(workspace, 'src', 'health.js'),
      'function ping() { return "ok"; }',
      'utf8'
    );

    const result = runScript(workspace, [
      '--workspace', workspace,
      '--query', 'reconcile invoice accrual',
      '--strict',
      '--json'
    ]);

    expect(result.status).toBe(2);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.evidence.reliable).toBe(false);
    expect(payload.evidence.fallback_action).toBe('block_high_risk_write');
    expect(payload.summary.reliable_hits).toBe(0);
  });
});
