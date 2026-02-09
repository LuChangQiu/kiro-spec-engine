# Requirements Document: Scene Doctor Traceable Task Sync

## Introduction

Doctor-driven task sync now appends actionable items into spec `tasks.md`.
To support closed-loop evaluation and auditability, synced tasks must carry stable trace metadata
that links each task back to doctor execution context and suggestion identity.

## Requirements

### Requirement 1: Doctor Trace Identity
- Support explicit doctor trace identity via `--trace-id`.
- Generate a stable trace id when not provided.
- Include trace id in doctor report payload.

### Requirement 2: Trace-Aware Task Sync Output
- Include trace id in `task_sync` report block.
- Persist suggestion code and trace metadata in synced task lines.
- Preserve backward compatibility for environments not using task sync.

### Requirement 3: Task Draft Trace Context
- Include trace id in exported doctor task draft header.
- Include suggestion code in generated draft task entries.

### Requirement 4: Validation and Safety
- Keep existing guardrails (`--sync-spec-tasks` requires `--spec`) active.
- Ensure no task file changes occur when there are no actionable suggestions.

### Requirement 5: Regression Coverage
- Extend tests to verify trace id presence and metadata-tagged task lines.
- Keep scene command/runtime test suites green.
