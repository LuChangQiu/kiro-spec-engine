const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  classifyStudioGoalIntent,
  resolveStudioSpecIntakeDecision,
  runStudioAutoIntake,
  runStudioSpecGovernance
} = require('../../../lib/studio/spec-intake-governor');

describe('studio spec-intake-governor', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-intake-governor-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('classifies change requests and analysis-only goals', () => {
    const change = classifyStudioGoalIntent('Implement customer onboarding workflow');
    const analysis = classifyStudioGoalIntent('How to access customer onboarding page?');

    expect(change.intent_type).toBe('change_request');
    expect(change.requires_spec).toBe(true);
    expect(analysis.intent_type).toBe('analysis_only');
    expect(analysis.requires_spec).toBe(false);
  });

  test('prefers bound scene spec when divergence is low', () => {
    const decision = resolveStudioSpecIntakeDecision({
      goal: 'optimize order approval retry flow',
      explicit_spec_id: '',
      domain_chain_binding: {
        resolved: true,
        spec_id: '01-00-order-approval',
        summary: {
          problem_statement: 'optimize order approval retry flow'
        }
      },
      related_specs: {
        related_specs: []
      }
    });

    expect(decision.action).toBe('bind_existing');
    expect(decision.spec_id).toBe('01-00-order-approval');
    expect(decision.reason).toBe('prefer_existing_scene_spec');
  });

  test('auto intake creates spec artifacts in apply mode', async () => {
    const result = await runStudioAutoIntake({
      scene_id: 'scene.auto-intake-unit',
      from_chat: 'session-unit-001',
      goal: 'Implement payment timeout remediation flow',
      apply: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(result.selected_spec_id).toBeTruthy();
    expect(result.created_spec).toEqual(expect.objectContaining({
      created: true,
      spec_id: result.selected_spec_id
    }));
    expect(await fs.pathExists(path.join(tempDir, '.sce', 'specs', result.selected_spec_id, 'requirements.md'))).toBe(true);
  });

  test('portfolio governance generates scene index and duplicate alerts', async () => {
    const first = await runStudioAutoIntake({
      scene_id: 'scene.govern-duplicate',
      from_chat: 'session-govern-001',
      goal: 'Implement order approval retry policy repair',
      apply: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    const second = await runStudioAutoIntake({
      scene_id: 'scene.govern-duplicate',
      from_chat: 'session-govern-002',
      goal: 'Implement order approval retry policy repair for checkout',
      apply: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(first.selected_spec_id).toBeTruthy();
    expect(second.selected_spec_id).toBeTruthy();

    const report = await runStudioSpecGovernance({
      apply: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(report.summary.total_specs).toBeGreaterThanOrEqual(2);
    expect(report.report_file).toBe('.sce/spec-governance/scene-portfolio.latest.json');
    expect(await fs.pathExists(path.join(tempDir, '.sce', 'spec-governance', 'scene-index.json'))).toBe(true);
  });
});
