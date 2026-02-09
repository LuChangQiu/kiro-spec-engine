# Implementation Plan: Scene Doctor Binding Plugin Diagnostics

## Tasks

- [x] 1 Add doctor report normalization for binding plugin metadata
  - Added binding plugin report normalization helper in scene command module.
  - Included `binding_plugins` in doctor summary output model.

- [x] 2 Wire runtime plugin metadata into doctor summary flow
  - Passed runtime executor plugin load snapshot into doctor diagnostics builder.

- [x] 3 Add plugin warning suggestion mappings
  - Added manifest-missing and plugin-load-failed suggestion rules.

- [x] 4 Enhance doctor terminal summary output
  - Added binding plugin section with manifest status and warnings.

- [x] 5 Add tests and validate
  - Added doctor command tests for plugin diagnostics and summary output.
  - Ran targeted scene/runtime Jest suites and CLI doctor smoke.
