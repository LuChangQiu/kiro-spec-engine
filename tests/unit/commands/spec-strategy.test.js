const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { runSpecStrategyAssessCommand } = require('../../../lib/commands/spec-strategy');

describe('spec-strategy command', () => {
  let tempDir;
  let originalLog;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-spec-strategy-'));
    originalLog = console.log;
    console.log = jest.fn();
  });

  afterEach(async () => {
    console.log = originalLog;
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('recommends single-spec for a narrow goal', async () => {
    const payload = await runSpecStrategyAssessCommand({
      goal: 'fix login button alignment in application home page',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.mode).toBe('spec-strategy-assess');
    expect(payload.decision).toBe('single-spec');
    expect(payload.summary.single_spec_fit).toBe(true);
    expect(payload.summary.recommended_program_specs).toBe(1);
  });

  test('recommends multi-spec-program for a broad but sufficiently clear goal', async () => {
    const payload = await runSpecStrategyAssessCommand({
      goal: 'coordinate frontend runtime projection, backend api contract alignment, orchestration, testing, documentation and rollout for app install management',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.decision).toBe('multi-spec-program');
    expect(payload.recommended_topology.type).toBe('implementation-master-sub');
    expect(payload.summary.recommended_program_specs).toBeGreaterThanOrEqual(3);
  });

  test('recommends research-program for a highly unclear entangled goal', async () => {
    const payload = await runSpecStrategyAssessCommand({
      goal: 'untangle a cross-scene sales and planning workflow where frontend/backend api contracts are unclear, approval policy is undecided, ownership is unknown, and one spec cannot yet produce stable executable tasks',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.decision).toBe('research-program');
    expect(payload.recommended_topology.type).toBe('research-first-master-sub');
    expect(payload.signals.length).toBeGreaterThan(0);
  });

  test('assesses an existing spec from current artifacts', async () => {
    const specId = '129-01-entangled-order-research';
    const specRoot = path.join(tempDir, '.sce', 'specs', specId);
    await fs.ensureDir(path.join(specRoot, 'custom'));
    await fs.writeFile(path.join(specRoot, 'requirements.md'), [
      '# Entangled order research',
      '',
      'Frontend/backend API contract is unclear.',
      'Approval policy is undecided.',
      'Ownership across sales and planning teams is unknown.'
    ].join('\n'), 'utf8');
    await fs.writeFile(path.join(specRoot, 'design.md'), [
      '# Design',
      '',
      'TODO: settle cross-scene interface and policy boundary before implementation.'
    ].join('\n'), 'utf8');
    await fs.writeFile(path.join(specRoot, 'tasks.md'), '- [ ] clarify contract boundary\n', 'utf8');

    const payload = await runSpecStrategyAssessCommand({
      spec: specId,
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    });

    expect(payload.source).toEqual(expect.objectContaining({
      type: 'spec',
      id: specId
    }));
    expect(payload.decision).toBe('research-program');
    expect(payload.spec_coverage).toEqual(expect.objectContaining({
      passed: false
    }));
  });

  test('requires exactly one selector', async () => {
    await expect(runSpecStrategyAssessCommand({
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    })).rejects.toThrow('One selector is required');

    await expect(runSpecStrategyAssessCommand({
      goal: 'a',
      spec: '129-00-demo',
      json: true
    }, {
      projectPath: tempDir,
      fileSystem: fs
    })).rejects.toThrow('Use either --goal or --spec, not both');
  });
});
