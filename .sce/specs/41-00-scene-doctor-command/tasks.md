# Implementation Plan: Scene Doctor Command

## Tasks

- [x] 1 Add doctor command registration and option normalization
  - Implemented in `lib/commands/scene.js`.

- [x] 2 Add doctor execution flow (manifest, context, plan, policy, adapter)
  - Implemented `runSceneDoctorCommand` in `lib/commands/scene.js`.

- [x] 3 Add structured doctor report and output formatter
  - Implemented `buildDoctorSummary` and `printDoctorSummary`.

- [x] 4 Extend unit tests for doctor healthy/blocked scenarios
  - Updated `tests/unit/commands/scene.test.js`.

- [x] 5 Validate command behavior end-to-end
  - Executed `node .\bin\kiro-spec-engine.js scene doctor --help`.
  - Executed doctor JSON run on starter ERP scene.
  - Executed command/runtime unit test suite.
