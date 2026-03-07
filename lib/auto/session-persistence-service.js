async function maybePersistCloseLoopControllerSummary(summary, options, projectPath, dependencies = {}) {
  const {
    normalizeControllerSessionKeep,
    normalizeControllerSessionOlderThanDays,
    sanitizeBatchSessionId,
    createControllerSessionId,
    getCloseLoopControllerSessionDir,
    pruneCloseLoopControllerSessions,
    schemaVersion,
    fs,
    now = () => new Date()
  } = dependencies;
  if (options.controllerSession === false) {
    return;
  }

  const keep = normalizeControllerSessionKeep(options.controllerSessionKeep);
  const olderThanDays = normalizeControllerSessionOlderThanDays(options.controllerSessionOlderThanDays);
  const requestedId = typeof options.controllerSessionId === 'string' && options.controllerSessionId.trim()
    ? sanitizeBatchSessionId(options.controllerSessionId.trim())
    : null;
  const sessionId = requestedId || createControllerSessionId();
  if (!sessionId) {
    throw new Error('--controller-session-id is invalid after sanitization.');
  }

  const sessionDir = getCloseLoopControllerSessionDir(projectPath);
  const sessionFile = require('path').join(sessionDir, `${sessionId}.json`);
  summary.controller_session = { id: sessionId, file: sessionFile };
  summary.schema_version = schemaVersion;

  await fs.ensureDir(sessionDir);
  const nowValue = now();
  const updatedAt = nowValue instanceof Date ? nowValue.toISOString() : new Date(nowValue).toISOString();
  await fs.writeJson(sessionFile, {
    ...summary,
    schema_version: schemaVersion,
    controller_session: { id: sessionId, file: sessionFile },
    updated_at: updatedAt
  }, { spaces: 2 });

  if (keep !== null || olderThanDays !== null) {
    summary.controller_session_prune = await pruneCloseLoopControllerSessions(projectPath, {
      keep: keep === null ? null : keep,
      olderThanDays,
      currentFile: sessionFile,
      dryRun: false
    });
  }
}

async function maybePersistCloseLoopBatchSummary(summary, options, projectPath, dependencies = {}) {
  const {
    normalizeBatchSessionKeep,
    normalizeBatchSessionOlderThanDays,
    sanitizeBatchSessionId,
    createBatchSessionId,
    getCloseLoopBatchSummaryDir,
    pruneCloseLoopBatchSummarySessions,
    schemaVersion,
    fs,
    now = () => new Date()
  } = dependencies;
  if (options.batchSession === false) {
    return;
  }

  const keep = normalizeBatchSessionKeep(options.batchSessionKeep);
  const olderThanDays = normalizeBatchSessionOlderThanDays(options.batchSessionOlderThanDays);
  const requestedId = typeof options.batchSessionId === 'string' && options.batchSessionId.trim()
    ? sanitizeBatchSessionId(options.batchSessionId.trim())
    : null;
  const sessionId = requestedId || createBatchSessionId();
  if (!sessionId) {
    throw new Error('--batch-session-id is invalid after sanitization.');
  }

  const summaryDir = getCloseLoopBatchSummaryDir(projectPath);
  const summaryFile = require('path').join(summaryDir, `${sessionId}.json`);
  summary.batch_session = { id: sessionId, file: summaryFile };
  summary.schema_version = schemaVersion;

  await fs.ensureDir(summaryDir);
  const nowValue = now();
  const updatedAt = nowValue instanceof Date ? nowValue.toISOString() : new Date(nowValue).toISOString();
  await fs.writeJson(summaryFile, {
    ...summary,
    schema_version: schemaVersion,
    batch_session: { id: sessionId, file: summaryFile },
    updated_at: updatedAt
  }, { spaces: 2 });

  if (keep !== null || olderThanDays !== null) {
    summary.batch_session_prune = await pruneCloseLoopBatchSummarySessions(projectPath, {
      keep: keep === null ? null : keep,
      olderThanDays,
      currentFile: summaryFile,
      dryRun: false
    });
  }
}

module.exports = {
  maybePersistCloseLoopControllerSummary,
  maybePersistCloseLoopBatchSummary
};
