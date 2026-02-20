const {
  normalizeSceneInteractiveLoopOptions,
  validateSceneInteractiveLoopOptions
} = require('../../../lib/commands/scene');

describe('scene interactive-loop option helpers', () => {
  test('normalizes basic interactive-loop options', () => {
    const normalized = normalizeSceneInteractiveLoopOptions({
      context: ' docs/context.json ',
      goal: ' improve approval speed ',
      executionMode: 'apply',
      contextContract: ' docs/interactive-customization/moqui-copilot-context-contract.json ',
      strictContract: false,
      feedbackScore: '4.5',
      feedbackTags: 'moqui,approval',
      feedbackChannel: 'UI',
      dryRun: false
    });

    expect(normalized.context).toBe('docs/context.json');
    expect(normalized.goal).toBe('improve approval speed');
    expect(normalized.executionMode).toBe('apply');
    expect(normalized.contextContract).toBe('docs/interactive-customization/moqui-copilot-context-contract.json');
    expect(normalized.strictContract).toBe(false);
    expect(normalized.feedbackScore).toBe(4.5);
    expect(normalized.feedbackTags).toBe('moqui,approval');
    expect(normalized.feedbackChannel).toBe('ui');
    expect(normalized.dryRun).toBe(false);
  });

  test('validate requires context and goal source', () => {
    expect(validateSceneInteractiveLoopOptions({
      context: '',
      goal: 'x',
      executionMode: 'suggestion',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--context is required');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: '',
      goalFile: '',
      executionMode: 'suggestion',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('either --goal or --goal-file is required');
  });

  test('validate enforces execution mode and feedback constraints', () => {
    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'preview',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--execution-mode must be suggestion or apply');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      feedbackChannel: 'ui',
      feedbackScore: 7
    })).toBe('--feedback-score must be a number between 0 and 5');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      contextContract: '',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--context-contract cannot be empty');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      feedbackChannel: 'mail',
      feedbackScore: null
    })).toBe('--feedback-channel must be one of: ui, cli, api, other');
  });

  test('validate accepts a valid option set', () => {
    const error = validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'improve approval speed',
      executionMode: 'apply',
      feedbackChannel: 'ui',
      feedbackScore: 5
    });
    expect(error).toBeNull();
  });
});
