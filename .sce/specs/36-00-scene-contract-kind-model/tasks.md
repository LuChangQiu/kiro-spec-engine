# Implementation Plan: Scene Contract and Kind Model

## Phase 1: Baseline and Scope

- [x] 1 Define problem framing and design target
  - Confirm why scene layer is needed above spec layer.
  - Confirm scene as composite capability boundary.

- [x] 2 Draft v1 requirements for unified kind model
  - Define required kinds and acceptance criteria.
  - Define data alignment and governance requirements.

- [x] 3 Draft v1 design for execution and governance
  - Define shared object envelope.
  - Define namespace and collision prevention strategy.

## Phase 2: Contract and Schema Standards

- [x] 4 Define common object envelope schema
  - Create common required fields and lifecycle semantics.
  - Define relation types and constraints.
  - Output: custom/scene-contract-v0.1.md

- [x] 5 Define kind-specific extension schemas
  - Scene schema extension.
  - Spec/Template/DataContract/Policy/Eval schema extension.
  - Output: custom/scene-contract-v0.1.md

- [x] 6 Define Moqui binding rules
  - Canonical Entity.field reference format.
  - Type compatibility matrix (Moqui field-type -> contract type).
  - Framework-managed field handling (for example lastUpdatedStamp).
  - Output: custom/moqui-binding-rules-v0.1.md

## Phase 3: Pilot Scene Composition

- [x] 7 Select first pilot scene domain
  - Choose one high-value domain flow.
  - Define measurable success criteria.
  - Output: custom/pilot-priority-and-template-gate-v0.1.md

- [x] 8 Map pilot scene to existing specs
  - Build Scene -> Spec relation graph.
  - Identify missing capability specs.
  - Output: custom/pilot-scene-spec-mapping-v0.2.md

- [x] 9 Define pilot DataContract and Policy
  - Define read/write sets.
  - Define invariants and state transitions.
  - Define risk and approval rules.
  - Output: custom/pilot-datacontract-policy-v0.2.md

- [x] 10 Define pilot Eval contract
  - Define KPI metrics and thresholds.
  - Define functional correctness checks.
  - Output: custom/pilot-eval-contract-v0.2.md

## Phase 4: Operationalization

- [x] 11 Define Plan IR interface contract
  - Define node types and execution metadata.
  - Define dry-run vs commit semantics.
  - Output: custom/plan-ir-interface-v0.2.md

- [x] 12 Define governance and audit event schema
  - Define evidence bundle structure.
  - Define execution lineage and replay metadata.
  - Output: custom/governance-audit-schema-v0.2.md

- [x] 13 Draft migration and compatibility guide
  - Define legacy spec coexistence strategy.
  - Define domain-by-domain rollout path.
  - Output: custom/migration-compatibility-guide-v0.2.md

## Phase 5: Multi-Ecosystem Adaptation (ERP + Robot)

- [x] 14 Review requirements, design, and tasks with stakeholder context
  - Consolidate review points from iterative discussion.
  - Record baseline assumptions for next execution spec.

- [x] 15 Accept pilot scene contract standard as v1 baseline
  - Freeze v0.1/v0.2 contract bundle as reference set.
  - Lock naming, policy, and evidence conventions.

- [x] 16 Create next execution spec from this standard
  - Create execution-focused follow-up spec.
  - Output: ../37-00-scene-runtime-execution-pilot/

- [x] 17 Define dual-ecosystem architecture baseline
  - Clarify control-plane vs adapter responsibilities.
  - Define hard safety boundary for robot real-time control.
  - Output: custom/dual-ecosystem-architecture-v0.2.md

- [x] 18 Define domain policy matrix for erp/robot/hybrid scenes
  - Define risk and approval mapping by domain and operation class.
  - Define mandatory safety guards and evidence minimum.
  - Output: custom/domain-policy-matrix-v0.2.md

- [x] 19 Draft hybrid scene manifest example
  - Provide reference structure for ERP + robot orchestration.
  - Include compensation and observability baseline.
  - Output: custom/hybrid-scene-example-v0.2.md

- [x] 20 Map robot adapter interface contract to target stack
  - Define required adapter capabilities, callback events, and timeout model.
  - Define dispatch/cancel/status command contract with idempotency keys.
  - Output: custom/robot-adapter-interface-contract-v0.2.md

- [x] 21 Define first hybrid pilot and safety drill checklist
  - Select one hybrid pilot scene with low operational blast radius.
  - Define dry-run to commit promotion criteria and rollback drill.
  - Output: custom/hybrid-pilot-and-safety-drill-v0.2.md

## Completion Criteria

- [x] 22 Requirements, design, and tasks are aligned and review-ready.
- [x] 23 Pilot scene contract standard is accepted as baseline.
- [x] 24 Execution follow-up spec is created for implementation phase.
