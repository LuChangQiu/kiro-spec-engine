# Robot Adapter Interface Contract v0.2

## Scope

Define the interface between Scene runtime and robot execution systems.

## Adapter Capabilities

Required capability groups:
- mission_dispatch
- mission_cancel
- mission_status_query
- health_check
- emergency_stop_state_query

## Command Contract

### dispatch_mission

```json
{
  "command": "dispatch_mission",
  "mission_type": "pick_and_place",
  "mission_id": "optional-client-id",
  "idempotency_key": "required",
  "payload": {
    "station_id": "S01",
    "order_id": "O1001"
  },
  "timeout_ms": 10000
}
```

### cancel_mission

```json
{
  "command": "cancel_mission",
  "mission_id": "required",
  "reason": "scene_compensation"
}
```

### query_status

```json
{
  "command": "query_status",
  "mission_id": "required"
}
```

## Callback Event Contract

Adapter must emit:
- mission_accepted
- mission_started
- mission_progress
- mission_completed
- mission_failed
- mission_cancelled

Common callback fields:
- mission_id
- event_time
- state
- error_code (optional)
- details (optional)

## Safety Constraints

- adapter must reject commands when stop channel is unavailable
- adapter must expose preflight validation endpoint
- adapter must guarantee idempotent dispatch by idempotency_key

## Runtime Expectations

- runtime never sends direct motion/safety IO commands
- runtime relies on adapter mission-level API only
- runtime records every command and callback in audit stream
