const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
  buildAutoHandoffReleaseGateHistoryEntry,
  loadAutoHandoffReleaseGateReports,
  loadAutoHandoffReleaseGateHistorySeed,
  mergeAutoHandoffReleaseGateHistoryEntries
} = require('../../../lib/auto/handoff-release-gate-history-loaders-service');

describe('auto handoff release gate history loaders service', () => {
  const commonDeps = {
    parseAutoHandoffGateSignalsMap: () => ({}),
    normalizeHandoffText: (v) => typeof v === 'string' ? v.trim() : '',
    parseAutoHandoffReleaseGateTag: (v) => String(v || '').replace(/^release-gate-/, '').replace(/\.json$/,''),
    parseAutoHandoffGateBoolean: (v, fallback = null) => v === undefined || v === null ? fallback : Boolean(v),
    normalizeAutoHandoffGateRiskLevel: (v) => ['low','medium','high'].includes(String(v)) ? String(v) : null,
    parseAutoHandoffGateNumber: (v) => v === undefined || v === null || v === '' ? null : Number(v),
    toPortablePath: (_projectPath, p) => p,
    toAutoHandoffTimestamp: (v) => Date.parse(v || 0),
    resolveAutoHandoffReleaseEvidenceDir: (_p, d) => d,
    resolveAutoHandoffReleaseGateHistoryFile: (_p, f) => f
  };

  test('builds normalized history entry', () => {
    const entry = buildAutoHandoffReleaseGateHistoryEntry({
      gate_passed: false,
      risk_level: 'high',
      spec_success_rate_percent: 70,
      scene_package_batch_passed: false,
      scene_package_batch_failure_count: 2,
      capability_expected_unknown_count: 1,
      capability_provided_unknown_count: 2,
      release_gate_preflight_available: true,
      release_gate_preflight_blocked: true,
      require_release_gate_preflight: true,
      weekly_ops_blocked: true,
      drift_alert_count: 1,
      drift_blocked: true,
      evaluated_at: '2026-03-08T00:00:00.000Z'
    }, { tag: 'v1.0.0', projectPath: 'proj', file: 'release-gate-v1.0.0.json' }, commonDeps);
    expect(entry).toEqual(expect.objectContaining({
      tag: 'v1.0.0',
      gate_passed: false,
      risk_level: 'high',
      scene_package_batch_failure_count: 2,
      capability_expected_unknown_count: 1,
      drift_blocked: true
    }));
  });

  test('loads report and seed entries and merges latest by tag', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-gate-history-'));
    try {
      const reportsDir = path.join(tempDir, 'reports');
      const seedFile = path.join(tempDir, 'release-gate-history.json');
      await fs.ensureDir(reportsDir);
      await fs.writeJson(path.join(reportsDir, 'release-gate-v1.0.0.json'), { gate_passed: true, evaluated_at: '2026-03-08T00:00:00.000Z' }, { spaces: 2 });
      await fs.writeJson(seedFile, { entries: [{ tag: 'v1.0.0', gate_passed: false, evaluated_at: '2026-03-07T00:00:00.000Z' }] }, { spaces: 2 });
      const entryBuilder = (entry, options) => buildAutoHandoffReleaseGateHistoryEntry(entry, options, commonDeps);
      const reports = await loadAutoHandoffReleaseGateReports(tempDir, reportsDir, { ...commonDeps, fs, buildAutoHandoffReleaseGateHistoryEntry: entryBuilder });
      const seed = await loadAutoHandoffReleaseGateHistorySeed(tempDir, seedFile, { ...commonDeps, fs, buildAutoHandoffReleaseGateHistoryEntry: entryBuilder });
      const merged = mergeAutoHandoffReleaseGateHistoryEntries([...reports.entries, ...seed.entries], commonDeps);
      expect(reports.entries).toHaveLength(1);
      expect(seed.entries).toHaveLength(1);
      expect(merged).toHaveLength(1);
      expect(merged[0].gate_passed).toBe(true);
    } finally {
      await fs.remove(tempDir);
    }
  });

  test('skips malformed report entries that fail normalization', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-gate-history-'));
    try {
      const reportsDir = path.join(tempDir, 'reports');
      await fs.ensureDir(reportsDir);
      await fs.writeJson(path.join(reportsDir, 'release-gate-v1.0.0.json'), {
        gate_passed: true,
        evaluated_at: '2026-03-08T00:00:00.000Z'
      }, { spaces: 2 });

      const reports = await loadAutoHandoffReleaseGateReports(tempDir, reportsDir, {
        ...commonDeps,
        fs,
        buildAutoHandoffReleaseGateHistoryEntry: () => {
          throw new Error('normalize failed');
        }
      });

      expect(reports.entries).toHaveLength(0);
      expect(reports.warnings).toContainEqual(
        expect.stringContaining('skip invalid release gate report entry')
      );
    } finally {
      await fs.remove(tempDir);
    }
  });
});

