# Tasks

- [x] Define phase-1 file-backed schemas for `app_collection`, `scene_profile`, `device current`, and `device_override`.
- [x] Add local device read models for `sce device current` and `sce app install-state list`.
- [x] Implement collection and scene resolution with plan-first diff output and explicit execution gating.
- [x] Reuse existing app runtime install/activate/uninstall flows for execution rather than introducing a parallel installer.
- [x] Add unit coverage for resolution, diff semantics, override handling, and execute safety guards.
- [x] Update MagicBall-facing docs to separate shipped capabilities from planned phase-1 collection and scene-profile capability.
