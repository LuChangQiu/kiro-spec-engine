# Security Governance Default Baseline

This baseline is the default operating policy for SCE-driven delivery, including Moqui template intake and interactive customization.

## 1. Context and Data Safety

- Enforce strict context contract validation (`--context-contract`, strict mode on).
- Block forbidden keys (for example secrets/private keys) from UI/provider payloads.
- Keep payload masking enabled for business data and identity fields.
- Reject context payloads that exceed size budget or schema bounds.

## 2. Approval and Execution Safety

- High-risk plans must pass approval workflow before `apply`.
- Low-risk auto-apply is allowed only when gate result is `allow`.
- Runtime policy gate is mandatory before apply (`runtime_mode=ops-fix`, `runtime_environment=staging` by default).
- Runtime non-allow (`deny|review-required`) should block unattended apply (`--fail-on-runtime-non-allow`).
- Apply-mode mutating plans require password authorization (`authorization.password_required=true` by default).
- Password verifier hash must be supplied via `SCE_INTERACTIVE_AUTH_PASSWORD_SHA256` (or explicit override).
- Work-order artifacts (`interactive-work-order.json|.md`) are required for usage/maintenance/dev integrated auditing.
- Every apply/rollback must write execution ledger evidence.
- Stage-C adapters must keep dry-run behavior as default unless explicitly switched.

## 3. Release and Intake Gates

- Run handoff with profile baseline (`--profile moqui` or stricter).
- Keep scene package publish-batch gate enabled by default.
- Keep capability lexicon unknown count at zero.
- Keep release preflight hard-gate enabled for enterprise profile.
- Keep interactive governance weekly gate enabled (`--fail-on-alert`).

## 4. Mandatory Audit Artifacts

- `.kiro/reports/release-evidence/handoff-runs.json`
- `.kiro/reports/release-evidence/release-gate-history.json`
- `.kiro/reports/release-evidence/governance-snapshot-<tag>.json`
- `.kiro/reports/release-evidence/weekly-ops-summary-<tag>.json`
- `.kiro/reports/interactive-governance-report.json`
- `.kiro/reports/interactive-dialogue-governance.json`
- `.kiro/reports/interactive-execution-ledger.jsonl`
- `.kiro/reports/interactive-approval-events.jsonl`

## 5. Weekly Control Loop

```bash
node scripts/interactive-governance-report.js --period weekly --fail-on-alert --json
node scripts/release-ops-weekly-summary.js --json
node scripts/release-weekly-ops-gate.js
node scripts/release-risk-remediation-bundle.js --gate-report .kiro/reports/release-evidence/release-gate.json --json
node scripts/release-asset-integrity-check.js
```

If weekly ops summary risk is `high`, freeze release and run remediation before next tag.
