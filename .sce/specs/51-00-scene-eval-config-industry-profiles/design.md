# Design Document: Scene Eval Config Industry Profiles

## Overview

Add a profile layer to `scene eval-config-template` so template bootstrap can align with domain context.

## Command Contract

`scene eval-config-template` adds:
- `--profile <profile>`
- Supported values: `default`, `erp`, `ops`, `robot`

Default remains `default`.

## Template Generation Strategy

1. Build base template from `createDefaultSceneEvalConfigTemplate()`.
2. Apply profile-specific patch using deep object merge.
3. Return final config payload.

Profile patches include:
- target threshold adjustments
- task sync default priority and keyword overrides
- optional prod env tightening

## Data and Validation

- Add profile allowlist constant.
- Extend template option normalization and validation for profile value.
- Include `profile` in output summary for traceability.

## Compatibility

- Existing `scene eval` consumption path unchanged.
- Existing `default` template remains baseline.
- Profile feature is additive and non-breaking.
