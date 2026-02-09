# Implementation Plan: Scene Runtime Binding Plugin Manifest Governance

## Tasks

- [x] 1 Extend binding plugin loader with manifest policy model
  - Added manifest auto-discovery and explicit path resolution.
  - Added strict/default-enabled policy, allow/deny lists, and declaration parsing.

- [x] 2 Implement deterministic file planning and warnings
  - Added priority/order-based plugin file planning.
  - Added warnings for blocked/skipped/missing declared plugin files.

- [x] 3 Integrate manifest controls in runtime and scene commands
  - Added runtime options for manifest path and load toggle.
  - Added `scene run`/`scene doctor` options and validation wiring.

- [x] 4 Expose manifest observability in runtime results and summary output
  - Added `manifest_path` and `manifest_loaded` in `run_result.binding_plugins`.
  - Added run summary manifest status output.

- [x] 5 Add tests and validate
  - Expanded loader tests for manifest governance paths.
  - Added runtime and command tests for manifest metadata/warnings.
  - Ran syntax checks and targeted Jest suites.
