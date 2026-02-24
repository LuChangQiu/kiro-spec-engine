# 设计文档

## 概览

本设计将“继续推进 vs. 及时止损”转成可执行工程机制，核心思路是：

1. 用单一定位约束需求入口
2. 用 4 个 KPI 绑定执行过程
3. 用 30/60 天门禁做 go/no-go 决策

## 目标架构

### 组件 A：定位与范围控制（Positioning Guardrail）

- 输入：新增需求、优化建议、历史 issue
- 处理：按“是否服务 4 个 KPI”进行 triage
- 输出：`in_scope` / `deferred` 决策和理由

### 组件 B：指标口径与采集（Metrics Contract）

- 定义四项 KPI 的公式、数据源、统计窗口
- 每周输出结构化快照（JSON）
- 支持基线、趋势、异常标记

### 组件 C：试点执行流水线（Pilot Execution Lane）

- 固定 Moqui 主线为试点
- 严格通过 `bootstrap → pipeline → gate → orchestrate`
- 保证每次执行可复放、可审计、可回滚

### 组件 D：阶段门禁（Go/No-Go Gate）

- Day 30：中期评估，给出偏差纠正动作
- Day 60：终评估，输出继续投入或降级建议
- 门禁输出包含阈值对照和证据链接

## 数据模型

### KPI 周快照（建议 JSON 结构）

```json
{
  "period": "2026-W07",
  "ttfv_minutes": 28,
  "batch_success_rate": 0.82,
  "cycle_reduction_rate": 0.31,
  "manual_takeover_rate": 0.18,
  "risk_level": "medium",
  "notes": "orchestrate retries increased"
}
```

### 门禁决策记录（建议 JSON 结构）

```json
{
  "checkpoint": "day-60",
  "passed_metrics": 3,
  "total_metrics": 4,
  "decision": "go",
  "evidence": [
    ".sce/specs/112-00-spec-value-realization-program/custom/weekly-review-template.md"
  ]
}
```

## 需求映射

| 需求 | 设计组件 | 说明 |
| --- | --- | --- |
| Requirement 1 | A | 定位收敛与范围治理 |
| Requirement 2 | B | 指标定义与基线采集 |
| Requirement 3 | B, D | 周度可观测 + 风险预警 |
| Requirement 4 | C | 试点场景打穿 |
| Requirement 5 | D | 阶段门禁与止损决策 |
| Requirement 6 | A, B, D | 模板化资产可复用 |

## 执行节奏设计（60 天）

- **Week 1**：确认定位、冻结范围、建立基线
- **Week 2-5**：周度迭代执行与偏差纠正
- **Week 6-8**：冲刺收敛 + Day 60 门禁评审

## 风险与对策

- 风险：指标采集口径不一致
  - 对策：统一定义文件 + 示例数据 + reviewer 复核
- 风险：功能扩张挤压主线资源
  - 对策：新增需求必须绑定 KPI，未绑定即 deferred
- 风险：试点结果不可复现
  - 对策：每次执行强制记录命令、输入、输出、回滚说明

