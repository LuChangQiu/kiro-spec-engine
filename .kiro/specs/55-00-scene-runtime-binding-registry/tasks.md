# Implementation Plan: Scene Runtime Binding Registry

## Tasks

- [x] 1 Add binding registry runtime component
  - Implemented `lib/scene-runtime/binding-registry.js` with matcher-based handler routing.
  - Added default fallback behavior and readiness aggregation.

- [x] 2 Add built-in ERP/robot/adapter simulation handlers
  - Added namespace-driven handlers with stable output metadata.
  - Added robot adapter readiness checks tied to safety context signals.

- [x] 3 Integrate registry into runtime executor
  - Runtime now uses registry for commit execution when legacy executor is absent.
  - Default adapter readiness checker now delegates to registry readiness hooks.

- [x] 4 Preserve compatibility and exports
  - Kept legacy `bindingExecutor` precedence unchanged.
  - Exported `BindingRegistry` from `lib/scene-runtime/index.js`.

- [x] 5 Add regression tests and validate
  - Added `tests/unit/scene-runtime/binding-registry.test.js`.
  - Extended runtime pilot tests for registry execution and readiness delegation.
  - Executed targeted jest suites and CLI smoke checks.
