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
      const maxParallel = options.maxParallel || config.maxParallel || 3;
      const maxRetries = config.maxRetries || 2;

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
      while (pending.length > 0 && inFlight.size < maxParallel && !this._stopped) {
        const specName = pending.shift();
        if (this._skippedSpecs.has(specName)) continue;

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
    const retryCount = this._retryCounts.get(specName) || 0;

    if (retryCount < maxRetries && !this._stopped) {
      // Retry (Req 5.2)
      this._retryCounts.set(specName, retryCount + 1);
      this._statusMonitor.incrementRetry(specName);
      this._statusMonitor.updateSpecStatus(specName, 'pending', null, error);

      // Re-execute
      await this._executeSpec(specName, maxRetries);
    } else {
      // Final failure (Req 5.3)
      this._failedSpecs.add(specName);
      this._statusMonitor.updateSpecStatus(specName, 'failed', agentId, error);

      // Sync external status
      await this._syncExternalSafe(specName, 'failed');

      this.emit('spec:failed', { specName, agentId, error, retryCount });

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
  }
}

module.exports = { OrchestrationEngine };
