/**
 * SpecLifecycleManager - Manages Spec lifecycle state machine
 *
 * Tracks Spec status through: planned → assigned → in-progress → completed → released.
 * Persists state to `.sce/specs/{specName}/lifecycle.json`.
 * On completion, triggers ContextSyncManager update and AgentRegistry notification.
 * In single-Agent mode, all operations are no-ops.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.3
 */

const path = require('path');
const fs = require('fs-extra');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('./multi-agent-config');

const SPECS_DIR = '.sce/specs';

const VALID_TRANSITIONS = {
  planned: ['assigned'],
  assigned: ['in-progress', 'planned'],
  'in-progress': ['completed', 'assigned'],
  completed: ['released'],
  released: [],
};

const DEFAULT_STATUS = 'planned';

class SpecLifecycleManager {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('../steering/context-sync-manager').ContextSyncManager} contextSyncManager
   * @param {import('./agent-registry').AgentRegistry} agentRegistry
   */
  constructor(workspaceRoot, contextSyncManager, agentRegistry) {
    this._workspaceRoot = workspaceRoot;
    this._contextSyncManager = contextSyncManager;
    this._agentRegistry = agentRegistry;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * Get the lifecycle.json path for a Spec.
   * @param {string} specName
   * @returns {string}
   * @private
   */
  _lifecyclePath(specName) {
    return path.join(this._workspaceRoot, SPECS_DIR, specName, 'lifecycle.json');
  }

  /**
   * Get the current lifecycle status of a Spec.
   * Single-Agent mode: returns 'planned' (default).
   *
   * @param {string} specName
   * @returns {Promise<string>}
   */
  async getStatus(specName) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return DEFAULT_STATUS;
    }

    const lifecycle = await this.readLifecycle(specName);
    return lifecycle.status;
  }

  /**
   * Transition a Spec to a new status.
   * Validates the transition against VALID_TRANSITIONS.
   * Single-Agent mode: returns success without persisting.
   *
   * @param {string} specName
   * @param {string} newStatus
   * @returns {Promise<{success: boolean, oldStatus: string, newStatus: string, error?: string}>}
   */
  async transition(specName, newStatus) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return { success: true, oldStatus: DEFAULT_STATUS, newStatus };
    }

    const lifecycle = await this.readLifecycle(specName);
    const oldStatus = lifecycle.status;

    // Validate transition
    const allowed = VALID_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return {
        success: false,
        oldStatus,
        newStatus,
        error: `Invalid transition: ${oldStatus} → ${newStatus}. Allowed: [${(allowed || []).join(', ')}]`,
      };
    }

    // Record transition
    lifecycle.status = newStatus;
    lifecycle.transitions.push({
      from: oldStatus,
      to: newStatus,
      timestamp: new Date().toISOString(),
      agentId: null, // Will be set by caller if needed
    });

    await this.writeLifecycle(specName, lifecycle);

    // On completion: trigger ContextSyncManager update and AgentRegistry notification
    if (newStatus === 'completed') {
      await this._onCompleted(specName);
    }

    return { success: true, oldStatus, newStatus };
  }

  /**
   * Check if all tasks in a Spec are completed and auto-transition to 'completed'.
   * Only transitions if current status is 'in-progress'.
   * Single-Agent mode: returns {completed: false, transitioned: false}.
   *
   * @param {string} specName
   * @returns {Promise<{completed: boolean, transitioned: boolean}>}
   */
  async checkCompletion(specName) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return { completed: false, transitioned: false };
    }

    const tasksPath = path.join(this._workspaceRoot, SPECS_DIR, specName, 'tasks.md');
    const exists = await fs.pathExists(tasksPath);
    if (!exists) {
      return { completed: false, transitioned: false };
    }

    let content;
    try {
      content = await fs.readFile(tasksPath, 'utf8');
    } catch (err) {
      console.warn(`[SpecLifecycleManager] Failed to read ${tasksPath}: ${err.message}`);
      return { completed: false, transitioned: false };
    }

    const allCompleted = this._areAllLeafTasksCompleted(content);
    if (!allCompleted) {
      return { completed: false, transitioned: false };
    }

    // Only transition if currently in-progress
    const lifecycle = await this.readLifecycle(specName);
    if (lifecycle.status !== 'in-progress') {
      return { completed: true, transitioned: false };
    }

    const result = await this.transition(specName, 'completed');
    return { completed: true, transitioned: result.success };
  }

  /**
   * Read lifecycle.json for a Spec.
   * Returns default lifecycle if file doesn't exist or is corrupted.
   *
   * @param {string} specName
   * @returns {Promise<{specName: string, status: string, transitions: Array}>}
   */
  async readLifecycle(specName) {
    const filePath = this._lifecyclePath(specName);
    const exists = await fs.pathExists(filePath);

    if (!exists) {
      return { specName, status: DEFAULT_STATUS, transitions: [] };
    }

    try {
      const data = await fsUtils.readJSON(filePath);
      if (!data || typeof data.status !== 'string' || !Array.isArray(data.transitions)) {
        console.warn(`[SpecLifecycleManager] Corrupted lifecycle.json for ${specName}, rebuilding`);
        return { specName, status: DEFAULT_STATUS, transitions: [] };
      }
      return {
        specName: data.specName || specName,
        status: data.status,
        transitions: data.transitions,
      };
    } catch (err) {
      console.warn(`[SpecLifecycleManager] Failed to read lifecycle.json for ${specName}: ${err.message}`);
      return { specName, status: DEFAULT_STATUS, transitions: [] };
    }
  }

  /**
   * Write lifecycle.json for a Spec (atomic write).
   *
   * @param {string} specName
   * @param {{specName?: string, status: string, transitions: Array}} lifecycle
   * @returns {Promise<void>}
   */
  async writeLifecycle(specName, lifecycle) {
    const filePath = this._lifecyclePath(specName);
    const dir = path.dirname(filePath);
    await fsUtils.ensureDirectory(dir);

    const data = {
      specName: lifecycle.specName || specName,
      status: lifecycle.status,
      transitions: lifecycle.transitions || [],
    };

    await fsUtils.writeJSON(filePath, data);
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Handle completion side-effects: update ContextSyncManager and notify via AgentRegistry.
   *
   * @param {string} specName
   * @returns {Promise<void>}
   * @private
   */
  async _onCompleted(specName) {
    // Update ContextSyncManager with completed status
    if (this._contextSyncManager) {
      try {
        await this._contextSyncManager.updateSpecProgress(specName, {
          status: 'completed',
          progress: 100,
          summary: `Spec ${specName} completed`,
        });
      } catch (err) {
        console.warn(`[SpecLifecycleManager] Failed to update context for ${specName}: ${err.message}`);
      }
    }

    // Notify active agents via AgentRegistry (log for now)
    if (this._agentRegistry) {
      try {
        const activeAgents = await this._agentRegistry.getActiveAgents();
        if (activeAgents.length > 0) {
          console.log(
            `[SpecLifecycleManager] Spec ${specName} completed. Notifying ${activeAgents.length} active agent(s): ${activeAgents.map(a => a.agentId).join(', ')}`
          );
        }
      } catch (err) {
        console.warn(`[SpecLifecycleManager] Failed to notify agents for ${specName}: ${err.message}`);
      }
    }
  }

  /**
   * Check if all leaf tasks in tasks.md content are completed.
   * Leaf tasks are checkbox lines with no deeper-indented sub-tasks following them.
   * A task is completed when its checkbox is [x].
   *
   * @param {string} content
   * @returns {boolean}
   * @private
   */
  _areAllLeafTasksCompleted(content) {
    const lines = content.split('\n');
    const taskPattern = /^(\s*)- \[([ x\-~])\]\*?\s/;

    // First pass: identify all task lines with their indentation levels
    const tasks = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(taskPattern);
      if (match) {
        tasks.push({
          index: i,
          indent: match[1].length,
          status: match[2],
        });
      }
    }

    if (tasks.length === 0) {
      return false;
    }

    // Second pass: identify leaf tasks and check completion
    let total = 0;
    let completed = 0;

    for (let i = 0; i < tasks.length; i++) {
      const current = tasks[i];
      const next = tasks[i + 1];

      // A task is a leaf if the next task is not more indented
      const isLeaf = !next || next.indent <= current.indent;

      if (isLeaf) {
        total++;
        if (current.status === 'x') {
          completed++;
        }
      }
    }

    return total > 0 && completed === total;
  }
}

module.exports = { SpecLifecycleManager, VALID_TRANSITIONS, DEFAULT_STATUS };
