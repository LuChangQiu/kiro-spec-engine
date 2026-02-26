const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SessionStore } = require('../../../lib/runtime/session-store');
const {
  bindMultiSpecSceneSession,
  toSpecStatus
} = require('../../../lib/runtime/multi-spec-scene-session');

describe('multi-spec scene session binding', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-multi-spec-scene-session-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('toSpecStatus derives per-spec status from orchestration payload', () => {
    expect(toSpecStatus('spec-a', {
      status: 'failed',
      completed: ['spec-a'],
      failed: []
    })).toBe('completed');

    expect(toSpecStatus('spec-b', {
      status: 'completed',
      completed: [],
      failed: ['spec-b']
    })).toBe('failed');

    expect(toSpecStatus('spec-c', {
      status: 'completed'
    })).toBe('completed');
  });

  test('binds multi-spec orchestrate run and archives child sessions', async () => {
    const store = new SessionStore(tempDir);
    const scene = await store.beginSceneSession({
      sceneId: 'scene.multi-spec',
      objective: 'multi spec runtime'
    });

    const payload = await bindMultiSpecSceneSession({
      specTargets: ['spec-a', 'spec-b'],
      sceneId: 'scene.multi-spec',
      commandName: 'spec-pipeline',
      commandLabel: 'Multi-spec pipeline',
      commandOptions: { json: true },
      runViaOrchestrate: async () => ({
        mode: 'orchestrate',
        status: 'completed',
        spec_ids: ['spec-a', 'spec-b'],
        orchestrate_result: {
          status: 'completed',
          completed: ['spec-a', 'spec-b'],
          failed: []
        }
      })
    }, {
      projectPath: tempDir,
      sessionStore: store
    });

    expect(payload.scene_session).toEqual(expect.objectContaining({
      bound: true,
      scene_id: 'scene.multi-spec',
      scene_session_id: scene.session.session_id
    }));
    expect(payload.scene_session.multi_spec_child_sessions).toHaveLength(2);

    const parent = await store.getSession(scene.session.session_id);
    expect(parent.children.spec_sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ spec_id: 'spec-a', status: 'completed' }),
      expect.objectContaining({ spec_id: 'spec-b', status: 'completed' })
    ]));
  });
});
