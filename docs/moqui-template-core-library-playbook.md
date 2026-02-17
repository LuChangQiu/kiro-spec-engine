# Moqui Template Core Library Playbook

This playbook defines a generic (project-agnostic) path to absorb Moqui capabilities into the KSE core template library.

## Objectives

- Turn Moqui business capabilities into reusable `scene-package` templates.
- Enforce ontology quality as a default gate (no project-specific flags required).
- Keep evidence output stable for release and regression review.

## Default Gate Baseline

KSE defaults already enforce the baseline below:

- `kse auto handoff run`: ontology validation is required by default.
- `kse scene package-publish-batch`:
  - ontology validation required by default
  - batch ontology gate defaults:
    - average ontology score `>= 70`
    - ontology valid-rate `>= 100%`

Emergency bypass exists but is not recommended:

- `--no-require-ontology-validation`

## One-Shot Intake Flow

```bash
# 0) Generate template baseline scoreboard (Moqui/ERP templates by default)
node scripts/moqui-template-baseline-report.js --json

# 1) Handoff close-loop
kse auto handoff run --manifest docs/handoffs/handoff-manifest.json --json

# 2) Publish templates from scene packages (with default ontology gates)
kse scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --json

# 3) Persist ontology publish evidence for governance/review
kse scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --dry-run \
  --ontology-report-out .kiro/reports/scene-package-ontology-batch.json \
  --json

# 4) Validate registry + package gate
kse scene package-registry --template-dir .kiro/templates/scene-packages --strict --json
kse scene package-gate-template --out .kiro/templates/scene-package-gate-policy.json --profile three-layer --force --json
kse scene package-gate --registry .kiro/templates/scene-packages/registry.json --policy .kiro/templates/scene-package-gate-policy.json --strict --json
```

## Evidence Contract

Required artifacts for each intake batch:

- `.kiro/reports/moqui-template-baseline.json`
- `.kiro/reports/moqui-template-baseline.md`
- `.kiro/reports/handoff-runs/<session>.json`
- `.kiro/reports/scene-package-ontology-batch.json`
- `.kiro/templates/scene-packages/registry.json`
- gate output/evidence linked from release notes or handoff summary

## Minimum Semantic Coverage

Each accepted template should include ontology semantics for:

- entity model
- relation graph
- business rules
- decision logic

If any area is weak, export remediation queue lines and feed back to close-loop:

```bash
kse scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --dry-run \
  --ontology-task-queue-out .kiro/auto/ontology-remediation.lines \
  --json

kse auto close-loop-batch .kiro/auto/ontology-remediation.lines --format lines --json
```
