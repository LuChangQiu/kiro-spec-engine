# Moqui Capability Matrix For KSE

This document defines the execution boundary for converting Moqui capabilities into KSE capabilities.

## Scope

- Goal: turn Moqui ERP resources into reusable KSE scene templates.
- Method: `extract -> normalize -> package-gate -> handoff-run -> release evidence`.
- Output: template assets with ontology, governance, and runtime-safe bindings.

## Capability Mapping

| Priority | Moqui Capability | KSE Scene Pattern | Template ID | Ontology Anchors | Governance/Gate Focus | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Order read (`OrderHeader`, `OrderItem`, query services) | `query` | `kse.scene--erp-order-query-read--0.1.0` | `order_header`, `order_item`, `order_projection`, `customer_party` | low risk, idempotent query, lineage complete | template-ready |
| P0 | Order fulfillment (reserve, payment, release) | `workflow` | `kse.scene--erp-order-fulfillment-workflow--0.1.0` | `order_header`, `order_item`, `inventory_reservation`, `payment_authorization`, `fulfillment_execution` | medium risk, approval required, compensation strategy | template-ready |
| P0 | Inventory reserve + adjust | `workflow/crud hybrid` | `kse.scene--erp-inventory-reserve-adjust--0.1.0` | `inventory_item`, `inventory_reservation`, `inventory_adjustment`, `inventory_snapshot` | medium risk, approval required, non-negative stock rule | template-ready |

## Ownership Boundary

### 331-poc owns

- Business truth and domain semantics.
- Complete specs (`requirements/design/tasks`) and scene manifests.
- Handoff package (`docs/handoffs/handoff-manifest.json`) and ontology evidence.
- Real-world acceptance cases and risk context.

### KSE owns

- Template contract normalization and packaging format.
- Ontology/gate enforcement and strict checks.
- Runtime routing, fallback behavior, and retry resilience.
- Close-loop orchestration and release evidence aggregation.

## Batch Workflow

1. 331-poc exports spec/template/handoff artifacts.
2. KSE runs `auto handoff run` with strict gates.
3. KSE validates template registry and ontology consistency.
4. KSE executes close-loop batch and snapshots observability.
5. KSE archives evidence and publishes release.

## Definition Of Done

A capability is considered absorbed by KSE when all checks pass:

- `kse scene package-validate --strict`
- `kse scene lint --strict`
- `kse scene score --threshold 85`
- `kse scene ontology validate`
- `kse auto handoff run`
