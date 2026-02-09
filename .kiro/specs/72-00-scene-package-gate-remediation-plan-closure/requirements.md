# Requirements Document: Scene Package Gate Remediation Plan Closure

## Introduction

Spec 71 closes failed gate checks into draft tasks, but gate output still needs a structured remediation layer
that can be consumed directly by AI operators and automation scripts. This spec adds remediation payloads
that map failed checks to concrete actions and command hints.

## Requirements

### Requirement 1: Remediation Payload in Gate Output
- `scene package-gate` output must include a top-level `remediation` object.
- `remediation` must include `action_count` and `actions` fields.
- Gate output should return an empty remediation list when all checks pass.

### Requirement 2: Rule-to-Action Mapping
- Failed `required-layer:*` checks must map to layer coverage actions.
- Failed `min-valid-templates` and `max-invalid-templates` checks must map to threshold recovery actions.
- Failed `unknown-layer-forbidden` checks must map to kind normalization actions.

### Requirement 3: Action Metadata for Operations
- Each remediation action must include stable `id`, `priority`, and `title`.
- Each remediation action must include `recommendation` and `command_hint`.
- Action IDs should be deduplicated within one gate evaluation.

### Requirement 4: Human-readable Summary Integration
- Non-JSON gate summary should print remediation action count when actions exist.
- Summary should print top remediation actions for operator triage.
- Existing failed check summary output must remain available.

### Requirement 5: Regression and Traceability
- Extend scene command tests to assert remediation payload behavior for pass/fail paths.
- Keep scene command unit tests and full regression checks passing.
- Capture remediation smoke outputs under spec report artifacts.
