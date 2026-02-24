# Implementation Plan: Scene Catalog Discovery and Routing

## Tasks

- [x] 1 Add catalog command wiring under scene CLI
  - Added `scene catalog` subcommand in `lib/commands/scene.js`.
  - Added options for spec scope, filters, invalid visibility, JSON and export.

- [x] 2 Implement catalog option normalization and validation
  - Added `normalizeCatalogOptions` and `validateCatalogOptions`.
  - Enforced relative `--spec-manifest` and safe path argument handling.

- [x] 3 Implement catalog discovery and entry modeling
  - Added catalog builders that scan specs, discover manifests, parse/validate scenes,
    and compute summary counters.
  - Added valid/invalid entry handling with filter support.

- [x] 4 Implement catalog output behavior
  - Added human-readable summary printer and JSON output mode.
  - Added optional `--out` JSON export with ensured output directory.

- [x] 5 Verify command and regression safety
  - Extended `tests/unit/commands/scene.test.js` with catalog-focused tests.
  - Ran `npx jest tests/unit/commands/scene.test.js --runInBand`.
  - Ran `node -c lib/commands/scene.js` and `node .\bin\kiro-spec-engine.js scene --help`.
