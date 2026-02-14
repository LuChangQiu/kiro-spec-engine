# 设计文档

## 概述

本设计将“稳定性修复”与“组合收敛策略”放在同一条可验证链路中：

1. 先通过配置一致性修复治理根因
2. 再沉淀多 Spec 组合推进策略
3. 最后用回归检查保证可持续运行

## 设计组件

### 组件 A：组合收敛策略层（Portfolio Convergence Layer）

- 定义 Spec 生命周期：`active`、`deferred`、`archived`
- 定义多 Spec 并行默认执行范式：`orchestrate + gate`
- 定义优先级模型：价值、风险、依赖、阻塞面

### 组件 B：归档目录解析层（Archive Routing Resolver）

- 输入：文件名、项目 `config.specSubdirs`
- 输出：合规目标子目录
- 规则：
  - 命中首选目录则直接使用
  - 首选缺失且有 `custom` 时落到 `custom`
  - 无 `custom` 时使用语义映射（`tests -> scripts`，`results/docs -> reports`）
  - 仍不可用时落到允许目录首项兜底

### 组件 C：历史告警收敛层（Compliance Remediation Layer）

- 批量识别 `misplaced_artifact` 与 `invalid_subdirectory`
- 在不改内容前提下进行位置修复
- 将修复结果回写到 `docs diagnose` / `status --verbose` 观测面

### 组件 D：稳定性回归层（Stability Smoke Layer）

- 单测验证目录分流关键策略
- 命令级验证：`docs diagnose`、`status --verbose`
- 资产化输出检查清单，便于跨环境复跑

## 需求映射

| 需求 | 设计组件 | 说明 |
| --- | --- | --- |
| Requirement 1 | A | 组合收敛策略与默认执行模式 |
| Requirement 2 | B | archive 分流与配置一致性 |
| Requirement 3 | C | 历史告警收敛修复 |
| Requirement 4 | D | 单测与命令回归闭环 |

## 关键设计决策

1. 优先保证“不会再产生无效目录”而不是引入复杂新分类
2. 默认将不兼容目录回落到 `custom`，减少治理冲突
3. 回归验证以“最小但高价值”为原则，避免测试成本膨胀
