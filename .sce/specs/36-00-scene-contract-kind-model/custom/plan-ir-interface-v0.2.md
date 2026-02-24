# Plan IR Interface Contract v0.2

## Objective

Define a stable intermediate representation used by Scene runtime before adapter execution.

## Plan Root

```yaml
plan_id: string
scene_ref: string
scene_version: string
run_mode: dry_run|commit
trace_id: string
nodes: []
```

## Node Schema

Required node fields:
- node_id
- node_type: query|service|script|human_approval|verify|respond|adapter
- binding_ref
- preconditions
- execution
- compensation
- evidence_capture
- on_failure

Execution block:
- timeout_ms
- retry_max
- idempotency_key

Compensation block:
- strategy: none|logical|compensation|full-stop
- action_ref

## Transitions

- explicit next node list
- conditional branch expression support
- terminal node required for all paths

## Run Semantics

- dry_run:
  - evaluate preconditions and policy
  - skip side effects
  - produce impact preview and risk report
- commit:
  - enforce approval gates
  - execute side effects via adapters/services
  - emit evidence per node

## Validation Rules

- graph must be acyclic unless loop explicitly marked bounded
- every side-effect node must define idempotency and compensation
- every plan must include at least one verify or respond terminal node
