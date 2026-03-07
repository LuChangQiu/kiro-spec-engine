const path = require('path');
const {
  buildControllerLockPayload,
  resolveControllerLockFile,
  isControllerLockStale
} = require('../../../lib/auto/controller-lock-service');

describe('auto controller lock service', () => {
  test('builds lock payload and resolves lock file', () => {
    const payload = buildControllerLockPayload('token-1');
    expect(payload).toEqual(expect.objectContaining({ token: 'token-1' }));
    expect(resolveControllerLockFile(path, 'proj', 'queue.lines', null)).toContain('queue.lines.lock');
  });

  test('detects stale lock by ttl', () => {
    expect(isControllerLockStale({ mtimeMs: 0 }, 10, 1000)).toBe(false);
    expect(isControllerLockStale({ mtimeMs: 1 }, 1, 3000)).toBe(true);
  });
});
