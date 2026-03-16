# Design Document: Co-work Shared Errorbook Governance

## Overview

The current co-work governance gate is already the right place to enforce shared collaboration defaults. This patch extends it with explicit `errorbook` checks instead of inventing a second parallel gate.

The change has two layers:

1. validate project-level shared registry config
2. validate managed-project convergence defaults when adoption metadata exists

## Core Design

### Errorbook Registry Audit

Add `inspectErrorbookRegistry(projectRoot, ...)` to `lib/workspace/collab-governance-audit.js`.

It will check:

- file exists: `.sce/config/errorbook-registry.json`
- file parses as JSON object
- `enabled === true`
- `cache_file` is a non-empty string
- `sources` is a non-empty array
- at least one source is enabled and has a non-empty `url`

Violations here are hard failures because the user wants shared errorbook capability to be default-on under co-work.

### Errorbook Convergence Audit

Add `inspectErrorbookConvergence(projectRoot, ...)`.

Behavior:

- if `.sce/adoption-config.json` does not exist, return a passing advisory report (`not-managed`)
- if it exists, inspect `defaults.errorbook_convergence`
- require:
  - `enabled: true`
  - `canonical_mechanism: "errorbook"`
  - `disallow_parallel_mechanisms: true`
  - `strategy: "absorb_into_sce_errorbook"`

This avoids false failures for init-only projects while still protecting managed adoption/takeover baselines from drift.

### Audit Report Integration

Extend the existing audit payload with:

- `errorbook_registry`
- `errorbook_convergence`
- new summary counters for related warnings/violations

The existing gate implementation can stay unchanged because it already blocks on audit violations generically.

## Tradeoffs

### Why enforce registry presence under co-work

The requirement is not merely "errorbook commands exist"; it is "shared experience resources are default-supported". Without seeded and enabled registry config, that support is only latent, not operationally default.

### Why not scan every custom mistake-book artifact again here

Takeover baseline already inventories project-defined parallel mechanisms. Repeating full-repo convergence scans inside the co-work gate would create duplicate governance logic and more noise. This patch only enforces that the shared baseline exists and remains enabled.

## Changed Files

- `lib/workspace/collab-governance-audit.js`
- `tests/unit/workspace/collab-governance-audit.test.js`
- `docs/command-reference.md`
- `CHANGELOG.md`

## Non-Goals

- No new standalone errorbook governance gate
- No full-repo mistake-book convergence scan in this patch
- No release of a separate shared storage format beyond the existing `errorbook-registry.json`
