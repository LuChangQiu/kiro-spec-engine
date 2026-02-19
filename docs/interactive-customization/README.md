# Interactive Customization Contracts

This directory contains baseline contracts and safety policy artifacts for the interactive business customization model.

## Files

- `change-intent.schema.json`: schema for business-level change intents generated from UI copilot conversations.
- `change-plan.schema.json`: schema for structured change plans (scope, risk, checks, rollback).
- `execution-record.schema.json`: schema for execution/audit records.
- `page-context.schema.json`: schema for page-level read-only context payloads.
- `guardrail-policy-baseline.json`: default secure-by-default guardrail policy.
- `high-risk-action-catalog.json`: baseline high-risk action classification for deny/review decisions.
- `change-plan.sample.json`: runnable sample plan for gate checks.
- `page-context.sample.json`: runnable page context sample for read-only intent generation.
- `moqui-copilot-context-contract.json`: Moqui page context contract + security boundary baseline.
- `moqui-copilot-integration-guide.md`: stage-A Moqui integration guide for page-level copilot embedding.
- `moqui-adapter-interface.md`: stage-C Moqui adapter contract (`capabilities/plan/validate/apply/rollback`).

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

Build read-only change intent from page context:

```bash
node scripts/interactive-intent-build.js \
  --context docs/interactive-customization/page-context.sample.json \
  --goal "Must improve order approval speed without changing payment authorization policy" \
  --user-id demo-user \
  --json
```

Generate a change plan from intent (suggestion stage):

```bash
node scripts/interactive-plan-build.js \
  --intent .kiro/reports/interactive-change-intent.json \
  --context docs/interactive-customization/page-context.sample.json \
  --json
```

Run approval workflow state machine:

```bash
# init from generated plan
node scripts/interactive-approval-workflow.js \
  --action init \
  --plan .kiro/reports/interactive-change-plan.generated.json \
  --actor product-owner \
  --json

# submit -> approve -> execute -> verify
node scripts/interactive-approval-workflow.js --action submit --actor product-owner --json
node scripts/interactive-approval-workflow.js --action approve --actor security-admin --json
node scripts/interactive-approval-workflow.js --action execute --actor release-operator --json
node scripts/interactive-approval-workflow.js --action verify --actor qa-owner --json
```

Run the Moqui adapter interface (`capabilities/plan/validate/apply/rollback`):

```bash
# show adapter capability + risk declaration
node scripts/interactive-moqui-adapter.js \
  --action capabilities \
  --json

# build plan from intent through adapter contract
node scripts/interactive-moqui-adapter.js \
  --action plan \
  --intent .kiro/reports/interactive-change-intent.json \
  --execution-mode suggestion \
  --json

# validate/apply with policy gate and execution record output
node scripts/interactive-moqui-adapter.js \
  --action validate \
  --plan .kiro/reports/interactive-change-plan.adapter.json \
  --json
node scripts/interactive-moqui-adapter.js \
  --action apply \
  --plan .kiro/reports/interactive-change-plan.adapter.json \
  --json

# rollback by execution id from execution ledger
node scripts/interactive-moqui-adapter.js \
  --action rollback \
  --execution-id exec-xxxx \
  --json
```

Execution artifacts:

- Latest execution record: `.kiro/reports/interactive-execution-record.latest.json`
- Append-only execution ledger: `.kiro/reports/interactive-execution-ledger.jsonl`
