const { resolveSpecSceneBinding } = require('./scene-session-binding');

function normalizeString(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function toSpecStatus(specId, orchestratePayload = {}, topLevelStatus = '') {
  const completed = new Set(Array.isArray(orchestratePayload.completed) ? orchestratePayload.completed : []);
  const failed = new Set([
    ...(Array.isArray(orchestratePayload.failed) ? orchestratePayload.failed : []),
    ...(Array.isArray(orchestratePayload.skipped) ? orchestratePayload.skipped : [])
  ]);

  if (completed.has(specId)) {
    return 'completed';
  }
  if (failed.has(specId)) {
    return 'failed';
  }

  const orchestrationStatus = normalizeString(orchestratePayload.status).toLowerCase();
  if (orchestrationStatus === 'completed') {
    return 'completed';
  }
  if (orchestrationStatus === 'failed' || orchestrationStatus === 'stopped') {
    return 'failed';
  }

  const topStatus = normalizeString(topLevelStatus).toLowerCase();
  if (topStatus === 'completed') {
    return 'completed';
  }
  return 'failed';
}

async function bindMultiSpecSceneSession(options = {}, dependencies = {}) {
  const {
    specTargets = [],
    sceneId = null,
    commandName = 'spec-command',
    commandLabel = 'spec-command',
    commandOptions = {},
    runViaOrchestrate
  } = options;
  const {
    projectPath = process.cwd(),
    fileSystem,
    sessionStore
  } = dependencies;

  if (!Array.isArray(specTargets) || specTargets.length === 0) {
    throw new Error('specTargets is required for bindMultiSpecSceneSession');
  }
  if (typeof runViaOrchestrate !== 'function') {
    throw new Error('runViaOrchestrate callback is required for bindMultiSpecSceneSession');
  }

  const sceneBinding = await resolveSpecSceneBinding({
    sceneId,
    allowNoScene: false
  }, {
    projectPath,
    fileSystem,
    sessionStore
  });

  const shouldTrackSessions = commandOptions.dryRun !== true;
  const specSessions = [];
  if (shouldTrackSessions) {
    for (const specId of specTargets) {
      const linked = await sessionStore.startSpecSession({
        sceneId: sceneBinding.scene_id,
        specId,
        objective: `${commandLabel} (orchestrate): ${specId}`
      });
      specSessions.push({
        spec_id: specId,
        spec_session_id: linked.spec_session.session_id
      });
    }
  }

  try {
    const result = await runViaOrchestrate();
    const orchestratePayload = result && result.orchestrate_result
      ? result.orchestrate_result
      : {};

    if (shouldTrackSessions) {
      for (const item of specSessions) {
        const specStatus = toSpecStatus(item.spec_id, orchestratePayload, result && result.status);
        await sessionStore.completeSpecSession({
          specSessionRef: item.spec_session_id,
          status: specStatus,
          summary: `${commandLabel} orchestrate ${specStatus}: ${item.spec_id}`,
          payload: {
            command: commandName,
            mode: 'multi-spec-orchestrate',
            spec: item.spec_id,
            orchestration_status: normalizeString(orchestratePayload.status) || null
          }
        });
      }
    }

    return {
      ...result,
      scene_session: {
        bound: true,
        scene_id: sceneBinding.scene_id,
        scene_cycle: sceneBinding.scene_cycle,
        scene_session_id: sceneBinding.scene_session_id,
        binding_source: sceneBinding.source,
        multi_spec_child_sessions: specSessions
      }
    };
  } catch (error) {
    if (shouldTrackSessions) {
      for (const item of specSessions) {
        try {
          await sessionStore.completeSpecSession({
            specSessionRef: item.spec_session_id,
            status: 'failed',
            summary: `${commandLabel} orchestrate failed: ${item.spec_id}`,
            payload: {
              command: commandName,
              mode: 'multi-spec-orchestrate',
              spec: item.spec_id,
              error: error.message
            }
          });
        } catch (_innerError) {
          // best-effort close
        }
      }
    }
    throw error;
  }
}

module.exports = {
  bindMultiSpecSceneSession,
  toSpecStatus
};
