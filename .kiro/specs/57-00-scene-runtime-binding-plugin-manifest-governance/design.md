# Design Document: Scene Runtime Binding Plugin Manifest Governance

## Overview

Extend `binding-plugin-loader` with a manifest governance layer so runtime plugin loading becomes
policy-driven and deterministic across environments.

## Manifest Model

Default manifest path:
- `.kiro/config/scene-binding-plugins.json`

Supported fields:
- `strict` (boolean): if true, undeclared plugins are skipped.
- `enabled_by_default` (boolean): if false, only declared plugins are loaded.
- `default_priority` (number): fallback priority for undeclared or unprioritized files.
- `allowed_files` (array<string>): optional allowlist by file token.
- `blocked_files` (array<string>): denylist by file token.
- `plugins` (array<object>): per-file entry with `file`, `enabled`, `priority`.

## Loader Flow

1. Resolve manifest policy (auto-discovered or explicit path, optional disable flag).
2. Discover candidate plugin files from explicit plugin dir or auto-discovery dirs.
3. Apply manifest policy filters:
   - blocked -> warning + skip
   - not in allowlist -> warning + skip
   - disabled entry -> skip
   - undeclared under strict/disabled-by-default -> warning + skip
4. Sort remaining files by `priority`, then manifest declaration order, then file name.
5. Load handlers and continue warning-safe on failures.

## Runtime Integration

`RuntimeExecutor` forwards these options to plugin loader:
- `bindingPluginManifest`
- `bindingPluginManifestLoad`

`run_result.binding_plugins` now includes:
- `manifest_path`
- `manifest_loaded`
- existing handler/file/warning metadata

## CLI Integration

`scene run` and `scene doctor` expose:
- `--binding-plugin-manifest <path>`
- `--no-binding-plugin-manifest-load`

## Test Strategy

- Add loader unit tests for allow/deny, strict policy, ordering, and missing declaration warning.
- Add runtime unit tests asserting manifest metadata propagation and explicit missing-manifest warning.
- Add command summary assertion for manifest visibility.
