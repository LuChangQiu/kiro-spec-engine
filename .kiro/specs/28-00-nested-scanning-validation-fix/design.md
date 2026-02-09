# Design Document: Nested Scanning Validation Fix

## Overview

Spec 28 aligns validation with nested scanning behavior by allowing nested overlaps in nested mode,
accepting hidden-directory repository names, and improving discovery consistency.

## Core Decisions

- Permit repository names beginning with `.` when otherwise valid.
- Make path-overlap validation mode-aware (`nestedMode` enables overlaps).
- Ensure discovered repositories always include valid name/path payloads.
- Preserve strict overlap rejection in non-nested mode.

## Error UX

- Group validation failures by rule type.
- Keep messages actionable with context and suggested fix direction.

## Compatibility

- Existing non-nested and single-repo workflows remain unchanged.
- Nested scanning output remains saveable in configuration state.
