const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { SessionStore } = require('../../../lib/runtime/session-store');
const { resolveSpecSceneBinding } = require('../../../lib/runtime/scene-session-binding');

describe('scene-session-binding resolver', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-scene-session-binding-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('resolves explicit scene binding when active session exists', async () => {
    const store = new SessionStore(tempDir);
    const started = await store.beginSceneSession({ sceneId: 'scene.explicit' });

    const binding = await resolveSpecSceneBinding({
      sceneId: 'scene.explicit'
    }, {
      projectPath: tempDir,
      sessionStore: store
    });

    expect(binding).toEqual(expect.objectContaining({
      scene_id: 'scene.explicit',
      scene_session_id: started.session.session_id,
      source: 'explicit'
    }));
  });

  test('resolves binding from latest studio job when scene option is omitted', async () => {
    const store = new SessionStore(tempDir);
    const started = await store.beginSceneSession({ sceneId: 'scene.studio-latest' });

    const studioDir = path.join(tempDir, '.sce', 'studio');
    await fs.ensureDir(path.join(studioDir, 'jobs'));
    await fs.writeJson(path.join(studioDir, 'latest-job.json'), {
      job_id: 'studio-job-1'
    }, { spaces: 2 });
    await fs.writeJson(path.join(studioDir, 'jobs', 'studio-job-1.json'), {
      job_id: 'studio-job-1',
      scene: { id: 'scene.studio-latest' },
      session: { scene_session_id: started.session.session_id }
    }, { spaces: 2 });

    const binding = await resolveSpecSceneBinding({}, {
      projectPath: tempDir,
      sessionStore: store
    });

    expect(binding).toEqual(expect.objectContaining({
      scene_id: 'scene.studio-latest',
      scene_session_id: started.session.session_id,
      source: 'studio-latest'
    }));
  });

  test('throws when multiple active scenes exist and scene option is omitted', async () => {
    const store = new SessionStore(tempDir);
    await store.beginSceneSession({ sceneId: 'scene.a' });
    await store.beginSceneSession({ sceneId: 'scene.b' });

    await expect(resolveSpecSceneBinding({}, {
      projectPath: tempDir,
      sessionStore: store
    })).rejects.toThrow('Multiple active scene sessions detected');
  });
});
