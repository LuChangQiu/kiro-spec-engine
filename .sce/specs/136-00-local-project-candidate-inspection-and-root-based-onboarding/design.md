# Design Document

## Decision

Add one canonical inspection capability and one canonical root-based onboarding capability.

The engine does not own scan-root discovery policy. Adapters choose which local roots to inspect.

## Contract Direction

### Candidate Inspection

SCE should expose one read contract conceptually equivalent to:

- `sce project candidate inspect --root <path> --json`

Example envelope direction:

```ts
interface LocalProjectCandidateInspection {
  inspectedAt: string
  rootDir: string
  kind: 'workspace-backed' | 'local-sce-candidate' | 'directory-candidate' | 'invalid'
  projectId?: string
  workspaceId?: string
  projectName?: string
  appKey?: string
  readiness: 'ready' | 'partial' | 'pending' | 'blocked' | 'unknown'
  availability: 'accessible' | 'inaccessible' | 'degraded'
  localCandidate: boolean
  reasonCodes: string[]
}
```

### Root-Based Onboarding

SCE should expose one write contract conceptually equivalent to:

- `sce project onboarding import --root <path> --json`

The result envelope should reuse the canonical onboarding step/result semantics from `131-00` instead of inventing a separate adapter-only format.

## Boundary

Adapter-owned:

- choosing scan roots
- scanning local filesystem for `.sce` markers
- remembering pinned/manual roots
- deciding when to call inspect

Engine-owned:

- canonical interpretation of one root directory
- canonical reason codes
- canonical onboarding step semantics
- mapping a root to existing project/workspace identity when available

## Identity Rules

- if the root already resolves to a workspace-backed project, reuse `135-01` identity
- if the root is only a local `.sce` project, mark it local/partial
- do not create a second persistent project registry just for candidate roots

## Requirement Mapping

- Requirement 1 -> candidate inspection contract
- Requirement 2 -> root-based onboarding entry
- Requirement 3 -> engine/adapter ownership split
- Requirement 4 -> identity alignment with `135-01`
- Requirement 5 -> reason-code publication
