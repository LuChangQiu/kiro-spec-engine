const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const {
  decomposeGoalToSpecPortfolio,
  resolveSubSpecCount
} = require('../../../lib/auto/goal-decomposer');

describe('goal-decomposer', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-goal-decomposer-'));
    await fs.ensureDir(path.join(tempDir, '.sce', 'specs', '115-00-existing-program'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('decomposes close-loop + master/sub goal into deterministic portfolio', async () => {
    const result = await decomposeGoalToSpecPortfolio(
      'sce should support closed-loop automation and master/sub multi-spec orchestration',
      { projectPath: tempDir }
    );

    expect(result.prefix).toBe(116);
    expect(result.masterSpec.name).toBe('116-00-autonomous-close-loop-master-sub-program');
    expect(result.subSpecs.length).toBeGreaterThanOrEqual(3);
    expect(result.subSpecs.length).toBeLessThanOrEqual(4);
    const names = result.subSpecs.map(spec => spec.name);
    expect(names.some(name => name.includes('closed-loop-autonomous-execution'))).toBe(true);
    expect(names.some(name => name.includes('master-sub-spec-decomposition'))).toBe(true);
    expect(result.subSpecs[2].dependencies).toEqual(expect.arrayContaining([
      { spec: result.subSpecs[0].name, type: 'requires-completion' },
      { spec: result.subSpecs[1].name, type: 'requires-completion' }
    ]));
    expect(result.strategy.categoryScores.closeLoop).toBeGreaterThan(0);
    expect(result.strategy.categoryScores.decomposition).toBeGreaterThan(0);
  });

  test('respects explicit sub-spec count with validation', () => {
    expect(resolveSubSpecCount('simple goal', 5)).toBe(5);
    expect(() => resolveSubSpecCount('simple goal', 1)).toThrow('--subs must be an integer between 2 and 5');
    expect(() => resolveSubSpecCount('simple goal', 6)).toThrow('--subs must be an integer between 2 and 5');
  });

  test('auto-escalates to five sub-specs for highly complex goals', async () => {
    const complexGoal = [
      'sce should provide closed-loop autonomous execution and master/sub decomposition,',
      'parallel orchestration runtime and scheduler resilience,',
      'quality gate with observability KPI, tests, and acceptance evidence,',
      'plus documentation rollout guide, migration plan, and operator training for enterprise teams.'
    ].join(' ');

    const result = await decomposeGoalToSpecPortfolio(complexGoal, { projectPath: tempDir });
    expect(result.subSpecs).toHaveLength(5);
    expect(result.strategy.subSpecCount).toBe(5);
    expect(result.strategy.matchedTracks).toHaveLength(5);
  });
});
