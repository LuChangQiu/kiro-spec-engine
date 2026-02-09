# Requirements Document: Scene Eval Profile Inference Fallback

## Introduction

`scene eval` can infer profile from spec manifest domain, but many historical specs do not carry a
runtime manifest at `custom/scene.yaml`. In that case inference silently falls back to `default`,
which weakens domain-specific eval policy behavior.

## Requirements

### Requirement 1: Multi-Source Profile Inference
- Keep explicit `--profile` as highest-priority source.
- Keep spec manifest domain inference when manifest is available.
- Keep feedback domain inference when feedback template includes domain.
- Add fallback inference from run result payload and scene references.

### Requirement 2: Missing Manifest Resilience
- When `--spec` is provided but manifest cannot be loaded, eval must continue.
- Fallback inference should still resolve robot/ops/erp profiles when scene reference naming
  provides domain hints.

### Requirement 3: Traceable Profile Provenance
- Eval report inputs must keep `profile` and `profile_source`.
- `profile_source` should distinguish inferred fallback sources such as `result:scene_ref`.
- Synced task metadata should continue recording derived policy source.

### Requirement 4: Regression Safety
- Add unit test coverage for spec-manifest-missing fallback behavior.
- Keep scene command and runtime execution pilot unit suites passing.
- Validate with CLI smoke check for real command path.
