# Value 可观测指南

> 使用 `kse value metrics` 将 Spec 交付变成可量化、可审计的周度结果。

---

## 为什么这很重要

很多 AI 开发流程可以“产出代码”，但难以回答：

- 本周是否比上周交付更快？
- 质量是在改善还是恶化？
- Day30/Day60 是否应该放行？

kse 通过机器可读 KPI 快照、基线生成、趋势分析和门禁摘要，解决以上问题。

---

## 三条命令跑通 KPI 流程

```bash
# 1) 生成当周快照
kse value metrics snapshot --input ./kpi-input.json --period 2026-W10 --checkpoint day-60 --json

# 2) 从最早历史快照生成 baseline
kse value metrics baseline --from-history 3 --period 2026-W10 --json

# 3) 基于最近窗口输出趋势与风险
kse value metrics trend --window 6 --json
```

---

## 最小输入示例

创建 `kpi-input.json`：

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

## 周度运行节奏（建议）

1. 每周主要交付批次完成后执行一次 `snapshot`。
2. 当流程或范围发生明显变化时重建 baseline。
3. Day30/Day60 决策前执行 `trend`。
4. 将输出 JSON 作为评审证据附在周报/门禁记录中。

---

## 你将获得

- **可审计**：每次计算都有输入输出可追溯。
- **可比较**：跨周、跨 Agent 使用统一指标口径。
- **可门禁复用**：直接生成 Day30/Day60 可消费的决策输入。
- **可行动**：风险触发原因清晰，不再依赖主观判断。

---

## 相关文档

- [命令参考](../command-reference.md#value-metrics)
- [快速入门](quick-start.md)
- [Spec 工作流](../spec-workflow.md)
