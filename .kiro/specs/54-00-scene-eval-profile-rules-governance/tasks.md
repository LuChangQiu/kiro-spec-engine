# Implementation Plan: Scene Eval Profile Rules Governance

## Tasks

- [x] 1 Extend scene eval interface for rules input
  - Added `--profile-rules <path>` option to eval command.
  - Added option normalization and validation.

- [x] 2 Implement profile rules normalization and loader
  - Added default profile inference rules model and cloning helpers.
  - Added safe normalization for domain aliases and scene-ref regex rules.
  - Added explicit/implicit profile rules loading with warning strategy.

- [x] 3 Integrate rules into profile inference runtime
  - Updated domain/scene-ref inference to consume normalized rules.
  - Wired rules resolution into eval command path and report inputs.

- [x] 4 Add profile rules template command
  - Added `scene eval-profile-rules-template` with overwrite guard.
  - Added summary output and JSON mode support.

- [x] 5 Validate behavior and regressions
  - Added unit tests for normalization, explicit rules inference, and template command.
  - Verified command help and CLI smoke for explicit rules flow.
  - Ran syntax checks and targeted unit suites.
