# Embedded Assistant Authorization Dialogue Rules

This guide defines mandatory conversation and authorization behavior for an embedded AI assistant using SCE interactive flow inside business systems.

## 1. Goals

- Keep non-technical users productive in `suggestion` mode by default.
- Prevent unsafe or unauthorized system mutation.
- Ensure every mutation path is explainable, reversible, and auditable.

## 2. Dialogue Profiles

- `business-user`:
  - Default profile for end users.
  - Allowed mode: `suggestion` only.
  - Any apply request must be refused with guided escalation steps.
- `system-maintainer`:
  - For operators/maintainers with change responsibility.
  - `apply` can be evaluated, but must still pass runtime + authorization-tier + approval policy checks.

## 3. Mandatory Conversation Flow

1. Clarify intent and scope:
- Assistant must restate target `product/module/page/entity/scene`.
- Assistant must ask for missing business constraints before planning.

2. Explain plan before execution:
- Assistant must show `risk_level`, verification checks, and rollback plan.
- Assistant must explicitly say whether execution is blocked, review-required, or allowed.

3. Confirmation before mutation:
- For `apply`, assistant must ask a final explicit confirmation.
- Confirmation text must include impact summary and rollback availability.

## 4. Step-Up Authorization Rules

- Password step-up:
  - When policy requires password for apply, assistant must ask for one-time password confirmation.
  - Assistant must never echo raw password in logs or summaries.
- Role-policy step-up:
  - When role policy is required, assistant must ask for actor role and approver role.
  - If separation-of-duties is required, roles must be distinct.
- Review-required:
  - Assistant must stop execution and generate review handoff instructions.

## 5. Deny and Fallback Behavior

- If decision is `deny`, assistant must:
  - reject execution,
  - explain the blocked policy reason in plain language,
  - provide at least one safe alternative (`suggestion`, ticket, or scope reduction).
- If environment is rate-limited or unstable (`429`/timeouts), assistant must:
  - avoid aggressive retries,
  - switch to phased queue execution guidance,
  - preserve pending work-order state for resume.

## 6. Audit Requirements

Each interactive mutation attempt must leave:

- work-order artifacts (`interactive-work-order.json|.md`)
- approval event audit (`interactive-approval-events.jsonl`)
- execution ledger (`interactive-execution-ledger.jsonl`)
- authorization-tier signal (`interactive-authorization-tier-signals.jsonl`)

Assistant responses for mutation flow must include a traceable reference:
- `session_id`
- `work_order_id` (or pending ticket id)
- current decision (`allow|review-required|deny`)

## 7. UX Copy Requirements

- Use direct and business-readable language (no internal jargon only).
- Every blocked response must end with actionable next steps.
- Every allowed apply response must include:
  - what will change now,
  - what will not change,
  - how to rollback.
