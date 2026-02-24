# Design Document: Scene Eval Priority Policy Template

## Overview

Enhance eval task sync with a policy layer:

- **Input**: evaluation report recommendations.
- **Policy**: default priority, grade map, keyword overrides.
- **Output**: priority-tagged task entries in spec `tasks.md`.

Also provide a generator command for default policy JSON.

## Command Changes

### `scene eval`
- Add option: `--task-policy <path>`.
- When provided, load JSON and normalize into effective policy.
- During `--sync-spec-tasks`, use policy to compute task priority.

### `scene eval-policy-template`
- New command to write default policy template file.
- Options:
  - `--out <path>` (default `.sce/templates/scene-eval-task-policy.json`)
  - `--force`
  - `--json`

## Priority Resolution

1. Start with grade baseline from `priority_by_grade[overall.grade]`.
2. Fall back to `default_priority`.
3. Apply keyword overrides (`pattern`) as escalation rules.
4. Keep highest severity among matched priorities.

Supported priorities: `critical`, `high`, `medium`, `low`.

## Traceability

Eval-synced task lines include metadata suffix:
- `eval_source=scene-eval`
- `trace_id=<...>`
- `scene_ref=<...>`
- `policy_source=<filename|default>`

`task_sync` report now carries `policy_source`.

## Compatibility

- Existing eval sync without policy keeps deterministic defaults.
- Existing doctor sync remains unchanged.
- Policy normalization tolerates malformed fields by applying safe defaults.
