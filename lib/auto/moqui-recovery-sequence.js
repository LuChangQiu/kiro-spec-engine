'use strict';

const DEFAULT_CLUSTER_GOALS_ARG = '.sce/auto/matrix-remediation.capability-clusters.json';
const DEFAULT_BASELINE_ARG = '.sce/reports/release-evidence/moqui-template-baseline.json';
const DEFAULT_CLUSTER_PHASED_ALIAS = 'npm run run:matrix-remediation-clusters-phased -- --json';
const DEFAULT_CLUSTER_BATCH_ALIAS = 'npm run run:matrix-remediation-clusters';
const DEFAULT_BASELINE_PHASED_ALIAS = 'npm run run:matrix-remediation-from-baseline -- --json';

function buildMoquiRegressionRecoverySequenceLines(options = {}) {
  const clusterGoalsArg = options.clusterGoalsArg || DEFAULT_CLUSTER_GOALS_ARG;
  const baselineArg = options.baselineArg || DEFAULT_BASELINE_ARG;
  const clusterPhasedCommand = options.clusterPhasedCommand
    || `node scripts/moqui-matrix-remediation-phased-runner.js --cluster-goals ${clusterGoalsArg} --json`;
  const clusterBatchCommand = options.clusterBatchCommand
    || `sce auto close-loop-batch ${clusterGoalsArg} --format json --batch-parallel 1 --batch-agent-budget 2 --batch-retry-until-complete --json`;
  const baselinePhasedCommand = options.baselinePhasedCommand
    || `node scripts/moqui-matrix-remediation-phased-runner.js --baseline ${baselineArg} --json`;
  const clusterPhasedAlias = options.clusterPhasedAlias || DEFAULT_CLUSTER_PHASED_ALIAS;
  const clusterBatchAlias = options.clusterBatchAlias || DEFAULT_CLUSTER_BATCH_ALIAS;
  const baselinePhasedAlias = options.baselinePhasedAlias || DEFAULT_BASELINE_PHASED_ALIAS;

  const includeLabel = options.includeLabel !== false;
  const includeStep1Alias = options.includeStep1Alias !== false;
  const includeStep1Fallback = options.includeStep1Fallback !== false;
  const includeStep1FallbackAlias = options.includeStep1FallbackAlias !== false;
  const includeStep2Alias = options.includeStep2Alias !== false;

  const wrapCommands = options.wrapCommands === true;
  const withPeriod = options.withPeriod === true;
  const formatCommand = command => (wrapCommands ? `\`${command}\`` : command);
  const suffix = withPeriod ? '.' : '';
  const lines = [];

  if (includeLabel) {
    lines.push('Moqui regression recovery sequence (recommended):');
  }
  lines.push(`Step 1 (Cluster phased): ${formatCommand(clusterPhasedCommand)}${suffix}`);
  if (includeStep1Alias) {
    lines.push(`Step 1 alias: ${formatCommand(clusterPhasedAlias)}${suffix}`);
  }
  if (includeStep1Fallback) {
    lines.push(`Step 1 fallback (cluster batch): ${formatCommand(clusterBatchCommand)}${suffix}`);
  }
  if (includeStep1FallbackAlias) {
    lines.push(`Step 1 fallback alias: ${formatCommand(clusterBatchAlias)}${suffix}`);
  }
  lines.push(`Step 2 (Baseline phased): ${formatCommand(baselinePhasedCommand)}${suffix}`);
  if (includeStep2Alias) {
    lines.push(`Step 2 alias: ${formatCommand(baselinePhasedAlias)}${suffix}`);
  }

  return lines;
}

module.exports = {
  DEFAULT_CLUSTER_GOALS_ARG,
  DEFAULT_BASELINE_ARG,
  DEFAULT_CLUSTER_PHASED_ALIAS,
  DEFAULT_CLUSTER_BATCH_ALIAS,
  DEFAULT_BASELINE_PHASED_ALIAS,
  buildMoquiRegressionRecoverySequenceLines
};
