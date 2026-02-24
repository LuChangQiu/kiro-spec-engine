# Requirements Document: Scene Package Gate Remediation Runbook Output

## Introduction

Specs 72 and 73 introduced remediation actions and task bridging, but operators still need a direct execution
artifact with ordered commands and trace links. This spec adds a remediation runbook output for
`scene package-gate` to tighten the last mile from diagnostics to execution.

## Requirements

### Requirement 1: Runbook Output Option
- Add `--runbook-out <path>` to `scene package-gate`.
- Command should write remediation runbook markdown when option is provided.
- Runbook output path should be returned in gate payload.

### Requirement 2: Structured Runbook Content
- Runbook should include generation metadata and gate summary context.
- Runbook should list remediation actions in execution order.
- Each action entry should include title, recommendation, command hint, and source check linkage.

### Requirement 3: Deterministic Prioritization
- Action execution order should prioritize critical/high before medium/low.
- Actions with same priority should be ordered deterministically by action id.
- Output should remain stable across repeated runs with same input.

### Requirement 4: Gate Summary Integration
- Human-readable gate summary should show runbook output path when generated.
- Existing output paths (`out`, `task-out`) should remain unchanged.
- JSON mode should include runbook metadata for machine consumption.

### Requirement 5: Regression and Traceability
- Extend gate option validation tests for `--runbook-out`.
- Extend gate runtime tests for runbook payload and file content assertions.
- Capture runbook smoke outputs under spec reports.
