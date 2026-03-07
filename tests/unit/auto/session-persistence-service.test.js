const {
  maybePersistCloseLoopControllerSummary,
  maybePersistCloseLoopBatchSummary
} = require('../../../lib/auto/session-persistence-service');

describe('auto session persistence service', () => {
  test('persists controller summary and triggers prune policy', async () => {
    const writes = [];
    const summary = { status: 'completed' };
    await maybePersistCloseLoopControllerSummary(summary, { controllerSessionKeep: 5 }, 'proj', {
      normalizeControllerSessionKeep: () => 5,
      normalizeControllerSessionOlderThanDays: () => null,
      sanitizeBatchSessionId: (value) => value,
      createControllerSessionId: () => 'controller-1',
      getCloseLoopControllerSessionDir: () => '.sce/auto/close-loop-controller-sessions',
      pruneCloseLoopControllerSessions: async () => ({ deleted_count: 0 }),
      schemaVersion: '1.0',
      fs: {
        ensureDir: async () => {},
        writeJson: async (file, payload) => writes.push({ file, payload })
      },
      now: () => new Date('2026-03-07T00:00:00.000Z')
    });
    expect(summary.controller_session).toEqual(expect.objectContaining({ id: 'controller-1' }));
    expect(summary.controller_session_prune).toEqual({ deleted_count: 0 });
    expect(writes[0].payload.controller_session.id).toBe('controller-1');
  });

  test('persists batch summary and triggers prune policy', async () => {
    const writes = [];
    const summary = { status: 'completed' };
    await maybePersistCloseLoopBatchSummary(summary, { batchSessionKeep: 3 }, 'proj', {
      normalizeBatchSessionKeep: () => 3,
      normalizeBatchSessionOlderThanDays: () => null,
      sanitizeBatchSessionId: (value) => value,
      createBatchSessionId: () => 'batch-1',
      getCloseLoopBatchSummaryDir: () => '.sce/auto/close-loop-batch-summaries',
      pruneCloseLoopBatchSummarySessions: async () => ({ deleted_count: 1 }),
      schemaVersion: '1.0',
      fs: {
        ensureDir: async () => {},
        writeJson: async (file, payload) => writes.push({ file, payload })
      },
      now: () => new Date('2026-03-07T00:00:00.000Z')
    });
    expect(summary.batch_session).toEqual(expect.objectContaining({ id: 'batch-1' }));
    expect(summary.batch_session_prune).toEqual({ deleted_count: 1 });
    expect(writes[0].payload.batch_session.id).toBe('batch-1');
  });
});
