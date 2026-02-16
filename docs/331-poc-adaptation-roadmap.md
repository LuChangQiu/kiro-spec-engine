# 331-poc 适配持续推进路线图（KSE 侧）

> 范围：`kiro-spec-engine` 侧围绕 331-poc handoff 的持续适配工作，不包含 331 业务实现本身。

## 已完成（本轮）

1. 新增 handoff 自动化命令：
   - `kse auto handoff plan`
   - `kse auto handoff queue`
2. 将 handoff manifest 解析为可执行阶段计划（precheck/spec validation/execution/observability）。
3. 将 handoff manifest 生成 close-loop-batch 目标队列（支持 dry-run、append、known-gaps 开关）。
4. 补齐单测覆盖（plan/queue/dry-run 分支）。
5. 更新命令参考与中英文文档入口。

## 下一阶段（P1）

1. 新增 `kse auto handoff run`：
   - 一条命令串行执行 `plan -> queue -> close-loop-batch -> observability`。
   - 支持 `--dry-run` 与失败自动中断。
2. 新增 handoff 结果归档：
   - 输出 `.kiro/reports/handoff-runs/<session>.json`。
   - 汇总每个 spec 的校验状态与阻塞项。
3. 增加 handoff 门禁策略：
   - `--min-spec-success-rate`
   - `--max-risk-level`
   - `--require-ontology-validation`

## 中期增强（P2）

1. 将 handoff 批次映射为主从 agent 编排输入：
   - 根据 spec 依赖自动分批并发。
2. 引入 template 差异检测：
   - 对比 handoff 模板与本地模板库差异。
3. 增加跨轮次回归分析：
   - 对比本轮与上轮 handoff 的质量、风险与收敛速度。

## 长期目标（P3）

1. 抽象成通用“外部项目 handoff 适配框架”（不只 331-poc）。
2. 与 release evidence 合并，形成可发布的治理报表。
3. 将 handoff 质量指标纳入 `kse auto governance close-loop` 的默认评估维度。
