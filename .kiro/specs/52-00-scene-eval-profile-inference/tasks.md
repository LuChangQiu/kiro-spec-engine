# Implementation Plan: Scene Eval Profile Inference Fallback

## Tasks

- [x] 1 Extend profile inference helpers
  - Updated domain inference to include `ops` mapping.
  - Added scene reference inference helper for fallback resolution.

- [x] 2 Expand eval profile resolution sources
  - `resolveSceneEvalProfile` now accepts run result payload input.
  - Added fallback chain for result domain and scene reference inference.

- [x] 3 Integrate fallback into eval command runtime
  - `runSceneEvalCommand` passes result payload into profile resolver.
  - Existing non-blocking behavior for missing spec manifest is preserved.

- [x] 4 Improve observability
  - Eval summary now prints profile and profile source in non-JSON output.
  - Report inputs keep stable provenance fields for downstream sync metadata.

- [x] 5 Validate behavior and regressions
  - Added unit test for missing-manifest fallback to `result:scene_ref`.
  - Updated eval-config scenario expectation for inferred profile provenance.
  - Ran syntax checks, targeted unit suites, and CLI smoke validation.
