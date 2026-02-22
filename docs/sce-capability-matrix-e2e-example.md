# SCE Capability Matrix E2E Example

This example shows one complete execution chain:

`input -> strategy decision -> symbol evidence -> failure attribution -> capability mapping -> multi-agent summary merge`

## 1) Input and Strategy Decision

```bash
node scripts/auto-strategy-router.js \
  --input '{"goal_type":"bugfix","requires_write":true,"test_failures":1,"changed_files":1}' \
  --policy-file docs/agent-runtime/strategy-routing-policy-baseline.json \
  --json
```

Expected decision: `code_fix` with reasons and next actions.

## 2) Symbol Evidence Gate

```bash
node scripts/symbol-evidence-locate.js \
  --workspace . \
  --query "approve order" \
  --strict \
  --json
```

Expected:
- reliable evidence => `fallback_action=allow_write`
- no reliable evidence => `fallback_action=block_high_risk_write` and exit code `2`

## 3) Failure Attribution and Bounded Repair

```bash
node scripts/failure-attribution-repair.js \
  --error "Cannot find module @acme/order-core" \
  --attempted-passes 0 \
  --max-repair-passes 1 \
  --tests "npm run test -- order-service" \
  --json
```

Expected:
- classification into `Failure_Taxonomy`
- at most one `run_repair_pass`
- terminal stop summary when budget is exhausted or category is non-repairable

## 4) Capability Mapping (Template + Ontology)

Prepare `mapping-input.json`:

```json
{
  "changes": [
    { "type": "entity", "name": "Order" },
    { "type": "business_rule", "name": "credit-check" }
  ],
  "templates": [
    { "id": "scene-moqui-order-core", "capabilities": ["entity:order"] }
  ],
  "ontology": {
    "entities": [{ "name": "Order" }],
    "business_rules": []
  }
}
```

Run report:

```bash
node scripts/capability-mapping-report.js \
  --input-file mapping-input.json \
  --json
```

Expected:
- `mapping_report[]`
- `missing_capabilities[]`
- `recommended_templates[]`
- `ontology_gaps[]`

## 5) Multi-Agent Merge Summary Contract

During `sce orchestrate run`, sub-agent completion is validated against:

- `docs/agent-runtime/agent-result-summary-contract.schema.json`
- `docs/agent-runtime/multi-agent-coordination-policy-baseline.json`

If `require_result_summary=true`, merge is blocked when:
- summary is missing/invalid
- `tests_passed < tests_run` (when enabled)
- unresolved conflict issues are reported (when enabled)

This enforces summary-driven, auditable merge decisions.
