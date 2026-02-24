const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { runOrchestration } = require('./orchestrate');
const {
  parseSpecTargets,
  runMultiSpecViaOrchestrate
} = require('../spec/multi-spec-orchestrate');

const { PipelineStateStore } = require('../spec/pipeline/state-store');
const { StageRunner } = require('../spec/pipeline/stage-runner');
const { createDefaultStageAdapters } = require('../spec/pipeline/stage-adapters');

async function runSpecPipeline(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const specTargets = parseSpecTargets(options);
  if (specTargets.length === 0) {
    throw new Error('Either --spec or --specs is required');
  }

  if (specTargets.length > 1) {
    const executeOrchestration = dependencies.runOrchestration || runOrchestration;
    return runMultiSpecViaOrchestrate({
      specTargets,
      projectPath,
      commandOptions: options,
      runOrchestration: executeOrchestration,
      commandLabel: 'Multi-spec pipeline',
      nextActionLabel: 'Multi-spec execution defaulted to orchestrate mode.'
    });
  }

  const specId = specTargets[0];

  const specPath = path.join(projectPath, '.sce', 'specs', specId);
  if (!await fs.pathExists(specPath)) {
    throw new Error(`Spec not found: ${specId}`);
  }

  const stateStore = dependencies.stateStore || new PipelineStateStore(projectPath);
  const adapters = dependencies.adapters || createDefaultStageAdapters(projectPath);
  const stageRunner = dependencies.stageRunner || new StageRunner({
    stateStore,
    adapters
  });

  let state;
  if (options.resume) {
    state = await stateStore.loadLatest(specId);
  }

  if (!state) {
    state = await stateStore.create(specId, {
      failFast: options.failFast !== false,
      continueOnWarning: !!options.continueOnWarning
    });
  }

  const runContext = {
    specId,
    runId: state.run_id,
    fromStage: options.fromStage,
    toStage: options.toStage,
    dryRun: !!options.dryRun,
    resume: !!options.resume,
    failFast: options.failFast !== false,
    continueOnWarning: !!options.continueOnWarning,
    strict: !!options.strict,
    gateOut: options.gateOut,
    state
  };

  const execution = await stageRunner.run(runContext);
  await stateStore.markFinished(state, execution.status);

  const result = {
    spec_id: specId,
    run_id: state.run_id,
    status: execution.status,
    stage_results: execution.stageResults,
    failure: execution.failure,
    next_actions: buildNextActions(execution),
    state_file: path.relative(projectPath, stateStore.getRunPath(specId, state.run_id))
  };

  if (options.out) {
    const outPath = path.isAbsolute(options.out)
      ? options.out
      : path.join(projectPath, options.out);
    await fs.ensureDir(path.dirname(outPath));
    await fs.writeJson(outPath, result, { spaces: 2 });
    result.output_file = outPath;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  return result;
}

function registerSpecPipelineCommand(program) {
  const pipeline = program
    .command('spec-pipeline')
    .description('Run Spec workflow pipeline (use: sce spec pipeline run)');

  pipeline
    .command('run')
    .description('Execute pipeline stages for one or more Specs')
    .option('--spec <name>', 'Single Spec identifier')
    .option('--specs <names>', 'Comma-separated Spec identifiers (multi-spec defaults to orchestrate mode)')
    .option('--from-stage <stage>', 'Start stage (requirements/design/tasks/gate)')
    .option('--to-stage <stage>', 'End stage (requirements/design/tasks/gate)')
    .option('--resume', 'Resume from latest unfinished stage state')
    .option('--dry-run', 'Preview pipeline execution without writing stage outputs')
    .option('--json', 'Output machine-readable JSON')
    .option('--out <path>', 'Write pipeline result JSON to file')
    .option('--max-parallel <n>', 'Maximum parallel agents when orchestrate mode is used', parseInt)
    .option('--continue-on-warning', 'Continue when stage returns warnings')
    .option('--no-fail-fast', 'Do not stop immediately on failed stage')
    .option('--strict', 'Enable strict mode for downstream gate stage')
    .option('--gate-out <path>', 'Output path for nested gate stage report')
    .action(async options => {
      try {
        await runSpecPipeline(options);
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        } else {
          console.error(chalk.red('❌ Spec pipeline failed:'), error.message);
        }
        process.exit(1);
      }
    });
}

function printResult(result) {
  const statusColor = result.status === 'completed' ? chalk.green : chalk.red;

  console.log(chalk.red('🔥') + ' Spec Workflow Pipeline');
  console.log();
  console.log(`${chalk.gray('Spec:')} ${result.spec_id}`);
  console.log(`${chalk.gray('Run:')} ${result.run_id}`);
  console.log(`${chalk.gray('Status:')} ${statusColor(result.status)}`);
  console.log();

  console.log(chalk.bold('Stage Results'));
  result.stage_results.forEach(stage => {
    const icon = stage.status === 'completed'
      ? chalk.green('✓')
      : stage.status === 'warning'
        ? chalk.yellow('!')
        : stage.status === 'skipped'
          ? chalk.gray('→')
          : chalk.red('✗');
    console.log(`  ${icon} ${stage.name}: ${stage.status}`);
  });

  if (result.next_actions.length > 0) {
    console.log();
    console.log(chalk.bold('Next Actions'));
    result.next_actions.forEach(action => console.log(`  - ${action}`));
  }
}

function buildNextActions(execution) {
  if (execution.status === 'completed') {
    return ['Review pipeline output and continue implementation on completed Spec stages.'];
  }

  if (execution.failure && execution.failure.stage) {
    return [
      `Resolve failure at stage: ${execution.failure.stage}`,
      'Use --resume to continue from the last unfinished stage after remediation.'
    ];
  }

  return ['Inspect stage_results for failure details and re-run pipeline.'];
}

async function _runPipelineInOrchestrateMode(specTargets, options, dependencies) {
  const projectPath = dependencies.projectPath || process.cwd();
  const executeOrchestration = dependencies.runOrchestration || runOrchestration;

  return runMultiSpecViaOrchestrate({
    specTargets,
    projectPath,
    commandOptions: options,
    runOrchestration: executeOrchestration,
    commandLabel: 'Multi-spec pipeline',
    nextActionLabel: 'Multi-spec execution defaulted to orchestrate mode.'
  });
}

function _parseSpecTargets(options = {}) {
  return parseSpecTargets(options);
}

module.exports = {
  registerSpecPipelineCommand,
  runSpecPipeline,
  _parseSpecTargets
};
