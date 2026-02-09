# Design Document: Scene Doctor Binding Plugin Diagnostics

## Overview

Extend doctor reporting with plugin governance telemetry produced by runtime executor.

## Data Flow

1. `runSceneDoctorCommand` constructs `RuntimeExecutor` (or receives injected executor).
2. Doctor captures `runtimeExecutor.bindingPluginLoad` snapshot.
3. `buildDoctorSummary` normalizes snapshot into `report.binding_plugins`.
4. `buildDoctorSuggestions` inspects plugin warnings and emits remediation suggestions.
5. `printDoctorSummary` renders plugin diagnostics section in human output.

## Report Schema Extension

`report.binding_plugins`:
- `handlers_loaded`
- `plugin_dirs`
- `plugin_files`
- `manifest_path`
- `manifest_loaded`
- `warnings`

## Suggestion Mapping

- Warning contains `manifest not found` -> `binding-plugin-manifest-missing`
- Warning contains plugin load/handler errors -> `binding-plugin-load-failed`

These remain advisory and do not change overall doctor status unless existing blocker logic triggers.

## Compatibility

- No command argument changes.
- JSON output extends schema with additive field only.
- Existing callers without runtime plugin metadata receive `binding_plugins: null`.
