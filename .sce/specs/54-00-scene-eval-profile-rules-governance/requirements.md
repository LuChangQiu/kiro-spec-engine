# Requirements Document: Scene Eval Profile Rules Governance

## Introduction

Scene eval profile inference is now resilient and observable, but profile mapping remains hardcoded in
runtime logic. Projects with domain-specific scene naming need a controlled way to inject profile
inference rules without code changes.

## Requirements

### Requirement 1: External Profile Rules Input
- `scene eval` must accept `--profile-rules <path>` to load profile inference rules from JSON.
- Rules file should support domain alias mapping and scene reference regex rules.
- Explicit rules file load errors must fail eval with clear diagnostics.

### Requirement 2: Implicit Project Rules Support
- When explicit rules path is absent, eval should try loading `.sce/config/scene-eval-profile-rules.json`.
- Invalid or unreadable implicit rules should fall back to defaults with warnings, not hard fail.

### Requirement 3: Deterministic Normalization
- Rule normalization must keep only supported profiles (`default|erp|ops|robot`).
- Invalid regex patterns or malformed entries must be ignored safely.
- Normalized rules must merge with engine defaults for stable behavior.

### Requirement 4: Observability and Traceability
- Eval report inputs should include rules path/source metadata.
- Non-JSON summary should display non-default rules source for operator visibility.

### Requirement 5: Template and Regression Safety
- Provide a command to generate profile rules template JSON.
- Add unit tests for rules normalization, explicit rules application, and template generation.
- Keep existing scene command/runtime suites passing.
