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

## KPI Workflow in 3 Commands

```bash
# 1) Snapshot this week
kse value metrics snapshot --input ./kpi-input.json --period 2026-W10 --checkpoint day-60 --json

# 2) Build baseline from earliest history snapshots
kse value metrics baseline --from-history 3 --period 2026-W10 --json

# 3) Analyze trend risk from latest snapshots
kse value metrics trend --window 6 --json
```

---

## Minimal Input Example

Create `kpi-input.json`:

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

