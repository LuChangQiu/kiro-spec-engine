/**
 * CLI commands for Agent Orchestration
 *
 * Provides `sce orchestrate run|status|stop` subcommands for managing
 * parallel Spec execution via Codex CLI sub-agents.
 *
 * Requirements: 6.1 (run), 6.2 (status), 6.3 (stop), 6.4 (spec validation), 6.5 (maxParallel validation)
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const SPECS_DIR = '.sce/specs';
const STATUS_FILE = '.sce/config/orchestration-status.json';
const ORCHESTRATOR_CONFIG_FILE = '.sce/config/orchestrator.json';
const FALLBACK_RATE_LIMIT_PROFILE_PRESETS = Object.freeze({
  conservative: true,
  balanced: true,
  aggressive: true,
});
const RATE_LIMIT_FIELD_KEYS = Object.freeze([
  'rateLimitMaxRetries',
  'rateLimitBackoffBaseMs',
  'rateLimitBackoffMaxMs',
  'rateLimitAdaptiveParallel',
  'rateLimitParallelFloor',
  'rateLimitCooldownMs',
  'rateLimitLaunchBudgetPerMinute',
  'rateLimitLaunchBudgetWindowMs',
  'rateLimitSignalWindowMs',
  'rateLimitSignalThreshold',
  'rateLimitSignalExtraHoldMs',
  'rateLimitDynamicBudgetFloor',
]);

/**
 * Run orchestration programmatically.
 *
 * @param {object} options
 * @param {string} [options.specs] - Comma separated spec names
 * @param {string[]} [options.specNames] - Explicit spec names array
 * @param {number} [options.maxParallel]
 * @param {string} [options.rateLimitProfile]
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

  const rawRateLimitProfile = options.rateLimitProfile === undefined || options.rateLimitProfile === null
    ? null
    : `${options.rateLimitProfile}`.trim().toLowerCase();

  const missing = await _validateSpecs(workspaceRoot, specNames);
  if (missing.length > 0) {
    throw new Error(`Specs not found: ${missing.join(', ')}`);
  }

  const orchestratorConfigModule = require('../orchestrator/orchestrator-config');
  const {
    OrchestratorConfig,
    RATE_LIMIT_PROFILE_PRESETS,
    buildRateLimitProfileConfig
  } = orchestratorConfigModule;
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
  const availableProfiles = Object.keys(
    RATE_LIMIT_PROFILE_PRESETS || FALLBACK_RATE_LIMIT_PROFILE_PRESETS
  );
  const selectedRateLimitProfile = rawRateLimitProfile || null;
  if (selectedRateLimitProfile && !availableProfiles.includes(selectedRateLimitProfile)) {
    throw new Error(
      `--rate-limit-profile must be one of: ${availableProfiles.join(', ')}`
    );
  }
  const runtimeRateLimitOverrides = selectedRateLimitProfile
    ? (typeof buildRateLimitProfileConfig === 'function'
      ? buildRateLimitProfileConfig(selectedRateLimitProfile)
      : { rateLimitProfile: selectedRateLimitProfile })
    : null;
  const effectiveMaxParallel = maxParallel || config.maxParallel;

  const bootstrapPromptBuilder = new BootstrapPromptBuilder(workspaceRoot, orchestratorConfig);
  const machineIdentifier = new MachineIdentifier(
    path.join(workspaceRoot, '.sce', 'config')
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
      `Starting orchestration for ${specNames.length} spec(s) (max-parallel: ${effectiveMaxParallel})${selectedRateLimitProfile ? `, rate-limit-profile: ${selectedRateLimitProfile}` : ''}...`
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
    'launch:budget-hold',
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
    result = await engine.start(specNames, {
      maxParallel: effectiveMaxParallel,
      configOverrides: runtimeRateLimitOverrides
    });
  } finally {
    clearInterval(statusTimer);
    await persistStatus();
    await statusWriteChain;
  }

  const finalStatus = engine.getStatus();
  if (result && typeof result === 'object' && finalStatus && typeof finalStatus === 'object') {
    if (finalStatus.rateLimit && typeof finalStatus.rateLimit === 'object') {
      result.rateLimit = { ...finalStatus.rateLimit };
    }
    if (finalStatus.parallel && typeof finalStatus.parallel === 'object') {
      result.parallel = { ...finalStatus.parallel };
    }
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

  // ── sce orchestrate run ──────────────────────────────────────────
  orchestrate
    .command('run')
    .description('Start orchestration for specified Specs')
    .requiredOption('--specs <specs>', 'Comma-separated list of Spec names')
    .option('--max-parallel <n>', 'Maximum parallel agents', parseInt)
    .option(
      '--rate-limit-profile <profile>',
      'Rate-limit profile (conservative|balanced|aggressive)'
    )
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

  // ── sce orchestrate status ───────────────────────────────────────
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
            console.log(chalk.gray('No orchestration data found. Run `sce orchestrate run` first.'));
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

  // ── sce orchestrate stop ─────────────────────────────────────────
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

  // ── sce orchestrate profile * ────────────────────────────────────
  const profile = orchestrate
    .command('profile')
    .description('Manage orchestrator rate-limit profiles');

  profile
    .command('list')
    .description('List available rate-limit profiles')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const orchestratorConfigModule = require('../orchestrator/orchestrator-config');
        const presets = orchestratorConfigModule.RATE_LIMIT_PROFILE_PRESETS || FALLBACK_RATE_LIMIT_PROFILE_PRESETS;
        const profiles = Object.keys(presets);

        if (options.json) {
          console.log(JSON.stringify({ profiles }, null, 2));
          return;
        }

        console.log(chalk.bold('Rate-limit profiles'));
        for (const item of profiles) {
          console.log(`  - ${item}`);
        }
      } catch (err) {
        _errorAndExit(err.message, options.json);
      }
    });

  profile
    .command('show')
    .description('Show active rate-limit profile and effective anti-429 settings')
    .option('--json', 'Output in JSON format')
    .action(async (options) => {
      try {
        const workspaceRoot = process.cwd();
        const orchestratorConfigModule = require('../orchestrator/orchestrator-config');
        const { OrchestratorConfig, RATE_LIMIT_PROFILE_PRESETS, resolveRateLimitProfileName } = orchestratorConfigModule;
        const presets = RATE_LIMIT_PROFILE_PRESETS || FALLBACK_RATE_LIMIT_PROFILE_PRESETS;
        const availableProfiles = Object.keys(presets);

        const orchestratorConfig = new OrchestratorConfig(workspaceRoot);
        const effectiveConfig = await orchestratorConfig.getConfig();
        const rawConfig = await _readRawOrchestratorConfig(workspaceRoot);
        const activeProfile = typeof resolveRateLimitProfileName === 'function'
          ? resolveRateLimitProfileName(effectiveConfig.rateLimitProfile, 'balanced')
          : `${effectiveConfig.rateLimitProfile || 'balanced'}`;
        const preset = presets[activeProfile] || {};
        const overrides = [];
        for (const field of RATE_LIMIT_FIELD_KEYS) {
          if (
            Object.prototype.hasOwnProperty.call(rawConfig, field) &&
            Object.prototype.hasOwnProperty.call(preset, field) &&
            rawConfig[field] !== preset[field]
          ) {
            overrides.push(field);
          }
        }
        const effectiveRateLimit = {};
        for (const field of RATE_LIMIT_FIELD_KEYS) {
          effectiveRateLimit[field] = effectiveConfig[field];
        }

        const payload = {
          profile: activeProfile,
          available_profiles: availableProfiles,
          explicit_overrides: overrides,
          effective: effectiveRateLimit,
        };

        if (options.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(chalk.bold(`Active rate-limit profile: ${activeProfile}`));
        if (overrides.length > 0) {
          console.log(chalk.yellow(`Explicit overrides: ${overrides.join(', ')}`));
        } else {
          console.log(chalk.gray('Explicit overrides: none'));
        }
        for (const field of RATE_LIMIT_FIELD_KEYS) {
          console.log(`  ${field}: ${effectiveRateLimit[field]}`);
        }
      } catch (err) {
        _errorAndExit(err.message, options.json);
      }
    });

  profile
    .command('set')
    .description('Set persistent rate-limit profile in .sce/config/orchestrator.json')
    .argument('<profile>', 'Profile name (conservative|balanced|aggressive)')
    .option('--reset-overrides', 'Reset explicit rateLimit* overrides to profile defaults')
    .option('--json', 'Output in JSON format')
    .action(async (profileName, options) => {
      try {
        const workspaceRoot = process.cwd();
        const orchestratorConfigModule = require('../orchestrator/orchestrator-config');
        const {
          OrchestratorConfig,
          RATE_LIMIT_PROFILE_PRESETS,
          resolveRateLimitProfileName,
          buildRateLimitProfileConfig
        } = orchestratorConfigModule;
        const presets = RATE_LIMIT_PROFILE_PRESETS || FALLBACK_RATE_LIMIT_PROFILE_PRESETS;
        const availableProfiles = Object.keys(presets);
        const normalizedInput = `${profileName || ''}`.trim().toLowerCase();
        if (!availableProfiles.includes(normalizedInput)) {
          throw new Error(`profile must be one of: ${availableProfiles.join(', ')}`);
        }

        const resolvedProfile = typeof resolveRateLimitProfileName === 'function'
          ? resolveRateLimitProfileName(normalizedInput, 'balanced')
          : normalizedInput;
        const orchestratorConfig = new OrchestratorConfig(workspaceRoot);
        let updated;

        if (options.resetOverrides && typeof buildRateLimitProfileConfig === 'function') {
          updated = await orchestratorConfig.updateConfig(buildRateLimitProfileConfig(resolvedProfile));
        } else {
          updated = await orchestratorConfig.updateConfig({ rateLimitProfile: resolvedProfile });
        }

        const payload = {
          profile: resolvedProfile,
          reset_overrides: !!options.resetOverrides,
          config_file: ORCHESTRATOR_CONFIG_FILE,
          effective: RATE_LIMIT_FIELD_KEYS.reduce((acc, key) => {
            acc[key] = updated[key];
            return acc;
          }, {})
        };

        if (options.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }

        console.log(chalk.green(`Set rate-limit profile: ${resolvedProfile}`));
        if (options.resetOverrides) {
          console.log(chalk.gray('Explicit rateLimit* overrides reset to profile defaults.'));
        } else {
          console.log(chalk.gray('Existing explicit rateLimit* overrides (if any) are preserved.'));
        }
        console.log(chalk.gray(`Config updated: ${ORCHESTRATOR_CONFIG_FILE}`));
      } catch (err) {
        _errorAndExit(err.message, options.json);
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
 * Read raw orchestrator config file (without default merge).
 * @param {string} workspaceRoot
 * @returns {Promise<object>}
 */
async function _readRawOrchestratorConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, ORCHESTRATOR_CONFIG_FILE);
  try {
    const payload = await fs.readJson(configPath);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }
    return payload;
  } catch (_err) {
    return {};
  }
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

    const launchBudgetPerMinute = Number(status.rateLimit.launchBudgetPerMinute);
    if (Number.isFinite(launchBudgetPerMinute) && launchBudgetPerMinute > 0) {
      const launchBudgetWindowMs = Number(status.rateLimit.launchBudgetWindowMs) || 60000;
      const launchBudgetUsed = Number(status.rateLimit.launchBudgetUsed) || 0;
      const launchBudgetHoldCount = Number(status.rateLimit.launchBudgetHoldCount) || 0;
      console.log(
        `Launch budget: ${launchBudgetUsed}/${launchBudgetPerMinute} in ${launchBudgetWindowMs}ms (holds: ${launchBudgetHoldCount})`
      );

      const launchBudgetHoldWindowMs = Number(status.rateLimit.lastLaunchBudgetHoldMs) || 0;
      const lastLaunchBudgetHoldAtMs = Date.parse(status.rateLimit.lastLaunchBudgetHoldAt || '');
      const elapsedSinceBudgetHoldMs = Number.isFinite(lastLaunchBudgetHoldAtMs)
        ? Math.max(0, Date.now() - lastLaunchBudgetHoldAtMs)
        : Infinity;
      const budgetHoldRemainingMs = launchBudgetHoldWindowMs > 0
        ? Math.max(0, launchBudgetHoldWindowMs - elapsedSinceBudgetHoldMs)
        : 0;
      if (budgetHoldRemainingMs > 0) {
        console.log(`Launch budget hold: ${budgetHoldRemainingMs}ms remaining`);
      }
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
