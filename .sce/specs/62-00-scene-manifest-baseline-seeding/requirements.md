# Requirements Document: Scene Manifest Baseline Seeding

## Introduction

With `scene catalog` available, the project still needs baseline scene manifests in active scene-related specs so
catalog/discovery and downstream routing flows can run with real entries instead of empty results.

## Requirements

### Requirement 1: Baseline Scope Definition
- Define a baseline scope of scene-related specs that should carry starter scene manifests.
- Scope should cover current scene runtime/doctor/eval plugin governance lineage.
- Scope decisions must be traceable in spec outputs.

### Requirement 2: Deterministic Seed Strategy
- Seed manifests with deterministic `obj_id`, title, and template type conventions.
- Keep manifests in `custom/scene.yaml` for consistent discovery.
- Use existing scene scaffold flow rather than ad-hoc document generation.

### Requirement 3: Catalog Activation
- After seeding, `scene catalog` should return non-zero valid entries.
- Catalog output should provide evidence of seeded coverage.

### Requirement 4: Validation and Governance
- Seeded manifests must pass scene manifest validation.
- Project document compliance must remain green after seeding.

### Requirement 5: Operational Evidence
- Preserve a compact seeding report with scope, conventions, and verification commands.
- Keep implementation tasks fully traceable in this spec.
