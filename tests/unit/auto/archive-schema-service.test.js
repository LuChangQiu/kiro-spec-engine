const {
  normalizeSchemaScope,
  normalizeTargetSchemaVersion,
  classifyArchiveSchemaCompatibility,
  checkAutoArchiveSchema,
  migrateAutoArchiveSchema
} = require('../../../lib/auto/archive-schema-service');

describe('auto archive schema service', () => {
  test('normalizes schema scope and target version', () => {
    expect(normalizeSchemaScope('all')).toEqual(expect.arrayContaining(['close-loop-session', 'batch-session', 'controller-session', 'governance-session']));
    expect(normalizeTargetSchemaVersion('1.0')).toBe('1.0');
  });

  test('classifies schema compatibility', () => {
    const supported = new Set(['1.0']);
    expect(classifyArchiveSchemaCompatibility('', supported)).toBe('missing_schema_version');
    expect(classifyArchiveSchemaCompatibility('1.0', supported)).toBe('compatible');
    expect(classifyArchiveSchemaCompatibility('0.9', supported)).toBe('incompatible');
  });

  test('checks archive schema state', async () => {
    const payload = await checkAutoArchiveSchema('proj', {}, {
      fs: {
        pathExists: async () => true,
        readdir: async () => ['a.json'],
        readJson: async () => ({ schema_version: '1.0' })
      },
      calculatePercent: (a, b) => (b > 0 ? Number(((a / b) * 100).toFixed(2)) : 0),
      getCloseLoopSessionDir: () => 'close',
      getCloseLoopBatchSummaryDir: () => 'batch',
      getCloseLoopControllerSessionDir: () => 'controller',
      getGovernanceCloseLoopSessionDir: () => 'governance',
      supportedVersions: new Set(['1.0']),
      now: () => new Date('2026-03-07T00:00:00.000Z')
    });
    expect(payload.mode).toBe('auto-schema-check');
    expect(payload.summary.compatible_files).toBeGreaterThan(0);
  });

  test('migrates archive schema state in dry-run mode', async () => {
    const payload = await migrateAutoArchiveSchema('proj', { apply: false }, {
      fs: {
        pathExists: async () => true,
        readdir: async () => ['a.json'],
        readJson: async () => ({ schema_version: '' }),
        writeJson: async () => { throw new Error('should not write in dry-run'); }
      },
      getCloseLoopSessionDir: () => 'close',
      getCloseLoopBatchSummaryDir: () => 'batch',
      getCloseLoopControllerSessionDir: () => 'controller',
      getGovernanceCloseLoopSessionDir: () => 'governance',
      defaultVersion: '1.0',
      now: () => new Date('2026-03-07T00:00:00.000Z')
    });
    expect(payload.mode).toBe('auto-schema-migrate');
    expect(payload.dry_run).toBe(true);
    expect(payload.summary.candidate_files).toBeGreaterThan(0);
  });
});
