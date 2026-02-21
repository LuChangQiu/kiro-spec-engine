const {
  DEFAULT_CONTEXT,
  DEFAULT_GOAL,
  DEFAULT_APPROVAL_ROLE_POLICY,
  DEFAULT_APPROVAL_ACTOR_ROLE,
  DEFAULT_APPROVER_ACTOR_ROLE,
  DEFAULT_DIALOGUE_PROFILE,
  DEFAULT_OUT,
  parseArgs,
  parseJson
} = require('../../../scripts/interactive-loop-smoke');

describe('interactive-loop-smoke helpers', () => {
  test('parseArgs uses defaults', () => {
    const options = parseArgs([]);
    expect(options.context).toBe(DEFAULT_CONTEXT);
    expect(options.goal).toBe(DEFAULT_GOAL);
    expect(options.approvalRolePolicy).toBe(DEFAULT_APPROVAL_ROLE_POLICY);
    expect(options.approvalActorRole).toBe(DEFAULT_APPROVAL_ACTOR_ROLE);
    expect(options.approverActorRole).toBe(DEFAULT_APPROVER_ACTOR_ROLE);
    expect(options.dialogueProfile).toBe(DEFAULT_DIALOGUE_PROFILE);
    expect(options.out).toBe(DEFAULT_OUT);
    expect(options.json).toBe(false);
  });

  test('parseArgs accepts explicit overrides', () => {
    const options = parseArgs([
      '--context', 'tmp/context.json',
      '--goal', 'goal text',
      '--approval-role-policy', 'tmp/approval-role-policy.json',
      '--approval-actor-role', 'product-owner',
      '--approver-actor-role', 'release-operator',
      '--dialogue-profile', 'system-maintainer',
      '--out', 'tmp/out.json',
      '--json'
    ]);
    expect(options.context).toBe('tmp/context.json');
    expect(options.goal).toBe('goal text');
    expect(options.approvalRolePolicy).toBe('tmp/approval-role-policy.json');
    expect(options.approvalActorRole).toBe('product-owner');
    expect(options.approverActorRole).toBe('release-operator');
    expect(options.dialogueProfile).toBe('system-maintainer');
    expect(options.out).toBe('tmp/out.json');
    expect(options.json).toBe(true);
  });

  test('parseJson parses JSON payload', () => {
    const payload = parseJson('{"ok":true}', 'sample');
    expect(payload.ok).toBe(true);
  });

  test('parseJson throws on invalid JSON', () => {
    expect(() => parseJson('not-json', 'sample')).toThrow('not valid JSON');
  });
});
