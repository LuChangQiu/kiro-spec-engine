const chalk = require('chalk');
const fs = require('fs-extra');
const { assessComplexityStrategy } = require('../spec/complexity-strategy');

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function printPayload(payload, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(chalk.blue('Spec Strategy Assess'));
  console.log(`  Source: ${payload.source.type}${payload.source.id ? ` (${payload.source.id})` : ''}`);
  console.log(`  Decision: ${payload.decision}`);
  console.log(`  Reason: ${payload.decision_reason}`);
  console.log(`  Recommended Program Specs: ${payload.summary.recommended_program_specs}`);
  if (Array.isArray(payload.signals) && payload.signals.length > 0) {
    console.log(chalk.gray('  Signals:'));
    payload.signals.forEach((signal) => {
      console.log(chalk.gray(`    - ${signal}`));
    });
  }
}

async function runSpecStrategyAssessCommand(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const payload = await assessComplexityStrategy({
    goal: normalizeText(options.goal),
    spec: normalizeText(options.spec)
  }, {
    projectPath,
    fileSystem
  });
  printPayload(payload, options);
  return payload;
}

function registerSpecStrategyCommand(program) {
  const strategy = program
    .command('spec-strategy')
    .description('Assess whether a problem should stay single-spec or escalate to a coordinated program');

  strategy
    .command('assess')
    .description('Assess complexity and recommend single-spec vs multi-spec-program vs research-program')
    .option('--goal <text>', 'Broad goal or problem statement to assess')
    .option('--spec <spec-id>', 'Existing spec to assess from current artifacts')
    .option('--json', 'Output machine-readable JSON')
    .action(async (options) => {
      try {
        await runSpecStrategyAssessCommand(options);
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
        } else {
          console.error(chalk.red('❌ spec-strategy assess failed:'), error.message);
        }
        process.exit(1);
      }
    });
}

module.exports = {
  runSpecStrategyAssessCommand,
  registerSpecStrategyCommand
};
