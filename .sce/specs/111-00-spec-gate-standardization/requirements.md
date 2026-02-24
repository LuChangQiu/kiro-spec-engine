# 需求文档

## 简介

`107-00-spec-gate-command` 已定义基础闸口能力，但在多 Agent 协作和跨模块联动场景下，需要进一步标准化规则、评分、输出契约。

本 Spec 目标是将 Spec Gate 升级为统一治理底座，支持稳定收敛与可审计发布决策。

## 术语表

- **Gate_Rule_Pack**：闸口规则集
- **Gate_Score**：闸口评分
- **Gate_Decision**：闸口结论（go / conditional-go / no-go）
- **Gate_Policy**：规则配置策略文件

## 需求

### 需求 1：规则集标准化

**用户故事：** 作为平台维护者，我希望 gate 规则可配置、可扩展，而非硬编码。

#### 验收标准

1. THE SYSTEM SHALL 支持规则集注册与启停
2. THE 默认规则集 SHALL 包含 mandatory、test、docs、config-consistency、traceability
3. THE 规则执行结果 SHALL 统一为标准结果对象

### 需求 2：评分与结论标准化

**用户故事：** 作为发布负责人，我希望 gate 结论有明确评分依据。

#### 验收标准

1. THE SYSTEM SHALL 输出 Gate_Score 与各规则子项得分
2. THE SYSTEM SHALL 按策略阈值给出 go/conditional-go/no-go
3. THE `--strict` 模式 SHALL 可覆盖默认阈值策略

### 需求 3：策略配置标准化

**用户故事：** 作为团队管理员，我希望不同项目可定制 gate 策略，同时保持统一格式。

#### 验收标准

1. THE SYSTEM SHALL 支持统一 Gate_Policy 文件格式
2. THE Gate_Policy SHALL 支持规则权重、阈值、强制失败项配置
3. THE SYSTEM SHALL 提供策略模板生成能力

### 需求 4：跨模块可消费输出

**用户故事：** 作为自动化系统调用方，我希望 gate 结果能被 orchestrate/scene/auto 直接消费。

#### 验收标准

1. THE SYSTEM SHALL 输出机器可读 JSON 结果
2. THE 输出 SHALL 包含 `spec_id`、`run_id`、`decision`、`score`、`failed_checks`、`next_actions`
3. THE 输出 SHALL 支持报告落盘与后续流程引用

