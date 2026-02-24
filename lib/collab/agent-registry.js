/**
 * Agent Registry - Manages Agent registration, heartbeat, and lifecycle
 *
 * Stores agent records in `.sce/config/agent-registry.json`.
 * Uses MachineIdentifier for unique Agent ID generation ({machineId}:{instanceIndex}).
 * All write operations use atomic writes via fs-utils.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7
 */

const path = require('path');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('./multi-agent-config');

const REGISTRY_FILENAME = 'agent-registry.json';
const CONFIG_DIR = '.sce/config';

const EMPTY_REGISTRY = Object.freeze({
  version: '1.0.0',
  agents: {},
});

class AgentRegistry {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('../lock/machine-identifier').MachineIdentifier} machineIdentifier
   * @param {import('../lock/task-lock-manager').TaskLockManager|null} [taskLockManager=null] - Optional, injected to avoid circular deps
   */
  constructor(workspaceRoot, machineIdentifier, taskLockManager = null) {
    this._workspaceRoot = workspaceRoot;
    this._machineIdentifier = machineIdentifier;
    this._taskLockManager = taskLockManager;
    this._registryPath = path.join(workspaceRoot, CONFIG_DIR, REGISTRY_FILENAME);
    this._configDir = path.join(workspaceRoot, CONFIG_DIR);
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * Read the registry file. Auto-creates an empty registry if it doesn't exist (Req 1.7).
   * @returns {Promise<object>}
   * @private
   */
  async _readRegistry() {
    const exists = await fsUtils.pathExists(this._registryPath);
    if (!exists) {
      return { ...EMPTY_REGISTRY, agents: {} };
    }
    try {
      const data = await fsUtils.readJSON(this._registryPath);
      if (!data || typeof data.agents !== 'object') {
        return { ...EMPTY_REGISTRY, agents: {} };
      }
      return data;
    } catch (_err) {
      // Corrupted file – rebuild empty registry
      return { ...EMPTY_REGISTRY, agents: {} };
    }
  }

  /**
   * Persist the registry atomically.
   * Ensures the config directory exists before writing (Req 1.7).
   * @param {object} registry
   * @returns {Promise<void>}
   * @private
   */
  async _writeRegistry(registry) {
    await fsUtils.ensureDirectory(this._configDir);
    await fsUtils.writeJSON(this._registryPath, registry);
  }

  /**
   * Find the next available instanceIndex for a given machineId.
   * Scans existing agents with the same machineId and picks the lowest unused index.
   * @param {object} agents - Current agents map
   * @param {string} machineId
   * @returns {number}
   * @private
   */
  _nextInstanceIndex(agents, machineId) {
    const usedIndices = new Set();
    for (const record of Object.values(agents)) {
      if (record.machineId === machineId) {
        usedIndices.add(record.instanceIndex);
      }
    }
    let index = 0;
    while (usedIndices.has(index)) {
      index++;
    }
    return index;
  }

  /**
   * Register a new Agent. Generates a unique AgentID based on MachineIdentifier.
   *
   * @param {object} [options={}]
   * @param {object|null} [options.currentTask] - Optional initial task assignment
   * @returns {Promise<{agentId: string, registeredAt: string}>}
   */
  async register(options = {}) {
    const machineInfo = await this._machineIdentifier.getMachineId();
    const registry = await this._readRegistry();

    const instanceIndex = this._nextInstanceIndex(registry.agents, machineInfo.id);
    const agentId = `${machineInfo.id}:${instanceIndex}`;
    const now = new Date().toISOString();

    registry.agents[agentId] = {
      agentId,
      machineId: machineInfo.id,
      instanceIndex,
      hostname: machineInfo.hostname,
      registeredAt: now,
      lastHeartbeat: now,
      status: 'active',
      currentTask: options.currentTask || null,
    };

    await this._writeRegistry(registry);

    return { agentId, registeredAt: now };
  }

  /**
   * Deregister an Agent. Removes the record and releases associated resources.
   *
   * @param {string} agentId
   * @returns {Promise<{success: boolean, releasedLocks: Array<{specName: string, taskId: string}>}>}
   */
  async deregister(agentId) {
    const registry = await this._readRegistry();

    if (!registry.agents[agentId]) {
      return { success: false, releasedLocks: [] };
    }

    delete registry.agents[agentId];
    await this._writeRegistry(registry);

    // Release all task locks held by this agent (Req 1.6)
    let releasedLocks = [];
    if (this._taskLockManager) {
      const result = await this._taskLockManager.releaseAllLocks(agentId);
      releasedLocks = result.released;
    }

    return { success: true, releasedLocks };
  }

  /**
   * Update heartbeat timestamp for an Agent.
   *
   * @param {string} agentId
   * @returns {Promise<{success: boolean, lastHeartbeat: string|null}>}
   */
  async heartbeat(agentId) {
    const registry = await this._readRegistry();
    const agent = registry.agents[agentId];

    if (!agent) {
      return { success: false, lastHeartbeat: null };
    }

    const now = new Date().toISOString();
    agent.lastHeartbeat = now;
    agent.status = 'active';

    await this._writeRegistry(registry);

    return { success: true, lastHeartbeat: now };
  }

  /**
   * Get all agents with status 'active'.
   * @returns {Promise<object[]>}
   */
  async getActiveAgents() {
    const registry = await this._readRegistry();
    return Object.values(registry.agents).filter((a) => a.status === 'active');
  }

  /**
   * Get a specific Agent record by ID.
   * @param {string} agentId
   * @returns {Promise<object|null>}
   */
  async getAgent(agentId) {
    const registry = await this._readRegistry();
    return registry.agents[agentId] || null;
  }

  /**
   * Detect and clean up inactive Agents whose heartbeat has timed out.
   * Uses heartbeatTimeoutMs from MultiAgentConfig (default 180 000 ms).
   * Releases all task locks held by each inactive Agent (Req 1.4, 2.4).
   *
   * @returns {Promise<{cleaned: string[], releasedLocks: Array<{specName: string, taskId: string}>}>}
   */
  async cleanupInactive() {
    const config = await this._multiAgentConfig.getConfig();
    const timeoutMs = config.heartbeatTimeoutMs;
    const now = Date.now();

    const registry = await this._readRegistry();
    const cleaned = [];

    for (const agent of Object.values(registry.agents)) {
      if (agent.status !== 'active') continue;

      const lastBeat = new Date(agent.lastHeartbeat).getTime();
      if (now - lastBeat > timeoutMs) {
        agent.status = 'inactive';
        cleaned.push(agent.agentId);
      }
    }

    if (cleaned.length > 0) {
      await this._writeRegistry(registry);
    }

    // Release all task locks for each cleaned agent (Req 1.4, 2.4)
    const releasedLocks = [];
    if (this._taskLockManager && cleaned.length > 0) {
      for (const agentId of cleaned) {
        const result = await this._taskLockManager.releaseAllLocks(agentId);
        releasedLocks.push(...result.released);
      }
    }

    return { cleaned, releasedLocks };
  }

  /** Absolute path to the registry file (useful for tests / diagnostics). */
  get registryPath() {
    return this._registryPath;
  }
}

module.exports = { AgentRegistry, EMPTY_REGISTRY };
