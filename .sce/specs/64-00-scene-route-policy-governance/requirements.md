# Requirements Document: Scene Route Policy Governance

## Introduction

`scene route` now resolves scene targets for execution handoff. To make routing behavior adaptable across ERP and
hybrid/robot contexts, scoring and ranking rules must be externalized into a policy artifact that teams can tune.

## Requirements

### Requirement 1: Route Policy Input Support
- `scene route` should accept an external route policy JSON path.
- Route policy load failures should return actionable command errors.
- Route payload should expose the effective policy source.

### Requirement 2: Policy-Driven Scoring
- Candidate scoring should use policy-defined weights instead of hardcoded constants.
- Policy should govern scene_ref match weights, query token weight, and commit risk bias.
- Candidate alternative window should be policy-driven.

### Requirement 3: Route Policy Template Generation
- Add command to generate route policy templates for fast adoption.
- Template generation should support profile selection (`default|erp|hybrid|robot`).
- Template command should support safe overwrite and JSON summary output.

### Requirement 4: Observability and Interop
- Route output should include policy source and effective policy content for auditability.
- Human-readable route summary should display policy source.
- JSON output should preserve policy metadata for downstream automation.

### Requirement 5: Regression Safety
- Extend scene command unit tests for route policy validation and command behavior.
- Keep scene command unit suite and CLI syntax checks passing.
- Preserve document compliance and full project status consistency.
