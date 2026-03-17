# Requirements

## Overview

SCE already supports:

- single-spec execution
- multi-spec orchestrate execution
- autonomous `close-loop-program` master/sub decomposition

But the current gap is strategic, not mechanical.

When a problem is too broad, too entangled, or too research-heavy for one Spec, SCE should not keep forcing it through a single-spec path.
It should detect that the problem needs program-level planning and decomposition first, then guide the user or runtime toward a coordinated multi-Spec solution.

This Spec defines how SCE should recognize that threshold and what output contract it should produce.

## Goal

Create a complexity-to-program escalation strategy so SCE can decide when a problem should remain:

- a single Spec
- a coordinated multi-Spec portfolio
- a research-first program that later yields executable Specs

The core objective is to reduce blind decomposition and prevent overloading one Spec with a problem that still needs system-level disentangling.

## Functional Requirements

### FR1. Complexity assessment before decomposition

SCE SHALL support a structured complexity assessment phase before deciding whether one Spec is enough.

The assessment SHALL consider at least:

- business scene count
- bounded context / domain count
- frontend-backend / interface mismatch count
- dependency fan-out
- unresolved policy/rule count
- unknown ownership or responsibility areas
- evidence gaps that block implementation confidence

### FR2. Escalation decision modes

SCE SHALL support three explicit decomposition decisions:

1. `single-spec`
2. `multi-spec-program`
3. `research-program`

`research-program` means the problem is not yet ready for direct implementation decomposition and must first be broken into investigation and clarification Specs.

### FR3. Trigger conditions for program escalation

SCE SHALL define concrete trigger signals that recommend escalation from single Spec to program mode.

Examples of trigger signals:

- a single Spec repeatedly expands but still cannot produce stable executable tasks
- requirements/design churn stays high after one or more refinement rounds
- domain modeling still shows multiple independent problem chains in one Spec
- the problem spans multiple scenes or user roles with conflicting goals
- API/data contracts are still unclear enough that task execution would be guesswork
- the problem requires coordinated analysis across multiple subsystems before implementation can start

### FR4. No blind escalation

SCE SHALL NOT escalate to program mode merely because a problem feels large.

Program escalation SHALL require:

- explicit reasons
- evidence signals
- a recommended decomposition strategy

The output SHALL make clear why single Spec is insufficient.

### FR5. Program strategy output

When SCE recommends `multi-spec-program` or `research-program`, it SHALL output a machine-readable strategy report containing:

- selected mode
- evidence signals
- complexity dimensions and scores
- recommended decomposition topology
- suggested Spec portfolio structure
- blocking unknowns
- immediate next actions

### FR6. Research-first decomposition

When a problem is too unclear for direct implementation splitting, SCE SHALL be able to recommend a research-first portfolio.

That portfolio SHOULD support at least these categories:

- domain clarification
- contract/interface clarification
- policy/rule clarification
- implementation decomposition
- verification and acceptance strategy

### FR7. Preserve existing command surfaces

This capability SHALL reuse and align with existing SCE surfaces where possible:

- `sce spec bootstrap|pipeline|gate`
- `sce orchestrate ...`
- `sce auto close-loop ...`
- `sce auto close-loop-program ...`

This Spec SHALL NOT require introducing a second, parallel execution model.

### FR8. Integration guidance

SCE SHALL document how users and frontends should choose among:

- one Spec
- multiple Specs
- autonomous program mode

The guidance SHALL clearly state that:

- simple problems can stay single-spec
- medium-complexity problems can use Spec decomposition directly
- very complex problems may require program-level research and planning before executable task breakdown

## Acceptance Criteria

1. WHEN a problem contains multiple unresolved domains, interfaces, and policy uncertainties THEN SCE SHALL be able to recommend `research-program` instead of forcing direct single-Spec execution.
2. WHEN a problem spans multiple coherent implementation tracks but is already sufficiently understood THEN SCE SHALL be able to recommend `multi-spec-program`.
3. WHEN a problem is narrow and evidence-complete THEN SCE SHALL recommend `single-spec`.
4. WHEN SCE escalates to program mode THEN it SHALL output explicit evidence and recommended next actions.
5. WHEN a user asks why one Spec is not enough THEN SCE SHALL answer with concrete dimensions and reasons instead of vague size-based language.
6. WHEN program escalation is recommended THEN SCE SHALL stay aligned with existing orchestrate / close-loop-program execution paths rather than inventing another execution plane.
