# Design Document: Scene Eval Unified Config Template

## Overview

Introduce a unified scene eval config contract so teams can manage score thresholds and task-priority
rules in one file with environment profiles.

## Command Surface

### `scene eval`
- New options:
  - `--eval-config <path>`: unified config JSON
  - `--env <env-name>`: profile key in `envs`
- Existing options stay available (`--target`, `--task-policy`).
- Precedence:
  1. defaults
  2. `--eval-config` global + env overlay
  3. explicit `--target` and `--task-policy` overrides

### `scene eval-config-template`
- New command to scaffold unified config template.
- Default output: `.kiro/templates/scene-eval-config.json`.

## Unified Config Schema

```json
{
  "target": { "max_cycle_time_ms": 2500, "max_manual_takeover_rate": 0.25 },
  "task_sync_policy": { "default_priority": "medium" },
  "envs": {
    "dev": { "target": { ... }, "task_sync_policy": { ... } },
    "staging": { ... },
    "prod": { ... }
  }
}
```

## Resolution Flow

1. Load unified config.
2. Merge global `target` and `task_sync_policy`.
3. If `--env` specified, merge profile overrides.
4. Merge explicit `--target` and `--task-policy` on top.
5. Normalize final task policy and run evaluation/sync.

## Compatibility

- Existing `scene eval --target` and `--task-policy` flows still work.
- Existing `scene eval-policy-template` remains available.
- New config path is additive and backward compatible.
