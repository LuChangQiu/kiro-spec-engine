const { DraftGenerator } = require('../../../../lib/spec/bootstrap/draft-generator');

describe('DraftGenerator', () => {
  test('generates linked requirements-design-tasks draft with mapping metadata', () => {
    const generator = new DraftGenerator();

    const draft = generator.generate({
      specName: '109-00-spec-bootstrap-wizard',
      profile: 'backend-api',
      template: 'rest-api',
      context: {
        projectPath: '/tmp/project',
        preferredLanguage: 'en',
        totalSpecs: 8
      },
      answers: {
        problemStatement: 'Reduce manual spec startup effort.',
        primaryFlow: 'Collect context and generate draft docs.',
        verificationPlan: 'Validate command behavior and generated mapping.'
      }
    });

    expect(draft.requirements).toContain('### Requirement 1: Establish command entry');
    expect(draft.requirements).toContain('#### Acceptance Criteria');

    expect(draft.design).toContain('## Requirement Mapping');
    expect(draft.design).toContain('| Requirement | Design Component | Notes |');

    expect(draft.tasks).toContain('**Requirement**: Requirement 1');
    expect(draft.tasks).toContain('**Validation**: Acceptance Criteria 1.1, 1.2');

    expect(draft.metadata.mapping.requirements).toEqual([
      'Requirement 1',
      'Requirement 2',
      'Requirement 3'
    ]);
    expect(draft.metadata.mapping.design).toEqual([
      'Design 1',
      'Design 2',
      'Design 3'
    ]);
    expect(draft.metadata.mapping.taskCount).toBeGreaterThan(0);
  });
});

