# Implementation Plan: Scene Package Gate Remediation Task Bridge

## Tasks

- [x] 1 Implement remediation-to-task candidate extraction
  - Added remediation-first candidate extraction for gate task workflows.
  - Added fallback to failed-check candidates for backward compatibility.

- [x] 2 Integrate action-backed metadata into task draft and sync outputs
  - Added action-backed task titles and priority resolution.
  - Added action metadata fields to task sync output and task line suffix.

- [x] 3 Extend remediation payload traceability
  - Added `source_check_ids` linkage inside remediation actions.
  - Added source-mode output in task sync result for automation routing.

- [x] 4 Extend unit tests for remediation task bridge behavior
  - Added assertions for remediation source checks and task action IDs.
  - Added assertions for task draft suggested action count and synced metadata.

- [x] 5 Run verification and capture smoke artifacts
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed gate smoke run with `--task-out` and archived output payload.
  - Executed full regression, docs diagnostic, and project status checks.
