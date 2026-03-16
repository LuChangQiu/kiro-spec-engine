# Design

## Decision

Deliver this capability in a local-device-first phase that adds an intent layer above the current single-app runtime controls while reusing the existing app bundle runtime execution path underneath.

The first implementation will formalize four model roles:

- `app_collection`: reusable desired app set
- `scene_profile`: scene-oriented workbench package built from app items plus policy metadata
- `device_installation`: current device fact state
- `device_override`: current device local add/remove policy overlay

## Why this design

The current SCE app surface already works for one app at a time:

- app bundle catalog lookup
- runtime release listing
- runtime install
- runtime activate
- runtime uninstall

That is enough execution capability for phase-1. The missing piece is not another installer. The missing piece is a resolver that can say:

1. what the shared workbench intends
2. what this device currently has
3. what should change on this device
4. which changes should be executed only after explicit confirmation

This keeps SCE aligned with existing governance principles:

- no parallel mechanisms when an execution plane already exists
- no blind apply without a reasoned diff
- no SQLite-only truth for portable/shared intent

## Canonical ownership

### Shared intent

Shared intent should remain file-backed first and be promotable to registry-backed sync later.

Phase-1 canonical ownership:

- workspace-defined `app_collection` documents
- workspace-defined `scene_profile` documents

These are intended to be Git-trackable when they describe shared project or workspace behavior.

### Device-local state

Device-local state should remain local and must not silently mutate shared collection definitions.

Phase-1 local ownership:

- current device identity and capability tags
- actual installation facts
- local per-device overrides
- last resolution/apply result cache

## Storage model

### Canonical definitions

Phase-1 should keep canonical intent definitions in files rather than SQLite-only rows.

Recommended canonical paths:

- `.sce/app/collections/*.json`
- `.sce/app/scene-profiles/*.json`

These files can later be hydrated from a registry or remote API without changing the ownership rule.

### Local facts and projections

SQLite is appropriate only for device-local fact or projection workloads with query pressure.

Candidate local tables:

- `app_device_installation_registry`
- `app_collection_resolution_registry`

Possible local file-backed companion records:

- `.sce/state/device/device-current.json`
- `.sce/state/device/device-override.json`

This split is deliberate:

- shared intent stays portable and reviewable
- local facts stay queryable
- projections stay rebuildable

## Resolution flow

### 1. Resolve source

`scene workspace apply` or `app collection apply` first resolves the target definition from canonical files or a synced registry projection.

### 2. Load current device context

The resolver loads:

- current device identity
- capability tags
- current installed and active app runtime facts
- local device overrides

### 3. Build desired set

The resolver expands the selected collection or scene profile into a desired app set, keeping item metadata such as:

- required
- removable
- priority
- default entry
- capability constraints

### 4. Produce plan-first diff

The resolver compares desired state with current device installation facts and emits a machine-readable diff:

- `install`
- `uninstall`
- `activate`
- `keep`
- `skip`

Each action includes a `reason` field so the caller can show why it was proposed.

### 5. Execute only on explicit confirmation

When the caller explicitly requests execution, SCE reuses the current app runtime execution path to perform the diff safely and sequentially.

This keeps the guardrail intact:

- no hidden install/uninstall mutations
- no parallel state authority
- no bypass of runtime safety checks

## Planned phase-1 commands

### Device commands

- `sce device current`
- `sce device override show`
- `sce device override upsert`

### Collection commands

- `sce app collection list`
- `sce app collection show`
- `sce app collection apply`

### Install-state command

- `sce app install-state list`

### Scene workspace commands

- `sce scene workspace list`
- `sce scene workspace show`
- `sce scene workspace apply`

`apply` should default to diff output and require an explicit execution switch for write behavior.

`device override upsert` should only mutate fields explicitly provided by the caller so local per-device policy can be updated without blindly replacing unrelated override state.

## Rollout phases

### Phase 1

- local device-first collections and scene profiles
- file-backed shared intent
- local install-state projection
- explicit diff/apply flow

### Phase 2

- lightweight sync for shared intent definitions across devices
- still do not sync device installation facts

### Phase 3

- role/team/org policy overlays
- device-type-aware policy distribution

## Non-goals

- no global "all devices install the same set" model
- no account system requirement in phase-1
- no second installer separate from app runtime execution
- no SQLite-only source of truth for shared app intent
- no frontend repository changes in MagicBall from this Spec alone
