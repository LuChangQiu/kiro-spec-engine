const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const MetricContractLoader = require('../../../lib/value/metric-contract-loader');

describe('MetricContractLoader', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-metric-contract-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('loads and normalizes valid yaml contract', async () => {
    const contractPath = path.join(tempDir, 'metric-definition.yaml');
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

    const loader = new MetricContractLoader(tempDir);
    const result = await loader.load({ path: contractPath });

    expect(result.contract.metrics).toHaveLength(4);
    expect(result.contract.metric_map.ttfv_minutes.target_rule.operator).toBe('<=');
    expect(result.contract.metric_map.ttfv_minutes.target_rule.value).toBe(30);
    expect(result.contract.metric_map.batch_success_rate.better_direction).toBe('higher');
  });

  test('fails on invalid target expression', async () => {
    const contractPath = path.join(tempDir, 'metric-definition.yaml');
    await fs.writeFile(contractPath, `
metrics:
  - id: ttfv_minutes
    name: Time To First Value
    target: "around 30"
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
`.trim(), 'utf8');

    const loader = new MetricContractLoader(tempDir);

    await expect(loader.load({ path: contractPath }))
      .rejects
      .toThrow('Invalid target expression');
  });

  test('fails when required metrics are missing', async () => {
    const contractPath = path.join(tempDir, 'metric-definition.yaml');
    await fs.writeFile(contractPath, `
metrics:
  - id: ttfv_minutes
    name: Time To First Value
    target: "<= 30"
    unit: minutes
`.trim(), 'utf8');

    const loader = new MetricContractLoader(tempDir);

    await expect(loader.load({ path: contractPath }))
      .rejects
      .toThrow('required metric is missing');
  });
});

