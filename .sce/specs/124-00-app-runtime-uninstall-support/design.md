# Design Document: App Runtime Uninstall Support

## Overview

This change extends the existing `sce app runtime` command family with one additional write operation:

- `sce app runtime uninstall`

The implementation remains intentionally narrow:

1. keep the current app-bundle-backed runtime model
2. keep the current single installation slot
3. add uninstall as a first-class operation
4. expose installed vs active state explicitly in runtime payloads

## Core Design

### Command Behavior

`runAppRuntimeUninstallCommand` will:

1. resolve the app bundle graph
2. read the current runtime installation metadata from `bundle.metadata.runtime_installation`
3. resolve the uninstall target:
   - `--release` when provided
   - otherwise the currently installed release
4. block when:
   - no installed release exists
   - the requested release is not the installed release
   - the requested release equals the current active runtime release
5. remove the installation root directory when present
6. persist `runtime_installation` back as a `not-installed` record while preserving app bundle and runtime release registry data

### Projection Semantics

Current SCE runtime payloads conflate installation state and activation state. This patch separates them.

`buildRuntimeSummary` will expose:

- `install_status`
- `installed_release_id`
- `active_release_id`
- `install_root`
- `release_count`

`mode application home` will expose the same distinction in both summary and `view_model`.

`app runtime releases` will decorate each catalog release with:

- `installed`
- `active`
- `installation_status`
- `available_actions`

Under the current single-slot model, only one release can be `installed=true`.

### Authorization

`uninstall` is a write operation and will require a dedicated scope:

- `app:runtime:uninstall`

This keeps write authorization explicit and avoids overloading install/activate permissions.

## Tradeoffs

### Why not add multi-version installation now

MagicBall's immediate gap is missing uninstall and incorrect runtime-state projection. SCE currently stores only one installation slot in bundle metadata, and expanding that into a multi-install registry is a larger product/data-model change. This Spec fixes the current mismatch without pretending multi-install already exists.

### Why keep a `not-installed` metadata record instead of deleting installation metadata entirely

Keeping a normalized `runtime_installation.status = not-installed` record makes post-action payloads clearer and avoids forcing frontend consumers to infer "missing object means uninstalled".

## Changed Files

- `lib/commands/app.js`
- `lib/commands/mode.js`
- `tests/unit/commands/app-mode.test.js`
- `README.md`
- `README.zh.md`
- `docs/command-reference.md`
- `docs/magicball-sce-adaptation-guide.md`
- `docs/magicball-cli-invocation-examples.md`
- `docs/magicball-write-auth-adaptation-guide.md`
- `docs/magicball-integration-issue-tracker.md`
- `CHANGELOG.md`

## Non-Goals

- No multi-version concurrent local runtime installations
- No new runtime deactivate command in this patch
- No frontend repository changes inside MagicBall itself
