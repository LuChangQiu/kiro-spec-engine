# Adapter Extension Contract

This document defines the cross-stack adapter contract used to onboard new runtimes without changing core guardrail workflow.

## Purpose

- Keep `Change_Intent -> Change_Plan -> Gate -> Approval -> Apply -> Rollback` flow unchanged.
- Allow runtime-specific execution via adapter modules.
- Guarantee governance compatibility by contract instead of ad-hoc integration.

## Contract Artifacts

- Schema: `docs/interactive-customization/adapter-extension-contract.schema.json`
- Sample: `docs/interactive-customization/adapter-extension-contract.sample.json`

## Mandatory Sections

1. `capability_declaration`
- Declare supported change types.
- Declare runtime prerequisites.

2. `risk_declaration`
- Declare default execution mode (`suggestion` or `apply`).
- Declare auto-apply risk levels.
- Declare blocked action types.

3. `interfaces`
- Must implement:
  - `capabilities()`
  - `plan(changeIntent, context)`
  - `validate(changePlan)`
  - `apply(changePlan)`
  - `rollback(executionId)`

4. `compliance`
- Must declare compatibility with:
  - guardrail policy
  - approval workflow
  - rollback support
- Must declare audit record schema linkage.

## Runtime Integration Rules

- Adapter must not bypass policy gate.
- Adapter must not bypass approval state machine for review/high risk plans.
- Adapter must emit execution records compatible with:
  - `docs/interactive-customization/execution-record.schema.json`

## Conformance Checklist

- Contract JSON validates against extension schema.
- `validate()` returns `allow | review-required | deny`.
- `apply()` writes execution record and append-only ledger.
- `rollback()` writes rollback execution record linked by `rollback_ref`.
- High-risk destructive actions stay blocked by default.
