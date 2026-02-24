# Design Document: Nested Validation Fix

## Overview

Spec 27 resolves nested repository validation failures by normalizing path comparisons,
stabilizing cycle detection, and improving validation diagnostics for large repository sets.

## Validation Strategy

- Normalize parent/child paths before graph comparisons.
- Skip cycle detection for repositories without an effective parent.
- Guard null/empty parent values as "no parent".
- Validate parent references with graceful fallback errors.

## Performance Notes

- Use map-based lookups for repository path and parent resolution.
- Keep cycle traversal bounded to avoid quadratic scans for large sets.

## Compatibility

- Non-nested mode behavior remains unchanged.
- Existing single-repository configurations remain valid.
- Errors provide actionable context for invalid parent/cycle scenarios.
