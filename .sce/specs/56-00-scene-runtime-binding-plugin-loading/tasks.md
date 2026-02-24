# Implementation Plan: Scene Runtime Binding Plugin Loading

## Tasks

- [x] 1 Implement binding plugin loader component
  - Added `binding-plugin-loader` with explicit/auto discovery support.
  - Added plugin export normalization and warning-safe failure handling.

- [x] 2 Integrate plugin loading into runtime executor
  - Runtime now loads and registers plugin handlers when using default registry.
  - Added runtime plugin metadata snapshot for run results.

- [x] 3 Extend scene run/doctor command options
  - Added `--binding-plugin-dir` option.
  - Added `--no-binding-plugin-auto-discovery` option.
  - Wired options into runtime executor construction.

- [x] 4 Improve runtime summary observability
  - Non-JSON run summary now prints plugin handler count.
  - Added warning section for plugin load failures.

- [x] 5 Add tests and validate
  - Added binding plugin loader unit tests.
  - Added runtime plugin execution integration test.
  - Ran syntax checks, targeted jest suites, and CLI smoke validation.
