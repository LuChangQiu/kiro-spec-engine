# 需求文档：SCE 核心能力矩阵增强

## 简介

本 Spec 聚焦 SCE 下一阶段的 5 项核心能力补齐：

1. 任务分解与策略选择（何时改代码、何时只答复、何时回滚）
2. 代码检索/符号级定位（减少答非所问）
3. 失败归因与自修复策略（失败后可控再修一次）
4. 场景模板与 ontology 映射（跨项目复用）
5. 多 agent 协同策略（主从分工、并行上限、结果汇总）

目标是把“已有能力点”升级为“可组合、可配置、可审计”的标准化能力矩阵。

## 术语

- **Strategy_Router**: 基于输入上下文选择 `answer_only|code_change|code_fix|rollback` 的策略路由器。
- **Symbol_Evidence**: 符号级定位证据，至少包含文件、行号、命中片段和置信度。
- **Failure_Taxonomy**: 失败归因分类（依赖/编译/测试/环境/策略门禁等）。
- **Repair_Pass**: 针对失败归因执行的单次修复尝试。
- **Capability_Mapping**: 将项目变更映射到 scene template/ontology 的复用能力图。
- **Role_Policy**: 多 agent 主从职责与合并决策规则。

## 需求

### 需求 1：任务分解与策略选择

**用户故事：** 作为执行代理，我希望在进入执行前明确动作策略，避免盲目改动。

#### 验收标准

1. THE Strategy_Router SHALL 输出四类互斥决策：`answer_only`、`code_change`、`code_fix`、`rollback`。
2. THE Strategy_Router SHALL 输出决策原因（reasons）与下一步动作建议（next_actions）。
3. WHEN 上下文无法支持安全改动时 THEN 系统 SHALL 默认回落到 `answer_only`。

### 需求 2：代码检索与符号级定位

**用户故事：** 作为执行代理，我希望基于符号证据而不是猜测改代码。

#### 验收标准

1. THE Symbol locator SHALL 支持根据查询条件输出符号级候选位置（文件+行号）。
2. THE 输出 SHALL 包含可审计证据字段（命中内容、来源、置信度）。
3. WHEN 未找到可靠符号证据时 THEN 系统 SHALL 阻止高风险写入并回退到解释模式。

### 需求 3：失败归因与自修复策略

**用户故事：** 作为执行代理，我希望失败后能自动定位并进行一次有界修复。

#### 验收标准

1. THE 系统 SHALL 将失败归类到 Failure_Taxonomy。
2. WHEN 归因可修复时 THEN 系统 SHALL 触发一次 Repair_Pass 并复测。
3. WHEN Repair_Pass 仍失败时 THEN 系统 SHALL 输出可审计失败摘要并停止无限重试。

### 需求 4：场景模板与 ontology 映射

**用户故事：** 作为平台架构师，我希望项目改动可以沉淀为可复用场景能力。

#### 验收标准

1. THE 系统 SHALL 支持从项目变更提取 capability 映射到 scene template 与 ontology 实体/规则/决策节点。
2. THE 映射结果 SHALL 输出 machine-readable 报告，可用于后续模板沉淀与补齐。
3. WHEN 映射缺口存在时 THEN 系统 SHALL 生成 remediation 建议列表。

### 需求 5：多 agent 协同策略

**用户故事：** 作为主 agent，我希望主从协同可控且结果可汇总。

#### 验收标准

1. THE 系统 SHALL 定义主 agent 与子 agent 的职责边界。
2. THE 编排策略 SHALL 支持并行上限与限流自适应策略。
3. 每个子 agent 完成后 SHALL 产出统一结果摘要契约，主 agent 基于摘要执行合并决策。
