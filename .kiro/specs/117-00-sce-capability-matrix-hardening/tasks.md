# 实现任务：SCE 核心能力矩阵增强

## 任务 1：策略路由基线（需求 1）

- [x] 1.1 新增策略路由脚本 `scripts/auto-strategy-router.js`
  - 支持输出 `answer_only|code_change|code_fix|rollback`
  - 输出 reasons 与 next_actions

- [x] 1.2 新增策略基线配置
  - `docs/agent-runtime/strategy-routing-policy-baseline.json`

- [x] 1.3 补充单测
  - `tests/unit/scripts/auto-strategy-router.test.js`

## 任务 2：符号级定位（需求 2）

- [ ] 2.1 定义 Symbol_Evidence 输出契约（json schema + 示例）
- [ ] 2.2 实现 symbol locator 脚本（支持 query -> hits）
- [ ] 2.3 补充单测与无证据阻断逻辑

## 任务 3：失败归因与有界修复（需求 3）

- [ ] 3.1 定义 Failure_Taxonomy（含默认类别与映射规则）
- [ ] 3.2 实现单次 Repair_Pass 执行器（失败后仅再修一次）
- [ ] 3.3 增加修复后复测与失败摘要输出

## 任务 4：模板与 ontology 映射（需求 4）

- [ ] 4.1 定义 Capability_Mapping 报告契约
- [ ] 4.2 实现变更到 scene template/ontology 的映射提取
- [ ] 4.3 生成缺口 remediation 建议列表

## 任务 5：多 agent 协同策略（需求 5）

- [x] 5.1 新增主从协同基线策略
  - `docs/agent-runtime/multi-agent-coordination-policy-baseline.json`

- [ ] 5.2 在 orchestrate 路径中强制子 agent 摘要契约
- [ ] 5.3 在主 agent 合并阶段启用摘要驱动决策

## 任务 6：文档与路线图

- [x] 6.1 新增能力矩阵路线图文档
  - `docs/sce-capability-matrix-roadmap.md`

- [ ] 6.2 在命令参考文档补充策略路由与后续 symbol/failure/capability-mapping 入口
- [ ] 6.3 形成一次端到端示例（问题输入 -> 策略决策 -> 执行结果）
