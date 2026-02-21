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
      runtimeMode: ' OPS-FIX ',
      runtimeEnvironment: ' STAGING ',
      runtimePolicy: ' docs/interactive-customization/runtime-mode-policy-baseline.json ',
      runtimeOut: ' .kiro/reports/runtime.json ',
      dialoguePolicy: ' docs/interactive-customization/dialogue-governance-policy-baseline.json ',
      contextContract: ' docs/interactive-customization/moqui-copilot-context-contract.json ',
      workOrderOut: ' .kiro/reports/work-order.json ',
      workOrderMarkdownOut: ' .kiro/reports/work-order.md ',
      approvalActorRole: ' Product-Owner ',
      approverActorRole: ' Security-Admin ',
      approvalRolePolicy: ' docs/interactive-customization/approval-role-policy-baseline.json ',
      feedbackScore: '4.5',
      feedbackTags: 'moqui,approval',
      feedbackChannel: 'UI',
      authPasswordHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      authPasswordEnv: ' SCE_INTERACTIVE_AUTH_PASSWORD_SHA256 ',
      matrixMinScore: '75',
      matrixMinValidRate: '95',
      matrixSignals: ' .kiro/reports/custom-matrix.jsonl ',
      matrix: false,
      dryRun: false
    });

    expect(normalized.input).toBe('docs/moqui-provider.json');
    expect(normalized.provider).toBe('moqui');
    expect(normalized.goal).toBe('improve approval speed');
    expect(normalized.executionMode).toBe('apply');
    expect(normalized.runtimeMode).toBe('ops-fix');
    expect(normalized.runtimeEnvironment).toBe('staging');
    expect(normalized.runtimePolicy).toBe('docs/interactive-customization/runtime-mode-policy-baseline.json');
    expect(normalized.runtimeOut).toBe('.kiro/reports/runtime.json');
    expect(normalized.dialoguePolicy).toBe('docs/interactive-customization/dialogue-governance-policy-baseline.json');
    expect(normalized.contextContract).toBe('docs/interactive-customization/moqui-copilot-context-contract.json');
    expect(normalized.workOrderOut).toBe('.kiro/reports/work-order.json');
    expect(normalized.workOrderMarkdownOut).toBe('.kiro/reports/work-order.md');
    expect(normalized.approvalActorRole).toBe('product-owner');
    expect(normalized.approverActorRole).toBe('security-admin');
    expect(normalized.approvalRolePolicy).toBe('docs/interactive-customization/approval-role-policy-baseline.json');
    expect(normalized.feedbackScore).toBe(4.5);
    expect(normalized.feedbackTags).toBe('moqui,approval');
    expect(normalized.feedbackChannel).toBe('ui');
    expect(normalized.authPasswordHash).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(normalized.authPasswordEnv).toBe('SCE_INTERACTIVE_AUTH_PASSWORD_SHA256');
    expect(normalized.matrixMinScore).toBe(75);
    expect(normalized.matrixMinValidRate).toBe(95);
    expect(normalized.matrixSignals).toBe('.kiro/reports/custom-matrix.jsonl');
    expect(normalized.matrix).toBe(false);
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
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--execution-mode must be suggestion or apply');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'unknown',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--runtime-mode must be one of: user-assist, ops-fix, feature-dev');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'preprod',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--runtime-environment must be one of: dev, staging, prod');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'mail',
      feedbackScore: 7
    })).toBe('--feedback-score must be a number between 0 and 5');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'mail',
      feedbackScore: null
    })).toBe('--feedback-channel must be one of: ui, cli, api, other');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null,
      matrixMinScore: 120,
      matrixMinValidRate: 100
    })).toBe('--matrix-min-score must be a number between 0 and 100');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null,
      matrixMinScore: 80,
      matrixMinValidRate: -1
    })).toBe('--matrix-min-valid-rate must be a number between 0 and 100');

    expect(validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null,
      authPasswordHash: 'bad-hash'
    })).toBe('--auth-password-hash must be a sha256 hex string (64 chars)');
  });

  test('validate accepts valid options', () => {
    const error = validateSceneInteractiveFlowOptions({
      input: 'docs/moqui-provider.json',
      provider: 'moqui',
      goal: 'improve approval speed',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: 5
    });
    expect(error).toBeNull();
  });
});
