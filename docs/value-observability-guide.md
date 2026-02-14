# Value Observability Guide

> Turn Spec delivery into measurable weekly outcomes with `kse value metrics`.

---

## Why This Matters

Most AI-assisted workflows can ship code, but they often cannot answer:

- Are we delivering faster this week than last week?
- Is quality improving or degrading?
- Should we pass Day30/Day60 gate based on evidence?

kse solves this with machine-readable KPI snapshots, baseline derivation, trend analysis, and gate-ready summaries.

---

## KPI Workflow in 4 Commands

```bash
# 0) Generate sample input (first-time setup)
kse value metrics sample --out ./kpi-input.json --period 2026-W10 --json

# 1) Snapshot this week
kse value metrics snapshot --input ./kpi-input.json --period 2026-W10 --checkpoint day-60 --json

# 2) Build baseline from earliest history snapshots
kse value metrics baseline --from-history 3 --period 2026-W10 --json

# 3) Analyze trend risk from latest snapshots
kse value metrics trend --window 6 --json
```

---

## Minimal Input Example

If you do not use the `sample` command, create `kpi-input.json` manually:

```json
{
  "period": "2026-W10",
  "metrics": {
    "ttfv_minutes": 25,
    "batch_success_rate": 0.86,
    "cycle_reduction_rate": 0.34,
    "manual_takeover_rate": 0.16
  },
  "notes": "weekly review snapshot"
}
```

---

## Expected JSON Output

`snapshot --json` returns a compact machine-readable summary:

```json
{
  "success": true,
  "period": "2026-W10",
  "risk_level": "medium",
  "triggered_metrics": [
    "manual_takeover_rate"
  ],
  "snapshot_path": ".kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/2026-W10.json",
  "gate_summary_path": ".kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/gate-summary.2026-W10.day-60.json",
  "contract_path": "metric-definition.yaml"
}
```

`trend --json` returns range, risk, and per-metric direction:

```json
{
  "success": true,
  "period": "2026-W10",
  "window_size": 3,
  "range": {
    "from": "2026-W08",
    "to": "2026-W10"
  },
  "risk_level": "high",
  "triggered_metrics": [
    "ttfv_minutes"
  ],
  "metrics": [
    {
      "metric_id": "ttfv_minutes",
      "delta": 3,
      "trend": "up",
      "better_direction": "lower",
      "status": "degraded",
      "target_passed": true
    }
  ],
  "trend_path": ".kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/trend.latest.json"
}
```

---

## Weekly Operating Cadence

1. Run `snapshot` once per week after major delivery batch.
2. Regenerate baseline when process or scope changes materially.
3. Run `trend` before Day30/Day60 decision review.
4. Attach generated JSON files to review notes as evidence.

---

## What You Get

- **Auditability**: Full input/output trace for each KPI run.
- **Comparability**: Same metric contract across weeks and agents.
- **Gate-readiness**: Directly consumable decision payload for Day30/Day60.
- **Operational focus**: Risk reasons are explicit, not subjective.

---

## Related Docs

- [Command Reference](command-reference.md#value-metrics)
- [Quick Start Guide](quick-start.md)
- [Spec Workflow](spec-workflow.md)
