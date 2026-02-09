# Implementation Plan: Scene Eval Spec Task Sync

## Tasks

- [x] 1 Add eval sync command options and validation
  - Added `--spec` and `--sync-spec-tasks` to `scene eval`.
  - Updated eval option normalization and validation.

- [x] 2 Implement evaluation recommendation sync writer
  - Added eval task line formatter with metadata tags.
  - Added append flow with duplicate handling and skip reasons.

- [x] 3 Integrate eval report + terminal summary with sync metadata
  - Injected `task_sync` into eval report when enabled.
  - Updated eval summary output to display sync results.

- [x] 4 Extend command tests
  - Updated eval validation test for `--sync-spec-tasks` guardrail.
  - Added eval task sync behavior test for spec `tasks.md` append.

- [x] 5 Validate end-to-end behavior
  - Executed `node -c lib/commands/scene.js`.
  - Executed `node -c tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene eval --help`.
  - Executed `node .\bin\kiro-spec-engine.js scene eval --feedback <temp-file> --json` smoke check.
