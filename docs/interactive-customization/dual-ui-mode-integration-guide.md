# Dual UI Mode Integration Guide

This guide maps two UI surfaces to SCE interactive governance behavior.

## 1. Target Surfaces

- `user-app`: end-user business operation UI.
- `ops-console`: maintenance and new-requirement management UI.

## 2. Default Governance Mapping

- `user-app`
  - Recommended dialogue profile: `business-user`
  - Recommended execution mode: `suggestion`
  - Apply intent is denied by authorization dialogue policy by default.
- `ops-console`
  - Recommended dialogue profile: `system-maintainer`
  - Execution mode: `suggestion|apply` (subject to runtime/authorization-tier/approval gates)

## 3. Runtime Integration Pattern

Use the same backend flow and switch only mode/profile by surface:

```bash
# user-facing application UI
sce scene interactive-flow \
  --input <provider-payload.json> \
  --goal "<business-goal>" \
  --ui-mode user-app \
  --dialogue-profile business-user \
  --execution-mode suggestion \
  --json

# operations / maintenance console
sce scene interactive-flow \
  --input <provider-payload.json> \
  --goal "<maintenance-goal>" \
  --ui-mode ops-console \
  --dialogue-profile system-maintainer \
  --execution-mode apply \
  --runtime-environment staging \
  --auto-execute-low-risk \
  --json
```

## 4. UI Rendering Contract

Read these fields from loop/flow output:

- `summary.ui_mode`
- `summary.dialogue_authorization_decision`
- `summary.authorization_tier_decision`
- `summary.execution_block_reason_category`
- `summary.execution_block_remediation_hint`

Recommended rendering:

- `dialogue_authorization_decision=deny`: block execute button and show guided fallback.
- `dialogue_authorization_decision=review-required`: show review handoff panel.
- `authorization_tier_decision=allow` and runtime/gate allow: enable guarded apply action.

## 5. Runtime UI-Mode Contract (Default)

`runtime-mode-policy-baseline.json` now includes `ui_modes` policy:

- `user-app`
  - `allow_execution_modes=["suggestion"]`
  - `deny_execution_modes=["apply"]`
  - Apply intents should switch to `ops-console`.
- `ops-console`
  - `allow_execution_modes=["suggestion","apply"]`
  - Supports maintenance/apply flows with approval and authorization-tier gates.

When evaluating runtime policy directly, pass `--ui-mode`:

```bash
node scripts/interactive-runtime-policy-evaluate.js \
  --plan .sce/reports/interactive-change-plan.generated.json \
  --ui-mode user-app \
  --runtime-mode ops-fix \
  --runtime-environment staging \
  --json
```

## 6. Audit and Compliance

For both modes, persist:

- work-order (`interactive-work-order.json|.md`)
- approval events (`interactive-approval-events.jsonl`)
- execution ledger (`interactive-execution-ledger.jsonl`)
- authorization-tier signals (`interactive-authorization-tier-signals.jsonl`)
