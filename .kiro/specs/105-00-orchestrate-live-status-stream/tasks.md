# 实现任务

## 任务 1：快照写入

- [ ] 1.1 在 run 执行中按事件/周期写入状态快照
  - **验证**: Requirement 1

- [ ] 1.2 写入失败降级为 warning
  - **验证**: Requirement 1

## 任务 2：watch 模式

- [ ] 2.1 实现 `status --watch`
  - **验证**: Requirement 2

- [ ] 2.2 实现 `--interval` 与自动退出
  - **验证**: Requirement 2

- [ ] 2.3 支持 `--watch --json` JSON Lines
  - **验证**: Requirement 3

## 任务 3：测试

- [ ] 3.1 命令层 watch 行为测试
  - **验证**: Requirement 2, 3

- [ ] 3.2 快照结构一致性测试
  - **验证**: Requirement 1, 3
