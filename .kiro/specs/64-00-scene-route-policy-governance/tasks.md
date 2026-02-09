# Implementation Plan: Scene Route Policy Governance

## Tasks

- [x] 1 Extend route command with policy path option
  - Added `--route-policy <path>` for `scene route`.
  - Added route option validation for policy path input.

- [x] 2 Implement route policy model and loader
  - Added default route policy schema and clone/normalize helpers.
  - Added policy loader with JSON object validation and source tracking.

- [x] 3 Refactor scoring to policy-driven execution
  - Replaced hardcoded route scoring constants with policy weights.
  - Added policy-driven alternative window (`max_alternatives`).

- [x] 4 Add route policy template command
  - Added `scene route-policy-template` with profile support and safe overwrite.
  - Added profile patches for `erp`, `hybrid`, and `robot`.

- [x] 5 Verify regression and runtime behavior
  - Extended scene command tests for route policy validation and behavior.
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed `node -c lib/commands/scene.js` and CLI help/smoke checks.
