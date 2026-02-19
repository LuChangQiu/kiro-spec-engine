# Governance Alert Playbook

This playbook defines how to respond when governance thresholds are breached.

## Trigger

Any medium/high breach from `interactive-governance-report`:

- adoption-rate-low
- execution-success-low
- rollback-rate-high
- security-intercept-high
- satisfaction-low

## Severity Policy

- `high`: execution quality/safety risk. Start containment immediately.
- `medium`: quality/friction drift. Start corrective tuning in current cycle.
- `low`: data quality warning (e.g., insufficient intent/feedback samples).

## Response Workflow

1. Confirm signal quality
- Verify report window and evidence file completeness.
- Re-run report for the same window to exclude transient parse issues.

2. Containment (for high severity)
- Freeze non-essential apply actions.
- Force suggestion-only mode for affected scope.
- Require explicit reviewer approval.

3. Diagnosis
- Inspect failed/skipped execution records.
- Inspect blocked action categories from policy decision.
- Inspect rejected approval events and common intent patterns.

4. Fix
- Update template governance rules or decision logic.
- Tune risk classification hints and plan generation prompts.
- Strengthen pre-apply verification checks.

5. Verification
- Re-run report in next checkpoint window.
- Confirm breached metric returns within threshold.

## Mandatory Output

- Incident note with breach IDs.
- Implemented fix list.
- Re-validation report link.
- Rollback evidence (if rollback was executed).
