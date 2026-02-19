# Moqui Adapter Minimal Interface (Stage C)

This document defines the minimal adapter contract used by interactive customization execution in the Moqui experiment product.

## Interface

`capabilities()`
- Returns capability declaration (`supported_change_types`, risk statement, runtime behavior).

`plan(changeIntent, context)`
- Converts a `Change_Intent` into a structured `Change_Plan`.
- Output fields align with `change-plan.schema.json`.

`validate(changePlan)`
- Evaluates `Change_Plan` with guardrail policy + high-risk catalog.
- Decision: `allow | review-required | deny`.

`apply(changePlan)`
- Runs controlled execution after validation.
- Default behavior is safe simulation; live apply is opt-in.
- Produces `ExecutionRecord` and appends execution ledger.

`applyLowRisk(changePlan)`
- One-click execution entry for stage-C.
- Requires `risk_level=low` and policy decision `allow`, otherwise blocks with `ExecutionRecord(result=skipped)`.

`rollback(executionId)`
- Generates rollback execution record for a previous execution.
- Keeps append-only audit behavior.

## Reference Implementation

- Runtime module: `lib/interactive-customization/moqui-interactive-adapter.js`
- Script entry: `scripts/interactive-moqui-adapter.js`
- Validation core: `lib/interactive-customization/change-plan-gate-core.js`

## Artifacts

- Latest execution record: `.kiro/reports/interactive-execution-record.latest.json`
- Execution ledger (JSONL): `.kiro/reports/interactive-execution-ledger.jsonl`
