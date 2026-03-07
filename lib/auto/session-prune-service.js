async function pruneCloseLoopBatchSummarySessions(projectPath, policy = {}, dependencies = {}) {
  const { readCloseLoopBatchSummaryEntries, getCloseLoopBatchSummaryDir, fs, now = () => Date.now() } = dependencies;
  const keep = policy.keep;
  const olderThanDays = policy.olderThanDays;
  const currentFile = policy.currentFile || null;
  const dryRun = Boolean(policy.dryRun);
  const sessions = await readCloseLoopBatchSummaryEntries(projectPath);
  const nowMs = typeof now === 'function' ? Number(now()) : Date.now();
  const cutoffMs = olderThanDays === null ? null : nowMs - (olderThanDays * 24 * 60 * 60 * 1000);

  const keepLimit = Number.isInteger(keep) ? keep : Number.POSITIVE_INFINITY;
  const deletable = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (session.file === currentFile) {
      continue;
    }
    const beyondKeep = Number.isFinite(keepLimit) ? index >= keepLimit : true;
    const beyondAge = cutoffMs === null || session.mtime_ms < cutoffMs;
    if (beyondKeep && beyondAge) {
      deletable.push(session);
    }
  }

  const deleted = [];
  const errors = [];
  if (!dryRun) {
    for (const session of deletable) {
      try {
        await fs.remove(session.file);
        deleted.push(session);
      } catch (error) {
        errors.push({ id: session.id, file: session.file, error: error.message });
      }
    }
  }

  return {
    enabled: true,
    session_dir: getCloseLoopBatchSummaryDir(projectPath),
    dry_run: dryRun,
    criteria: {
      keep: Number.isFinite(keepLimit) ? keepLimit : null,
      older_than_days: olderThanDays
    },
    total_sessions: sessions.length,
    kept_sessions: sessions.length - deletable.length,
    deleted_count: dryRun ? deletable.length : deleted.length,
    candidates: deletable.map((item) => ({ id: item.id, file: item.file, status: item.status, updated_at: item.updated_at })),
    errors
  };
}

async function pruneCloseLoopControllerSessions(projectPath, policy = {}, dependencies = {}) {
  const { readCloseLoopControllerSessionEntries, getCloseLoopControllerSessionDir, fs, now = () => Date.now() } = dependencies;
  const keep = policy.keep;
  const olderThanDays = policy.olderThanDays;
  const currentFile = policy.currentFile || null;
  const dryRun = Boolean(policy.dryRun);
  const sessions = await readCloseLoopControllerSessionEntries(projectPath);
  const nowMs = typeof now === 'function' ? Number(now()) : Date.now();
  const cutoffMs = olderThanDays === null ? null : nowMs - (olderThanDays * 24 * 60 * 60 * 1000);

  const keepLimit = Number.isInteger(keep) ? keep : Number.POSITIVE_INFINITY;
  const deletable = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    if (session.file === currentFile) {
      continue;
    }
    const beyondKeep = Number.isFinite(keepLimit) ? index >= keepLimit : true;
    const beyondAge = cutoffMs === null || session.mtime_ms < cutoffMs;
    if (beyondKeep && beyondAge) {
      deletable.push(session);
    }
  }

  const deleted = [];
  const errors = [];
  if (!dryRun) {
    for (const session of deletable) {
      try {
        await fs.remove(session.file);
        deleted.push(session);
      } catch (error) {
        errors.push({ id: session.id, file: session.file, error: error.message });
      }
    }
  }

  return {
    enabled: true,
    session_dir: getCloseLoopControllerSessionDir(projectPath),
    dry_run: dryRun,
    criteria: {
      keep: Number.isFinite(keepLimit) ? keepLimit : null,
      older_than_days: olderThanDays
    },
    total_sessions: sessions.length,
    kept_sessions: sessions.length - deletable.length,
    deleted_count: dryRun ? deletable.length : deleted.length,
    candidates: deletable.map((item) => ({ id: item.id, file: item.file, status: item.status, updated_at: item.updated_at })),
    errors
  };
}

async function pruneCloseLoopSessions(projectPath, options = {}, dependencies = {}) {
  const { normalizeKeep, normalizeOlderThanDays, readCloseLoopSessionEntries, getCloseLoopSessionDir, fs, now = () => Date.now() } = dependencies;
  const keep = normalizeKeep(options.keep);
  const olderThanDays = normalizeOlderThanDays(options.olderThanDays);
  const dryRun = Boolean(options.dryRun);
  const sessions = await readCloseLoopSessionEntries(projectPath);
  const nowMs = typeof now === 'function' ? Number(now()) : Date.now();
  const cutoffMs = olderThanDays === null ? null : nowMs - (olderThanDays * 24 * 60 * 60 * 1000);

  const keepSet = new Set(sessions.slice(0, keep).map((session) => session.file));
  const deletable = sessions.filter((session) => {
    if (keepSet.has(session.file)) {
      return false;
    }
    if (cutoffMs === null) {
      return true;
    }
    return session.mtime_ms < cutoffMs;
  });

  const deleted = [];
  const errors = [];
  if (!dryRun) {
    for (const session of deletable) {
      try {
        await fs.remove(session.file);
        deleted.push(session);
      } catch (error) {
        errors.push({ id: session.id, file: session.file, error: error.message });
      }
    }
  }

  return {
    mode: 'auto-session-prune',
    session_dir: getCloseLoopSessionDir(projectPath),
    dry_run: dryRun,
    criteria: {
      keep,
      older_than_days: olderThanDays
    },
    total_sessions: sessions.length,
    kept_sessions: sessions.length - deletable.length,
    deleted_count: dryRun ? deletable.length : deleted.length,
    candidates: deletable.map((item) => ({ id: item.id, file: item.file, status: item.status, updated_at: item.updated_at })),
    errors
  };
}

async function pruneCloseLoopBatchSummarySessionsCli(projectPath, options = {}, dependencies = {}) {
  const { normalizeKeep, normalizeOlderThanDays, pruneCloseLoopBatchSummarySessions } = dependencies;
  const keep = normalizeKeep(options.keep);
  const olderThanDays = normalizeOlderThanDays(options.olderThanDays);
  const dryRun = Boolean(options.dryRun);
  const result = await pruneCloseLoopBatchSummarySessions(projectPath, {
    keep,
    olderThanDays,
    currentFile: null,
    dryRun
  });
  return { mode: 'auto-batch-session-prune', ...result };
}

async function pruneCloseLoopControllerSessionsCli(projectPath, options = {}, dependencies = {}) {
  const { normalizeKeep, normalizeOlderThanDays, pruneCloseLoopControllerSessions } = dependencies;
  const keep = normalizeKeep(options.keep);
  const olderThanDays = normalizeOlderThanDays(options.olderThanDays);
  const dryRun = Boolean(options.dryRun);
  const result = await pruneCloseLoopControllerSessions(projectPath, {
    keep,
    olderThanDays,
    currentFile: null,
    dryRun
  });
  return { mode: 'auto-controller-session-prune', ...result };
}

module.exports = {
  pruneCloseLoopBatchSummarySessions,
  pruneCloseLoopControllerSessions,
  pruneCloseLoopSessions,
  pruneCloseLoopBatchSummarySessionsCli,
  pruneCloseLoopControllerSessionsCli
};
