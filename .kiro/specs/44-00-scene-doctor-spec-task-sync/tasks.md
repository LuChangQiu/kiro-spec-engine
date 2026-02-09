# Implementation Plan: Scene Doctor Spec Task Sync

## Tasks

- [x] 1 Add doctor option and validation for spec task sync
  - Added `--sync-spec-tasks` and validation guard in `lib/commands/scene.js`.

- [x] 2 Implement task registry and sync appender
  - Added `collectExistingTaskRegistry` and `appendDoctorSuggestionsToSpecTasks`.

- [x] 3 Integrate sync result into doctor flow and summary output
  - Updated `runSceneDoctorCommand` and `printDoctorSummary`.

- [x] 4 Extend unit tests for sync behavior
  - Updated `tests/unit/commands/scene.test.js`.

- [x] 5 Validate command/runtime regressions
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --help`.
  - Executed doctor JSON run with `--sync-spec-tasks`.
