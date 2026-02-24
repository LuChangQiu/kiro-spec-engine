# Design Document: Scene Eval Inference Governance

## Overview

Introduce governance controls around eval profile inference while preserving backward compatibility.

## CLI Surface

`scene eval` adds:
- `--profile-infer-strict`
- `--no-profile-manifest-auto-discovery`

## Profile Manifest Resolution

Add helper pipeline:
1. Attempt requested `--spec-manifest` path.
2. If unavailable and auto-discovery enabled, search common candidates:
   - `custom/scene.yaml|yml|json`
   - `scene.yaml|yml|json`
3. Fallback to bounded recursive scan (`scene.yaml|yml|json`, max depth).
4. Return resolution metadata and warnings for report output.

## Eval Runtime Integration

- `runSceneEvalCommand` uses manifest resolution helper before profile resolution.
- Profile strict check runs after source resolution:
  - no explicit profile
  - strict enabled
  - resolved profile is `default`
  => fail fast.

## Report/UX Integration

Extend report inputs with:
- `profile_infer_strict`
- `profile_manifest_auto_discovery`
- `profile_manifest`
- `profile_manifest_source`
- `profile_warnings`

Non-JSON summary prints `Profile Warnings` block when warnings exist.

## Compatibility

- Existing precedence and policy merge behavior remain unchanged.
- Task sync behavior remains append-only with source metadata.
