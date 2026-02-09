# Requirements Document: Scene Doctor Feedback Template Output

## Introduction

Doctor diagnostics can already generate remediation and task artifacts.
To close the execution loop, teams also need a structured feedback template that captures
execution outcomes, evidence links, and evaluation metrics for each synced task.

## Requirements

### Requirement 1: Feedback Template Export Option
- Add doctor CLI option `--feedback-out <path>`.
- Option should behave consistently with existing output options (`--todo-out`, `--task-out`).
- Keep command behavior unchanged when the option is not provided.

### Requirement 2: Feedback Template Content
- Output markdown must include doctor context (`scene_ref`, `scene_version`, `domain`, `mode`, `status`, `trace_id`).
- When task sync exists, include one section per synced task with suggestion metadata and feedback checklist fields.
- When no synced tasks exist, include a clear placeholder note.

### Requirement 3: Report Contract Update
- Doctor JSON report should include `feedback_output` with resolved output path when export succeeds.
- Summary printer should display feedback template path in non-JSON mode.

### Requirement 4: Filesystem Safety
- Export should resolve relative paths from project root.
- Export should ensure parent directory exists before writing.
- Export should remain isolated and non-destructive to other outputs.

### Requirement 5: Validation and Regression Coverage
- Extend unit tests to verify feedback template path and markdown content.
- Keep scene command and runtime pilot test suites passing.
- Verify CLI help includes the new option.
