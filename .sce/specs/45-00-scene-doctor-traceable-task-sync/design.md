# Design Document: Scene Doctor Traceable Task Sync

## Overview

Enhance doctor-to-task sync with trace metadata to close the loop between diagnosis and execution.

## Key Changes

- Add doctor CLI option: `--trace-id`.
- Introduce `createDoctorTraceId()` helper for generated ids.
- Include `trace_id` in doctor report via `buildDoctorSummary`.
- Extend task sync writer to:
  - append metadata tags in task line (`doctor_code`, `trace_id`, `scene_ref`),
  - return `task_sync.trace_id` and enriched `added_tasks`.
- Extend task draft output to include:
  - trace id in header,
  - suggestion code in task checklist line.

## Data Contract Updates

### Doctor report
- `trace_id: string`
- `task_sync.trace_id: string|null`

### Synced task line format
- `- [ ] <id> [priority] <title> [doctor_code=<code> trace_id=<id> scene_ref=<scene>]`

## Compatibility

- Existing workflows without `--trace-id` continue to work via generated trace ids.
- Existing workflows without `--sync-spec-tasks` remain unaffected.
