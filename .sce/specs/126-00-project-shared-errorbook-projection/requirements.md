# Spec Requirements

## Summary

Close the co-work loop for high-value project errorbook knowledge so another computer can continue the same project with shared historical specs and curated failure-remediation experience by default.

## Requirements

### R1. Project-shared projection must be Git-trackable
- SCE must maintain a project-shared high-value errorbook projection outside ignored runtime-only directories.
- The default projection path must be committed with the project so another computer receives it through normal Git sync.

### R2. Projection must stay aligned with curated local entries
- SCE-managed errorbook mutations that can affect curated knowledge must refresh the project-shared projection automatically.
- The default shared set must prioritize high-signal entries and avoid raw trial-and-error runtime noise.

### R3. Default baseline must provision the shared path
- `sce init`, `sce adopt`, and takeover baseline alignment must provision the shared projection config and the tracked projection file by default.
- Existing managed projects must be repairable into the same default state.

### R4. Co-work governance must verify the closure
- Collaboration governance audit must fail when the shared projection config or tracked projection file is missing, disabled, invalid, or not Git-tracked.
- Governance must validate the project-shared baseline without requiring per-project ad hoc setup.

### R5. Historical specs must remain unchanged
- This capability must complement, not replace, Git-tracked `.sce/specs/**` history sharing.
- Runtime-only `.sce/errorbook/**` data must remain excluded from Git unless explicitly projected into the shared tracked artifact.
