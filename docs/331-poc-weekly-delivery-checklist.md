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
  - `.sce/templates/exports/<template-name>/`
- Handoff package:
  - `docs/handoffs/handoff-manifest.json`
  - ontology validation evidence in the same batch window

## Mandatory Quality Constraints

- `specs[]` is non-empty.
- `templates[]` is non-empty.
- `ontology_validation` exists and is recent.
- Dependency relations (`depends_on`) are present for multi-spec batches.
- High-risk gaps have mitigation notes.
- Security-governance baseline is enforced (`docs/security-governance-default-baseline.md`).
- Moqui baseline matrix has no hard-gate regressions:
  - `compare.coverage_matrix_regressions.length == 0`
  - `summary.coverage_matrix.baseline_passed.rate_percent == 100`
- Capability lexicon has no unknown aliases:
  - `summary.expected_unknown_count == 0`
  - `summary.provided_unknown_count == 0`

## sce Acceptance Commands

```bash
npx sce auto handoff run --manifest ../331-poc/docs/handoffs/handoff-manifest.json \\
  --min-spec-success-rate 95 \\
  --max-risk-level medium \\
  --json

npx sce auto handoff template-diff --manifest ../331-poc/docs/handoffs/handoff-manifest.json --json
npx sce auto handoff regression --session-id latest --json
npx sce auto handoff capability-matrix --manifest ../331-poc/docs/handoffs/handoff-manifest.json --fail-on-gap --json
npx sce scene moqui-baseline --compare-with .sce/reports/release-evidence/moqui-template-baseline-prev.json --fail-on-portfolio-fail --json
node scripts/moqui-lexicon-audit.js --manifest ../331-poc/docs/handoffs/handoff-manifest.json --fail-on-gap --json
node scripts/moqui-release-summary.js --fail-on-gate-fail --json
node scripts/release-ops-weekly-summary.js --json
node scripts/release-weekly-ops-gate.js
node scripts/release-risk-remediation-bundle.js --gate-report .sce/reports/release-evidence/release-gate.json --json
node scripts/release-asset-integrity-check.js
```

## Scene Package Gate Commands

```bash
npx sce scene package-registry --template-dir .sce/templates/scene-packages --strict --json
npx sce scene package-gate-template --out .sce/templates/scene-package-gate-policy.json --profile three-layer --force --json
npx sce scene package-gate --registry .sce/templates/scene-packages/registry.json --policy .sce/templates/scene-package-gate-policy.json --strict --json
```

## Batch Exit Criteria

- No strict validation error.
- Ontology graph is valid and traceable.
- Close-loop execution is successful for the batch.
- Evidence snapshot is archived and linked to release notes.
