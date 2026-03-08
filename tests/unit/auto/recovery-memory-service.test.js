const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const {
  getCloseLoopRecoveryMemoryFile,
  loadCloseLoopRecoveryMemory,
  resolveRecoveryMemoryScope,
  buildRecoveryMemorySignature,
  updateCloseLoopRecoveryMemory,
  showCloseLoopRecoveryMemory,
  showCloseLoopRecoveryMemoryScopes,
  pruneCloseLoopRecoveryMemory,
  clearCloseLoopRecoveryMemory,
  resolveRecoveryActionSelection,
  applyRecoveryActionPatch
} = require('../../../lib/auto/recovery-memory-service');

describe('auto recovery memory service', () => {
  test('loads fallback payload and resolves auto scope from git head', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-recovery-memory-'));
    try {
      await fs.ensureDir(path.join(tempDir, '.git'));
      await fs.writeFile(path.join(tempDir, '.git', 'HEAD'), 'ref: refs/heads/feature/demo\n', 'utf8');
      const loaded = await loadCloseLoopRecoveryMemory(tempDir, {
        fs,
        getCloseLoopRecoveryMemoryFile: (projectPath) => getCloseLoopRecoveryMemoryFile(projectPath, { path })
      });
      const scope = await resolveRecoveryMemoryScope(tempDir, 'auto', {
        path,
        normalizeRecoveryMemoryToken: (value) => value ? `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) : '',
        resolveGitBranchToken: (projectPath) => require('../../../lib/auto/recovery-memory-service').resolveGitBranchToken(projectPath, {
          path,
          fs,
          normalizeRecoveryMemoryToken: (value) => value ? `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) : ''
        })
      });
      expect(loaded.payload).toEqual({ version: 1, signatures: {} });
      expect(scope).toContain('sce-recovery-memory');
      expect(scope).toContain('feature-demo');
    } finally {
      await fs.remove(tempDir);
    }
  });

  test('updates memory, reports stats, and prunes by ttl', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-recovery-memory-'));
    try {
      const deps = {
        fs,
        path,
        getCloseLoopRecoveryMemoryFile: (projectPath) => getCloseLoopRecoveryMemoryFile(projectPath, { path }),
        getRecoveryActionMemoryKey: (action, index) => require('../../../lib/auto/recovery-memory-service').getRecoveryActionMemoryKey(action, index),
        normalizeRecoveryMemoryToken: (value) => value ? `${value}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) : ''
      };
      const memoryFile = getCloseLoopRecoveryMemoryFile(tempDir, { path });
      const recoveryMemory = { file: memoryFile, payload: { version: 1, signatures: {} } };
      const updated = await updateCloseLoopRecoveryMemory(
        tempDir,
        recoveryMemory,
        'scope-demo|auto-close-loop-recover|failed-1|cluster-a',
        2,
        { action: 'retry', strategy_patch: { batchRetryRounds: 2 } },
        'failed',
        { scope: 'demo-scope' },
        deps
      );
      expect(updated.signature).toContain('cluster-a');

      const shown = await showCloseLoopRecoveryMemory(tempDir, { scope: 'demo-scope' }, {
        loadCloseLoopRecoveryMemory: (projectPath) => loadCloseLoopRecoveryMemory(projectPath, {
          fs,
          getCloseLoopRecoveryMemoryFile: (input) => getCloseLoopRecoveryMemoryFile(input, { path })
        }),
        filterRecoveryMemoryByScope: require('../../../lib/auto/recovery-memory-service').filterRecoveryMemoryByScope,
        summarizeRecoveryMemory: require('../../../lib/auto/recovery-memory-service').summarizeRecoveryMemory
      });
      expect(shown.stats.signature_count).toBe(1);
      expect(shown.stats.action_count).toBe(1);

      const payload = await fs.readJson(memoryFile);
      const entry = payload.signatures[updated.signature];
      entry.last_used_at = '2000-01-01T00:00:00.000Z';
      entry.actions[updated.action_key].last_used_at = '2000-01-01T00:00:00.000Z';
      await fs.writeJson(memoryFile, payload, { spaces: 2 });

      const pruned = await pruneCloseLoopRecoveryMemory(tempDir, { olderThanDays: 30 }, {
        fs,
        path,
        Date,
        normalizeRecoveryMemoryTtlDays: (days) => Number(days),
        loadCloseLoopRecoveryMemory: (projectPath) => loadCloseLoopRecoveryMemory(projectPath, {
          fs,
          getCloseLoopRecoveryMemoryFile: (input) => getCloseLoopRecoveryMemoryFile(input, { path })
        }),
        filterRecoveryMemoryByScope: require('../../../lib/auto/recovery-memory-service').filterRecoveryMemoryByScope,
        summarizeRecoveryMemory: require('../../../lib/auto/recovery-memory-service').summarizeRecoveryMemory
      });
      expect(pruned.signatures_removed).toBe(1);
      expect(pruned.actions_removed).toBe(1);

      const scopes = await showCloseLoopRecoveryMemoryScopes(tempDir, {
        loadCloseLoopRecoveryMemory: (projectPath) => loadCloseLoopRecoveryMemory(projectPath, {
          fs,
          getCloseLoopRecoveryMemoryFile: (input) => getCloseLoopRecoveryMemoryFile(input, { path })
        }),
        buildRecoveryMemoryScopeStats: require('../../../lib/auto/recovery-memory-service').buildRecoveryMemoryScopeStats
      });
      expect(scopes.total_scopes).toBe(0);

      const cleared = await clearCloseLoopRecoveryMemory(tempDir, {
        fs,
        getCloseLoopRecoveryMemoryFile: (projectPath) => getCloseLoopRecoveryMemoryFile(projectPath, { path })
      });
      expect(cleared.cleared).toBe(true);
      expect(await fs.pathExists(memoryFile)).toBe(false);
    } finally {
      await fs.remove(tempDir);
    }
  });

  test('selects remediation action from memory and applies patch conservatively', () => {
    const summary = {
      failed_goals: 2,
      program_diagnostics: {
        failure_clusters: [{ signature: 'module-missing' }],
        remediation_actions: [
          { action: 'inspect-logs', suggested_command: 'tail -n 200 log.txt', strategy_patch: { batchParallel: 1 } },
          { action: 'rerun-tests', suggested_command: 'npm test', strategy_patch: { batchRetryRounds: 2, continueOnError: true } }
        ]
      }
    };
      const signature = buildRecoveryMemorySignature(summary, { scope: 'demo-scope' }, {
        buildProgramDiagnostics: (payload) => payload.program_diagnostics
      });
      const selection = resolveRecoveryActionSelection(summary, null, {
        recoveryMemoryEntry: {
          actions: {
            'action-1|inspect-logs|tail-n-200-log-txt': { attempts: 1, successes: 0, failures: 1 },
            'action-2|rerun-tests|npm-test': { attempts: 3, successes: 3, failures: 0 }
          }
        }
      }, {
        buildProgramDiagnostics: (payload) => payload.program_diagnostics,
        buildProgramRemediationActions: () => [],
        normalizeRecoveryActionIndex: (value, max) => value === undefined || value === null ? 1 : Math.min(Math.max(Number(value) || 1, 1), max),
        selectRecoveryActionFromMemory: require('../../../lib/auto/recovery-memory-service').selectRecoveryActionFromMemory
      });
      const patched = applyRecoveryActionPatch({ batchPriority: 'fifo' }, selection.selectedAction);
      expect(signature).toContain('module-missing');
      expect(selection.selectionSource).toBe('memory');
      expect(selection.selectedIndex).toBe(2);
      expect(patched).toEqual(expect.objectContaining({
        batchPriority: 'fifo',
        batchRetryRounds: 2,
        continueOnError: true
      }));
  });
});
