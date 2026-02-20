const {
  normalizeSceneInteractiveFlowOptions,
  validateSceneInteractiveFlowOptions
} = require('../../../lib/commands/scene');

describe('scene interactive-flow option helpers', () => {
  test('normalizes interactive-flow options', () => {
    const normalized = normalizeSceneInteractiveFlowOptions({
      input: ' docs/moqui-provider.json ',
      provider: ' MOQUI ',
      goal: ' improve approval speed ',
      executionMode: 'apply',
      contextContract: ' docs/interactive-customization/moqui-copilot-context-contract.json ',
      feedbackScore: '4.5',
      feedbackTags: 'moqui,approval',
      feedbackChannel: 'UI',
      dryRun: false
    });

    expect(normalized.input).toBe('docs/moqui-provider.json');
    expect(normalized.provider).toBe('moqui');
    expect(normalized.goal).toBe('improve approval speed');
    expect(normalized.executionMode).toBe('apply');
    expect(normalized.contextContract).toBe('docs/interactive-customization/moqui-copilot-context-contract.json');
    expect(normalized.feedbackScore).toBe(4.5);
    expect(normalized.feedbackTags).toBe('moqui,approval');
    expect(normalized.feedbackChannel).toBe('ui');
    expect(normalized.dryRun).toBe(false);
  });

  test('validate requires input and goal source', () => {
    expect(validateSceneInteractiveFlowOptions({
      input: '',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'suggestion',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--input is required');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: '',
      goalFile: '',
      executionMode: 'suggestion',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('either --goal or --goal-file is required');
  });

  test('validate enforces provider/execution/feedback constraints', () => {
    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'custom',
      goal: 'x',
      executionMode: 'suggestion',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--provider must be one of: moqui, generic');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'preview',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--execution-mode must be suggestion or apply');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      feedbackChannel: 'mail',
      feedbackScore: 7
    })).toBe('--feedback-score must be a number between 0 and 5');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      feedbackChannel: 'mail',
      feedbackScore: null
    })).toBe('--feedback-channel must be one of: ui, cli, api, other');
  });

  test('validate accepts valid options', () => {
    const error = validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'improve approval speed',
      executionMode: 'apply',
      feedbackChannel: 'ui',
      feedbackScore: 5
    });
    expect(error).toBeNull();
  });
});
