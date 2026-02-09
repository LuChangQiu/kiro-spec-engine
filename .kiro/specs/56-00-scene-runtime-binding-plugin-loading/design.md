# Design Document: Scene Runtime Binding Plugin Loading

## Overview

Introduce a synchronous binding plugin loader for runtime initialization, enabling local plugin modules
to be discovered and registered before execution.

## Plugin Loader

New component: `lib/scene-runtime/binding-plugin-loader.js`

Inputs:
- `projectRoot`
- `pluginDir` (explicit)
- `autoDiscovery` (default true)

Default discovery directories:
- `.kiro/plugins/scene-bindings`
- `.kiro/config/scene-bindings`

Supported module exports:
- handler object
- handler array
- factory function returning object/array

## Runtime Executor Integration

- Runtime constructor loads plugin handlers when custom binding registry is not injected.
- Loaded handlers are registered into `BindingRegistry`.
- Loader warnings are accumulated in runtime metadata.

## CLI Integration

Scene commands add:
- `--binding-plugin-dir <path>`
- `--no-binding-plugin-auto-discovery`

Applied to:
- `scene run`
- `scene doctor`

## Reporting

`run_result.binding_plugins` includes:
- `handlers_loaded`
- `plugin_dirs`
- `plugin_files`
- `warnings`

Non-JSON `scene run` summary prints plugin count and warning list.
