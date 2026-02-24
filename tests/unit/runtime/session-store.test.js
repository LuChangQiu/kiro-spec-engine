const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SessionStore } = require('../../../lib/runtime/session-store');

describe('SessionStore', () => {
  let tempDir;
  let store;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-session-store-'));
    store = new SessionStore(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('startSession creates a new session record', async () => {
    const session = await store.startSession({
      tool: 'codex',
      agentVersion: '1.2.3',
      objective: 'test objective',
      sessionId: 'my-session',
    });

    expect(session.session_id).toBe('my-session');
    expect(session.tool).toBe('codex');
    expect(session.agent_version).toBe('1.2.3');
    expect(session.status).toBe('active');
    expect(session.steering.manifest_path).toBe('.sce/steering/manifest.yaml');
    expect(session.steering.compatibility.supported).toBe(true);

    const sessionPath = path.join(tempDir, '.sce/sessions/my-session.json');
    expect(await fs.pathExists(sessionPath)).toBe(true);
  });

  test('resumeSession updates latest session status and timeline', async () => {
    await store.startSession({
      tool: 'generic',
      objective: 'resume flow',
      sessionId: 'resume-me',
    });

    const resumed = await store.resumeSession('latest', { status: 'paused' });
    expect(resumed.session_id).toBe('resume-me');
    expect(resumed.status).toBe('paused');
    expect(resumed.timeline.some((event) => event.event === 'session_resumed')).toBe(true);
  });

  test('snapshotSession appends snapshots and updates status', async () => {
    await store.startSession({
      tool: 'claude',
      objective: 'snapshot flow',
      sessionId: 'snap-me',
    });

    const updated = await store.snapshotSession('snap-me', {
      summary: 'checkpoint A',
      status: 'active',
      payload: { changed_files: 3 },
    });

    expect(updated.snapshots).toHaveLength(1);
    expect(updated.snapshots[0].summary).toBe('checkpoint A');
    expect(updated.snapshots[0].payload.changed_files).toBe(3);
    expect(updated.timeline.some((event) => event.event === 'snapshot_created')).toBe(true);
  });

  test('getSession latest returns most recent updated session', async () => {
    await store.startSession({ sessionId: 'first', objective: 'first' });
    await store.startSession({ sessionId: 'second', objective: 'second' });
    await store.snapshotSession('second', { summary: 'newer' });

    const latest = await store.getSession('latest');
    expect(latest.session_id).toBe('second');
  });
});
