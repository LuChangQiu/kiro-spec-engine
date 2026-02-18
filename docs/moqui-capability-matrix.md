# Moqui Capability Matrix For sce

This document defines the execution boundary for converting Moqui capabilities into sce capabilities.

## Scope

- Goal: turn Moqui ERP resources into reusable sce scene templates.
- Method: `extract -> normalize -> package-gate -> handoff-run -> release evidence`.
- Output: template assets with ontology, governance, and runtime-safe bindings.

## Capability Mapping

| Priority | Moqui Capability | sce Scene Pattern | Template ID | Ontology Anchors | Governance/Gate Focus | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Order read (`OrderHeader`, `OrderItem`, query services) | `query` | `sce.scene--erp-order-query-read--0.1.0` | `order_header`, `order_item`, `order_projection`, `customer_party` | low risk, idempotent query, lineage complete | template-ready |
| P0 | Order fulfillment (reserve, payment, release) | `workflow` | `sce.scene--erp-order-fulfillment-workflow--0.1.0` | `order_header`, `order_item`, `inventory_reservation`, `payment_authorization`, `fulfillment_execution` | medium risk, approval required, compensation strategy | template-ready |
| P0 | Inventory reserve + adjust | `workflow/crud hybrid` | `sce.scene--erp-inventory-reserve-adjust--0.1.0` | `inventory_item`, `inventory_reservation`, `inventory_adjustment`, `inventory_snapshot` | medium risk, approval required, non-negative stock rule | template-ready |

## Ownership Boundary

### 331-poc owns

- Business truth and domain semantics.
- Complete specs (`requirements/design/tasks`) and scene manifests.
- Handoff package (`docs/handoffs/handoff-manifest.json`) and ontology evidence.
- Real-world acceptance cases and risk context.

### sce owns

- Template contract normalization and packaging format.
- Ontology/gate enforcement and strict checks.
- Runtime routing, fallback behavior, and retry resilience.
- Close-loop orchestration and release evidence aggregation.

## Batch Workflow

1. 331-poc exports spec/template/handoff artifacts.
2. sce runs `auto handoff capability-matrix` as the fast intake gate.
3. sce runs `auto handoff run` with strict gates.
4. sce validates template registry and ontology consistency.
5. sce executes close-loop batch and snapshots observability.
6. sce archives evidence and publishes release.

## Fast Matrix Loop

Use this command during template iteration before full handoff execution:

```bash
sce auto handoff capability-matrix \
  --manifest docs/handoffs/handoff-manifest.json \
  --format markdown \
  --out .kiro/reports/handoff-capability-matrix.md \
  --fail-on-gap \
  --json
```

`capability-matrix` now checks both capability coverage and semantic completeness (ontology entities/relations + governance business rules/decision logic) by default.

When gaps exist, sce writes remediation queue lines (default `.kiro/auto/moqui-remediation.lines`) that can be fed directly into:

```bash
sce auto close-loop-batch .kiro/auto/moqui-remediation.lines --format lines --json
```

## Definition Of Done

A capability is considered absorbed by sce when all checks pass:

- `sce scene package-validate --strict`
- `sce scene lint --strict`
- `sce scene score --threshold 85`
- `sce scene ontology validate`
- `sce auto handoff run`
