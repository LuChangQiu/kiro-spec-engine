# Interactive Customization Contracts

This directory contains baseline contracts and safety policy artifacts for the interactive business customization model.

## Files

- `change-intent.schema.json`: schema for business-level change intents generated from UI copilot conversations.
- `change-plan.schema.json`: schema for structured change plans (scope, risk, checks, rollback).
- `execution-record.schema.json`: schema for execution/audit records.
- `guardrail-policy-baseline.json`: default secure-by-default guardrail policy.
- `high-risk-action-catalog.json`: baseline high-risk action classification for deny/review decisions.
- `change-plan.sample.json`: runnable sample plan for gate checks.

## Usage

Validate a plan against guardrails:

```bash
node scripts/interactive-change-plan-gate.js \
  --plan docs/interactive-customization/change-plan.sample.json \
  --json
```

Use strict CI gating:

```bash
node scripts/interactive-change-plan-gate.js \
  --plan path/to/change-plan.json \
  --fail-on-non-allow \
  --json
```
