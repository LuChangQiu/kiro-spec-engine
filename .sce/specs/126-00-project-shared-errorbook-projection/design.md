# Design

## Decision

Use a tracked registry-style projection file at `.sce/knowledge/errorbook/project-shared-registry.json` instead of unignoring the entire `.sce/errorbook/` runtime directory.

## Rationale

- `.sce/errorbook/` contains local runtime state, staging attempts, and cache-like artifacts that should not be pushed across machines.
- A projection file keeps the shared contract narrow: only high-value curated entries are shared.
- The existing `errorbook export` registry format already provides the right interchange shape, so the new capability can reuse that format and lookup flow.

## Default projection policy

- Path: `.sce/knowledge/errorbook/project-shared-registry.json`
- Enabled by default through `.sce/config/errorbook-registry.json`
- Default statuses: `verified`, `promoted`
- Default minimum quality: `75`

## Runtime behavior

1. Errorbook mutation commands update local curated entries as before.
2. After each relevant mutation, SCE refreshes the project-shared projection file automatically.
3. Registry-inclusive lookup can search the project-shared local file even in `remote` mode, without requiring a remote index.

## Governance behavior

- Co-work audit validates:
  - shared registry config exists and is enabled
  - `project_shared_projection` exists and stays enabled
  - an enabled `project-shared` source exists
  - the tracked projection file exists and parses
  - the tracked projection file is committed to Git

## Non-goals

- Do not auto-commit or auto-push project-shared knowledge.
- Do not unignore raw `.sce/errorbook/**`.
- Do not merge project-shared projection entries into local runtime indexes automatically.
