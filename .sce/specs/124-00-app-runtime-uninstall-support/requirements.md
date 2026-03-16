# Requirements Document

## Introduction

MagicBall has started consuming SCE app runtime controls as a product surface, not just as internal CLI helpers. The current SCE capability set only supports `show`, `releases`, `install`, and `activate`, which leaves one operational gap: once a runtime release is installed, there is no first-class way to remove the local installation state and filesystem payload. That creates an inconsistent frontend contract because the UI can only show install/activate, not uninstall/reinstall.

This Spec adds `sce app runtime uninstall` and tightens the runtime projection contract so MagicBall can distinguish installed state from active state without reconstructing backend semantics in the frontend.

## Glossary

- **Installed Release**: The runtime release currently recorded in SCE local runtime installation metadata for one app bundle
- **Active Release**: The runtime release currently selected as the app bundle's active runtime projection
- **Single Installation Slot**: The current SCE runtime model only tracks one installed release per app bundle; this Spec does not add multi-version concurrent local installs

## Requirements

### Requirement 1: Provide Runtime Uninstall Command

**User Story:** As a MagicBall or CLI operator, I want to remove an installed runtime release cleanly, so that local runtime state can be reset without editing SCE state by hand.

#### Acceptance Criteria

1. SCE SHALL provide `sce app runtime uninstall`
2. THE command SHALL require `--app <app-id|app-key>`
3. THE command SHALL resolve the uninstall target from `--release` when provided, otherwise from the current installed release
4. WHEN the selected release is not the currently installed release, THEN the command SHALL fail with a clear error
5. WHEN uninstall succeeds, THEN SCE SHALL remove the local installation directory if it exists and SHALL update runtime installation metadata to a `not-installed` state

### Requirement 2: Protect Active Release From Blind Uninstall

**User Story:** As a runtime operator, I want SCE to prevent dangerous uninstall of the currently active runtime release, so that uninstall does not silently break the selected app projection.

#### Acceptance Criteria

1. WHEN the uninstall target matches the current active release, THEN SCE SHALL block the uninstall
2. THE blocking error SHALL instruct the caller to activate another release first
3. THIS protection SHALL apply regardless of whether the release was selected explicitly by `activate` or inherited as the current active runtime projection

### Requirement 3: Separate Installed State From Active State In Runtime Projections

**User Story:** As a MagicBall frontend, I want runtime payloads to tell me which release is installed and which one is active, so that the UI can render correct uninstall/install/activate actions without guessing.

#### Acceptance Criteria

1. `app runtime show` SHALL expose both installed release id and active release id when available
2. `mode application home` SHALL expose installed release id and active release id separately in its summary/view model
3. `app runtime releases` SHALL mark each release with machine-readable installed/active state
4. THE releases payload SHALL make uninstall eligibility explicit for each release under the current single-installation-slot model

### Requirement 4: Support Reinstall Through Existing Install Flow

**User Story:** As a MagicBall frontend, I want reinstall to reuse the existing install behavior after uninstall, so that the product does not need a second write command just to reinstall the same release.

#### Acceptance Criteria

1. THIS Spec SHALL NOT introduce a separate `reinstall` command
2. AFTER uninstall, the same release SHALL be installable again via existing `sce app runtime install`
3. Runtime projection payloads SHALL reflect the transition from `installed` to `not-installed` and back to `installed`

### Requirement 5: Document And Test The Contract

**User Story:** As a maintainer, I want the new runtime uninstall contract documented and covered by tests, so that MagicBall integration and future releases do not regress.

#### Acceptance Criteria

1. THE capability SHALL include unit coverage for install -> activate -> uninstall and uninstall-blocked-on-active scenarios
2. SCE command/help and MagicBall integration docs SHALL be updated to include uninstall
3. The write-authorization adaptation guide SHALL define the required scope for uninstall
