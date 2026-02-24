const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { SteeringContract, normalizeToolName } = require('../runtime/steering-contract');

function registerSteeringCommands(program) {
  const steering = program
    .command('steering')
    .description('Manage universal steering contract for cross-agent runtime');

  steering
    .command('init')
    .description('Initialize .sce steering contract with .kiro compatibility fallback')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const contract = new SteeringContract(process.cwd());
        const result = await contract.ensureContract();
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            action: 'steering_init',
            ...result,
          }, null, 2));
          return;
        }

        console.log(chalk.green('✓ Steering contract initialized'));
        console.log(chalk.gray(`Manifest: ${result.manifestPath}`));
        if (result.preparedLayers.length > 0) {
          console.log(chalk.gray('Layers:'));
          for (const layer of result.preparedLayers) {
            console.log(chalk.gray(`  - ${layer.layer} (${layer.file}) <= ${layer.source}`));
          }
        }
      } catch (error) {
        _exitWithError(error, options.json);
      }
    });

  steering
    .command('compile')
    .description('Compile steering contract into an agent-specific runtime bundle')
    .option('--tool <tool>', 'Target tool (codex|claude|cursor|generic)', 'codex')
    .option('--agent-version <version>', 'Target agent version for compatibility check')
    .option('--format <format>', 'Output format (markdown|json)', 'markdown')
    .option('--out <path>', 'Output file path (default under .sce/steering/compiled)')
    .option('--json', 'Output command result as JSON')
    .action(async (options) => {
      try {
        const workspaceRoot = process.cwd();
        const tool = normalizeToolName(options.tool || 'codex');
        const format = _normalizeFormat(options.format);
        const contract = new SteeringContract(workspaceRoot);
        await contract.ensureContract();
        const payload = await contract.buildCompilePayload(tool, options.agentVersion);

        const outputPath = options.out
          ? path.resolve(workspaceRoot, options.out)
          : path.join(workspaceRoot, '.sce', 'steering', 'compiled', `steering-${tool}.${format === 'json' ? 'json' : 'md'}`);
        await fs.ensureDir(path.dirname(outputPath));

        if (format === 'json') {
          await fs.writeJson(outputPath, payload, { spaces: 2 });
        } else {
          await fs.writeFile(outputPath, contract.renderMarkdown(payload), 'utf8');
        }

        const response = {
          success: true,
          action: 'steering_compile',
          tool,
          format,
          agent_version: payload.agent_version,
          source_mode: payload.source_mode,
          compatibility: payload.compatibility,
          output: path.relative(workspaceRoot, outputPath).replace(/\\/g, '/'),
        };

        if (options.json) {
          console.log(JSON.stringify(response, null, 2));
          return;
        }

        console.log(chalk.green('✓ Steering compiled'));
        console.log(chalk.gray(`Tool: ${tool}`));
        console.log(chalk.gray(`Format: ${format}`));
        console.log(chalk.gray(`Source mode: ${payload.source_mode}`));
        console.log(chalk.gray(`Compatibility: ${payload.compatibility.supported === null ? 'unknown' : payload.compatibility.supported} (${payload.compatibility.rule})`));
        console.log(chalk.gray(`Output: ${response.output}`));
      } catch (error) {
        _exitWithError(error, options.json);
      }
    });
}

function _normalizeFormat(format) {
  const normalized = `${format || 'markdown'}`.trim().toLowerCase();
  if (normalized === 'json') {
    return 'json';
  }
  return 'markdown';
}

function _exitWithError(error, asJson = false) {
  if (asJson) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
    }, null, 2));
  } else {
    console.error(chalk.red('Error:'), error.message);
  }
  process.exit(1);
}

module.exports = {
  registerSteeringCommands,
};
