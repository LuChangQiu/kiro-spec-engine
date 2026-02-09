# Domain Policy Matrix v0.2

## Policy Axes

- `risk_level`: low|medium|high|critical
- `approval_mode`: none|single|dual
- `run_mode`: dry_run|commit
- `rollback_mode`: none|logical|compensation|full-stop
- `safety_guard`: standard|preflight|required-stop-check

## Matrix

| Domain | Operation Class | risk_level | approval_mode | default run_mode | rollback_mode | safety_guard |
| --- | --- | --- | --- | --- | --- | --- |
| erp | query/read | low | none | commit | none | standard |
| erp | create/update/delete | medium-high | single | dry_run -> commit | logical/compensation | standard |
| robot | mission simulation | medium | single | dry_run | compensation | preflight |
| robot | mission dispatch | high | single or dual (site rule) | dry_run -> commit | compensation/full-stop | required-stop-check |
| robot | safety IO / emergency channel | critical | dual | commit (strict allowlist only) | full-stop | required-stop-check |
| hybrid | erp+robot orchestration | high-critical | dual for critical paths | dry_run mandatory before commit | compensation | preflight + required-stop-check |

## Mandatory Guards for Robot and Hybrid

- preflight checklist completed
- operator identity and authorization verified
- environment state valid (network/device health)
- stop/recovery channel reachable
- mission idempotency key attached

## Approval Escalation

- Any operation touching safety channel escalates to `critical`.
- Any hybrid scene with irreversible external side effect escalates at least `high`.
- Missing compensation plan blocks commit.

## Evidence Minimum

- approval records
- command dispatch payload hash
- adapter execution result
- rollback/compensation status
- final scene verdict