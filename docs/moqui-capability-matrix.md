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
| P1 | Party master (`Party`, `PartyRole`) | `crud` | `sce.scene--erp-party-management--0.1.0` | `party`, `party_role`, `party_relationship` | medium risk, merge/dedup strategy required | matrix-intake-ready |
| P1 | Product master (`Product`, classification/pricing) | `crud` | `sce.scene--erp-product-management--0.1.0` | `product`, `product_category`, `price_rule` | medium risk, version consistency, rule closure | matrix-intake-ready |
| P1 | Procurement + supplier flow | `workflow` | `sce.scene--erp-procurement-management--0.1.0` | `purchase_order`, `supplier_party`, `receipt_line` | medium risk, approval + receipt reconciliation | matrix-intake-ready |
| P1 | Shipment execution + tracking | `workflow` | `sce.scene--erp-shipment-management--0.1.0` | `shipment`, `shipment_item`, `fulfillment_event` | medium risk, irreversible step guard | matrix-intake-ready |
| P1 | Return/RMA handling | `workflow` | `sce.scene--erp-return-rma-management--0.1.0` | `return_header`, `return_item`, `refund_decision` | medium risk, policy decision completeness | matrix-intake-ready |
| P1 | Production run + work order execution | `workflow` | `sce.scene--erp-production-run--0.1.0` | `production_run`, `work_effort`, `material_issue` | high risk, capacity/exception path required | matrix-intake-ready |
| P1 | BOM + routing maintenance | `crud/workflow hybrid` | `sce.scene--erp-bom-routing-management--0.1.0` | `bom`, `routing`, `operation_step` | medium risk, effective-date governance | matrix-intake-ready |
| P1 | Quality inspection + hold/release | `decision workflow` | `sce.scene--erp-quality-inspection--0.1.0` | `inspection_lot`, `quality_rule`, `release_decision` | high risk, decision closure mandatory | matrix-intake-ready |
| P1 | Equipment lifecycle + maintenance | `workflow` | `sce.scene--erp-equipment-management--0.1.0` | `equipment_asset`, `maintenance_order`, `downtime_event` | medium risk, safety/approval policy | matrix-intake-ready |
| P2 | Workflow approval engine | `platform service` | `sce.scene--platform-workflow-approval-engine--0.1.0` | `approval_flow`, `approval_node`, `approval_decision` | high risk, branch decision coverage | matrix-intake-ready |
| P2 | Reporting + audit operations | `platform query` | `sce.scene--platform-reporting-audit-ops--0.1.0` | `audit_event`, `report_slice`, `trace_lineage` | low risk, lineage completeness | matrix-intake-ready |
| P2 | Suite observability/parity audit | `platform query/dashboard` | `sce.scene--platform-suite-observability-parity--0.1.0` | `suite_capability`, `parity_audit`, `scene_coverage` | medium risk, regression signal quality | matrix-intake-ready |

## 331-poc Intake Snapshot

- Source baseline: `331-poc/docs/handoffs/handoff-manifest.json` (timestamp `2026-02-18T01:08:00+08:00`).
- Newly aligned domain set in this round: party/product/order/procurement/inventory/production/quality/equipment/cost/engineering/hr/calendar + suite platform governance templates.
- Core landing contract:
  - capability aliases are normalized through `lib/data/moqui-capability-lexicon.json`
  - handoff run default gate keeps `max_moqui_matrix_regressions=0`
  - governance stats/close-loop consumes matrix regression signals as release-block conditions

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
  --out .sce/reports/handoff-capability-matrix.md \
  --fail-on-gap \
  --json
```

`capability-matrix` now checks both capability coverage and semantic completeness (ontology entities/relations + governance business rules/decision logic) by default.

When gaps exist, sce writes remediation queue lines (default `.sce/auto/moqui-remediation.lines`) that can be fed directly into:

```bash
sce auto close-loop-batch .sce/auto/moqui-remediation.lines --format lines --json
```

## Definition Of Done

A capability is considered absorbed by sce when all checks pass:

- `sce scene package-validate --strict`
- `sce scene lint --strict`
- `sce scene score --threshold 85`
- `sce scene ontology validate`
- `sce auto handoff run`
