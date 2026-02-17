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
6. 新增 `kse auto handoff run`：
   - 一条命令串行执行 `plan -> queue -> close-loop-batch -> observability`。
   - 支持 `--dry-run` 与失败自动中断。
7. 新增 handoff 结果归档：
   - 默认输出 `.kiro/reports/handoff-runs/<session>.json`。
   - 汇总每个 spec 的执行状态与阻塞项。
8. 新增 handoff 门禁策略：
   - `--min-spec-success-rate`
   - `--max-risk-level`
   - `--require-ontology-validation`
9. 新增主从依赖批次执行：
   - 从 manifest `specs[].depends_on` 构建依赖拓扑批次。
   - `handoff run` 默认按依赖批次顺序执行 spec 集成目标。
10. 新增模板差异检测：
   - `kse auto handoff template-diff` 对比 manifest 模板与本地模板库。
11. 新增跨轮次回归分析：
   - `kse auto handoff regression` 对比相邻批次成功率/风险/失败目标/耗时变化。
   - `handoff run` 结果中自动附加 regression 摘要。
12. 新增断点续跑能力：
   - `kse auto handoff run --continue-from <session|latest|file>`。
   - 支持 `--continue-strategy auto|pending|failed-only`。
13. 新增 release evidence 自动归并：
   - `handoff run` 结束后自动将批次结果合并到 `.kiro/reports/release-evidence/handoff-runs.json`。
   - 按 `session_id` 去重更新，失败时写 warning 不阻塞主流程。
14. 新增回归可视化报表增强：
   - `handoff regression` 输出增加 `risk_layers` 风险分层视图（low/medium/high/unknown）。
   - markdown 报表新增 `Trend Series` 与 `Risk Layer View`，支持多轮趋势快速审阅。
15. 新增 release evidence 趋势窗口快照：
   - `handoff run` 支持 `--release-evidence-window <n>`（默认 5）。
   - release evidence 自动写入 `latest_trend_window` 与每个 session 的 `trend_window`，支持发布包一键审阅。
16. 新增 release evidence 快速审阅命令：
   - `kse auto handoff evidence` 直接聚合当前批次 gate/ontology/regression/risk-layer 概览。
   - 支持 JSON/markdown 输出与 `--window` 会话窗口聚合。
17. 新增 release draft 自动生成：
   - `kse auto handoff evidence --release-draft <path>` 一次命令生成 evidence 审阅 markdown + release notes 草稿。
   - 草稿自动注入当前批次 gate/ontology/regression/risk-layer 摘要与证据路径。
18. 新增 CI 发布链路集成：
   - `release.yml` 在 tag 发布时自动尝试基于 `handoff-runs.json` 生成 release notes 草稿。
   - 若证据缺失或生成失败，自动回退到默认 CHANGELOG 引导文案，避免发布流水卡死。
19. 新增 release evidence 附件发布：
   - tag 发布时自动将 release notes 草稿、evidence 审阅 markdown、summary JSON 作为 GitHub Release 资产上传。
   - 无 evidence 时至少上传 fallback notes，保证发布资产结构稳定。
20. 新增可配置发布门禁（workflow 级）：
   - 支持通过 `KSE_RELEASE_*` 仓库变量配置 success rate/risk/ontology 阈值。
   - 支持 advisory（默认）与 enforce（阻断发布）两种模式，且门禁在 `npm publish` 前执行。
21. 新增 release gate 审计产物：
   - 每次 tag 发布生成 `release-gate-<tag>.json`，记录阈值、观测信号、违规项和判定结果。
   - `release-gate` 报告随 GitHub Release 资产一起发布，便于后续追溯。

## 下一阶段（P2）

1. 将 `release-gate-<tag>.json` 聚合为历史索引（跨版本），形成可查询的发布门禁趋势视图。

## 长期目标（P3）

1. 抽象成通用“外部项目 handoff 适配框架”（不只 331-poc）。
2. 与 release evidence 合并，形成可发布的治理报表。
3. 将 handoff 质量指标纳入 `kse auto governance close-loop` 的默认评估维度。
