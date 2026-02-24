const {
  REQUIRED_TRACKED_FILES,
  auditSceTracking
} = require('../../../lib/workspace/sce-tracking-audit');

describe('sce-tracking-audit', () => {
  test('passes when required fixture .sce assets are tracked and runtime artifacts are excluded', () => {
    const trackedFiles = [
      ...REQUIRED_TRACKED_FILES,
      '.sce/README.md',
      '.sce/steering/CORE_PRINCIPLES.md'
    ];

    const report = auditSceTracking('/repo', {
      getTrackedFiles: () => trackedFiles
    });

    expect(report.passed).toBe(true);
    expect(report.summary.missing_required_files).toBe(0);
    expect(report.summary.fixture_spec_files).toBeGreaterThan(0);
    expect(report.summary.fixture_template_files).toBeGreaterThan(0);
    expect(report.summary.disallowed_fixture_files).toBe(0);
  });

  test('fails when required fixture files are missing', () => {
    const report = auditSceTracking('/repo', {
      getTrackedFiles: () => []
    });

    expect(report.passed).toBe(false);
    expect(report.summary.missing_required_files).toBe(REQUIRED_TRACKED_FILES.length);
  });

  test('fails when disallowed runtime fixture files are tracked', () => {
    const report = auditSceTracking('/repo', {
      getTrackedFiles: () => [
        ...REQUIRED_TRACKED_FILES,
        'tests/fixtures/moqui-core-regression/workspace/.sce/reports/demo.json'
      ]
    });

    expect(report.passed).toBe(false);
    expect(report.summary.disallowed_fixture_files).toBe(1);
    expect(report.fixture.disallowed_tracked_files[0]).toContain('/reports/');
  });

  test('normalizes tracked file separators to forward slashes', () => {
    const windowsStyle = REQUIRED_TRACKED_FILES.map((filePath) => filePath.replace(/\//g, '\\'));
    const report = auditSceTracking('C:\\repo', {
      getTrackedFiles: () => windowsStyle
    });
    expect(report.passed).toBe(true);
  });
});
