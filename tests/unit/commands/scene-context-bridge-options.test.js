const {
  normalizeSceneContextBridgeOptions,
  validateSceneContextBridgeOptions
} = require('../../../lib/commands/scene');

describe('scene context-bridge option helpers', () => {
  test('normalizes context-bridge options', () => {
    const normalized = normalizeSceneContextBridgeOptions({
      input: ' data/moqui-payload.json ',
      provider: ' MOQUI ',
      outContext: ' .kiro/reports/context.json ',
      outReport: ' .kiro/reports/context-report.json ',
      contextContract: ' docs/interactive-customization/moqui-copilot-context-contract.json ',
      strictContract: false,
      json: true
    });

    expect(normalized.input).toBe('data/moqui-payload.json');
    expect(normalized.provider).toBe('moqui');
    expect(normalized.outContext).toBe('.kiro/reports/context.json');
    expect(normalized.outReport).toBe('.kiro/reports/context-report.json');
    expect(normalized.contextContract).toBe('docs/interactive-customization/moqui-copilot-context-contract.json');
    expect(normalized.strictContract).toBe(false);
    expect(normalized.json).toBe(true);
  });

  test('validate requires input and valid provider', () => {
    expect(validateSceneContextBridgeOptions({
      input: '',
      provider: 'moqui'
    })).toBe('--input is required');

    expect(validateSceneContextBridgeOptions({
      input: 'data/payload.json',
      provider: 'custom'
    })).toBe('--provider must be one of: moqui, generic');
  });

  test('validate accepts a valid option set', () => {
    const error = validateSceneContextBridgeOptions({
      input: 'data/payload.json',
      provider: 'generic',
      strictContract: true
    });
    expect(error).toBeNull();
  });
});
