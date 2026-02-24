const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  runValueMetricsSample,
  runValueMetricsSnapshot,
  runValueMetricsBaseline,
  runValueMetricsTrend,
  _getIsoWeekPeriod,
  _createSampleMetricsInput
} = require('../../../lib/commands/value');

describe('value metrics snapshot command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-value-metrics-'));

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

    expect(result.snapshot_path).toBe('.sce/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/2026-W10.json');
    expect(await fs.pathExists(path.join(tempDir, result.snapshot_path))).toBe(true);
  });

  test('fails when input is missing', async () => {
    await expect(runValueMetricsSnapshot({}, { projectPath: tempDir }))
      .rejects
      .toThrow('--input <path> is required');
  });

  test('snapshot missing input error includes sample tip', async () => {
    await expect(runValueMetricsSnapshot({}, { projectPath: tempDir }))
      .rejects
      .toThrow('sce value metrics sample');
  });

  test('generates sample input using default path', async () => {
    const result = await runValueMetricsSample({
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.sample_path).toBe('kpi-input.json');
    expect(result.period).toMatch(/^\d{4}-W\d{2}$/);

    const samplePayload = await fs.readJson(path.join(tempDir, result.sample_path));
    expect(samplePayload.period).toBe(result.period);
    expect(samplePayload.metrics.ttfv_minutes).toBe(25);
    expect(samplePayload.metrics.batch_success_rate).toBe(0.86);
  });

  test('generates sample input with custom output and period', async () => {
    const result = await runValueMetricsSample({
      period: '2026-W10',
      out: 'custom/kpi-sample.json',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.period).toBe('2026-W10');
    expect(result.sample_path).toBe('custom/kpi-sample.json');

    const samplePayload = await fs.readJson(path.join(tempDir, result.sample_path));
    expect(samplePayload.period).toBe('2026-W10');
    expect(samplePayload.notes).toContain('sample metrics input');
  });

  test('generates baseline from earliest history snapshots', async () => {
    await writeContract('config/metric-definition.yaml');

    const historyDir = path.join(tempDir, 'history');
    await fs.ensureDir(historyDir);
    await fs.writeJson(path.join(historyDir, '2026-W07.json'), {
      period: '2026-W07',
      ttfv_minutes: 20,
      batch_success_rate: 0.80,
      cycle_reduction_rate: 0.30,
      manual_takeover_rate: 0.20
    }, { spaces: 2 });
    await fs.writeJson(path.join(historyDir, '2026-W08.json'), {
      period: '2026-W08',
      ttfv_minutes: 24,
      batch_success_rate: 0.84,
      cycle_reduction_rate: 0.32,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });

    const result = await runValueMetricsBaseline({
      definitions: 'config/metric-definition.yaml',
      historyDir: 'history',
      fromHistory: 2,
      period: '2026-W09',
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.period).toBe('2026-W09');
    expect(result.baseline_source).toBe('history:2026-W07-2026-W08');

    const baseline = await fs.readJson(path.join(tempDir, result.baseline_path));
    expect(baseline.is_baseline).toBe(true);
    expect(baseline.ttfv_minutes).toBe(22);
    expect(baseline.batch_success_rate).toBe(0.82);
  });

  test('calculates trend summary from history snapshots', async () => {
    await writeContract('config/metric-definition.yaml');

    const historyDir = path.join(tempDir, 'history');
    await fs.ensureDir(historyDir);
    await fs.writeJson(path.join(historyDir, '2026-W07.json'), {
      period: '2026-W07',
      ttfv_minutes: 20,
      batch_success_rate: 0.85,
      cycle_reduction_rate: 0.33,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });
    await fs.writeJson(path.join(historyDir, '2026-W08.json'), {
      period: '2026-W08',
      ttfv_minutes: 23,
      batch_success_rate: 0.83,
      cycle_reduction_rate: 0.32,
      manual_takeover_rate: 0.19
    }, { spaces: 2 });
    await fs.writeJson(path.join(historyDir, '2026-W09.json'), {
      period: '2026-W09',
      ttfv_minutes: 26,
      batch_success_rate: 0.81,
      cycle_reduction_rate: 0.31,
      manual_takeover_rate: 0.21
    }, { spaces: 2 });

    const result = await runValueMetricsTrend({
      definitions: 'config/metric-definition.yaml',
      historyDir: 'history',
      window: 3,
      json: true
    }, {
      projectPath: tempDir
    });

    expect(result.success).toBe(true);
    expect(result.period).toBe('2026-W09');
    expect(result.risk_level).toBe('high');
    expect(result.triggered_metrics).toContain('ttfv_minutes');
    expect(result.metrics).toHaveLength(4);
    expect(await fs.pathExists(path.join(tempDir, result.trend_path))).toBe(true);
  });

  test('fails trend calculation when snapshots are insufficient', async () => {
    await writeContract('config/metric-definition.yaml');

    const historyDir = path.join(tempDir, 'history');
    await fs.ensureDir(historyDir);
    await fs.writeJson(path.join(historyDir, '2026-W07.json'), {
      period: '2026-W07',
      ttfv_minutes: 20,
      batch_success_rate: 0.85,
      cycle_reduction_rate: 0.33,
      manual_takeover_rate: 0.18
    }, { spaces: 2 });

    await expect(runValueMetricsTrend({
      definitions: 'config/metric-definition.yaml',
      historyDir: 'history'
    }, {
      projectPath: tempDir
    })).rejects.toThrow('At least 2 snapshots are required');
  });

  test('calculates ISO week period deterministically', () => {
    const period = _getIsoWeekPeriod(new Date('2026-02-14T12:00:00.000Z'));
    expect(period).toBe('2026-W07');
  });

  test('builds sample input payload with expected metrics', () => {
    const payload = _createSampleMetricsInput('2026-W10');
    expect(payload.period).toBe('2026-W10');
    expect(payload.metrics).toEqual({
      ttfv_minutes: 25,
      batch_success_rate: 0.86,
      cycle_reduction_rate: 0.34,
      manual_takeover_rate: 0.16
    });
    expect(payload.notes).toContain('sample metrics input');
  });
});
