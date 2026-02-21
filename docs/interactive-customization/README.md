# Interactive Customization Contracts

This directory contains baseline contracts and safety policy artifacts for the interactive business customization model.

## Files

- `change-intent.schema.json`: schema for business-level change intents generated from UI copilot conversations.
- `change-plan.schema.json`: schema for structured change plans (scope, risk, checks, rollback).
- `execution-record.schema.json`: schema for execution/audit records.
- `page-context.schema.json`: schema for page-level read-only context payloads.
- `guardrail-policy-baseline.json`: default secure-by-default guardrail policy.
- `dialogue-governance-policy-baseline.json`: baseline communication rules for embedded assistant dialogue.
- `runtime-mode-policy-baseline.json`: baseline runtime mode/environment policy (`user-assist|ops-fix|feature-dev` x `dev|staging|prod`).
- `approval-role-policy-baseline.json`: optional approval role policy baseline (`submit/approve/execute/verify/archive` role requirements).
- `high-risk-action-catalog.json`: baseline high-risk action classification for deny/review decisions.
- `change-plan.sample.json`: runnable sample plan for gate checks.
- `page-context.sample.json`: runnable page context sample for read-only intent generation.
- `moqui-context-provider.sample.json`: sample raw payload from Moqui workbench context provider (before normalization).
- `moqui-copilot-context-contract.json`: Moqui page context contract + security boundary baseline.
- `moqui-copilot-integration-guide.md`: stage-A Moqui integration guide for page-level copilot embedding.
- `moqui-adapter-interface.md`: stage-C Moqui adapter contract (`capabilities/plan/validate/apply/rollback`).
- `moqui-interactive-template-playbook.md`: stage-D template sedimentation playbook for Moqui interactive loop.
- `adapter-extension-contract.schema.json`: cross-stack adapter extension contract schema.
- `adapter-extension-contract.sample.json`: adapter extension contract sample payload.
- `adapter-extension-contract.md`: adapter extension contract guide and conformance checklist.
- `domain-pack-extension-flow.md`: Domain_Pack extension flow for cross-industry replication.
- `governance-threshold-baseline.json`: governance KPI threshold baseline for alerting.
- `governance-report-template.md`: periodic governance report template.
- `governance-alert-playbook.md`: threshold breach response workflow.
- `phase-acceptance-evidence.md`: stage A/B/C/D acceptance evidence checklist.
- `non-technical-usability-report.md`: business-user usability assessment and improvement backlog.
- `cross-industry-replication-guide.md`: replication boundary and rollout sequence beyond Moqui.
- `331-poc-sce-integration-checklist.md`: minimal production checklist for embedding SCE interactive flow in 331-poc.

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

Normalize Moqui workbench payload into standard page-context:

```bash
node scripts/interactive-context-bridge.js \
  --input docs/interactive-customization/moqui-context-provider.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --json
```

Bridge output defaults:

- Normalized page-context: `.kiro/reports/interactive-page-context.normalized.json`
- Bridge report: `.kiro/reports/interactive-context-bridge.json`

Run one-command full flow (bridge -> loop):

```bash
node scripts/interactive-flow.js \
  --input docs/interactive-customization/moqui-context-provider.sample.json \
  --goal "Adjust order screen field layout for clearer input flow" \
  --runtime-mode ops-fix \
  --runtime-environment staging \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --dialogue-policy docs/interactive-customization/dialogue-governance-policy-baseline.json \
  --runtime-policy docs/interactive-customization/runtime-mode-policy-baseline.json \
  --execution-mode apply \
  --auto-execute-low-risk \
  --auth-password-hash "<sha256-of-demo-pass>" \
  --auth-password "demo-pass" \
  --feedback-score 5 \
  --json
```

Matrix stage behavior (enabled by default in `interactive-flow`):

- Runs `moqui-template-baseline-report` after loop stage to snapshot template matrix status.
- Writes session artifacts and appends a global matrix signal stream.
- Use `--no-matrix` to disable this stage for diagnostics.

Common matrix flags:

- `--matrix-min-score <0..100>`
- `--matrix-min-valid-rate <0..100>`
- `--matrix-compare-with <path>`
- `--matrix-signals <path>`
- `--matrix-fail-on-portfolio-fail`
- `--matrix-fail-on-regression`

Flow output defaults:

- Flow summary: `.kiro/reports/interactive-flow/<session-id>/interactive-flow.summary.json`
- Bridge context: `.kiro/reports/interactive-flow/<session-id>/interactive-page-context.normalized.json`
- Loop summary: `.kiro/reports/interactive-flow/<session-id>/interactive-customization-loop.summary.json`
- Dialogue governance report: `.kiro/reports/interactive-flow/<session-id>/interactive-dialogue-governance.json`
- Matrix summary JSON: `.kiro/reports/interactive-flow/<session-id>/moqui-template-baseline.json`
- Matrix summary Markdown: `.kiro/reports/interactive-flow/<session-id>/moqui-template-baseline.md`
- Matrix signal stream: `.kiro/reports/interactive-matrix-signals.jsonl`
- Loop/flow summaries now include execution block diagnostics:
  - `summary.execution_block_reason_category` (`password-authorization|role-policy|runtime-policy|approval-policy|unknown`)
  - `summary.execution_block_remediation_hint` (human-readable fix hint)
  - `summary.authorization_execute_roles` (flow-level execute role requirements when role policy is enabled)

Build read-only change intent from page context:

```bash
node scripts/interactive-intent-build.js \
  --context docs/interactive-customization/page-context.sample.json \
  --goal "Must improve order approval speed without changing payment authorization policy" \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
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

Run dialogue governance (communication-rule check only):

```bash
node scripts/interactive-dialogue-governance.js \
  --goal "Improve order entry speed without changing payment policy" \
  --context docs/interactive-customization/page-context.sample.json \
  --policy docs/interactive-customization/dialogue-governance-policy-baseline.json \
  --json
```

Run one-command interactive loop (intent -> plan -> gate -> approval; optional low-risk apply):

```bash
# suggestion-first loop (no apply)
node scripts/interactive-customization-loop.js \
  --context docs/interactive-customization/page-context.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --goal "Improve order entry clarity for business users" \
  --json

# low-risk one-click apply loop
node scripts/interactive-customization-loop.js \
  --context docs/interactive-customization/page-context.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --goal "Adjust order screen field layout for clearer input flow" \
  --runtime-mode ops-fix \
  --runtime-environment staging \
  --runtime-policy docs/interactive-customization/runtime-mode-policy-baseline.json \
  --approval-role-policy docs/interactive-customization/approval-role-policy-baseline.json \
  --approval-actor-role product-owner \
  --approver-actor-role release-operator \
  --execution-mode apply \
  --auto-execute-low-risk \
  --auth-password-hash "<sha256-of-demo-pass>" \
  --auth-password "demo-pass" \
  --feedback-score 5 \
  --feedback-comment "Flow is clearer and faster." \
  --feedback-tags moqui,approval \
  --json

# CLI equivalent
sce scene interactive-loop \
  --context docs/interactive-customization/page-context.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --goal "Adjust order screen field layout for clearer input flow" \
  --execution-mode apply \
  --auto-execute-low-risk \
  --auth-password-hash "<sha256-of-demo-pass>" \
  --auth-password "demo-pass" \
  --feedback-score 5 \
  --json
```

`--feedback-score` writes feedback into both:
- Session artifact: `.kiro/reports/interactive-loop/<session-id>/interactive-user-feedback.jsonl`
- Governance global stream: `.kiro/reports/interactive-user-feedback.jsonl`
- Context contract validation is strict by default (required fields, payload size, forbidden keys). Use `--no-strict-contract` only for temporary diagnostics.
- `--execution-mode apply` with mutating actions requires password authorization by default (`plan.authorization.password_required=true`).
- Runtime policy defaults to `ops-fix@staging`; low-risk auto execute requires runtime decision `allow`.

Run runtime mode/environment policy evaluation directly:

```bash
node scripts/interactive-runtime-policy-evaluate.js \
  --plan .kiro/reports/interactive-change-plan.generated.json \
  --runtime-mode ops-fix \
  --runtime-environment staging \
  --policy docs/interactive-customization/runtime-mode-policy-baseline.json \
  --json
```

Build interactive work-order artifacts directly:

```bash
node scripts/interactive-work-order-build.js \
  --plan .kiro/reports/interactive-change-plan.generated.json \
  --dialogue .kiro/reports/interactive-dialogue-governance.json \
  --gate .kiro/reports/interactive-change-plan-gate.json \
  --runtime .kiro/reports/interactive-runtime-policy.json \
  --approval-state .kiro/reports/interactive-approval-state.json \
  --execution-attempted \
  --execution-result success \
  --execution-id exec-xxxx \
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
node scripts/interactive-approval-workflow.js --action approve --actor security-admin --actor-role security-admin --json
node scripts/interactive-approval-workflow.js --action execute --actor release-operator --actor-role release-operator --password "demo-pass" --json
node scripts/interactive-approval-workflow.js --action verify --actor qa-owner --actor-role qa-owner --json
```

When role control is required, initialize workflow with:
- `--role-policy docs/interactive-customization/approval-role-policy-baseline.json`
- and pass `--actor-role <role>` in each mutating action.

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

# one-click path: only accepts low-risk + allow decision
node scripts/interactive-moqui-adapter.js \
  --action low-risk-apply \
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
- Execution records include diff summary, gate decision, validation snapshot, and rollback reference.

Append business-user feedback for governance scoring:

```bash
node scripts/interactive-feedback-log.js \
  --score 5 \
  --comment "Approval flow is clearer and faster." \
  --user-id demo-user \
  --session-id session-20260219 \
  --intent-id intent-xxxx \
  --plan-id plan-xxxx \
  --execution-id exec-xxxx \
  --tags moqui,approval \
  --product moqui-suite \
  --module order \
  --page approval \
  --scene-id scene-moqui-interactive \
  --json
```

Generate governance KPI report and threshold alerts:

```bash
node scripts/interactive-governance-report.js \
  --period weekly \
  --json
```

The governance report consumes feedback events from `.kiro/reports/interactive-user-feedback.jsonl` by default.
The governance report also consumes matrix signals from `.kiro/reports/interactive-matrix-signals.jsonl` by default.
When `intent_total` is below `min_intent_samples` (default `5`), adoption emits a low-severity sample warning instead of a breach.

Export matrix regression remediation queue lines (for close-loop-batch):

```bash
node scripts/moqui-matrix-remediation-queue.js \
  --baseline .kiro/reports/release-evidence/moqui-template-baseline.json \
  --top-templates 5 \
  --lines-out .kiro/auto/matrix-remediation.lines \
  --batch-json-out .kiro/auto/matrix-remediation.goals.json \
  --commands-out .kiro/reports/release-evidence/matrix-remediation-commands.md \
  --json
```

Recommended anti-429 phased execution (default outputs):

```bash
sce auto close-loop-batch .kiro/auto/matrix-remediation.goals.high.json \
  --format json \
  --batch-parallel 1 \
  --batch-agent-budget 2 \
  --batch-retry-until-complete \
  --batch-retry-max-rounds 3 \
  --json

sleep 30

sce auto close-loop-batch .kiro/auto/matrix-remediation.goals.medium.json \
  --format json \
  --batch-parallel 1 \
  --batch-agent-budget 2 \
  --batch-retry-until-complete \
  --batch-retry-max-rounds 2 \
  --json
```

One-shot equivalent:

```bash
npm run run:matrix-remediation-phased -- --json
```

Zero-prep one-shot (prepare from baseline + run phased):

```bash
node scripts/moqui-matrix-remediation-phased-runner.js \
  --baseline .kiro/reports/release-evidence/moqui-template-baseline.json \
  --json

npm run run:matrix-remediation-from-baseline -- --json
```
