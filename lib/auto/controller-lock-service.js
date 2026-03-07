function buildControllerLockPayload(lockToken) {
  return {
    token: lockToken,
    pid: process.pid,
    host: process.env.COMPUTERNAME || process.env.HOSTNAME || null,
    acquired_at: new Date().toISOString(),
    touched_at: new Date().toISOString()
  };
}

function resolveControllerLockFile(pathModule, projectPath, queueFilePath, lockFileCandidate) {
  const normalized = typeof lockFileCandidate === 'string' && lockFileCandidate.trim()
    ? lockFileCandidate.trim()
    : `${queueFilePath}.lock`;
  return pathModule.isAbsolute(normalized)
    ? normalized
    : pathModule.join(projectPath, normalized);
}

async function readControllerLockPayload(fs, lockFile) {
  if (!(await fs.pathExists(lockFile))) {
    return null;
  }
  try {
    return await fs.readJson(lockFile);
  } catch (_error) {
    return null;
  }
}

async function writeControllerLockPayload(pathModule, fs, lockFile, payload, mode = 'overwrite') {
  await fs.ensureDir(pathModule.dirname(lockFile));
  if (mode === 'create') {
    await fs.writeFile(lockFile, JSON.stringify(payload, null, 2), {
      encoding: 'utf8',
      flag: 'wx'
    });
    return;
  }
  await fs.writeJson(lockFile, payload, { spaces: 2 });
}

function isControllerLockStale(stats, ttlSeconds, now = Date.now()) {
  const mtimeMs = Number(stats && stats.mtimeMs) || 0;
  const ttlMs = Math.max(1, ttlSeconds) * 1000;
  return mtimeMs > 0 && (now - mtimeMs) > ttlMs;
}

module.exports = {
  buildControllerLockPayload,
  resolveControllerLockFile,
  readControllerLockPayload,
  writeControllerLockPayload,
  isControllerLockStale
};
