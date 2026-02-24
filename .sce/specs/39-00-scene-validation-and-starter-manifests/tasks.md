# Implementation Plan: Scene Validation and Starter Manifests

## Tasks

- [x] 1 Add `scene validate` CLI subcommand
  - Implemented in `lib/commands/scene.js`.

- [x] 2 Implement validation summary and JSON output
  - Implemented in `lib/commands/scene.js`.

- [x] 3 Add starter scene manifest assets
  - Added files under `./custom/`.

- [x] 4 Extend command unit tests
  - Updated `tests/unit/commands/scene.test.js`.

- [x] 5 Run targeted regression tests
  - Executed: `npx jest tests/unit/commands/scene.test.js tests/unit/scene-runtime/runtime-execution-pilot.test.js`.
