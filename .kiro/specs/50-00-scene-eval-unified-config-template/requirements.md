# Requirements Document: Scene Eval Unified Config Template

## Introduction

Scene eval now has two configuration axes:

- evaluation targets (`--target`)
- task sync priority policy (`--task-policy`)

To reduce configuration fragmentation and support environment-aware operations, we need a unified
`scene-eval-config` entry that can carry both settings with env layering.

## Requirements

### Requirement 1: Unified Eval Config Input
- Add eval option `--eval-config <path>`.
- Add eval option `--env <env-name>` for profile selection.
- When `--env` is used, `--eval-config` must be required.

### Requirement 2: Env Layer Resolution
- Unified config should support global defaults and per-env overrides.
- Env resolution should merge global and env values for both target and task policy.
- Missing env profile should produce clear error feedback.

### Requirement 3: Priority and Target Integration
- Eval scoring must consume resolved target configuration.
- Eval task sync must consume resolved task policy configuration.
- Existing explicit overrides (`--target`, `--task-policy`) should still work and take precedence.

### Requirement 4: Unified Config Template Bootstrap
- Add command to generate default unified config template JSON.
- Template should include baseline target values and env profiles (`dev`, `staging`, `prod`).
- Support output path and overwrite safety controls.

### Requirement 5: Regression and Compatibility
- Preserve backward compatibility for existing eval and policy-template flows.
- Extend tests for env resolution, eval integration, and template generation.
- Keep scene command/runtime suites passing.
