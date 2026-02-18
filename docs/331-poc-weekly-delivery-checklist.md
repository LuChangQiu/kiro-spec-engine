# 331-poc Weekly Delivery Checklist (For sce Integration)

Use this checklist before each integration batch.

## Required Inputs From 331-poc

- Complete spec bundle for each target spec:
  - `requirements.md`
  - `design.md`
  - `tasks.md`
  - `custom/scene.yaml`
  - `custom/scene-package.json`
- Exported template folder:
  - `.kiro/templates/exports/<template-name>/`
- Handoff package:
  - `docs/handoffs/handoff-manifest.json`
  - ontology validation evidence in the same batch window

## Mandatory Quality Constraints

- `specs[]` is non-empty.
- `templates[]` is non-empty.
- `ontology_validation` exists and is recent.
- Dependency relations (`depends_on`) are present for multi-spec batches.
- High-risk gaps have mitigation notes.

## sce Acceptance Commands

```bash
npx sce auto handoff run --manifest ../331-poc/docs/handoffs/handoff-manifest.json \\
  --min-spec-success-rate 95 \\
  --max-risk-level medium \\
  --json

npx sce auto handoff template-diff --manifest ../331-poc/docs/handoffs/handoff-manifest.json --json
npx sce auto handoff regression --session-id latest --json
```

## Scene Package Gate Commands

```bash
npx sce scene package-registry --template-dir .kiro/templates/scene-packages --strict --json
npx sce scene package-gate-template --out .kiro/templates/scene-package-gate-policy.json --profile three-layer --force --json
npx sce scene package-gate --registry .kiro/templates/scene-packages/registry.json --policy .kiro/templates/scene-package-gate-policy.json --strict --json
```

## Batch Exit Criteria

- No strict validation error.
- Ontology graph is valid and traceable.
- Close-loop execution is successful for the batch.
- Evidence snapshot is archived and linked to release notes.
