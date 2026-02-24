# Implementation Plan: Scene Package Gate Remediation Runbook Output

## Tasks

- [x] 1 Extend package-gate options and validation for runbook output
  - Added `--runbook-out` option to command surface.
  - Added normalize/validate handling for runbook output path.

- [x] 2 Implement remediation runbook writer
  - Added runbook markdown builder with deterministic priority ordering.
  - Added writer that persists runbook and returns payload metadata.

- [x] 3 Integrate runbook result into gate flow and summary output
  - Added runbook write step in gate command pipeline.
  - Added runbook path in non-JSON summary output.

- [x] 4 Extend tests for runbook output behavior
  - Added option validation assertion for `--runbook-out`.
  - Added runtime assertions for runbook payload and markdown content.

- [x] 5 Run verification and archive smoke artifacts
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed gate smoke run with runbook output and archived reports.
  - Executed full regression, docs diagnostic, and status checks.
