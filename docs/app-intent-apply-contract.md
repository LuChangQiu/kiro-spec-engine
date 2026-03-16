# App Intent Apply Contract

## Scope

This document defines the JSON response contract for:

- `sce app collection apply --collection <id> --json`
- `sce scene workspace apply --workspace <id> --json`

Both commands share the same payload shape. The only stable differences are:

- `mode`
- `summary.source_type`
- `summary.source_id`
- `plan.source`

## Top-Level Payload

```json
{
  "mode": "app-collection-apply",
  "generated_at": "2026-03-16T12:00:00.000Z",
  "execute_supported": true,
  "executed": false,
  "execution_blocked_reason": null,
  "execution": {
    "results": [],
    "preflight_failures": []
  },
  "current_device": {},
  "device_override": {},
  "summary": {},
  "plan": {}
}
```

### Field meanings

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | string | `app-collection-apply` or `scene-workspace-apply` |
| `generated_at` | string | ISO timestamp |
| `execute_supported` | boolean | Current implementation supports explicit execution |
| `executed` | boolean | `true` only when `--execute` was requested and the plan really ran |
| `execution_blocked_reason` | string or null | Blocking reason when execution did not run |
| `execution.results` | array | Per-action execution result list |
| `execution.preflight_failures` | array | Preflight failures when execution is blocked by runtime readiness |
| `current_device` | object | Current device identity and capability projection |
| `device_override` | object | Normalized local device override from `.sce/state/device/device-override.json` |
| `summary` | object | Top-level counts for UI summary |
| `plan` | object | Full desired-set and action diff contract |

## Summary Contract

```json
{
  "source_type": "app-collection",
  "source_id": "sales-workbench",
  "desired_app_count": 4,
  "install_count": 2,
  "activate_count": 1,
  "uninstall_count": 1,
  "keep_count": 0,
  "skip_count": 1
}
```

## Plan Contract

```json
{
  "source": {
    "type": "app-collection",
    "id": "sales-workbench",
    "name": "Sales Workbench"
  },
  "current_device": {
    "device_id": "desktop-01",
    "capability_tags": ["desktop", "win32", "x64"]
  },
  "device_override": {
    "removed_apps": ["crm"],
    "added_apps": [
      {
        "app_key": "notes",
        "required": false
      }
    ]
  },
  "desired_apps": [],
  "unresolved_collections": [],
  "unresolved_apps": [],
  "actions": [],
  "counts": {
    "install": 0,
    "activate": 0,
    "uninstall": 0,
    "keep": 0,
    "skip": 0
  }
}
```

### `desired_apps[]`

Each item is the resolved desired app set after collection/workspace expansion and local device override merge.

| Field | Type | Meaning |
| --- | --- | --- |
| `app_id` | string or null | Preferred explicit app identity when supplied |
| `app_key` | string or null | Preferred route and registry key |
| `required` | boolean | App is intended as required in the resolved desired set |
| `allow_local_remove` | boolean | Whether local removal is allowed in intent metadata |
| `priority` | number or null | Lower number means higher priority |
| `default_entry` | string or null | Preferred initial route |
| `capability_tags` | array | Capability filter merged from contributing items |
| `metadata` | object | Free-form metadata |
| `sources` | array | Provenance list such as `collection:<id>` or `workspace:<id>` |

### `actions[]`

Each item is the device-oriented diff result that the UI should render before execution.

| Field | Type | Meaning |
| --- | --- | --- |
| `app_id` | string or null | Resolved app id |
| `app_key` | string or null | Resolved app key |
| `app_name` | string or null | Human-readable bundle name when known |
| `decision` | string | `install`, `activate`, `uninstall`, `keep`, or `skip` |
| `reason` | string | Why this decision was generated |
| `install_status` | string | Current install status from bundle projection |
| `installed_release_id` | string or null | Currently installed release on this device |
| `active_release_id` | string or null | Currently active release |
| `required` | boolean | Whether the resolved desired set marks this as required |
| `sources` | array | Provenance list for desired entries; removals may be empty |

### Stable `decision` values

| Decision | Meaning |
| --- | --- |
| `install` | Desired app is not installed on this device |
| `activate` | Installed release exists but is not the active release |
| `uninstall` | App is installed but no longer desired on this device |
| `keep` | App already matches desired state |
| `skip` | Plan cannot safely execute this item automatically |

### Stable `reason` values currently emitted

| Reason | Meaning |
| --- | --- |
| `desired-app-not-installed` | Install candidate |
| `installed-release-not-active` | Activate candidate |
| `desired-app-already-installed` | Keep candidate |
| `not-desired-on-current-device` | Uninstall candidate |
| `device-capability-mismatch` | Desired app filtered out by capability tags |
| `app-bundle-not-found` | Desired app does not resolve to a known bundle |
| `active-release-protected` | Installed app is active and cannot be auto-uninstalled |

## Execution Contract

### `execution_blocked_reason`

Current stable values:

- `null`
- `unresolved-collections`
- `unresolved-app-bundles`
- `active-release-protected`
- comma-joined combinations such as `unresolved-collections,active-release-protected`
- `install-preflight-failed`
- `invalid-plan-action`

### `execution.results[]`

Returned only when execution actually runs.

```json
[
  {
    "app_ref": "crm",
    "decision": "install",
    "success": true,
    "summary": {
      "app_id": "app.crm",
      "install_status": "installed",
      "installed_release_id": "rel.crm.1",
      "active_release_id": "rel.crm.1"
    }
  }
]
```

### `execution.preflight_failures[]`

Returned when execution is blocked because install/activate candidates are not runtime-ready.

```json
[
  {
    "app_ref": "crm",
    "reason": "no-installable-runtime-release"
  }
]
```

Current stable preflight reasons:

- `no-installable-runtime-release`
- `no-activatable-installed-release`

## Example: Plan Only

```json
{
  "mode": "scene-workspace-apply",
  "execute_supported": true,
  "executed": false,
  "execution_blocked_reason": null,
  "summary": {
    "source_type": "scene-workspace",
    "source_id": "sales-desktop",
    "desired_app_count": 4,
    "install_count": 2,
    "activate_count": 1,
    "uninstall_count": 0,
    "keep_count": 1,
    "skip_count": 0
  }
}
```

## Example: Executed

```json
{
  "mode": "app-collection-apply",
  "execute_supported": true,
  "executed": true,
  "execution_blocked_reason": null,
  "execution": {
    "results": [
      {
        "app_ref": "crm",
        "decision": "install",
        "success": true
      },
      {
        "app_ref": "todo",
        "decision": "uninstall",
        "success": true
      }
    ],
    "preflight_failures": []
  }
}
```

## Frontend Guidance

- Treat `plan.actions` as the primary render contract for the diff table.
- Treat `summary` as the primary count badge contract.
- Treat `execution.results` as post-run feedback only; do not infer the plan from it.
- Use `execution_blocked_reason` and per-action `reason` together. One tells you why the full plan could not run; the other tells you why each row exists.
