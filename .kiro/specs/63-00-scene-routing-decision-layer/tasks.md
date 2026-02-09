# Implementation Plan: Scene Routing Decision Layer

## Tasks

- [x] 1 Add route command under scene CLI
  - Added `scene route` command and selector/run-mode options.

- [x] 2 Implement route option normalization and validation
  - Added `normalizeRouteOptions` and `validateRouteOptions`.
  - Enforced selector requirement and strict option checks.

- [x] 3 Implement deterministic route decision logic
  - Reused scene catalog discovery as candidate source.
  - Added deterministic scoring, ranking, selected/alternative output.
  - Added strict tie detection for `--require-unique`.

- [x] 4 Implement command handoff output
  - Added per-candidate next-step command suggestions (`validate/doctor/run`).
  - Added human-readable summary and JSON/export support.

- [x] 5 Verify regression and CLI behavior
  - Extended `tests/unit/commands/scene.test.js` with route tests.
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed `node -c lib/commands/scene.js`.
  - Executed `node .\bin\kiro-spec-engine.js scene --help` and route smoke run.
