# 设计文档：Spec Gate Standardization

## 概述

本设计在 `107` 基础上引入 RulePack + Policy + Score 的统一框架，目标是将 `spec gate` 从“单命令检查”升级为“治理平台能力”。

## 架构组件

1. **GateEngine**
- 编排规则执行、聚合结果、计算评分与结论

2. **RuleRegistry**
- 管理规则集与规则实现

3. **PolicyLoader**
- 加载并校验 Gate_Policy（默认 + 项目覆盖）

4. **ResultEmitter**
- 终端输出、JSON 输出、报告落盘

## 统一结果模型

```json
{
  "spec_id": "111-00-spec-gate-standardization",
  "run_id": "...",
  "decision": "conditional-go",
  "score": 78,
  "rules": [
    { "id": "mandatory", "passed": true, "score": 30 }
  ],
  "failed_checks": [],
  "next_actions": []
}
```

## 策略模型（示例）

```json
{
  "version": 1,
  "thresholds": { "go": 90, "conditional_go": 70 },
  "strict_mode": { "warning_as_failure": true },
  "rules": {
    "mandatory": { "enabled": true, "weight": 30, "hard_fail": true },
    "tests": { "enabled": true, "weight": 25, "hard_fail": true },
    "docs": { "enabled": true, "weight": 15 },
    "config_consistency": { "enabled": true, "weight": 15 },
    "traceability": { "enabled": true, "weight": 15 }
  }
}
```

## 文件与变更点

- `lib/spec-gate/engine/*`（新）
- `lib/spec-gate/rules/*`（新）
- `lib/spec-gate/policy/*`（新）
- `lib/commands/spec-gate.js`（增强）
- `tests/spec-gate/*`（扩展）

