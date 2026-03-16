# Requirements Document

## Introduction

SCE already defaults co-work to enabled and already defaults `errorbook` to the canonical failure-learning mechanism. However, the current collaboration governance audit only checks multi-agent config, runtime trace hygiene, legacy references, and steering boundary drift. It does not explicitly enforce that shared `errorbook` experience resources are seeded and enabled as part of the co-work baseline.

This Spec closes that gap by making shared `errorbook` support auditable under the default co-work governance gate.

## Glossary

- **Shared Errorbook Registry**: The project-level `.sce/config/errorbook-registry.json` configuration that lets SCE search shared, curated errorbook knowledge
- **Errorbook Convergence**: The policy that requires custom mistake-book style mechanisms to converge into `.sce/errorbook` instead of running in parallel
- **Managed Co-work Project**: An SCE-managed project where collaboration governance is part of the default operating baseline

## Requirements

### Requirement 1: Co-work Audit Must Enforce Shared Errorbook Registry Baseline

**User Story:** As a project owner using SCE co-work by default, I want the collaboration governance audit to verify that shared errorbook resources are enabled, so that teams do not silently lose shared failure-remediation knowledge.

#### Acceptance Criteria

1. THE co-work audit SHALL inspect `.sce/config/errorbook-registry.json`
2. WHEN the file is missing, THEN the audit SHALL report a violation
3. WHEN the file exists but is invalid or disabled, THEN the audit SHALL report a violation
4. WHEN the file is valid and has at least one enabled source, THEN the audit SHALL treat the shared registry baseline as present

### Requirement 2: Managed Adoption Baseline Must Preserve Errorbook Convergence

**User Story:** As a maintainer of managed SCE projects, I want collaboration governance to detect drift in errorbook convergence defaults, so that teams do not reintroduce parallel mistake-book mechanisms under co-work.

#### Acceptance Criteria

1. WHEN `.sce/adoption-config.json` exists, THEN the co-work audit SHALL inspect `defaults.errorbook_convergence`
2. THE managed baseline SHALL require:
   - `enabled = true`
   - `canonical_mechanism = errorbook`
   - `disallow_parallel_mechanisms = true`
   - `strategy = absorb_into_sce_errorbook`
3. WHEN a managed project drifts from these defaults, THEN the audit SHALL report a violation
4. WHEN adoption metadata is absent, THEN the audit SHALL not fail purely because convergence metadata is unavailable

### Requirement 3: Tests And Gate Output Must Cover The New Baseline

**User Story:** As a maintainer, I want regression coverage and visible gate reporting for the shared errorbook baseline, so that future co-work changes cannot quietly drop it.

#### Acceptance Criteria

1. THE unit tests for collaboration governance audit SHALL cover missing registry config and managed convergence drift
2. THE audit summary SHALL expose errorbook-related counters or status fields
3. THE collaboration governance gate SHALL surface these violations through the existing blocking path
