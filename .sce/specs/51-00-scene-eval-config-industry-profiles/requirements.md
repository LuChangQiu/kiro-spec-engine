# Requirements Document: Scene Eval Config Industry Profiles

## Introduction

Unified `scene-eval-config` template already supports env layering. Different domains (ERP, ops, robot)
need distinct bootstrap defaults so teams can start with sensible thresholds and task-priority rules
without manual tuning from scratch.

## Requirements

### Requirement 1: Profile-Aware Template Generation
- Extend `scene eval-config-template` to accept profile selection.
- Support profile values: `default`, `erp`, `ops`, `robot`.
- Reject unsupported profile values with clear error message.

### Requirement 2: Domain Baseline Presets
- `erp` profile should emphasize business-flow reliability and finance/inventory sensitivity.
- `ops` profile should emphasize incident/security severity and tighter production controls.
- `robot` profile should emphasize safety-critical handling and strict failure tolerances.

### Requirement 3: Backward Compatibility
- Default behavior without profile should remain consistent with existing template output.
- Existing eval config loading and eval execution must remain unchanged.

### Requirement 4: UX and Reporting
- Template generation summary should include chosen profile.
- CLI help should display profile option and supported values.

### Requirement 5: Regression Safety
- Add unit tests for profile output behavior and invalid profile rejection.
- Keep scene command/runtime suites passing.
- Validate profile generation via CLI smoke check.
