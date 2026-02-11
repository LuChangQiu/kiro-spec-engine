/**
 * Coordinator - Optional central task assignment and progress tracking
 *
 * When coordinator mode is enabled (via MultiAgentConfig), provides:
 * - Ready task computation based on task dependencies within a Spec
 * - Task assignment to requesting Agents (unlocked + ready tasks)
 * - Progress summary across all Specs and Agents
 * - Coordination log persistence to coordination-log.json
 *
 * When coordinator mode is NOT enabled, all methods are no-ops (zero overhead).
 *
 * Task dependency model (within a single Spec's tasks.md):
 * - A parent task (e.g. "4") depends on all its sub-tasks ("4.1", "4.2", …)
 * - A task with no sub-tasks and no incomplete parent dependency is ready
 *   if its status is "not-started"
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

const fs = require('fs').promises;
const path = require('path');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('./multi-agent-config');

const TaskClaimer = require('../task/task-claimer');

const CONFIG_DIR = '.kiro/config';
const SPECS_DIR = '.kiro/specs';
const LOG_FILENAME = 'coordination-log.json';

class Coordinator {
  /**
   * @param {string} workspaceRoot
   * @param {import('./dependency-manager')} dependencyManager
   * @param {import('./agent-registry').AgentRegistry} agentRegistry
   * @param {import('../lock/task-lock-manager').TaskLockManager} taskLockManager
   */
  constructor(workspaceRoot, dependencyManager, agentRegistry, taskLockManager) {
    this._workspaceRoot = workspaceRoot;
    this._dependencyManager = dependencyManager;
    this._agentRegistry = agentRegistry;
    this._taskLockManager = taskLockManager;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
    this._taskClaimer = new TaskClaimer();
    this._specsDir = path.join(workspaceRoot, SPECS_DIR);
    this._logPath = path.join(workspaceRoot, CONFIG_DIR, LOG_FILENAME);
    this._configDir = path.join(workspaceRoot, CONFIG_DIR);
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Get tasks that are ready to execute within a Spec.
   *
   * A task is "ready" when:
   * 1. Its status is "not-started"
   * 2. All of its sub-tasks (if any) are completed (parent depends on children)
   * 3. It is not currently locked by any Agent
   *
   * Returns [] when coordinator is not enabled (Req 6.5).
   *
   * @param {string} specName
   * @returns {Promise<Array<object>>} Ready tasks
   */
  async getReadyTasks(specName) {
    const enabled = await this._multiAgentConfig.isCoordinatorEnabled();
    if (!enabled) return [];

    const tasks = await this._parseSpecTasks(specName);
    if (!tasks || tasks.length === 0) return [];

    const lockedTasks = await this._taskLockManager.listLockedTasks(specName);
    const lockedIds = new Set(lockedTasks.map((t) => t.taskId));

    const readyTasks = [];

    for (const task of tasks) {
      // Only consider not-started tasks
      if (task.status !== 'not-started') continue;

      // Skip locked tasks
      if (lockedIds.has(task.taskId)) continue;

      // Check if this is a parent task with sub-tasks
      const subTasks = this._getSubTasks(tasks, task.taskId);
      if (subTasks.length > 0) {
        // Parent task: ready only when ALL sub-tasks are completed
        const allSubsCompleted = subTasks.every((st) => st.status === 'completed');
        if (!allSubsCompleted) continue;
      }

      // Check if this task's parent (if any) has other incomplete prerequisites
      // A sub-task (e.g. "4.1") is ready if it has no further sub-tasks of its own
      // and its own status is not-started (parent completion is handled above)

      readyTasks.push(task);
    }

    return readyTasks;
  }

  /**
   * Assign a ready, unlocked task to the requesting Agent.
   *
   * Picks the first available ready task across all Specs, locks it,
   * and returns the assignment. Returns null if no tasks are available
   * or coordinator is not enabled (Req 6.5).
   *
   * @param {string} agentId
   * @returns {Promise<{specName: string, taskId: string, task: object}|null>}
   */
  async assignTask(agentId) {
    const enabled = await this._multiAgentConfig.isCoordinatorEnabled();
    if (!enabled) return null;

    const specNames = await this._listSpecNames();

    for (const specName of specNames) {
      const readyTasks = await this.getReadyTasks(specName);
      if (readyTasks.length === 0) continue;

      // Pick the first ready task
      const task = readyTasks[0];

      // Attempt to lock it
      const lockResult = await this._taskLockManager.acquireTaskLock(
        specName,
        task.taskId,
        agentId,
        { reason: 'coordinator-assignment' }
      );

      if (lockResult.success) {
        await this.logAssignment(agentId, specName, task.taskId, 'assign');
        return { specName, taskId: task.taskId, task };
      }
      // Lock failed (race condition) – try next task
    }

    return null;
  }

  /**
   * Mark a task as completed and compute newly ready tasks.
   *
   * Returns { newReadyTasks: [] } when coordinator is not enabled (Req 6.5).
   *
   * @param {string} specName
   * @param {string} taskId
   * @param {string} agentId
   * @returns {Promise<{newReadyTasks: Array<object>}>}
   */
  async completeTask(specName, taskId, agentId) {
    const enabled = await this._multiAgentConfig.isCoordinatorEnabled();
    if (!enabled) return { newReadyTasks: [] };

    // Release the task lock
    await this._taskLockManager.releaseTaskLock(specName, taskId, agentId);

    // Log completion
    await this.logAssignment(agentId, specName, taskId, 'complete');

    // Compute newly ready tasks (tasks that became ready after this completion)
    const newReadyTasks = await this.getReadyTasks(specName);

    return { newReadyTasks };
  }

  /**
   * Get progress summary across all Specs and Agents.
   *
   * Returns empty summary when coordinator is not enabled (Req 6.5).
   *
   * @returns {Promise<{specs: object, agents: object}>}
   */
  async getProgress() {
    const enabled = await this._multiAgentConfig.isCoordinatorEnabled();
    if (!enabled) return { specs: {}, agents: {} };

    const specNames = await this._listSpecNames();
    const specsProgress = {};

    for (const specName of specNames) {
      const tasks = await this._parseSpecTasks(specName);
      if (!tasks || tasks.length === 0) continue;

      let totalTasks = 0;
      let completedTasks = 0;
      let inProgressTasks = 0;

      for (const task of tasks) {
        totalTasks++;
        if (task.status === 'completed') completedTasks++;
        else if (task.status === 'in-progress') inProgressTasks++;
      }

      specsProgress[specName] = {
        totalTasks,
        completedTasks,
        inProgressTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    }

    // Agent progress
    const agentsProgress = {};
    const activeAgents = await this._agentRegistry.getActiveAgents();

    for (const agent of activeAgents) {
      // Count completed tasks from the coordination log
      const completedCount = await this._countAgentCompletions(agent.agentId);

      agentsProgress[agent.agentId] = {
        status: agent.status,
        currentTask: agent.currentTask || null,
        completedCount,
      };
    }

    return { specs: specsProgress, agents: agentsProgress };
  }

  /**
   * Persist a coordination log entry to coordination-log.json.
   *
   * No-op when coordinator is not enabled (Req 6.5).
   *
   * @param {string} agentId
   * @param {string} specName
   * @param {string} taskId
   * @param {'assign'|'complete'|'release'|'timeout'} action
   * @returns {Promise<void>}
   */
  async logAssignment(agentId, specName, taskId, action) {
    const enabled = await this._multiAgentConfig.isCoordinatorEnabled();
    if (!enabled) return;

    const entry = {
      timestamp: new Date().toISOString(),
      agentId,
      action,
      specName,
      taskId,
      details: {},
    };

    await fsUtils.ensureDirectory(this._configDir);

    let log = [];
    try {
      const exists = await fsUtils.pathExists(this._logPath);
      if (exists) {
        log = await fsUtils.readJSON(this._logPath);
        if (!Array.isArray(log)) log = [];
      }
    } catch (_err) {
      // Corrupted log – start fresh
      log = [];
    }

    log.push(entry);
    await fsUtils.writeJSON(this._logPath, log);
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Parse tasks.md for a given Spec using TaskClaimer.
   * @param {string} specName
   * @returns {Promise<Array<object>|null>}
   * @private
   */
  async _parseSpecTasks(specName) {
    const tasksPath = path.join(this._specsDir, specName, 'tasks.md');
    const exists = await fsUtils.pathExists(tasksPath);
    if (!exists) return null;

    try {
      return await this._taskClaimer.parseTasks(tasksPath);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Get direct sub-tasks of a parent task.
   * E.g. for parent "4", returns tasks "4.1", "4.2", etc.
   * Does NOT return deeper descendants (e.g. "4.1.1").
   *
   * @param {Array<object>} tasks - All parsed tasks
   * @param {string} parentId - Parent task ID (e.g. "4")
   * @returns {Array<object>}
   * @private
   */
  _getSubTasks(tasks, parentId) {
    const prefix = parentId + '.';
    return tasks.filter((t) => {
      if (!t.taskId.startsWith(prefix)) return false;
      // Only direct children: "4.1" is a child of "4", but "4.1.1" is not
      const remainder = t.taskId.slice(prefix.length);
      return /^\d+$/.test(remainder);
    });
  }

  /**
   * List all Spec directory names that contain a tasks.md file.
   * @returns {Promise<string[]>}
   * @private
   */
  async _listSpecNames() {
    let entries;
    try {
      entries = await fs.readdir(this._specsDir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }

    const specNames = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const tasksPath = path.join(this._specsDir, entry.name, 'tasks.md');
      const exists = await fsUtils.pathExists(tasksPath);
      if (exists) {
        specNames.push(entry.name);
      }
    }
    return specNames;
  }

  /**
   * Count the number of 'complete' actions for an agent in the coordination log.
   * @param {string} agentId
   * @returns {Promise<number>}
   * @private
   */
  async _countAgentCompletions(agentId) {
    try {
      const exists = await fsUtils.pathExists(this._logPath);
      if (!exists) return 0;

      const log = await fsUtils.readJSON(this._logPath);
      if (!Array.isArray(log)) return 0;

      return log.filter((e) => e.agentId === agentId && e.action === 'complete').length;
    } catch (_err) {
      return 0;
    }
  }
}

module.exports = { Coordinator };
