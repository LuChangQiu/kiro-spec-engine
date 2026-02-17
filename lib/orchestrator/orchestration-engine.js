/**
 * Orchestration Engine — Batch Scheduling Engine (Core)
 *
 * Coordinates all orchestrator components: builds dependency graphs via
 * DependencyManager, computes topological batches, spawns agents via
 * AgentSpawner, tracks status via StatusMonitor, and integrates with
 * SpecLifecycleManager and AgentRegistry.
 *
 * Requirements: 3.1-3.7 (dependency graph, batches, parallel, failure propagation)
 *               5.1-5.6 (crash detection, retry, timeout, graceful stop, deregister)
 *               8.1-8.5 (SLM transitions, AgentRegistry, TaskLockManager, CSM sync)
 */

const { EventEmitter } = require('events');
const path = require('path');
const fsUtils = require('../utils/fs-utils');

const SPECS_DIR = '.kiro/specs';
const DEFAULT_RATE_LIMIT_MAX_RETRIES = 6;
const DEFAULT_RATE_LIMIT_BACKOFF_BASE_MS = 1000;
const DEFAULT_RATE_LIMIT_BACKOFF_MAX_MS = 30000;
const DEFAULT_RATE_LIMIT_ADAPTIVE_PARALLEL = true;
const DEFAULT_RATE_LIMIT_PARALLEL_FLOOR = 1;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30000;
const DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_PER_MINUTE = 12;
const DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_WINDOW_MS = 60000;
const RATE_LIMIT_BACKOFF_JITTER_RATIO = 0.5;
const RATE_LIMIT_RETRY_AFTER_MAX_MS = 10 * 60 * 1000;
const RATE_LIMIT_ERROR_PATTERNS = [
  /(^|[^0-9])429([^0-9]|$)/i,
  /too many requests/i,
  /rate[\s-]?limit/i,
  /resource exhausted/i,
  /quota exceeded/i,
  /exceeded.*quota/i,
  /requests per minute/i,
  /tokens per minute/i,
];

class OrchestrationEngine extends EventEmitter {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {object} options
   * @param {import('./agent-spawner').AgentSpawner} options.agentSpawner
   * @param {import('../collab/dependency-manager')} options.dependencyManager
   * @param {import('../collab/spec-lifecycle-manager').SpecLifecycleManager} options.specLifecycleManager
   * @param {import('./status-monitor').StatusMonitor} options.statusMonitor
   * @param {import('./orchestrator-config').OrchestratorConfig} options.orchestratorConfig
   * @param {import('../collab/agent-registry').AgentRegistry} options.agentRegistry
   */
  constructor(workspaceRoot, options) {
    super();
    this._workspaceRoot = workspaceRoot;
    this._agentSpawner = options.agentSpawner;
    this._dependencyManager = options.dependencyManager;
    this._specLifecycleManager = options.specLifecycleManager;
    this._statusMonitor = options.statusMonitor;
    this._orchestratorConfig = options.orchestratorConfig;
    this._agentRegistry = options.agentRegistry;

    /** @type {'idle'|'running'|'completed'|'failed'|'stopped'} */
    this._state = 'idle';
    /** @type {Map<string, string>} specName → agentId */
    this._runningAgents = new Map();
    /** @type {Map<string, number>} specName → retry count */
    this._retryCounts = new Map();
    /** @type {Set<string>} specs marked as final failure */
    this._failedSpecs = new Set();
    /** @type {Set<string>} specs skipped due to dependency failure */
    this._skippedSpecs = new Set();
    /** @type {Set<string>} specs completed successfully */
    this._completedSpecs = new Set();
    /** @type {boolean} whether stop() has been called */
    this._stopped = false;
    /** @type {object|null} execution plan */
    this._executionPlan = null;
    /** @type {number} max retries for rate-limit failures */
    this._rateLimitMaxRetries = DEFAULT_RATE_LIMIT_MAX_RETRIES;
    /** @type {number} base delay for rate-limit retries */
    this._rateLimitBackoffBaseMs = DEFAULT_RATE_LIMIT_BACKOFF_BASE_MS;
    /** @type {number} max delay for rate-limit retries */
    this._rateLimitBackoffMaxMs = DEFAULT_RATE_LIMIT_BACKOFF_MAX_MS;
    /** @type {boolean} enable adaptive parallel throttling on rate-limit signals */
    this._rateLimitAdaptiveParallel = DEFAULT_RATE_LIMIT_ADAPTIVE_PARALLEL;
    /** @type {number} minimum effective parallelism during rate-limit cooldown */
    this._rateLimitParallelFloor = DEFAULT_RATE_LIMIT_PARALLEL_FLOOR;
    /** @type {number} cooldown before each adaptive parallel recovery step */
    this._rateLimitCooldownMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS;
    /** @type {number|null} configured max parallel for current run */
    this._baseMaxParallel = null;
    /** @type {number|null} dynamic effective parallel limit for current run */
    this._effectiveMaxParallel = null;
    /** @type {number} timestamp after which recovery can step up */
    this._rateLimitCooldownUntil = 0;
    /** @type {number} timestamp before which new launches are paused after rate-limit */
    this._rateLimitLaunchHoldUntil = 0;
    /** @type {number} max spec launches allowed within rolling launch-budget window */
    this._rateLimitLaunchBudgetPerMinute = DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_PER_MINUTE;
    /** @type {number} rolling window size for launch-budget throttling */
    this._rateLimitLaunchBudgetWindowMs = DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_WINDOW_MS;
    /** @type {number[]} timestamps (ms) of recent spec launches for rolling budget accounting */
    this._rateLimitLaunchTimestamps = [];
    /** @type {number} last launch-budget hold telemetry emission timestamp (ms) */
    this._launchBudgetLastHoldSignalAt = 0;
    /** @type {number} last launch-budget hold duration emitted to telemetry (ms) */
    this._launchBudgetLastHoldMs = 0;
    /** @type {() => number} */
    this._random = typeof options.random === 'function' ? options.random : Math.random;
    /** @type {() => number} */
    this._now = typeof options.now === 'function' ? options.now : Date.now;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start orchestration execution.
   *
   * 1. Validate spec existence
   * 2. Build dependency graph via DependencyManager (Req 3.1, 3.7)
   * 3. Detect circular dependencies (Req 3.2)
   * 4. Compute batches via topological sort (Req 3.3)
   * 5. Execute batches sequentially, specs within batch in parallel (Req 3.4, 3.5)
   *
   * @param {string[]} specNames - Specs to orchestrate
   * @param {object} [options]
   * @param {number} [options.maxParallel] - Override max parallel from config
   * @returns {Promise<object>} OrchestrationResult
   */
  async start(specNames, options = {}) {
    if (this._state === 'running') {
      throw new Error('Orchestration is already running');
    }

    this._reset();
    this._state = 'running';
    this._stopped = false;
    this._statusMonitor.setOrchestrationState('running');

    try {
      // Step 1: Validate spec existence (Req 6.4)
      const missingSpecs = await this._validateSpecExistence(specNames);
      if (missingSpecs.length > 0) {
        const error = `Specs not found: ${missingSpecs.join(', ')}`;
        this._state = 'failed';
        this._statusMonitor.setOrchestrationState('failed');
        return this._buildResult('failed', error);
      }

      // Step 2: Build dependency graph (Req 3.1, 3.7)
      const graph = await this._dependencyManager.buildDependencyGraph(specNames);

      // Step 3: Detect circular dependencies (Req 3.2)
      const cyclePath = this._dependencyManager.detectCircularDependencies(graph);
      if (cyclePath) {
        const error = `Circular dependency detected: ${cyclePath.join(' → ')}`;
        this._state = 'failed';
        this._statusMonitor.setOrchestrationState('failed');
        this._executionPlan = {
          specs: specNames,
          batches: [],
          dependencies: this._extractDependencies(graph, specNames),
          hasCycle: true,
          cyclePath,
        };
        return this._buildResult('failed', error);
      }

      // Step 4: Compute batches (Req 3.3)
      const dependencies = this._extractDependencies(graph, specNames);
      const batches = this._computeBatches(specNames, dependencies);

      this._executionPlan = {
        specs: specNames,
        batches,
        dependencies,
        hasCycle: false,
        cyclePath: null,
      };

      // Initialize specs in StatusMonitor
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        for (const specName of batches[batchIdx]) {
          this._statusMonitor.initSpec(specName, batchIdx);
        }
      }
      this._statusMonitor.setBatchInfo(0, batches.length);

      // Get config for maxParallel and maxRetries
      const config = await this._orchestratorConfig.getConfig();
      this._applyRetryPolicyConfig(config);
      const maxParallel = options.maxParallel || config.maxParallel || 3;
      const maxRetries = config.maxRetries || 2;
      this._initializeAdaptiveParallel(maxParallel);

      // Step 5: Execute batches (Req 3.4)
      await this._executeBatches(batches, maxParallel, maxRetries);

      // Determine final state
      if (this._stopped) {
        this._state = 'stopped';
        this._statusMonitor.setOrchestrationState('stopped');
      } else if (this._failedSpecs.size > 0) {
        this._state = 'failed';
        this._statusMonitor.setOrchestrationState('failed');
      } else {
        this._state = 'completed';
        this._statusMonitor.setOrchestrationState('completed');
      }

      this.emit('orchestration:complete', this._buildResult(this._state));
      return this._buildResult(this._state);
    } catch (err) {
      this._state = 'failed';
      this._statusMonitor.setOrchestrationState('failed');
      return this._buildResult('failed', err.message);
    }
  }

  /**
   * Gracefully stop all running agents and halt orchestration (Req 5.5).
   * @returns {Promise<void>}
   */
  async stop() {
    this._stopped = true;

    if (this._state !== 'running') {
      return;
    }

    // Kill all running agents
    await this._agentSpawner.killAll();

    // Mark running specs as stopped
    for (const [specName] of this._runningAgents) {
      this._statusMonitor.updateSpecStatus(specName, 'skipped', null, 'Orchestration stopped');
    }
    this._runningAgents.clear();

    this._state = 'stopped';
    this._statusMonitor.setOrchestrationState('stopped');
  }

  /**
   * Get current orchestration status.
   * @returns {object} OrchestrationStatus
   */
  getStatus() {
    return this._statusMonitor.getOrchestrationStatus();
  }

  // ---------------------------------------------------------------------------
  // Batch Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute all batches sequentially.
   * Within each batch, specs run in parallel up to maxParallel.
   *
   * @param {string[][]} batches
   * @param {number} maxParallel
   * @param {number} maxRetries
   * @returns {Promise<void>}
   * @private
   */
  async _executeBatches(batches, maxParallel, maxRetries) {
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      if (this._stopped) break;

      const batch = batches[batchIdx];
      this._statusMonitor.setBatchInfo(batchIdx + 1, batches.length);

      // Filter out skipped specs (dependency failures)
      const executableSpecs = batch.filter(s => !this._skippedSpecs.has(s));

      if (executableSpecs.length === 0) {
        continue;
      }

      this.emit('batch:start', { batch: batchIdx, specs: executableSpecs });

      // Execute specs in parallel with maxParallel limit
      await this._executeSpecsInParallel(executableSpecs, maxParallel, maxRetries);

      this.emit('batch:complete', {
        batch: batchIdx,
        completed: executableSpecs.filter(s => this._completedSpecs.has(s)),
        failed: executableSpecs.filter(s => this._failedSpecs.has(s)),
        skipped: executableSpecs.filter(s => this._skippedSpecs.has(s)),
      });
    }
  }

  /**
   * Execute a set of specs in parallel, respecting maxParallel limit (Req 3.5).
   *
   * @param {string[]} specNames
   * @param {number} maxParallel
   * @param {number} maxRetries
   * @returns {Promise<void>}
   * @private
   */
  async _executeSpecsInParallel(specNames, maxParallel, maxRetries) {
    const pending = [...specNames];
    const inFlight = new Map(); // specName → Promise

    const launchNext = async () => {
      while (pending.length > 0 && !this._stopped) {
        const rateLimitHoldMs = this._getRateLimitLaunchHoldRemainingMs();
        const launchBudgetHoldMs = this._getLaunchBudgetHoldRemainingMs();
        const launchHoldMs = Math.max(rateLimitHoldMs, launchBudgetHoldMs);
        if (launchHoldMs > 0) {
          // Pause new launches when provider asks us to retry later or launch budget is exhausted.
          if (launchBudgetHoldMs > 0) {
            this._onLaunchBudgetHold(launchBudgetHoldMs);
          }
          await this._sleep(Math.min(launchHoldMs, 1000));
          continue;
        }

        if (inFlight.size >= this._getEffectiveMaxParallel(maxParallel)) {
          break;
        }

        const specName = pending.shift();
        if (this._skippedSpecs.has(specName)) continue;

        this._recordLaunchStart();
        const promise = this._executeSpec(specName, maxRetries);
        inFlight.set(specName, promise);

        // When done, remove from inFlight and try to launch more
        promise.then(() => {
          inFlight.delete(specName);
        });
      }
    };

    // Initial launch
    await launchNext();

    // Wait for all in-flight specs to complete, launching new ones as slots open
    while (inFlight.size > 0 && !this._stopped) {
      // Wait for any one to complete
      await Promise.race(inFlight.values());
      // Launch more if slots available
      await launchNext();
    }
  }

  // ---------------------------------------------------------------------------
  // Single Spec Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a single spec with retry support (Req 5.2, 5.3).
   *
   * @param {string} specName
   * @param {number} maxRetries
   * @returns {Promise<void>}
   * @private
   */
  async _executeSpec(specName, maxRetries) {
    if (this._stopped) return;

    this._retryCounts.set(specName, this._retryCounts.get(specName) || 0);

    // Transition to assigned then in-progress via SLM (Req 8.1)
    await this._transitionSafe(specName, 'assigned');
    await this._transitionSafe(specName, 'in-progress');

    this._statusMonitor.updateSpecStatus(specName, 'running');
    this.emit('spec:start', { specName });

    try {
      // Spawn agent via AgentSpawner
      const agent = await this._agentSpawner.spawn(specName);
      this._runningAgents.set(specName, agent.agentId);

      // Wait for agent completion
      const result = await this._waitForAgent(specName, agent.agentId);

      this._runningAgents.delete(specName);

      if (result.status === 'completed') {
        await this._handleSpecCompleted(specName, agent.agentId);
      } else {
        // failed or timeout (Req 5.1, 5.4)
        await this._handleSpecFailed(specName, agent.agentId, maxRetries, result.error);
      }
    } catch (err) {
      // Spawn failure (Req 5.1)
      this._runningAgents.delete(specName);
      await this._handleSpecFailed(specName, null, maxRetries, err.message);
    }
  }

  /**
   * Wait for an agent to complete, fail, or timeout.
   * Returns a promise that resolves with the outcome.
   *
   * @param {string} specName
   * @param {string} agentId
   * @returns {Promise<{status: string, error: string|null}>}
   * @private
   */
  _waitForAgent(specName, agentId) {
    return new Promise((resolve) => {
      const onCompleted = (data) => {
        if (data.agentId === agentId) {
          cleanup();
          resolve({ status: 'completed', error: null });
        }
      };

      const onFailed = (data) => {
        if (data.agentId === agentId) {
          cleanup();
          const error = data.stderr || data.error || `Exit code: ${data.exitCode}`;
          resolve({ status: 'failed', error });
        }
      };

      const onTimeout = (data) => {
        if (data.agentId === agentId) {
          cleanup();
          resolve({ status: 'timeout', error: `Timeout after ${data.timeoutSeconds}s` });
        }
      };

      const cleanup = () => {
        this._agentSpawner.removeListener('agent:completed', onCompleted);
        this._agentSpawner.removeListener('agent:failed', onFailed);
        this._agentSpawner.removeListener('agent:timeout', onTimeout);
      };

      this._agentSpawner.on('agent:completed', onCompleted);
      this._agentSpawner.on('agent:failed', onFailed);
      this._agentSpawner.on('agent:timeout', onTimeout);
    });
  }

  /**
   * Handle successful spec completion (Req 8.2, 5.6).
   *
   * @param {string} specName
   * @param {string} agentId
   * @returns {Promise<void>}
   * @private
   */
  async _handleSpecCompleted(specName, agentId) {
    this._completedSpecs.add(specName);
    this._statusMonitor.updateSpecStatus(specName, 'completed', agentId);

    // Transition to completed via SLM (Req 8.2)
    await this._transitionSafe(specName, 'completed');

    // Sync external status (Req 8.5)
    await this._syncExternalSafe(specName, 'completed');

    this.emit('spec:complete', { specName, agentId });
  }

  /**
   * Handle spec failure — retry or propagate (Req 5.2, 5.3, 3.6).
   *
   * @param {string} specName
   * @param {string|null} agentId
   * @param {number} maxRetries
   * @param {string} error
   * @returns {Promise<void>}
   * @private
   */
  async _handleSpecFailed(specName, agentId, maxRetries, error) {
    const resolvedError = `${error || 'Unknown error'}`;
    const retryCount = this._retryCounts.get(specName) || 0;
    const isRateLimitError = this._isRateLimitError(resolvedError);
    const retryLimit = isRateLimitError
      ? Math.max(maxRetries, this._rateLimitMaxRetries || DEFAULT_RATE_LIMIT_MAX_RETRIES)
      : maxRetries;

    if (retryCount < retryLimit && !this._stopped) {
      // Retry (Req 5.2)
      this._retryCounts.set(specName, retryCount + 1);
      this._statusMonitor.incrementRetry(specName);
      this._statusMonitor.updateSpecStatus(specName, 'pending', null, resolvedError);

      const retryDelayMs = isRateLimitError
        ? Math.max(
          this._calculateRateLimitBackoffMs(retryCount),
          this._extractRateLimitRetryAfterMs(resolvedError)
        )
        : 0;
      if (retryDelayMs > 0) {
        this._onRateLimitSignal(retryDelayMs);
        const launchHoldMs = this._getRateLimitLaunchHoldRemainingMs();
        this._updateStatusMonitorRateLimit({
          specName,
          retryCount,
          retryDelayMs,
          launchHoldMs,
          error: resolvedError,
        });
        this.emit('spec:rate-limited', {
          specName,
          retryCount,
          retryDelayMs,
          launchHoldMs,
          error: resolvedError,
        });
        await this._sleep(retryDelayMs);
        if (this._stopped) {
          return;
        }
      }

      // Re-execute
      await this._executeSpec(specName, maxRetries);
    } else {
      // Final failure (Req 5.3)
      this._failedSpecs.add(specName);
      this._statusMonitor.updateSpecStatus(specName, 'failed', agentId, resolvedError);

      // Sync external status
      await this._syncExternalSafe(specName, 'failed');

      this.emit('spec:failed', { specName, agentId, error: resolvedError, retryCount });

      // Propagate failure to dependents (Req 3.6)
      this._propagateFailure(specName);
    }
  }

  // ---------------------------------------------------------------------------
  // Dependency Graph & Batch Computation
  // ---------------------------------------------------------------------------

  /**
   * Extract dependency map from the graph for the given specs.
   * edges go FROM dependent TO dependency (from: specA, to: specB means specA depends on specB).
   *
   * @param {object} graph - {nodes, edges}
   * @param {string[]} specNames
   * @returns {object} {[specName]: string[]} - each spec maps to its dependencies
   * @private
   */
  _extractDependencies(graph, specNames) {
    const specSet = new Set(specNames);
    const deps = {};

    for (const specName of specNames) {
      deps[specName] = [];
    }

    for (const edge of graph.edges) {
      if (specSet.has(edge.from) && specSet.has(edge.to)) {
        deps[edge.from].push(edge.to);
      }
    }

    return deps;
  }

  /**
   * Compute execution batches via topological sort (Req 3.3).
   * Specs with no dependencies → batch 0.
   * Specs whose dependencies are all in earlier batches → next batch.
   *
   * @param {string[]} specNames
   * @param {object} dependencies - {[specName]: string[]}
   * @returns {string[][]} Array of batches
   * @private
   */
  _computeBatches(specNames, dependencies) {
    const batches = [];
    const assigned = new Set(); // specs already assigned to a batch

    while (assigned.size < specNames.length) {
      const batch = [];

      for (const specName of specNames) {
        if (assigned.has(specName)) continue;

        // Check if all dependencies are in earlier batches
        const deps = dependencies[specName] || [];
        const allDepsAssigned = deps.every(d => assigned.has(d));

        if (allDepsAssigned) {
          batch.push(specName);
        }
      }

      if (batch.length === 0) {
        // Should not happen if cycle detection passed, but safety guard
        break;
      }

      batches.push(batch);
      for (const specName of batch) {
        assigned.add(specName);
      }
    }

    return batches;
  }

  /**
   * Propagate failure: mark all direct and indirect dependents as skipped (Req 3.6).
   *
   * @param {string} failedSpec
   * @private
   */
  _propagateFailure(failedSpec) {
    if (!this._executionPlan) return;

    const deps = this._executionPlan.dependencies;
    const toSkip = new Set();

    // Find all specs that directly or indirectly depend on failedSpec
    const findDependents = (specName) => {
      for (const candidate of this._executionPlan.specs) {
        if (toSkip.has(candidate) || this._completedSpecs.has(candidate)) continue;
        const candidateDeps = deps[candidate] || [];
        if (candidateDeps.includes(specName)) {
          toSkip.add(candidate);
          findDependents(candidate); // recursive: indirect dependents
        }
      }
    };

    findDependents(failedSpec);

    for (const specName of toSkip) {
      this._skippedSpecs.add(specName);
      this._statusMonitor.updateSpecStatus(
        specName, 'skipped', null,
        `Skipped: dependency '${failedSpec}' failed`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Validation & Helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve retry-related runtime config with safe defaults.
   *
   * @param {object} config
   * @private
   */
  _applyRetryPolicyConfig(config) {
    this._rateLimitMaxRetries = this._toNonNegativeInteger(
      config && config.rateLimitMaxRetries,
      DEFAULT_RATE_LIMIT_MAX_RETRIES
    );

    const baseMs = this._toPositiveInteger(
      config && config.rateLimitBackoffBaseMs,
      DEFAULT_RATE_LIMIT_BACKOFF_BASE_MS
    );
    const maxMs = this._toPositiveInteger(
      config && config.rateLimitBackoffMaxMs,
      DEFAULT_RATE_LIMIT_BACKOFF_MAX_MS
    );

    this._rateLimitBackoffBaseMs = Math.min(baseMs, maxMs);
    this._rateLimitBackoffMaxMs = Math.max(baseMs, maxMs);
    this._rateLimitAdaptiveParallel = this._toBoolean(
      config && config.rateLimitAdaptiveParallel,
      DEFAULT_RATE_LIMIT_ADAPTIVE_PARALLEL
    );
    this._rateLimitParallelFloor = this._toPositiveInteger(
      config && config.rateLimitParallelFloor,
      DEFAULT_RATE_LIMIT_PARALLEL_FLOOR
    );
    this._rateLimitCooldownMs = this._toPositiveInteger(
      config && config.rateLimitCooldownMs,
      DEFAULT_RATE_LIMIT_COOLDOWN_MS
    );
    this._rateLimitLaunchBudgetPerMinute = this._toNonNegativeInteger(
      config && config.rateLimitLaunchBudgetPerMinute,
      DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_PER_MINUTE
    );
    this._rateLimitLaunchBudgetWindowMs = this._toPositiveInteger(
      config && config.rateLimitLaunchBudgetWindowMs,
      DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_WINDOW_MS
    );
  }

  /**
   * @param {number} maxParallel
   * @private
   */
  _initializeAdaptiveParallel(maxParallel) {
    const boundedMax = this._toPositiveInteger(maxParallel, 1);
    this._baseMaxParallel = boundedMax;
    this._effectiveMaxParallel = boundedMax;
    this._rateLimitCooldownUntil = 0;
    this._rateLimitLaunchHoldUntil = 0;
    this._rateLimitLaunchTimestamps = [];
    this._launchBudgetLastHoldSignalAt = 0;
    this._launchBudgetLastHoldMs = 0;
    this._updateStatusMonitorParallelTelemetry({
      adaptive: this._isAdaptiveParallelEnabled(),
      maxParallel: boundedMax,
      effectiveMaxParallel: boundedMax,
      floor: Math.min(
        boundedMax,
        this._toPositiveInteger(this._rateLimitParallelFloor, DEFAULT_RATE_LIMIT_PARALLEL_FLOOR)
      ),
    });
    const launchBudgetConfig = this._getLaunchBudgetConfig();
    if (launchBudgetConfig.budgetPerMinute > 0) {
      this._updateStatusMonitorLaunchBudget({
        budgetPerMinute: launchBudgetConfig.budgetPerMinute,
        windowMs: launchBudgetConfig.windowMs,
        used: 0,
        holdMs: 0,
      });
    }
  }

  /**
   * @param {number} maxParallel
   * @returns {number}
   * @private
   */
  _getEffectiveMaxParallel(maxParallel) {
    const boundedMax = this._toPositiveInteger(maxParallel, 1);
    const floor = Math.min(
      boundedMax,
      this._toPositiveInteger(this._rateLimitParallelFloor, DEFAULT_RATE_LIMIT_PARALLEL_FLOOR)
    );

    if (!this._isAdaptiveParallelEnabled()) {
      this._baseMaxParallel = boundedMax;
      this._effectiveMaxParallel = boundedMax;
      this._updateStatusMonitorParallelTelemetry({
        adaptive: false,
        maxParallel: boundedMax,
        effectiveMaxParallel: boundedMax,
        floor,
      });
      return boundedMax;
    }

    this._baseMaxParallel = boundedMax;
    this._maybeRecoverParallelLimit(boundedMax);

    const effective = this._toPositiveInteger(this._effectiveMaxParallel, boundedMax);
    const resolved = Math.max(floor, Math.min(boundedMax, effective));
    this._updateStatusMonitorParallelTelemetry({
      adaptive: true,
      maxParallel: boundedMax,
      effectiveMaxParallel: resolved,
      floor,
    });
    return resolved;
  }

  /**
   * @private
   */
  _onRateLimitSignal(retryDelayMs = 0) {
    const now = this._getNow();
    const launchHoldMs = this._toNonNegativeInteger(retryDelayMs, 0);
    if (launchHoldMs > 0) {
      const currentHoldUntil = this._toNonNegativeInteger(this._rateLimitLaunchHoldUntil, 0);
      this._rateLimitLaunchHoldUntil = Math.max(currentHoldUntil, now + launchHoldMs);
    }

    if (!this._isAdaptiveParallelEnabled()) {
      return;
    }

    const base = this._toPositiveInteger(this._baseMaxParallel, 1);
    const current = this._toPositiveInteger(this._effectiveMaxParallel, base);
    const floor = Math.min(
      base,
      this._toPositiveInteger(this._rateLimitParallelFloor, DEFAULT_RATE_LIMIT_PARALLEL_FLOOR)
    );
    const next = Math.max(floor, Math.floor(current / 2));

    if (next < current) {
      this._effectiveMaxParallel = next;
      this._updateStatusMonitorParallelTelemetry({
        event: 'throttled',
        reason: 'rate-limit',
        adaptive: true,
        maxParallel: base,
        effectiveMaxParallel: next,
        floor,
      });
      this.emit('parallel:throttled', {
        reason: 'rate-limit',
        previousMaxParallel: current,
        effectiveMaxParallel: next,
        floor,
      });
    } else {
      this._effectiveMaxParallel = current;
    }

    this._rateLimitCooldownUntil = now + this._rateLimitCooldownMs;
  }

  /**
   * @param {number} maxParallel
   * @private
   */
  _maybeRecoverParallelLimit(maxParallel) {
    if (!this._isAdaptiveParallelEnabled()) {
      return;
    }

    const boundedMax = this._toPositiveInteger(maxParallel, 1);
    const current = this._toPositiveInteger(this._effectiveMaxParallel, boundedMax);
    if (current >= boundedMax) {
      this._effectiveMaxParallel = boundedMax;
      return;
    }

    if (this._getNow() < this._rateLimitCooldownUntil) {
      return;
    }

    const next = Math.min(boundedMax, current + 1);
    if (next > current) {
      this._effectiveMaxParallel = next;
      this._rateLimitCooldownUntil = this._getNow() + this._rateLimitCooldownMs;
      this._updateStatusMonitorParallelTelemetry({
        event: 'recovered',
        adaptive: true,
        maxParallel: boundedMax,
        effectiveMaxParallel: next,
      });
      this.emit('parallel:recovered', {
        previousMaxParallel: current,
        effectiveMaxParallel: next,
        maxParallel: boundedMax,
      });
    }
  }

  /**
   * @returns {boolean}
   * @private
   */
  _isAdaptiveParallelEnabled() {
    if (typeof this._rateLimitAdaptiveParallel === 'boolean') {
      return this._rateLimitAdaptiveParallel;
    }
    return DEFAULT_RATE_LIMIT_ADAPTIVE_PARALLEL;
  }

  /**
   * @returns {number}
   * @private
   */
  _getNow() {
    return typeof this._now === 'function' ? this._now() : Date.now();
  }

  /**
   * @returns {number}
   * @private
   */
  _getRateLimitLaunchHoldRemainingMs() {
    const holdUntil = this._toNonNegativeInteger(this._rateLimitLaunchHoldUntil, 0);
    if (holdUntil <= 0) {
      return 0;
    }
    return Math.max(0, holdUntil - this._getNow());
  }

  /**
   * @returns {{ budgetPerMinute: number, windowMs: number }}
   * @private
   */
  _getLaunchBudgetConfig() {
    return {
      budgetPerMinute: this._toNonNegativeInteger(
        this._rateLimitLaunchBudgetPerMinute,
        DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_PER_MINUTE
      ),
      windowMs: this._toPositiveInteger(
        this._rateLimitLaunchBudgetWindowMs,
        DEFAULT_RATE_LIMIT_LAUNCH_BUDGET_WINDOW_MS
      ),
    };
  }

  /**
   * @param {number} windowMs
   * @private
   */
  _pruneLaunchBudgetHistory(windowMs) {
    const now = this._getNow();
    this._rateLimitLaunchTimestamps = this._rateLimitLaunchTimestamps
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > (now - windowMs));
  }

  /**
   * @returns {number}
   * @private
   */
  _getLaunchBudgetHoldRemainingMs() {
    const { budgetPerMinute, windowMs } = this._getLaunchBudgetConfig();
    if (budgetPerMinute <= 0) {
      return 0;
    }
    this._pruneLaunchBudgetHistory(windowMs);
    if (this._rateLimitLaunchTimestamps.length < budgetPerMinute) {
      return 0;
    }
    const oldest = this._rateLimitLaunchTimestamps[0];
    if (!Number.isFinite(oldest)) {
      return 0;
    }
    return Math.max(0, windowMs - (this._getNow() - oldest));
  }

  /**
   * @private
   */
  _recordLaunchStart() {
    const { budgetPerMinute, windowMs } = this._getLaunchBudgetConfig();
    if (budgetPerMinute <= 0) {
      return;
    }
    this._pruneLaunchBudgetHistory(windowMs);
    this._rateLimitLaunchTimestamps.push(this._getNow());
    const holdMs = this._getLaunchBudgetHoldRemainingMs();
    this._updateStatusMonitorLaunchBudget({
      budgetPerMinute,
      windowMs,
      used: this._rateLimitLaunchTimestamps.length,
      holdMs,
    });
  }

  /**
   * @param {number} holdMs
   * @private
   */
  _onLaunchBudgetHold(holdMs) {
    const { budgetPerMinute, windowMs } = this._getLaunchBudgetConfig();
    if (budgetPerMinute <= 0 || holdMs <= 0) {
      return;
    }

    const now = this._getNow();
    const deltaFromLast = now - this._launchBudgetLastHoldSignalAt;
    const holdDelta = Math.abs(holdMs - this._launchBudgetLastHoldMs);
    if (deltaFromLast < 1000 && holdDelta < 200) {
      return;
    }
    this._launchBudgetLastHoldSignalAt = now;
    this._launchBudgetLastHoldMs = holdMs;

    this._updateStatusMonitorLaunchBudget({
      event: 'hold',
      budgetPerMinute,
      windowMs,
      used: this._rateLimitLaunchTimestamps.length,
      holdMs,
    });
    this.emit('launch:budget-hold', {
      reason: 'rate-limit-launch-budget',
      holdMs,
      budgetPerMinute,
      windowMs,
      used: this._rateLimitLaunchTimestamps.length,
    });
  }

  /**
   * @param {any} value
   * @param {boolean} fallback
   * @returns {boolean}
   * @private
   */
  _toBoolean(value, fallback) {
    if (typeof value === 'boolean') {
      return value;
    }
    return fallback;
  }

  /**
   * @param {any} value
   * @param {number} fallback
   * @returns {number}
   * @private
   */
  _toPositiveInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }
    return Math.floor(numeric);
  }

  /**
   * @param {any} value
   * @param {number} fallback
   * @returns {number}
   * @private
   */
  _toNonNegativeInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return fallback;
    }
    return Math.floor(numeric);
  }

  /**
   * @param {string} error
   * @returns {boolean}
   * @private
   */
  _isRateLimitError(error) {
    return RATE_LIMIT_ERROR_PATTERNS.some(pattern => pattern.test(`${error || ''}`));
  }

  /**
   * Parse retry-after hints from rate-limit error messages.
   * Supports formats like:
   * - "Retry-After: 7"
   * - "retry after 2s"
   * - "try again in 1500ms"
   *
   * @param {string} error
   * @returns {number} delay in ms (0 when no hint)
   * @private
   */
  _extractRateLimitRetryAfterMs(error) {
    const message = `${error || ''}`;
    if (!message) {
      return 0;
    }

    const patterns = [
      /retry[-_\s]?after\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(ms|msec|milliseconds?|s|sec|seconds?|m|min|minutes?)?/i,
      /try\s+again\s+in\s+(\d+(?:\.\d+)?)\s*(ms|msec|milliseconds?|s|sec|seconds?|m|min|minutes?)?/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(message);
      if (!match) {
        continue;
      }

      const value = Number(match[1]);
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }

      const unit = `${match[2] || 's'}`.trim().toLowerCase();
      let multiplier = 1000;
      if (unit === 'ms' || unit === 'msec' || unit.startsWith('millisecond')) {
        multiplier = 1;
      } else if (unit === 'm' || unit === 'min' || unit.startsWith('minute')) {
        multiplier = 60 * 1000;
      } else {
        multiplier = 1000;
      }

      const delayMs = Math.round(value * multiplier);
      return Math.max(0, Math.min(RATE_LIMIT_RETRY_AFTER_MAX_MS, delayMs));
    }

    return 0;
  }

  /**
   * @param {number} retryCount
   * @returns {number}
   * @private
   */
  _calculateRateLimitBackoffMs(retryCount) {
    const exponent = Math.max(0, retryCount);
    const cappedBaseDelay = Math.min(
      this._rateLimitBackoffMaxMs || DEFAULT_RATE_LIMIT_BACKOFF_MAX_MS,
      (this._rateLimitBackoffBaseMs || DEFAULT_RATE_LIMIT_BACKOFF_BASE_MS) * (2 ** exponent)
    );

    const randomValue = typeof this._random === 'function' ? this._random() : Math.random();
    const normalizedRandom = Number.isFinite(randomValue)
      ? Math.min(1, Math.max(0, randomValue))
      : 0.5;
    const jitterFactor = (1 - RATE_LIMIT_BACKOFF_JITTER_RATIO)
      + (normalizedRandom * RATE_LIMIT_BACKOFF_JITTER_RATIO);

    return Math.max(1, Math.round(cappedBaseDelay * jitterFactor));
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    if (!ms || ms <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safely update StatusMonitor rate-limit telemetry.
   *
   * @param {object} payload
   * @private
   */
  _updateStatusMonitorRateLimit(payload) {
    const handler = this._statusMonitor && this._statusMonitor.recordRateLimitEvent;
    if (typeof handler === 'function') {
      try {
        handler.call(this._statusMonitor, payload);
      } catch (_err) {
        // Non-fatal status telemetry update.
      }
    }
  }

  /**
   * Safely update StatusMonitor adaptive parallel telemetry.
   *
   * @param {object} payload
   * @private
   */
  _updateStatusMonitorParallelTelemetry(payload) {
    const handler = this._statusMonitor && this._statusMonitor.updateParallelTelemetry;
    if (typeof handler === 'function') {
      try {
        handler.call(this._statusMonitor, payload);
      } catch (_err) {
        // Non-fatal status telemetry update.
      }
    }
  }

  /**
   * Safely update StatusMonitor launch-budget telemetry.
   *
   * @param {object} payload
   * @private
   */
  _updateStatusMonitorLaunchBudget(payload) {
    const handler = this._statusMonitor && this._statusMonitor.updateLaunchBudgetTelemetry;
    if (typeof handler === 'function') {
      try {
        handler.call(this._statusMonitor, payload);
      } catch (_err) {
        // Non-fatal status telemetry update.
      }
    }
  }

  /**
   * Validate that all spec directories exist (Req 6.4).
   *
   * @param {string[]} specNames
   * @returns {Promise<string[]>} List of missing spec names
   * @private
   */
  async _validateSpecExistence(specNames) {
    const missing = [];
    for (const specName of specNames) {
      const specDir = path.join(this._workspaceRoot, SPECS_DIR, specName);
      const exists = await fsUtils.pathExists(specDir);
      if (!exists) {
        missing.push(specName);
      }
    }
    return missing;
  }

  /**
   * Safely transition a spec via SpecLifecycleManager (Req 8.1, 8.2).
   * Failures are logged but do not propagate (non-fatal).
   *
   * @param {string} specName
   * @param {string} newStatus
   * @returns {Promise<void>}
   * @private
   */
  async _transitionSafe(specName, newStatus) {
    try {
      await this._specLifecycleManager.transition(specName, newStatus);
    } catch (err) {
      console.warn(
        `[OrchestrationEngine] SLM transition failed for ${specName} → ${newStatus}: ${err.message}`
      );
    }
  }

  /**
   * Safely sync external status via StatusMonitor (Req 8.5).
   * Failures are logged but do not propagate (non-fatal).
   *
   * @param {string} specName
   * @param {string} status
   * @returns {Promise<void>}
   * @private
   */
  async _syncExternalSafe(specName, status) {
    try {
      await this._statusMonitor.syncExternalStatus(specName, status);
    } catch (err) {
      console.warn(
        `[OrchestrationEngine] External sync failed for ${specName}: ${err.message}`
      );
    }
  }

  /**
   * Build the orchestration result object.
   *
   * @param {string} status
   * @param {string|null} [error=null]
   * @returns {object}
   * @private
   */
  _buildResult(status, error = null) {
    return {
      status,
      plan: this._executionPlan,
      completed: [...this._completedSpecs],
      failed: [...this._failedSpecs],
      skipped: [...this._skippedSpecs],
      error,
    };
  }

  /**
   * Reset internal state for a new orchestration run.
   * @private
   */
  _reset() {
    this._runningAgents.clear();
    this._retryCounts.clear();
    this._failedSpecs.clear();
    this._skippedSpecs.clear();
    this._completedSpecs.clear();
    this._executionPlan = null;
    this._stopped = false;
    this._baseMaxParallel = null;
    this._effectiveMaxParallel = null;
    this._rateLimitCooldownUntil = 0;
    this._rateLimitLaunchHoldUntil = 0;
    this._rateLimitLaunchTimestamps = [];
    this._launchBudgetLastHoldSignalAt = 0;
    this._launchBudgetLastHoldMs = 0;
  }
}

module.exports = { OrchestrationEngine };
