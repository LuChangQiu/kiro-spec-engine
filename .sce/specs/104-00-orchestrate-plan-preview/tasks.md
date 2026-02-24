# 实现任务

## 任务 1：命令接入

- [ ] 1.1 在 `orchestrate` 下新增 `plan` 子命令
  - 支持 `--specs`、`--json`
  - **验证**: Requirement 1

## 任务 2：计划构建

- [ ] 2.1 复用依赖图与批次算法生成 Orchestration_Plan
  - **验证**: Requirement 2, 3

- [ ] 2.2 缺失 Spec/循环依赖错误处理
  - **验证**: Requirement 2

## 任务 3：测试

- [ ] 3.1 增加命令层测试（文本/JSON 输出）
  - **验证**: Requirement 1, 2

- [ ] 3.2 增加异常路径测试（missing/cycle）
  - **验证**: Requirement 2
