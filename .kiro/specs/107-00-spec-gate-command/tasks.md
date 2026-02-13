# 实现任务

## 任务 1：命令注册

- [ ] 1.1 新增 `spec gate` 命令入口
  - 支持 `--spec`、`--json`、`--strict`、`--out`
  - **验证**: Requirement 1

## 任务 2：检查引擎

- [ ] 2.1 实现 Mandatory_Check
  - **验证**: Requirement 2

- [ ] 2.2 实现 Test_Check
  - **验证**: Requirement 3

- [ ] 2.3 实现 Doc_Check
  - 首批支持 Moqui 配置字段一致性
  - **验证**: Requirement 3

## 任务 3：报告与结论

- [ ] 3.1 实现 go/conditional-go/no-go 判定
  - **验证**: Requirement 4

- [ ] 3.2 支持报告落盘
  - **验证**: Requirement 4

## 任务 4：测试

- [ ] 4.1 命令层单测
  - 参数校验、JSON 输出、strict 行为
  - **验证**: Requirement 1, 4

- [ ] 4.2 检查模块单测
  - mandatory/test/doc 三模块
  - **验证**: Requirement 2, 3
