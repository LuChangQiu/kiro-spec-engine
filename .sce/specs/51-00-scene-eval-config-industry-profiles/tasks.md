# Implementation Plan: Scene Eval Config Industry Profiles

## Tasks

- [x] 1 Add profile option to eval-config-template command
  - Added `--profile <profile>` with supported values in help text.
  - Added profile normalization and validation.

- [x] 2 Implement profile-based template builder
  - Kept `createDefaultSceneEvalConfigTemplate` as baseline.
  - Added profile patch builder for `erp`, `ops`, and `robot`.

- [x] 3 Integrate profile output into template command summary
  - Template command now writes selected profile in summary payload and CLI output.

- [x] 4 Extend tests
  - Updated default template test to assert profile metadata.
  - Added ops profile output test.
  - Added unsupported profile rejection test.

- [x] 5 Validate and smoke
  - Executed syntax checks and unit tests.
  - Verified `scene eval-config-template --help`.
  - Ran CLI smoke for `--profile ops` template generation.
