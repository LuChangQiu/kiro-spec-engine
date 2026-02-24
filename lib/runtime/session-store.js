const fs = require('fs-extra');
const path = require('path');
const { SteeringContract, normalizeToolName } = require('./steering-contract');

const SESSION_SCHEMA_VERSION = '1.0';
const SESSION_DIR = path.join('.sce', 'sessions');

function toRelativePosix(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
}

function safeSessionId(value) {
  return `${value || ''}`.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function generateSessionId() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${now.getUTCDate()}`.padStart(2, '0');
  const hh = `${now.getUTCHours()}`.padStart(2, '0');
  const mi = `${now.getUTCMinutes()}`.padStart(2, '0');
  const ss = `${now.getUTCSeconds()}`.padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return `sess-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
}

class SessionStore {
  constructor(workspaceRoot, steeringContract = null) {
    this._workspaceRoot = workspaceRoot;
    this._sessionsDir = path.join(workspaceRoot, SESSION_DIR);
    this._steeringContract = steeringContract || new SteeringContract(workspaceRoot);
  }

  async startSession(options = {}) {
    const tool = normalizeToolName(options.tool || 'generic');
    const agentVersion = options.agentVersion ? `${options.agentVersion}` : null;
    const objective = `${options.objective || ''}`.trim();
    const requestedId = safeSessionId(options.sessionId);
    const sessionId = requestedId || generateSessionId();
    const now = new Date().toISOString();

    await this._steeringContract.ensureContract();
    const steeringPayload = await this._steeringContract.buildCompilePayload(tool, agentVersion);
    await fs.ensureDir(this._sessionsDir);

    const sessionPath = this._sessionPath(sessionId);
    if (await fs.pathExists(sessionPath)) {
      throw new Error(`Session already exists: ${sessionId}`);
    }

    const session = {
      schema_version: SESSION_SCHEMA_VERSION,
      session_id: sessionId,
      tool,
      agent_version: agentVersion,
      objective,
      status: 'active',
      started_at: now,
      updated_at: now,
      workspace: {
        root: this._workspaceRoot,
      },
      steering: {
        manifest_path: toRelativePosix(this._workspaceRoot, this._steeringContract.manifestPath),
        source_mode: steeringPayload.source_mode,
        compatibility: steeringPayload.compatibility,
      },
      snapshots: [],
      timeline: [
        {
          at: now,
          event: 'session_started',
          detail: {
            tool,
            agent_version: agentVersion,
            objective,
          },
        },
      ],
    };

    await this._writeSession(sessionId, session);
    return session;
  }

  async resumeSession(sessionRef = 'latest', options = {}) {
    const { sessionId, session } = await this._resolveSession(sessionRef);
    const now = new Date().toISOString();
    const status = `${options.status || 'active'}`.trim() || 'active';

    session.status = status;
    session.updated_at = now;
    session.timeline = Array.isArray(session.timeline) ? session.timeline : [];
    session.timeline.push({
      at: now,
      event: 'session_resumed',
      detail: { status },
    });

    await this._writeSession(sessionId, session);
    return session;
  }

  async snapshotSession(sessionRef = 'latest', options = {}) {
    const { sessionId, session } = await this._resolveSession(sessionRef);
    const now = new Date().toISOString();
    const summary = `${options.summary || ''}`.trim();
    const status = options.status ? `${options.status}`.trim() : session.status;
    const payload = options.payload == null ? null : options.payload;

    session.snapshots = Array.isArray(session.snapshots) ? session.snapshots : [];
    session.timeline = Array.isArray(session.timeline) ? session.timeline : [];

    const snapshot = {
      snapshot_id: `snap-${session.snapshots.length + 1}`,
      captured_at: now,
      status,
      summary,
      payload,
    };

    session.snapshots.push(snapshot);
    session.status = status;
    session.updated_at = now;
    session.timeline.push({
      at: now,
      event: 'snapshot_created',
      detail: {
        snapshot_id: snapshot.snapshot_id,
        status,
      },
    });

    await this._writeSession(sessionId, session);
    return session;
  }

  async getSession(sessionRef = 'latest') {
    const resolved = await this._resolveSession(sessionRef);
    return resolved.session;
  }

  async listSessions() {
    if (!await fs.pathExists(this._sessionsDir)) {
      return [];
    }
    const entries = await fs.readdir(this._sessionsDir);
    const records = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      const sessionId = entry.slice(0, -'.json'.length);
      try {
        const session = await fs.readJson(this._sessionPath(sessionId));
        records.push(session);
      } catch (_error) {
        // Ignore unreadable entries.
      }
    }
    records.sort((a, b) => {
      const left = Date.parse(a.updated_at || a.started_at || 0);
      const right = Date.parse(b.updated_at || b.started_at || 0);
      return right - left;
    });
    return records;
  }

  async _resolveSession(sessionRef) {
    const ref = `${sessionRef || 'latest'}`.trim();
    if (ref === 'latest') {
      const sessions = await this.listSessions();
      if (sessions.length === 0) {
        throw new Error('No session found');
      }
      const session = sessions[0];
      return { sessionId: session.session_id, session };
    }

    const sessionId = safeSessionId(ref);
    if (!sessionId) {
      throw new Error(`Invalid session id: ${ref}`);
    }
    const sessionPath = this._sessionPath(sessionId);
    if (!await fs.pathExists(sessionPath)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const session = await fs.readJson(sessionPath);
    return { sessionId, session };
  }

  async _writeSession(sessionId, session) {
    await fs.ensureDir(this._sessionsDir);
    await fs.writeJson(this._sessionPath(sessionId), session, { spaces: 2 });
  }

  _sessionPath(sessionId) {
    return path.join(this._sessionsDir, `${sessionId}.json`);
  }
}

module.exports = {
  SessionStore,
  SESSION_SCHEMA_VERSION,
  SESSION_DIR,
};
