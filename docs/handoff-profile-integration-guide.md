# Handoff Profile Integration Guide

This guide defines a stable external integration contract for `sce auto handoff` profile-based intake.

## Scope

- Profile-based defaults for:
  - `sce auto handoff run`
  - `sce auto handoff capability-matrix`
- Explicit override model for external projects.
- Recommended baseline for Moqui-driven template intake.

## Available Profiles

| Profile | Use Case | Default Policy Characteristics |
| --- | --- | --- |
| `default` | General handoff intake | Current strict baseline gates. |
| `moqui` | Moqui template-core ingestion | Explicit alias of strict Moqui baseline gates. |
| `enterprise` | Production-grade controlled rollout | `max-risk-level=medium`, `require-release-gate-preflight=true`, `release-evidence-window=10`. |

Notes:

- Profile defaults are applied first.
- Explicit CLI options always override profile defaults.
- Invalid profile values fail fast.

## Command Contract

```bash
# capability matrix precheck
sce auto handoff capability-matrix \
  --manifest docs/handoffs/handoff-manifest.json \
  --profile moqui \
  --fail-on-gap \
  --json

# full closed-loop intake
sce auto handoff run \
  --manifest docs/handoffs/handoff-manifest.json \
  --profile moqui \
  --json
```

Enterprise mode:

```bash
sce auto handoff run \
  --manifest docs/handoffs/handoff-manifest.json \
  --profile enterprise \
  --json
```

## External Project Manifest Requirements

External handoff projects should provide:

- `templates[]`: source template set to absorb.
- `specs[]`: executable integration scope.
- `ontology_validation`: structured pass/fail payload.
- `capabilities[]` (recommended): explicit expected capability contract.

Recommended evidence files before `handoff run`:

- `.sce/reports/release-evidence/moqui-template-baseline.json`
- `.sce/reports/handoff-capability-matrix.json` or `.md`
- `.sce/reports/release-evidence/moqui-lexicon-audit.json`

## Override Rules

Examples:

```bash
# profile defaults + explicit override
sce auto handoff run \
  --manifest docs/handoffs/handoff-manifest.json \
  --profile enterprise \
  --max-risk-level high \
  --no-require-release-gate-preflight \
  --json
```

`--profile enterprise` applies strict defaults, then explicit flags above override them.

## Recommended External Rollout

1. Start with `--profile moqui` for template sedimentation and matrix closure.
2. Move to `--profile enterprise` when release preflight governance is ready.
3. Keep explicit overrides minimal and auditable in CI scripts.
