# Implementation Plan: Scene Doctor Remediation Output

## Tasks

- [x] 1 Add doctor option and normalization support for checklist export
  - Added `--todo-out` and normalization in `lib/commands/scene.js`.

- [x] 2 Implement suggestion generation logic
  - Added `buildDoctorSuggestions` and helper dedupe logic.

- [x] 3 Implement markdown checklist exporter
  - Added `buildDoctorTodoMarkdown` and `writeDoctorTodo`.

- [x] 4 Integrate suggestions/export into doctor execution flow
  - Updated `runSceneDoctorCommand` and text summary output.

- [x] 5 Extend tests and validate CLI behavior
  - Updated `tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --help`.
  - Executed doctor run with `--todo-out` and JSON output.
