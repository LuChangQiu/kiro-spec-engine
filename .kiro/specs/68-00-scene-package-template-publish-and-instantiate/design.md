# Design Document: Scene Package Template Publish and Instantiate

## Overview

Build a lifecycle bridge between scene contract declaration and reusable template application.

1. `scene package-publish`
   - Source: `.kiro/specs/<spec>/custom/scene-package.json` + `custom/scene.yaml`
   - Output: `.kiro/templates/scene-packages/<template-id>/`
2. `scene package-instantiate`
   - Source: `<template-id>/template.manifest.json`
   - Output: `.kiro/specs/<target-spec>/custom/scene.yaml` + `custom/scene-package.json`

## Command Surface

- `kse scene package-publish`
  - `--spec <spec-name>` (required)
  - `--spec-package <relative-path>`
  - `--scene-manifest <relative-path>`
  - `--out-dir <path>`
  - `--template-id <template-id>`
  - `--force`
  - `--json`

- `kse scene package-instantiate`
  - `--template <path>` (required)
  - `--target-spec <spec-name>` (required)
  - `--values <path>`
  - `--force`
  - `--json`

## Published Template Layout

```text
.kiro/templates/scene-packages/<template-id>/
  template.manifest.json
  scene-package.json
  scene.template.yaml
```

## Template Manifest Model

```json
{
  "apiVersion": "kse.scene.template/v0.1",
  "kind": "scene-package-template",
  "metadata": {
    "template_id": "kse.scene--erp-order-query--0.2.0",
    "source_spec": "67-00-scene-package-contract-declaration",
    "package_coordinate": "kse.scene/erp-order-query@0.2.0",
    "package_kind": "scene-template",
    "published_at": "2026-02-09T00:00:00.000Z"
  },
  "compatibility": {
    "scene_api_version": "kse.scene/v0.2"
  },
  "parameters": [],
  "template": {
    "package_contract": "scene-package.json",
    "scene_manifest": "scene.template.yaml"
  },
  "artifacts": {
    "entry_scene": "custom/scene.yaml",
    "generates": ["requirements.md", "design.md", "tasks.md", "custom/scene.yaml"]
  }
}
```

## Instantiate Resolution

- Resolve template parameter values from `--values` JSON.
- Apply required/default fallback by package contract `parameters` entries.
- Render placeholders in scene template using:
  - `{{ parameter_id }}`
  - `${parameter_id}`
- On missing required parameters, fail before writing target outputs.

## Test Strategy

- Validate options for publish/instantiate paths and required flags.
- Publish command test verifies template directory writes and deterministic template id.
- Instantiate command test verifies placeholder rendering and target contract rewrite.
- Instantiate failure test verifies missing required parameter protection.
