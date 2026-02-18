const {
  analyzeGoalSemantics,
  splitIntoClauses
} = require('../../../lib/auto/semantic-decomposer');

describe('semantic-decomposer', () => {
  test('splits mixed-language goals into semantic clauses', () => {
    const clauses = splitIntoClauses(
      'Build closed-loop execution, and split master/sub specs 并且 自动推进'
    );

    expect(clauses.length).toBeGreaterThanOrEqual(3);
  });

  test('scores major intent categories from goal semantics', () => {
    const analysis = analyzeGoalSemantics(
      'sce should support closed-loop automation and master/sub multi-spec orchestration with quality gate'
    );

    expect(analysis.categoryScores.closeLoop).toBeGreaterThan(0);
    expect(analysis.categoryScores.decomposition).toBeGreaterThan(0);
    expect(analysis.categoryScores.orchestration).toBeGreaterThan(0);
    expect(analysis.categoryScores.quality).toBeGreaterThan(0);
  });
});
