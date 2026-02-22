'use strict';

const {
  evaluateStrategy
} = require('../../../scripts/auto-strategy-router');

describe('auto strategy router', () => {
  test('returns answer_only for explicit answer mode', () => {
    const result = evaluateStrategy({
      goal_type: 'bugfix',
      requires_write: true,
      user_explicit_answer_only: true
    });
    expect(result.decision).toBe('answer_only');
    expect(result.confidence).toBe('high');
  });

  test('returns rollback when explicit rollback and checkpoint exists', () => {
    const result = evaluateStrategy({
      goal_type: 'bugfix',
      user_explicit_rollback: true,
      has_rollback_checkpoint: true,
      high_risk: true
    });
    expect(result.decision).toBe('rollback');
  });

  test('returns code_fix when tests fail after changes', () => {
    const result = evaluateStrategy({
      goal_type: 'bugfix',
      requires_write: true,
      test_failures: 3,
      changed_files: 2
    });
    expect(result.decision).toBe('code_fix');
    expect(result.reasons.join(' ')).toContain('tests failing');
  });

  test('returns code_change for feature requiring write', () => {
    const result = evaluateStrategy({
      goal_type: 'feature',
      requires_write: true,
      changed_files: 0
    });
    expect(result.decision).toBe('code_change');
  });

  test('returns answer_only for analysis goal without write requirement', () => {
    const result = evaluateStrategy({
      goal_type: 'analysis',
      requires_write: false
    });
    expect(result.decision).toBe('answer_only');
    expect(result.confidence).toBe('high');
  });
});
