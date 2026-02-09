# Implementation Plan: Scene Scaffold Command

## Tasks

- [x] 1 Add `scene scaffold` CLI command and option normalization
  - Implemented in `lib/commands/scene.js`.

- [x] 2 Add scaffold validation and output guardrails
  - Implemented `validateScaffoldOptions` and overwrite checks in `lib/commands/scene.js`.

- [x] 3 Add built-in scaffold templates
  - Added `lib/scene-runtime/templates/scene-template-erp-query-v0.1.yaml`.
  - Added `lib/scene-runtime/templates/scene-template-hybrid-shadow-v0.1.yaml`.

- [x] 4 Extend command unit tests for scaffold flows
  - Updated `tests/unit/commands/scene.test.js`.

- [x] 5 Validate command behavior
  - Executed: `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed: `node .\bin\kiro-spec-engine.js scene scaffold --help`.
  - Executed dry-run scaffold preview with JSON output.
