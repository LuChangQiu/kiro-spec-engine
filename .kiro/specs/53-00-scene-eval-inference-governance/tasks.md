# Implementation Plan: Scene Eval Inference Governance

## Tasks

- [x] 1 Extend eval CLI options for inference governance
  - Added `--profile-infer-strict`.
  - Added `--no-profile-manifest-auto-discovery`.

- [x] 2 Add profile manifest resolution helpers
  - Implemented bounded manifest auto-discovery with candidate prioritization.
  - Added loader helper returning manifest metadata and warnings.

- [x] 3 Integrate strict-mode enforcement into eval runtime
  - Added strict inference failure when resolved profile remains `default`.
  - Kept explicit profile override as highest-priority path.

- [x] 4 Add inference diagnostics to report and summary output
  - Included manifest selection and warnings in eval report inputs.
  - Added non-JSON `Profile Warnings` section for runtime observability.

- [x] 5 Validate with tests and CLI smoke
  - Added unit test for manifest auto-discovery inference path.
  - Added unit test for strict inference failure behavior.
  - Ran syntax checks, targeted jest suites, and CLI help/smoke commands.
