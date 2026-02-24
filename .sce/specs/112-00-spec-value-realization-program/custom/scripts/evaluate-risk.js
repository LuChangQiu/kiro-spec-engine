const fs = require('fs');
const path = require('path');

const METRICS = [
  { id: 'ttfv_minutes', better: 'lower' },
  { id: 'batch_success_rate', better: 'higher' },
  { id: 'cycle_reduction_rate', better: 'higher' },
  { id: 'manual_takeover_rate', better: 'lower' }
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[key] = value;
  }
  return args;
}

function parsePeriod(period) {
  const match = /^(\d{4})-W(\d{2})$/.exec(period || '');
  if (!match) return Number.MAX_SAFE_INTEGER;
  const year = Number(match[1]);
  const week = Number(match[2]);
  return year * 100 + week;
}

function isWorse(current, previous, better) {
  if (typeof current !== 'number' || typeof previous !== 'number') {
    return false;
  }
  return better === 'lower' ? current > previous : current < previous;
}

function loadSnapshots(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(name => name.endsWith('.json') && !name.includes('risk-evaluation'))
    .map(name => path.join(dirPath, name));

  const rawSnapshots = files
    .map(filePath => {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        file: path.basename(filePath),
        ...data
      };
    })
    .sort((a, b) => parsePeriod(a.period) - parsePeriod(b.period));

  const deduped = new Map();
  for (const snapshot of rawSnapshots) {
    const existing = deduped.get(snapshot.period);
    if (!existing) {
      deduped.set(snapshot.period, snapshot);
      continue;
    }

    const existingScore = (existing.is_baseline ? 2 : 0) + (existing.is_sample ? 0 : 1);
    const currentScore = (snapshot.is_baseline ? 2 : 0) + (snapshot.is_sample ? 0 : 1);
    if (currentScore > existingScore) {
      deduped.set(snapshot.period, snapshot);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => parsePeriod(a.period) - parsePeriod(b.period));
}

function evaluate(snapshots) {
  const streaks = {};
  const details = {};

  METRICS.forEach(metric => {
    streaks[metric.id] = 0;
    details[metric.id] = {
      consecutive_worse_weeks: 0,
      triggered: false,
      better_direction: metric.better
    };
  });

  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];

    METRICS.forEach(metric => {
      const worse = isWorse(current[metric.id], previous[metric.id], metric.better);
      if (worse) {
        streaks[metric.id] += 1;
      } else {
        streaks[metric.id] = 0;
      }

      details[metric.id].consecutive_worse_weeks = Math.max(
        details[metric.id].consecutive_worse_weeks,
        streaks[metric.id]
      );

      if (streaks[metric.id] >= 2) {
        details[metric.id].triggered = true;
      }
    });
  }

  const triggeredMetrics = Object.entries(details)
    .filter(([, value]) => value.triggered)
    .map(([metricId]) => metricId);

  return {
    evaluated_period: snapshots.length > 0 ? snapshots[snapshots.length - 1].period : null,
    snapshots: snapshots.map(item => ({ period: item.period, file: item.file })),
    triggered_metrics: triggeredMetrics,
    risk_level: triggeredMetrics.length > 0 ? 'high' : 'medium',
    details
  };
}

function main() {
  const args = parseArgs(process.argv);
  const dirPath = args.dir || path.join(process.cwd(), '.sce', 'specs', '112-00-spec-value-realization-program', 'custom', 'weekly-metrics');
  const outPath = args.out || path.join(dirPath, 'risk-evaluation.latest.json');

  if (!fs.existsSync(dirPath)) {
    console.error(`Metrics directory not found: ${dirPath}`);
    process.exit(1);
  }

  const snapshots = loadSnapshots(dirPath);
  if (snapshots.length < 2) {
    console.error('At least 2 snapshots are required for risk evaluation.');
    process.exit(1);
  }

  const result = evaluate(snapshots);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

main();
