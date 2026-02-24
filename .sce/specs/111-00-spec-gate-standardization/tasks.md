# 实现任务

## 任务 1：规则框架

- [x] 1.1 实现 RuleRegistry 与规则执行接口
  - 支持启停与规则发现
  - **验证**: Requirement 1

- [x] 1.2 落地默认规则集
  - mandatory、tests、docs、config-consistency、traceability
  - **验证**: Requirement 1

## 任务 2：评分与结论

- [x] 2.1 实现 Gate_Score 聚合逻辑
  - 输出子项与总分
  - **验证**: Requirement 2

- [x] 2.2 实现 Gate_Decision 判定器
  - 支持 strict 模式覆盖
  - **验证**: Requirement 2

## 任务 3：策略配置

- [x] 3.1 定义 Gate_Policy schema 与校验器
  - **验证**: Requirement 3

- [x] 3.2 新增策略模板生成命令
  - **验证**: Requirement 3

## 任务 4：输出契约

- [x] 4.1 标准化 JSON 输出模型
  - 包含 `spec_id`、`run_id`、`decision`、`score`
  - **验证**: Requirement 4

- [x] 4.2 支持报告落盘
  - **验证**: Requirement 4

## 任务 5：测试

- [x] 5.1 规则执行与评分单测
  - **验证**: Requirement 1, 2

- [x] 5.2 策略覆盖与 strict 行为测试
  - **验证**: Requirement 2, 3

- [x] 5.3 JSON 契约与落盘测试
  - **验证**: Requirement 4
