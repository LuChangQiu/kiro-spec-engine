# Implementation Plan: Scene Doctor Feedback Template Output

## Tasks

- [x] 1 Extend doctor CLI option and normalized options model
  - Added `--feedback-out <path>` in scene doctor options.
  - Added `feedbackOut` to normalized doctor options.

- [x] 2 Implement doctor feedback template builder and writer
  - Added `buildDoctorFeedbackTemplate(report)` for markdown rendering.
  - Added `writeDoctorFeedbackTemplate(...)` with safe path resolution and directory creation.

- [x] 3 Integrate feedback output into doctor run and summary
  - Wired feedback writer into `runSceneDoctorCommand`.
  - Added `report.feedback_output` when export succeeds.
  - Updated summary output to show `Feedback Template` path.

- [x] 4 Extend command tests for feedback output behavior
  - Added coverage in `tests/unit/commands/scene.test.js` for feedback export and content assertions.

- [x] 5 Run validations and smoke checks
  - Executed `node -c lib/commands/scene.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --help`.
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --manifest .\lib\scene-runtime\templates\scene-template-erp-query-v0.1.yaml --json --feedback-out .\tmp\scene-doctor-feedback.md`.
