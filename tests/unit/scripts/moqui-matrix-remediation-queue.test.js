const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('moqui-matrix-remediation-queue script', () => {
  let tempDir;
  let scriptPath;
  let projectRoot;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-matrix-remediation-queue-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'moqui-matrix-remediation-queue.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  test('exports queue lines with template and capability mapping', async () => {
    const workspace = path.join(tempDir, 'workspace-export');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    const linesOut = path.join(workspace, 'queue.lines');
    const out = path.join(workspace, 'plan.json');
    const markdownOut = path.join(workspace, 'plan.md');
    const batchJsonOut = path.join(workspace, 'goals.json');
    const commandsOut = path.join(workspace, 'commands.md');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -23.4 },
          { metric: 'decision_closed', delta_rate_percent: -8.3 }
        ]
      },
      templates: [
        {
          template_id: 'sce.scene--moqui-order-approval--0.1.0',
          capabilities_provides: ['approval-routing', 'order-governance'],
          semantic: { score: 68 },
          baseline: {
            flags: {
              business_rule_closed: false,
              decision_closed: false,
              baseline_passed: false
            },
            gaps: ['unmapped business rules remain', 'undecided decisions remain']
          }
        }
      ]
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--out', out,
      '--lines-out', linesOut,
      '--markdown-out', markdownOut,
      '--batch-json-out', batchJsonOut,
      '--commands-out', commandsOut,
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.selected_regressions).toBe(2);
    expect(payload.summary.phase_high_count).toBe(1);
    expect(payload.summary.phase_medium_count).toBe(1);
    expect(payload.execution_policy.phase_split).toBe(true);
    expect(payload.items[0].template_candidates[0].template_id).toBe('sce.scene--moqui-order-approval--0.1.0');
    expect(payload.items[0].capability_focus).toEqual(expect.arrayContaining(['approval-routing']));

    const lines = (await fs.readFile(linesOut, 'utf8'))
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('business_rule_closed');
    expect(lines[0]).toContain('sce.scene--moqui-order-approval--0.1.0');
    expect(await fs.pathExists(markdownOut)).toBe(true);

    const goalsPayload = await fs.readJson(batchJsonOut);
    expect(Array.isArray(goalsPayload.goals)).toBe(true);
    expect(goalsPayload.goals.length).toBe(2);
    expect(goalsPayload.goals[0]).toContain('Recover matrix regression');

    const highLinesOut = path.join(workspace, 'queue.high.lines');
    const mediumLinesOut = path.join(workspace, 'queue.medium.lines');
    const highGoalsOut = path.join(workspace, 'goals.high.json');
    const mediumGoalsOut = path.join(workspace, 'goals.medium.json');
    expect(payload.artifacts.phase_high_lines_out).toBe('queue.high.lines');
    expect(payload.artifacts.phase_medium_lines_out).toBe('queue.medium.lines');
    expect(payload.artifacts.phase_high_goals_out).toBe('goals.high.json');
    expect(payload.artifacts.phase_medium_goals_out).toBe('goals.medium.json');
    expect(await fs.pathExists(highLinesOut)).toBe(true);
    expect(await fs.pathExists(mediumLinesOut)).toBe(true);
    expect(await fs.pathExists(highGoalsOut)).toBe(true);
    expect(await fs.pathExists(mediumGoalsOut)).toBe(true);
    const highGoalsPayload = await fs.readJson(highGoalsOut);
    const mediumGoalsPayload = await fs.readJson(mediumGoalsOut);
    expect(Array.isArray(highGoalsPayload.goals)).toBe(true);
    expect(Array.isArray(mediumGoalsPayload.goals)).toBe(true);
    expect(highGoalsPayload.goals.length).toBe(1);
    expect(mediumGoalsPayload.goals.length).toBe(1);

    const commandsText = await fs.readFile(commandsOut, 'utf8');
    expect(commandsText).toContain('sce auto close-loop-batch');
    expect(commandsText).toContain('--format json');
    expect(commandsText).toContain('Rate-Limit Safe Phased Mode');
    expect(commandsText).toContain('sleep 20');
    expect(commandsText).toContain('moqui-matrix-remediation-phased-runner.js');
    expect(commandsText).toContain('--baseline');
    expect(commandsText).toContain('sce auto close-loop');
  });

  test('limits template candidates by top-templates', async () => {
    const workspace = path.join(tempDir, 'workspace-top-limit');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -12.5 }
        ]
      },
      templates: [
        {
          template_id: 'sce.scene--moqui-order-approval-a--0.1.0',
          semantic: { score: 61 },
          baseline: {
            flags: {
              business_rule_closed: false
            },
            gaps: ['unmapped business rules remain']
          }
        },
        {
          template_id: 'sce.scene--moqui-order-approval-b--0.1.0',
          semantic: { score: 72 },
          baseline: {
            flags: {
              business_rule_closed: false
            },
            gaps: ['unmapped business rules remain']
          }
        }
      ]
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--top-templates', '1',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.selected_regressions).toBe(1);
    expect(payload.items[0].template_candidates.length).toBe(1);
    expect(payload.items[0].template_candidates[0].template_id).toBe('sce.scene--moqui-order-approval-a--0.1.0');
  });

  test('applies min delta filter', async () => {
    const workspace = path.join(tempDir, 'workspace-filter');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -12.5 },
          { metric: 'decision_closed', delta_rate_percent: -4.2 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--min-delta-abs', '10',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.summary.selected_regressions).toBe(1);
    expect(payload.items[0].metric).toBe('business_rule_closed');
  });

  test('supports no-phase-split mode', async () => {
    const workspace = path.join(tempDir, 'workspace-no-phase');
    await fs.ensureDir(workspace);
    const baseline = path.join(workspace, 'baseline.json');
    const linesOut = path.join(workspace, 'queue.lines');
    const batchJsonOut = path.join(workspace, 'goals.json');
    const commandsOut = path.join(workspace, 'commands.md');
    await fs.writeJson(baseline, {
      compare: {
        coverage_matrix_regressions: [
          { metric: 'business_rule_closed', delta_rate_percent: -30.0 },
          { metric: 'decision_closed', delta_rate_percent: -6.0 }
        ]
      }
    }, { spaces: 2 });

    const result = runScript(workspace, [
      '--baseline', baseline,
      '--lines-out', linesOut,
      '--batch-json-out', batchJsonOut,
      '--commands-out', commandsOut,
      '--no-phase-split',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.execution_policy.phase_split).toBe(false);
    expect(payload.artifacts.phase_high_lines_out).toBeNull();
    expect(payload.artifacts.phase_medium_lines_out).toBeNull();
    expect(payload.artifacts.phase_high_goals_out).toBeNull();
    expect(payload.artifacts.phase_medium_goals_out).toBeNull();
    expect(await fs.pathExists(path.join(workspace, 'queue.high.lines'))).toBe(false);
    expect(await fs.pathExists(path.join(workspace, 'queue.medium.lines'))).toBe(false);
    expect(await fs.pathExists(path.join(workspace, 'goals.high.json'))).toBe(false);
    expect(await fs.pathExists(path.join(workspace, 'goals.medium.json'))).toBe(false);

    const commandsText = await fs.readFile(commandsOut, 'utf8');
    expect(commandsText).not.toContain('Rate-Limit Safe Phased Mode');
  });
});
