const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const MetricContractLoader = require('../value/metric-contract-loader');
const WeeklySnapshotBuilder = require('../value/weekly-snapshot-builder');
const RiskEvaluator = require('../value/risk-evaluator');
const GateSummaryEmitter = require('../value/gate-summary-emitter');

function toProjectPath(projectPath, maybePath) {
  if (!maybePath) {
    return null;
  }

  return path.isAbsolute(maybePath)
    ? maybePath
    : path.join(projectPath, maybePath);
}

function toPortablePath(projectPath, filePath) {
  return path.relative(projectPath, filePath).replace(/\\/g, '/');
}

async function loadJson(filePath) {
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    throw new Error(`Failed to read JSON file (${filePath}): ${error.message}`);
  }
}

async function loadHistorySnapshots(historyDir) {
  if (!await fs.pathExists(historyDir)) {
    return [];
  }

  const entries = await fs.readdir(historyDir);
  const snapshots = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue;
    }

    if (entry.startsWith('gate-summary.') || entry.includes('risk-evaluation')) {
      continue;
    }

    const filePath = path.join(historyDir, entry);

    let parsed;
    try {
      parsed = await fs.readJson(filePath);
    } catch (error) {
      continue;
    }

    if (parsed && typeof parsed.period === 'string') {
      snapshots.push(parsed);
    }
  }

  return snapshots;
}

function resolveMetricInput(inputPayload) {
  if (inputPayload && typeof inputPayload.metrics === 'object' && inputPayload.metrics !== null) {
    return inputPayload.metrics;
  }

  return inputPayload;
}

function defaultHistoryDir(projectPath) {
  return path.join(
    projectPath,
    '.kiro',
    'specs',
    '114-00-kpi-automation-and-observability',
    'custom',
    'weekly-metrics'
  );
}

async function runValueMetricsSnapshot(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();

  if (!options.input) {
    throw new Error('--input <path> is required for snapshot generation');
  }

  const loader = dependencies.metricContractLoader || new MetricContractLoader(projectPath);
  const builder = dependencies.weeklySnapshotBuilder || new WeeklySnapshotBuilder();
  const evaluator = dependencies.riskEvaluator || new RiskEvaluator();
  const gateEmitter = dependencies.gateSummaryEmitter || new GateSummaryEmitter();

  const { contract, contractPath } = await loader.load({
    path: options.definitions
  });

  const inputPath = toProjectPath(projectPath, options.input);
  const inputPayload = await loadJson(inputPath);

  const period = options.period || inputPayload.period;
  const notes = options.notes || inputPayload.notes || '';

  const snapshot = builder.build({
    period,
    metrics: resolveMetricInput(inputPayload),
    notes,
    contract
  });

  const historyDir = toProjectPath(projectPath, options.historyDir) || defaultHistoryDir(projectPath);
  await fs.ensureDir(historyDir);

  const historySnapshots = await loadHistorySnapshots(historyDir);
  const riskResult = evaluator.evaluate({
    historySnapshots,
    currentSnapshot: snapshot
  });

  snapshot.risk_level = riskResult.risk_level;
  snapshot.reasons = riskResult.reasons;

  const snapshotPath = toProjectPath(projectPath, options.out)
    || path.join(historyDir, `${snapshot.period}.json`);

  await fs.ensureDir(path.dirname(snapshotPath));
  await fs.writeJson(snapshotPath, snapshot, { spaces: 2 });

  const checkpoint = options.checkpoint || 'day-30';
  const gateSummary = gateEmitter.build({
    checkpoint,
    snapshot,
    contract,
    evidence: [toPortablePath(projectPath, snapshotPath)]
  });

  const gateSummaryPath = toProjectPath(projectPath, options.gateOut)
    || path.join(path.dirname(snapshotPath), `gate-summary.${snapshot.period}.${checkpoint}.json`);
  await fs.writeJson(gateSummaryPath, gateSummary, { spaces: 2 });

  const result = {
    success: true,
    period: snapshot.period,
    risk_level: snapshot.risk_level,
    triggered_metrics: riskResult.triggered_metrics,
    snapshot_path: toPortablePath(projectPath, snapshotPath),
    gate_summary_path: toPortablePath(projectPath, gateSummaryPath),
    contract_path: toPortablePath(projectPath, contractPath)
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!options.silent) {
    console.log(chalk.green('✅ KPI snapshot generated'));
    console.log(chalk.gray(`  period: ${result.period}`));
    console.log(chalk.gray(`  risk: ${result.risk_level}`));
    console.log(chalk.gray(`  snapshot: ${result.snapshot_path}`));
    console.log(chalk.gray(`  gate summary: ${result.gate_summary_path}`));
  }

  return result;
}

function registerValueCommands(program) {
  const value = program
    .command('value')
    .description('Spec value realization utilities');

  const metrics = value
    .command('metrics')
    .description('KPI metrics and observability commands');

  metrics
    .command('snapshot')
    .description('Generate weekly KPI snapshot and gate summary')
    .requiredOption('--input <path>', 'Input JSON with metric values')
    .option('--period <YYYY-WNN>', 'Week period, e.g. 2026-W08')
    .option('--definitions <path>', 'Metric definition YAML/JSON path')
    .option('--history-dir <path>', 'History snapshots directory')
    .option('--out <path>', 'Output path for snapshot JSON')
    .option('--gate-out <path>', 'Output path for gate summary JSON')
    .option('--checkpoint <name>', 'Gate checkpoint (day-30/day-60)', 'day-30')
    .option('--json', 'Emit machine-readable JSON')
    .action(async options => {
      try {
        await runValueMetricsSnapshot(options);
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        } else {
          console.error(chalk.red('❌ Value metrics snapshot failed:'), error.message);
        }
        process.exit(1);
      }
    });
}

module.exports = {
  registerValueCommands,
  runValueMetricsSnapshot,
  _loadHistorySnapshots: loadHistorySnapshots,
  _resolveMetricInput: resolveMetricInput
};

