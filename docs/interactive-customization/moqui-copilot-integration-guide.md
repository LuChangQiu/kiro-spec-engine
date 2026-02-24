# Moqui Copilot Integration Guide (Stage A)

This guide defines the page-level integration pattern for embedding the SCE Business Copilot into a customized Moqui product.

## Goal

Provide a deterministic and secure context bridge so non-technical users can describe business goals in UI, while backend automation remains read-only at this stage.

## Integration Model

```text
Moqui Page -> Context Provider -> interactive-context-bridge -> Masking Filter -> Copilot Panel -> interactive-intent-build
```

At stage A:

- Copilot is read-only.
- No write action is executed from the panel.
- Output artifacts are `Change_Intent`, explain markdown, and audit JSONL.

## Context Provider Contract

Reference file:

- `docs/interactive-customization/moqui-copilot-context-contract.json`

Minimum payload fields:

1. `product`
2. `module`
3. `page`

Optional but recommended:

1. `entity`
2. `scene_id`
3. `workflow_node`
4. `fields[]`
5. `current_state`
6. `scene_workspace` (screen explorer + ontology snapshot)
7. `assistant_panel` (AI panel session/model metadata)

Schema:

- `docs/interactive-customization/page-context.schema.json`

## Security Boundary

1. Provider must apply key-based masking for sensitive fields before sending context to Copilot.
2. Forbidden keys must be removed completely, not masked.
3. Copilot requests must run under read-only runtime identity.
4. Generated outputs are stored in report paths only, never direct code/runtime mutation.

## Suggested Moqui Hook Points

1. Build a page context object from screen/form state in controller/render pipeline.
2. Pass provider payload to `interactive-context-bridge` and store normalized page-context artifact.
3. Pass sanitized context to frontend Copilot panel via JSON endpoint or embedded script tag payload.
4. Trigger `interactive-intent-build` with user goal + sanitized context.

## Bridge Command

```bash
node scripts/interactive-context-bridge.js \
  --input docs/interactive-customization/moqui-context-provider.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --json
```

## One-Command Flow

```bash
node scripts/interactive-flow.js \
  --input docs/interactive-customization/moqui-context-provider.sample.json \
  --goal "Adjust order screen field layout for clearer input flow" \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --execution-mode apply \
  --auto-execute-low-risk \
  --feedback-score 5 \
  --json
```

## Example Command

```bash
node scripts/interactive-intent-build.js \
  --context docs/interactive-customization/page-context.sample.json \
  --context-contract docs/interactive-customization/moqui-copilot-context-contract.json \
  --goal "Must improve approval speed without changing payment authorization policy" \
  --user-id product-owner \
  --json
```

## Acceptance Checklist

1. Context payload validates against schema.
2. Context contract gate passes (required fields + payload size + forbidden keys).
3. Sensitive keys are masked or removed.
4. Copilot outputs contain `readonly=true`.
5. Audit event is appended to `.sce/reports/interactive-copilot-audit.jsonl`.
