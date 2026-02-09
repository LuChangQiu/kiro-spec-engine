# Requirements Document: Scene Runtime Binding Plugin Manifest Governance

## Introduction

Runtime plugin loading is available, but teams need deterministic, policy-governed control over
which plugins can load and in what order. A project-scoped manifest should define allow/deny,
strictness, and priority while preserving safe fallback behavior.

## Requirements

### Requirement 1: Manifest-Based Governance
- Runtime must support a binding plugin manifest JSON.
- Manifest should be auto-discovered from `.kiro/config/scene-binding-plugins.json` when present.
- Runtime should support explicit manifest path override.

### Requirement 2: Load Policy Controls
- Manifest must support allowlist and blocklist rules by plugin file.
- Manifest must support strict/disabled-by-default behavior for undeclared plugin files.
- Policy rejections must be non-fatal and surfaced as warnings.

### Requirement 3: Deterministic Ordering
- Manifest should support per-plugin load priority.
- Runtime must load plugin files in deterministic order by priority and declaration order.
- Missing declared plugin files should produce warnings.

### Requirement 4: Runtime and CLI Observability
- Runtime run result should include manifest path and loaded status.
- `scene run` summary should display manifest path/status and warnings.
- `scene run` and `scene doctor` should expose manifest path/load toggles.

### Requirement 5: Regression Safety
- Add unit coverage for manifest policy behavior in plugin loader.
- Add runtime tests for manifest metadata and missing-manifest warning paths.
- Keep command/runtime unit suites passing.
