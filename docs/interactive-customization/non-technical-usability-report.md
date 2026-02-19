# Non-Technical Usability Report (Moqui Experiment)

This report evaluates whether business users can complete optimization loops without software engineering expertise.

## Target User Profile

- Understands business process and constraints.
- Does not write source code.
- Needs explainable, reversible, low-risk change flow.

## Success Cases

1. Read-only understanding
- User asks for process/field/rule explanation in page context.
- System returns business-readable explain output and structured intent.

2. Suggestion-first planning
- User provides goal in business language.
- System generates structured plan with risk, verification, rollback.

3. Guardrail-protected execution
- Low-risk and allow decisions can proceed via controlled apply.
- High-risk/review-required actions are blocked or routed to approval.

4. Traceable rollback
- User can request rollback by execution id.
- System records rollback trace without hidden mutation.

## Failure Cases Observed

1. Adoption friction
- Users may receive too many `review-required`/`deny` outcomes when intent text is vague.

2. Feedback sparsity
- Satisfaction trend quality is weak when feedback sample count is low.

3. Policy mismatch
- Some domain intents are classified as medium/high by default and cannot use one-click path.

## Improvement Backlog

1. Improve intent guidance templates
- Add business-facing prompt examples per module (order/inventory/approval).

2. Add domain-tuned risk hints
- Improve risk classification precision for repeated safe operations.

3. Improve feedback capture
- Add lightweight feedback collection in page copilot UI for each action result.

4. Expand safe action catalog
- Promote proven medium-risk patterns into review-light, still-governed pathways.

## Current Verdict

- Baseline usability is acceptable for guided business users.
- Continuous improvement depends on better intent guidance + richer feedback samples.
