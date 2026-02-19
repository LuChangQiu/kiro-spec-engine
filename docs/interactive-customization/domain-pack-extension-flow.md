# Domain_Pack Extension Flow

This document defines how to extend the interactive customization platform from Moqui to other industries without changing core security workflow.

## Goal

- Reuse the same guardrail/approval/audit backbone.
- Add industry-specific knowledge through Domain_Pack assets only.
- Avoid runtime-specific forks in core policy flow.

## Domain_Pack Asset Set

Each new domain should provide:

1. Scene template package(s)
- `scene-package.json`
- `scene.template.yaml`
- `template.manifest.json`

2. Ontology model
- domain entities
- relations
- business rules
- decision logic

3. Adapter extension contract
- validated against:
  - `docs/interactive-customization/adapter-extension-contract.schema.json`

4. Governance profile
- risk baseline
- approval baseline
- blocked action baseline

## Onboarding Steps

1. Domain discovery
- Identify top business scenes and critical entities.

2. Capability mapping
- Map domain capabilities to canonical capability names.
- Extend lexicon aliases if required.

3. Template authoring
- Build scene-package templates with ontology + governance completeness.

4. Adapter onboarding
- Implement adapter contract (`capabilities/plan/validate/apply/rollback`).

5. Gate alignment
- Run interactive plan gate and ontology quality gate.

6. Pilot rollout
- Start with suggestion mode and low-risk one-click apply only.

7. Release and observability
- Track adoption/success/rollback/intercept metrics.

## Non-Negotiable Constraints

- Core gate decisions remain `allow | review-required | deny`.
- High-risk actions cannot bypass approval.
- Execution and rollback records must be append-only auditable.
- Domain_Pack extension must not require bypass flags by default.

## Recommended Evidence Output

- Domain capability matrix report.
- Ontology baseline report.
- Interactive execution ledger sample.
- Rollback trace sample.
