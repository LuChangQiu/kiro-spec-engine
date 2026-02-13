const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Parse --spec / --specs options into a de-duplicated list.
 *
 * @param {object} options
 * @returns {string[]}
 */
function parseSpecTargets(options = {}) {
  const fromSpec = (options.spec || '').trim();
  const fromSpecs = `${options.specs || ''}`
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const merged = [];
  if (fromSpec) {
    merged.push(fromSpec);
  }
  merged.push(...fromSpecs);

  return Array.from(new Set(merged));
}

/**
 * Execute multi-spec work through orchestrate mode.
 *
 * @param {object} options
 * @param {string[]} options.specTargets
 * @param {string} options.projectPath
 * @param {object} options.commandOptions
 * @param {Function} options.runOrchestration
 * @param {string} options.commandLabel
 * @param {string} options.nextActionLabel
 * @returns {Promise<object>}
 */
async function runMultiSpecViaOrchestrate(options = {}) {
  const {
    specTargets,
    projectPath,
    commandOptions,
    runOrchestration,
    commandLabel,
    nextActionLabel
  } = options;

  const orchestrationResult = await runOrchestration({
    specs: specTargets.join(','),
    maxParallel: commandOptions.maxParallel,
    json: false,
    silent: true
  }, {
    workspaceRoot: projectPath
  });

  const result = {
    mode: 'orchestrate',
    spec_ids: specTargets,
    status: orchestrationResult.status,
    orchestrate_result: orchestrationResult,
    next_actions: [
      nextActionLabel,
      'Use kse orchestrate status to inspect live orchestration state.'
    ]
  };

  if (commandOptions.out) {
    const outPath = path.isAbsolute(commandOptions.out)
      ? commandOptions.out
      : path.join(projectPath, commandOptions.out);
    await fs.ensureDir(path.dirname(outPath));
    await fs.writeJson(outPath, result, { spaces: 2 });
    result.output_file = outPath;
  }

  if (commandOptions.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.blue('🚀') + ` ${commandLabel} defaulted to orchestrate mode for ${specTargets.length} specs.`);
    console.log(chalk.gray(`  Specs: ${specTargets.join(', ')}`));
    console.log(chalk.gray(`  Status: ${orchestrationResult.status}`));
  }

  return result;
}

module.exports = {
  parseSpecTargets,
  runMultiSpecViaOrchestrate
};

