# Requirements Document: Scene Package Gate Task Draft and Sync

## Introduction

Spec 70 introduced gate policy generation and gate evaluation. The next closure step is turning failed gate checks into
traceable delivery actions, so template governance can directly drive implementation plans.

## Requirements

### Requirement 1: Gate Task Draft Output
- Extend `scene package-gate` with `--task-out` to emit markdown task draft.
- Draft should summarize failed checks and suggested actions.
- Draft should be generated even when strict mode fails.

### Requirement 2: Gate-to-Spec Task Sync
- Extend `scene package-gate` with `--spec` + `--sync-spec-tasks` to append failed checks into target spec `tasks.md`.
- Synced tasks should include check id and policy profile metadata for traceability.
- Sync should deduplicate existing task titles.

### Requirement 3: Validation and Safety
- `--sync-spec-tasks` must require `--spec`.
- Missing target `tasks.md` should fail with actionable error.
- Gate command should preserve existing strict mode behavior.

### Requirement 4: CLI Observability
- Gate summary output should include task draft path when generated.
- Gate summary output should include task sync counters and duplicate skip counts.
- JSON payload should include `task_draft` and `task_sync` sections.

### Requirement 5: Regression and Evidence
- Extend scene unit tests for new gate options and sync behavior.
- Keep scene suite and full regression suite green.
- Store task draft and sync smoke evidence under spec reports.
