# SCE Release-Ready Starter Kit

This starter kit is the default baseline for onboarding an external project (including Moqui-based solutions) into SCE without project-specific flags.

## Included Assets

- `handoff-manifest.starter.json`: minimal manifest contract that works with `sce auto handoff` and `sce scene package-publish-batch`.
- `release.workflow.sample.yml`: GitHub Actions sample for release-gate + weekly ops evidence publication.
- `handoff-profile-ci.sample.yml`: profile-based intake pipeline sample (`default|moqui|enterprise`).
- profile fixture references (for validation/testing):
  - `tests/fixtures/handoff-profile-intake/default/*`
  - `tests/fixtures/handoff-profile-intake/moqui/*`
  - `tests/fixtures/handoff-profile-intake/enterprise/*`

## Quick Start

1. Prepare your manifest using `handoff-manifest.starter.json` as baseline.
2. Run default intake pipeline:

```bash
npx sce auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --profile moqui --fail-on-gap --json
npx sce auto handoff run --manifest docs/handoffs/handoff-manifest.json --profile moqui --json
node scripts/release-ops-weekly-summary.js --json
```

3. Wire release workflow using `release.workflow.sample.yml` sections:
   - release-gate history index
   - governance snapshot export
   - weekly ops summary export
4. Optional: use `handoff-profile-ci.sample.yml` to run profile-based intake against external projects.

## Default Acceptance

- `scene package publish-batch` gate passes.
- capability lexicon unknown count is zero.
- release preflight is not blocked for hard-gate profiles.
- weekly ops summary risk is not `high` unless explicitly approved.

## Profile Recommendation

- `default`: generic strict baseline intake.
- `moqui`: preferred profile for Moqui template sedimentation.
- `enterprise`: production rollout profile (release preflight hard-gate enabled).

## Default Evidence Set

- `.sce/reports/release-evidence/handoff-runs.json`
- `.sce/reports/release-evidence/release-gate-history.json`
- `.sce/reports/release-evidence/governance-snapshot-<tag>.json`
- `.sce/reports/release-evidence/weekly-ops-summary-<tag>.json`
