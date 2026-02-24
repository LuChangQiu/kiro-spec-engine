# Implementation Plan: Scene Doctor Traceable Task Sync

## Tasks

- [x] 1 Add doctor trace id option and runtime trace generation
  - Added `--trace-id` for doctor and `createDoctorTraceId()` helper.

- [x] 2 Inject trace id into doctor report and summary
  - Updated `buildDoctorSummary` and doctor run flow.

- [x] 3 Add trace/suggestion metadata to synced task lines
  - Updated task line generator and task sync return model.

- [x] 4 Add trace context to task draft export
  - Updated task draft header and task line formatting.

- [x] 5 Extend tests and run regressions
  - Updated `tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed doctor command with `--trace-id` and `--sync-spec-tasks`.
