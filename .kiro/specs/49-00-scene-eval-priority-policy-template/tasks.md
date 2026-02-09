# Implementation Plan: Scene Eval Priority Policy Template

## Tasks

- [x] 1 Add eval policy model and priority resolver
  - Added default policy constant and allowed priorities.
  - Added policy normalization + keyword escalation helpers.

- [x] 2 Extend eval command with policy input and sync integration
  - Added `--task-policy` option for `scene eval`.
  - Loaded and normalized task policy during eval execution.
  - Applied policy-derived priority and policy metadata in synced task lines.

- [x] 3 Add policy template generator command
  - Added `scene eval-policy-template` command.
  - Implemented safe file creation and optional overwrite behavior.

- [x] 4 Extend tests
  - Added policy normalization and priority resolution tests.
  - Added eval sync custom-policy priority test.
  - Added eval policy template command test.

- [x] 5 Validate end-to-end
  - Executed `node -c lib/commands/scene.js`.
  - Executed `node -c tests/unit/commands/scene.test.js`.
  - Executed `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene eval --help`.
  - Executed `node .\bin\kiro-spec-engine.js scene eval-policy-template --help`.
  - Executed smoke flow with temp feedback + generated policy template.
