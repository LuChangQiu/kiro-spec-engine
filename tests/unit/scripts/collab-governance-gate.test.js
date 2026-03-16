'use strict';

const {
  parseArgs,
  runCollabGovernanceGate
} = require('../../../scripts/collab-governance-gate');

describe('collab-governance-gate script', () => {
  let originalStdoutWrite;

  beforeEach(() => {
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = jest.fn();
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
  });

  test('parseArgs supports core flags', () => {
    const parsed = parseArgs([
      '--project-path', 'E:\\workspace\\demo',
      '--fail-on-violation',
      '--json'
    ]);

    expect(parsed.projectPath).toMatch(/workspace[\\/]+demo$/);
    expect(parsed.failOnViolation).toBe(true);
    expect(parsed.json).toBe(true);
  });

  test('returns exit code 2 when collaboration governance violations exist', async () => {
    const syncProjectSharedProblemProjection = jest.fn().mockResolvedValue({
      mode: 'project-problem-projection-sync',
      enabled: true,
      total_entries: 2,
      refreshed: true
    });
    const payload = await runCollabGovernanceGate({
      projectPath: process.cwd(),
      failOnViolation: true,
      json: true
    }, {
      syncProjectSharedProblemProjection,
      auditCollabGovernance: jest.fn().mockResolvedValue({
        passed: false,
        reason: 'violations',
        summary: {
          missing_gitignore_rules: 1,
          legacy_reference_count: 0
        },
        warnings: [],
        violations: ['missing ignore rule: .sce/config/coordination-log.json']
      })
    });

    expect(payload.passed).toBe(false);
    expect(payload.exit_code).toBe(2);
    expect(syncProjectSharedProblemProjection).toHaveBeenCalled();
    expect(payload.violations).toContain('missing ignore rule: .sce/config/coordination-log.json');
  });

  test('passes when collaboration governance audit passes', async () => {
    const syncProjectSharedProblemProjection = jest.fn().mockResolvedValue({
      mode: 'project-problem-projection-sync',
      enabled: true,
      total_entries: 0,
      refreshed: true
    });
    const payload = await runCollabGovernanceGate({
      projectPath: process.cwd(),
      failOnViolation: true,
      json: true
    }, {
      syncProjectSharedProblemProjection,
      auditCollabGovernance: jest.fn().mockResolvedValue({
        passed: true,
        reason: 'passed',
        summary: {
          missing_gitignore_rules: 0,
          legacy_reference_count: 0
        },
        warnings: [],
        violations: []
      })
    });

    expect(payload.passed).toBe(true);
    expect(payload.exit_code).toBe(0);
    expect(payload.project_problem_projection_sync).toEqual(expect.objectContaining({
      refreshed: true
    }));
  });

  test('fails when project problem projection sync throws before audit', async () => {
    const payload = await runCollabGovernanceGate({
      projectPath: process.cwd(),
      failOnViolation: true,
      json: true
    }, {
      syncProjectSharedProblemProjection: jest.fn().mockRejectedValue(new Error('projection write failed')),
      auditCollabGovernance: jest.fn().mockResolvedValue({
        passed: true,
        reason: 'passed',
        summary: {
          missing_gitignore_rules: 0,
          legacy_reference_count: 0
        },
        warnings: [],
        violations: []
      })
    });

    expect(payload.passed).toBe(false);
    expect(payload.exit_code).toBe(2);
    expect(payload.violations).toContain('project-shared problem projection sync failed: projection write failed');
  });
});
