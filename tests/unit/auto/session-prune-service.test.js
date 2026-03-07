const {
  pruneCloseLoopBatchSummarySessions,
  pruneCloseLoopControllerSessionsCli,
  pruneCloseLoopSessions
} = require('../../../lib/auto/session-prune-service');

describe('auto session prune service', () => {
  test('prunes batch summary sessions by keep and age', async () => {
    const removed = [];
    const result = await pruneCloseLoopBatchSummarySessions('proj', {
      keep: 1,
      olderThanDays: 1,
      dryRun: false
    }, {
      readCloseLoopBatchSummaryEntries: async () => ([
        { id: 'b1', file: 'b1.json', mtime_ms: 1000, updated_at: 'u1' },
        { id: 'b2', file: 'b2.json', mtime_ms: 0, updated_at: 'u2' }
      ]),
      getCloseLoopBatchSummaryDir: () => '.sce/auto/close-loop-batch-summaries',
      fs: { remove: async (file) => removed.push(file) },
      now: () => 2 * 24 * 60 * 60 * 1000
    });
    expect(result.deleted_count).toBe(1);
    expect(removed).toEqual(['b2.json']);
  });

  test('wraps controller session prune cli output', async () => {
    const result = await pruneCloseLoopControllerSessionsCli('proj', { keep: 0, dryRun: true }, {
      normalizeKeep: (value) => value,
      normalizeOlderThanDays: () => null,
      pruneCloseLoopControllerSessions: async () => ({ enabled: true, total_sessions: 2, kept_sessions: 0, deleted_count: 2, candidates: [], errors: [] })
    });
    expect(result).toEqual(expect.objectContaining({
      mode: 'auto-controller-session-prune',
      deleted_count: 2
    }));
  });

  test('prunes close-loop sessions using normalized keep/age policy', async () => {
    const removed = [];
    const result = await pruneCloseLoopSessions('proj', { keep: 1, dryRun: false }, {
      normalizeKeep: (value) => value,
      normalizeOlderThanDays: () => null,
      readCloseLoopSessionEntries: async () => ([
        { id: 's1', file: 's1.json', mtime_ms: 10, updated_at: 'u1' },
        { id: 's2', file: 's2.json', mtime_ms: 5, updated_at: 'u2' }
      ]),
      getCloseLoopSessionDir: () => '.sce/auto/close-loop-sessions',
      fs: { remove: async (file) => removed.push(file) },
      now: () => 100
    });
    expect(result.deleted_count).toBe(1);
    expect(removed).toEqual(['s2.json']);
  });
});
