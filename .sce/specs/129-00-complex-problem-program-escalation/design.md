# Design

## Decision

Treat this as a strategy-layer capability above existing Spec, orchestrate, and close-loop-program execution.

The key missing piece in current SCE is not execution runtime.
It is the escalation policy that decides whether the current problem should stay in one Spec or be converted into a coordinated program.

## Current State Assessment

SCE already has strong building blocks:

- single Spec workflow with domain-first artifacts
- multi-Spec orchestrate fallback
- autonomous close-loop program decomposition
- program governance and telemetry

What is still missing:

- a formal complexity audit
- explicit escalation thresholds
- a research-first path for problems that are still too unclear for direct implementation splitting
- a stable report explaining why one Spec is insufficient

## Design Principles

### 1. Clarification before decomposition

Do not decompose just because a problem is large.

Decomposition quality depends on:

- whether the business scene is understood
- whether boundaries are identifiable
- whether interfaces are stable enough
- whether policy/rule conflicts are visible

If these are still unclear, the right answer is not "more implementation Specs".
The right answer is a research-first program.

### 2. No blind fallback

SCE must not use program mode as a lazy fallback for uncertainty.

Escalation should be driven by explicit evidence signals such as:

- repeated Spec churn
- unstable task decomposition
- unresolved interface topology
- multiple domain chains in one problem
- conflicting scene ownership

### 3. Reuse existing execution planes

This strategy layer should feed existing runtime surfaces:

- single-spec -> `spec bootstrap|pipeline|gate`
- multi-spec-program -> `orchestrate` or structured multi-Spec execution
- research-program -> a planned program portfolio that may later feed orchestrate or close-loop-program

No second runtime should be introduced.

## Escalation Model

### Decision output

The strategy layer should output one of:

- `single-spec`
- `multi-spec-program`
- `research-program`

### Complexity dimensions

Recommended dimensions:

- `scene_span`
- `domain_span`
- `contract_clarity`
- `policy_clarity`
- `dependency_entanglement`
- `ownership_clarity`
- `verification_readiness`
- `decomposition_stability`

Each dimension should support:

- score
- reason
- supporting evidence

### Example interpretation

- high clarity + one bounded context -> `single-spec`
- high clarity + multiple implementation tracks -> `multi-spec-program`
- low clarity + multiple domains/contracts/rules unresolved -> `research-program`

## Proposed report contract

```json
{
  "mode": "spec-complexity-strategy",
  "decision": "research-program",
  "summary": {
    "single_spec_fit": false,
    "reason_count": 4,
    "recommended_program_specs": 5
  },
  "dimensions": [
    {
      "key": "domain_span",
      "score": 5,
      "level": "high",
      "reason": "multiple independent domain chains are still coupled",
      "evidence": ["problem-domain-chain shows 3 clusters"]
    }
  ],
  "signals": [
    "requirements-design churn remains high",
    "api contract mismatches still unresolved",
    "single spec cannot produce stable executable tasks"
  ],
  "recommended_topology": {
    "type": "research-first-master-sub",
    "tracks": [
      "domain-clarification",
      "contract-clarification",
      "policy-clarification",
      "implementation-decomposition",
      "verification-strategy"
    ]
  },
  "next_actions": [
    "create a master program spec",
    "split clarification specs before implementation specs",
    "run domain coverage before task execution"
  ]
}
```

## Strategy flow

### Step 1. Assess current problem

Inputs may come from:

- user goal
- current Spec artifacts
- domain coverage artifacts
- task stability / churn signals
- contract mismatch findings

### Step 2. Evaluate single-Spec fitness

If one Spec can still produce:

- coherent requirements
- stable design
- executable tasks
- clear verification path

then remain `single-spec`.

### Step 3. Distinguish implementation-program vs research-program

If the problem is broad but already clear:

- choose `multi-spec-program`

If the problem is broad and still unclear:

- choose `research-program`

### Step 4. Output recommended portfolio

The output should define:

- whether a master Spec is needed
- what child Specs are recommended
- which are clarification Specs vs implementation Specs
- execution order and blocking dependencies

## Suggested future command surface

This Spec does not require immediate CLI changes, but the most natural future surface is one of:

- `sce spec strategy assess --goal "<goal>" --json`
- `sce studio plan --strategy-assess ...`
- integration into `sce auto close-loop` preflight

Preferred path:

1. add a read-only assessment command first
2. validate report usefulness
3. only then consider automatic escalation hooks

## Non-goals

- not every multi-Spec task becomes a research program
- do not auto-create program portfolios without evidence
- do not bypass domain-first research artifacts
- do not silently rewrite existing steering or Spec structures
