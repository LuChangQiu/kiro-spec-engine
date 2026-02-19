# 实现任务：交互式业务定制平台（Moqui 实验）

## 任务 1：契约与门禁基线定义

- [x] 1.1 定义 Change_Intent / Change_Plan / ExecutionRecord 的结构化契约
  - 输出字段规范、状态流转与版本策略
  - 已落地：`docs/interactive-customization/change-intent.schema.json`、`docs/interactive-customization/change-plan.schema.json`、`docs/interactive-customization/execution-record.schema.json`
  - **验证**: Requirement 1, Requirement 2, Requirement 4

- [x] 1.2 定义默认 Guardrail 策略基线
  - 包含权限、敏感数据、凭证、不可逆操作、审批门槛
  - 已落地：`docs/interactive-customization/guardrail-policy-baseline.json` + `scripts/interactive-change-plan-gate.js`
  - **验证**: Requirement 3

- [x] 1.3 定义高风险操作分类清单
  - 形成 low/medium/high 分类与阻断规则
  - 已落地：`docs/interactive-customization/high-risk-action-catalog.json`
  - **验证**: Requirement 2, Requirement 3

## 任务 2：Moqui 实验产品对话入口（阶段 A）

- [ ] 2.1 在 Moqui 实验产品设计页面级 Copilot 接入方案
  - 明确上下文注入边界与脱敏策略
  - **验证**: Requirement 1, Requirement 3

- [x] 2.2 实现只读解释能力（页面、实体、流程、规则）
  - 输出业务可读解释，不触发执行
  - 已落地：`scripts/interactive-intent-build.js`（输出 `.kiro/reports/interactive-page-explain.md`）
  - **验证**: Requirement 1

- [x] 2.3 记录对话与意图审计事件
  - 对话会话、用户、上下文、意图哈希可追溯
  - 已落地：`scripts/interactive-intent-build.js`（追加 `.kiro/reports/interactive-copilot-audit.jsonl`）
  - **验证**: Requirement 3, Requirement 7

## 任务 3：建议模式与审批流（阶段 B）

- [ ] 3.1 实现 Change_Plan 生成与影响分析
  - 输出范围、风险、验证、回滚四类信息
  - **验证**: Requirement 2

- [ ] 3.2 建立审批状态机与审批接口
  - 支持 draft/submitted/approved/rejected/executed/verified
  - **验证**: Requirement 4

- [ ] 3.3 实现高风险强制审批策略
  - high 风险不得跳过审批
  - **验证**: Requirement 2, Requirement 3, Requirement 4

## 任务 4：受控执行与回滚（阶段 C）

- [ ] 4.1 定义并实现 Moqui Adapter 最小执行接口
  - `capabilities/plan/validate/apply/rollback`
  - **验证**: Requirement 5, Requirement 6

- [ ] 4.2 打通低风险一键执行路径
  - 只允许通过策略引擎判定的低风险变更
  - **验证**: Requirement 2, Requirement 4, Requirement 5

- [ ] 4.3 打通回滚与执行报告
  - 输出 diff、执行结果、验证结果、回滚引用
  - **验证**: Requirement 4

## 任务 5：模板沉淀与跨栈扩展准备（阶段 D）

- [ ] 5.1 将 Moqui 实验中稳定变更沉淀为 SCE 模板资产
  - scene-package / ontology / governance contract / playbook
  - **验证**: Requirement 5

- [ ] 5.2 定义通用 Adapter 扩展规范文档
  - 约束能力声明、风险声明、验证回滚接口
  - **验证**: Requirement 6

- [ ] 5.3 设计 Domain_Pack 扩展流程
  - 新行业接入时复用核心门禁，不改安全主流程
  - **验证**: Requirement 6

## 任务 6：持续改进观测与治理

- [ ] 6.1 定义并采集关键治理指标
  - 采纳率、成功率、回滚率、安全拦截率、满意度
  - **验证**: Requirement 7

- [ ] 6.2 输出周期治理报告模板
  - 支持发布评审与策略调优
  - **验证**: Requirement 7

- [ ] 6.3 定义风险阈值告警与处置流程
  - 指标越线自动输出告警与修复建议
  - **验证**: Requirement 7

## 任务 7：发布与验收

- [ ] 7.1 完成 Moqui 实验阶段性验收（A/B/C/D）
  - 每阶段形成可复核证据
  - **验证**: Requirement 5, Requirement 7

- [ ] 7.2 形成“非技术用户可用性”验收报告
  - 包含成功案例、失败案例、改进清单
  - **验证**: Requirement 1, Requirement 7

- [ ] 7.3 形成跨行业复制建议清单
  - 明确通用能力与行业特化边界
  - **验证**: Requirement 6, Requirement 7
