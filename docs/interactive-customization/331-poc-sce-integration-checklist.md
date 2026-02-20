# 331-poc SCE Integration Checklist

This checklist defines the minimum production-ready integration for embedding SCE interactive customization in `331-poc` (Moqui-focused solution).

## 1. Runtime Preconditions

- Node runtime: `>=16` (recommended `20.x`).
- SCE installed and available as `sce`.
- `docs/interactive-customization/moqui-copilot-context-contract.json` exists and is aligned with current UI payload fields.
- Interactive policy assets are present:
  - `docs/interactive-customization/guardrail-policy-baseline.json`
  - `docs/interactive-customization/high-risk-action-catalog.json`

## 2. Moqui UI Context Contract

Provider payload sent from UI must include:

- `product`, `workspace.module`, `workspace.page`
- `workspace.scene` (id/name/type)
- `workspace.ontology`:
  - `entities`
  - `relations`
  - `business_rules`
  - `decision_policies`
- `current_state` (masked/sanitized)
- `assistant.sessionId`

Hard rules:

- No plaintext secrets.
- No forbidden keys from context contract (for example `private_key`).
- Payload size must stay within contract limits.

## 3. Default One-Command Execution

Use this command as the default integration path:

```bash
sce scene interactive-flow \
  --input <provider-payload.json> \
  --goal "<business goal>" \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --execution-mode apply \
  --auto-execute-low-risk \
  --feedback-score 5 \
  --json
```

Notes:

- Matrix stage is enabled by default.
- Keep `--no-matrix` only for diagnostics.

## 4. Governance and Gate Defaults

Run governance gate on schedule and pre-release:

```bash
node scripts/interactive-governance-report.js --period weekly --fail-on-alert --json
```

Run matrix regression gate in release pipeline (configurable):

```bash
node scripts/matrix-regression-gate.js \
  --baseline .kiro/reports/release-evidence/moqui-template-baseline.json \
  --max-regressions 0 \
  --enforce \
  --json
```

Recommended GitHub Variables:

- `KSE_MATRIX_REGRESSION_GATE_ENFORCE=true`
- `KSE_MATRIX_REGRESSION_GATE_MAX=0`
- `KSE_MOQUI_RELEASE_SUMMARY_ENFORCE=true` (optional hard gate for release summary `failed` state)

## 5. Evidence Artifacts (Must Keep)

- `.kiro/reports/interactive-governance-report.json`
- `.kiro/reports/interactive-governance-report.md`
- `.kiro/reports/interactive-matrix-signals.jsonl`
- `.kiro/reports/release-evidence/moqui-template-baseline.json`
- `.kiro/reports/release-evidence/matrix-regression-gate-<tag>.json`
- `.kiro/reports/release-evidence/matrix-remediation-plan-<tag>.json`
- `.kiro/reports/release-evidence/matrix-remediation-<tag>.lines`

## 6. Pass Criteria

- `interactive-flow.summary.status` is `completed` or `ready-for-apply` by policy.
- Governance summary status is `ok` (no medium/high breach).
- Matrix regression gate status is `passed` (or enforced policy satisfied).
- Release summary status is `passed` or explicitly approved when `incomplete`.

## 7. Remediation Loop

When matrix regressions are detected:

```bash
node scripts/moqui-matrix-remediation-queue.js \
  --baseline .kiro/reports/release-evidence/moqui-template-baseline.json \
  --lines-out .kiro/auto/matrix-remediation.lines \
  --json

sce auto close-loop-batch .kiro/auto/matrix-remediation.lines --json
```
