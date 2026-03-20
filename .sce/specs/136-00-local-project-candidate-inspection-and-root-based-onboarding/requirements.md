# Requirements Document

## Introduction

Adapters now need to manage more than engine-registered projects:

- workspace-backed projects already surfaced by `135-01`
- local directories that already contain `.sce`
- ordinary local directories explicitly chosen by a user for import/adoption

The engine should not own whole-machine scanning policy, but it should own the semantic contract for inspecting one local directory and onboarding it without forcing adapters to fake an app-bundle-first workflow.

## Requirements

### Requirement 1: Provide Canonical Local Project Candidate Inspection

**User Story:** As an IDE or CLI adapter, I want to inspect one local directory through SCE, so that I can classify whether it is already an SCE project, an onboardable engineering project, or an invalid root without inventing my own heuristics.

#### Acceptance Criteria

1. SCE SHALL provide one canonical local project candidate inspection contract for a supplied root directory
2. The contract SHALL distinguish at least:
   - workspace-backed registered project
   - valid local `.sce` project candidate
   - ordinary directory that can be onboarded
   - invalid or inaccessible directory
3. The contract SHALL include canonical root identity fields such as `rootDir`, `projectId` when known, `workspaceId` when known, and human-readable name fields when known
4. The contract SHALL expose explicit readiness and reason codes instead of requiring adapter-side path heuristics

### Requirement 2: Support Root-Based Onboarding Entry

**User Story:** As an adapter, I want to submit a directory root directly for onboarding, so that users can import or adopt a project without first pretending that the directory is an app-library item.

#### Acceptance Criteria

1. SCE SHALL define a canonical root-based onboarding entry contract
2. The contract SHALL accept a local root directory as the primary target
3. The contract SHALL support at least import/adopt-style flows where app identity may be absent at the start
4. The contract SHALL return a structured onboarding result envelope compatible with `131-00`

### Requirement 3: Preserve Engine/Adapter Boundary

**User Story:** As an SCE maintainer, I want adapters to own scan policy while the engine owns semantic inspection, so that SCE stays cross-tool and does not become a GUI-specific filesystem scanner.

#### Acceptance Criteria

1. SCE SHALL NOT require a whole-machine scan policy as part of the canonical contract
2. Adapters MAY scan local roots themselves and invoke SCE per candidate root
3. SCE SHALL document that local directory discovery policy remains adapter-owned
4. SCE SHALL keep the inspection and onboarding payloads UI-neutral

### Requirement 4: Align With Existing Portfolio Identity

**User Story:** As an adapter author, I want local candidate inspection to align with existing portfolio identity rules, so that a candidate can become a portfolio project without identity drift.

#### Acceptance Criteria

1. When a root already maps to a workspace-backed project, the inspection result SHALL reuse `135-01` identity fields
2. When a root is only a local `.sce` candidate, the result SHALL mark it as local/partial rather than registered
3. The contract SHALL NOT introduce a second persistent project registry
4. The contract SHALL remain compatible with future richer project ownership or SQLite-backed relations

### Requirement 5: Publish Reason Codes For Candidate States

**User Story:** As a supervising user, I want adapters to explain why a local root is only a candidate or why onboarding cannot proceed, so that local project management remains auditable.

#### Acceptance Criteria

1. SCE SHALL publish canonical reason codes for candidate inspection outcomes
2. Reason codes SHALL distinguish at least:
   - `.sce` present
   - workspace already registered
   - root accessible but not yet initialized
   - root inaccessible
   - invalid project metadata
   - onboarding blocked by missing required fields
3. Reason codes SHALL be reusable by IDE and CLI without layout-specific assumptions
