# Requirements Document: Scene Doctor Remediation Output

## Introduction

`scene doctor` already diagnoses plan, policy, and adapter readiness.
Operators still need direct remediation guidance and a persistent checklist artifact they can execute.
This spec adds actionable doctor suggestions and optional checklist export.

## Requirements

### Requirement 1: Actionable Suggestions in Doctor Report
- Add structured suggestion items to doctor output.
- Suggestions should map common blockers (approval, hybrid pilot limits, safety checks, adapter readiness) to explicit actions.
- Healthy reports should still include one low-priority next-step suggestion.

### Requirement 2: Checklist Export
- Support writing doctor remediation checklist to markdown via `--todo-out <path>`.
- Checklist should include scene metadata, status, blockers, and suggested actions.

### Requirement 3: CLI and Exit Compatibility
- Keep existing doctor command behavior compatible.
- Preserve non-zero exit semantics when doctor status is blocked.

### Requirement 4: Test Coverage
- Extend unit tests to verify suggestions for healthy and blocked flows.
- Add test coverage for checklist export path handling.
