# Requirements

## Summary

MagicBall now needs a higher-level installation model than single-app runtime actions. SCE already supports `app runtime show/releases/install/activate/uninstall` for one app bundle at a time, but it still lacks a first-class way to express:

- what a user or workbench wants to use
- what one specific device has actually installed
- how to resolve the gap without forcing all devices into the same install set

This Spec defines a phase-1 SCE model for `app_collection`, `scene_profile`, `device_installation`, and `device_override` so MagicBall can move from single-app buttons to scene-oriented install management.

## Requirements

### R1. Reuse the existing app/runtime execution plane

- SCE must not create a parallel installer or runtime authority for this capability.
- `app_collection` and `scene_profile` apply flows must resolve into the existing app bundle and runtime install/activate/uninstall execution path.
- Runtime protections that already exist, including active-release uninstall blocking, must remain in force when apply flows execute changes.

### R2. Separate intent from device facts

- SCE must model user or workspace intent separately from local device installation facts.
- `app_collection` and `scene_profile` must represent desired application sets.
- `device_installation` must represent what the current device has actually installed and activated.
- Cross-device sync, when introduced later, must synchronize intent definitions rather than device installation facts.

### R3. Organize around scene profiles instead of raw app lists

- SCE must support a scene-oriented abstraction so business workbenches can be represented as more than a bare list of apps.
- A `scene_profile` item must be able to carry at least:
  - target app identity
  - priority or ordering
  - whether the app is required
  - whether the app may be locally removed
  - optional default entry or usage metadata
- Raw app collections may still exist, but `scene_profile` must be the preferred user-facing organization layer.

### R4. Support device-local overrides and capability-aware resolution

- SCE must support a device-local override layer so one device can differ from the base collection or scene profile without mutating the shared definition.
- Resolution must consider current device identity and capability tags before proposing installs, uninstalls, or activations.
- Phase-1 apply logic must produce a reasoned diff that explains why each action is proposed.

### R5. Enforce non-blind apply semantics

- SCE must not blindly mutate device installation state from a collection or scene apply request.
- Phase-1 apply commands must default to a plan or diff response first.
- Executing the diff must require an explicit execute or confirm step.
- The diff payload must make proposed install, uninstall, activate, keep, and skip decisions machine-readable.

### R6. Keep canonical intent outside SQLite-only storage

- Canonical `app_collection` and `scene_profile` definitions must remain file-backed or registry/API-backed.
- SQLite may be used only for device-local facts, rebuildable projections, and query-heavy resolution indexes.
- SCE must not make SQLite the only source of truth for cross-device user intent.

### R7. Provide a phase-1 command surface

- Phase-1 must introduce a command surface centered on:
  - `sce device current`
  - `sce app collection list`
  - `sce app collection show`
  - `sce app collection apply`
  - `sce app install-state list`
  - `sce scene workspace list`
  - `sce scene workspace show`
  - `sce scene workspace apply`
- The phase-1 command surface may remain local-device-first and does not require account-backed sync in the first delivery.

### R8. Document boundaries and rollout phases clearly

- SCE documentation must distinguish current shipped capabilities from planned phase-1 collection and scene-profile capabilities.
- MagicBall-facing docs must clearly state that phase-1 focuses on local device resolution first, not full user-account sync.
- The docs must explicitly preserve the current state-tiering rule: device facts may be projected into SQLite, but shared intent must not be reduced to SQLite-only truth.
