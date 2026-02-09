# Design Document: Scene Runtime Binding Registry

## Overview

Introduce `BindingRegistry` as an execution router and readiness provider for runtime nodes.

## Core Model

### BindingRegistry
- `register(handler)`
- `resolve(node, payload)`
- `execute(node, payload)`
- `checkReadiness(sceneManifest, payload)`

Each handler supports:
- `id`
- `match`/`matcher` (nodeType/refPrefix/refPattern)
- `execute(node, payload)`
- optional `readiness(node, payload)`

## Runtime Integration

- `RuntimeExecutor` now owns `bindingRegistry`.
- Execution precedence:
  1. legacy `bindingExecutor` (if provided)
  2. `bindingRegistry.execute`
  3. fallback default executor
- Adapter readiness default path:
  - `bindingRegistry.checkReadiness(sceneManifest, payload)`

## Built-in Defaults

- `builtin.erp-sim`: handles `spec.erp.*`
- `builtin.robot-sim`: handles `spec.robot.*` and enforces preflight/stopChannel readiness for adapters
- `builtin.adapter-sim`: generic adapter fallback
- `builtin.default`: global fallback handler

## Compatibility

- No breaking changes to runtime command contract.
- Existing injected executors and custom readiness checkers still work.
