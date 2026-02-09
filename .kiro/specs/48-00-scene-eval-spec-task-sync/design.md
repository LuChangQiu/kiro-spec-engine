# Design Document: Scene Eval Spec Task Sync

## Overview

Extend `scene eval` with the same project-operational pattern used by `scene doctor`:
analysis output should be writable into spec `tasks.md` as follow-up actions.

## Command Contract Changes

`scene eval` adds:
- `-s, --spec <spec-name>`: target spec folder under `.kiro/specs`.
- `--sync-spec-tasks`: append evaluation recommendations to target `tasks.md`.

Validation rule:
- `--sync-spec-tasks` requires `--spec`.

## Sync Pipeline

1. Build eval report (`buildSceneEvalReport`).
2. If sync enabled, read target `tasks.md`.
3. Convert each `overall.recommendations[]` item into a task line:
   - default priority token `[medium]`
   - suffix metadata: `[eval_source=scene-eval trace_id=<...> scene_ref=<...>]`
4. Skip duplicates by normalized title.
5. Append under timestamped section `## Scene Eval Suggested Tasks (...)`.
6. Attach `task_sync` metadata to report.

## Data Contract Additions

Eval report may include:
- `task_sync.tasks_path`
- `task_sync.trace_id`
- `task_sync.added_count`
- `task_sync.skipped_duplicates`
- `task_sync.skipped_reason`
- `task_sync.added_tasks[]`

## Compatibility

- Non-sync eval flows are unchanged.
- Existing `doctor` task sync continues unchanged.
- Duplicate normalization now strips trailing bracket metadata suffixes to improve
  cross-command deduplication stability.
