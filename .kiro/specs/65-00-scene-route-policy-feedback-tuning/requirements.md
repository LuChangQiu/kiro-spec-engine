# Requirements Document: Scene Route Policy Feedback Tuning

## Introduction

Scene routing now supports policy templates and explicit policy files, but tuning is still manual. Teams need a
closed-loop command that converts scene eval outputs into route policy recommendations with traceable rationale.

## Requirements

### Requirement 1: Eval-Driven Route Policy Suggestion Command
- Add `scene route-policy-suggest` command for policy tuning suggestions.
- Command should accept one or more eval report JSON files, or discover JSON files from a directory.
- Command should return actionable errors when eval sources are missing or unreadable.

### Requirement 2: Baseline Policy Resolution and Profile Fallback
- Suggestion should start from an explicit route policy file when provided.
- Without explicit policy, suggestion should start from profile template baseline.
- When profile is `default`, command should auto-select dominant profile from eval reports.

### Requirement 3: Signal Analysis and Adjustment Heuristics
- Aggregate eval grades, run statuses, and recommendation signals.
- Produce deterministic policy adjustments with bounded deltas.
- Output should include adjustment rationale linked to observed rates/signals.

### Requirement 4: Output and Auditability
- Suggestion payload should include source eval report summaries.
- Support writing full suggestion payload and policy-only JSON output files.
- Human-readable summary should display baseline source and adjustment count.

### Requirement 5: Regression Safety
- Extend scene command unit tests for option validation and suggestion behavior.
- Validate route policy suggestion with both explicit eval list and eval directory discovery.
- Keep scene command suite and project checks passing.
