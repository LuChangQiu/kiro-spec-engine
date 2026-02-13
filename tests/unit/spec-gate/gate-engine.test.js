const { RuleRegistry } = require('../../../lib/spec-gate/rules/rule-registry');
const { GateEngine } = require('../../../lib/spec-gate/engine/gate-engine');

describe('GateEngine', () => {
  test('aggregates rule scores and returns conditional-go decision', async () => {
    const registry = new RuleRegistry([
      {
        id: 'mandatory',
        async execute() {
          return { passed: true, ratio: 1, warnings: [] };
        }
      },
      {
        id: 'tests',
        async execute() {
          return {
            passed: false,
            ratio: 0.5,
            warnings: ['partial evidence'],
            details: { missing: 1 }
          };
        }
      }
    ]);

    const policy = {
      thresholds: { go: 90, conditional_go: 70 },
      strict_mode: { warning_as_failure: false },
      rules: {
        mandatory: { enabled: true, weight: 30, hard_fail: true },
        tests: { enabled: true, weight: 20, hard_fail: false }
      }
    };

    const engine = new GateEngine({ registry, policy });
    const result = await engine.evaluate({ specId: '111-00-spec-gate-standardization' });

    expect(result.score).toBe(80);
    expect(result.decision).toBe('conditional-go');
    expect(result.failed_checks).toHaveLength(1);
    expect(result.rules).toHaveLength(2);
  });

  test('strict warning mode returns no-go when warnings exist', async () => {
    const registry = new RuleRegistry([
      {
        id: 'docs',
        async execute() {
          return {
            passed: true,
            ratio: 1,
            warnings: ['format drift detected']
          };
        }
      }
    ]);

    const policy = {
      thresholds: { go: 90, conditional_go: 70 },
      strict_mode: { warning_as_failure: true },
      rules: {
        docs: { enabled: true, weight: 15, hard_fail: false }
      }
    };

    const engine = new GateEngine({ registry, policy });
    const result = await engine.evaluate({ specId: '111-00-spec-gate-standardization' });

    expect(result.decision).toBe('no-go');
    expect(result.warnings).toHaveLength(1);
  });

  test('hard fail rule forces no-go', async () => {
    const registry = new RuleRegistry([
      {
        id: 'mandatory',
        async execute() {
          return { passed: false, ratio: 0, warnings: [] };
        }
      }
    ]);

    const policy = {
      thresholds: { go: 90, conditional_go: 70 },
      strict_mode: { warning_as_failure: false },
      rules: {
        mandatory: { enabled: true, weight: 30, hard_fail: true }
      }
    };

    const engine = new GateEngine({ registry, policy });
    const result = await engine.evaluate({ specId: '111-00-spec-gate-standardization' });

    expect(result.decision).toBe('no-go');
    expect(result.failed_checks[0].hard_fail).toBe(true);
  });
});

