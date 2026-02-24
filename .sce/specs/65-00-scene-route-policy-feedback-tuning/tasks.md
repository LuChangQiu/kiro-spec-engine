# Implementation Plan: Scene Route Policy Feedback Tuning

## Tasks

- [x] 1 Add route policy suggest command and option normalization
  - Registered `scene route-policy-suggest` in CLI command tree.
  - Added normalize/validate helpers for eval sources, profile, and max adjustment.

- [x] 2 Implement eval source discovery and baseline resolution
  - Added explicit eval path + eval directory discovery pipeline.
  - Added baseline loader with explicit policy precedence and dominant profile auto fallback.

- [x] 3 Implement signal analysis and bounded policy tuning
  - Added eval summary model (grades, statuses, profiles, recommendation signals).
  - Added deterministic bounded delta application with per-field constraints.

- [x] 4 Add output wiring and summary rendering
  - Added payload output (`--out`) and policy-only output (`--policy-out`).
  - Added human summary for baseline source, report count, and adjustments.

- [x] 5 Validate with tests and CLI smoke checks
  - Executed `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Executed `npm test -- --runInBand`.
  - Executed `node .\bin\kiro-spec-engine.js scene route-policy-suggest ...` sample run.
