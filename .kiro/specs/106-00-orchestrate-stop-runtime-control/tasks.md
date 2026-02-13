# 实现任务

## 任务 1：运行元数据

- [ ] 1.1 run 启动时持久化 Run_ID 与运行信息
  - **验证**: Requirement 2

- [ ] 1.2 status 输出 Run_ID
  - **验证**: Requirement 2

## 任务 2：stop 控制通道

- [ ] 2.1 实现 `stop` 真实调用运行实例停止逻辑
  - **验证**: Requirement 1

- [ ] 2.2 实现 `--run-id` 精确停止
  - **验证**: Requirement 2

- [ ] 2.3 幂等与异常处理
  - **验证**: Requirement 3

## 任务 3：测试

- [ ] 3.1 stop 成功路径测试（killAll 被调用）
  - **验证**: Requirement 1

- [ ] 3.2 no-active/重复 stop/错误路径测试
  - **验证**: Requirement 3
