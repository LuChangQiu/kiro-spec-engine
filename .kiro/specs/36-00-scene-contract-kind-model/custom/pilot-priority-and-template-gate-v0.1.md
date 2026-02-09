# Pilot Scene Priority Matrix and Template Quality Gate v0.1

## Objective

Choose a low-risk, high-value pilot path to prove the closed loop:

- user intent -> scene selection -> controlled execution -> evidence -> eval

## Candidate Scene Matrix

Scoring scale: 1 (low) to 5 (high)

| Scene Candidate | Business Value | Data Complexity | Execution Risk | Reusability | Pilot Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| `scene.order.query` | 5 | 2 | 1 | 5 | 13 |
| `scene.inventory.availability` | 5 | 3 | 2 | 5 | 13 |
| `scene.customer.statement` | 4 | 3 | 2 | 4 | 11 |
| `scene.sales-order.create` | 5 | 4 | 4 | 5 | 10 |
| `scene.receivable.writeoff` | 4 | 4 | 5 | 3 | 6 |

Formula (pilot-first bias):

- `Pilot Score = Business Value + Reusability - Execution Risk + (6 - Data Complexity)`

## Recommended Pilot Sequence

1. `scene.order.query`
2. `scene.inventory.availability`
3. `scene.customer.statement`

Reasoning:

- High business visibility
- Low write risk and easier rollback strategy
- Strong template reuse potential

## Pilot KPI Baseline (v0.1)

- success_rate >= 0.98
- manual_takeover_rate <= 0.05
- error_action_rate <= 0.01
- cycle_time_ms_p95 <= 2500
- policy_violation_count = 0

## Template Quality Gate

### Gate A: Contract Completeness

- Has `scene-contract` and `datacontract` sections
- Has risk and approval policy
- Has eval KPI definitions
- Has evidence bundle definition

### Gate B: Data Correctness

- All fields map to canonical `moqui.Entity.field`
- No undefined entity/field references
- Type mapping conforms to Moqui dictionary semantics

### Gate C: Execution Safety

- Contains dry-run behavior
- Defines idempotency key for side effects
- Defines rollback or compensation strategy
- Enforces high-risk approval rule

### Gate D: Observability

- Logs intent, selected scene/spec versions, and called bindings
- Captures evidence bundle with trace id
- Produces Eval-ready structured output

### Gate E: Reuse Readiness

- Parameters are explicit and typed
- Domain assumptions documented
- Versioning and changelog maintained

## Release Rule for Template Adoption

A template is promoted to "production-ready" only when:

- Gate A-E all pass
- At least 2 successful pilots in different but related scenes
- KPI baseline is met for 2 consecutive evaluation windows

## Immediate Next Decision

- Approve Pilot 1 scope as `scene.order.query`
- Lock DataContract read-set and Policy low-risk profile
- Run dry-run only for the first iteration, then promote to commit mode