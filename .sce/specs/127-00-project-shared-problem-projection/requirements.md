# Spec Requirements

## Summary

Close the cross-computer continuity gap for project problem knowledge by turning existing spec-bound problem artifacts into a default Git-tracked shared projection, instead of requiring users to remember a separate local problem library sync step.

## Requirements

### R1. Reuse existing problem artifacts
- SCE must not create a parallel problem system for this capability.
- Shared problem projection must derive from existing spec-level `problem-contract.json` and related domain artifacts.

### R2. Provide a project-shared problem view
- SCE must maintain a Git-tracked project-shared problem projection file.
- The projection must summarize active project problem facts in a machine-readable form suitable for co-work continuity on another computer.

### R3. Default scope must avoid historical noise
- The default projection scope must be `non_completed`, so active and stale problems remain visible while completed historical specs do not dominate the shared problem view.
- The scope must remain configurable for projects that prefer `all` or `active_only`.

### R4. Managed collaboration flow must refresh the projection
- Managed co-work push/publish flow must refresh the shared problem projection automatically before governance audit and push/publish proceed.
- This refresh must not require manual user reminders.

### R5. Governance must treat projection drift as a violation
- Co-work governance must fail if the problem closure policy disables the shared projection, the tracked projection file is missing/invalid, or the projection file is not Git-tracked.
- Takeover/template baselines must provision this capability by default for all SCE-managed projects.
