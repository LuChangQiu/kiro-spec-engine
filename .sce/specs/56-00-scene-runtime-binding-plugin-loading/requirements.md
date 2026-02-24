# Requirements Document: Scene Runtime Binding Plugin Loading

## Introduction

Binding registry is available in runtime, but teams still need a practical way to inject project
handlers without editing core engine code. Runtime should load handler plugins from project directories
and expose load diagnostics for execution observability.

## Requirements

### Requirement 1: Project Plugin Discovery
- Runtime must support loading binding plugins from project directories.
- Support explicit plugin directory override.
- Support default auto-discovery directories under `.sce`.

### Requirement 2: Safe Plugin Validation
- Plugin modules should support object/array/factory exports.
- Invalid plugin exports or handler definitions must be skipped with warnings.
- Loading errors should not crash runtime construction.

### Requirement 3: Runtime Integration
- Runtime should register loaded plugin handlers into binding registry.
- Legacy `bindingExecutor` path remains highest priority for compatibility.
- Runtime command options should control plugin directory and auto-discovery behavior.

### Requirement 4: Load Observability
- Runtime run result should include binding plugin load metadata (count/dirs/files/warnings).
- Non-JSON runtime summary should show plugin usage and warnings when present.

### Requirement 5: Regression Safety
- Add unit tests for plugin loader behavior and runtime plugin execution path.
- Keep scene command/runtime suites passing.
