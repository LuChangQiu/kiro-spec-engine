# Implementation Plan: Scene Package Registry and Quality Gate

## Tasks

- [x] 1 Add package-registry command interface
  - Registered `scene package-registry` with template root, strict gate, and output options.
  - Added normalize and validate pipelines for registry command.

- [x] 2 Implement registry scan and validation pipeline
  - Added template manifest validation and package contract validation integration.
  - Added per-template diagnostics with issue list and validity state.

- [x] 3 Implement layer classification and summary model
  - Added kind-to-layer mapping for L1/L2/L3 semantics.
  - Added registry summary counters for total/valid/invalid and layer breakdown.

- [x] 4 Extend tests for registry options and behavior
  - Added validation tests for registry options.
  - Added runtime tests for mixed template states and strict mode failure behavior.

- [x] 5 Run verification and capture smoke reports
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed `scene package-registry` smoke run and archived report payload.
  - Executed full test and compliance status checks.
