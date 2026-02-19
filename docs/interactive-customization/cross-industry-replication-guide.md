# Cross-Industry Replication Guide

This guide defines what can be reused directly and what must be domain-specialized when replicating the interactive customization model beyond Moqui.

## Reusable Core (Do Not Fork)

1. Interaction contracts
- `Change_Intent`, `Change_Plan`, `ExecutionRecord` schemas.

2. Safety flow
- Guardrail gate (`allow/review-required/deny`).
- Approval workflow state machine.
- Execution and rollback audit model.

3. Adapter contract
- `capabilities/plan/validate/apply/rollback` interface.
- Extension contract schema and compliance requirements.

4. Governance observability
- KPI report + threshold alerting + remediation workflow.

## Domain-Specific Layer (Extend by Domain_Pack)

1. Ontology
- Domain entities and relations.
- Domain business rules and decision logic.

2. Capability lexicon
- Canonical capability set and aliases for the domain.

3. Template package portfolio
- Scene-package templates for top workflows and critical operations.

4. Risk policy tuning
- Domain-specific blocked action types and thresholds.

## Replication Sequence

1. Choose one domain with clear high-value workflows.
2. Build Domain_Pack ontology + template baseline.
3. Implement one runtime adapter using extension contract.
4. Start in suggestion-only mode, then enable low-risk one-click.
5. Collect KPI and feedback for two cycles before expanding scope.

## Boundary Rule

- Core safety/governance flow must remain unchanged.
- New domains only extend templates, ontology, and adapter implementations.
- Emergency bypass switches are not part of normal rollout policy.
