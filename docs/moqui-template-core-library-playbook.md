# Moqui Template Core Library Playbook

This playbook defines a generic (project-agnostic) path to absorb Moqui capabilities into the sce core template library.

## Objectives

- Turn Moqui business capabilities into reusable `scene-package` templates.
- Enforce ontology quality as a default gate (no project-specific flags required).
- Keep evidence output stable for release and regression review.

## Default Gate Baseline

sce defaults already enforce the baseline below:

- `sce auto handoff run`: ontology validation is required by default.
- `sce auto handoff run`: generates Moqui baseline snapshot by default and appends it to release-evidence sessions.
- `sce auto handoff run`: requires Moqui baseline portfolio pass by default.
- `sce auto handoff run`: evaluates capability coverage matrix by default when manifest `capabilities` is declared (default minimum `100%`).
- `sce auto handoff capability-matrix`: enforces both capability coverage and capability semantic completeness (default minimum `100%` for each).
- `sce scene package-publish-batch`:
  - ontology validation required by default
  - batch ontology gate defaults:
    - average ontology score `>= 70`
    - ontology valid-rate `>= 100%`

Emergency bypass exists but is not recommended:

- `--no-require-ontology-validation`
- `--no-require-moqui-baseline`
- `--no-require-capability-coverage`

## One-Shot Intake Flow

```bash
# 0) Generate template baseline scoreboard (Moqui + scene orchestration templates by default)
sce scene moqui-baseline --json

# 0.1) CI/release mode: compare against previous baseline and enforce portfolio gate
sce scene moqui-baseline \
  --compare-with .kiro/reports/release-evidence/moqui-template-baseline-prev.json \
  --fail-on-portfolio-fail \
  --json

# 0.2) Fast capability matrix gate (recommended before full handoff run)
sce auto handoff capability-matrix \
  --manifest docs/handoffs/handoff-manifest.json \
  --format markdown \
  --out .kiro/reports/handoff-capability-matrix.md \
  --fail-on-gap \
  --json

# 1) Handoff close-loop
sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --json

# 2) Publish templates from scene packages (with default ontology gates)
sce scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --json

# 3) Persist ontology publish evidence for governance/review
sce scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --dry-run \
  --ontology-report-out .kiro/reports/scene-package-ontology-batch.json \
  --json

# 4) Validate registry + package gate
sce scene package-registry --template-dir .kiro/templates/scene-packages --strict --json
sce scene package-gate-template --out .kiro/templates/scene-package-gate-policy.json --profile three-layer --force --json
sce scene package-gate --registry .kiro/templates/scene-packages/registry.json --policy .kiro/templates/scene-package-gate-policy.json --strict --json
```

## Evidence Contract

Required artifacts for each intake batch:

- `.kiro/reports/moqui-template-baseline.json`
- `.kiro/reports/moqui-template-baseline.md`
- `.kiro/reports/release-evidence/moqui-template-baseline.json`
- `.kiro/reports/release-evidence/moqui-template-baseline.md`
- `.kiro/reports/release-evidence/moqui-capability-coverage.json`
- `.kiro/reports/release-evidence/moqui-capability-coverage.md`
- `.kiro/reports/handoff-capability-matrix.md` (or JSON equivalent from `sce auto handoff capability-matrix`)
- `.kiro/reports/handoff-runs/<session>.json`
- `.kiro/reports/scene-package-ontology-batch.json`
- `.kiro/auto/moqui-remediation.lines` (when baseline/coverage gaps exist)
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
sce scene package-publish-batch \
  --manifest docs/handoffs/handoff-manifest.json \
  --dry-run \
  --ontology-task-queue-out .kiro/auto/ontology-remediation.lines \
  --json

sce auto close-loop-batch .kiro/auto/ontology-remediation.lines --format lines --json
```
