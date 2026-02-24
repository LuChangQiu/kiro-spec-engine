# Implementation Plan: Scene Eval Unified Config Template

## Tasks

- [x] 1 Extend eval CLI with unified config options
  - Added `--eval-config` and `--env` options.
  - Added guardrail: `--env` requires `--eval-config`.

- [x] 2 Implement unified config resolution helpers
  - Added config merge helpers and env profile resolver.
  - Added default unified config template builder.

- [x] 3 Integrate unified config into eval execution
  - Eval now resolves target + task policy from unified config.
  - Explicit `--target` and `--task-policy` continue as top-level overrides.

- [x] 4 Add unified config template command
  - Added `scene eval-config-template` with safe overwrite and JSON summary.

- [x] 5 Extend tests and validate
  - Added tests for env guardrail and profile resolution.
  - Added eval integration test with unified config + env.
  - Added config template command test.
  - Executed syntax checks, unit suites, and CLI help/smoke flows.
