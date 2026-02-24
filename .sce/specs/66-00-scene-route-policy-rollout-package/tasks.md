# Implementation Plan: Scene Route Policy Rollout Package

## Tasks

- [x] 1 Add rollout command and option pipeline
  - Registered `scene route-policy-rollout` command in scene CLI tree.
  - Added normalize/validate logic for suggestion path, rollout naming, and output root.

- [x] 2 Implement rollout artifact generation
  - Added rollout packaging flow with candidate policy, rollback policy, and plan payload outputs.
  - Added safe overwrite guard for rollout directory with `--force` support.

- [x] 3 Add structured policy diff and metadata
  - Added deterministic diff calculation across route policy tracked paths.
  - Added rollout summary metadata with change counts and suggestion lineage.

- [x] 4 Add runbook generation and human summary
  - Added markdown runbook output with verification/apply/rollback guidance.
  - Added rollout summary printer for terminal and JSON output.

- [x] 5 Verify regression and artifact behavior
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed `npm test -- --runInBand`.
  - Executed rollout command smoke run and generated spec report artifacts.
