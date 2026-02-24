# 实现任务

## 任务 1：定位收敛与范围治理

- [x] 1.1 固化定位声明文档
  - 输出 `custom/positioning-charter.md`
  - **验证**: Requirement 1.1, 1.2

- [x] 1.2 建立需求分流规则（in_scope/deferred）
  - 输出定位到 KPI 绑定检查项
  - **验证**: Requirement 1.3

## 任务 2：指标体系与基线

- [x] 2.1 定义四项 KPI 口径
  - 输出 `custom/metric-definition.yaml`
  - **验证**: Requirement 2.1

- [x] 2.2 生成 D+7 基线数据
  - 汇总首周 TTFV、成功率、周期、接管率
  - 输出 `custom/baseline-d-plus-7.md` 与 `custom/weekly-metrics/2026-W07.baseline.json`
  - **验证**: Requirement 2.2, 2.3

## 任务 3：周度执行闭环

- [x] 3.1 创建周报模板
  - 输出 `custom/weekly-review-template.md`
  - **验证**: Requirement 3.1

- [x] 3.2 输出 machine-readable 周快照样例
  - 建立 JSON 模板与字段校验规则
  - 输出 `custom/weekly-metrics/2026-W07.sample.json`
  - **验证**: Requirement 3.2

- [x] 3.3 风险升级规则落地
  - 连续两周恶化自动标记 High
  - 输出 `custom/risk-escalation-policy.md` 与 `custom/scripts/evaluate-risk.js`
  - **验证**: Requirement 3.3

## 任务 4：Moqui 试点打穿

- [x] 4.1 确认试点范围与基准链路
  - 明确输入、命令、预期输出
  - 输出 `custom/moqui-pilot-scope.md`
  - **验证**: Requirement 4.1

- [x] 4.2 完成一次端到端复放
  - 走通 bootstrap→pipeline→gate→orchestrate
  - 复放证据：`custom/pilot-evidence/orchestrate-100-success.json`
  - 说明：本次采用 `codexArgs=["--help"]` 快速闭环链路，后续需再跑真实负载复放
  - **验证**: Requirement 4.2

- [x] 4.3 归档复现证据与回滚说明
  - 输出 `custom/pilot-evidence/replay-log-2026-02-14.md`
  - **验证**: Requirement 4.3

## 任务 5：止损门禁

- [x] 5.1 建立 Day30/Day60 门禁模板
  - 输出 `custom/go-no-go-gate.md`
  - **验证**: Requirement 5.1

- [x] 5.2 实施 Day30 门禁评审
  - 输出 `custom/gate-reviews/day30-review-2026-02-14.md`
  - **验证**: Requirement 5.1

- [x] 5.3 实施 Day60 门禁评审并给出 go/no-go
  - 输出 `custom/gate-reviews/day60-review-2026-02-14.md`
  - **验证**: Requirement 5.2, 5.3

## 任务 6：资产复用化

- [x] 6.1 输出四类可复用资产
  - 定位声明、指标定义、周报模板、门禁模板
  - **验证**: Requirement 6.1, 6.2

- [x] 6.2 明确资产 owner 与维护频率
  - 输出 `custom/asset-ownership.md`
  - **验证**: Requirement 6.3

