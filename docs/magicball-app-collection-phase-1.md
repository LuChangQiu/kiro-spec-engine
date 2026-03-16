# MagicBall App Collection Phase 1

## Status

Shipped phase-1 baseline in SCE.

Current shipped read-model baseline:

- `sce device current`
- `sce device override show`
- `sce device override upsert`
- `sce app collection list`
- `sce app collection show`
- `sce app collection apply` with plan-first diff and explicit execute for non-blocked install/uninstall actions
- `sce app install-state list`
- `sce scene workspace list`
- `sce scene workspace show`
- `sce scene workspace apply` with plan-first diff and explicit execute for non-blocked install/uninstall actions

Current shipped runtime controls remain:

- `sce app runtime show`
- `sce app runtime releases`
- `sce app runtime install`
- `sce app runtime activate`
- `sce app runtime uninstall`

## Goal

Add a scene-oriented installation model above the current single-app runtime controls so MagicBall can manage "what this workbench wants" separately from "what this device actually has installed".

## Core decision

SCE should split the model into two layers plus one local overlay:

- intent layer: `app_collection` and `scene_profile`
- device fact layer: `device_installation`
- local override layer: `device_override`

This means:

- users or workspaces sync the desired app set
- devices decide their own actual install set
- one user on multiple devices does not get forced into identical installs

## Why SCE should support this

The current runtime commands are enough for single-app control, but they are not enough to express:

- sales workbench vs planning workbench vs development workbench
- device-specific install differences
- reasoned batch install and uninstall planning

Without this layer, frontend code has to invent business grouping and install logic outside SCE, which would fragment the contract.

## Phase 1 scope

Phase-1 should stay local-device-first.

It should add:

- current device identity and capability view
- file-backed app collections
- file-backed scene profiles
- local install-state listing
- collection or scene apply diff planning
- explicit execute step for apply

It should not require:

- user account system
- cross-device installation-state sync
- organization policy rollout

## Storage position

SCE already has a selective SQLite policy. This capability should follow it.

Recommended split:

- shared intent stays file-backed or registry-backed
- device facts and rebuildable resolution projections may use SQLite
- local device override stays file-backed at `.sce/state/device/device-override.json`

This boundary matters because SQLite is suitable for local query-heavy facts, but it should not become the only source of truth for portable shared intent.

## Copy-ready examples

Sample assets are available here:

- `docs/examples/app-intent-phase1/.sce/app/collections/*.json`
- `docs/examples/app-intent-phase1/.sce/app/scene-profiles/*.json`
- `docs/examples/app-intent-phase1/README.md`

These examples are intentionally realistic but still generic:

- sales desktop workspace
- planning desktop workspace
- warehouse tablet workspace

Use them as a starting point, then replace app keys and business metadata with project-specific values.

## Recommended phase-1 command shape

Phase-1 overall command surface:

- `sce device current`
- `sce device override show`
- `sce device override upsert`
- `sce app collection list`
- `sce app collection show`
- `sce app collection apply`
- `sce app install-state list`
- `sce scene workspace list`
- `sce scene workspace show`
- `sce scene workspace apply`

Execution rule:

- `apply` should return a plan or diff by default
- actual mutation requires explicit execute confirmation
- execute stays blocked when the plan still contains unresolved collections, missing app bundles, or active-release protection skips
- resolution now also considers local `device_override` add/remove overlays and item-level `capability_tags`
- local override updates now also have an explicit CLI governance surface instead of requiring manual file edits
- execution should reuse the existing app runtime path

JSON response contract:

- `docs/app-intent-apply-contract.md`

## Frontend implication for MagicBall

MagicBall should keep using current per-app runtime controls until this phase ships.

Today, MagicBall can already use:

1. `sce device current` for current device identity and capability tags
2. `sce device override show/upsert` for local per-device add/remove overlays
3. `sce app collection list/show/apply` for file-backed shared collection intent and plan-first diff
4. `sce scene workspace list/show/apply` for file-backed scene-profile intent and plan-first diff
5. `sce app install-state list` for current cross-app installation projection
6. existing per-app runtime controls for concrete runtime actions

Once phase-1 lands, the preferred top-level interaction should become:

1. pick a scene workspace or app collection
2. inspect the proposed device diff
3. explicitly apply the plan
4. continue using per-app runtime controls for detail views

## Phase 2 direction

Phase-2 should be planned as lightweight user-intent sync, not as device-state sync.

Recommended boundary:

- sync shared `app_collection` / `scene_profile` selections or bindings
- do not sync `device_installation` facts as the cross-device source of truth
- keep `device_override` local unless a project explicitly introduces a higher-level policy mechanism

Recommended deliverables for phase-2 planning:

1. user binding model for scene/profile selection
2. device-aware resolution order for `user intent + local override + capability tags`
3. pull/push sync semantics with conflict visibility rather than silent overwrite
4. explicit non-goal: do not force all devices into the same installed app set

## Practical conclusion

SCE should support this direction, but it should do so by extending the current app/runtime model rather than replacing it.
