# Requirements Document: Scene Eval Priority Policy Template

## Introduction

`scene eval --sync-spec-tasks` can append recommendations into spec tasks.
To make that output operationally useful across teams, priority mapping must be configurable
by eval grade and recommendation keywords, with a reusable template for rapid adoption.

## Requirements

### Requirement 1: Configurable Eval Task Priority Policy
- Support loading task sync policy JSON via eval command option.
- Policy should control default priority, grade-based mapping, and keyword overrides.
- Invalid priority values should gracefully fall back to safe defaults.

### Requirement 2: Priority-Aware Task Sync
- Eval recommendation sync should assign task priority from effective policy.
- Keyword rules should be able to escalate priority above grade baseline.
- Synced task metadata should include policy source for traceability.

### Requirement 3: Policy Template Bootstrap
- Provide command to generate a default eval task sync policy template JSON.
- Support custom output path and safe overwrite semantics.

### Requirement 4: Validation and UX
- `scene eval` should validate sync prerequisites and policy file structure.
- CLI help should expose policy-related options and template command.

### Requirement 5: Regression Coverage
- Add tests for policy normalization and priority resolution.
- Add tests for sync behavior with custom policy and template generation.
- Keep scene command/runtime test suites passing.
