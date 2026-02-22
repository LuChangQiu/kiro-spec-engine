# SCE Capability Matrix Roadmap

This roadmap consolidates the next capability uplift priorities for SCE and maps each item to concrete deliverables.

## Priority Matrix

| Capability | Current State | Gap | Next Deliverables |
| --- | --- | --- | --- |
| Task decomposition and strategy selection | `auto close-loop`, `orchestrate`, release gates already exist | Missing explicit machine-readable strategy router for `answer_only/code_change/rollback` | `scripts/auto-strategy-router.js` + baseline policy + command-reference integration |
| Code retrieval and symbol-level localization | `rg`-style file search is common; orchestration has status tracking | Missing unified symbol locator contract and ranked evidence payload | add `symbol-locate` utility + evidence schema + tests |
| Failure attribution and self-repair | retry/backoff and recovery loops already exist in multiple flows | Missing normalized root-cause taxonomy and bounded second-pass repair contract | add failure taxonomy schema + first/second-pass repair pipeline adapter |
| Scene template and ontology mapping | strong scene + ontology stack exists (`scene lint/score/ontology`) | Missing cross-project mapping report from runtime changes to ontology/template assets | add mapping report generator and remediation queue sync |
| Multi-agent coordination strategy | orchestrator + rate-limit adaptive controls already online | Missing explicit primary/sub-agent role policy and merge-summary contract | baseline policy + required result-summary validation in orchestration path |

## Current Baseline Artifacts (This Iteration)

- `scripts/auto-strategy-router.js`
- `scripts/symbol-evidence-locate.js`
- `scripts/failure-attribution-repair.js`
- `scripts/capability-mapping-report.js`
- `docs/agent-runtime/strategy-routing-policy-baseline.json`
- `docs/agent-runtime/symbol-evidence.schema.json`
- `docs/agent-runtime/failure-taxonomy-baseline.json`
- `docs/agent-runtime/capability-mapping-report.schema.json`
- `docs/agent-runtime/agent-result-summary-contract.schema.json`
- `docs/agent-runtime/multi-agent-coordination-policy-baseline.json`
- `docs/sce-capability-matrix-e2e-example.md`

## Execution Plan

1. Phase 1: Strategy and safety routing
   - ship strategy router and policy file integration in autonomous entrypoints.
2. Phase 2: Symbol evidence pipeline
   - provide deterministic `query -> symbols -> evidence` payload for repair and explanation flows.
3. Phase 3: Failure attribution and bounded self-repair
   - classify failures, apply one focused patch pass, rerun scoped tests, stop on bounded retries.
4. Phase 4: Scene/Ontology cross-project mapping
   - generate actionable mapping deltas from project changes to reusable scene assets.
5. Phase 5: Multi-agent merge governance
   - enforce result summary contract and role-based decision merge.

## Success Criteria

- Strategy router decision accuracy >= 90% on curated regression fixture set.
- Symbol localization response includes at least one valid evidence hit for >= 95% supported queries.
- Self-repair flow reduces unresolved test failures by >= 30% in bounded second-pass runs.
- Scene/Ontology mapping report generated for every release candidate.
- Multi-agent runs produce complete role-tagged result summary payloads for 100% completed sub-agents.
