const path = require('path');
const fs = require('fs-extra');
const { SessionStore } = require('./session-store');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

async function loadLatestStudioJob(projectPath, fileSystem = fs) {
  const latestPath = path.join(projectPath, '.sce', 'studio', 'latest-job.json');
  if (!await fileSystem.pathExists(latestPath)) {
    return null;
  }

  let latestPayload;
  try {
    latestPayload = await fileSystem.readJson(latestPath);
  } catch (_error) {
    return null;
  }

  const jobId = normalizeString(latestPayload && latestPayload.job_id);
  if (!jobId) {
    return null;
  }

  const jobPath = path.join(projectPath, '.sce', 'studio', 'jobs', `${jobId}.json`);
  if (!await fileSystem.pathExists(jobPath)) {
    return null;
  }

  try {
    return await fileSystem.readJson(jobPath);
  } catch (_error) {
    return null;
  }
}

async function resolveSpecSceneBinding(options = {}, dependencies = {}) {
  const projectPath = dependencies.projectPath || process.cwd();
  const fileSystem = dependencies.fileSystem || fs;
  const sessionStore = dependencies.sessionStore || new SessionStore(projectPath);
  const explicitSceneId = normalizeString(options.sceneId || options.scene);
  const allowNoScene = options.allowNoScene !== false;

  if (explicitSceneId) {
    const active = await sessionStore.getActiveSceneSession(explicitSceneId);
    if (!active) {
      throw new Error(`No active scene session for scene "${explicitSceneId}". Run "sce studio plan --scene ${explicitSceneId} --from-chat <session>" first.`);
    }
    return {
      source: 'explicit',
      scene_id: explicitSceneId,
      scene_cycle: active.scene_cycle,
      scene_session_id: active.session.session_id,
      scene_session: active.session
    };
  }

  const studioJob = await loadLatestStudioJob(projectPath, fileSystem);
  const studioSceneId = normalizeString(studioJob && studioJob.scene && studioJob.scene.id);
  const studioSceneSessionId = normalizeString(studioJob && studioJob.session && studioJob.session.scene_session_id);
  if (studioSceneId && studioSceneSessionId) {
    try {
      const studioSession = await sessionStore.getSession(studioSceneSessionId);
      if (studioSession && studioSession.status === 'active') {
        return {
          source: 'studio-latest',
          scene_id: studioSceneId,
          scene_cycle: studioSession.scene && studioSession.scene.cycle ? studioSession.scene.cycle : null,
          scene_session_id: studioSession.session_id,
          scene_session: studioSession
        };
      }
    } catch (_error) {
      // fall through to active scene scan
    }
  }

  const activeScenes = await sessionStore.listActiveSceneSessions();
  if (activeScenes.length === 1) {
    return {
      source: 'active-scene-auto',
      scene_id: activeScenes[0].scene_id,
      scene_cycle: activeScenes[0].scene_cycle,
      scene_session_id: activeScenes[0].session.session_id,
      scene_session: activeScenes[0].session
    };
  }

  if (activeScenes.length > 1) {
    const sceneIds = activeScenes.map((item) => item.scene_id).join(', ');
    throw new Error(`Multiple active scene sessions detected (${sceneIds}). Use --scene <scene-id> to bind spec session explicitly.`);
  }

  if (allowNoScene) {
    return null;
  }

  throw new Error('No active scene session found. Run "sce studio plan --scene <scene-id> --from-chat <session>" first.');
}

module.exports = {
  resolveSpecSceneBinding,
  loadLatestStudioJob
};
