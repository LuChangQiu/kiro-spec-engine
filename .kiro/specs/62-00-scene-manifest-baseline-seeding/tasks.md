# Implementation Plan: Scene Manifest Baseline Seeding

## Tasks

- [x] 1 Define baseline seeding scope and conventions
  - Scoped scene lineage specs (`36-58`) plus catalog spec (`61`).
  - Standardized deterministic obj_id/title strategy.

- [x] 2 Seed scene manifests via scaffold workflow
  - Generated `custom/scene.yaml` for each scoped spec with `scene scaffold`.
  - Used hybrid scaffold for `37-00`, erp scaffold for remaining scoped specs.

- [x] 3 Verify catalog activation
  - Executed `kse scene catalog` and confirmed non-zero valid entries.
  - Captured baseline catalog snapshot JSON in `reports/`.

- [x] 4 Verify governance integrity
  - Executed `kse status` to confirm task completion visibility.
  - Executed `kse doctor --docs` and kept project compliance green.

- [x] 5 Preserve seeding evidence
  - Added seeding report and command evidence under `reports/`.
