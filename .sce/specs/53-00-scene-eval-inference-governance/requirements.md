# Requirements Document: Scene Eval Inference Governance

## Introduction

`scene eval` profile inference now uses multiple signals, but missing spec manifests can still make
inference opaque in day-to-day CLI use. Teams need controlled inference behavior that is observable,
resilient, and optionally strict for governed workflows.

## Requirements

### Requirement 1: Strict Inference Option
- Add an eval option to enforce non-default profile inference.
- When strict mode is enabled and profile resolves to `default`, eval must fail with a clear message.
- Explicit `--profile` remains a valid strict-mode input.

### Requirement 2: Manifest Auto-Discovery
- When `--spec-manifest` is missing, eval should attempt fallback discovery inside the target spec.
- Discovery should prefer common scene manifest paths before recursive search.
- Discovery must remain bounded and avoid scanning irrelevant folders.

### Requirement 3: Inference Observability
- Eval report inputs should include profile inference diagnostics:
  - selected manifest path/source
  - warnings from missing manifest or discovery behavior
  - strict mode toggle state
- Non-JSON summary should print profile warnings when present.

### Requirement 4: Opt-Out Control
- Provide CLI flag to disable profile manifest auto-discovery.
- Default behavior keeps auto-discovery enabled.

### Requirement 5: Regression Safety
- Add unit tests for auto-discovery and strict-mode failure.
- Keep existing scene command/runtime tests passing.
- Validate CLI help and smoke behavior.
