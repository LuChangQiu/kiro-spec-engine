# Requirements Document: Scene Runtime Binding Registry

## Introduction

Scene runtime currently supports a single global binding executor callback. To scale across ERP
services, robot adapters, and future ecosystems, runtime needs a registry model that can resolve
binding handlers by scene node characteristics and expose adapter readiness checks consistently.

## Requirements

### Requirement 1: Binding Registry Abstraction
- Add a runtime binding registry that can register multiple handlers.
- Handlers should be matchable by node type and/or binding reference patterns.
- Runtime commit execution should route node execution through registry when legacy executor is not provided.

### Requirement 2: Backward Compatibility
- Existing `bindingExecutor` injection must continue to work and keep highest precedence.
- Existing runtime behavior for verify/respond nodes must remain unchanged.

### Requirement 3: Adapter Readiness Integration
- Default adapter readiness checker should use registry readiness hooks when available.
- Hybrid/robot dry-run execution should still emit readiness diagnostics in run result and audit stream.

### Requirement 4: Built-in Simulation Handlers
- Provide built-in handlers for common namespaces (`spec.erp.*`, `spec.robot.*`, generic adapters).
- Built-in robot readiness should validate required safety context signals.

### Requirement 5: Regression Safety
- Add unit tests for binding registry behavior and runtime integration paths.
- Keep existing scene command/runtime suites passing.
