/**
 * Status Monitor — Orchestration State Tracker
 *
 * Parses Codex JSON Lines events, tracks per-Spec execution status,
 * computes aggregate orchestration state, and synchronises progress
 * to SpecLifecycleManager and ContextSyncManager.
 *
 * Requirements: 4.1 (maintain per-agent status), 4.2 (parse JSON Lines events),
 *               4.3 (update SpecLifecycleManager on completion),
 *               4.4 (update ContextSyncManager on completion),
 *               4.5 (return summary report with statuses, progress, batch info)
 */

const VALID_SPEC_STATUSES = new Set([
  'pending', 'running', 'completed', 'failed', 'timeout', 'skipped',
]);

const VALID_ORCHESTRATION_STATUSES = new Set([
  'idle', 'running', 'completed', 'failed', 'stopped',
]);

/**
 * Maps Codex JSON Lines event types to internal handling.
 * item.* events are matched by prefix.
 * @type {Set<string>}
 */
const KNOWN_EVENT_TYPES = new Set([
  'thread.started',
  'turn.started',
  'turn.completed',
  'error',
]);

class StatusMonitor {
  /**
   * @param {import('../collab/spec-lifecycle-manager').SpecLifecycleManager} specLifecycleManager
   * @param {import('../steering/context-sync-manager').ContextSyncManager} contextSyncManager
   */
  constructor(specLifecycleManager, contextSyncManager) {
    this._specLifecycleManager = specLifecycleManager;
    this._contextSyncManager = contextSyncManager;

    /** @type {'idle'|'running'|'completed'|'failed'|'stopped'} */
    this._orchestrationStatus = 'idle';
    /** @type {string|null} */
    this._startedAt = null;
    /** @type {string|null} */
    this._completedAt = null;
    /** @type {number} */
    this._currentBatch = 0;
    /** @type {number} */
    this._totalBatches = 0;

    /**
     * Per-Spec execution status.
     * @type {Map<string, {status: string, batch: number, agentId: string|null, retryCount: number, error: string|null, turnCount: number}>}
     */
    this._specs = new Map();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Register a Spec for tracking before execution begins.
   *
   * @param {string} specName
   * @param {number} batch - Batch number this Spec belongs to
   */
  initSpec(specName, batch) {
    this._specs.set(specName, {
      status: 'pending',
      batch: batch || 0,
      agentId: null,
      retryCount: 0,
      error: null,
      turnCount: 0,
    });
  }

  /**
   * Update the execution status of a specific Spec.
   *
   * @param {string} specName
   * @param {string} status - One of VALID_SPEC_STATUSES
   * @param {string|null} [agentId=null]
   * @param {string|null} [error=null]
   */
  updateSpecStatus(specName, status, agentId = null, error = null) {
    const entry = this._specs.get(specName);
    if (!entry) {
      // Unknown spec — initialise on the fly
      this._specs.set(specName, {
        status: VALID_SPEC_STATUSES.has(status) ? status : 'pending',
        batch: 0,
        agentId,
        retryCount: 0,
        error,
        turnCount: 0,
      });
      return;
    }

    if (VALID_SPEC_STATUSES.has(status)) {
      entry.status = status;
    }
    if (agentId !== null && agentId !== undefined) {
      entry.agentId = agentId;
    }
    if (error !== null && error !== undefined) {
      entry.error = error;
    }
  }

  /**
   * Increment the retry count for a Spec.
   *
   * @param {string} specName
   */
  incrementRetry(specName) {
    const entry = this._specs.get(specName);
    if (entry) {
      entry.retryCount++;
    }
  }

  /**
   * Set the overall orchestration state.
   *
   * @param {'idle'|'running'|'completed'|'failed'|'stopped'} state
   */
  setOrchestrationState(state) {
    if (!VALID_ORCHESTRATION_STATUSES.has(state)) {
      return;
    }
    this._orchestrationStatus = state;

    if (state === 'running' && !this._startedAt) {
      this._startedAt = new Date().toISOString();
    }
    if (state === 'completed' || state === 'failed' || state === 'stopped') {
      this._completedAt = new Date().toISOString();
    }
  }

  /**
   * Set batch progress information.
   *
   * @param {number} current - Current batch index (1-based)
   * @param {number} total - Total number of batches
   */
  setBatchInfo(current, total) {
    this._currentBatch = typeof current === 'number' ? current : 0;
    this._totalBatches = typeof total === 'number' ? total : 0;
  }

  /**
   * Handle a Codex JSON Lines event for a specific agent.
   * Gracefully handles invalid/malformed events — never throws.
   *
   * Supported event types:
   * - thread.started: marks the agent's Spec as running
   * - turn.started / turn.completed: tracks turn progress
   * - item.*: generic item events (logged)
   * - error: records error information
   *
   * @param {string} agentId
   * @param {*} event - Parsed or raw event (string or object)
   */
  handleEvent(agentId, event) {
    try {
      const parsed = this._parseEvent(event);
      if (!parsed) return;

      // Find the Spec associated with this agentId
      const specName = this._findSpecByAgentId(agentId);

      this._processEvent(specName, agentId, parsed);
    } catch (_err) {
      // Graceful handling — never throw (Req 4.2)
    }
  }

  /**
   * Return the full orchestration status report.
   * Computes aggregate stats from the per-Spec map.
   *
   * @returns {object} OrchestrationStatus
   */
  getOrchestrationStatus() {
    const specs = Object.create(null);
    let completedSpecs = 0;
    let failedSpecs = 0;
    let runningSpecs = 0;

    for (const [specName, entry] of this._specs) {
      specs[specName] = {
        status: entry.status,
        batch: entry.batch,
        agentId: entry.agentId,
        retryCount: entry.retryCount,
        error: entry.error,
      };

      if (entry.status === 'completed') completedSpecs++;
      else if (entry.status === 'failed' || entry.status === 'timeout') failedSpecs++;
      else if (entry.status === 'running') runningSpecs++;
    }

    return {
      status: this._orchestrationStatus,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      totalSpecs: this._specs.size,
      completedSpecs,
      failedSpecs,
      runningSpecs,
      currentBatch: this._currentBatch,
      totalBatches: this._totalBatches,
      specs,
    };
  }

  /**
   * Return the execution status of a specific Spec.
   *
   * @param {string} specName
   * @returns {object|null} SpecExecutionStatus or null if not tracked
   */
  getSpecStatus(specName) {
    const entry = this._specs.get(specName);
    if (!entry) return null;

    return {
      status: entry.status,
      batch: entry.batch,
      agentId: entry.agentId,
      retryCount: entry.retryCount,
      error: entry.error,
    };
  }

  /**
   * Synchronise a Spec's completion status to external systems:
   * - SpecLifecycleManager: transition Spec status
   * - ContextSyncManager: update progress entry
   *
   * Failures are logged but do not propagate (non-fatal).
   *
   * @param {string} specName
   * @param {string} status - 'completed' | 'failed' | 'timeout' etc.
   * @returns {Promise<void>}
   */
  async syncExternalStatus(specName, status) {
    // --- SpecLifecycleManager (Req 4.3) ---
    if (this._specLifecycleManager) {
      try {
        const lifecycleStatus = this._mapToLifecycleStatus(status);
        if (lifecycleStatus) {
          await this._specLifecycleManager.transition(specName, lifecycleStatus);
        }
      } catch (err) {
        console.warn(
          `[StatusMonitor] Failed to update SpecLifecycleManager for ${specName}: ${err.message}`
        );
      }
    }

    // --- ContextSyncManager (Req 4.4) ---
    if (this._contextSyncManager) {
      try {
        const progress = status === 'completed' ? 100 : 0;
        const summary = this._buildProgressSummary(specName, status);
        await this._contextSyncManager.updateSpecProgress(specName, {
          status,
          progress,
          summary,
        });
      } catch (err) {
        console.warn(
          `[StatusMonitor] Failed to update ContextSyncManager for ${specName}: ${err.message}`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a raw event into a normalised object.
   * Accepts both string (JSON) and pre-parsed objects.
   * Returns null for invalid/unparseable input.
   *
   * @param {*} event
   * @returns {object|null}
   * @private
   */
  _parseEvent(event) {
    if (!event) return null;

    // Already an object
    if (typeof event === 'object' && event !== null) {
      return event.type ? event : null;
    }

    // String — attempt JSON parse
    if (typeof event === 'string') {
      try {
        const parsed = JSON.parse(event);
        return parsed && typeof parsed === 'object' && parsed.type ? parsed : null;
      } catch (_err) {
        return null;
      }
    }

    return null;
  }

  /**
   * Find the Spec name associated with a given agentId.
   *
   * @param {string} agentId
   * @returns {string|null}
   * @private
   */
  _findSpecByAgentId(agentId) {
    for (const [specName, entry] of this._specs) {
      if (entry.agentId === agentId) {
        return specName;
      }
    }
    return null;
  }

  /**
   * Process a parsed event and update internal state.
   *
   * @param {string|null} specName
   * @param {string} agentId
   * @param {object} event
   * @private
   */
  _processEvent(specName, agentId, event) {
    const type = event.type;
    if (!type || typeof type !== 'string') return;

    if (type === 'thread.started') {
      if (specName) {
        this._updateEntryStatus(specName, 'running');
      }
    } else if (type === 'turn.started') {
      // Track turn activity
      if (specName) {
        const entry = this._specs.get(specName);
        if (entry) {
          entry.turnCount++;
        }
      }
    } else if (type === 'turn.completed') {
      // Turn completed — no status change, just tracking
    } else if (type === 'error') {
      if (specName) {
        const errorMsg = event.message || event.error || 'Unknown error';
        const entry = this._specs.get(specName);
        if (entry) {
          entry.error = errorMsg;
        }
      }
    } else if (type.startsWith('item.')) {
      // item.* events — generic progress tracking, no status change
    }
    // Unknown event types are silently ignored
  }

  /**
   * Update a Spec entry's status if the Spec is tracked.
   *
   * @param {string} specName
   * @param {string} status
   * @private
   */
  _updateEntryStatus(specName, status) {
    const entry = this._specs.get(specName);
    if (entry && VALID_SPEC_STATUSES.has(status)) {
      entry.status = status;
    }
  }

  /**
   * Map an orchestrator status to a SpecLifecycleManager status.
   * Returns null if no mapping exists.
   *
   * @param {string} status
   * @returns {string|null}
   * @private
   */
  _mapToLifecycleStatus(status) {
    switch (status) {
      case 'running':
        return 'in-progress';
      case 'completed':
        return 'completed';
      // failed/timeout/skipped have no direct lifecycle mapping
      default:
        return null;
    }
  }

  /**
   * Build a human-readable progress summary for ContextSyncManager.
   *
   * @param {string} specName
   * @param {string} status
   * @returns {string}
   * @private
   */
  _buildProgressSummary(specName, status) {
    switch (status) {
      case 'completed':
        return `Spec ${specName} completed successfully`;
      case 'failed':
        return `Spec ${specName} failed`;
      case 'timeout':
        return `Spec ${specName} timed out`;
      case 'skipped':
        return `Spec ${specName} skipped (dependency failed)`;
      case 'running':
        return `Spec ${specName} in progress`;
      default:
        return `Spec ${specName}: ${status}`;
    }
  }
}

module.exports = { StatusMonitor, VALID_SPEC_STATUSES, VALID_ORCHESTRATION_STATUSES };
