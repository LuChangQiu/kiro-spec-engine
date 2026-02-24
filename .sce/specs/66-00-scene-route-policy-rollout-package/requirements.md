# Requirements Document: Scene Route Policy Rollout Package

## Introduction

Route policy suggestion now generates tuned policies from eval feedback. Teams still need a governed delivery artifact
that supports verification, apply, and rollback across environments.

## Requirements

### Requirement 1: Rollout Packaging Command
- Add `scene route-policy-rollout` command to consume a suggestion payload.
- Command should generate a rollout directory with candidate policy, rollback policy, and plan metadata.
- Command should fail with actionable errors for invalid suggestion payloads.

### Requirement 2: Rollout Naming and Output Governance
- Support explicit rollout name and deterministic auto-generated fallback name.
- Support configurable rollout output root directory.
- Support safe overwrite guard with force option.

### Requirement 3: Policy Diff and Change Audit
- Rollout plan should include normalized policy field differences.
- Diff should cover route policy scoring weights, commit risk bias, and alternatives window.
- Plan should expose change count and source suggestion metadata.

### Requirement 4: Apply/Rollback Operational Guidance
- Generate a runbook with verification commands, apply guidance, and rollback guidance.
- Rollout payload should include target policy path and command references.
- Preserve traceability by linking to suggestion source path.

### Requirement 5: Regression Safety
- Extend scene command unit tests for rollout validation and packaging behavior.
- Keep scene command and full project test suites passing.
- Keep document compliance and project status healthy.
