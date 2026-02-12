/**
 * Agent Spawner — Process Manager
 *
 * Manages Codex CLI sub-processes via Node.js child_process.spawn.
 * Each spawned agent executes a single Spec in full-auto mode and
 * streams JSON Lines events back to the orchestrator.
 *
 * Requirements: 1.1 (spawn via child_process), 1.2 (CODEX_API_KEY env),
 *               1.3 (--json flag), 1.4 (exit 0 → completed),
 *               1.5 (exit non-0 → failed), 1.6 (timeout → terminate),
 *               1.7 (register in AgentRegistry)
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class AgentSpawner extends EventEmitter {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('./orchestrator-config').OrchestratorConfig} orchestratorConfig
   * @param {import('../collab/agent-registry').AgentRegistry} agentRegistry
   * @param {import('./bootstrap-prompt-builder').BootstrapPromptBuilder} bootstrapPromptBuilder
   */
  constructor(workspaceRoot, orchestratorConfig, agentRegistry, bootstrapPromptBuilder) {
    super();
    this._workspaceRoot = workspaceRoot;
    this._orchestratorConfig = orchestratorConfig;
    this._agentRegistry = agentRegistry;
    this._bootstrapPromptBuilder = bootstrapPromptBuilder;
    /** @type {Map<string, import('./agent-spawner').SpawnedAgent>} */
    this._agents = new Map();
  }

  /**
   * Spawn a Codex CLI sub-process to execute the given Spec.
   *
   * 1. Builds the bootstrap prompt via BootstrapPromptBuilder
   * 2. Registers the agent in AgentRegistry
   * 3. Spawns `codex exec --full-auto --json --sandbox danger-full-access "<prompt>"`
   * 4. Sets up stdout/stderr/close handlers and timeout timer
   *
   * @param {string} specName - Spec to execute (e.g. "96-00-agent-orchestrator")
   * @returns {Promise<object>} The SpawnedAgent record
   */
  async spawn(specName) {
    const config = await this._orchestratorConfig.getConfig();

    // Resolve API key: env var → ~/.codex/auth.json fallback
    const apiKeyEnvVar = config.apiKeyEnvVar || 'CODEX_API_KEY';
    let apiKey = process.env[apiKeyEnvVar];
    if (!apiKey) {
      apiKey = this._readCodexAuthFile();
    }
    if (!apiKey) {
      throw new Error(
        `Cannot find API key. Set environment variable ${apiKeyEnvVar}, ` +
        'or configure Codex CLI auth via `codex auth` (~/.codex/auth.json).'
      );
    }

    // Build the bootstrap prompt (Req 2.1-2.3)
    const prompt = await this._bootstrapPromptBuilder.buildPrompt(specName);

    // Register in AgentRegistry (Req 1.7)
    const { agentId } = await this._agentRegistry.register({
      currentTask: { specName },
    });

    // Assemble command arguments (Req 1.1, 1.3)
    const args = [
      'exec',
      '--full-auto',
      '--json',
      '--sandbox', 'danger-full-access',
      ...(config.codexArgs || []),
      prompt,
    ];

    // Resolve codex command: config → auto-detect
    const { command, prependArgs } = this._resolveCodexCommand(config);

    // Spawn the child process (Req 1.1, 1.2)
    const env = { ...process.env, [apiKeyEnvVar]: apiKey };
    const child = spawn(command, [...prependArgs, ...args], {
      cwd: this._workspaceRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: command === 'npx',
    });

    const now = new Date().toISOString();

    /** @type {object} */
    const agent = {
      agentId,
      specName,
      process: child,
      status: 'running',
      startedAt: now,
      completedAt: null,
      exitCode: null,
      retryCount: 0,
      stderr: '',
      events: [],
    };

    this._agents.set(agentId, agent);

    // --- stdout: parse JSON Lines events ---
    this._setupStdoutHandler(agent);

    // --- stderr: buffer for error reporting ---
    this._setupStderrHandler(agent);

    // --- process close: determine final status ---
    this._setupCloseHandler(agent);

    // --- timeout detection (Req 1.6) ---
    this._setupTimeout(agent, config.timeoutSeconds);

    return agent;
  }

  /**
   * Terminate a specific sub-process.
   * Sends SIGTERM first, then SIGKILL after a 5-second grace period.
   *
   * @param {string} agentId
   * @returns {Promise<void>}
   */
  async kill(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent || agent.status !== 'running') {
      return;
    }
    await this._terminateProcess(agent);
  }

  /**
   * Terminate all running sub-processes.
   * @returns {Promise<void>}
   */
  async killAll() {
    const killPromises = [];
    for (const agent of this._agents.values()) {
      if (agent.status === 'running') {
        killPromises.push(this._terminateProcess(agent));
      }
    }
    await Promise.all(killPromises);
  }

  /**
   * Get all agents (active and completed).
   * @returns {Map<string, object>}
   */
  getActiveAgents() {
    return new Map(this._agents);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse stdout line-by-line for JSON Lines events.
   * @param {object} agent
   * @private
   */
  _setupStdoutHandler(agent) {
    let buffer = '';

    agent.process.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          agent.events.push(event);
          this.emit('agent:output', {
            agentId: agent.agentId,
            specName: agent.specName,
            event,
          });
        } catch (_err) {
          // Non-JSON line — ignore silently
        }
      }
    });
  }

  /**
   * Buffer stderr output for error reporting.
   * @param {object} agent
   * @private
   */
  _setupStderrHandler(agent) {
    agent.process.stderr.on('data', (chunk) => {
      agent.stderr += chunk.toString();
    });
  }

  /**
   * Handle process close event to determine final status.
   * @param {object} agent
   * @private
   */
  _setupCloseHandler(agent) {
    agent.process.on('close', async (code) => {
      // Clear timeout timer if still pending
      if (agent._timeoutTimer) {
        clearTimeout(agent._timeoutTimer);
        agent._timeoutTimer = null;
      }
      if (agent._killTimer) {
        clearTimeout(agent._killTimer);
        agent._killTimer = null;
      }

      // Already finalized (e.g. by timeout handler) — skip
      if (agent.status !== 'running') {
        return;
      }

      agent.exitCode = code;
      agent.completedAt = new Date().toISOString();

      if (code === 0) {
        // Req 1.4: exit 0 → completed
        agent.status = 'completed';
        this.emit('agent:completed', {
          agentId: agent.agentId,
          specName: agent.specName,
          exitCode: code,
        });
      } else {
        // Req 1.5: exit non-0 → failed
        agent.status = 'failed';
        this.emit('agent:failed', {
          agentId: agent.agentId,
          specName: agent.specName,
          exitCode: code,
          stderr: agent.stderr,
        });
      }

      // Deregister from AgentRegistry
      await this._deregisterAgent(agent.agentId);
    });

    // Handle spawn errors (e.g. command not found)
    agent.process.on('error', async (err) => {
      if (agent._timeoutTimer) {
        clearTimeout(agent._timeoutTimer);
        agent._timeoutTimer = null;
      }

      if (agent.status !== 'running') return;

      agent.status = 'failed';
      agent.completedAt = new Date().toISOString();
      agent.stderr += `\nSpawn error: ${err.message}`;

      this.emit('agent:failed', {
        agentId: agent.agentId,
        specName: agent.specName,
        exitCode: null,
        stderr: agent.stderr,
        error: err.message,
      });

      await this._deregisterAgent(agent.agentId);
    });
  }

  /**
   * Set up a timeout timer that terminates the process if it runs too long.
   * Sends SIGTERM first, then SIGKILL after 5 seconds (Req 1.6).
   *
   * @param {object} agent
   * @param {number} timeoutSeconds
   * @private
   */
  _setupTimeout(agent, timeoutSeconds) {
    if (!timeoutSeconds || timeoutSeconds <= 0) return;

    agent._timeoutTimer = setTimeout(async () => {
      if (agent.status !== 'running') return;

      agent.status = 'timeout';
      agent.completedAt = new Date().toISOString();

      this.emit('agent:timeout', {
        agentId: agent.agentId,
        specName: agent.specName,
        timeoutSeconds,
      });

      // SIGTERM → 5s grace → SIGKILL
      try {
        agent.process.kill('SIGTERM');
      } catch (_err) {
        // Process may have already exited
      }

      agent._killTimer = setTimeout(() => {
        try {
          agent.process.kill('SIGKILL');
        } catch (_err) {
          // Process may have already exited
        }
      }, 5000);

      await this._deregisterAgent(agent.agentId);
    }, timeoutSeconds * 1000);
  }

  /**
   * Terminate a process: SIGTERM first, SIGKILL after 5s grace period.
   * @param {object} agent
   * @returns {Promise<void>}
   * @private
   */
  _terminateProcess(agent) {
    return new Promise((resolve) => {
      // Clear any existing timeout timer
      if (agent._timeoutTimer) {
        clearTimeout(agent._timeoutTimer);
        agent._timeoutTimer = null;
      }

      try {
        agent.process.kill('SIGTERM');
      } catch (_err) {
        resolve();
        return;
      }

      const killTimer = setTimeout(() => {
        try {
          agent.process.kill('SIGKILL');
        } catch (_err) {
          // Already exited
        }
      }, 5000);

      agent.process.once('close', () => {
        clearTimeout(killTimer);
        resolve();
      });

      // Safety net: resolve after 10s regardless
      setTimeout(() => {
        clearTimeout(killTimer);
        resolve();
      }, 10000);
    });
  }

  /**
   * Deregister an agent from the AgentRegistry.
   * Failures are logged but do not propagate (non-fatal).
   *
   * @param {string} agentId
   * @returns {Promise<void>}
   * @private
   */
  async _deregisterAgent(agentId) {
    try {
      await this._agentRegistry.deregister(agentId);
    } catch (err) {
      console.warn(
        `[AgentSpawner] Failed to deregister agent ${agentId}: ${err.message}`
      );
    }
  }

  /**
   * Read API key from Codex CLI's native auth file (~/.codex/auth.json).
   * Returns the key string or null if not found.
   *
   * @returns {string|null}
   * @private
   */
  _readCodexAuthFile() {
    try {
      const authPath = path.join(os.homedir(), '.codex', 'auth.json');
      if (!fs.existsSync(authPath)) {
        return null;
      }
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      return auth.OPENAI_API_KEY || auth.CODEX_API_KEY || null;
    } catch (_err) {
      return null;
    }
  }

  /**
   * Resolve the codex command and any prepended arguments.
   *
   * Priority:
   * 1. config.codexCommand (user-specified, e.g. "npx @openai/codex" or "codex")
   * 2. "codex" (default — assumes global install)
   *
   * When codexCommand contains spaces (e.g. "npx @openai/codex"),
   * the first token becomes the command and the rest become prependArgs.
   *
   * @param {object} config
   * @returns {{ command: string, prependArgs: string[] }}
   * @private
   */
  _resolveCodexCommand(config) {
    const raw = config.codexCommand || 'codex';
    const parts = raw.trim().split(/\s+/);
    return {
      command: parts[0],
      prependArgs: parts.slice(1),
    };
  }
}

module.exports = { AgentSpawner };
