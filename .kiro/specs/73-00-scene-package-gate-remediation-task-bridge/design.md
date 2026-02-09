# Design Document: Scene Package Gate Remediation Task Bridge

## Overview

Introduce a remediation-to-task bridge that keeps gate closure deterministic and automation-friendly.

Flow:
1. `scene package-gate` evaluates checks and emits remediation actions.
2. Task draft builder selects remediation actions as task candidates.
3. Spec task sync appends action-backed tasks with trace metadata.
4. Sync result exposes source mode for downstream automation.

## Candidate Selection Strategy

- Primary source: `payload.remediation.actions`
  - Candidate fields: `title`, `priority`, `action_id`, `source_check_ids`.
- Fallback source: failed checks from `payload.checks`
  - Candidate fields: legacy check title, check-derived priority, `check_id`.

This keeps backward compatibility while favoring semantically richer remediation actions.

## Task Output Model

### Task Draft
- Suggested task line format includes `action_id` when action-backed.
- Draft metadata includes `suggested_actions` count.

### Spec Task Sync
- `tasks.md` appended lines include suffix metadata:
  - `action_id=<id>`
  - `source_checks=<comma-separated-check-ids>`
  - `policy_profile=<profile>`
- Sync return payload adds:
  - `source_mode`
  - per-task `action_id`
  - per-task `source_check_ids`

## Compatibility Notes

- Existing section header `Scene Package Gate Suggested Tasks` remains unchanged.
- Duplicate detection remains title-based for idempotent sync behavior.
- If remediation payload is missing, check-based legacy behavior is preserved.

## Test Strategy

- Assert remediation actions include `source_check_ids` from failed checks.
- Assert task draft output exposes `suggested_actions` and action identifiers.
- Assert spec task sync returns `source_mode: remediation` and action IDs.
