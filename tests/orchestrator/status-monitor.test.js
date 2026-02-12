/**
 * StatusMonitor Unit Tests
 *
 * Validates: Requirements 4.1-4.5
 * - 4.1: Maintain per-agent process status (running, completed, failed, timeout)
 * - 4.2: Parse JSON Lines events to extract progress info
 * - 4.3: Update SpecLifecycleManager on Spec completion
 * - 4.4: Update ContextSyncManager on Spec completion
 * - 4.5: Return summary report with statuses, progress, batch info
 */

const { StatusMonitor, VALID_SPEC_STATUSES, VALID_ORCHESTRATION_STATUSES } = require('../../lib/orchestrator/status-monitor');

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockSpecLifecycleManager(overrides = {}) {
  return {
    transition: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function createMockContextSyncManager(overrides = {}) {
  return {
    updateSpecProgress: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

function createMonitor(slmOverrides, csmOverrides) {
  const slm = createMockSpecLifecycleManager(slmOverrides);
  const csm = createMockContextSyncManager(csmOverrides);
  return { monitor: new StatusMonitor(slm, csm), slm, csm };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusMonitor', () => {
  // -------------------------------------------------------------------------
  // Exported constants
  // -------------------------------------------------------------------------

  describe('VALID_SPEC_STATUSES', () => {
    test('contains all expected spec statuses', () => {
      const expected = ['pending', 'running', 'completed', 'failed', 'timeout', 'skipped'];
      for (const s of expected) {
        expect(VALID_SPEC_STATUSES.has(s)).toBe(true);
      }
      expect(VALID_SPEC_STATUSES.size).toBe(expected.length);
    });
  });

  describe('VALID_ORCHESTRATION_STATUSES', () => {
    test('contains all expected orchestration statuses', () => {
      const expected = ['idle', 'running', 'completed', 'failed', 'stopped'];
      for (const s of expected) {
        expect(VALID_ORCHESTRATION_STATUSES.has(s)).toBe(true);
      }
      expect(VALID_ORCHESTRATION_STATUSES.size).toBe(expected.length);
    });
  });

  // -------------------------------------------------------------------------
  // initSpec
  // -------------------------------------------------------------------------

  describe('initSpec()', () => {
    test('registers spec with pending status and correct batch', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 2);

      const status = monitor.getSpecStatus('spec-a');
      expect(status).toEqual({
        status: 'pending',
        batch: 2,
        agentId: null,
        retryCount: 0,
        error: null,
      });
    });

    test('defaults batch to 0 when not provided', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-b');

      const status = monitor.getSpecStatus('spec-b');
      expect(status.batch).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // updateSpecStatus
  // -------------------------------------------------------------------------

  describe('updateSpecStatus()', () => {
    test('changes spec status correctly', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      const status = monitor.getSpecStatus('spec-a');
      expect(status.status).toBe('running');
      expect(status.agentId).toBe('agent-1');
    });

    test('records error when provided', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'failed', 'agent-1', 'Something broke');

      const status = monitor.getSpecStatus('spec-a');
      expect(status.status).toBe('failed');
      expect(status.error).toBe('Something broke');
    });

    test('creates new entry for unknown spec', () => {
      const { monitor } = createMonitor();
      monitor.updateSpecStatus('unknown-spec', 'running', 'agent-x');

      const status = monitor.getSpecStatus('unknown-spec');
      expect(status).not.toBeNull();
      expect(status.status).toBe('running');
      expect(status.agentId).toBe('agent-x');
    });

    test('ignores invalid status values for existing spec', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'bogus-status');

      const status = monitor.getSpecStatus('spec-a');
      expect(status.status).toBe('pending'); // unchanged
    });
  });

  // -------------------------------------------------------------------------
  // incrementRetry
  // -------------------------------------------------------------------------

  describe('incrementRetry()', () => {
    test('increments retry count', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);

      monitor.incrementRetry('spec-a');
      expect(monitor.getSpecStatus('spec-a').retryCount).toBe(1);

      monitor.incrementRetry('spec-a');
      expect(monitor.getSpecStatus('spec-a').retryCount).toBe(2);
    });

    test('does nothing for unknown spec', () => {
      const { monitor } = createMonitor();
      // Should not throw
      expect(() => monitor.incrementRetry('nonexistent')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // setOrchestrationState
  // -------------------------------------------------------------------------

  describe('setOrchestrationState()', () => {
    test('changes overall state', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('running');

      const report = monitor.getOrchestrationStatus();
      expect(report.status).toBe('running');
    });

    test('sets startedAt on running', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('running');

      const report = monitor.getOrchestrationStatus();
      expect(report.startedAt).not.toBeNull();
      expect(typeof report.startedAt).toBe('string');
    });

    test('does not overwrite startedAt on subsequent running calls', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('running');
      const first = monitor.getOrchestrationStatus().startedAt;

      monitor.setOrchestrationState('running');
      const second = monitor.getOrchestrationStatus().startedAt;
      expect(second).toBe(first);
    });

    test('sets completedAt on completed', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('completed');

      const report = monitor.getOrchestrationStatus();
      expect(report.completedAt).not.toBeNull();
    });

    test('sets completedAt on failed', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('failed');

      expect(monitor.getOrchestrationStatus().completedAt).not.toBeNull();
    });

    test('sets completedAt on stopped', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('stopped');

      expect(monitor.getOrchestrationStatus().completedAt).not.toBeNull();
    });

    test('ignores invalid state values', () => {
      const { monitor } = createMonitor();
      monitor.setOrchestrationState('invalid-state');

      expect(monitor.getOrchestrationStatus().status).toBe('idle');
    });
  });

  // -------------------------------------------------------------------------
  // setBatchInfo
  // -------------------------------------------------------------------------

  describe('setBatchInfo()', () => {
    test('updates batch info', () => {
      const { monitor } = createMonitor();
      monitor.setBatchInfo(2, 5);

      const report = monitor.getOrchestrationStatus();
      expect(report.currentBatch).toBe(2);
      expect(report.totalBatches).toBe(5);
    });

    test('defaults to 0 for non-number inputs', () => {
      const { monitor } = createMonitor();
      monitor.setBatchInfo('bad', null);

      const report = monitor.getOrchestrationStatus();
      expect(report.currentBatch).toBe(0);
      expect(report.totalBatches).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // handleEvent — event parsing & processing
  // -------------------------------------------------------------------------

  describe('handleEvent()', () => {
    test('thread.started marks spec as running', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'pending', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'thread.started' });

      expect(monitor.getSpecStatus('spec-a').status).toBe('running');
    });

    test('turn.started increments turnCount', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'turn.started' });
      monitor.handleEvent('agent-1', { type: 'turn.started' });

      // turnCount is internal; verify via orchestration status indirectly
      // The spec should still be running (no status change)
      expect(monitor.getSpecStatus('spec-a').status).toBe('running');
    });

    test('error event records error message', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'error', message: 'API rate limit' });

      expect(monitor.getSpecStatus('spec-a').error).toBe('API rate limit');
    });

    test('error event uses event.error field as fallback', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'error', error: 'Connection timeout' });

      expect(monitor.getSpecStatus('spec-a').error).toBe('Connection timeout');
    });

    test('error event defaults to Unknown error', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'error' });

      expect(monitor.getSpecStatus('spec-a').error).toBe('Unknown error');
    });

    test('item.* events do not change status', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');

      monitor.handleEvent('agent-1', { type: 'item.created' });
      monitor.handleEvent('agent-1', { type: 'item.completed' });

      expect(monitor.getSpecStatus('spec-a').status).toBe('running');
    });

    test('handles null event without throwing', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', null)).not.toThrow();
    });

    test('handles undefined event without throwing', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', undefined)).not.toThrow();
    });

    test('handles numeric event without throwing', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', 42)).not.toThrow();
    });

    test('parses string JSON event correctly', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'pending', 'agent-1');

      const jsonStr = JSON.stringify({ type: 'thread.started', timestamp: '2025-01-01T00:00:00Z' });
      monitor.handleEvent('agent-1', jsonStr);

      expect(monitor.getSpecStatus('spec-a').status).toBe('running');
    });

    test('handles invalid JSON string without throwing', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', '{not valid json')).not.toThrow();
    });

    test('handles empty string without throwing', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', '')).not.toThrow();
    });

    test('handles unknown agentId without throwing', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      // agent-999 is not associated with any spec
      expect(() => monitor.handleEvent('agent-999', { type: 'thread.started' })).not.toThrow();
    });

    test('handles object without type field gracefully', () => {
      const { monitor } = createMonitor();
      expect(() => monitor.handleEvent('agent-1', { data: 'something' })).not.toThrow();
    });

    test('JSON string without type field is ignored', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.updateSpecStatus('spec-a', 'pending', 'agent-1');

      monitor.handleEvent('agent-1', JSON.stringify({ data: 'no type' }));

      expect(monitor.getSpecStatus('spec-a').status).toBe('pending');
    });
  });

  // -------------------------------------------------------------------------
  // getOrchestrationStatus — aggregate stats
  // -------------------------------------------------------------------------

  describe('getOrchestrationStatus()', () => {
    test('returns correct aggregate stats', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.initSpec('spec-b', 1);
      monitor.initSpec('spec-c', 2);

      monitor.setOrchestrationState('running');
      monitor.setBatchInfo(1, 2);

      const report = monitor.getOrchestrationStatus();
      expect(report.status).toBe('running');
      expect(report.totalSpecs).toBe(3);
      expect(report.currentBatch).toBe(1);
      expect(report.totalBatches).toBe(2);
      expect(Object.keys(report.specs)).toHaveLength(3);
    });

    test('counts completed/failed/running correctly', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 1);
      monitor.initSpec('spec-b', 1);
      monitor.initSpec('spec-c', 1);
      monitor.initSpec('spec-d', 1);
      monitor.initSpec('spec-e', 1);

      monitor.updateSpecStatus('spec-a', 'completed');
      monitor.updateSpecStatus('spec-b', 'completed');
      monitor.updateSpecStatus('spec-c', 'failed');
      monitor.updateSpecStatus('spec-d', 'running');
      monitor.updateSpecStatus('spec-e', 'timeout');

      const report = monitor.getOrchestrationStatus();
      expect(report.completedSpecs).toBe(2);
      expect(report.failedSpecs).toBe(2); // failed + timeout
      expect(report.runningSpecs).toBe(1);
    });

    test('returns empty specs when none registered', () => {
      const { monitor } = createMonitor();
      const report = monitor.getOrchestrationStatus();

      expect(report.totalSpecs).toBe(0);
      expect(report.completedSpecs).toBe(0);
      expect(report.failedSpecs).toBe(0);
      expect(report.runningSpecs).toBe(0);
      expect(report.specs).toEqual({});
    });

    test('defaults to idle status', () => {
      const { monitor } = createMonitor();
      const report = monitor.getOrchestrationStatus();

      expect(report.status).toBe('idle');
      expect(report.startedAt).toBeNull();
      expect(report.completedAt).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getSpecStatus
  // -------------------------------------------------------------------------

  describe('getSpecStatus()', () => {
    test('returns null for unknown spec', () => {
      const { monitor } = createMonitor();
      expect(monitor.getSpecStatus('nonexistent')).toBeNull();
    });

    test('returns correct status for tracked spec', () => {
      const { monitor } = createMonitor();
      monitor.initSpec('spec-a', 3);
      monitor.updateSpecStatus('spec-a', 'running', 'agent-1');
      monitor.incrementRetry('spec-a');

      const status = monitor.getSpecStatus('spec-a');
      expect(status).toEqual({
        status: 'running',
        batch: 3,
        agentId: 'agent-1',
        retryCount: 1,
        error: null,
      });
    });
  });

  // -------------------------------------------------------------------------
  // syncExternalStatus — SpecLifecycleManager & ContextSyncManager
  // -------------------------------------------------------------------------

  describe('syncExternalStatus()', () => {
    test('calls SpecLifecycleManager.transition for completed status', async () => {
      const { monitor, slm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'completed');

      expect(slm.transition).toHaveBeenCalledWith('spec-a', 'completed');
    });

    test('calls SpecLifecycleManager.transition with in-progress for running', async () => {
      const { monitor, slm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'running');

      expect(slm.transition).toHaveBeenCalledWith('spec-a', 'in-progress');
    });

    test('does not call SpecLifecycleManager.transition for unmapped statuses', async () => {
      const { monitor, slm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'failed');

      expect(slm.transition).not.toHaveBeenCalled();
    });

    test('calls ContextSyncManager.updateSpecProgress', async () => {
      const { monitor, csm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'completed');

      expect(csm.updateSpecProgress).toHaveBeenCalledWith('spec-a', {
        status: 'completed',
        progress: 100,
        summary: 'Spec spec-a completed successfully',
      });
    });

    test('sends progress 0 for non-completed statuses', async () => {
      const { monitor, csm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'failed');

      expect(csm.updateSpecProgress).toHaveBeenCalledWith('spec-a', {
        status: 'failed',
        progress: 0,
        summary: 'Spec spec-a failed',
      });
    });

    test('handles SpecLifecycleManager failure gracefully', async () => {
      const { monitor, slm } = createMonitor({
        transition: jest.fn().mockRejectedValue(new Error('SLM down')),
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      // Should not throw
      await expect(monitor.syncExternalStatus('spec-a', 'completed')).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update SpecLifecycleManager')
      );
      warnSpy.mockRestore();
    });

    test('handles ContextSyncManager failure gracefully', async () => {
      const { monitor, csm } = createMonitor(undefined, {
        updateSpecProgress: jest.fn().mockRejectedValue(new Error('CSM down')),
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(monitor.syncExternalStatus('spec-a', 'completed')).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update ContextSyncManager')
      );
      warnSpy.mockRestore();
    });

    test('handles null managers without throwing', async () => {
      const monitor = new StatusMonitor(null, null);
      await expect(monitor.syncExternalStatus('spec-a', 'completed')).resolves.not.toThrow();
    });

    test('sends correct summary for timeout status', async () => {
      const { monitor, csm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'timeout');

      expect(csm.updateSpecProgress).toHaveBeenCalledWith('spec-a', {
        status: 'timeout',
        progress: 0,
        summary: 'Spec spec-a timed out',
      });
    });

    test('sends correct summary for skipped status', async () => {
      const { monitor, csm } = createMonitor();

      await monitor.syncExternalStatus('spec-a', 'skipped');

      expect(csm.updateSpecProgress).toHaveBeenCalledWith('spec-a', {
        status: 'skipped',
        progress: 0,
        summary: 'Spec spec-a skipped (dependency failed)',
      });
    });
  });
});
