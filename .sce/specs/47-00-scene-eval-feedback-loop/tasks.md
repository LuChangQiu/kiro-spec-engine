# Implementation Plan: Scene Eval Feedback Loop

## Tasks

- [x] 1 Add `scene eval` CLI command and option normalization/validation
  - Added command registration and options (`--result`, `--feedback`, `--target`, `--out`, `--json`).
  - Added `normalizeEvalOptions` and `validateEvalOptions`.

- [x] 2 Implement doctor feedback parser
  - Added `parseDoctorFeedbackTemplate` with metadata/task/checklist/eval metric extraction.
  - Added utility helpers for status normalization and numeric parsing.

- [x] 3 Implement evaluation report builder and command execution
  - Added `buildSceneEvalReport` with run-side + feedback-side + overall scoring.
  - Added `runSceneEvalCommand` with optional target loading and report output writing.
  - Added `printEvalSummary` for non-JSON output.

- [x] 4 Extend unit tests
  - Updated `tests/unit/commands/scene.test.js` imports.
  - Added tests for eval option validation, feedback parser, eval aggregation, and feedback-only fallback.

- [x] 5 Validate and smoke test
  - Executed `node -c lib/commands/scene.js`.
  - Executed `node -c tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene eval --help`.
  - Executed end-to-end smoke flow (`scene run` + `scene doctor --feedback-out` + `scene eval`).
