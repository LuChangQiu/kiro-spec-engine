const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { runValueMetricsSnapshot } = require('../../../lib/commands/value');

describe('value metrics snapshot command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kse-value-metrics-'));

    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  async function writeContract(relativePath = 'metric-definition.yaml') {
    const contractPath = path.join(tempDir, relativePath);
    await fs.ensureDir(path.dirname(contractPath));
    await fs.writeFile(contractPath, `
metrics:
  - id: ttfv_minutes
    name: Time To First Value
    target: "<= 30"
    unit: minutes
  - id: batch_success_rate
    name: Batch Success Rate
    target: ">= 0.80"
    unit: ratio
  - id: cycle_reduction_rate
    name: Cycle Reduction Rate
    target: ">= 0.30"
    unit: ratio
  - id: manual_takeover_rate
    name: Manual Takeover Rate
    target: "<= 0.20"
    unit: ratio
threshold_policy:
  go_no_go:
    day_60_min_passed_metrics: 3
`.trim(), 'utf8');

    return contractPath;
  }

  test('generates snapshot and gate summary from input data', async () => {
    await writeContract('config/metric-definition.yaml');

    const historyDir = path.join(tempDir, 'history');
    await fs.ensureDir(historyDir);
    await fs.writeJson(path.join(historyDir, '2026-W07.json'), {
      period: '2026-W07',
      ttfv_minutes: 20,
      batch_success_rate: 0.84,
      cycle_reduction_rate: 0.32,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });
    await fs.writeJson(path.join(historyDir, '2026-W08.json'), {
      period: '2026-W08',
      ttfv_minutes: 23,
      batch_success_rate: 0.83,
      cycle_reduction_rate: 0.31,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });

    const inputPath = path.join(tempDir, 'input.json');
    await fs.writeJson(inputPath, {
      period: '2026-W09',
      ttfv_minutes: 26,
      batch_success_rate: 0.81,
      cycle_reduction_rate: 0.31,
      manual_takeover_rate: 0.22,
      notes: 'weekly sample'
    }, { spaces: 2 });

    const result = await runValueMetricsSnapshot({
      input: 'input.json',
      definitions: 'config/metric-definition.yaml',
      historyDir: 'history',
      checkpoint: 'day-60',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.period).toBe('2026-W09');
    expect(result.risk_level).toBe('high');
    expect(result.triggered_metrics).toContain('ttfv_minutes');

    const snapshotPath = path.join(tempDir, result.snapshot_path);
    const gatePath = path.join(tempDir, result.gate_summary_path);

    expect(await fs.pathExists(snapshotPath)).toBe(true);
    expect(await fs.pathExists(gatePath)).toBe(true);

    const gateSummary = await fs.readJson(gatePath);
    expect(gateSummary.decision).toBe('go');
    expect(gateSummary.passed_metrics).toBe(3);
  });

  test('uses default output directory when history-dir is omitted', async () => {
    await writeContract('config/metric-definition.yaml');

    const inputPath = path.join(tempDir, 'input.json');
    await fs.writeJson(inputPath, {
      period: '2026-W10',
      ttfv_minutes: 27,
      batch_success_rate: 0.82,
      cycle_reduction_rate: 0.31,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });

    const result = await runValueMetricsSnapshot({
      input: 'input.json',
      definitions: 'config/metric-definition.yaml',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.snapshot_path).toBe('.kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/2026-W10.json');
    expect(await fs.pathExists(path.join(tempDir, result.snapshot_path))).toBe(true);
  });

  test('fails when input is missing', async () => {
    await expect(runValueMetricsSnapshot({}, { projectPath: tempDir }))
      .rejects
      .toThrow('--input <path> is required');
  });
});

