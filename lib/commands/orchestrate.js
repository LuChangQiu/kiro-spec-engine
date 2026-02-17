/**
 * CLI commands for Agent Orchestration
 *
 * Provides `kse orchestrate run|status|stop` subcommands for managing
 * parallel Spec execution via Codex CLI sub-agents.
 *
 * Requirements: 6.1 (run), 6.2 (status), 6.3 (stop), 6.4 (spec validation), 6.5 (maxParallel validation)
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const SPECS_DIR = '.kiro/specs';
const STATUS_FILE = '.kiro/config/orchestration-status.json';

/**
 * Run orchestration programmatically.
 *
 * @param {object} options
 * @param {string} [options.specs] - Comma separated spec names
 * @param {string[]} [options.specNames] - Explicit spec names array
 * @param {number} [options.maxParallel]
 * @param {boolean} [options.json]
 * @param {boolean} [options.silent]
 * @param {object} dependencies
 * @param {string} [dependencies.workspaceRoot]
 * @returns {Promise<object>}
 */
async function runOrchestration(options = {}, dependencies = {}) {
  const workspaceRoot = dependencies.workspaceRoot || process.cwd();
  const specNames = Array.isArray(options.specNames)
    ? options.specNames.map(name => `${name}`.trim()).filter(Boolean)
    : _parseSpecNamesOption(options.specs);

  if (specNames.length === 0) {
    throw new Error('No specs specified');
  }

  const maxParallel = options.maxParallel;
  if (maxParallel !== undefined && (isNaN(maxParallel) || maxParallel < 1)) {
    throw new Error('--max-parallel must be >= 1');
  }

  const missing = await _validateSpecs(workspaceRoot, specNames);
  if (missing.length > 0) {
    throw new Error(`Specs not found: ${missing.join(', ')}`);
  }

  const { OrchestratorConfig } = require('../orchestrator/orchestrator-config');
  const { BootstrapPromptBuilder } = require('../orchestrator/bootstrap-prompt-builder');
  const { AgentSpawner } = require('../orchestrator/agent-spawner');
  const { StatusMonitor } = require('../orchestrator/status-monitor');
  const { OrchestrationEngine } = require('../orchestrator/orchestration-engine');

  const DependencyManager = require('../collab/dependency-manager');
  const MetadataManager = require('../collab/metadata-manager');
  const { AgentRegistry } = require('../collab/agent-registry');
  const { SpecLifecycleManager } = require('../collab/spec-lifecycle-manager');
  const { MachineIdentifier } = require('../lock/machine-identifier');

  let contextSyncManager = null;
  try {
    const { ContextSyncManager } = require('../steering/context-sync-manager');
    contextSyncManager = new ContextSyncManager(workspaceRoot);
  } catch (_err) {
    // Non-fatal — status sync will be skipped
  }

  const orchestratorConfig = new OrchestratorConfig(workspaceRoot);
  const config = await orchestratorConfig.getConfig();
  const effectiveMaxParallel = maxParallel || config.maxParallel;

  const bootstrapPromptBuilder = new BootstrapPromptBuilder(workspaceRoot, orchestratorConfig);
  const machineIdentifier = new MachineIdentifier(
    path.join(workspaceRoot, '.kiro', 'config')
  );
  const agentRegistry = new AgentRegistry(workspaceRoot, machineIdentifier);
  const agentSpawner = new AgentSpawner(
    workspaceRoot, orchestratorConfig, agentRegistry, bootstrapPromptBuilder
  );
  const metadataManager = new MetadataManager(workspaceRoot);
  const dependencyManager = new DependencyManager(metadataManager);
  const specLifecycleManager = new SpecLifecycleManager(
    workspaceRoot, contextSyncManager, agentRegistry
  );
  const statusMonitor = new StatusMonitor(specLifecycleManager, contextSyncManager);

  const engine = new OrchestrationEngine(workspaceRoot, {
    agentSpawner,
    dependencyManager,
    specLifecycleManager,
    statusMonitor,
    orchestratorConfig,
    agentRegistry,
  });

  if (!options.silent && !options.json) {
    console.log(
      chalk.blue('🚀'),
      `Starting orchestration for ${specNames.length} spec(s) (max-parallel: ${effectiveMaxParallel})...`
    );
  }

  const statusIntervalMs = Number.isInteger(options.statusIntervalMs) && options.statusIntervalMs > 0
    ? options.statusIntervalMs
    : 1000;

  let statusWriteChain = Promise.resolve();
  const persistStatus = () => {
    const statusSnapshot = engine.getStatus();
    statusWriteChain = statusWriteChain.then(async () => {
      await _writeStatus(workspaceRoot, statusSnapshot);
      if (typeof options.onStatus === 'function') {
        await Promise.resolve(options.onStatus(statusSnapshot));
      }
    }).catch(() => {});
    return statusWriteChain;
  };

  const statusEvents = [
    'batch:start',
    'batch:complete',
    'spec:start',
    'spec:complete',
    'spec:failed',
    'spec:rate-limited',
    'parallel:throttled',
    'parallel:recovered',
    'orchestration:complete'
  ];

  for (const eventName of statusEvents) {
    engine.on(eventName, () => {
      void persistStatus();
    });
  }

  const statusTimer = setInterval(() => {
    void persistStatus();
  }, statusIntervalMs);
  if (typeof statusTimer.unref === 'function') {
    statusTimer.unref();
  }

  let result;
  try {
    result = await engine.start(specNames, { maxParallel: effectiveMaxParallel });
  } finally {
    clearInterval(statusTimer);
    await persistStatus();
    await statusWriteChain;
  }

  if (!options.silent) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      _printResult(result);
    }
  }

  return result;
}

/**
 * Register orchestrate commands on the given Commander program.
 * @param {import('commander').Command} program
 */
function registerOrchestrateCommands(program) {
  const orchestrate = program
    .command('orchestrate')
    .description('Manage agent orchestration for parallel Spec execution');

  // ── kse orchestrate run ──────────────────────────────────────────
  orchestrate
    .command('run')
    .description('Start orchestration for specified Specs')
    .requiredOption('--specs <specs>', 'Comma-separated list of Spec names')
    .option('--max-parallel <n>', 'Maximum parallel agents', parseInt)
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const result = await runOrchestration(options);

        if (result.status === 'failed') {
          process.exit(1);
        }
      } catch (err) {
        _errorAndExit(err.message, options.json);
      }
    });

  // ── kse orchestrate status ───────────────────────────────────────
  orchestrate
    .command('status')
    .description('Show current orchestration status')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const workspaceRoot = process.cwd();
        const status = await _readStatus(workspaceRoot);

        if (!status) {
          if (options.json) {
            console.log(JSON.stringify({ status: 'idle', message: 'No orchestration data found' }));
          } else {
            console.log(chalk.gray('No orchestration data found. Run `kse orchestrate run` first.'));
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          _printStatus(status);
        }
      } catch (err) {
        _errorAndExit(err.message, options.json);
      }
    });

  // ── kse orchestrate stop ─────────────────────────────────────────
  orchestrate
    .command('stop')
    .description('Stop all running agents')
    .action(async () => {
      try {
        const workspaceRoot = process.cwd();
        const status = await _readStatus(workspaceRoot);

        if (!status || status.status !== 'running') {
          console.log(chalk.gray('No running orchestration to stop.'));
          return;
        }

        // Write a stop signal into the status file
        status.status = 'stopped';
        status.completedAt = new Date().toISOString();
        await _writeStatus(workspaceRoot, status);

        console.log(chalk.yellow('⏹'), 'Stop signal sent. Running agents will be terminated.');
      } catch (err) {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
      }
    });
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Validate that all spec directories exist.
 * @param {string} workspaceRoot
 * @param {string[]} specNames
 * @returns {Promise<string[]>} Missing spec names
 */
async function _validateSpecs(workspaceRoot, specNames) {
  const missing = [];
  for (const name of specNames) {
    const specDir = path.join(workspaceRoot, SPECS_DIR, name);
    const exists = await fs.pathExists(specDir);
    if (!exists) {
      missing.push(name);
    }
  }
  return missing;
}

/**
 * Read persisted orchestration status.
 * @param {string} workspaceRoot
 * @returns {Promise<object|null>}
 */
async function _readStatus(workspaceRoot) {
  const statusPath = path.join(workspaceRoot, STATUS_FILE);
  try {
    return await fs.readJson(statusPath);
  } catch (_err) {
    return null;
  }
}

/**
 * Persist orchestration status to disk.
 * @param {string} workspaceRoot
 * @param {object} status
 */
async function _writeStatus(workspaceRoot, status) {
  const statusPath = path.join(workspaceRoot, STATUS_FILE);
  await fs.ensureDir(path.dirname(statusPath));
  await fs.writeJson(statusPath, status, { spaces: 2 });
}

/**
 * Print a human-readable orchestration result.
 * @param {object} result
 */
function _printResult(result) {
  const icon = result.status === 'completed' ? chalk.green('✓') : chalk.red('✗');
  console.log(`${icon} Orchestration ${result.status}`);
  if (result.totalSpecs !== undefined) {
    console.log(chalk.gray(`  Total: ${result.totalSpecs}  Completed: ${result.completedSpecs}  Failed: ${result.failedSpecs}`));
  }
  if (result.specs) {
    for (const [name, info] of Object.entries(result.specs)) {
      const sym = _statusSymbol(info.status);
      const extra = info.error ? chalk.gray(` — ${info.error}`) : '';
      console.log(`  ${sym} ${name}${extra}`);
    }
  }
}

/**
 * Print a human-readable orchestration status.
 * @param {object} status
 */
function _printStatus(status) {
  console.log(chalk.bold('Orchestration Status'));
  console.log(chalk.gray('===================='));
  console.log(`Status: ${_statusSymbol(status.status)} ${status.status}`);
  if (status.totalSpecs !== undefined) {
    console.log(`Total: ${status.totalSpecs}  Completed: ${status.completedSpecs || 0}  Failed: ${status.failedSpecs || 0}  Running: ${status.runningSpecs || 0}`);
  }
  if (status.currentBatch !== undefined && status.totalBatches !== undefined) {
    console.log(`Batch: ${status.currentBatch} / ${status.totalBatches}`);
  }
  if (status.parallel) {
    const effective = status.parallel.effectiveMaxParallel ?? '-';
    const max = status.parallel.maxParallel ?? '-';
    const adaptive = status.parallel.adaptive === false ? 'off' : 'on';
    console.log(`Parallel: ${effective} / ${max} (adaptive: ${adaptive})`);
  }
  if (status.rateLimit) {
    const signals = status.rateLimit.signalCount || 0;
    const backoff = status.rateLimit.totalBackoffMs || 0;
    console.log(`Rate-limit: ${signals} signal(s), total backoff ${backoff}ms`);

    const holdWindowMs = Number(status.rateLimit.lastLaunchHoldMs) || 0;
    const lastSignalAtMs = Date.parse(status.rateLimit.lastSignalAt || '');
    const elapsedSinceSignalMs = Number.isFinite(lastSignalAtMs)
      ? Math.max(0, Date.now() - lastSignalAtMs)
      : Infinity;
    const holdRemainingMs = holdWindowMs > 0
      ? Math.max(0, holdWindowMs - elapsedSinceSignalMs)
      : 0;
    if (holdRemainingMs > 0) {
      console.log(`Rate-limit launch hold: ${holdRemainingMs}ms remaining`);
    }
  }
  if (status.specs) {
    console.log('');
    for (const [name, info] of Object.entries(status.specs)) {
      const sym = _statusSymbol(info.status);
      const extra = info.error ? chalk.gray(` — ${info.error}`) : '';
      console.log(`  ${sym} ${name}${extra}`);
    }
  }
}

/**
 * Map status string to a coloured symbol.
 * @param {string} status
 * @returns {string}
 */
function _statusSymbol(status) {
  const map = {
    completed: chalk.green('✓'),
    running: chalk.yellow('⧗'),
    pending: chalk.gray('○'),
    failed: chalk.red('✗'),
    timeout: chalk.red('⏱'),
    skipped: chalk.gray('⊘'),
    idle: chalk.gray('○'),
    stopped: chalk.yellow('⏹'),
  };
  return map[status] || '?';
}

/**
 * Print an error and exit. Respects --json mode.
 * @param {string} message
 * @param {boolean} [json]
 */
function _errorAndExit(message, json) {
  if (json) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(chalk.red('Error:'), message);
  }
  process.exit(1);
}

/**
 * Parse a comma-separated specs option.
 * @param {string} specsOption
 * @returns {string[]}
 */
function _parseSpecNamesOption(specsOption) {
  if (!specsOption || typeof specsOption !== 'string') {
    return [];
  }

  return specsOption
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

module.exports = {
  registerOrchestrateCommands,
  runOrchestration,
};
