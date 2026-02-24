# Hybrid Pilot and Safety Drill Checklist v0.2

## Hybrid Pilot Selection

Pilot scene:
- scene.fulfillment.robot-pick-confirm
- domain: hybrid
- blast radius: limited to one station and test order set

## Pilot Scope

- ERP: reserve pick items, confirm fulfillment result
- Robot: dispatch mission, receive completion callback
- Runtime: enforce high-risk policy and compensation path

## Promotion Gates (dry_run -> commit)

Gate 1: Contract completeness
- scene/datacontract/policy/eval all present and validated

Gate 2: Adapter readiness
- health_check pass
- preflight pass
- stop channel reachable

Gate 3: Safety drill
- cancel path executed successfully
- compensation path executed successfully

Gate 4: KPI baseline
- 20 consecutive dry_run passes
- 5 supervised commit passes with zero safety violations

## Safety Drill Checklist

Pre-drill:
- operator and approver identified
- environment health snapshot captured
- rollback and compensation steps confirmed

Drill A: normal flow
- dispatch mission
- receive completion callback
- confirm ERP update and evidence

Drill B: mid-flight cancellation
- trigger cancel_mission
- verify robot transition and ERP compensation

Drill C: adapter timeout
- simulate timeout
- verify runtime failure handling and no unsafe retry pattern

Post-drill:
- collect evidence bundle
- run eval scoring
- record lessons and policy adjustments
