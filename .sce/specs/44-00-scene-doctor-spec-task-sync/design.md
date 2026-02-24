# Design Document: Scene Doctor Spec Task Sync

## Overview

Enhance doctor pipeline in `lib/commands/scene.js` with optional in-place backlog sync:
1) generate doctor suggestions,
2) map actionable items into task lines,
3) append into target spec `tasks.md` with dedupe and numbering guardrails.

## Command Surface

- Doctor option: `--sync-spec-tasks`
- Validation rule: must be combined with `--spec` source.

## Core Components

- `collectExistingTaskRegistry(tasksContent)`
  - Parses existing task ids and normalized titles.
- `appendDoctorSuggestionsToSpecTasks(options, report, projectRoot, fileSystem)`
  - Filters actionable suggestions.
  - Computes next task ids.
  - Skips duplicate titles.
  - Appends section + tasks into `tasks.md`.

## Output Model

`report.task_sync` includes:
- `tasks_path`
- `added_count`
- `skipped_duplicates`
- optional `skipped_reason`
- `added_tasks` with generated task ids

## Safety Considerations

- If no actionable suggestions exist, do not modify file.
- If target `tasks.md` does not exist, return clear error.
- Preserve existing file content, append-only behavior.
