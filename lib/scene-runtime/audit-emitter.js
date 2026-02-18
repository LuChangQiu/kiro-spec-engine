const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class AuditEmitter {
  constructor(projectRoot = process.cwd(), options = {}) {
    this.projectRoot = projectRoot;
    this.auditFile = options.auditFile || path.join(projectRoot, '.kiro', 'audit', 'scene-runtime-events.jsonl');
  }

  async emit(eventType, payload = {}) {
    const event = {
      event_id: createId('srevt'),
      event_type: eventType,
      timestamp: new Date().toISOString(),
      trace_id: payload.trace_id || payload.traceId || createId('trace'),
      scene_ref: payload.scene_ref || payload.sceneRef || null,
      scene_version: payload.scene_version || payload.sceneVersion || null,
      run_mode: payload.run_mode || payload.runMode || null,
      actor: payload.actor || 'sce.scene-runtime',
      payload: payload.payload || payload
    };

    event.checksum = this.calculateChecksum(event);

    await fs.ensureDir(path.dirname(this.auditFile));
    await fs.appendFile(this.auditFile, `${JSON.stringify(event)}\n`, 'utf8');

    return event;
  }

  calculateChecksum(event) {
    const { checksum, ...rest } = event;
    return crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
  }

  verifyEvent(event) {
    return this.calculateChecksum(event) === event.checksum;
  }

  async readAll() {
    if (!await fs.pathExists(this.auditFile)) {
      return [];
    }

    const content = await fs.readFile(this.auditFile, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

module.exports = AuditEmitter;
