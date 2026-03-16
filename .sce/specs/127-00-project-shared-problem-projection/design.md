# Design

## Decision

Add `project_shared_projection` under the existing `problem-closure-policy.json` and generate a tracked project-level projection file at `.sce/knowledge/problem/project-shared-problems.json`.

## Why this design

- Problem facts already exist in SCE as spec-bound artifacts, mainly `problem-contract.json` and `problem-domain-chain.json`.
- Creating a separate local "problem library" would duplicate concepts and violate the convergence rule against parallel mechanisms.
- A tracked projection gives co-work a stable shared view without pushing transient runtime data.

## Default policy

- Config file: `.sce/config/problem-closure-policy.json`
- Projection path: `.sce/knowledge/problem/project-shared-problems.json`
- Default scope: `non_completed`

## Projection contents

Each entry is derived from one spec and includes:

- `spec_id`
- `scene_id`
- `lifecycle_state`
- `problem_statement`
- `expected_outcome`
- `impact_scope`
- `reproduction_steps`
- `forbidden_workarounds`
- selected domain summary signals such as ontology counts and verification gates

## Refresh strategy

- Managed co-work gate refreshes the projection before running collaboration governance audit.
- Takeover/template baseline seeds the tracked file so new/adopted projects start in a valid state.

## Governance strategy

Collaboration governance audit verifies:

- problem closure policy exists and parses
- `project_shared_projection.enabled=true`
- projection file exists and parses
- projection file is Git-tracked

## Non-goals

- Do not create a new standalone problem registry or remote problem service.
- Do not sync transient runtime debugging artifacts as part of the project-shared problem view.
