const {
  applyBusinessModePolicy,
  inferBusinessMode
} = require('../../../lib/runtime/business-mode-resolver');

describe('business-mode-resolver', () => {
  test('applies preset defaults for explicit dev-mode', () => {
    const options = {
      businessMode: 'dev-mode',
      businessModePolicy: 'docs/interactive-customization/business-mode-policy-baseline.json',
      allowModeOverride: false,
      executionMode: 'suggestion',
      dialogueProfile: 'business-user',
      uiMode: 'user-app',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      autoExecuteLowRisk: false
    };
    const explicitKeys = new Set();

    const result = applyBusinessModePolicy(options, explicitKeys, process.cwd());
    expect(result.business_mode).toBe('dev-mode');
    expect(options.executionMode).toBe('apply');
    expect(options.dialogueProfile).toBe('system-maintainer');
    expect(options.uiMode).toBe('ops-console');
    expect(options.runtimeMode).toBe('feature-dev');
    expect(options.runtimeEnvironment).toBe('dev');
  });

  test('throws on explicit conflict when override is not allowed', () => {
    const options = {
      businessMode: 'user-mode',
      businessModePolicy: 'docs/interactive-customization/business-mode-policy-baseline.json',
      allowModeOverride: false,
      executionMode: 'apply',
      dialogueProfile: 'business-user',
      uiMode: 'user-app',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      autoExecuteLowRisk: false
    };
    const explicitKeys = new Set(['executionMode']);

    expect(() => applyBusinessModePolicy(options, explicitKeys, process.cwd()))
      .toThrow('--business-mode user-mode conflicts with explicit options');
  });

  test('allows explicit conflict when allowModeOverride is set', () => {
    const options = {
      businessMode: 'user-mode',
      businessModePolicy: 'docs/interactive-customization/business-mode-policy-baseline.json',
      allowModeOverride: true,
      executionMode: 'apply',
      dialogueProfile: 'business-user',
      uiMode: 'user-app',
      runtimeMode: 'user-assist',
      runtimeEnvironment: 'staging',
      autoExecuteLowRisk: false
    };
    const explicitKeys = new Set(['executionMode']);

    const result = applyBusinessModePolicy(options, explicitKeys, process.cwd());
    expect(result.business_mode).toBe('user-mode');
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  test('inferBusinessMode returns dev-mode for feature-dev runtime', () => {
    expect(inferBusinessMode({
      runtimeMode: 'feature-dev',
      dialogueProfile: 'business-user',
      executionMode: 'suggestion'
    })).toBe('dev-mode');
  });
});
