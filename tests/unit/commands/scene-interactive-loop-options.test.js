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
      runtimeMode: ' OPS-FIX ',
      runtimeEnvironment: ' STAGING ',
      runtimePolicy: ' docs/interactive-customization/runtime-mode-policy-baseline.json ',
      runtimeOut: ' .kiro/reports/runtime.json ',
      authorizationTierPolicy: ' docs/interactive-customization/authorization-tier-policy-baseline.json ',
      authorizationTierOut: ' .kiro/reports/authorization-tier.json ',
      dialoguePolicy: ' docs/interactive-customization/dialogue-governance-policy-baseline.json ',
      dialogueProfile: ' SYSTEM-MAINTAINER ',
      contextContract: ' docs/interactive-customization/moqui-copilot-context-contract.json ',
      workOrderOut: ' .kiro/reports/work-order.json ',
      workOrderMarkdownOut: ' .kiro/reports/work-order.md ',
      approvalActorRole: ' Product-Owner ',
      approverActorRole: ' Security-Admin ',
      approvalRolePolicy: ' docs/interactive-customization/approval-role-policy-baseline.json ',
      strictContract: false,
      feedbackScore: '4.5',
      feedbackTags: 'moqui,approval',
      feedbackChannel: 'UI',
      authPasswordHash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      authPasswordEnv: ' SCE_INTERACTIVE_AUTH_PASSWORD_SHA256 ',
      dryRun: false
    });

    expect(normalized.context).toBe('docs/context.json');
    expect(normalized.goal).toBe('improve approval speed');
    expect(normalized.executionMode).toBe('apply');
    expect(normalized.runtimeMode).toBe('ops-fix');
    expect(normalized.runtimeEnvironment).toBe('staging');
    expect(normalized.runtimePolicy).toBe('docs/interactive-customization/runtime-mode-policy-baseline.json');
    expect(normalized.runtimeOut).toBe('.kiro/reports/runtime.json');
    expect(normalized.authorizationTierPolicy).toBe('docs/interactive-customization/authorization-tier-policy-baseline.json');
    expect(normalized.authorizationTierOut).toBe('.kiro/reports/authorization-tier.json');
    expect(normalized.dialoguePolicy).toBe('docs/interactive-customization/dialogue-governance-policy-baseline.json');
    expect(normalized.dialogueProfile).toBe('system-maintainer');
    expect(normalized.contextContract).toBe('docs/interactive-customization/moqui-copilot-context-contract.json');
    expect(normalized.workOrderOut).toBe('.kiro/reports/work-order.json');
    expect(normalized.workOrderMarkdownOut).toBe('.kiro/reports/work-order.md');
    expect(normalized.approvalActorRole).toBe('product-owner');
    expect(normalized.approverActorRole).toBe('security-admin');
    expect(normalized.approvalRolePolicy).toBe('docs/interactive-customization/approval-role-policy-baseline.json');
    expect(normalized.strictContract).toBe(false);
    expect(normalized.feedbackScore).toBe(4.5);
    expect(normalized.feedbackTags).toBe('moqui,approval');
    expect(normalized.feedbackChannel).toBe('ui');
    expect(normalized.authPasswordHash).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(normalized.authPasswordEnv).toBe('SCE_INTERACTIVE_AUTH_PASSWORD_SHA256');
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
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--execution-mode must be suggestion or apply');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      dialogueProfile: 'ops-user',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--dialogue-profile must be one of: business-user, system-maintainer');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'unknown',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--runtime-mode must be one of: user-assist, ops-fix, feature-dev');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'preprod',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--runtime-environment must be one of: dev, staging, prod');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: 7
    })).toBe('--feedback-score must be a number between 0 and 5');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      contextContract: '',
      feedbackChannel: 'ui',
      feedbackScore: null
    })).toBe('--context-contract cannot be empty');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'mail',
      feedbackScore: null
    })).toBe('--feedback-channel must be one of: ui, cli, api, other');

    expect(validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
      goal: 'x',
      executionMode: 'apply',
      runtimeMode: 'ops-fix',
      runtimeEnvironment: 'staging',
      feedbackChannel: 'ui',
      feedbackScore: null,
      authPasswordHash: 'bad-hash'
    })).toBe('--auth-password-hash must be a sha256 hex string (64 chars)');
  });

  test('validate accepts a valid option set', () => {
    const error = validateSceneInteractiveLoopOptions({
      context: 'docs/context.json',
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
