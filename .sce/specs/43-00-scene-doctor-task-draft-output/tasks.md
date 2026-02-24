# Implementation Plan: Scene Doctor Task Draft Output

## Tasks

- [x] 1 Add doctor option and normalization for task draft output
  - Added `--task-out` and `normalizeDoctorOptions` support.

- [x] 2 Implement doctor task draft generator
  - Added `buildDoctorTaskDraft` with priority-ordered checklist formatting.

- [x] 3 Implement task draft writer
  - Added `writeDoctorTaskDraft` path resolution and markdown writing.

- [x] 4 Integrate task draft output into doctor execution/report
  - Updated `runSceneDoctorCommand` and `printDoctorSummary`.

- [x] 5 Extend tests and verify CLI behavior
  - Updated `tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --help`.
  - Executed doctor run with `--task-out` and checked generated file.
