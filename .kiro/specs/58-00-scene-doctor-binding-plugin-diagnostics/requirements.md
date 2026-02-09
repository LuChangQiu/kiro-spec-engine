# Requirements Document: Scene Doctor Binding Plugin Diagnostics

## Introduction

Scene runtime now supports binding plugins and manifest governance, but doctor output still focuses on
plan/policy/readiness checks. Teams need doctor-level visibility and actionable guidance for plugin
loading health before execution.

## Requirements

### Requirement 1: Doctor Diagnostics Coverage
- Doctor report should include binding plugin load metadata when available.
- Metadata should include handler count, plugin paths, manifest path/load status, and warnings.

### Requirement 2: Human Readable Observability
- Non-JSON doctor summary should print binding plugin diagnostics section.
- Manifest load status should be shown when manifest path is present.
- Plugin load warnings should be printed as doctor warnings.

### Requirement 3: Actionable Suggestions
- Doctor should generate suggestions for common plugin governance issues.
- Missing manifest warnings should map to explicit remediation guidance.
- Plugin load failure warnings should map to plugin repair guidance.

### Requirement 4: Non-Blocking Policy
- Plugin warnings should not force doctor status to blocked by default.
- Existing plan/policy/adapter blockers remain status drivers.

### Requirement 5: Regression Safety
- Add command unit tests for doctor binding plugin diagnostics in JSON and summary output.
- Keep scene command/runtime unit suites passing.
