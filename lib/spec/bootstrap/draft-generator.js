class DraftGenerator {
  generate(input = {}) {
    const specName = input.specName;
    const profile = input.profile || 'general';
    const template = input.template || 'default';
    const context = input.context || {};
    const answers = input.answers || {};

    const requirementIds = ['Requirement 1', 'Requirement 2', 'Requirement 3'];
    const designIds = ['Design 1', 'Design 2', 'Design 3'];

    const requirements = this._buildRequirements(specName, profile, template, answers);
    const design = this._buildDesign(specName, profile, template, requirementIds, designIds, answers);
    const tasks = this._buildTasks(requirementIds, designIds);

    return {
      requirements,
      design,
      tasks,
      metadata: {
        profile,
        template,
        projectPath: context.projectPath,
        preferredLanguage: context.preferredLanguage || 'en',
        existingSpecCount: context.totalSpecs || 0,
        mapping: {
          requirements: requirementIds,
          design: designIds,
          taskCount: 6
        }
      }
    };
  }

  _buildRequirements(specName, profile, template, answers) {
    return `# Requirements Document

## Introduction

This Spec bootstrap draft was generated for ${specName} with profile ${profile} and template hint ${template}.

## Context Snapshot

- Problem statement: ${answers.problemStatement}
- Primary flow: ${answers.primaryFlow}
- Verification plan: ${answers.verificationPlan}

## Requirements

### Requirement 1: Establish command entry

**User Story:** As a user, I want one command to initialize a complete Spec draft.

#### Acceptance Criteria

1. THE CLI SHALL expose an entry command for bootstrap generation
2. THE command SHALL support explicit naming and non-interactive execution

### Requirement 2: Collect minimum context

**User Story:** As an implementer, I want the wizard to use project context with a controlled question set.

#### Acceptance Criteria

1. THE SYSTEM SHALL collect project metadata and existing Spec inventory
2. THE wizard SHALL keep the questionnaire small and default-driven
3. WHEN non-interactive mode is enabled THEN generation SHALL rely on arguments and defaults only

### Requirement 3: Generate traceable draft docs

**User Story:** As a team member, I want requirements/design/tasks to stay mapped and auditable.

#### Acceptance Criteria

1. THE SYSTEM SHALL output requirements.md, design.md, and tasks.md together
2. THE output SHALL contain requirement-design-task mapping references
3. THE output SHALL capture generation trace information for governance and audit
`;
  }

  _buildDesign(specName, profile, template, requirementIds, designIds, answers) {
    return `# Design Document

## Overview

This design document defines the bootstrap generation flow for ${specName}.

- Profile: ${profile}
- Template hint: ${template}

## Requirement Mapping

| Requirement | Design Component | Notes |
| --- | --- | --- |
| ${requirementIds[0]} | ${designIds[0]} | CLI entry and argument handling |
| ${requirementIds[1]} | ${designIds[1]} | Context collector and questionnaire |
| ${requirementIds[2]} | ${designIds[2]} | Draft generation and trace output |

## Design Components

### Design 1: Bootstrap command orchestration

- Parse name/template/profile/non-interactive/dry-run/json options
- Handle write mode and dry-run preview mode consistently

### Design 2: Context and prompt pipeline

- Collect project metadata and existing Spec list
- Keep questionnaire minimal with defaults
- Input guidance: ${answers.primaryFlow}

### Design 3: Draft and trace emitter

- Generate linked requirements/design/tasks content
- Emit trace metadata (template, profile, key parameters)
- Validation guidance: ${answers.verificationPlan}
`;
  }

  _buildTasks(requirementIds, designIds) {
    return `# Implementation Tasks

## Task List

- [ ] 1. Implement command entry and option parsing
  - **Requirement**: ${requirementIds[0]}
  - **Design**: ${designIds[0]}
  - **Validation**: Acceptance Criteria 1.1, 1.2

- [ ] 2. Implement dry-run and write-mode behavior
  - **Requirement**: ${requirementIds[0]}
  - **Design**: ${designIds[0]}
  - **Validation**: Acceptance Criteria 1.1

- [ ] 3. Implement context collector
  - **Requirement**: ${requirementIds[1]}
  - **Design**: ${designIds[1]}
  - **Validation**: Acceptance Criteria 2.1

- [ ] 4. Implement minimal questionnaire with defaults
  - **Requirement**: ${requirementIds[1]}
  - **Design**: ${designIds[1]}
  - **Validation**: Acceptance Criteria 2.2, 2.3

- [ ] 5. Implement linked document generation
  - **Requirement**: ${requirementIds[2]}
  - **Design**: ${designIds[2]}
  - **Validation**: Acceptance Criteria 3.1, 3.2

- [ ] 6. Implement trace output and JSON mode
  - **Requirement**: ${requirementIds[2]}
  - **Design**: ${designIds[2]}
  - **Validation**: Acceptance Criteria 3.3
`;
  }
}

module.exports = { DraftGenerator };
